import { z } from 'zod';

export const MHGameSchema = z.enum([
  'MONSTER_HUNTER_WORLD',
  'MONSTER_HUNTER_WORLD_ICEBORNE',
  'MONSTER_HUNTER_RISE',
  'MONSTER_HUNTER_RISE_SUNBREAK',
  'MONSTER_HUNTER_WILDS',
]);
export type MHGame = z.infer<typeof MHGameSchema>;

export const MonsterTypeSchema = z.enum([
  'Large',
  'Small',
  'ElderDragon',
  'Apex',
  'Afflicted',
  'Tempered',
]);
export type MonsterType = z.infer<typeof MonsterTypeSchema>;

export const ElementSchema = z.enum([
  'Fire', 'Water', 'Thunder', 'Ice', 'Dragon',
  'Poison', 'Sleep', 'Paralysis', 'Blast', 'Stun',
]);
export type Element = z.infer<typeof ElementSchema>;

export const WeaknessRatingSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
]);
export type WeaknessRating = z.infer<typeof WeaknessRatingSchema>;

export const DifficultySchema = z.enum(['Beginner', 'Intermediate', 'Advanced']);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const RankSchema = z.enum(['LowRank', 'HighRank', 'MasterRank']);
export type Rank = z.infer<typeof RankSchema>;

export const DropMethodSchema = z.enum([
  'BodyCarve',
  'TailCarve',
  'BreakReward',
  'CaptureReward',
  'QuestReward',
  'ShinyDrop',
  'WoundDrop',
  'PalicoBoomerang',
]);
export type DropMethod = z.infer<typeof DropMethodSchema>;

export const RoleSchema = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;
