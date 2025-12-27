# Organizing Content

Advanced techniques for maintaining a well-organized manga library with proper metadata, tagging, and categorization.

## Metadata Scraping

Automatically populate series information from online databases.

### Using the Metadata Scraper

1. Navigate to a series page
2. Click the "**Scrape Metadata**" button in the action bar
3. Search for your series by name
4. Select the correct match from results
5. Choose which fields to import:
   - Title (English, Japanese, Romaji)
   - Synonyms/Alternative titles
   - Description/Synopsis
   - Cover Image
   - Status (Ongoing/Completed)

![Metadata Scraper](/scraper-placeholder.svg)
*Search and select metadata from online sources*

::: tip Supported Sources
The scraper pulls data from **AniList**, **MyAnimeList**, and **Kitsu** with automatic fallback between providers for comprehensive coverage.
:::

### Manual Metadata Entry

If auto-scraping doesn't find your series or you prefer manual control:

1. Click the "**Edit**" button (pencil icon)
2. Fill in available metadata fields:
   - **Title** - Official or preferred series name
   - **Alternative Titles** - Other names (romaji, English, Japanese)
   - **Description** - Plot summary or synopsis
   - **Status** - Ongoing or Completed

![Edit Metadata Form](/edit-metadata-placeholder.svg)
*Manual metadata editing interface*

## Organization Flags

Mark series based on their organization status.

### Organization States

**Organized** - Well-maintained series with:
- Complete metadata (title, author, description)
- High-quality cover image
- Proper naming conventions
- All volumes present

**Unorganized** - Series needing attention:
- Missing metadata fields
- No cover image or poor quality
- Inconsistent naming
- Gaps in volume collection

### Using Organization Filters

Filter your library by organization status:

1. Open the filter menu (search bar icon)
2. Select organization filter:
   - **Organized** - Show only well-maintained series
   - **Unorganized** - Show series needing work
   - **All** - No filter

![Organization Filter](/filter-org-placeholder.svg)
*Filter by organization status*

This helps you identify which series need metadata improvements.

## Quality Control

### Missing Metadata Detection

The filter system can identify series with missing information:

**Missing Metadata Filters:**
- **Any Missing** - Has at least one empty field
- **No Cover** - Missing cover image
- **No Description** - Missing synopsis
- **No Title** - Using folder name as title

**Workflow for Cleanup:**

1. Apply "**Any Missing**" filter
2. Review each flagged series
3. Use metadata scraper or manual entry
4. Mark as organized when complete

### Cover Image Guidelines

**Quality Standards:**

| Aspect | Minimum | Recommended |
|--------|---------|-------------|
| Resolution | 300x400px | 500x700px |
| Format | JPG, PNG, WebP | PNG or WebP |
| Aspect Ratio | Portrait | 5:7 or 2:3 |
| File Size | Any | Under 500KB |

**Finding Covers:**
- Use the built-in metadata scraper
- Search manga databases (MyAnimeList, AniList)
- Use official publisher websites
- Extract from the first page of the volume

**Upload Process:**
1. Navigate to series page
2. Click the current cover image
3. Select your image file
4. Cover updates immediately

## Bulk Operations

Efficiently manage multiple series at once.

### Selection Mode

Enable selection mode to perform batch actions:

1. Click "**Select**" in the library action bar
2. Checkboxes appear on series/volume cards
3. Select items to modify
4. Choose a bulk action:
   - **Mark as Read/Unread** - Update reading status
   - **Update Status** - Change to Reading/Completed
   - **Scrape Metadata** - Auto-fill for multiple series
   - **Delete** - Remove selected items

![Bulk Selection](/bulk-select-placeholder.svg)
*Select multiple series for batch operations*

::: warning Bulk Deletion
Deleting multiple items cannot be undone. Double-check your selection before confirming!
:::

### Action Bar Tools

Quick actions available in the library toolbar:

- 🔍 **Select All** - Check all visible items
- ❌ **Clear Selection** - Uncheck all items
- 📊 **Selection Info** - Shows count of selected items
- 🎯 **Bulk Actions Menu** - Available operations

## Bookmarking

Mark favorite series for quick access:

1. Open a series page
2. Click the bookmark/star icon
3. Series is added to bookmarks

**Filter bookmarked series:**
1. Open filter menu
2. Enable "Bookmarked Only"
3. Only starred series appear

## Advanced Filtering

Combine multiple filters for precise library searches.

### Filter Combinations

**Example Workflows:**

**Find Unfinished Reading:**
- Status: Reading
- Sort: Recent
- Result: Currently reading series, most recently accessed first

**Clean Up Library:**
- Organization: Unorganized
- Missing: Any Missing
- Result: Series needing metadata work

**Discover New Content:**
- Status: Unread
- Sort: Last Updated
- Result: Recently added but unread series

### Search Operators

The search bar supports natural language queries:

**Search Across:**
- Series titles
- Alternative titles
- Synonyms
- Romaji titles

**Search Tips:**
- Case-insensitive by default
- Partial matching supported
- Searches across all title variants

## Naming Conventions

Maintain consistency for better organization.

### Series Naming

**Recommended Format:**
```
✅ One Piece
✅ Kaguya-sama: Love is War
✅ Jujutsu Kaisen
✅ 5-toubun no Hanayome

❌ one piece (lowercase)
❌ Kaguya_sama (underscores)
❌ JujutsuKaisen (no space)
```

