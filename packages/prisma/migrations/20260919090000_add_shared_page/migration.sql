-- CreateTable
CREATE TABLE "SharedPage" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedPage_ownerId_idx" ON "SharedPage"("ownerId");
