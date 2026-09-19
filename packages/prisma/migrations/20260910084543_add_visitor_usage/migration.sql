-- CreateTable
CREATE TABLE "VisitorUsage" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "dailyCredits" INTEGER,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "lastResetDate" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitorUsage_ip_key" ON "VisitorUsage"("ip");
