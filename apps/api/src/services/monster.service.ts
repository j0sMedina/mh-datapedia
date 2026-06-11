import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import type { MonsterFilters, CreateMonster, UpdateMonster } from '@mh-datapedia/shared';
import { MHGame, Rank } from '@prisma/client';

const MONSTER_DETAIL_INCLUDE = {
  gameAppearances: true,
  weaknesses: true,
  hitzones: true,
  strategies: {
    include: { author: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  ailments: true,
  drops: { orderBy: [{ game: 'asc' as const }, { rank: 'asc' as const }, { method: 'asc' as const }] },
  subspecies: {
    select: { id: true, name: true, type: true, iconUrl: true, imageUrl: true, title: true },
  },
  parent: { select: { id: true, name: true } },
};

export async function listMonsters(filters: MonsterFilters) {
  const { game, type, search, page, limit } = filters;
  const where = {
    ...(type && { type }),
    ...(game && { gameAppearances: { some: { game } } }),
    ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
  };
  const [data, total] = await Promise.all([
    prisma.monster.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { gameAppearances: true, weaknesses: true },
      orderBy: { name: 'asc' },
    }),
    prisma.monster.count({ where }),
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getMonsterById(id: string) {
  const monster = await prisma.monster.findUnique({
    where: { id },
    include: MONSTER_DETAIL_INCLUDE,
  });
  if (!monster) throw new AppError(404, 'Monster not found', 'NOT_FOUND');
  return monster;
}

export async function getHitzones(monsterId: string) {
  await assertExists(monsterId);
  return prisma.hitzone.findMany({ where: { monsterId }, orderBy: { part: 'asc' } });
}

export async function getWeaknesses(monsterId: string) {
  await assertExists(monsterId);
  return prisma.elementWeakness.findMany({ where: { monsterId } });
}

export async function getSubspecies(monsterId: string) {
  await assertExists(monsterId);
  return prisma.monster.findMany({
    where: { parentId: monsterId },
    select: { id: true, name: true, type: true, iconUrl: true, imageUrl: true, title: true },
  });
}

export async function getDrops(monsterId: string, game?: string, rank?: string) {
  await assertExists(monsterId);
  return prisma.monsterDrop.findMany({
    where: {
      monsterId,
      ...(game && { game: game as MHGame }),
      ...(rank && { rank: rank as Rank }),
    },
    orderBy: [{ game: 'asc' }, { rank: 'asc' }, { method: 'asc' }],
  });
}

export async function getStrategies(monsterId: string) {
  await assertExists(monsterId);
  return prisma.strategy.findMany({
    where: { monsterId },
    include: { author: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createMonster(data: CreateMonster) {
  return prisma.monster.create({ data, include: MONSTER_DETAIL_INCLUDE });
}

export async function updateMonster(id: string, data: UpdateMonster) {
  await assertExists(id);
  return prisma.monster.update({ where: { id }, data, include: MONSTER_DETAIL_INCLUDE });
}

export async function deleteMonster(id: string) {
  await assertExists(id);
  await prisma.monster.delete({ where: { id } });
}

async function assertExists(id: string) {
  const exists = await prisma.monster.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, 'Monster not found', 'NOT_FOUND');
}
