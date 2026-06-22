-- Add new species types to MonsterType enum
ALTER TYPE "MonsterType" ADD VALUE IF NOT EXISTS 'Leviathan';
ALTER TYPE "MonsterType" ADD VALUE IF NOT EXISTS 'Amphibian';
ALTER TYPE "MonsterType" ADD VALUE IF NOT EXISTS 'Cephalopod';
ALTER TYPE "MonsterType" ADD VALUE IF NOT EXISTS 'Machine';
