# Editing OCR Text

One of Mokuro Library's most powerful features is the ability to correct OCR text and save your changes directly back to the `.mokuro` files on your server - permanently improving text quality for all users.

::: danger CRITICAL: Save Your Work!
Your changes are **NOT** saved automatically. You **MUST** click the **Save** button in the top toolbar before leaving the reader, or all your edits will be lost!
:::

## Why Edit OCR Text?

**Common Reasons to Edit:**

- **Fix Recognition Errors** - OCR isn't perfect; correct misread kanji or kana
- **Improve Text Selection** - Better text = better dictionary lookups
- **Language Learning** - Accurate text for study and flashcards
- **Archival Quality** - Create perfect digital copies
- **Missing Text** - Add text that OCR missed entirely

**Who Benefits:**
- Japanese language learners
- Archivists and librarians
- Quality-focused collectors
- Anyone using text-to-speech
- Future readers of your library

## Entering Edit Mode

### Activating the Editor

1. Open a volume in the reader
2. Click the **Edit Mode** button (pencil icon, top toolbar)
3. The interface switches to editing mode
4. Text boxes become interactive

![The OCR editing buttons](/activate-edit-mode.webp)
*Edit mode button in the reader toolbar*

### Three Edit Modes

The editor has three distinct modes you can switch between:

| Mode | Icon | Purpose | Primary Action |
|------|------|---------|----------------|
| **📖 Read** | Book | Normal reading | Select and copy text |
| **📦 Box** | Box | Adjust layout | Move and resize boxes |
| **✏️ Text** | Pencil | Edit content | Type and modify text |

**Mode Button:**
- Click the **Edit Mode** button to cycle through modes
- Current mode shows in the button icon
- Or use automatic mode switching (see below)

### Smart Resize Toggle

Independent of the three main modes:

**⭐ Smart Resize Button:**
- Separate button next to Edit Mode
- Toggles auto font-size adjustment
- Works in any mode
- Highly recommended to keep ON

## 1. Text Edit Mode ✏️

Edit the actual text content of OCR boxes.

### Basic Text Editing

**To Edit a Line:**

1. Activate Text Edit mode (pencil icon)
2. Click on any line to place your cursor
3. Type to edit the text
4. Text updates in real-time

**Or Quick-Switch:**
- **Double-click any line** in Box mode
- Instantly switches to Text mode
- Cursor placed at click position
- Start typing immediately

![Editing text inside a line](/using-text-edit-mode.webp)
*Text edit mode with active cursor*

### Keyboard Navigation

**Arrow Keys:**

Navigate between text lines without using the mouse:

| Layout | Keys | Behavior |
|--------|------|----------|
| **Horizontal Text** | `↑` `↓` | Move to prev/next line |
| **Vertical Text** | `←` `→` | Move to prev/next line |
| **Either** | `Home` | Start of line |
| **Either** | `End` | End of line |

::: tip Smart Navigation
The editor detects text direction automatically. Arrow keys adapt to horizontal or vertical text blocks.
:::

### Text Manipulation

**Splitting Lines:**

- Position cursor where you want to split
- Press `Enter`
- Line splits into two separate lines
- Both lines remain in the same block

**Use Case:** Separating merged dialogue or sound effects.

**Merging Lines:**

- Place cursor at the **beginning** of a line
- Press `Backspace`
- Line merges with the previous line
- Text concatenates smoothly

**Use Case:** Combining incorrectly split text.

### Exiting Text Mode

**Return to Box Mode:**

- Click on empty space (no text box)
- Or start dragging a text box
- Or click the Edit Mode button

## 2. Box Edit Mode 📦

Adjust the position and size of text bounding boxes.

### Understanding Box Hierarchy

**Two Box Types:**

1. **Outer Box (Blue Border)**
   - Contains multiple text lines
   - Represents a speech bubble or text block
   - Moving it moves ALL inner lines together

2. **Inner Box (Red/Yellow Border)**
   - Individual text line
   - Can be moved independently
   - Resizing affects just that line

