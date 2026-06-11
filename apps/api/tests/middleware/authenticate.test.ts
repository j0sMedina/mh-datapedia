import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../helpers';

describe('authenticate middleware', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with malformed bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
  });

  it('returns 401 with expired token', async () => {
    const expired = jwt.sign(
      { sub: 'user123', role: 'USER' },
      process.env.JWT_SECRET!,
      { expiresIn: -1 },
    );
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});
