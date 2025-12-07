# Technical Documentation: OCR Overlay Architecture

## 1. Overview
The OCR Overlay is a specialized rendering layer superimposed over the manga image. It serves two distinct purposes:
1.  **Reader View:** Displays high-quality, selectable text overlaying the raw image (for translation tools like Yomi-tan).
2.  **Editor View:** A full-featured WYSIWYG editor for correcting OCR errors, adjusting bounding boxes, and reflowing text.

To manage the complexity of "edit-in-place" interactions and deep component trees, the system is architected using a **Composition Pattern** backed by a dedicated **State Class**. This decouples coordinate math, application state, and DOM rendering.

## 2. Component Hierarchy & File Structure

```text
src/lib/
├── states/
│   └── OcrState.svelte.ts       # (State) Global Context & Reactivity
├── utils/
│   └── ocrMath.ts               # (Logic) Pure Math & String Processing
└── components/
    └── ocr/
        ├── OcrOverlay.svelte    # (Root) Canvas & State Initializer
        ├── OcrBlock.svelte      # (Child) Logical Text Block Group
        ├── OcrLine.svelte       # (Leaf) Individual Text Line
        └── ResizeHandles.svelte # (UI) Reusable Drag Handles
```

## 3. State Management (`OcrState`)
**Role:** The single source of truth for the overlay's environment. It encapsulates "World State" to prevent prop drilling.
* **Responsibility:**
    * **Context Holder:** Stores references to the `page` data, `panzoomInstance`, and the root `overlayElement`.
    * **Mode Flags:** Manages boolean flags for `isEditMode`, `isBoxEditMode`, `isSmartResizeMode`, etc.
    * **Sticky Focus:** Tracks `focusedBlock` to ensure the editing UI remains visible even when interacting with external tools (like sliders or menus).
    * **Derived Calculations:** Automatically calculates `fontScale` based on the current DOM dimensions and zoom level.
    * **Action Dispatch:** Exposes methods like `markDirty()` and `setFocus()` to abstract callback propagation.

## 4. Component Responsibilities

### 4.1. `OcrOverlay.svelte` (The Canvas)
**Role:** The entry point that initializes the `OcrState` class and maps the coordinate system to the image.
* **Responsibility:**
    * **State Injection:** Instantiates `new OcrState(...)` and syncs props via `$effect`.
    * **CRUD Operations:** Handles **Create Block** (heuristic 15% viewport size) and **Delete Block**.
    * **Global Events:** Handles clicks on the "empty" background to clear focus or selection.

### 4.2. `OcrBlock.svelte` (The Layout Group)
**Role:** Represents the "Green Box" — a logical grouping of vertical or horizontal lines. It acts as the **Command Executor** for its children.
* **Responsibility:**
    * **Positioning:** Calculates CSS percentages relative to the parent image dimensions.
    * **Direct Mutation (Resize):** Uses direct data mutation during block resizing to ensure child lines (positioned by %) stay visually anchored to the text.
    * **Structure Mutation:** Owns the `block.lines` array. Handles requests to **Split**, **Merge**, or **Re-order** lines.
    * **Focus Manager:** Listens for navigation requests (`Arrow Keys`) from children and moves focus to the appropriate sibling line.
    * **Style:** Applies `.vertical-text` to the container to ensure correct flow inheritance for Reader Mode.

### 4.3. `OcrLine.svelte` (The Content Unit)
**Role:** Represents the "Red Box" — the actual text content. It acts as a **Client** that requests changes from the parent.
* **Responsibility:**
    * **Unidirectional Data Flow:** Does **not** bind directly to `block`. Instead, it emits callbacks (`onLineChange`, `onCoordsChange`) to request updates.
    * **Local State:** Maintains local proxies (`localText`, `currentCoords`) to ensure cursor stability and smooth interactions.
    * **Performance Patterns:**
        * **Drag:** Uses **Transform-to-Commit** (updates `style.transform` during drag, commits data on drop).
        * **Resize:** Uses **Style-to-Commit** (updates `style.left/top/w/h` during drag, commits data on drop).
    * **Measurement:** Binds a specific `textElement` (inner div) separate from the wrapper to ensure the **Smart Resize** algorithm measures text content accurately.
    * **Clipboard:** Manually handles Cut/Paste events to support custom splitting/merging logic.

### 4.4. `ResizeHandles.svelte` (UI Component)
**Role:** A pure presentation component.
* **Responsibility:** Renders the 8 control points (corners + edges) with standardized logic for cursor styles and positioning.

## 5. Data Flow & Reactivity

The system leverages Svelte 5's **Runes** (`.svelte.ts` classes) for deep reactivity.

1.  **State Initialization:**
    `OcrOverlay` creates the `OcrState` instance. This instance is passed down as a single prop (`ocrState`) to all children.

2.  **Event-Driven Updates (Callback Pattern):**
    Unlike simple bindings, `OcrLine` uses explicit callbacks to enforce ownership.
    * **User Action:** User drags a line.
    * **Local Update:** `OcrLine` updates its own DOM transform (visual feedback).
    * **Commit:** On `mouseup`, `OcrLine` calculates new coordinates and fires `onCoordsChange(newCoords)`.
    * **Mutation:** `OcrBlock` receives the event and mutates `block.lines_coords[i]`.
    * **Reactivity:** Svelte detects the mutation in the proxy and updates the UI.
    * **Persistence:** `ocrState.markDirty()` is called to notify the save system.

## 6. Logic Separation (Utils)

Complex mathematics and DOM measurements are strictly separated from UI components.

* **`src/lib/utils/ocrMath.ts`**:
    * `getRelativeCoords(...)`: Converts mouse pixels to image pixels.
    * `getDeltas(...)`: Calculates movement vectors adjusted for zoom.
    * `smartResizeFont(block, element, ...)`: Pure binary search algorithm that finds the optimal font size to fit text within a box.
    * `ligaturize(...)`: String processing for vertical text display.
