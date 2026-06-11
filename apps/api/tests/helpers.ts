import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app';

export const app = createApp();
export const prisma = new PrismaClient();

export async function registerUser(
  email: string,
  username: string,
  password = 'password123',
) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, username, password });
  return res.body.accessToken as string;
}

export async function registerAndPromoteAdmin(
  email = 'admin@example.com',
  username = 'adminuser',
  password = 'adminpass123',
) {
  await request(app).post('/api/auth/register').send({ email, username, password });
  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
}
