import request from 'supertest';
import { app } from './helpers';

describe('GET /api/health', () => {
  it('returns 200 with status ok and db ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeGreaterThan(0);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.db).toBe('ok');
  });
});
