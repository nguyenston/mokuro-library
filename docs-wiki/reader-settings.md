# Reader Settings

Configure your reading experience with layout modes, navigation options, zoom behavior, and reader-specific preferences. All settings save to your account and sync across devices.

## Accessing Reader Settings

### From the Reader

1. Open any volume in the reader
2. Click the **settings button** (gear icon, top right)
3. Settings panel slides in from the right
4. Adjust preferences
5. Changes apply instantly

![Reader Settings Button](/reader-settings-button.webp)
*Settings button in the reader toolbar*

### Settings Persistence

- **Auto-Save** - Changes save immediately
- **Per-User** - Each account has own settings
- **Cross-Device** - Sync across all your devices
- **Per-Setting** - Each option saves independently

## Layout Mode

Choose how pages are displayed.

### Single Page Mode

**Default layout** - One page at a time.

**When to Use:**
- Most manga reading
- Mobile devices (phones/tablets)
- Focused, distraction-free reading
- Language learning (easier text selection)
- Vertical/portrait screens

**Advantages:**
- Maximum page size
- Best for OCR text selection
- Works on all screen sizes
- Easy navigation
- Less complex

**Settings:**
- Toggle: "**Single Page**"
- No additional options
- Straightforward operation

### Double Page (Spread) Mode

**Side-by-side display** - Two pages simultaneously.

**When to Use:**
- Desktop/laptop reading
- Landscape/widescreen monitors
- Traditional manga experience
- Double-page spread artwork
- Larger screens (tablets in landscape)

**Advantages:**
- Immersive book-like reading
- See spread art as intended
- Faster page progression
- Desktop-optimized

**Additional Settings:**
- **Reading Direction** - RTL (manga) or LTR (western)
- **Page Offset** - Odd/even start alignment

![Double Page Mode](/double-page-settings.webp)
*Double page configuration options*

### Vertical (Scroll) Mode

**Continuous scrolling** - All pages in one column.

**When to Use:**
- Webtoon-style reading
- Long, uninterrupted sessions
- Mobile devices
- Touch-screen devices
- Preference for scrolling over clicking

**Advantages:**
- Seamless page flow
- No page breaks
- Natural scrolling
- Touch-optimized
- Continuous immersion

**Behavior:**
- Navigation buttons hidden
- Arrow keys disabled
- Scroll to move through pages
- Touch gestures enabled

::: info Mode-Specific
Some settings only apply to certain modes. For example, reading direction doesn't affect vertical scrolling mode.
:::

## Reading Direction

Set page order for double-page mode.

### Right-to-Left (RTL)

**Traditional manga format** - Pages flip right to left.

**Use For:**
- Japanese manga
- Most Asian comics
- Traditional reading
- Default for manga

**Behavior:**
- Right page shows first
- Click right = previous page
- Click left = next page
- Natural manga flow

### Left-to-Right (LTR)

**Western comic format** - Pages flip left to right.

**Use For:**
- Western comics
- English manga adaptations
- Non-traditional layouts
- Personal preference

**Behavior:**
- Left page shows first
- Click left = previous page
- Click right = next page
- Western book flow

::: tip Auto-Detection
Future versions may auto-detect reading direction from manga metadata. For now, set manually as needed.
:::

## Page Offset (Double Page)

Align spreads correctly when using double-page mode.

### Understanding Offset

**The Problem:**
- Volume cover is usually page 1 (alone)
- Next pages should pair: 2-3, 4-5, etc.
- But without offset: pairs become 1-2, 3-4 (wrong!)

**The Solution:**
- Offset controls which page starts alone
- Corrects spread alignment
- Ensures artwork displays properly

### Offset Options

**Odd Page Start (Offset OFF):**
```
Page 1 (alone)
Page 2-3 (spread)
Page 4-5 (spread)
Page 6-7 (spread)
...
```
*First page alone, then pairs*

**Even Page Start (Offset ON):**
```
Page 1-2 (spread)
Page 3-4 (spread)
Page 5-6 (spread)
...
```
*Pairing from page 1*

**How to Choose:**
1. Enable double-page mode
2. Look at pages 2-3
3. If split incorrectly, toggle offset
4. Find setting that aligns spreads
5. Save and continue reading

::: tip Visual Check
If you see a two-page illustration split awkwardly, toggle the offset setting to fix alignment!
:::

## Zoom Retention

Control zoom behavior across page turns.

### Enable Zoom Retention

**Toggle:** "**Retain Zoom Level**"

**When Enabled:**
- Zoom level persists across pages
- Pan position resets (centers on new page)
- Consistent magnification throughout
- Manual zoom adjustments stick

**When Disabled (Default):**
- Zoom resets to fit-page on each turn
- Each page starts at default zoom
- Better for varied panel sizes
- Traditional manga reader behavior

### Use Cases

**Enable Retention For:**
- Consistent text size (small handwriting)
- Detailed artwork examination
- Reading at specific zoom level
- Accessibility needs (larger text)

