import request from 'supertest';
import { app, prisma } from './helpers';

const BASE_USER = {
  email: 'authtest@example.com',
  username: 'authtest',
  password: 'password123',
};

afterAll(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: 'authtest' } } });
  await prisma.user.deleteMany({ where: { email: 'verify@example.com' } });
  await prisma.user.deleteMany({ where: { email: 'reset@example.com' } });
  await prisma.user.deleteMany({ where: { email: 'sessions@example.com' } });
  await prisma.user.deleteMany({ where: { email: 'sessions2@example.com' } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('returns 201 with user and accessToken', async () => {
    const res = await request(app).post('/api/auth/register').send(BASE_USER);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(BASE_USER.email);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.expiresIn).toBe(900);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 422 with invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...BASE_USER, email: 'notanemail' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 on duplicate email', async () => {
    await request(app).post('/api/auth/register').send({ ...BASE_USER, email: 'dup@example.com', username: 'dup1' });
    const res = await request(app).post('/api/auth/register').send({ ...BASE_USER, email: 'dup@example.com', username: 'dup2' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@example.com', username: 'logintest', password: 'password123' });
  });

  it('returns 200 with accessToken on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('Login captures userAgent and ipAddress on stored token', async () => {
    const testUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
    const res = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', testUA)
      .send({ email: 'login@example.com', password: 'password123' });
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: 'login@example.com' } });
    const stored = await prisma.refreshToken.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(stored?.userAgent).toBe(testUA);
    expect(stored?.ipAddress).toBeDefined();
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'me@example.com', username: 'meuser', password: 'password123' });
    const token = regRes.body.accessToken;
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
  });
});

