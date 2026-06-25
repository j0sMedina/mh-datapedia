import request from 'supertest';
import { app, prisma, registerAndPromoteAdmin, registerAndPromoteHelper } from './helpers';

let adminToken: string;
let helperToken: string;
let masterToken: string;
let userId: string;
let helperId: string;
let adminId: string;

beforeAll(async () => {
  adminToken = await registerAndPromoteAdmin('admin-scope@example.com', 'adminscope', 'adminpass123');
  helperToken = await registerAndPromoteHelper('helper-scope@example.com', 'helperscope', 'helperpass123');

  // Create a plain user
  const userRes = await request(app).post('/api/auth/register').send({
    email: 'target-user@example.com', username: 'targetuser', password: 'password123',
  });
  const user = await prisma.user.findUnique({ where: { email: 'target-user@example.com' }, select: { id: true } });
  userId = user!.id;

  const helper = await prisma.user.findUnique({ where: { email: 'helper-scope@example.com' }, select: { id: true } });
  helperId = helper!.id;

  const admin = await prisma.user.findUnique({ where: { email: 'admin-scope@example.com' }, select: { id: true } });
  adminId = admin!.id;

  // Create a MASTER (set via DB)
  await request(app).post('/api/auth/register').send({
    email: 'master-scope@example.com', username: 'masterscope', password: 'masterpass123',
  });
  await prisma.user.update({ where: { email: 'master-scope@example.com' }, data: { role: 'MASTER' } });
  const masterRes = await request(app).post('/api/auth/login').send({
    email: 'master-scope@example.com', password: 'masterpass123',
  });
  masterToken = masterRes.body.accessToken;
});

afterAll(async () => {
  await prisma.adminAction.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'admin-scope@example.com',
          'helper-scope@example.com',
          'target-user@example.com',
          'master-scope@example.com',
        ],
      },
    },
  });
  await prisma.$disconnect();
});

describe('setRole scope', () => {
  it('ADMIN can promote USER to HELPER', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'HELPER' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('HELPER');
    // Reset
    await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } });
  });

  it('ADMIN cannot promote USER to ADMIN', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('ADMIN cannot touch another ADMIN', async () => {
    const admin2Token = await registerAndPromoteAdmin('admin2-scope@example.com', 'adminscope2', 'adminpass123');
    const admin2 = await prisma.user.findUnique({ where: { email: 'admin2-scope@example.com' }, select: { id: true } });
    const res = await request(app)
      .patch(`/api/admin/users/${admin2!.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'USER' });
    expect(res.status).toBe(403);
    await prisma.user.deleteMany({ where: { email: 'admin2-scope@example.com' } });
  });

  it('MASTER can promote USER to ADMIN', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
    await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } });
  });
});

describe('setBanned scope', () => {
  it('ADMIN can ban a USER with reason', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${userId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ banned: true, reason: 'Spamming the forums repeatedly', bannedUntil: null });
    expect(res.status).toBe(200);
    expect(res.body.user.banned).toBe(true);
    expect(res.body.user.bannedReason).toBe('Spamming the forums repeatedly');
    await prisma.user.update({ where: { id: userId }, data: { banned: false, bannedReason: null, bannedAt: null } });
  });

  it('requires reason when banning', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${userId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ banned: true, bannedUntil: null });
    expect(res.status).toBe(422);
  });

  it('ADMIN cannot ban another ADMIN', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${adminId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ banned: true, reason: 'Trying to ban admin', bannedUntil: null });
    expect(res.status).toBe(403);
  });

  it('banning a HELPER downgrades their role to USER', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${helperId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ banned: true, reason: 'Posting inappropriate content repeatedly', bannedUntil: null });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('USER');
    expect(res.body.user.banned).toBe(true);
    await prisma.user.update({ where: { id: helperId }, data: { banned: false, bannedReason: null, bannedAt: null, role: 'HELPER' } });
  });

  it('MASTER can ban an ADMIN', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${adminId}/ban`)
      .set('Authorization', `Bearer ${masterToken}`)
      .send({ banned: true, reason: 'Admin abusing their privileges', bannedUntil: null });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('USER');
    await prisma.user.update({ where: { id: adminId }, data: { banned: false, bannedReason: null, bannedAt: null, role: 'ADMIN' } });
  });
});

describe('audit log', () => {
  it('records role change in audit log', async () => {
    await request(app)
      .patch(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'HELPER' });

    const res = await request(app)
      .get('/api/admin/audit?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const entries = res.body.entries;
    const roleChange = entries.find((e: any) => e.action === 'ROLE_CHANGE' && e.targetUserId === userId);
    expect(roleChange).toBeDefined();
    expect(roleChange.metadata.from).toBe('USER');
    expect(roleChange.metadata.to).toBe('HELPER');
    await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } });
  });
});
