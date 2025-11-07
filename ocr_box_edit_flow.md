# OCR Box Editing Flow Documentation

This document outlines the detailed technical flow for implementing drag, resize, and context menu functionality within the Mokuro OCR editor, along with the necessary DOM and state manipulation techniques required for stability in a reactive Svelte environment.

---

## Explanation of Flow for dragging boxes

1.  **User Enters Mode:**
    * The user clicks the **Box Edit Mode** toggle in the header, setting `isBoxEditMode = true` and `isEditMode = false` (modes are mutually exclusive).

2.  **Viewport Locks:**
    * An `$effect` in `volume/[id]/+page.svelte` detects the state change.
    * It calls `panzoomInstance.reset()` and `panzoomInstance.setOptions({ disablePan: true, disableZoom: true })` to establish a fixed coordinate system.

3.  **User Drags Box (Interaction Logic)**
    * When `isBoxEditMode` is `true`, two distinct drag interactions are possible:

    **3.1. Dragging the Entire Block (Outer Container):**
    * The `onmousedown` event on the outer `div.group/block` initiates the drag (`handleBlockDragStart`).
    * **Visual Drag:** CSS `transform: translate()` is used for smooth, jank-free visual movement.
    * **Data Update (`onDragEnd`):**
        1.  The CSS `transform` is reset.
        2.  The **total accumulated image delta** is applied **once** to all four coordinates in the **`block.box`** array.
        3.  The same delta is applied to all eight coordinates in the **`block.lines_coords`** array for every associated line (since line coordinates are absolute, they must be moved with the block).
        4.  `onOcrChange()` is called.

    **3.2. Dragging an Individual Line (Inner Div):**
    * The `onmousedown` event on the inner line `div.group/line` initiates the drag (`handleLineDragStart`).
    * It calls `event.stopPropagation()` to prevent the outer block drag (3.1).
    * **Visual Drag:** CSS `transform` is used on the line's element.
    * **Data Update (`onDragEnd`):**
        1.  The CSS `transform` is reset.
        2.  The **total accumulated image delta** is applied **once** only to the eight coordinates in `block.lines_coords[i]` for that specific line.
        3.  `onOcrChange()` is called.

---

## Explanation of Flow for resizing boxes

1.  **UI Elements (Resize Handles):**
    * **Outer Block:** 8 blue handles are children of `div.group/block`. Visibility is toggled via `group-hover/block:opacity-100` OR when interacting with the focused block's slider (`isSliderInteracting` or `isSliderHovered`).
    * **Inner Line:** 8 yellow handles are children of `div.group/line`. Visibility is toggled via `group-hover/line:opacity-100`.
    * **Accessibility:** All handles have `role="button"`.

2.  **Outer Block Resize Logic (`handleResizeStart`):**
    * Triggered by `onmousedown` on the blue handles.
    * The logic directly modifies the coordinates in the **`block.box`** array based on the handle type (e.g., `top-left` modifies `x_min` and `y_min`).
    * The inner `lines_coords` are **not** modified, as they maintain their independent absolute coordinates.

3.  **Inner Line Resize Logic (`handleLineResizeStart`):**
    * Triggered by `onmousedown` on the yellow handles.
    * The logic directly modifies the 4 sets of `[x, y]` pairs (8 total coordinates) in the **`block.lines_coords[i]`** array based on the handle type.
    * The outer `block.box` remains unmodified.

4.  **Completion:** Both resizing actions update state in real-time (no transform needed) and call `onOcrChange()` on `mouseup` to trigger persistence mechanisms.

---

## Explanation of Flow for Creating, Deleting, and Text Editing

1.  **Context Menu Activation:**
    * **Flow: Create Block (Right-click on Empty Overlay)**
        * An `oncontextmenu` handler is attached to the `overlayRootElement` (the top-level `div` in `OcrOverlay.svelte`).
        * It only fires if `isBoxEditMode` is `true`.
        * It must check `e.target === e.currentTarget` to ensure the click was on the empty background, not an existing block.
        * It calls `contextMenu.open` with an "Add Block" option.
        * The `createNewBlock` action will:
            1.  Calculate the `[x, y]` click position in absolute image coordinates.
            2.  Create a new `MokuroBlock` object.
            3.  Define a default `block.box` (e.g., 100x100) centered at the click.
            4.  Define a default first line (`lines: ['New Text']`) and `lines_coords` (e.g., 80x20) positioned inside the new `block.box`.
            5.  Push this new `MokuroBlock` object to the `page.blocks` array (which is a reference to `mokuroData.pages[i].blocks`).
            6.  Call `onOcrChange()` and `handleSave()` to persist this structural change.
    * **Flow: Create Line (Right-click on Block)**
        * The `oncontextmenu` handler on the *outer block* (`div.group/block`) fires only if `isBoxEditMode` is `true`.
        * It calls `openBlockContextMenu(event, block)`.
        * This function shows the menu with one option: `[{ label: "Add Line", action: ... }]`.
        * The `createNewLine` action adds a new line/line_coords entry to the *cloned* block, replaces the block in the parent array, and calls `onOcrChange()` and `handleSave()`.
    * **Flow: Line Context Menu (Right-click on Line)**
        * The `oncontextmenu` handler on the *inner line* (`div.group/line`) calls `openLineContextMenu(event, block, lineIndex)`.
        * It builds an `options` array based on the current mode:
            * If `isEditMode` is true: Shows text options (Cut, Copy, Paste, Toggle Vertical, Set Font Size).
            * If `isBoxEditMode` or `isEditMode` is true: Shows the "Delete Line" option.
        * It calls `contextMenu.open(event.clientX, event.clientY, options)`.

2.  **DOM Stability (Double-Wrap):**
    * The text content is contained in a nested inner `div` (`contenteditable="true"`), separate from the outer `div` that handles drag/resize events. This isolates the structural bindings from the browser's rich-text engine.

3.  **Font Size Slider (Toolbar):**
    * The font slider is visible in the header only when `isEditMode` is true and a line is focused (`focusedBlock !== null`).
    * **Focus Fix:** The slider container uses `onpointerdown`/`onpointerup` to set `isSliderInteracting`. The line element's `onblur` handler checks `!isSliderInteracting` before calling the de-focus callback (`onLineFocus(null)`), preventing the slider interaction from unintentionally blurring the text field.

4.  **Action Functions (`OcrOverlay.svelte`):**
    * **`deleteLine(block, lineIndex)`:**
        * **CRITICAL:** This function now checks `if (block.lines.length === 1)`.
        * If `true` (it's the last line), it calls a new `deleteBlock(block)` function.
        * If `false`, it proceeds with the existing logic: clone the block, `splice` the line/line_coords from the *cloned* block, replace the block, and save.
    * **`deleteBlock(block)`:**
        * Finds the index of the `block` in the `page.blocks` array.
        * Calls `page.blocks.splice(index, 1)` to remove the entire block.
        * Calls `onOcrChange()` and `handleSave()` to persist this structural change.