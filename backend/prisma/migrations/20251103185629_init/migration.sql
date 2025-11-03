-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "coverPath" TEXT,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Series_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Volume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "mokuroPath" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    CONSTRAINT "Volume_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "settings" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "page" INTEGER NOT NULL DEFAULT 1,
    "timeRead" INTEGER NOT NULL DEFAULT 0,
    "charsRead" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "volumeId" TEXT NOT NULL,
    CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserProgress_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Series_title_ownerId_key" ON "Series"("title", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Volume_filePath_key" ON "Volume"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "Volume_mokuroPath_key" ON "Volume"("mokuroPath");

-- CreateIndex
CREATE UNIQUE INDEX "Volume_seriesId_title_key" ON "Volume"("seriesId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_volumeId_key" ON "UserProgress"("userId", "volumeId");
