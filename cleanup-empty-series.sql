-- Cleanup script to remove series with 0 volumes
-- Run this with: docker exec mokuro-library-backend-dev sh -c "cd /app/backend && npx prisma db execute --file=/path/to/cleanup-empty-series.sql"

-- First, let's see what we're deleting
SELECT
    s.id,
    s.title,
    s.folderName,
    s.ownerId,
    s.createdAt,
    COUNT(v.id) as volumeCount
FROM Series s
LEFT JOIN Volume v ON s.id = v.seriesId
GROUP BY s.id
HAVING COUNT(v.id) = 0;

-- Delete UserSeriesSettings for empty series
DELETE FROM UserSeriesSettings
WHERE seriesId IN (
    SELECT s.id
    FROM Series s
    LEFT JOIN Volume v ON s.id = v.seriesId
    GROUP BY s.id
    HAVING COUNT(v.id) = 0
);

-- Delete empty series
DELETE FROM Series
WHERE id IN (
    SELECT s.id
    FROM Series s
    LEFT JOIN Volume v ON s.id = v.seriesId
    GROUP BY s.id
    HAVING COUNT(v.id) = 0
);
