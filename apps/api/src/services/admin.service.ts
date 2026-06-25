import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

type Role = 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  banned: true,
  bannedReason: true,
  bannedAt: true,
  bannedUntil: true,
  createdAt: true,
} as const;

const ADMIN_MANAGEABLE_ROLES: Role[] = ['USER', 'HELPER'];

export async function listUsers(search?: string) {
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { username: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;
  return prisma.user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: 'desc' } });
}

export async function setRole(
  id: string,
  newRole: Role,
  requesterId: string,
  requesterRole: Role,
) {
  if (id === requesterId) throw new AppError(400, 'Cannot change your own role', 'SELF_ACTION');

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) throw new AppError(404, 'User not found', 'NOT_FOUND');

  if (requesterRole === 'ADMIN') {
    if (!ADMIN_MANAGEABLE_ROLES.includes(target.role as Role)) {
      throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
    }
    if (!ADMIN_MANAGEABLE_ROLES.includes(newRole)) {
      throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
    }
  }

  const oldRole = target.role;
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: { role: newRole }, select: USER_SELECT });
    await tx.adminAction.create({
      data: {
        actorId: requesterId,
        action: 'ROLE_CHANGE',
        targetUserId: id,
        metadata: { from: oldRole, to: newRole },
      },
    });
    return user;
  });
}

export async function setBanned(
  id: string,
  banned: boolean,
  requesterId: string,
  requesterRole: Role,
  reason?: string,
  bannedUntil?: string | null,
) {
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) throw new AppError(404, 'User not found', 'NOT_FOUND');

  if (requesterRole === 'ADMIN' && !ADMIN_MANAGEABLE_ROLES.includes(target.role as Role)) {
    throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
  }

  if (id === requesterId) throw new AppError(400, 'Cannot ban yourself', 'SELF_ACTION');

  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: id } });

    const roleDowngrade = banned && (['HELPER', 'ADMIN'] as Role[]).includes(target.role as Role);

    const updateData = banned
      ? {
          banned: true,
          bannedReason: reason!,
          bannedAt: new Date(),
          bannedUntil: bannedUntil ? new Date(bannedUntil) : null,
          ...(roleDowngrade ? { role: 'USER' as const } : {}),
        }
      : {
          banned: false,
          bannedReason: null,
          bannedAt: null,
          bannedUntil: null,
        };

    const user = await tx.user.update({ where: { id }, data: updateData, select: USER_SELECT });

    await tx.adminAction.create({
      data: {
        actorId: requesterId,
        action: banned ? 'BAN' : 'UNBAN',
        targetUserId: id,
        metadata: banned
          ? { reason: reason!, bannedUntil: bannedUntil ?? null, roleDowngraded: roleDowngrade }
          : {},
      },
    });

    return user;
  });
}

export async function listAuditLog(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [entries, total] = await prisma.$transaction([
    prisma.adminAction.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { username: true } },
        targetUser: { select: { username: true } },
      },
    }),
    prisma.adminAction.count(),
  ]);
  return {
    entries: entries.map((e) => ({
      id: e.id,
      actorId: e.actorId,
      actorUsername: e.actor.username,
      action: e.action,
      targetUserId: e.targetUserId,
      targetUsername: e.targetUser?.username ?? null,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
