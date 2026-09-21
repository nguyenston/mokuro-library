-- Add indexes for hot query paths
CREATE INDEX "UserProgress_userId_lastReadAt_idx" ON "UserProgress"("userId", "lastReadAt");
CREATE INDEX "UserProgress_volumeId_idx" ON "UserProgress"("volumeId");
CREATE INDEX "OcrBranch_headPatchId_idx" ON "OcrBranch"("headPatchId");
CREATE INDEX "Patch_volumeId_userId_createdAt_idx" ON "Patch"("volumeId", "userId", "createdAt");
