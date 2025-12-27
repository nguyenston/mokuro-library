# Managing Your Library

This comprehensive guide covers uploading, browsing, and managing your manga collection in Mokuro Library.

## Browsing Your Library

### Library Views

Mokuro Library offers two ways to view your collection:

**Grid View** - Visual browsing with cover images
- Large cover thumbnails
- Series title and volume count
- Reading progress indicators
- Perfect for visual discovery

**List View** - Detailed information at a glance
- Compact rows with metadata
- Sort by multiple criteria
- Quick status overview
- Ideal for large libraries

![Library Grid View](/library.webp)
*Grid view showing your manga collection*

Switch between views using the filter menu (click the filter icon in the search bar).

### Search & Filter

Use the powerful search and filter system to find manga quickly:

**Search Bar** - Type to search across:
- Series titles
- Volume names
- Author names
- Tags and descriptions

**Reading Status Filters:**
- 📘 **Unread** - Haven't started yet
- 📗 **Reading** - Currently in progress
- ✅ **Read** - Completed volumes

**Quick Filters:**
- ⭐ **Bookmarked** - Your favorite series
- 📋 **Organized** - Properly categorized content
- 🔧 **Unorganized** - Needs attention
- ⚠️ **Missing Metadata** - Incomplete information

**Sort Options:**
- **Title** - Alphabetical order
- **Last Updated** - Recently added or modified
- **Recent** - Recently read or accessed

## Uploading Manga

### Prerequisites

