import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  banned: true,
  createdAt: true,
} as const;

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

export async function setRole(id: string, role: 'USER' | 'ADMIN', requesterId: string) {
  if (id === requesterId) throw new AppError(400, 'Cannot change your own role', 'SELF_ACTION');
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
  return prisma.user.update({ where: { id }, data: { role }, select: USER_SELECT });
}

export async function setBanned(id: string, banned: boolean, requesterId: string) {
  if (id === requesterId) throw new AppError(400, 'Cannot ban yourself', 'SELF_ACTION');
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
  if (banned) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } });
  }
  return prisma.user.update({ where: { id }, data: { banned }, select: USER_SELECT });
}