**Guidelines:**
- Use official English or romaji title
- Proper capitalization
- Hyphens for connected words
- Colons for subtitles
- Numbers as digits (not words)

### Volume Naming

**Standard Formats:**

```
✅ Volume 1
✅ Volume 01
✅ Chapter 123
✅ Vol. 5

❌ v1 (too abbreviated)
❌ vol_01 (underscore)
❌ 001 (unclear)
```

**Consistency is Key:**
- Choose one format per series
- Pad numbers for sorting (01 vs 1)
- Use "Volume" or "Chapter" prefix
- Match official numbering

## Folder Structure Best Practices

Organize your filesystem before uploading.

### Recommended Structure

```
📁 Manga Library/
├── 📁 [Author Name]/
│   ├── 📁 Series 1/
│   │   ├── 📁 Volume 01/
│   │   ├── 📁 Volume 02/
│   │   ├── 📄 Volume 01.mokuro
│   │   ├── 📄 Volume 02.mokuro
│   │   └── 🖼️ Series 1.jpg
│   └── 📁 Series 2/
│       └── ...
└── 📁 [Another Author]/
    └── ...
```

**Benefits:**
- Easy to find specific series
- Groups related works
- Maintains backup structure
- Scales with large libraries

### Alternative Structures

**By Genre:**
```
📁 Action/
📁 Romance/
📁 Comedy/
```

**By Status:**
```
📁 Ongoing/
📁 Completed/
📁 On Hold/
```

**Alphabetical:**
```
📁 A-E/
📁 F-K/
📁 L-P/
```

::: info Note
Mokuro Library uses the series folder names, so internal organization doesn't affect the app. Choose what works for your file management.
:::

## Data Integrity

Maintain library health and prevent data loss.

### Regular Backups

**What to Backup:**

1. **Database** - User data and metadata
   ```bash
   cp backend/mokuro-library.db backups/library-$(date +%Y%m%d).db
   ```

2. **Manga Files** - Original .mokuro and images
   - Use export feature for metadata
   - Regular filesystem backups
   - Cloud storage sync (optional)

3. **Covers** - Custom uploaded covers
   - Stored in `uploads/covers/`
   - Include in filesystem backup

**Backup Schedule:**
- Daily: Database
- Weekly: Full export (metadata only)
- Monthly: Complete filesystem backup

### Verification Checks

Periodically verify library integrity:

**Check for:**
- Orphaned volumes (no parent series)
- Missing .mokuro files
- Broken cover images
- Duplicate series

**Tools:**
- Use "Missing Metadata" filters
- Check Statistics modal for anomalies
- Review recently uploaded content

### Recovering from Issues

**Missing Metadata:**
1. Identify affected series (filters)
2. Re-scrape from online sources
3. Manual entry if necessary

**Broken Covers:**
1. Re-upload cover images
2. Use scraper to fetch new covers
3. Extract from volume pages

**Corrupt Data:**
1. Restore from database backup
2. Re-upload affected volumes
3. Verify with test reads

## Import/Export Workflows

Share library organization across instances.

### Export Library Data

Create portable backups:

**Full Export (ZIP):**
- All images and OCR data
- Folder structure preserved
- Large file size
- Complete offline library

**Metadata Only (ZIP):**
- No images
- OCR text included
- Small file size
- Quick backup

**PDF Export:**
- Rendered pages
- Portable format
- No OCR editing
- Sharing-friendly

### Import Best Practices

When importing to a new instance:

1. Extract exported ZIP
2. Verify folder structure
3. Upload via standard process
4. Check for duplicate detection
5. Verify metadata carried over

## Maintenance Routines

Regular tasks to keep your library organized.

### Weekly Tasks

- [ ] Process new uploads
- [ ] Scrape metadata for new series
- [ ] Update reading status
- [ ] Backup database

### Monthly Tasks

- [ ] Review unorganized series
- [ ] Update covers for quality
- [ ] Verify all metadata complete
- [ ] Full library export backup
- [ ] Check for duplicate entries

### As Needed

- [ ] Add new series
- [ ] Delete completed/dropped series
- [ ] Reorganize filesystem
- [ ] Update app to latest version

## Tips for Large Libraries

Optimize performance with 1000+ volumes.

### Performance Optimization

**Database Maintenance:**
- Regular backups prevent bloat
- Periodic integrity checks
- Delete unused data

**File Organization:**
- Consistent naming reduces search time
- Proper tagging improves filters
- Complete metadata speeds searches

### Search Strategies

With large libraries, use filters effectively:

1. **Narrow First** - Apply specific filters before searching
2. **Use Status** - Filter by Reading/Unread/Completed
3. **Sort Smart** - Recent for active series, Title for browsing
4. **Bookmark Often** - Flag series you return to frequently

## Next Steps

- [Start reading your organized library](/using-the-reader)
- [Customize your reading experience](/reader-settings)
- [Edit OCR text for accuracy](/ocr-editing)
- [Adjust appearance settings](/appearance-settings)

## Related Pages

- [Managing Your Library](/managing-your-library) - Upload and basic management
- [Authentication](/authentication) - User accounts and settings
- [Using the Reader](/using-the-reader) - Reading interface
- [Appearance Settings](/appearance-settings) - Visual customization
