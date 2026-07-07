import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service';
import { parseUserAgent } from '../lib/parseUserAgent';
import type { Register, Login } from '@mh-datapedia/shared';

const SALT_ROUNDS = 12;
export const ACCESS_TOKEN_TTL_S = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

type Role = 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';

type SessionItem = {
  id: string;
  deviceLabel: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
};

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  emailVerified: true,
  createdAt: true,
} as const;

export function signAccessToken(userId: string, role: Role) {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_S,
  });
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function createRefreshToken(
  userId: string,
  userAgent?: string,
  ipAddress?: string,
): Promise<string> {
  const token = randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({
    data: { token, userId, expiresAt, userAgent, ipAddress },
  });
  return token;
}

function generateVerifyToken() {
  return randomBytes(32).toString('hex');
}

export async function register(
  data: Register,
  meta?: { userAgent?: string; ipAddress?: string },
) {
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const verifyEmailToken = generateVerifyToken();
  const verifyEmailTokenExpiry = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      username: data.username,
      passwordHash,
      verifyEmailToken,
      verifyEmailTokenExpiry,
    },
    select: USER_SELECT,
  });

  try {
    await sendVerificationEmail(data.email, verifyEmailToken);
  } catch (err) {
    console.error('[register] Failed to send verification email:', err);
    // User was created — they can log in and request a new verification email
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id, meta?.userAgent, meta?.ipAddress);
  return { user, accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_S };
}

export async function login(
  data: Login,
  meta?: { userAgent?: string; ipAddress?: string },
) {
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
  const refreshToken = await createRefreshToken(user.id, meta?.userAgent, meta?.ipAddress);
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerified,
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
      const bannedTokenHash = hashToken(stored.token);
      await prisma.$transaction([
        prisma.refreshToken.deleteMany({ where: { userId: stored.userId } }),
        prisma.revokedToken.create({
          data: { tokenHash: bannedTokenHash, userId: stored.userId, expiresAt: stored.expiresAt },
        }),
      ]);
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

  const newRefreshToken = await createRefreshToken(
    stored.userId,
    stored.userAgent ?? undefined,
    stored.ipAddress ?? undefined,
  );
  const accessToken = signAccessToken(stored.userId, currentUser.role);
  return { accessToken, refreshToken: newRefreshToken, expiresIn: ACCESS_TOKEN_TTL_S };
}

export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
  return user;
}

export async function verifyEmail(token: string) {
  if (!token) throw new AppError(400, 'Invalid or expired token', 'INVALID_TOKEN');

  const user = await prisma.user.findUnique({
    where: { verifyEmailToken: token },
    select: { id: true, emailVerified: true, verifyEmailTokenExpiry: true },
  });

  if (!user) throw new AppError(400, 'Invalid or expired token', 'INVALID_TOKEN');
  if (user.emailVerified) throw new AppError(400, 'Email already verified', 'ALREADY_VERIFIED');
  if (!user.verifyEmailTokenExpiry || user.verifyEmailTokenExpiry < new Date()) {
    throw new AppError(400, 'Invalid or expired token', 'INVALID_TOKEN');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verifyEmailToken: null, verifyEmailTokenExpiry: null },
  });
}

export async function resendVerification(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
  if (user.emailVerified) throw new AppError(400, 'Email already verified', 'ALREADY_VERIFIED');

  const verifyEmailToken = generateVerifyToken();
  const verifyEmailTokenExpiry = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: userId },
    data: { verifyEmailToken, verifyEmailTokenExpiry },
  });

  await sendVerificationEmail(user.email, verifyEmailToken);
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;

  const resetPasswordToken = randomBytes(32).toString('hex');
  const resetPasswordTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetPasswordToken, resetPasswordTokenExpiry },
  });

  try {
    await sendPasswordResetEmail(email, resetPasswordToken);
  } catch (err) {
    console.error('[forgotPassword] Failed to send reset email:', err);
  }
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { resetPasswordToken: token },
    select: { id: true, resetPasswordTokenExpiry: true },
  });

  if (!user) throw new AppError(400, 'Invalid or expired reset link', 'INVALID_TOKEN');
  if (!user.resetPasswordTokenExpiry || user.resetPasswordTokenExpiry < new Date()) {
    throw new AppError(400, 'Invalid or expired reset link', 'INVALID_TOKEN');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetPasswordToken: null, resetPasswordTokenExpiry: null },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);
}

export async function getSessions(userId: string, currentToken: string): Promise<SessionItem[]> {
  const sessions = await prisma.refreshToken.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    deviceLabel: parseUserAgent(s.userAgent),
    ipAddress: s.ipAddress,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    isCurrent: s.token === currentToken,
  }));
}

export async function revokeSession(
  sessionId: string,
  userId: string,
  currentToken: string,
): Promise<{ wasCurrentSession: boolean }> {
  const session = await prisma.refreshToken.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new AppError(403, 'Session not found', 'FORBIDDEN');
  }

  const wasCurrentSession = session.token === currentToken;
  await prisma.refreshToken.delete({ where: { id: sessionId } });
  return { wasCurrentSession };
}

export async function revokeOtherSessions(userId: string, currentToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { userId, token: { not: currentToken } },
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new AppError(400, 'Invalid current password', 'INVALID_PASSWORD');
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
