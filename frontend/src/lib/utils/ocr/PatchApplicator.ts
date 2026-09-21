import type {
  PatchOperation,
  MokuroData,
  MokuroBlock,
  UnifiedBlock,
  UnifiedLine,
  Quad,
  Rect
} from '$lib/types';

export class PatchApplicator {
  /**
   * Applies a patch operation to the MokuroData object (mutates in place).
   * Validates indices before applying.
   *
   * @param data - The MokuroData object to modify
   * @param patch - The patch operation to apply
   * @throws Error if path/op is unsupported or indices are invalid
   */
  static apply(data: MokuroData, patch: PatchOperation): void {
    if (patch.op === 'genesis') {
      return;
    }

    const parts = patch.path.split('/').filter((x) => x);
    const op = patch.op;

    // Block Operations (/pages/p/blocks/...)
    if (parts[2] === 'blocks') {
      const pageIndex = parseInt(parts[1]);
      const page = data.pages[pageIndex];
      if (!page) {
        throw new Error(`Invalid page index ${pageIndex}: only ${data.pages.length} pages exist`);
      }

      // Reorder Blocks (/pages/0/blocks)
      if (parts.length === 3 && op === 'reorder') {
        if (!patch.new_order) {
          throw new Error(`Reorder operation missing new_order`);
        }
        if (patch.new_order.length !== page.blocks.length) {
          throw new Error(
            `Reorder length mismatch: new_order has ${patch.new_order.length} elements, but page has ${page.blocks.length} blocks`
          );
        }
        this.reorderArray(page.blocks, patch.new_order);
        return;
      }

      const blockIndexRaw = parts[3];

      // Block Add/Remove (/pages/0/blocks/- or /pages/0/blocks/1)
      if (parts.length === 4) {
        if (op === 'add') {
          if (!patch.value) {
            throw new Error(`Add operation missing value`);
          }
          const nativeBlock = this.unifiedToNativeBlock(patch.value as UnifiedBlock);
          if (blockIndexRaw === '-') {
            page.blocks.push(nativeBlock);
          } else {
            const blockIndex = parseInt(blockIndexRaw);
            if (blockIndex < 0 || blockIndex > page.blocks.length) {
              throw new Error(
                `Invalid block insert index ${blockIndex}: page has ${page.blocks.length} blocks`
              );
            }
            page.blocks.splice(blockIndex, 0, nativeBlock);
          }
          return;
        }

        if (op === 'remove') {
          const blockIndex = parseInt(blockIndexRaw);
          if (blockIndex < 0 || blockIndex >= page.blocks.length) {
            throw new Error(
              `Invalid block index ${blockIndex}: page has ${page.blocks.length} blocks`
            );
          }
          page.blocks.splice(blockIndex, 1);
          return;
        }
      }

      const blockIndex = parseInt(blockIndexRaw);
      if (blockIndex < 0 || blockIndex >= page.blocks.length) {
        throw new Error(`Invalid block index ${blockIndex}: page has ${page.blocks.length} blocks`);
      }
      const block = page.blocks[blockIndex];
      const property = parts[4];

      // Line Operations (/pages/0/blocks/1/lines/...)
      if (property === 'lines') {
        const lineIndexRaw = parts[5];

        // Reorder Lines
        if (!lineIndexRaw && op === 'reorder') {
          if (!patch.new_order) {
            throw new Error(`Reorder operation missing new_order`);
          }
          if (patch.new_order.length !== block.lines.length) {
            throw new Error(
              `Reorder length mismatch: new_order has ${patch.new_order.length} elements, but block has ${block.lines.length} lines`
            );
          }
          this.reorderParallel(block.lines, block.lines_coords, patch.new_order);
          return;
        }

        if (lineIndexRaw) {
          // Add Line
          if (op === 'add') {
            if (!patch.value) {
              throw new Error(`Add operation missing value`);
            }
            const val = patch.value as UnifiedLine;
            if (lineIndexRaw === '-') {
              block.lines.push(val.text);
              block.lines_coords.push(val.coords);
            } else {
              const lineIndex = parseInt(lineIndexRaw);
              if (lineIndex < 0 || lineIndex > block.lines.length) {
                throw new Error(
                  `Invalid line insert index ${lineIndex}: block has ${block.lines.length} lines`
                );
              }
              block.lines.splice(lineIndex, 0, val.text);
              block.lines_coords.splice(lineIndex, 0, val.coords);
            }
            return;
          }

          // Remove Line
          if (op === 'remove') {
            const lineIndex = parseInt(lineIndexRaw);
            if (lineIndex < 0 || lineIndex >= block.lines.length) {
              throw new Error(
                `Invalid line index ${lineIndex}: block has ${block.lines.length} lines`
              );
            }
            block.lines.splice(lineIndex, 1);
            block.lines_coords.splice(lineIndex, 1);
            return;
          }

          // Line Properties (Text/Coords)
          const subProp = parts[6];
          if (op === 'replace') {
            const lineIndex = parseInt(lineIndexRaw);
            if (lineIndex < 0 || lineIndex >= block.lines.length) {
              throw new Error(
                `Invalid line index ${lineIndex}: block has ${block.lines.length} lines`
              );
            }
            if (patch.value === undefined) {
              throw new Error(`Replace operation missing value`);
            }
            if (subProp === 'text') {
              block.lines[lineIndex] = patch.value as string;
              return;
            }
            if (subProp === 'coords') {
              block.lines_coords[lineIndex] = patch.value as Quad;
              return;
            }
          }
        }
      }

      // Block Properties (box, vertical, font_size)
      if (op === 'replace') {
        if (patch.value === undefined) {
          throw new Error(`Replace operation missing value`);
        }
        if (property === 'box') {
          block.box = patch.value as Rect;
          return;
        }
        if (property === 'vertical') {
          block.vertical = patch.value as boolean;
          return;
        }
        if (property === 'font_size') {
          block.font_size = patch.value as number;
          return;
        }
      }
    }

    throw new Error(`Unsupported path or op: ${patch.op} ${patch.path}`);
  }

  /**
   * Applies multiple patches in sequence.
   */
  static applyAll(data: MokuroData, patches: PatchOperation[]): void {
    for (const patch of patches) {
      this.apply(data, patch);
    }
  }

  // --- Conversion Helpers ---

  /** Convert UnifiedBlock to native storage format */
  static unifiedToNativeBlock(u: UnifiedBlock): MokuroBlock {
    return {
      box: u.box,
      vertical: u.vertical,
      font_size: u.font_size,
      lines: u.lines.map((l) => l.text),
      lines_coords: u.lines.map((l) => l.coords)
    };
  }

  /** Convert UnifiedBlock to native storage format */
  static nativeBlockToUnified(block: MokuroBlock): UnifiedBlock {
    return {
      box: block.box,
      vertical: block.vertical ?? false,
      font_size: block.font_size,
      lines: block.lines.map((text, i) => ({
        text: text,
        coords: block.lines_coords[i]
      }))
    };
  }

  // --- Reorder Helpers ---

  /** Permute a single array in place */
  private static reorderArray<T>(arr: T[], order: number[]): void {
    const temp = [...arr];
    for (let i = 0; i < order.length; i++) {
      arr[i] = temp[order[i]];
    }
  }

  /** Permute two arrays simultaneously (for lines + lines_coords) */
  private static reorderParallel<T, U>(arr1: T[], arr2: U[], order: number[]): void {
    const temp1 = [...arr1];
    const temp2 = [...arr2];
    for (let i = 0; i < order.length; i++) {
      arr1[i] = temp1[order[i]];
      arr2[i] = temp2[order[i]];
    }
  }
}
