import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import type { Register, Login } from '@mh-datapedia/shared';

const SALT_ROUNDS = 12;
export const ACCESS_TOKEN_TTL_S = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function signAccessToken(userId: string, role: 'USER' | 'ADMIN') {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_S,
  });
}

async function createRefreshToken(userId: string) {
  const token = randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function register(data: Register) {
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: data.email, username: data.username, passwordHash },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id);
  return { user, accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_S };
}

export async function login(data: Login) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id);
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_S,
  };
}

export async function refresh(token: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { token } });
    throw new AppError(401, 'Invalid or expired refresh token', 'UNAUTHORIZED');
  }
  await prisma.refreshToken.delete({ where: { token } });
  const newRefreshToken = await createRefreshToken(stored.userId);
  const accessToken = signAccessToken(stored.userId, stored.user.role);
  return { accessToken, refreshToken: newRefreshToken, expiresIn: ACCESS_TOKEN_TTL_S };
}

export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
  return user;
}
