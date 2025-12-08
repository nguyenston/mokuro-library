# Editing OCR Text

One of Mokuro Library's core features is the ability to correct OCR text and save your changes directly back to the `.mokuro` files on your server.

:::tip IMPORTANT
Your changes are **not** saved automatically. You must click the **Save** button in the top toolbar to make your edits permanent.
:::

## The Editing Buttons

To begin, click on one of the editing buttons in the header (next to the settings button).

![The OCR editing buttons](/editing-buttons.webp)

* **Text Edit Mode:** Allows you to change the text content inside a line.
* **Box Edit Mode:** Allows you to move and resize text blocks and lines.
* **Smart Resize:** An optional mode that automatically adjusts font size to fit the text inside its box.

These modes are mutually exclusive (except for Smart Resize, which can be combined with the other two).

## 1. Text Edit Mode

When this mode is active:
* Click on any line of text to place your cursor and begin typing.
* Pressing `Enter` in the middle of a line will split it into two new lines.
* Pressing `Backspace` in the beginning of a line will merge it into the previous line.
* Use your arrow keys to navigate between adjacent lines.
    * **Horizontal Blocks:** Use `ArrowUp` and `ArrowDown`.
    * **Vertical Blocks:** Use `ArrowLeft` and `ArrowRight`.

![Editing text inside a line](/text-edit-mode.webp)

## 2. Box Edit Mode

When this mode is active, you can manipulate the bounding boxes.

* **Move:** Click and drag the body of a box to move it.
    * **Outer Box (Blue):** Drags the entire block (including all lines inside it).
    * **Inner Box (Yellow):** Drags just that specific line.
* **Resize:** Click and drag the 8 handles on any box to resize it.

![Resizing a text block using handles](/box-edit-mode.webp)

## 3. Smart Resize Mode

This is a powerful helper mode that **automatically adjusts font size to fit text within its bounding box**.

You can activate this *at the same time* as the other modes. It will automatically run when you:
1.  Dragging one of the resize handles.
2.  Typing in a text box.

You can also manually trigger it by activating **only** Smart Resize Mode (with the other two modes off) and double-clicking a line.

## 4. Adding & Deleting Content

You can add and delete blocks using the right-click context menu.

* **Add New Block:** In **Box Edit Mode**, right-click on an empty area of the page and select "Add Block".
* **Add New Line:** In **Box Edit Mode**, right-click on an existing block (the blue box) and select "Add Line".
* **Delete Line:** Right-click on any line and select "Delete Line".
    * *Note: If you delete the **last** line in a block, the entire block will be deleted*.

## 5. Re-ordering Lines

The order of lines is important for text selection and copying. If the default order is incorrect, you can change it.

1.  Right-click any line.
2.  Select "Re-order Lines...".
3.  A modal will appear. Use the "Up" and "Down" arrows to change the line order, then click "Close".
4.  Remember to click **Save** in the toolbar to keep your new order.

![The re-order lines modal](/reorder-lines-modal.webp)
