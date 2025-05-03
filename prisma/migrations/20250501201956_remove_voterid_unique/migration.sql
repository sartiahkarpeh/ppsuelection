/*
  Warnings:

  - A unique constraint covering the columns `[voterId,candidateId]` on the table `Vote` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Vote_voterId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Vote_voterId_candidateId_key" ON "Vote"("voterId", "candidateId");
