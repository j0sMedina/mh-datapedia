import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../helpers';

function makeToken(role: string) {
  return jwt.sign({ sub: 'test-id', role }, process.env.JWT_SECRET!, { expiresIn: 60 });
}

describe('authorize middleware hierarchy', () => {
  it('allows MASTER through authorize("ADMIN")', async () => {
    const token = makeToken('MASTER');
    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);
    // MASTER should get through authorize('ADMIN') — 200, not 403
    expect(res.status).not.toBe(403);
  });

  it('allows ADMIN through authorize("HELPER")', async () => {
    const token = makeToken('ADMIN');
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(403);
  });

  it('blocks USER from authorize("ADMIN") route', async () => {
    const token = makeToken('USER');
    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('blocks HELPER from authorize("ADMIN") route', async () => {
    const token = makeToken('HELPER');
    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
