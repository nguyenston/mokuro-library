# Appearance Settings

Customize the visual appearance of Mokuro Library with themes, night mode, color inversion, and other display options.

## Accessing Appearance Settings

### From the Menu

1. Click the **menu button** (top right, three lines)
2. Select "**Appearance**"
3. Appearance modal opens

![Appearance Modal](/appearance-modal-placeholder.svg)
*Comprehensive appearance customization panel*

### Settings Apply

- **Instantly** - Changes preview in real-time
- **Per-User** - Each account has own settings
- **Persistent** - Saved across sessions and devices
- **Global** - Affect entire app, not just reader

## Theme Selection

Choose from multiple color schemes to match your preference.

### Available Themes

::: tip Coming Soon
Multiple theme options are planned for a future release. Currently, the app uses the default dark theme.
:::

**Planned Themes:**
- **Dark** (Current) - Slate background, indigo accents
- **Light** - Clean, bright interface
- **OLED Black** - Pure black for OLED screens
- **Sepia** - Warm, paper-like tones
- **Custom** - Create your own color scheme

### Theme Components

**What Themes Affect:**
- Background colors
- Text colors
- Accent colors (buttons, links)
- Border colors
- Card shadows
- Menu backgrounds

## Night Mode

Reduce eye strain during evening and nighttime reading.

### Enabling Night Mode

**Manual Toggle:**
1. Open Appearance settings
2. Toggle "**Night Mode**" switch
3. Screen dims with red-shift filter

**Features:**
- **Intensity Control** - Adjust darkness level (0-100%)
- **Red Shift** - Reduce blue light for eye comfort (0-100%)
- **Smooth Transition** - Gradual fade in/out
- **Preserve Readability** - Maintain text contrast

![Night Mode Settings](/night-mode-placeholder.svg)
*Night mode with intensity and red shift controls*

### Night Mode Intensity

**Intensity Slider (0-100%):**
- **0%** - No effect (normal display)
- **25%** - Subtle dimming
- **50%** - Moderate darkness
- **75%** - Strong dimming
- **100%** - Maximum darkness

**Best Practices:**
- Start at 50% and adjust
- Higher for very dark rooms
- Lower for ambient lighting
- Match to screen brightness

### Red Shift Amount

**Red Shift Slider (0-100%):**

Reduces blue light emission by shifting color temperature toward red/orange.

- **0%** - No color shift (normal colors)
- **25%** - Slight warmth
- **50%** - Noticeable orange tint
- **75%** - Strong red shift
- **100%** - Maximum warm filter

**Benefits:**
- Reduced eye strain
- Better sleep quality
- Comfortable late-night reading
- Less blue light exposure

::: tip Sleep Better
Using red shift before bed can help maintain natural sleep rhythms by reducing blue light exposure.
:::

## Scheduled Night Mode

Automatically enable night mode at specific times.

### Configuring Schedule

1. Open Appearance settings
2. Toggle "**Schedule Night Mode**"
3. Set **Start Hour** (e.g., 20:00 / 8 PM)
4. Set **End Hour** (e.g., 06:00 / 6 AM)
5. Mode activates/deactivates automatically

**Schedule Settings:**
- **24-hour format** - Use 0-23 for hours
- **Cross-midnight** - End hour can be next day
- **Daily repeat** - Activates every day
- **Manual override** - Can toggle off during schedule

**Example Schedules:**

| Use Case | Start Hour | End Hour |
|----------|------------|----------|
| Evening reader | 18:00 (6 PM) | 23:00 (11 PM) |
| Night owl | 22:00 (10 PM) | 06:00 (6 AM) |
| All night | 19:00 (7 PM) | 08:00 (8 AM) |
| Afternoon | 14:00 (2 PM) | 17:00 (5 PM) |

::: info Auto-Activation
The schedule checks every minute. If current time is between start and end hours, night mode enables automatically with your saved intensity/red shift settings.
:::

