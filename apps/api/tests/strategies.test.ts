import request from 'supertest';
import { app, prisma, registerUser, registerAndPromoteAdmin, registerAndPromoteHelper } from './helpers';

let adminToken: string;
let helperToken: string;
let userToken: string;
let monsterId: string;

const STRATEGY_BODY = {
  title: 'Fire is effective',
  content: 'Use fire weapons for best results.',
  difficulty: 'Beginner',
  game: 'MONSTER_HUNTER_WILDS',
};

beforeAll(async () => {
  adminToken = await registerAndPromoteAdmin('strat-admin@example.com', 'stratadmin');
  helperToken = await registerAndPromoteHelper('strat-helper@example.com', 'strathelper');
  userToken = await registerUser('strat-user@example.com', 'stratuser');

  const res = await request(app)
    .post('/api/monsters')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Approval Test Monster', title: 'Test', description: 'For testing.', type: 'FlyingWyvern' });
  monsterId = res.body.data.id;
});

afterAll(async () => {
  await prisma.strategy.deleteMany({ where: { monsterId } });
  await prisma.monster.deleteMany({ where: { id: monsterId } });
  await prisma.user.deleteMany({
    where: { email: { in: ['strat-admin@example.com', 'strat-helper@example.com', 'strat-user@example.com'] } },
  });
  await prisma.$disconnect();
});

describe('POST /api/strategies — creates as PENDING', () => {
  it('creates strategy with PENDING status', async () => {
    const res = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    await prisma.strategy.deleteMany({ where: { id: res.body.data.id } });
  });
});

describe('GET /monsters/:id/strategies — status filtering', () => {
  let pendingId: string;
  let approvedId: string;
  let rejectedId: string;

  beforeAll(async () => {
    // Create a PENDING strategy
    const p = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY });
    pendingId = p.body.data.id;

    // Approve one
    const a = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY, title: 'Approved strategy' });
    approvedId = a.body.data.id;
    await request(app)
      .patch(`/api/strategies/${approvedId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'approve' });

    // Reject one
    const r = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY, title: 'Rejected strategy' });
    rejectedId = r.body.data.id;
    await request(app)
      .patch(`/api/strategies/${rejectedId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'reject', reason: 'Inaccurate information' });
  });

  afterAll(async () => {
    await prisma.strategy.deleteMany({ where: { id: { in: [pendingId, approvedId, rejectedId] } } });
  });

  it('unauthenticated request returns only APPROVED', async () => {
    const res = await request(app).get(`/api/monsters/${monsterId}/strategies`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(approvedId);
    expect(ids).not.toContain(pendingId);
    expect(ids).not.toContain(rejectedId);
  });

  it('authenticated request includes own PENDING and REJECTED', async () => {
    const res = await request(app)
      .get(`/api/monsters/${monsterId}/strategies`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(approvedId);
    expect(ids).toContain(pendingId);
    expect(ids).toContain(rejectedId);
  });

  it('lazy-deletes REJECTED strategies older than 3 days on fetch', async () => {
    // Create a rejected strategy then manually backdate its rejectedAt
    const s = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY, title: 'Old rejected' });
    const oldId = s.body.data.id;
    await request(app)
      .patch(`/api/strategies/${oldId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'reject', reason: 'Too old' });
    // Backdate rejectedAt to 4 days ago
    await prisma.strategy.update({
      where: { id: oldId },
      data: { rejectedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
    });

    // Fetch triggers lazy cleanup
    await request(app).get(`/api/monsters/${monsterId}/strategies`);

    const still = await prisma.strategy.findUnique({ where: { id: oldId } });
    expect(still).toBeNull();
  });
});

describe('PATCH /api/strategies/:id/review', () => {
  let stratId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY });
    stratId = res.body.data.id;
  });

  afterEach(async () => {
    await prisma.strategy.deleteMany({ where: { id: stratId } });
  });

  it('HELPER can approve a PENDING strategy', async () => {
    const res = await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('HELPER can reject a PENDING strategy with reason', async () => {
    const res = await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'reject', reason: 'Content is inaccurate' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.rejectionReason).toBe('Content is inaccurate');
    expect(res.body.data.rejectedAt).not.toBeNull();
  });

  it('returns 400 when rejecting without a reason', async () => {
    const res = await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'reject' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when strategy is not PENDING', async () => {
    await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'approve' });
    const res = await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${helperToken}`)
      .send({ action: 'approve' });
    expect(res.status).toBe(409);
  });

  it('returns 403 for USER role', async () => {
    const res = await request(app)
      .patch(`/api/strategies/${stratId}/review`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ action: 'approve' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/strategies/pending', () => {
  let pendingId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/strategies')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ monsterId, ...STRATEGY_BODY, title: 'Queue test strategy' });
    pendingId = res.body.data.id;
  });

  afterAll(async () => {
    await prisma.strategy.deleteMany({ where: { id: pendingId } });
  });

  it('HELPER can fetch the pending queue', async () => {
    const res = await request(app)
      .get('/api/strategies/pending')
      .set('Authorization', `Bearer ${helperToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(pendingId);
  });

  it('returns 403 for USER role', async () => {
    const res = await request(app)
      .get('/api/strategies/pending')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});
