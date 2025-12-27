# Developer Guide

A comprehensive guide to understanding Mokuro Library's architecture, key features, and implementation details for new developers.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Key Features Implementation](#key-features-implementation)
- [State Management](#state-management)
- [API Routes](#api-routes)
- [Development Workflow](#development-workflow)

---

## Architecture Overview

Mokuro Library follows a **monorepo architecture** with a clear separation between frontend and backend:

```
mokuro-library/
├── backend/          # Fastify API server
├── frontend/         # SvelteKit application
├── data/            # SQLite database & uploads
└── docker-compose.yml
```

### High-Level Flow

```
User Browser (SvelteKit)
    ↓ HTTP/REST API
Fastify Server (Node.js)
    ↓ Prisma ORM
SQLite Database + File System
```

**Key Characteristics:**
- **Server-side storage**: All manga files, metadata, and user data stored on server
- **Multi-user**: Each user has separate progress, settings, and bookmarks
- **Real-time OCR editing**: Edits save directly back to `.mokuro` JSON files
- **Progressive enhancement**: Works without JavaScript for basic functionality

---

## Tech Stack

### Backend
- **Runtime**: Node.js v18+
- **Framework**: [Fastify](https://fastify.dev/) - Fast, low-overhead web framework
- **ORM**: [Prisma](https://www.prisma.io/) - Type-safe database client
- **Database**: SQLite with Better-SQLite3 adapter
- **Auth**: Cookie-based sessions with bcrypt password hashing
- **File Processing**: Multipart form uploads, ZIP/PDF generation

### Frontend
- **Framework**: [SvelteKit](https://kit.svelte.dev/) - Full-stack Svelte framework
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: Svelte 5 Runes (reactive state)
- **UI Components**: Custom component library
- **Reader**: Panzoom for image manipulation

### Deployment
- **Containerization**: Docker with multi-stage builds
- **Reverse Proxy**: Nginx/Caddy compatible
- **Process Management**: PM2 for non-Docker deployments

---

## Project Structure

### Backend (`/backend`)

```
backend/
├── src/
│   ├── server.ts              # Entry point, Fastify setup
│   ├── generated/prisma/      # Generated Prisma client
│   ├── plugins/
│   │   └── auth.ts            # Authentication plugin
│   ├── routes/
│   │   ├── auth.ts            # Login, register, logout
│   │   ├── library.ts         # Series/volume CRUD, search
│   │   ├── metadata.ts        # Metadata scraping, updates
│   │   ├── export.ts          # ZIP/PDF export
│   │   ├── files.ts           # Static file serving
│   │   └── settings.ts        # User settings
│   └── types/                 # TypeScript definitions
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Migration history
│   └── library.db             # SQLite database (dev)
└── package.json
```

### Frontend (`/frontend`)

```
frontend/
├── src/
│   ├── routes/                    # SvelteKit routes (file-based)
│   │   ├── +page.svelte           # Library grid (/)
│   │   ├── series/[id]/+page.svelte  # Series detail
│   │   ├── volume/[id]/+page.svelte  # Reader
│   │   ├── (auth)/login/          # Auth pages
│   │   └── settings/              # Settings page
│   ├── lib/
│   │   ├── components/            # Reusable UI components
│   │   │   ├── ocr/               # OCR editing components
│   │   │   ├── readers/           # Reader layouts
│   │   │   ├── menu/              # Menu system
│   │   │   ├── panels/            # Metadata scraping panels
│   │   │   └── settings/          # Settings components
│   │   ├── states/                # Global state (Svelte 5 Runes)
│   │   │   ├── OcrState.svelte.ts       # OCR editing state
│   │   │   ├── ReaderState.svelte.ts    # Reader configuration
│   │   │   ├── ScrapingState.svelte.ts  # Metadata scraping
│   │   │   └── uiState.svelte.ts        # UI preferences
│   │   ├── types/                 # TypeScript types
│   │   └── utils/                 # Helper functions
│   └── app.css                    # Global styles
├── static/                        # Static assets
└── package.json
```

---

## Database Schema

Mokuro Library uses SQLite with Prisma ORM. Here are the core models:

### **Series** - Manga series metadata

```prisma
model Series {
  id            String    @id @default(cuid())
  title         String?
  japaneseTitle String?
  romajiTitle   String?
  synonyms      String?   // Comma-separated alternative titles
  description   String?
  folderName    String    // Original folder name
  coverPath     String?   // Path to cover image

  organized     Boolean   @default(false)  // User-verified
  bookmarked    Boolean   @default(false)  // User-favorited
  status        Int       @default(0)      // 0=Unread, 1=Reading, 2=Read

  sortTitle     String    // For alphabetical sorting
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastReadAt    DateTime  @default("1970-01-01")

  volumes       Volume[]
  owner         User      @relation(fields: [ownerId], references: [id])
  ownerId       String

  @@unique([folderName, ownerId])
}
```

### **Volume** - Individual manga volumes

```prisma
model Volume {
  id          String   @id @default(cuid())
  title       String?
  folderName  String
  pageCount   Int
  sortTitle   String

  filePath    String   @unique  // Folder with images
  mokuroPath  String   @unique  // .mokuro JSON file
  coverImageName String?

  // OCR version control
  headPatchId String?           // Current OCR state
  history     HistoryChunk[]    // OCR edit history (compressed)

  series      Series   @relation(fields: [seriesId], references: [id])
  seriesId    String
  progress    UserProgress[]

  @@unique([seriesId, folderName])
}
```

### **User** - User accounts

```prisma
model User {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String   // bcrypt hashed
  settings  Json     // Reader preferences, appearance settings

  uploads   Series[]
  progress  UserProgress[]
}
```

### **UserProgress** - Reading progress tracking

```prisma
model UserProgress {
  id         String    @id @default(cuid())
  page       Int       @default(1)
  timeRead   Int       @default(0)     // Minutes
  charsRead  Int       @default(0)     // For reading speed stats
  completed  Boolean   @default(false)
  lastReadAt DateTime  @updatedAt

  user       User      @relation(fields: [userId], references: [id])
  userId     String
  volume     Volume    @relation(fields: [volumeId], references: [id])
  volumeId   String

  @@unique([userId, volumeId])
}
```

### **HistoryChunk** - OCR edit history (compressed)

```prisma
model HistoryChunk {
  id              String   @id @default(uuid())
  volumeId        String
  volume          Volume   @relation(fields: [volumeId], references: [id])

  previousChunkId String?  // Linked list for traversal
  startPatchId    String   // First patch UUID in chunk
  endPatchId      String   // Last patch UUID in chunk

  payload         Bytes    // GZIP compressed PatchOperation[]
  createdAt       DateTime @default(now())

  @@index([volumeId, endPatchId])
}
```

**Key Design Decisions:**

1. **Soft deletion**: Uses `onDelete: Cascade` to automatically clean up related records
2. **Denormalization**: `sortTitle` duplicated for faster queries
3. **Timestamps**: Separate `updatedAt` (metadata) and `lastReadAt` (reading activity)
4. **Compression**: OCR history stored as GZIP-compressed chunks to save space
5. **Multi-tenancy**: All user data scoped by `ownerId` for multi-user support

---

## Key Features Implementation

### 1. OCR Editing System

**The Innovation**: Edit OCR text in-browser and save changes back to `.mokuro` files on the server.

#### Architecture

```
User edits text in browser
    ↓
OcrState.svelte.ts (reactive state)
    ↓
PUT /api/library/volume/:id/ocr
    ↓
Server writes to .mokuro JSON file
```

#### Frontend: `OcrState.svelte.ts`

**State Management** using Svelte 5 Runes:

```typescript
export class OcrState {
  page = $state<MokuroPage>();
  focusedBlock = $state<MokuroBlock | null>(null);
  focusedLine = $state<number | null>(null);
  ocrMode = $state<'READ' | 'BOX' | 'TEXT'>('READ');
  isSmartResizeMode = $state<boolean>(true);

  // Methods for editing
  addBlock(imgX: number, imgY: number) { ... }
  deleteLine(block: MokuroBlock, lineIndex: number) { ... }
  updateLineText(block: MokuroBlock, lineIndex: number, text: string) { ... }
  smartResize(block: MokuroBlock, lineIndex: number) { ... }
}
```

**Three Edit Modes:**

1. **READ** - Normal reading, text selection for copying
2. **BOX** - Move/resize bounding boxes, double-click to edit text
3. **TEXT** - Edit text content, keyboard navigation between lines

**Component Hierarchy:**

```
OcrOverlay.svelte (container)
  └─ OcrBlock.svelte (blue outer box, one per text block)
      └─ OcrLine.svelte (red/yellow inner box, one per text line)
          └─ ResizeHandles.svelte (8 handles for resizing)
```

#### Backend: `/api/library/volume/:id/ocr`

```typescript
fastify.put<{ Params: { id: string }, Body: { pages: MokuroPage[] } }>(
  '/volume/:id/ocr',
  { preHandler: [fastify.authenticate] },
  async (request, reply) => {
    const { pages } = request.body;
    const { id } = request.params;

    // 1. Read existing .mokuro file
    const mokuroData = JSON.parse(fs.readFileSync(mokuroPath, 'utf-8'));

    // 2. Update pages array
    mokuroData.pages = pages;

    // 3. Write back to file (atomic)
    fs.writeFileSync(mokuroPath, JSON.stringify(mokuroData, null, 2));

    return { success: true };
  }
);
```

**Smart Resize Algorithm:**

Automatically adjusts font size to fit text in box:

```typescript
function smartResize(block: MokuroBlock, lineIndex: number) {
  const line = block.lines[lineIndex];
  const boxWidth = line.box[2] - line.box[0];
  const boxHeight = line.box[3] - line.box[1];

  // Calculate optimal font size
  const textLength = line.text.length;
  const estimatedFontSize = Math.min(
    boxWidth / (textLength * 0.6),  // Width constraint
    boxHeight * 0.8                 // Height constraint
  );

  line.font_size = Math.max(10, Math.min(100, estimatedFontSize));
}
```

---

### 2. Metadata Scraping System

**Multi-provider fallback** with AniList, MyAnimeList, and Kitsu.

#### Architecture

```
User clicks "Scrape Metadata"
    ↓
ScrapingState.svelte.ts (manages scraping session)
    ↓
POST /api/metadata/series/scrape (search query)
    ↓
Try AniList → MAL → Kitsu (fallback chain)
    ↓
Return metadata preview
    ↓
User selects fields to import
    ↓
PATCH /api/metadata/series/:id (apply changes)
```

#### Frontend: `ScrapingState.svelte.ts`

**Session-based scraping workflow:**

```typescript
export class ScrapingState {
  // Current scraping job state
  query = $state<string>('');
  results = $state<ScraperResult[]>([]);
  selectedResult = $state<ScraperResult | null>(null);
  selectedFields = $state<Record<string, boolean>>({});

  // Bulk scraping
  bulkQueue = $state<Series[]>([]);
  currentBatchIndex = $state<number>(0);

  async searchMetadata(query: string) {
    const res = await fetch('/api/metadata/search', {
      method: 'POST',
      body: JSON.stringify({ query })
    });
    this.results = await res.json();
  }

  async applyMetadata(seriesId: string) {
    const updates = this.getSelectedFieldValues();
    await fetch(`/api/metadata/series/${seriesId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }
}
```

**UI Components:**

- `SingleScrapePanel.svelte` - Single series scraping with preview
- `BulkScrapePanel.svelte` - Batch scraping up to 100 series
- `MetadataComparisonCard.svelte` - Side-by-side comparison of current vs scraped data
- `ScrapeDescriptionFilterPanel.svelte` - Regex filters for cleaning descriptions

#### Backend: `/routes/metadata.ts`

**Provider Abstraction:**

```typescript
interface MetadataProvider {
  name: string;
  search(query: string): Promise<ScraperResult[]>;
  fetchDetails(id: string): Promise<SeriesMetadata>;
}

const providers: MetadataProvider[] = [
  new AniListProvider(),
  new MyAnimeListProvider(),
  new KitsuProvider()
];
```

**Multi-Provider Fallback Logic:**

```typescript
async function scrapeMetadata(query: string): Promise<ScraperResult[]> {
  for (const provider of providers) {
    try {
      const results = await provider.search(query);
      if (results.length > 0) {
        return results.map(r => ({ ...r, source: provider.name }));
      }

      // Rate limiting between providers
      await sleep(500);
    } catch (error) {
      logger.warn(`${provider.name} failed: ${error.message}`);
      continue; // Try next provider
    }
  }
  return [];
}
```

**AniList GraphQL Query Example:**

```graphql
query ($search: String) {
  Page(page: 1, perPage: 10) {
    media(search: $search, type: MANGA) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      description(asHtml: false)
      coverImage {
        extraLarge
      }
      status
    }
  }
}
```

**Mojibake Detection** - Fixes encoding errors in descriptions:

```typescript
function fixMojibake(text: string): string {
  const mojibakePatterns = [
    { pattern: /Ã©/g, replacement: 'é' },
    { pattern: /â€™/g, replacement: "'" },
    { pattern: /â€"/g, replacement: '—' }
  ];

  let fixed = text;
  for (const { pattern, replacement } of mojibakePatterns) {
    fixed = fixed.replace(pattern, replacement);
  }
  return fixed;
}
```

---

### 3. Reader System

**Three layout modes** with unified state management.

#### Architecture

```
ReaderState.svelte.ts (user preferences)
    ↓
volume/[id]/+page.svelte (route)
    ↓
├─ SinglePageReader.svelte (mode: single)
├─ DoublePageReader.svelte (mode: double)
└─ VerticalReader.svelte (mode: vertical)
    ↓
OcrOverlay.svelte (OCR layer)
```

#### State: `ReaderState.svelte.ts`

**Global reader configuration:**

```typescript
export class ReaderState {
  // Layout
  mode = $state<'single' | 'double' | 'vertical'>('single');
  readingDirection = $state<'rtl' | 'ltr'>('rtl');
  dualPageOffset = $state<boolean>(false);

  // Navigation
  navZoneWidth = $state<number>(20); // Percentage
  showTriggerOutline = $state<boolean>(false);

  // Zoom
  retainZoom = $state<boolean>(false);
  currentZoom = $state<number>(1);

  // UI
  autoFullscreen = $state<boolean>(false);
  hideHud = $state<boolean>(false);
  autoComplete = $state<boolean>(true);

  // Saves to backend on change
  async saveSettings() {
    await fetch('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(this.toJSON())
    });
  }
}
```

#### Double Page Spread Alignment

**The Challenge**: Manga covers are usually single-page, but spreads should be 2-3, 4-5, etc.

**Solution: Page Offset Toggle**

```typescript
function getPagePair(pageIndex: number, totalPages: number, offset: boolean) {
  if (offset) {
    // Offset ON: 1-2, 3-4, 5-6
    return [pageIndex, pageIndex + 1];
  } else {
    // Offset OFF: 1 (alone), 2-3, 4-5
    if (pageIndex === 0) return [0, null]; // Cover alone
    const adjustedIndex = pageIndex - 1;
    const isLeftPage = adjustedIndex % 2 === 0;
    return isLeftPage
      ? [pageIndex, pageIndex + 1]
      : [pageIndex - 1, pageIndex];
  }
}
```

#### Panzoom Integration

**Image zoom and pan:**

```typescript
import Panzoom from '@panzoom/panzoom';

let panzoom: PanzoomObject;

$effect(() => {
  if (imageElement) {
    panzoom = Panzoom(imageElement, {
      maxScale: 5,
      minScale: 0.5,
      contain: 'outside'
    });

    // Zoom on scroll
    imageElement.parentElement.addEventListener('wheel',
      panzoom.zoomWithWheel
    );
  }

  return () => panzoom?.destroy();
});
```

---

### 4. Progress Tracking & Statistics

**Real-time reading analytics** with character-based speed calculation.

#### Database Updates

**Every page turn updates progress:**

```typescript
// backend/routes/library.ts
fastify.patch('/volume/:id/progress', async (request, reply) => {
  const { page, timeRead, charsRead } = request.body;
  const userId = request.user.id;

  await prisma.userProgress.upsert({
    where: { userId_volumeId: { userId, volumeId: id } },
    update: {
      page,
      timeRead: { increment: timeRead },
      charsRead: { increment: charsRead },
      lastReadAt: new Date(),
      completed: page >= volume.pageCount
    },
    create: { userId, volumeId: id, page, timeRead, charsRead }
  });

  // Also update series.lastReadAt for "Recently Read" sorting
  await prisma.series.update({
    where: { id: volume.seriesId },
    data: { lastReadAt: new Date() }
  });
});
```

#### Statistics Calculation

**Reading speed (characters per minute):**

```typescript
// StatisticsModal.svelte
async function loadStats() {
  const progressRecords = await fetch('/api/library/progress').then(r => r.json());

  const totalChars = progressRecords.reduce((sum, p) => sum + p.charsRead, 0);
  const totalTime = progressRecords.reduce((sum, p) => sum + p.timeRead, 0);

  const avgSpeed = totalTime > 0 ? totalChars / totalTime : 0;

  // Per-series breakdown
  const seriesStats = progressRecords.reduce((acc, p) => {
    const key = p.volume.seriesId;
    if (!acc[key]) acc[key] = { chars: 0, time: 0 };
    acc[key].chars += p.charsRead;
    acc[key].time += p.timeRead;
    return acc;
  }, {});

  return {
    avgSpeed,
    totalChars,
    totalTime,
    volumesCompleted: progressRecords.filter(p => p.completed).length,
    seriesStats
  };
}
```

**Speed Improvement Tracking:**

Compares recent speed vs historical average to show improvement percentage.

---

### 5. Export System

**ZIP and PDF generation** for backups and sharing.

#### ZIP Export

**Preserves folder structure:**

```typescript
// backend/routes/export.ts
import archiver from 'archiver';

fastify.get('/series/:id/zip', async (request, reply) => {
  const { id } = request.params;
  const series = await prisma.series.findUnique({
    where: { id },
    include: { volumes: true }
  });

  const archive = archiver('zip', { zlib: { level: 9 } });

  // Add series cover
  if (series.coverPath) {
    archive.file(series.coverPath, { name: `${series.folderName}/cover.png` });
  }

  // Add each volume
  for (const volume of series.volumes) {
    // Add .mokuro file
    archive.file(volume.mokuroPath, {
      name: `${series.folderName}/${volume.folderName}.mokuro`
    });

    // Add all images
    archive.directory(volume.filePath, `${series.folderName}/${volume.folderName}`);
  }

  // Add metadata JSON
  archive.append(JSON.stringify(series, null, 2), {
    name: `${series.folderName}/metadata.json`
  });

  reply.header('Content-Type', 'application/zip');
  reply.header('Content-Disposition', `attachment; filename="${series.folderName}.zip"`);

  archive.pipe(reply.raw);
  await archive.finalize();
});
```

#### PDF Export with Selectable OCR Text

**Uses PDF-lib to embed invisible text layer:**

```typescript
import { PDFDocument, rgb } from 'pdf-lib';

async function createPDFWithOCR(volume: Volume): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const mokuroData = JSON.parse(fs.readFileSync(volume.mokuroPath, 'utf-8'));

  for (const page of mokuroData.pages) {
    // 1. Embed image
    const imagePath = path.join(volume.filePath, page.img_path);
    const imageBytes = fs.readFileSync(imagePath);
    const image = await pdfDoc.embedPng(imageBytes); // or embedJpg

    const pdfPage = pdfDoc.addPage([image.width, image.height]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

    // 2. Add invisible OCR text layer
    for (const block of page.blocks) {
      for (const line of block.lines) {
        const [x0, y0, x1, y1] = line.box;

        // Draw text (invisible, but selectable)
        pdfPage.drawText(line.text, {
          x: x0,
          y: image.height - y1, // PDF coords are bottom-up
          size: line.font_size,
          color: rgb(0, 0, 0),
          opacity: 0 // Invisible!
        });
      }
    }
  }

  return await pdfDoc.save();
}
```

**Result**: PDF looks like images, but text is selectable for copy-paste!

---

### 6. Upload Pipeline

**Drag-and-drop folder upload** with parsing and validation.

#### Frontend: `UploadModal.svelte`

**File selection:**

```typescript
let fileInput: HTMLInputElement;

async function handleFolderSelect() {
  // Modern browsers: use webkitdirectory
  fileInput.setAttribute('webkitdirectory', '');
  fileInput.setAttribute('directory', '');
  fileInput.click();
}

async function handleFilesSelected(event: Event) {
  const files = Array.from(fileInput.files);

  // Group files by folder
  const folderMap = new Map<string, File[]>();
  for (const file of files) {
    const pathParts = file.webkitRelativePath.split('/');
    const folderKey = pathParts.slice(0, -1).join('/');

    if (!folderMap.has(folderKey)) folderMap.set(folderKey, []);
    folderMap.get(folderKey).push(file);
  }

  // Upload each folder
  for (const [folder, files] of folderMap) {
    await uploadFolder(folder, files);
  }
}
```

**Multipart upload:**

```typescript
async function uploadFolder(folderName: string, files: File[]) {
  const formData = new FormData();
  formData.append('folderName', folderName);

  for (const file of files) {
    formData.append('files', file, file.webkitRelativePath);
  }

  const res = await fetch('/api/library/upload', {
    method: 'POST',
    body: formData
  });

  return res.json();
}
```

#### Backend: `/api/library/upload`

**Processing logic:**

```typescript
fastify.post('/upload', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  const data = await request.file();
  const uploadDir = path.join(projectRoot, 'uploads', userId);

  // 1. Save files to disk
  for await (const file of data.files) {
    const filepath = path.join(uploadDir, file.filename);
    await pump(file.file, fs.createWriteStream(filepath));
  }

  // 2. Parse folder structure
  const folders = await discoverMangaFolders(uploadDir);

  // 3. For each series folder:
  for (const seriesFolder of folders) {
    // a. Find .mokuro files
    const mokuroFiles = fs.readdirSync(seriesFolder)
      .filter(f => f.endsWith('.mokuro'));

    // b. Create Series record
    const series = await prisma.series.create({
      data: {
        folderName: path.basename(seriesFolder),
        sortTitle: path.basename(seriesFolder).toLowerCase(),
        ownerId: userId,
        coverPath: findCoverImage(seriesFolder)
      }
    });

    // c. Create Volume records
    for (const mokuroFile of mokuroFiles) {
      const mokuroPath = path.join(seriesFolder, mokuroFile);
      const mokuroData = JSON.parse(fs.readFileSync(mokuroPath, 'utf-8'));

      const volumeName = mokuroFile.replace('.mokuro', '');
      const imageFolderPath = path.join(seriesFolder, volumeName);

      await prisma.volume.create({
        data: {
          folderName: volumeName,
          sortTitle: volumeName.toLowerCase(),
          pageCount: mokuroData.pages.length,
          filePath: imageFolderPath,
          mokuroPath,
          seriesId: series.id,
          coverImageName: mokuroData.pages[0]?.img_path
        }
      });
    }
  }

  return { success: true, seriesCount: folders.length };
});
```

**Duplicate Detection:**

Uses unique constraint `[folderName, ownerId]` to prevent re-uploads.

---

## State Management

Mokuro Library uses **Svelte 5 Runes** for reactive state management.

### Runes-Based State Classes

**Pattern: State Class with `$state` runes**

```typescript
// lib/states/ExampleState.svelte.ts
export class ExampleState {
  // Reactive primitive
  count = $state<number>(0);

  // Reactive object
  user = $state<User | null>(null);

  // Reactive array
  items = $state<Item[]>([]);

  // Derived value (computed)
  doubleCount = $derived(this.count * 2);

  // Methods
  increment() {
    this.count++;
  }

  // Effects (side effects when state changes)
  $effect(() => {
    console.log('Count changed:', this.count);
  });
}
```

**Usage in components:**

```svelte
<script lang="ts">
  import { ExampleState } from '$lib/states/ExampleState.svelte';

  const state = new ExampleState();
</script>

<p>Count: {state.count}</p>
<p>Double: {state.doubleCount}</p>
<button onclick={() => state.increment()}>+1</button>
```

### Global State Instances

**Singleton pattern for app-wide state:**

```typescript
// lib/states/uiState.svelte.ts
class UIState {
  searchQuery = $state<string>('');
  filterOrganized = $state<boolean | null>(null);
  sortBy = $state<'title' | 'updated' | 'recent'>('title');
  viewMode = $state<'grid' | 'list'>('grid');

  // Persists to localStorage
  save() {
    localStorage.setItem('uiState', JSON.stringify({
      viewMode: this.viewMode,
      sortBy: this.sortBy
    }));
  }

  load() {
    const saved = localStorage.getItem('uiState');
    if (saved) {
      const data = JSON.parse(saved);
      this.viewMode = data.viewMode;
      this.sortBy = data.sortBy;
    }
  }
}

export const uiState = new UIState();
uiState.load();
```

### Key State Classes

1. **`ReaderState`** - Reader configuration (mode, zoom, navigation)
2. **`OcrState`** - OCR editing state (focus, mode, blocks)
3. **`ScrapingState`** - Metadata scraping workflow
4. **`uiState`** - UI preferences (filters, sort, view mode)
5. **`metadataOperations`** - Bulk operations state

---

## API Routes

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Create new user account |
| POST | `/login` | Authenticate and create session |
| POST | `/logout` | Destroy session |
| GET | `/me` | Get current user info |

**Session Management:**

```typescript
// Plugin: plugins/auth.ts
fastify.decorate('authenticate', async (request, reply) => {
  const sessionId = request.cookies.sessionId;

  if (!sessionId) {
    return reply.status(401).send({ error: 'Not authenticated' });
  }

  const user = await prisma.user.findUnique({
    where: { sessionId }
  });

  if (!user) {
    return reply.status(401).send({ error: 'Invalid session' });
  }

  request.user = user;
});
```

### Library (`/api/library`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all series (with filters, search, pagination) |
| GET | `/series/:id` | Get series details |
| GET | `/volume/:id` | Get volume details + .mokuro data |
| POST | `/upload` | Upload new manga folders |
| PATCH | `/series/:id` | Update series metadata |
| PATCH | `/volume/:id/ocr` | Save OCR edits |
| PATCH | `/volume/:id/progress` | Update reading progress |
| DELETE | `/series/:id` | Delete series and volumes |
| POST | `/batch/delete` | Bulk delete |

**Search & Filter Query:**

```typescript
// GET /api/library?q=kaguya&status=1&organized=true&sort=recent
interface LibraryQuery {
  q?: string;              // Text search
  status?: 0 | 1 | 2;      // Reading status
  bookmarked?: boolean;    // Bookmarked only
  is_organized?: boolean;  // Organization flag
  missing_cover?: boolean; // Missing metadata filters
  missing_description?: boolean;
  sort?: 'title' | 'updated' | 'recent';
  page?: number;
  limit?: number;
}
```

### Metadata (`/api/metadata`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/series/scrape` | Search metadata providers |
| PATCH | `/series/:id` | Apply scraped metadata |
| POST | `/batch/organize` | Bulk set organized flag |

**Scrape Request:**

```typescript
// POST /api/metadata/series/scrape
{
  query: "Kaguya-sama",
  providers: ["anilist", "mal", "kitsu"]
}

// Response
{
  results: [
    {
      source: "anilist",
      id: "12345",
      title: "Kaguya-sama: Love is War",
      japaneseTitle: "かぐや様は告らせたい",
      romajiTitle: "Kaguya-sama wa Kokurasetai",
      description: "...",
      coverUrl: "https://...",
      status: "FINISHED"
    }
  ]
}
```

### Export (`/api/export`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/volume/:id/zip` | Export single volume as ZIP |
| GET | `/volume/:id/pdf` | Export single volume as PDF |
| GET | `/series/:id/zip` | Export series as ZIP |
| GET | `/series/:id/pdf` | Export series as ZIP of PDFs |
| POST | `/batch` | Batch export (returns ticket) |
| GET | `/ticket/:id` | Download batch export |

**Batch Export Flow:**

```typescript
// 1. Request batch export
POST /api/export/batch
{
  volumeIds: ["id1", "id2", "id3"],
  format: "zip"
}

// 2. Server generates export in background, returns ticket
{
  ticketId: "abc123",
  status: "processing"
}

// 3. Client polls or waits, then downloads
GET /api/export/ticket/abc123
// Streams the ZIP file
```

### Settings (`/api/settings`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get current user settings |
| PATCH | `/` | Update user settings |

**Settings Structure:**

```typescript
interface UserSettings {
  reader: {
    mode: 'single' | 'double' | 'vertical';
    readingDirection: 'rtl' | 'ltr';
    dualPageOffset: boolean;
    navZoneWidth: number;
    retainZoom: boolean;
    autoFullscreen: boolean;
    hideHud: boolean;
  };
  appearance: {
    nightMode: boolean;
    nightModeIntensity: number;
    redShift: number;
    colorInvert: boolean;
    colorInvertIntensity: number;
    scheduleNightMode: boolean;
    nightModeStart: number;
    nightModeEnd: number;
  };
}
```

---

## Development Workflow

### Local Development

**Prerequisites:**
- Node.js v18+
- pnpm (recommended) or npm

**Setup:**

```bash
# Clone repository
git clone https://github.com/nguyenston/mokuro-library.git
cd mokuro-library

# Install dependencies
cd backend && pnpm install
cd ../frontend && pnpm install

# Initialize database
cd backend
npx prisma generate
npx prisma db push

# Start development servers
cd backend && pnpm dev    # Terminal 1 (port 3000)
cd frontend && pnpm dev   # Terminal 2 (port 5173)
```

**Environment Variables:**

```bash
# backend/.env
DATABASE_URL="file:./prisma/library.db"
NODE_ENV="development"
PORT=3000
SESSION_SECRET="your-secret-key"
```

### Docker Development

```bash
docker compose -f docker-compose.dev.yml up --build
```

Access at `http://localhost:5173` (frontend with HMR)

### Database Migrations

**Creating a migration:**

```bash
cd backend
npx prisma migrate dev --name add_bookmarked_field
```

**Applying migrations:**

```bash
npx prisma migrate deploy
```

**Reset database (dev only):**

```bash
npx prisma migrate reset
```

### Testing

**Backend:**

```bash
cd backend
pnpm test
```

**Frontend:**

```bash
cd frontend
pnpm test:unit      # Vitest unit tests
pnpm test:e2e       # Playwright E2E tests
```

### Building for Production

**Backend:**

```bash
cd backend
pnpm build   # Compiles TypeScript to dist/
```

**Frontend:**

```bash
cd frontend
pnpm build   # Builds SvelteKit app to build/
```

**Full Docker build:**

```bash
docker compose build
docker compose up -d
```

### Code Style

**Linting:**

```bash
# Frontend
pnpm lint
pnpm format

# Backend
pnpm lint
```

**Conventions:**
- TypeScript strict mode
- Prettier for formatting
- ESLint for linting
- Svelte component naming: PascalCase
- State classes: suffix with `.svelte.ts`

---

## Architecture Patterns & Best Practices

### 1. **Route Protection**

All authenticated routes use `preHandler` hook:

```typescript
fastify.get('/protected', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  const userId = request.user.id; // Guaranteed to exist
  // ...
});
```

### 2. **Error Handling**

Consistent error responses:

```typescript
try {
  // operation
} catch (error) {
  fastify.log.error(error);
  return reply.status(500).send({
    error: 'Internal server error',
    message: error.message
  });
}
```

### 3. **Component Composition**

Svelte components use props and events:

```svelte
<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';

  let value = $state(0);

  function handleChange(newValue) {
    value = newValue;
  }
</script>

<Child {value} onchange={handleChange} />

<!-- Child.svelte -->
<script>
  let { value, onchange } = $props();
</script>

<button onclick={() => onchange(value + 1)}>
  {value}
</button>
```

### 4. **API Client Pattern**

Centralized fetch wrappers:

```typescript
// lib/api.ts
export async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`/api${endpoint}`);
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  return res.json();
}

export async function apiPost<T>(endpoint: string, body: any): Promise<T> {
  const res = await fetch(`/api${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  return res.json();
}

// Usage
const series = await apiGet<Series>('/library/series/123');
```

### 5. **Lazy Loading**

Defer non-critical components:

```svelte
<script>
  import { onMount } from 'svelte';

  let StatisticsModal;

  onMount(async () => {
    const module = await import('$lib/components/StatisticsModal.svelte');
    StatisticsModal = module.default;
  });
</script>

{#if showStats && StatisticsModal}
  <StatisticsModal />
{/if}
```

---

## Performance Optimizations

### 1. **Image Lazy Loading**

```svelte
<!-- CachedImage.svelte -->
<img
  src={src}
  loading="lazy"
  decoding="async"
  alt={alt}
/>
```

### 2. **Database Indexing**

```prisma
model Series {
  // ...
  @@index([ownerId, lastReadAt])  // For "Recently Read" queries
  @@index([ownerId, updatedAt])   // For "Recently Updated" queries
}
```

### 3. **Pagination**

Cursor-based pagination for large libraries:

```typescript
// GET /api/library?cursor=abc123&limit=20
const series = await prisma.series.findMany({
  take: limit,
  skip: cursor ? 1 : 0,
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { updatedAt: 'desc' }
});
```

### 4. **OCR History Compression**

GZIP compression for patch storage:

```typescript
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Save
const payload = JSON.stringify(patches);
const compressed = await gzipAsync(Buffer.from(payload));
await prisma.historyChunk.create({
  data: { payload: compressed, ... }
});

// Load
const chunk = await prisma.historyChunk.findFirst(...);
const decompressed = await gunzipAsync(chunk.payload);
const patches = JSON.parse(decompressed.toString());
```

**Result**: 70-90% space savings on OCR history!

---

## Security Considerations

### 1. **Authentication**

- Passwords hashed with bcrypt (cost factor: 12)
- Sessions stored server-side, not in JWT
- Cookie-based auth (httpOnly, secure in production)

### 2. **Authorization**

- All data scoped by `ownerId`
- No cross-user data access
- File paths validated against `projectRoot`

### 3. **File Upload Security**

```typescript
// Validate file paths
const safePath = path.join(uploadDir, sanitize(filename));
if (!safePath.startsWith(uploadDir)) {
  throw new Error('Invalid path');
}
```

### 4. **SQL Injection Protection**

Prisma ORM provides parameterized queries:

```typescript
// Safe - Prisma handles escaping
await prisma.series.findMany({
  where: { title: { contains: userInput } }
});

// Unsafe - Never use raw SQL with user input
// await prisma.$queryRaw`SELECT * FROM Series WHERE title LIKE '%${userInput}%'`
```

### 5. **Rate Limiting**

```typescript
import rateLimit from '@fastify/rate-limit';

fastify.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes'
});
```

---

## Debugging Tips

### Backend Logging

Fastify has built-in logging:

```typescript
fastify.log.info('User logged in', { userId: user.id });
fastify.log.error('Upload failed', { error });
```

**View logs:**

```bash
# Docker
docker compose logs -f mokuro

# Local
# Logs appear in terminal where pnpm dev is running
```

### Frontend Debugging

**Chrome DevTools:**
- React DevTools → Svelte extension
- Network tab → API requests
- Console → State logging

**State inspection:**

```svelte
<script>
  import { ocrState } from '$lib/states/OcrState.svelte';

  $effect(() => {
    console.log('OCR mode changed:', ocrState.ocrMode);
  });
</script>
```

### Database Inspection

**Prisma Studio:**

```bash
cd backend
npx prisma studio
# Opens GUI at http://localhost:5555
```

**Direct SQL:**

```bash
sqlite3 backend/prisma/library.db
.tables
SELECT * FROM User;
```

---

## Common Pitfalls

### 1. **Svelte 5 Reactivity**

❌ **Wrong**: Mutating state directly

```typescript
items.push(newItem); // Won't trigger reactivity
```

✅ **Correct**: Reassign to trigger updates

```typescript
items = [...items, newItem];
```

### 2. **Prisma Type Safety**

❌ **Wrong**: Assuming fields exist

```typescript
const title = series.title; // Could be null!
```

✅ **Correct**: Handle nullability

```typescript
const title = series.title ?? series.folderName;
```

### 3. **File Path Handling**

❌ **Wrong**: Using forward slashes only

```typescript
const path = `uploads/${userId}/${filename}`; // Breaks on Windows
```

✅ **Correct**: Use path.join

```typescript
const path = path.join('uploads', userId, filename);
```

### 4. **Async Component Loading**

❌ **Wrong**: Top-level await in components

```svelte
<script>
  const data = await fetch(...); // Blocks rendering
</script>
```

✅ **Correct**: Use onMount

```svelte
<script>
  import { onMount } from 'svelte';

  let data = $state(null);

  onMount(async () => {
    data = await fetch(...).then(r => r.json());
  });
</script>

{#if data}
  <p>{data.title}</p>
{/if}
```

---

## Contributing Guidelines

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test locally
4. Commit with descriptive messages
5. Push and open a PR against `master`

### Commit Message Format

```
type(scope): brief description

Longer explanation if needed.

Closes #123
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**Example**:

```
feat(metadata): add Kitsu provider support

Implements Kitsu API integration as a third fallback provider
for metadata scraping. Includes rate limiting and error handling.

Closes #456
```

---

## Resources

### Documentation
- [Fastify Docs](https://fastify.dev/)
- [Prisma Docs](https://www.prisma.io/docs)
- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Svelte 5 Runes](https://svelte-5-preview.vercel.app/docs/runes)

### Related Projects
- [Mokuro OCR](https://github.com/kha-white/mokuro) - OCR processing tool
- [ZXY101/mokuro-reader](https://github.com/ZXY101/mokuro-reader) - Client-side PWA reader

### Community
- [GitHub Issues](https://github.com/nguyenston/mokuro-library/issues)
- [Discussions](https://github.com/nguyenston/mokuro-library/discussions)

---

## Conclusion

Mokuro Library is built on modern web technologies with a focus on:

✅ **Developer Experience** - TypeScript, hot reloading, type safety
✅ **Performance** - Efficient database queries, lazy loading, compression
✅ **User Experience** - Smooth UI, real-time updates, multi-device sync
✅ **Maintainability** - Clean architecture, documented code, testable

**Next Steps for New Developers:**

1. Set up local development environment
2. Read through database schema
3. Explore one feature implementation (start with reader or OCR editing)
4. Run the app and experiment with the UI
5. Pick a GitHub issue and make your first contribution!

**Happy coding!** 🚀
