import request from 'supertest';
import { app, prisma, registerAndPromoteAdmin } from './helpers';

let adminToken: string;
let userToken: string;
let testMonsterId: string;

const TEST_MONSTER = {
  name: 'Test Rathalos',
  title: 'King of the Skies',
  description: 'A fearsome flying wyvern that rules the skies.',
  type: 'Large',
  firstGame: 'MONSTER_HUNTER_WORLD',
  firstYear: 2004,
  isBoss: true,
  habitats: ['Ancient Forest', 'Elder Recess'],
};

beforeAll(async () => {
  adminToken = await registerAndPromoteAdmin('monstersadmin@example.com', 'monstersadmin');
  const { registerUser } = await import('./helpers');
  userToken = await registerUser('regularuser@example.com', 'regularuser');
  const res = await request(app)
    .post('/api/monsters')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(TEST_MONSTER);
  testMonsterId = res.body.data.id;
});

afterAll(async () => {
  await prisma.monster.deleteMany({ where: { name: { contains: 'Test' } } });
  await prisma.user.deleteMany({ where: { email: { in: ['monstersadmin@example.com', 'regularuser@example.com'] } } });
  await prisma.$disconnect();
});

describe('GET /api/monsters', () => {
  it('returns 200 with paginated list', async () => {
    const res = await request(app).get('/api/monsters');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
    expect(typeof res.body.meta.total).toBe('number');
  });

  it('filters by type=Large', async () => {
    const res = await request(app).get('/api/monsters?type=Large');
    expect(res.status).toBe(200);
    res.body.data.forEach((m: any) => expect(m.type).toBe('Large'));
  });

  it('filters by search', async () => {
    const res = await request(app).get('/api/monsters?search=Rathalos');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toContain('Rathalos');
  });
});

describe('GET /api/monsters/:id', () => {
  it('returns 200 with full monster and all relations', async () => {
    const res = await request(app).get(`/api/monsters/${testMonsterId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(testMonsterId);
    expect(Array.isArray(res.body.data.hitzones)).toBe(true);
    expect(Array.isArray(res.body.data.weaknesses)).toBe(true);
    expect(Array.isArray(res.body.data.drops)).toBe(true);
    expect(Array.isArray(res.body.data.subspecies)).toBe(true);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/monsters/clnotexist00000000000000000');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/monsters', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/monsters').send(TEST_MONSTER);
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const userToken = await (await import('./helpers')).registerUser(
      'notadmin@example.com',
      'notadminuser',
    );
    const res = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${userToken}`)
      .send(TEST_MONSTER);
    expect(res.status).toBe(403);
  });

  it('returns 201 for admin with valid body', async () => {
    const res = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...TEST_MONSTER, name: 'Admin Created Monster' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Admin Created Monster');
  });
});

describe('PUT /api/monsters/:id/weaknesses', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/weaknesses`)
      .send([]);
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/weaknesses`)
      .set('Authorization', `Bearer ${userToken}`)
      .send([]);
    expect(res.status).toBe(403);
  });

  it('returns 200 with stored weaknesses for admin', async () => {
    const payload = [
      { element: 'Fire', rating: 3, isImmune: false },
      { element: 'Water', rating: 0, isImmune: true },
    ];
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/weaknesses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    const fire = res.body.data.find((w: any) => w.element === 'Fire');
    expect(fire.rating).toBe(3);
    expect(fire.isImmune).toBe(false);
    const water = res.body.data.find((w: any) => w.element === 'Water');
    expect(water.isImmune).toBe(true);
  });

  it('replaces all on second call', async () => {
    const payload = [{ element: 'Dragon', rating: 2, isImmune: false }];
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/weaknesses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].element).toBe('Dragon');
  });
});

describe('PUT /api/monsters/:id/hitzones', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/hitzones`)
      .send([]);
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/hitzones`)
      .set('Authorization', `Bearer ${userToken}`)
      .send([]);
    expect(res.status).toBe(403);
  });

  it('returns 200 with stored hitzones for admin', async () => {
    const payload = [
      { part: 'Head', cut: 70, blunt: 70, bullet: 60, fire: 0, water: 5, thunder: 15, ice: 5, dragon: 25 },
      { part: 'Body', cut: 45, blunt: 45, bullet: 40, fire: 0, water: 5, thunder: 10, ice: 0, dragon: 15 },
    ];
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/hitzones`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    const head = res.body.data.find((h: any) => h.part === 'Head');
    expect(head.cut).toBe(70);
    expect(head.dragon).toBe(25);
  });

  it('replaces all on second call', async () => {
    const payload = [
      { part: 'Tail', cut: 80, blunt: 60, bullet: 55, fire: 0, water: 0, thunder: 5, ice: 5, dragon: 10 },
    ];
    const res = await request(app)
      .put(`/api/monsters/${testMonsterId}/hitzones`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].part).toBe('Tail');
  });
});
