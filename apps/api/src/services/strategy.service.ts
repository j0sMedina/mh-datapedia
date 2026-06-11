import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import type { CreateStrategy, UpdateStrategy } from '@mh-datapedia/shared';

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
  role: 'USER' | 'ADMIN',
  data: UpdateStrategy,
) {
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!strategy) throw new AppError(404, 'Strategy not found', 'NOT_FOUND');
  if (role !== 'ADMIN' && strategy.authorId !== userId) {
    throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
  }
  return prisma.strategy.update({
    where: { id },
    data,
    include: { author: { select: { id: true, username: true } } },
  });
}

export async function deleteStrategy(id: string, userId: string, role: 'USER' | 'ADMIN') {
  const strategy = await prisma.strategy.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!strategy) throw new AppError(404, 'Strategy not found', 'NOT_FOUND');
  if (role !== 'ADMIN' && strategy.authorId !== userId) {
    throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
  }
  await prisma.strategy.delete({ where: { id } });
}
