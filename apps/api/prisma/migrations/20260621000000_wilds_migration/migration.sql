-- DropForeignKey
ALTER TABLE "GameAppearance" DROP CONSTRAINT "GameAppearance_monsterId_fkey";

-- DropIndex
DROP INDEX "Monster_firstGame_idx";

-- DropIndex
DROP INDEX "GameAppearance_game_idx";

-- DropIndex
DROP INDEX "GameAppearance_monsterId_game_key";

-- DropTable
DROP TABLE "GameAppearance";

-- AlterTable
ALTER TABLE "Monster" DROP COLUMN "firstGame",
DROP COLUMN "firstYear";

-- AlterTable
ALTER TABLE "Hitzone" ADD COLUMN "stun" INTEGER NOT NULL DEFAULT 0;

-- AlterEnum
ALTER TYPE "MonsterType" ADD VALUE 'FlyingWyvern';
ALTER TYPE "MonsterType" ADD VALUE 'BruteWyvern';
ALTER TYPE "MonsterType" ADD VALUE 'FangedBeast';
ALTER TYPE "MonsterType" ADD VALUE 'Temnoceran';
ALTER TYPE "MonsterType" ADD VALUE 'BirdWyvern';
ALTER TYPE "MonsterType" ADD VALUE 'Construct';
ALTER TYPE "MonsterType" ADD VALUE 'DemiElderDragon';
