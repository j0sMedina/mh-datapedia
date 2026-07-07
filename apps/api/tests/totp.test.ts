import request from 'supertest';
import { app, prisma, registerUser } from './helpers';
import { authenticator } from 'otplib';

const EMAIL = 'totp@test.com';
const USERNAME = 'totpuser';
const PASSWORD = 'password123';

async function resetTotpState() {
  await prisma.user.update({
    where: { email: EMAIL },
    data: { totpEnabled: false, totpSecret: null, backupCodes: [] },
  });
}

async function loginNoMfa(): Promise<{ token: string; cookie: string }> {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: EMAIL, password: PASSWORD });
  return {
    token: loginRes.body.accessToken as string,
    cookie: (loginRes.headers['set-cookie'] as unknown as string[] | undefined)?.[0] ?? '',
  };
}

async function setupAndEnableTotp(): Promise<{ secret: string; backupCodes: string[] }> {
  const { token, cookie } = await loginNoMfa();
  const setupRes = await request(app)
    .get('/api/auth/totp/setup')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', cookie);
  const secret = setupRes.body.secret as string;
  const enableRes = await request(app)
    .post('/api/auth/totp/enable')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', cookie)
    .send({ code: authenticator.generate(secret) });
  return { secret, backupCodes: enableRes.body.backupCodes as string[] };
}

async function verifyTotpLogin(secret: string): Promise<{ token: string; cookie: string }> {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: EMAIL, password: PASSWORD });
  const verifyRes = await request(app)
    .post('/api/auth/totp/verify')
    .send({ mfaPendingToken: loginRes.body.mfaPendingToken, code: authenticator.generate(secret) });
  return {
    token: verifyRes.body.accessToken as string,
    cookie: (verifyRes.headers['set-cookie'] as unknown as string[] | undefined)?.[0] ?? '',
  };
}

beforeAll(async () => {
  await prisma.loginAttempt.deleteMany({ where: { email: EMAIL } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await registerUser(EMAIL, USERNAME, PASSWORD);
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('GET /api/auth/totp/setup', () => {
  beforeAll(() => resetTotpState());

  it('returns qrCodeDataUrl and secret', async () => {
    const { token, cookie } = await loginNoMfa();
    const res = await request(app)
      .get('/api/auth/totp/setup')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(res.body.secret).toBeTruthy();
  });
});

describe('POST /api/auth/totp/enable', () => {
  let secret: string;
  let freshToken: string;
  let freshCookie: string;

  beforeEach(async () => {
    // Reset DB first so login doesn't trigger MFA
    await resetTotpState();
    const session = await loginNoMfa();
    freshToken = session.token;
    freshCookie = session.cookie;
    const setupRes = await request(app)
      .get('/api/auth/totp/setup')
      .set('Authorization', `Bearer ${freshToken}`)
      .set('Cookie', freshCookie);
    secret = setupRes.body.secret as string;
  });

  it('returns 400 INVALID_CODE with wrong code', async () => {
    const res = await request(app)
      .post('/api/auth/totp/enable')
      .set('Authorization', `Bearer ${freshToken}`)
      .set('Cookie', freshCookie)
      .send({ code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CODE');
  });

  it('returns 200 with 10 backup codes on correct TOTP code', async () => {
    const res = await request(app)
      .post('/api/auth/totp/enable')
      .set('Authorization', `Bearer ${freshToken}`)
      .set('Cookie', freshCookie)
      .send({ code: authenticator.generate(secret) });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.backupCodes)).toBe(true);
    expect(res.body.backupCodes).toHaveLength(10);
    expect((res.body.backupCodes as string[])[0]).toHaveLength(10);
  });
});

describe('POST /api/auth/login with 2FA enabled', () => {
  let secret: string;

  beforeAll(async () => {
    await resetTotpState();
    ({ secret } = await setupAndEnableTotp());
  });

  it('returns mfaRequired and mfaPendingToken — no cookie, no accessToken', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.mfaRequired).toBe(true);
    expect(res.body.mfaPendingToken).toBeTruthy();
    expect(res.body.accessToken).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  describe('POST /api/auth/totp/verify', () => {
    it('returns 401 with invalid mfaPendingToken', async () => {
      const res = await request(app)
        .post('/api/auth/totp/verify')
        .send({ mfaPendingToken: 'notavalidtoken', code: '123456' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 INVALID_CODE with wrong code', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: EMAIL, password: PASSWORD });
      const res = await request(app)
        .post('/api/auth/totp/verify')
        .send({ mfaPendingToken: loginRes.body.mfaPendingToken, code: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CODE');
    });

    it('returns full session with valid TOTP code', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: EMAIL, password: PASSWORD });
      const res = await request(app)
        .post('/api/auth/totp/verify')
        .send({ mfaPendingToken: loginRes.body.mfaPendingToken, code: authenticator.generate(secret) });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.user.email).toBe(EMAIL);
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });
});

describe('Backup code: use once and consume', () => {
  let backupCode: string;
  let secret: string;

  beforeAll(async () => {
    await resetTotpState();
    ({ secret, backupCodes: [backupCode] } = await setupAndEnableTotp());
  });

  it('accepts a backup code for login', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    const res = await request(app)
      .post('/api/auth/totp/verify')
      .send({ mfaPendingToken: loginRes.body.mfaPendingToken, code: backupCode });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects the same backup code a second time', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    const res = await request(app)
      .post('/api/auth/totp/verify')
      .send({ mfaPendingToken: loginRes.body.mfaPendingToken, code: backupCode });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CODE');
  });
});

describe('POST /api/auth/totp/disable', () => {
  let secret: string;

  beforeAll(async () => {
    await resetTotpState();
    ({ secret } = await setupAndEnableTotp());
  });

  it('returns 400 INVALID_PASSWORD with wrong password', async () => {
    const { token, cookie } = await verifyTotpLogin(secret);
    const res = await request(app)
      .post('/api/auth/totp/disable')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie)
      .send({ password: 'wrongpassword' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PASSWORD');
  });

  it('disables 2FA and next login returns a direct session', async () => {
    const { token, cookie } = await verifyTotpLogin(secret);
    const res = await request(app)
      .post('/api/auth/totp/disable')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie)
      .send({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Two-factor authentication disabled.');

    const loginAfter = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(loginAfter.body.accessToken).toBeTruthy();
    expect(loginAfter.body.mfaRequired).toBeUndefined();
  });
});
