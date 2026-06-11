-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MonsterType" AS ENUM ('Large', 'Small', 'ElderDragon', 'Apex', 'Afflicted', 'Tempered');

-- CreateEnum
CREATE TYPE "MHGame" AS ENUM ('MONSTER_HUNTER_WORLD', 'MONSTER_HUNTER_WORLD_ICEBORNE', 'MONSTER_HUNTER_RISE', 'MONSTER_HUNTER_RISE_SUNBREAK', 'MONSTER_HUNTER_WILDS');

-- CreateEnum
CREATE TYPE "Element" AS ENUM ('Fire', 'Water', 'Thunder', 'Ice', 'Dragon', 'Poison', 'Sleep', 'Paralysis', 'Blast', 'Stun');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('Beginner', 'Intermediate', 'Advanced');

-- CreateEnum
CREATE TYPE "Rank" AS ENUM ('LowRank', 'HighRank', 'MasterRank');

-- CreateEnum
CREATE TYPE "DropMethod" AS ENUM ('BodyCarve', 'TailCarve', 'BreakReward', 'CaptureReward', 'QuestReward', 'ShinyDrop', 'WoundDrop', 'PalicoBoomerang');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "MonsterType" NOT NULL,
    "firstGame" "MHGame" NOT NULL,
    "firstYear" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "iconUrl" TEXT,
    "isBoss" BOOLEAN NOT NULL DEFAULT false,
    "habitats" TEXT[],
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Monster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAppearance" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "game" "MHGame" NOT NULL,
    "isNew" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GameAppearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementWeakness" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "element" "Element" NOT NULL,
    "rating" INTEGER NOT NULL,
    "isImmune" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ElementWeakness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hitzone" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "cut" INTEGER NOT NULL DEFAULT 50,
    "blunt" INTEGER NOT NULL DEFAULT 50,
    "bullet" INTEGER NOT NULL DEFAULT 50,
    "fire" INTEGER NOT NULL DEFAULT 50,
    "water" INTEGER NOT NULL DEFAULT 50,
    "thunder" INTEGER NOT NULL DEFAULT 50,
    "ice" INTEGER NOT NULL DEFAULT 50,
    "dragon" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "Hitzone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "game" "MHGame" NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonsterAilment" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "ailment" TEXT NOT NULL,

    CONSTRAINT "MonsterAilment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonsterDrop" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "game" "MHGame" NOT NULL,
    "rank" "Rank" NOT NULL,
    "method" "DropMethod" NOT NULL,
    "part" TEXT,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "rate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MonsterDrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserFavorites" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Monster_name_key" ON "Monster"("name");

-- CreateIndex
CREATE INDEX "Monster_name_idx" ON "Monster"("name");

-- CreateIndex
CREATE INDEX "Monster_type_idx" ON "Monster"("type");

-- CreateIndex
CREATE INDEX "Monster_firstGame_idx" ON "Monster"("firstGame");

-- CreateIndex
CREATE INDEX "GameAppearance_game_idx" ON "GameAppearance"("game");

-- CreateIndex
CREATE UNIQUE INDEX "GameAppearance_monsterId_game_key" ON "GameAppearance"("monsterId", "game");

-- CreateIndex
CREATE UNIQUE INDEX "ElementWeakness_monsterId_element_key" ON "ElementWeakness"("monsterId", "element");

-- CreateIndex
CREATE UNIQUE INDEX "Hitzone_monsterId_part_key" ON "Hitzone"("monsterId", "part");

-- CreateIndex
CREATE INDEX "MonsterDrop_monsterId_game_rank_idx" ON "MonsterDrop"("monsterId", "game", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "_UserFavorites_AB_unique" ON "_UserFavorites"("A", "B");

-- CreateIndex
CREATE INDEX "_UserFavorites_B_index" ON "_UserFavorites"("B");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monster" ADD CONSTRAINT "Monster_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Monster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAppearance" ADD CONSTRAINT "GameAppearance_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementWeakness" ADD CONSTRAINT "ElementWeakness_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hitzone" ADD CONSTRAINT "Hitzone_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonsterAilment" ADD CONSTRAINT "MonsterAilment_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonsterDrop" ADD CONSTRAINT "MonsterDrop_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserFavorites" ADD CONSTRAINT "_UserFavorites_A_fkey" FOREIGN KEY ("A") REFERENCES "Monster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserFavorites" ADD CONSTRAINT "_UserFavorites_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