## Color Inversion

Invert colors for alternative reading experience.

### Enabling Color Inversion

**Manual Toggle:**
1. Open Appearance settings
2. Toggle "**Invert Colors**"
3. Colors flip instantly

**What Gets Inverted:**
- Background (dark → light, light → dark)
- Text colors
- Images and manga pages
- UI elements
- Borders and shadows

**Intensity Control:**
- **Slider (0-100%)** - Adjust inversion strength
- **0%** - No inversion
- **50%** - Partial inversion
- **100%** - Full color flip

### Use Cases

**When to Use Inversion:**
- **Bright environments** - Easier to read light text
- **Accessibility** - Better contrast for some users
- **Reduce glare** - Less eye strain in daylight
- **Preference** - Some prefer inverted aesthetics

**Works Well With:**
- Black and white manga (stays readable)
- Text-heavy pages
- Daytime reading
- High ambient light

::: warning Image Quality
Color inversion affects manga pages. Some art may look unusual when inverted. Test to see if you like it!
:::

## Scheduled Color Inversion

Automatically invert colors during specific times.

### Configuring Inversion Schedule

Similar to night mode scheduling:

1. Toggle "**Schedule Color Inversion**"
2. Set **Start Hour**
3. Set **End Hour**
4. Set **Intensity** for scheduled activation

**Common Schedules:**

- **Daytime only** - 08:00 to 18:00 (bright hours)
- **Work hours** - 09:00 to 17:00 (office lighting)
- **Morning** - 06:00 to 12:00 (sunrise hours)

**Independent from Night Mode:**
- Can schedule both differently
- Night mode for evenings
- Color inversion for daytime
- Each with own intensity

## Combining Effects

Layer multiple appearance features for optimal comfort.

### Common Combinations

**Late Night Reading:**
```
✓ Night Mode: 75% intensity
✓ Red Shift: 60%
✗ Color Inversion: Off
```
*Dark, warm, comfortable for midnight sessions*

**Bright Daylight:**
```
✗ Night Mode: Off
✓ Color Inversion: 80%
✗ Red Shift: Off
```
*High contrast for sunlight conditions*

**Gentle Evening:**
```
✓ Night Mode: 40% intensity
✓ Red Shift: 30%
✗ Color Inversion: Off
```
*Subtle dimming as day transitions to night*

**Accessibility Boost:**
```
✓ Night Mode: 30%
✓ Color Inversion: 100%
✓ Red Shift: 0%
```
*Maximum contrast with some dimming*

### Scheduling Both Features

**24-Hour Comfort:**

| Time | Mode | Purpose |
|------|------|---------|
| 06:00-19:00 | Color Invert (60%) | Daytime reading |
| 19:00-22:00 | Night Mode (40%) | Evening transition |
| 22:00-06:00 | Night Mode (70%) + Red Shift (50%) | Sleep-friendly |

Set both schedules and let the app automatically adapt throughout the day!

## Font and Text Settings

::: tip Coming Soon
Custom font selection and size controls are planned for a future release.
:::

**Planned Features:**
- System font override
- Base font size adjustment
- Line height control
- Letter spacing options
- Font weight preferences

## Accessibility Options

Features to improve usability for all users.

### Current Features

**Built-In:**
- High contrast mode (via themes)
- Keyboard navigation support
- Screen reader compatibility
- Focus indicators
- Adjustable sizes (via browser zoom)

**Coming Soon:**
- Motion reduction toggle
- Larger click targets option
- Simplified UI mode
- Text-to-speech integration

### Browser Zoom

Use browser zoom for larger UI:

- `Ctrl +` (Windows/Linux) or `Cmd +` (Mac) - Zoom in
- `Ctrl -` or `Cmd -` - Zoom out
- `Ctrl 0` or `Cmd 0` - Reset zoom

Works alongside app's appearance settings!

## Display Preferences

