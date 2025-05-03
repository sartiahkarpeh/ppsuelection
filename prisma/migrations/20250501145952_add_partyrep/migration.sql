-- CreateTable
CREATE TABLE "PartyRep" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "PartyRep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartyRep_email_key" ON "PartyRep"("email");