**Disable Retention For:**
- Varied page layouts
- Automatic fit-to-screen
- Traditional reading flow
- Let each page optimize itself

**Manual Override:**
- Can always reset zoom with `0` key
- Or adjust with `+`/`-` keys
- Setting just controls automatic behavior

## Navigation Zone Width

Adjust clickable area size for page navigation.

### Understanding Zones

**Navigation Zones:**
- **Left Zone** - Click to go to previous page
- **Right Zone** - Click to go to next page
- **Center** - No navigation (for OCR selection)

**Zone Width:**
- Controls how far from edge zones extend
- Measured as percentage of screen width
- Affects only single/double page modes
- Not used in vertical scroll mode

### Width Settings

**Slider: 5% to 40%**

| Width | Left Zone | Center | Right Zone | Best For |
|-------|-----------|--------|------------|----------|
| 10% | Small | Large | Small | Precise OCR, small zones |
| 20% | Medium | Medium | Medium | **Balanced (default)** |
| 30% | Large | Small | Large | Easy navigation, less OCR |
| 40% | Huge | Tiny | Huge | Maximum navigation ease |

**Finding Your Preference:**
1. Start at default (20%)
2. If clicking accidentally, decrease
3. If hard to navigate, increase
4. Test while reading
5. Adjust as needed

::: tip Touch Devices
On tablets/phones, wider zones (25-35%) work better for finger taps. On desktop with mouse, narrower zones (15-20%) allow more OCR selection area.
:::

## Auto-Fullscreen

Automatically enter fullscreen mode when opening the reader.

### Enable Auto-Fullscreen

**Toggle:** "**Auto-Fullscreen**"

**When Enabled:**
- Reader enters fullscreen on volume open
- Hides browser chrome (address bar, tabs)
- Maximizes reading area
- Immersive experience

**When Disabled (Default):**
- Reader opens in normal window
- Browser UI visible
- Manual fullscreen available (`F` key)
- Traditional browser experience

### Fullscreen Controls

**Manual Toggle:**
- Press `F` key anytime
- Or browser fullscreen (`F11`)
- Exit with `Esc` key

**Benefits:**
- More screen space for manga
- Fewer distractions
- Cleaner interface
- Cinema-like reading

**Considerations:**
- Some browsers require user gesture
- May not work on mobile
- Exit with `Esc` or `F` key

## Hide HUD

Control visibility of the reader's heads-up display.

### What is HUD?

**HUD Elements:**
- Top toolbar (volume/page info, buttons)
- Navigation zones outline (optional)
- Progress bar (bottom)
- Edit mode indicators

**Toggle:** "**Hide HUD**"

**When Hidden:**
- Only manga page visible
- Minimal interface
- Clean, distraction-free
- Hover to reveal temporarily

**When Visible (Default):**
- All controls shown
- Easy access to settings
- Clear page information
- Beginner-friendly

### Trigger Outline

**Show Navigation Zones:**
- Visual outline of click zones
- Left/right borders highlight
- Helps learn zone widths
- Toggle: "**Show Trigger Outline**"

**When to Enable:**
- Learning navigation zones
- Adjusting zone width
- Debugging navigation issues
- Visual preference

**When to Disable:**
- Familiar with zones
- Prefer clean look
- Distracting during reading

## Auto-Complete Volume

Automatically mark volume as complete when finishing.

### Enable Auto-Complete

**Toggle:** "**Auto-Complete Volume**"

**When Enabled:**
- Reaching last page marks volume complete
- Reading status updates automatically
- Progress shows 100%
- Series progress updates

**When Disabled:**
- Must manually mark as complete
- Prevents accidental completion
- More control over status

**Manual Override:**
- Can always change status on series page
- Mark as unread/reading/complete
- Useful for re-reading

## Reader Preferences Summary

Quick reference for all reader settings.

| Setting | Default | Options | Applies To |
|---------|---------|---------|------------|
| **Layout Mode** | Single | Single, Double, Vertical | All pages |
| **Reading Direction** | RTL | RTL, LTR | Double mode only |
| **Page Offset** | OFF | ON, OFF | Double mode only |
| **Retain Zoom** | OFF | ON, OFF | Single/Double modes |
| **Nav Zone Width** | 20% | 5%-40% | Single/Double modes |
| **Auto-Fullscreen** | OFF | ON, OFF | Reader launch |
| **Hide HUD** | OFF | ON, OFF | Reader interface |
| **Show Triggers** | OFF | ON, OFF | Visual aid |
| **Auto-Complete** | ON | ON, OFF | Volume finishing |

## Recommended Configurations

Suggested settings for different use cases.

### Desktop Manga Reading

**Traditional Experience:**
```
Layout: Double Page
Direction: RTL
Offset: As needed (test first pages)
Zoom Retention: OFF
Nav Zones: 15-20%
Auto-Fullscreen: Optional
```

### Mobile Phone Reading

**Touch-Optimized:**
```
Layout: Single Page (or Vertical)
Zoom Retention: OFF
Nav Zones: 25-30% (larger for fingers)
Auto-Fullscreen: OFF (doesn't work well)
Hide HUD: Optional
```