Before uploading, ensure your manga has been processed with [Mokuro](https://github.com/kha-white/mokuro):

```bash
# Example Mokuro processing command
mokuro --parent_dir "/path/to/manga" --disable_confirmation
```

This generates `.mokuro` JSON files containing OCR text data.

### Upload Process

1. Click the **menu button** (top right)
2. Select "**Upload**"
3. The upload modal appears

![The upload modal](/upload-modal-empty.webp)
*Empty upload modal ready for selection*

4. Click "**Select Folder**" or drag-and-drop
5. Choose your root manga directory
6. Wait for processing and upload

![Upload in progress](/upload-modal.webp)
*Upload progress with multiple files*

::: tip Bulk Upload
You can upload multiple series at once by selecting a parent directory containing several series folders.
:::

### Required Folder Structure

Mokuro Library expects a specific folder hierarchy:

```
📁 My Manga Collection/          ← Select this folder
├── 📁 Yotsuba&!/                ← Series folder
│   ├── 📁 Volume 1/             ← Image folder
│   │   ├── 🖼️ 001.jpg
│   │   ├── 🖼️ 002.jpg
│   │   ├── 🖼️ 003.jpg
│   │   └── ...
│   ├── 📁 Volume 2/
│   │   ├── 🖼️ 001.jpg
│   │   └── ...
│   ├── 📄 Volume 1.mokuro       ← OCR data file
│   ├── 📄 Volume 2.mokuro
│   └── 🖼️ Yotsuba&!.png         ← Series cover (optional)
│
├── 📁 Kaguya-sama/
│   ├── 📁 Chapter 1/
│   ├── 📁 Chapter 2/
│   ├── 📄 Chapter 1.mokuro
│   ├── 📄 Chapter 2.mokuro
│   └── 🖼️ Kaguya-sama.jpg
│
└── 📁 One Piece/
    └── ...
```

**Key Requirements:**

| Component | Location | Format |
|-----------|----------|--------|
| Images | `<series>/<volume>/images/` | `.jpg`, `.png`, `.webp` |
| OCR Data | `<series>/<volume>.mokuro` | JSON file |
| Cover (optional) | `<series>/<series>.png/jpg` | Image file |

::: warning Important
- The `.mokuro` file must be **outside** the image folder
- The `.mokuro` filename must match the volume folder name exactly
- Image filenames don't need to be sequential (001, 002) but should be sortable
:::

### Upload Behavior

**Duplicate Handling:**
- Existing series/volumes are **not** overwritten
- Only new content is added to your library
- Reading progress is preserved

**Processing:**
- Server extracts metadata from folder names
- Cover images are automatically detected
- OCR data is parsed and stored
- Thumbnails are generated

::: tip Pro Tip
Organize your folder names well before uploading - they become your series and volume titles!
:::

## Managing Series

Click any series card to open its dedicated page.

![Series Detail Page](/series.webp)
*Series page showing all volumes*

### Series Actions

**Available Operations:**

- 📝 **Edit Metadata** - Change title, description, status
- 🖼️ **Update Cover** - Upload a new cover image
- 🔍 **Scrape Metadata** - Auto-fill from AniList, MyAnimeList, or Kitsu
- 📚 **View Volumes** - See all chapters/volumes
- 🗑️ **Delete Series** - Remove entire series

### Setting a Series Cover

To change or add a cover image:

1. Navigate to the series page
2. Click on the current cover image
3. Select a new image file
4. The cover updates immediately

**Supported Formats:**
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- WebP (`.webp`)

**Recommended Size:** 500x700px or similar aspect ratio

::: tip Automatic Covers
If you include an image file named after your series (e.g., `Yotsuba&!.png`) in the series folder, it's automatically used as the cover during upload.
:::

### Editing Series Metadata

Click the edit button (pencil icon) to modify:

- **Title** - Display name
- **Alternative Titles** - Romaji, Japanese, English titles
- **Description** - Summary or synopsis
- **Status** - Ongoing or Completed

![Edit Series Modal](/edit-series-placeholder.svg)
*Edit metadata form*

Changes are saved immediately and visible to all users.

## Managing Volumes

### Volume Actions

On the series page, each volume has action buttons:

- 📖 **Read** - Open in the reader
- 📋 **Mark as...** - Change reading status
- ✏️ **Edit** - Modify volume metadata
- 🗑️ **Delete** - Remove this volume

### Marking Read Status

Track your progress by setting status:

- **Unread** - Haven't started
- **Reading** - Currently reading
- **Completed** - Finished reading

Status updates automatically when you read, but you can also set it manually.

### Bulk Operations

Use **Selection Mode** for batch actions:

1. Click "**Select**" in the action bar
2. Check volumes you want to modify
3. Use bulk action buttons:
   - Mark as read/unread
   - Update metadata
   - Delete selected

![Selection Mode](/selection-mode-placeholder.svg)
*Bulk select multiple volumes*

## Deleting Content

### Delete a Volume

1. Navigate to the series page
2. Find the volume to delete
3. Click the **delete** button (trash icon)
4. Confirm the deletion

::: warning Data Loss
Deleting a volume removes:
- All images
- OCR text data
- Reading progress (all users)
- Volume metadata

This action **cannot be undone**!
:::

### Delete a Series

1. Open the series page
2. Click the **delete series** button
3. Type the series name to confirm
4. Click "Delete"

::: danger Permanent Deletion
Deleting a series removes:
- All volumes in the series
- All images and OCR data
- Reading progress for all users
- Series metadata and cover

**There is no undo!** Make sure you have backups.
:::

## Bookmarking

Mark favorite series for quick access:

1. Navigate to a series page
2. Click the **bookmark** icon (star)
3. The series is added to your bookmarks

**Filter bookmarked series:**
- Open the filter menu
- Enable the "Bookmarked Only" filter
- Only your starred series appear

::: info User-Specific
Bookmarks are personal - each user has their own set.
:::

## Reading Statistics

View your personal reading stats in the **Statistics** modal:

- Recent reading speed (characters/min)
- Total characters read
- Volumes completed
- Total time spent reading
- Reading speed history (line chart)
- Speed improvements per series

Access via: Menu → Stats

![Statistics Modal](/stats-placeholder.svg)
*Personal reading statistics overview*

::: info User-Specific
Statistics are personal - each user has their own reading stats.
:::

## Exporting Your Library

Create backups or share your collection:

### Export Options

**ZIP Archive:**
- Images and OCR data included
- Folder structure maintained
- Can export single volume, series, or entire library
- Includes metadata and progress data

**PDF Export:**
- Rendered pages with selectable OCR text
- Portable format for sharing
- Can export single volume, series, or entire library
- No editing capability after export

### Export Process

Export from the action menu on series/volume cards or use bulk operations in selection mode.

::: tip Backup Strategy
Regular ZIP exports preserve your entire library including OCR edits and reading progress.
:::

## Organizing Best Practices

### Naming Conventions

**Series Folders:**
```
✅ Yotsuba&!
✅ Kaguya-sama: Love is War
✅ One Piece
❌ yotsuba  (inconsistent capitalization)
❌ kaguya_sama  (prefer hyphens/spaces)
```

**Volume Folders:**
```
✅ Volume 01
✅ Volume 1
✅ Chapter 123
❌ v1  (too short, unclear)
❌ vol_01  (prefer spaces)
```

### Cover Images

- Use high-quality covers (at least 500px wide)
- Name cover files after the series
- Place in the series root folder
- Consistent aspect ratio across library

### Metadata Quality

- Fill in all available fields
- Add meaningful descriptions
- Use the metadata scraper for accuracy
- Keep titles consistent

## Troubleshooting

### Upload Fails

**"No valid manga found" error:**
- Check folder structure matches requirements
- Ensure `.mokuro` files exist
- Verify file permissions

**Upload hangs or times out:**
- Check file sizes (very large uploads may timeout)
- Verify server disk space
- Check network connection

### Missing Covers

**Series shows placeholder:**
- Add `<series-name>.png/jpg` to series folder
- Re-upload or manually set cover
- Check image file format

### Duplicate Series

**Same series appears twice:**
- Different folder names create separate series
- Use "Edit Metadata" to fix naming
- Delete duplicate and re-upload

## Next Steps

- [Start reading your manga](/using-the-reader)
- [Edit OCR text](/ocr-editing)
- [Organize your collection](/organizing-content)
- [Customize appearance](/appearance-settings)

## Related Pages

- [Installation](/installation) - Setting up the server
- [Authentication](/authentication) - User accounts
- [Using the Reader](/using-the-reader) - Reading manga
- [Organizing Content](/organizing-content) - Advanced organization
