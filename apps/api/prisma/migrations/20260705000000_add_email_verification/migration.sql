-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifyEmailToken" TEXT,
ADD COLUMN     "verifyEmailTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_verifyEmailToken_key" ON "User"("verifyEmailToken");