Additional visual customizations.

### Animations

::: tip Coming Soon
Animation toggle planned for future release.
:::

**Current Animations:**
- Page transitions
- Menu slides
- Modal fades
- Button hovers
- Loading states

**Future Control:**
- Disable all animations
- Reduce motion
- Speed adjustment

### Transparency Effects

**Glass Morphism:**
- Menu backgrounds use backdrop blur
- Semi-transparent overlays
- Depth and layering effects

::: info Performance Note
On older devices, disable browser hardware acceleration if blur effects cause lag.
:::

## Saving and Syncing

How appearance settings are stored.

### Automatic Saving

- **Instant** - Changes save immediately
- **Per-Setting** - Each toggle/slider saves separately
- **No manual save** - Just adjust and close

### Cross-Device Sync

**Settings Sync:**
- Stored in user account (database)
- Load automatically on login
- Same settings on all devices
- Real-time updates

**What Syncs:**
- Night mode preferences
- Color inversion settings
- Theme selection
- Schedule configurations
- Intensity values

## Resetting Settings

Return appearance to defaults.

### Reset Options

::: tip Coming Soon
One-click reset button planned for appearance settings panel.
:::

**Current Method:**
- Manually toggle each setting off
- Set sliders to 0%
- Disable schedules
- Select default theme

**Future:**
- "Reset to Defaults" button
- Reset by category
- Confirmation dialog

## Performance Tips

Optimize appearance for smooth experience.

### For Best Performance

**Recommended:**
- Use default theme (optimized)
- Moderate intensity levels (50-70%)
- Enable hardware acceleration in browser
- Close unused tabs

**Avoid:**
- Extreme blur effects on old hardware
- 100% intensity everything
- Multiple overlapping schedules
- Unnecessary color shifts

### Troubleshooting

**Display Issues:**

**Colors look wrong:**
- Check color inversion is off (unless intended)
- Verify monitor color profile
- Test in different browser

**Night mode too dark:**
- Reduce intensity slider
- Check screen brightness
- Adjust room lighting

**Blur effects laggy:**
- Disable browser hardware acceleration
- Use simpler theme
- Reduce transparency in OS settings

**Schedules not activating:**
- Verify correct time zone
- Check start/end hours are set
- Ensure schedule toggle is ON
- Refresh the page

## Tips and Tricks

Get the most from appearance customization.

### Reading in Different Environments

**Bright Room / Outdoors:**
- Disable night mode
- Enable color inversion
- Increase screen brightness
- Use high contrast

**Dark Room / Evening:**
- Enable night mode (50-70%)
- Add red shift (40-60%)
- Reduce screen brightness
- Comfortable long sessions

**Mixed Lighting:**
- Use schedules
- Moderate all settings
- Adjust as needed
- Quick manual override

### For Japanese Language Learning

**Optimal Settings:**
- Default theme (good contrast)
- No color inversion (natural colors)
- Moderate night mode if needed
- Clear text visibility
- Comfortable extended reading

**OCR Text Selection:**
- Ensure good contrast
- Avoid extreme filters
- Test text selection works
- Adjust if text hard to see

### Seasonal Adjustments

**Summer (More daylight):**
- Later schedule start
- Earlier schedule end
- Lower intensities
- More color inversion

**Winter (Less daylight):**
- Earlier schedule start
- Later schedule end
- Higher intensities
- More night mode

## Next Steps

- [Configure reader settings](/reader-settings) for reading preferences
- [Start reading](/using-the-reader) with your custom appearance
- [Edit OCR text](/ocr-editing) in comfortable lighting
- [Organize your library](/organizing-content) with clear visibility

## Related Pages

- [Reader Settings](/reader-settings) - Layout and navigation preferences
- [Using the Reader](/using-the-reader) - Reading interface guide
- [Authentication](/authentication) - User accounts and settings
- [Managing Your Library](/managing-your-library) - Library organization
