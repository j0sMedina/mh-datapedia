import request from 'supertest';
import { app, prisma } from './helpers';

const LOCK_EMAIL = 'lockout@example.com';
const LOCK_USER = { email: LOCK_EMAIL, username: 'lockoutuser', password: 'password123' };

afterAll(async () => {
  await prisma.loginAttempt.deleteMany({ where: { email: LOCK_EMAIL } });
  await prisma.user.deleteMany({ where: { email: LOCK_EMAIL } });
  await prisma.$disconnect();
});

describe('Login lockout', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send(LOCK_USER);
  });

  it('allows login with correct password before lockout', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: LOCK_EMAIL, password: LOCK_USER.password });
    expect(res.status).toBe(200);
  });

  it('returns 429 after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email: LOCK_EMAIL, password: 'wrongpassword' });
    }
    const res = await request(app).post('/api/auth/login').send({ email: LOCK_EMAIL, password: LOCK_USER.password });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.body.lockedUntil).toBeDefined();
  });

  it('clears lockout on successful login after window passes', async () => {
    // Manually clear attempts to simulate window expiry
    await prisma.loginAttempt.deleteMany({ where: { email: LOCK_EMAIL } });
    const res = await request(app).post('/api/auth/login').send({ email: LOCK_EMAIL, password: LOCK_USER.password });
    expect(res.status).toBe(200);
  });
});

describe('Token reuse detection', () => {
  const REUSE_EMAIL = 'reuse@example.com';

  afterAll(async () => {
    await prisma.revokedToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany({ where: { email: REUSE_EMAIL } });
  });

  it('returns 401 TOKEN_REUSE_DETECTED when old refresh token is reused', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: REUSE_EMAIL, username: 'reuseuser', password: 'password123' });

    const cookie = reg.headers['set-cookie']?.[0] ?? '';

    // First refresh — rotates token
    await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    // Use the OLD cookie again (reuse)
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REUSE_DETECTED');
  });
});

describe('BANNED error includes details', () => {
  const BAN_EMAIL = 'banned@example.com';

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany({ where: { email: BAN_EMAIL } });
  });

  it('returns 403 BANNED with reason and dates', async () => {
    await request(app).post('/api/auth/register').send({ email: BAN_EMAIL, username: 'banneduser', password: 'password123' });
    await prisma.user.update({
      where: { email: BAN_EMAIL },
      data: {
        banned: true,
        bannedReason: 'Violated community rules',
        bannedAt: new Date(),
        bannedUntil: null,
      },
    });

    const res = await request(app).post('/api/auth/login').send({ email: BAN_EMAIL, password: 'password123' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BANNED');
    expect(res.body.bannedReason).toBe('Violated community rules');
    expect(res.body.bannedAt).toBeDefined();
    expect(res.body.bannedUntil).toBeNull();
  });
});
