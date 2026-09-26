-- Existing sessions have no trustworthy start version; -1 makes them stale
-- so contributors must abort/restart rather than commit unchecked history.
ALTER TABLE "RebaseSession" ADD COLUMN "expectedVersion" INTEGER NOT NULL DEFAULT -1;