describe('GET /api/auth/verify-email', () => {
  it('returns 400 for missing token', async () => {
    const res = await request(app).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('returns 400 for unknown token', async () => {
    const res = await request(app).get('/api/auth/verify-email?token=doesnotexist');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('verifies a valid token and marks emailVerified true', async () => {
    // Register a user (unverified)
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'verify@example.com', username: 'verifyuser', password: 'password123' });
    expect(regRes.body.user.emailVerified).toBe(false);

    // Read the token directly from the DB
    const dbUser = await prisma.user.findUnique({
      where: { email: 'verify@example.com' },
      select: { verifyEmailToken: true },
    });
    expect(dbUser?.verifyEmailToken).toBeTruthy();

    // Verify
    const res = await request(app).get(`/api/auth/verify-email?token=${dbUser!.verifyEmailToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Email verified');

    // Check DB
    const updated = await prisma.user.findUnique({ where: { email: 'verify@example.com' } });
    expect(updated?.emailVerified).toBe(true);
    expect(updated?.verifyEmailToken).toBeNull();
  });

  it('returns 400 ALREADY_VERIFIED when token exists but user is already verified', async () => {
    // Get the token that was set during registration in the previous test
    const dbUser = await prisma.user.findUnique({
      where: { email: 'verify@example.com' },
      select: { verifyEmailToken: true, emailVerified: true },
    });

    // If already verified (from previous test), create a new unverified user for this test
    const testEmail = 'alreadyverified@example.com';
    await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, username: 'alreadyverifieduser', password: 'password123' });

    const freshUser = await prisma.user.findUnique({
      where: { email: testEmail },
      select: { verifyEmailToken: true },
    });
    expect(freshUser?.verifyEmailToken).toBeTruthy();
    const token = freshUser!.verifyEmailToken!;

    // Manually set emailVerified=true but KEEP the token (simulates concurrent request race)
    await prisma.user.update({
      where: { email: testEmail },
      data: { emailVerified: true },
    });

    // Now call verify-email — should get ALREADY_VERIFIED because token exists and emailVerified=true
    const res = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ALREADY_VERIFIED');

    // Cleanup
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/auth/resend-verification');
    expect(res.status).toBe(401);
  });

  it('returns 400 if already verified', async () => {
    // Use the now-verified user from above
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'verify@example.com', password: 'password123' });
    const token = loginRes.body.accessToken;

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ALREADY_VERIFIED');
  });
});

describe('POST /api/auth/forgot-password + POST /api/auth/reset-password', () => {
  const resetEmail = 'reset@example.com';
  const resetUsername = 'resetuser';
  const originalPassword = 'original123';
  const newPassword = 'newpassword456';

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: resetEmail, username: resetUsername, password: originalPassword });
    await prisma.user.update({
      where: { email: resetEmail },
      data: { emailVerified: true, verifyEmailToken: null, verifyEmailTokenExpiry: null },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: resetEmail } });
  });

  it('forgot-password returns 200 for registered email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: resetEmail });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If that email exists');
  });

  it('forgot-password returns 200 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If that email exists');
  });

  it('forgot-password generates a token in the database', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: resetEmail });
    const user = await prisma.user.findUnique({
      where: { email: resetEmail },
      select: { resetPasswordToken: true, resetPasswordTokenExpiry: true },
    });
    expect(user?.resetPasswordToken).not.toBeNull();
    expect(user?.resetPasswordTokenExpiry).not.toBeNull();
  });

  it('reset-password with valid token changes password and revokes sessions', async () => {
    // Get a fresh token
    await request(app).post('/api/auth/forgot-password').send({ email: resetEmail });
    const user = await prisma.user.findUnique({
      where: { email: resetEmail },
      select: { resetPasswordToken: true },
    });
    const token = user!.resetPasswordToken!;

    // Create a session to verify it gets revoked
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: resetEmail, password: originalPassword });
    expect(loginRes.status).toBe(200);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: newPassword });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Password reset successfully');

    // Sessions were revoked — check before creating any new session
    const tokens = await prisma.refreshToken.findMany({
      where: { user: { email: resetEmail } },
    });
    expect(tokens).toHaveLength(0);

    // Can now log in with new password
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: resetEmail, password: newPassword });
    expect(newLoginRes.status).toBe(200);

    // Old password no longer works
    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: resetEmail, password: originalPassword });
    expect(oldLoginRes.status).toBe(401);
  });

  it('reset-password with invalid token returns 400 INVALID_TOKEN', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'notarealtoken', password: newPassword });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('reset-password with expired token returns 400 INVALID_TOKEN', async () => {
    // Generate a token then manually set its expiry to the past
    await request(app).post('/api/auth/forgot-password').send({ email: resetEmail });
    const user = await prisma.user.findUnique({
      where: { email: resetEmail },
      select: { resetPasswordToken: true },
    });
    const token = user!.resetPasswordToken!;
    await prisma.user.update({
      where: { email: resetEmail },
      data: { resetPasswordTokenExpiry: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: newPassword });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('reset-password token can only be used once', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: resetEmail });
    const user = await prisma.user.findUnique({
      where: { email: resetEmail },
      select: { resetPasswordToken: true },
    });
    const token = user!.resetPasswordToken!;

    // First use
    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'yetanother789' });
    expect(first.status).toBe(200);

    // Second use — token is already cleared
    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'yetanother789' });
    expect(second.status).toBe(400);
    expect(second.body.code).toBe('INVALID_TOKEN');
  });
});

describe('Session management', () => {
  const sessionEmail = 'sessions@example.com';
  const sessionPassword = 'sesspass123';
  let sessionCookie: string;
  let secondCookie: string;

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: sessionEmail, username: 'sessionuser', password: sessionPassword });
    await prisma.user.update({
      where: { email: sessionEmail },
      data: { emailVerified: true },
    });

    const login1 = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    sessionCookie = login1.headers['set-cookie'][0];

    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    secondCookie = login2.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: sessionEmail } });
  });

  it('GET /api/auth/sessions returns active sessions with isCurrent', async () => {
    // Get access token for the first session
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    const accessToken = loginRes.body.accessToken;
    const cookie = loginRes.headers['set-cookie'][0];

    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const current = res.body.find((s: { isCurrent: boolean }) => s.isCurrent);
    expect(current).toBeDefined();
    expect(current.deviceLabel).toBeDefined();
  });

  it('DELETE /api/auth/sessions/:id revokes another session', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    const accessToken = loginRes.body.accessToken;
    const cookie = loginRes.headers['set-cookie'][0];

    const sessions = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);

    const other = sessions.body.find((s: { isCurrent: boolean }) => !s.isCurrent);
    if (!other) return; // skip if only one session

    const res = await request(app)
      .delete(`/api/auth/sessions/${other.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('revoked');
  });

  it('DELETE /api/auth/sessions/:id returns 403 for another user session', async () => {
    // Create a second user and try to delete a session from the first user
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'sessions2@example.com', username: 'sessionuser2', password: sessionPassword });
    await prisma.user.update({
      where: { email: 'sessions2@example.com' },
      data: { emailVerified: true },
    });
    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sessions2@example.com', password: sessionPassword });
    const accessToken2 = login2.body.accessToken;
    const cookie2 = login2.headers['set-cookie'][0];

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    const accessToken = loginRes.body.accessToken;
    const cookie = loginRes.headers['set-cookie'][0];

    const sessions = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    const targetId = sessions.body[0].id;

    const res = await request(app)
      .delete(`/api/auth/sessions/${targetId}`)
      .set('Authorization', `Bearer ${accessToken2}`)
      .set('Cookie', cookie2);

    expect(res.status).toBe(403);

    await prisma.user.deleteMany({ where: { email: 'sessions2@example.com' } });
  });

  it('DELETE /api/auth/sessions revokes all other sessions', async () => {
    // Create two fresh sessions
    const l1 = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });
    const l2 = await request(app)
      .post('/api/auth/login')
      .send({ email: sessionEmail, password: sessionPassword });

    const accessToken = l1.body.accessToken;
    const cookie = l1.headers['set-cookie'][0];

    const before = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    expect(before.body.length).toBeGreaterThanOrEqual(2);

    const res = await request(app)
      .delete('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);

    const after = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    expect(after.body.every((s: { isCurrent: boolean }) => s.isCurrent)).toBe(true);
    expect(after.body.length).toBe(1);
  });
});