![Box hierarchy](/box-hierarchy-placeholder.svg)
*Blue outer block containing red inner lines*

### Moving Boxes

**Drag to Move:**

- **Click and drag** the center of a box
- **Blue box** - Entire block moves
- **Red/Yellow box** - Just that line moves
- Release to place

**Use Cases:**
- Aligning text with speech bubbles
- Repositioning misplaced OCR
- Organizing overlapping text

### Resizing Boxes

**8 Resize Handles:**

Each box has handles at:
- 4 corners (diagonal resize)
- 4 edges (horizontal/vertical resize)

**To Resize:**

1. Click and drag any handle
2. Box stretches in that direction
3. With Smart Resize ON: font auto-adjusts
4. Release when sized correctly

![Resizing a text block using handles](/using-box-edit-mode.webp)
*Drag handles to resize text boxes*

**Tips:**
- Corner handles maintain aspect ratio
- Edge handles stretch one dimension
- Smart Resize keeps text fitted
- Undo by manual resize or reload

### Quick Text Edit

**Double-Click Shortcut:**

- **Double-click any line** in Box mode
- Instantly switches to Text mode
- Cursor placed in clicked line
- No need to change modes manually

::: tip Workflow
Stay in Box mode for layout adjustments, double-click when you need to edit text content, then click away to return to Box mode. Fast and efficient!
:::

## 3. Smart Resize Mode ⭐

Automatically adjusts font size to fit text within boxes.

### How It Works

**Smart Resize:**
- Calculates optimal font size
- Fits text perfectly in its box
- Prevents overflow
- Maintains readability

**When It Activates:**

With Smart Resize enabled:
1. **After resizing** a box with handles
2. **After editing** text content
3. **When double-clicking** a line (manual trigger)

![Smart resize mode](/using-smart-edit-mode.webp)
*Font automatically adjusts to fill the box*

### When to Use It

**Recommended ON:**
- Most editing scenarios
- After fixing text errors
- When resizing boxes
- For consistent appearance

**Turn OFF when:**
- You want manual font control
- Preserving original sizes
- Fine-tuning specific lines

### Manual Trigger

Even in Read mode, you can trigger Smart Resize:

