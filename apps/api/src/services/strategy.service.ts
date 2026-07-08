import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import type { CreateStrategy, UpdateStrategy } from '@mh-datapedia/shared';

type Role = 'USER' | 'HELPER' | 'ADMIN' | 'MASTER';

const CAN_EDIT_ANY: Role[] = ['HELPER', 'ADMIN', 'MASTER'];
const CAN_DELETE_ANY: Role[] = ['ADMIN', 'MASTER'];

export async function createStrategy(authorId: string, data: CreateStrategy) {
  const exists = await prisma.monster.findUnique({
    where: { id: data.monsterId },
    select: { id: true },
  });
  if (!exists) throw new AppError(404, 'Monster not found', 'NOT_FOUND');
  return prisma.strategy.create({
    data: { ...data, authorId },
    include: { author: { select: { id: true, username: true } } },
  });
}

export async function updateStrategy(
  id: string,
  userId: string,
  role: Role,
  data: UpdateStrategy,
) {
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!strategy) throw new AppError(404, 'Strategy not found', 'NOT_FOUND');
  if (!CAN_EDIT_ANY.includes(role) && strategy.authorId !== userId) {
    throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
  }
  return prisma.strategy.update({
    where: { id },
    data,
    include: { author: { select: { id: true, username: true } } },
  });
}

export async function deleteStrategy(id: string, userId: string, role: Role) {
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!strategy) throw new AppError(404, 'Strategy not found', 'NOT_FOUND');
  if (!CAN_DELETE_ANY.includes(role) && strategy.authorId !== userId) {
    throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
  }
  await prisma.strategy.delete({ where: { id } });
}

export async function reviewStrategy(
  id: string,
  action: 'approve' | 'reject',
  reason?: string,
) {
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!strategy) throw new AppError(404, 'Strategy not found', 'NOT_FOUND');
  if (strategy.status !== 'PENDING') {
    throw new AppError(409, 'Strategy is not pending review', 'CONFLICT');
  }

  const data =
    action === 'approve'
      ? { status: 'APPROVED' as const, rejectionReason: null, rejectedAt: null }
      : { status: 'REJECTED' as const, rejectionReason: reason!, rejectedAt: new Date() };

  return prisma.strategy.update({
    where: { id },
    data,
    include: { author: { select: { id: true, username: true } } },
  });
}

export async function getPendingStrategies() {
  return prisma.strategy.findMany({
    where: { status: 'PENDING' },
    include: {
      author: { select: { id: true, username: true } },
      monster: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}
