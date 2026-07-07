-- CreateEnum
CREATE TYPE "MonsterTag" AS ENUM ('Tempered', 'ArchTempered', 'Apex', 'Afflicted');

-- AddColumn tags
ALTER TABLE "Monster" ADD COLUMN "tags" "MonsterTag"[] NOT NULL DEFAULT '{}';

-- Backfill tags from current type values
UPDATE "Monster" SET "tags" = ARRAY['Apex']::"MonsterTag"[] WHERE type = 'Apex'::"MonsterType";
UPDATE "Monster" SET "tags" = ARRAY['Afflicted']::"MonsterTag"[] WHERE type = 'Afflicted'::"MonsterType";
UPDATE "Monster" SET "tags" = ARRAY['Tempered']::"MonsterTag"[] WHERE type = 'Tempered'::"MonsterType";

-- Reassign biological types for rows using non-biological type values
-- Large monsters: default to ElderDragon (admin must re-classify manually if any exist)
UPDATE "Monster" SET type = 'ElderDragon'::"MonsterType" WHERE type = 'Large'::"MonsterType";
UPDATE "Monster" SET type = 'ElderDragon'::"MonsterType" WHERE type = 'Apex'::"MonsterType";
UPDATE "Monster" SET type = 'FlyingWyvern'::"MonsterType" WHERE type = 'Afflicted'::"MonsterType";
UPDATE "Monster" SET type = 'FlyingWyvern'::"MonsterType" WHERE type = 'Tempered'::"MonsterType";

-- Create new MonsterType enum without removed values
CREATE TYPE "MonsterType_new" AS ENUM (
  'Small', 'ElderDragon', 'FlyingWyvern', 'BruteWyvern', 'FangedBeast',
  'Temnoceran', 'BirdWyvern', 'Construct', 'DemiElderDragon', 'Leviathan',
  'Amphibian', 'Cephalopod', 'Machine'
);

-- Migrate column to new enum
ALTER TABLE "Monster" ALTER COLUMN type TYPE "MonsterType_new" USING type::text::"MonsterType_new";

-- Swap enum names
DROP TYPE "MonsterType";
ALTER TYPE "MonsterType_new" RENAME TO "MonsterType";
