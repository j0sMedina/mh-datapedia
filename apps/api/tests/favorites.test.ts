import request from 'supertest';
import { app, prisma, registerUser, registerAndPromoteAdmin } from './helpers';

let userToken: string;
let adminToken: string;
let monsterId: string;

beforeAll(async () => {
  userToken = await registerUser('favuser@example.com', 'favuser');
  adminToken = await registerAndPromoteAdmin('favadmin@example.com', 'favadmin');
  const res = await request(app)
    .post('/api/monsters')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Favorites Test Monster',
      title: 'Test Title',
      description: 'A test monster.',
      type: 'FlyingWyvern',
    });
  monsterId = res.body.data.id;
});

afterAll(async () => {
  await prisma.monster.deleteMany({ where: { name: 'Favorites Test Monster' } });
  await prisma.user.deleteMany({ where: { email: { in: ['favuser@example.com', 'favadmin@example.com', 'unverified@example.com'] } } });
  await prisma.$disconnect();
});

describe('POST /api/users/me/favorites/:monsterId — email verification gate', () => {
  it('returns 403 EMAIL_NOT_VERIFIED for unverified user', async () => {
    // Register without auto-verifying
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'unverified@example.com', username: 'unverified', password: 'password123' });
    const unverifiedToken = regRes.body.accessToken;

    const res = await request(app)
      .post(`/api/users/me/favorites/${monsterId}`)
      .set('Authorization', `Bearer ${unverifiedToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');

    // Cleanup
    await prisma.user.deleteMany({ where: { email: 'unverified@example.com' } });
  });
});

describe('POST /api/users/me/favorites/:monsterId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post(`/api/users/me/favorites/${monsterId}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 when authenticated and monster exists', async () => {
    const res = await request(app)
      .post(`/api/users/me/favorites/${monsterId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 404 for unknown monster', async () => {
    const res = await request(app)
      .post('/api/users/me/favorites/clnotexist00000000000000000')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/users/me/favorites', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/users/me/favorites');
    expect(res.status).toBe(401);
  });

  it('returns 200 with array of favorites', async () => {
    const res = await request(app)
      .get('/api/users/me/favorites')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('DELETE /api/users/me/favorites/:monsterId', () => {
  it('returns 204 on successful removal', async () => {
    const res = await request(app)
      .delete(`/api/users/me/favorites/${monsterId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(204);
  });
});
