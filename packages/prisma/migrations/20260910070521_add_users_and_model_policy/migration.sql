-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "dailyCredits" INTEGER,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "lastResetDate" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPolicy" (
    "mode" TEXT NOT NULL,
    "freeAllowed" BOOLEAN NOT NULL DEFAULT true,
    "proAllowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ModelPolicy_pkey" PRIMARY KEY ("mode")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
