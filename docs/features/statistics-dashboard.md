# Statistics Dashboard Implementation

## Overview

Implemented a complete statistics system with real data tracking, visualization, and export capabilities.

## Backend API Endpoints

**File:** [backend/src/routes/stats.ts](backend/src/routes/stats.ts)

### 1. GET `/api/stats/summary`
Returns aggregated reading statistics:
```json
{
  "recentSpeed": 450,
  "charactersRead": 125000,
  "volumesCompleted": 5,
  "totalTime": 280,
  "pagesRead": 150,
  "totalPages": 200
}
```

### 2. GET `/api/stats/reading-history?timeRange=30`
Returns daily reading speed history:
```json
{
  "history": [
    { "date": "2026-01-01", "totalChars": 5000, "totalTime": 10, "speed": 500 },
    { "date": "2026-01-02", "totalChars": 6000, "totalTime": 12, "speed": 500 }
  ]
}
```

### 3. GET `/api/stats/by-series`
Returns statistics grouped by series:
```json
{
  "seriesStats": [
    {
      "seriesName": "One Piece",
      "volumes": 3,
      "avgSpeed": 475,
      "totalChars": 50000,
      "totalTime": 105
    }
  ]
}
```

### 4. GET `/api/stats/completed-volumes`
Returns recently completed volumes with stats:
```json
{
  "completedVolumes": [
    {
      "seriesName": "Naruto",
      "volumeTitle": "Volume 1",
      "speed": 450,
      "duration": 25,
      "characters": 11250,
      "dateFinished": "2026-01-02T10:00:00.000Z"
    }
  ]
}
```

### 5. GET `/api/stats/export`
Downloads all reading data as CSV:
```csv
Date,Series,Volume,Pages Read,Time (min),Chars Read,Speed (chars/min),Completed
2026-01-02,Naruto,Volume 1,42,25,11250,450,Yes
```

## Frontend Components

### LineChart Component
**File:** [frontend/src/lib/components/LineChart.svelte](frontend/src/lib/components/LineChart.svelte)

Lightweight canvas-based line chart (no external dependencies):
- Responsive scaling
- Interactive hover states
- Automatic axis labels
- Customizable colors and height

**Features:**
- Device pixel ratio support for crisp rendering
- Grid lines and Y-axis value labels
- X-axis date labels (smart interval)
- Smooth line with data points

**Usage:**
```svelte
<LineChart
  data={[{ date: '2026-01-01', value: 450 }]}
  label="Reading Speed"
  color="#6366f1"
  height={200}
/>
```

### Updated StatisticsModal
**File:** [frontend/src/lib/components/StatisticsModal.svelte](frontend/src/lib/components/StatisticsModal.svelte)

**Changes:**
1. Replaced mock data generation with real API calls
2. Integrated LineChart component for speed visualization
3. Added CSV export button in header
4. Time filter now refetches data dynamically
5. Shows real statistics from user progress

**Features:**
- Summary cards (speed, characters, volumes, time)
- Interactive line chart with time filters (week/month/3mo/6mo/year)
- Speed by series table
- Completed volumes table
- Export to CSV

## Database Schema Usage

The stats endpoints query the existing `UserProgress` table:
```sql
-- Aggregated stats
SELECT SUM(charsRead), SUM(timeRead), COUNT(*)
FROM UserProgress
WHERE userId = ? AND completed = true

-- Reading history (grouped by day)
SELECT DATE(lastReadAt) as date,
       SUM(charsRead) as totalChars,
       SUM(timeRead) as totalTime
FROM UserProgress
WHERE userId = ? AND lastReadAt > datetime('now', '-30 days')
GROUP BY DATE(lastReadAt)
```

## Server Registration

**File:** [backend/src/server.ts:25,116](backend/src/server.ts#L25)

```typescript
import statsRoutes from './routes/stats';
// ...
fastify.register(statsRoutes, { prefix: '/api/stats' });
```

## How It Works

### Data Flow

1. **User reads manga** → Progress tracked in `UserProgress` table
   - `page`: Current page number
   - `charsRead`: Characters read (from OCR data)
   - `timeRead`: Time spent (in minutes)
   - `completed`: Boolean flag
   - `lastReadAt`: Timestamp

2. **User opens Statistics Modal** → Frontend fetches:
   - Summary stats (total aggregates)
   - Reading history (daily breakdown)
   - Series stats (grouped data)
   - Completed volumes (recent finishes)

3. **Chart renders** → LineChart component:
   - Processes history data
   - Draws responsive canvas chart
   - Shows speed trend over time

4. **User exports data** → Browser downloads CSV:
   - All progress records
   - Formatted for spreadsheet import
   - Includes calculated speed metrics

### Reading Speed Calculation

```
Speed (chars/min) = charsRead / timeRead

Where:
- charsRead: Sum of characters in OCR text boxes on pages read
- timeRead: Total time spent on volume (tracked by reader)
```

### Time Filters

```typescript
const ranges = {
  week: 7,
  month: 30,
  '3months': 90,
  '6months': 180,
  year: 365
};
```

## Testing

### Manual Test Steps

1. **Read a volume** with OCR tracking enabled
2. **Complete the volume** (reach last page)
3. **Open Statistics Modal** (⚡ icon in app menu)
4. **Verify data shows:**
   - Reading speed (chars/min)
   - Total characters read
   - Volumes completed count
   - Total time spent
5. **Check chart** displays speed history
6. **Click time filters** (week/month/etc) → Chart updates
7. **Click Export CSV** → Download should start
8. **Open CSV** → Verify data accuracy

### Expected Behavior

- **No data**: Shows 0 stats, empty chart with "No data available"
- **Some data**: Shows real statistics, chart with line
- **Time filter change**: Fetches new data range, updates chart
- **Export**: Downloads CSV with all user progress records

## Performance Considerations

### Query Optimization
- Use indexes on `userId` and `lastReadAt` columns
- Aggregate queries run once per modal open
- Time filter changes trigger new API calls

### Frontend Optimization
- Canvas rendering (no DOM overhead for chart)
- Debounced time filter changes
- Data fetched only when modal opens

## Future Enhancements

### Potential Additions
1. **Goal Setting**: Set reading speed or time goals
2. **Achievements**: Unlock badges for milestones
3. **Comparison**: Compare speed across series
4. **Trends**: Calculate improvement over time
5. **Analytics**: Peak reading times, reading streaks
6. **Sharing**: Export stats as image for social media

### Advanced Metrics
- Words per minute (if word boundaries detected)
- Comprehension tracking (quiz integration)
- Focus time (active vs idle time)
- Difficulty analysis (speed vs text complexity)

## API Documentation

### Error Handling

All endpoints return standard error format:
```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Description of error"
}
```

### Authentication

All `/api/stats/*` endpoints require authentication via the `fastify.authenticate` hook.

### Response Format

Successful responses return JSON with appropriate data structure. CSV export returns `text/csv` content type with attachment header.
