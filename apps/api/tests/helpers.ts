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
  // Auto-verify so write routes work in tests
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true, verifyEmailToken: null, verifyEmailTokenExpiry: null },
  });
  return res.body.accessToken as string;
}

export async function registerAndPromoteAdmin(
  email = 'admin@example.com',
  username = 'adminuser',
  password = 'adminpass123',
) {
  await request(app).post('/api/auth/register').send({ email, username, password });
  await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN', emailVerified: true, verifyEmailToken: null, verifyEmailTokenExpiry: null },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
}

export async function registerAndPromoteHelper(
  email = 'helper@example.com',
  username = 'helperuser',
  password = 'helperpass123',
) {
  await request(app).post('/api/auth/register').send({ email, username, password });
  await prisma.user.update({
    where: { email },
    data: { role: 'HELPER', emailVerified: true, verifyEmailToken: null, verifyEmailTokenExpiry: null },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
}
