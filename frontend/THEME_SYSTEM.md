# Theme System Documentation

## Overview
The theme system allows users to customize the appearance of the entire website through the Appearance modal. Themes are applied by updating CSS variables on the document root, which are then used throughout the application via Tailwind classes.

## Theme Application Logic

### Colors That ARE Themed (Applied via CSS Variables)

The following colors are dynamically changed based on the selected theme:

1. **Background Colors:**
   - `--color-theme-main` → `main-background` (Main page background)
   - `--color-theme-surface` → `card-background` (Card/surface backgrounds)
   - `--color-theme-surface-hover` → `card-highlight` (Hover states for surfaces)

2. **Border Colors:**
   - `--color-theme-border` → `border-color` (Main borders)
   - `--color-theme-border-light` → `border-color` (Light borders)
   - `--color-theme-border-active` → `primary-color` (Active border states)

3. **Text Colors:**
   - `--color-theme-primary` → `main-text` (Primary text color)
   - `--color-theme-secondary` → `muted-text` (Secondary/muted text)
   - `--color-theme-tertiary` → `muted-text` (Tertiary text)

4. **Accent/Interactive Colors:**
   - `--color-accent` → `primary-color` (Primary accent color for buttons, links, highlights)
   - `--color-accent-hover` → `primary-hover` (Hover state for accent elements)
   - `--color-progress` → `reading-color` (Progress indicators, reading status circles)

### Colors That Are NOT Themed (Fixed for Accessibility)

These colors remain constant regardless of theme selection for functional and accessibility reasons:

1. **Status Colors (Fixed):**
   - `--color-status-success: #10b981` - Green for "read" status in manga reader
   - `--color-status-warning: #f59e0b` - Yellow/amber for bookmarks
   - `--color-status-danger: #ef4444` - Red for errors/destructive actions
   - `--color-status-unread: #0ea5e9` - Blue for unread indicators

2. **Functional Colors (Fixed):**
   - `--color-icon-stats: #3b82f6` - Blue for statistics icons
   - `--color-icon-appearance: #8b5cf6` - Violet for appearance/settings icons
   - `--color-stat-metadata: #a855f7` - Purple for metadata displays

### Where Themes Are Applied

Themes are applied globally through CSS variables, affecting:

- **Library View:**
  - Background colors (main, cards, surfaces)
  - Text colors (titles, descriptions, metadata)
  - Border colors (card borders, dividers)
  - Accent colors (buttons, links, progress indicators)
  - Hover states

- **Series View:**
  - Hero section backgrounds
  - Card backgrounds
  - Text colors
  - Button styles
  - Border colors

- **Settings Pages:**
  - Panel backgrounds
  - Text colors
  - Input field styles
  - Button styles

- **Modals:**
  - Modal backgrounds
  - Text colors
  - Button styles
  - Border colors

- **Header:**
  - Background color
  - Text colors
  - Search bar styling
  - Button styles

### Where Themes Are NOT Applied

The following elements maintain fixed colors for consistency and accessibility:

1. **Bookmark Icons:**
   - Always use `--color-status-warning` (#f59e0b - yellow)
   - Located in: LibraryEntry, SeriesHero

2. **Read Status Indicators:**
   - "READ" badges use `--color-status-success` (#10b981 - green)
   - Located in: LibraryEntry, progress circles when volume is completed

3. **Unread Indicators:**
   - Use `--color-status-unread` (#0ea5e9 - blue)
   - Located in: LibraryEntry status badges

4. **Error Messages:**
   - Use `--color-status-danger` (#ef4444 - red)
   - Located in: Error states, confirmation dialogs

5. **Statistics Icons:**
   - Use fixed icon colors for visual distinction
   - Located in: StatisticsModal, LibraryOverview

## Theme Structure

### Mokuro Theme (Default)
The default "Mokuro" theme uses the current application colors:
- Main Background: `#0f172a` (dark slate)
- Card Background: `#1e293b` (slate)
- Primary Color: `#6366f1` (indigo)
- Preview Colors: `['#0f172a', '#1e293b', '#6366f1']` (shown in theme selector)

### Custom Theme
When custom theme is enabled, users can customize:
- All themed colors listed above
- Changes apply immediately as colors are adjusted
- Custom theme persists in localStorage

## Implementation Details

### Theme Store (`themeStore.svelte.ts`)
- Manages theme state and application
- Maps theme colors to CSS variables
- Handles localStorage persistence
- Provides methods to switch themes and update custom colors

### CSS Variable Mapping
The theme store maps custom theme colors to CSS variables as follows:

```typescript
'main-background' → --color-theme-main
'card-background' → --color-theme-surface
'card-highlight' → --color-theme-surface-hover
'border-color' → --color-theme-border, --color-theme-border-light
'primary-color' → --color-accent, --color-theme-border-active
'primary-hover' → --color-accent-hover
'main-text' → --color-theme-primary
'muted-text' → --color-theme-secondary, --color-theme-tertiary
'reading-color' → --color-progress
```

### Usage in Components
Components use Tailwind classes that reference these CSS variables:
- `bg-theme-main`, `bg-theme-surface` - Backgrounds
- `text-theme-primary`, `text-theme-secondary` - Text colors
- `border-theme-border`, `border-theme-border-light` - Borders
- `bg-accent`, `text-accent` - Accent colors

## Future Enhancements
- Additional preset themes (Midnight, Amethyst Haze, etc.)
- Light mode support
- System theme detection
- Theme import/export functionality

