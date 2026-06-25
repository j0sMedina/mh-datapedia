import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import type { Register, Login } from '@mh-datapedia/shared';

const SALT_ROUNDS = 12;
export const ACCESS_TOKEN_TTL_S = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

type Role = 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';

export function signAccessToken(userId: string, role: Role) {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_S,
  });
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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
  // Check lockout before anything else
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  const attemptCount = await prisma.loginAttempt.count({
    where: { email: data.email, createdAt: { gte: windowStart } },
  });
  if (attemptCount >= MAX_LOGIN_ATTEMPTS) {
    const oldest = await prisma.loginAttempt.findFirst({
      where: { email: data.email, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
    });
    const lockedUntil = new Date(oldest!.createdAt.getTime() + LOCKOUT_WINDOW_MS);
    throw new AppError(429, 'Account temporarily locked', 'RATE_LIMITED', {
      lockedUntil: lockedUntil.toISOString(),
    });
  }

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    await prisma.loginAttempt.create({ data: { email: data.email } });
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    await prisma.loginAttempt.create({ data: { email: data.email } });
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  // Auto-unban if temporary ban has expired
  if (user.banned && user.bannedUntil && user.bannedUntil < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { banned: false, bannedReason: null, bannedAt: null, bannedUntil: null },
    });
    user.banned = false;
  }

  if (user.banned) {
    throw new AppError(403, 'Account is banned', 'BANNED', {
      bannedReason: user.bannedReason,
      bannedAt: user.bannedAt?.toISOString() ?? null,
      bannedUntil: user.bannedUntil?.toISOString() ?? null,
    });
  }

  // Clear lockout on success
  await prisma.loginAttempt.deleteMany({ where: { email: data.email } });

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

  if (!stored) {
    // Not in active tokens — check revoked tokens for reuse detection
    const tokenHash = hashToken(token);
    const revoked = await prisma.revokedToken.findUnique({ where: { tokenHash } });
    if (revoked) {
      // Token reuse detected — revoke all sessions for this user
      await prisma.refreshToken.deleteMany({ where: { userId: revoked.userId } });
      throw new AppError(401, 'Token reuse detected', 'TOKEN_REUSE_DETECTED');
    }
    throw new AppError(401, 'Invalid or expired refresh token', 'UNAUTHORIZED');
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token } });
    throw new AppError(401, 'Invalid or expired refresh token', 'UNAUTHORIZED');
  }

  // Auto-unban if ban expired
  let currentUser = stored.user;
  if (currentUser.banned) {
    if (currentUser.bannedUntil && currentUser.bannedUntil < new Date()) {
      currentUser = await prisma.user.update({
        where: { id: stored.userId },
        data: { banned: false, bannedReason: null, bannedAt: null, bannedUntil: null },
      });
    } else {
      await prisma.refreshToken.deleteMany({ where: { userId: stored.userId } });
      throw new AppError(403, 'Account is banned', 'BANNED', {
        bannedReason: currentUser.bannedReason,
        bannedAt: currentUser.bannedAt?.toISOString() ?? null,
        bannedUntil: currentUser.bannedUntil?.toISOString() ?? null,
      });
    }
  }

  // Rotate: move old token to revoked, issue new one
  const tokenHash = hashToken(stored.token);
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { token } }),
    prisma.revokedToken.create({
      data: { tokenHash, userId: stored.userId, expiresAt: stored.expiresAt },
    }),
  ]);

  const newRefreshToken = await createRefreshToken(stored.userId);
  const accessToken = signAccessToken(stored.userId, currentUser.role);
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
