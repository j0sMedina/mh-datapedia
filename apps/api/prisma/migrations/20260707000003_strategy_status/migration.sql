-- CreateEnum
CREATE TYPE "StrategyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Strategy" ADD COLUMN "status" "StrategyStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Strategy" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Strategy" ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- Backfill: all existing strategies are considered approved
UPDATE "Strategy" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';