1. **Enable** Smart Resize button (⭐)
2. **Stay in Read mode** (don't activate editing)
3. **Double-click** any line
4. Font recalculates for that line
5. Useful for quick adjustments without full edit mode

## 4. Adding & Deleting Content

Create new text boxes or remove unwanted ones.

### Adding New Blocks

**Create Text Block:**

1. **Right-click** on empty space on the page
2. Select "**Add Block**" from menu
3. New blue block appears
4. Contains one empty line
5. Edit the text immediately

**Use Cases:**
- Adding missing text OCR didn't detect
- Creating labels or notes
- Filling gaps in scanned pages

### Adding Lines to Blocks

**Add Line to Existing Block:**

1. **Right-click** on a blue outer box
2. Select "**Add Line**"
3. New line appears in the block
4. Type the text content

**Use Cases:**
- Multi-line speech bubbles
- Sound effects with multiple parts
- Dialogue split across panels

### Deleting Lines

**Remove Line:**

1. **Right-click** on a line (red/yellow box)
2. Select "**Delete Line**"
3. Line is removed immediately
4. Remember to **Save** afterward

::: warning Auto-Delete Blocks
If you delete the **last line** in a block, the entire block (blue box) is automatically deleted.
:::

### Context Menu Options

**Right-Click Menu:**

| Target | Options Available |
|--------|-------------------|
| Empty space | Add Block |
| Blue block | Add Line, Re-order Lines |
| Line (red box) | Delete Line, Re-order Lines |

## 5. Re-ordering Lines

Fix the reading order of text for proper selection and copying.

### Why Line Order Matters

**Reading Order Affects:**
- Text selection flow
- Copy-paste order
- Screen reader output
- Export formats

**Common Issues:**
- Lines numbered wrong
- OCR detected in wrong order
- Vertical text confused with horizontal

### Using the Re-order Tool

1. **Right-click** any line in a block
2. Select "**Re-order Lines...**"
3. Modal window opens

![The re-order lines modal](/reorder-lines-modal.webp)
*Re-order lines interface*

4. **Use arrows** to move lines up/down
5. **Preview order** in the list
6. Click "**Close**" when satisfied
7. **Remember to Save!**

**Tips:**
- Test selection after re-ordering
- Drag-select text to verify flow
- Numbering shows current order
- Changes preview in real-time

## Saving Your Edits

### The Save Process

::: danger DO NOT FORGET TO SAVE
Edits are NOT auto-saved! Closing the reader, refreshing the page, or navigating away will **LOSE ALL CHANGES** unless you click Save first!
:::

**To Save:**

1. Click the **Save** button in the top toolbar
2. Server processes changes
3. Writes back to `.mokuro` files on disk
4. Success message appears
5. Edits now permanent

**What Gets Saved:**
- Text content changes
- Box positions and sizes
- Font size adjustments
- Line order modifications
- New blocks and deleted lines

### Save Best Practices

**When to Save:**
- After each significant edit
- Before navigating to another page
- Before closing the browser
- Periodically during long sessions
- Always before logging out

**Keyboard Shortcut:**
- `Ctrl+S` (Windows/Linux)
- `Cmd+S` (Mac)
- Works from any edit mode

### What Happens on Save

**Server-Side:**
1. Receives edited data
2. Validates changes
3. Backs up original (optional)
4. Writes to `.mokuro` file
5. Confirms success

**File Changes:**
- `.mokuro` JSON updated
- Images unchanged
- Edits available to all users
- Improvements permanent

## Advanced Techniques

### Batch Editing Workflow

**Efficient Multi-Page Editing:**

1. Open volume in reader
2. Enable Edit Mode
3. Turn ON Smart Resize
4. Edit pages sequentially:
   - Fix errors on page 1
   - Click Next
   - Fix errors on page 2
   - Continue...
5. **Save periodically** (every 10-20 pages)
6. Final save before closing

### Quality Control

**After Editing:**

- **Test Selection** - Try copying text
- **Check Order** - Verify line sequence
- **Visual Review** - Text fits well in boxes
- **Dictionary Test** - Paste into Jisho.org
- **Re-read** - Make sure it makes sense

### Keyboard Power User

**Efficient Shortcuts:**

| Action | Shortcut |
|--------|----------|
| Save edits | `Ctrl+S` |
| Exit edit mode | `Esc` |
| Toggle edit mode | `E` |
| Next page | `→` or `D` |
| Previous page | `←` or `A` |

**Workflow:**
1. `E` - Enter edit mode
2. Double-click line - Edit text
3. Click away - Return to Box mode
4. `Ctrl+S` - Save
5. `→` - Next page
6. Repeat

## Troubleshooting

### Common Issues

**Can't Click Text Boxes:**
- Ensure Edit Mode is active
- Check you're in Box or Text mode (not Read)
- Try refreshing the page

**Smart Resize Not Working:**
- Verify ⭐ button is highlighted
- Try toggling it off and on
- Manual resize might override it

**Changes Not Saving:**
- Check for error messages
- Verify server connection
- Ensure proper permissions
- Check disk space on server

**Text Doesn't Fit:**
- Enable Smart Resize
- Manually resize box larger
- Double-click to recalculate
- Split into multiple lines

### Performance Tips

**Smooth Editing:**
- Edit one page at a time
- Save frequently
- Close other browser tabs
- Use modern browser
- Don't over-zoom while editing

## Next Steps

- [Continue reading](/using-the-reader) with improved text
- [Customize reader settings](/reader-settings) for your workflow
- [Organize your library](/organizing-content) metadata
- [Adjust appearance](/appearance-settings) for comfort

## Related Pages

- [Using the Reader](/using-the-reader) - Reading interface guide
- [Reader Settings](/reader-settings) - Customize reading experience
- [Managing Your Library](/managing-your-library) - Upload and organize
- [Organizing Content](/organizing-content) - Metadata and tags
