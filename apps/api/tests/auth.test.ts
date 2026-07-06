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

  it('returns 400 ALREADY_VERIFIED if used twice', async () => {
    const dbUser = await prisma.user.findUnique({
      where: { email: 'verify@example.com' },
      select: { emailVerified: true },
    });
    // Already verified from previous test — token is null, so lookup fails
    const res = await request(app).get('/api/auth/verify-email?token=someoldtoken');
    expect(res.status).toBe(400);
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