### Language Learning

**OCR-Focused:**
```
Layout: Single Page
Nav Zones: 15% (more center for selection)
Zoom Retention: ON (consistent text size)
Hide HUD: OFF (need access to edit mode)
Show Triggers: OFF (cleaner for selection)
```

### Binge Reading

**Speed-Optimized:**
```
Layout: Vertical Scroll (or Double Page)
Auto-Complete: ON
Auto-Fullscreen: ON
Hide HUD: ON
```

### First-Time User

**Beginner-Friendly:**
```
Layout: Single Page
Direction: RTL
Nav Zones: 20% (default)
Zoom Retention: OFF
Hide HUD: OFF
Show Triggers: ON (learn zones)
```

## Keyboard Shortcuts

Reader settings hotkeys for power users.

| Shortcut | Action |
|----------|--------|
| `S` | Toggle settings panel |
| `F` | Toggle fullscreen |
| `H` | Toggle HUD visibility |
| `1` | Switch to single page |
| `2` | Switch to double page |
| `3` | Switch to vertical scroll |

::: tip Pro Tip
Combine shortcuts for fast switching: `F` for fullscreen, `H` to hide HUD, `3` for scroll mode - instant immersive vertical reading!
:::

## Syncing Across Devices

How settings transfer between devices.

### What Syncs

**Automatically Synced:**
- Layout mode preference
- Reading direction
- Page offset setting
- Zoom retention toggle
- Navigation zone width
- Auto-fullscreen preference
- HUD visibility
- Trigger outline setting
- Auto-complete toggle

**Not Synced:**
- Current zoom level (resets per page)
- Pan position
- Fullscreen state (browser-specific)
- Temporary UI states

### Sync Behavior

**On Login:**
1. Settings load from database
2. Apply to current device
3. Reader uses saved preferences
4. Reading progress restored

**On Setting Change:**
1. Change applies instantly
2. Saves to database immediately
3. Available on next device login
4. No manual sync needed

**Multiple Devices:**
- Desktop, tablet, phone all sync
- Latest change wins
- Per-user settings
- Independent of reading progress

## Troubleshooting

Common reader settings issues and solutions.

### Settings Not Saving

**Symptoms:**
- Changes revert after refresh
- Settings don't persist
- Different on each device

**Solutions:**
- Check login status (must be logged in)
- Verify server connection
- Clear browser cache
- Try different browser
- Check for JavaScript errors

### Double Page Spreads Wrong

**Symptoms:**
- Two-page art splits awkwardly
- Pages don't align correctly

**Solutions:**
- Toggle page offset setting
- Check reading direction (RTL vs LTR)
- Verify using double-page mode
- Test with different volumes

### Navigation Zones Not Working

**Symptoms:**
- Clicks don't change pages
- Zones seem wrong

**Solutions:**
- Enable "Show Trigger Outline"
- Adjust zone width
- Check not in vertical mode
- Verify not in edit mode

### Fullscreen Issues

**Symptoms:**
- Auto-fullscreen doesn't work
- Can't exit fullscreen

**Solutions:**
- Browser permission required (allow fullscreen)
- Press `Esc` or `F` to exit
- Mobile browsers may not support
- Try manual fullscreen (`F11`)

## Performance Optimization

Settings that affect reader performance.

### For Best Performance

**Recommended:**
- Single page mode (fastest)
- Hide HUD when not needed
- Disable unused features
- Close other browser tabs

**For Lower-End Devices:**
- Avoid vertical mode with 200+ page volumes
- Use single page instead of double
- Disable auto-fullscreen
- Reduce zoom levels

### High-Resolution Displays

**On 4K/Retina Screens:**
- Settings work normally
- Images scale appropriately
- May load slightly slower
- Zoom works better (more detail)

## Tips and Best Practices

Get the most from reader settings.

### Experiment

**Don't Be Afraid to Try:**
- Test different layouts
- Adjust zone widths
- Enable/disable features
- Find what works for YOU

**Settings Are:**
- Reversible (just toggle back)
- Instant (no waiting)
- Safe (won't break anything)
- Personal (doesn't affect others)

### Match Content

**Adjust Per Series:**
- Wide format manga → Double page
- Vertical webtoons → Vertical scroll
- Small text → Zoom retention ON
- Fast action → Single page

### Device-Specific

**Remember:**
- Settings sync across devices
- But what's good on desktop...
- ...may not work on phone
- Adjust per device if needed
- Or use one global preference

## Next Steps

- [Start reading](/using-the-reader) with your optimized settings
- [Edit OCR text](/ocr-editing) in your preferred layout
- [Customize appearance](/appearance-settings) for visual comfort
- [Organize library](/organizing-content) for easy access

## Related Pages

- [Using the Reader](/using-the-reader) - Reader interface guide
- [Appearance Settings](/appearance-settings) - Visual customization
- [Editing OCR Text](/ocr-editing) - Text editing features
- [Managing Your Library](/managing-your-library) - Library management
