/**
 * Permutation Logic
 * Convention: Source Map
 * P[i] = k means "The element at new index i comes from old index k"
 * new_list[i] = old_list[P[i]]
 */
export class Permutation {
  /**
   * Composes two permutations.
   * Result acts as if we applied 'inner' first, then 'outer'.
   * result[i] = outer[inner[i]]
   * Notation: outer * inner (or outer ∘ inner)
   */
  static compose(outer: number[], inner: number[]): number[] {
    if (outer.length !== inner.length) {
      throw new Error('Permutation length mismatch during composition');
    }
    const result = new Array(outer.length);
    for (let i = 0; i < inner.length; i++) {
      result[i] = outer[inner[i]];
    }
    return result;
  }

  /**
   * Inverts a permutation.
   * If P maps "New Index -> Old Source", Inv(P) maps "Old Index -> New Destination"
   * Note: The result is technically a Target Map, but if treated as a Source Map
   * for the reverse operation, it restores the original order.
   */
  static invert(p: number[]): number[] {
    const result = new Array(p.length);
    for (let i = 0; i < p.length; i++) {
      const sourceIndex = p[i];
      result[sourceIndex] = i;
    }
    return result;
  }

  /**
   * Given a permutation encoded as New → Old, returns the new index
   * corresponding to a given old index.
   */
  static mapIndex(sourceMap: number[], oldIndex: number): number {
    // A source map tells us: "At new index 0, we have old index P[0]"
    // We need to find 'i' such that P[i] == oldIndex
    const newIndex = sourceMap.indexOf(oldIndex);
    return newIndex; // Returns -1 if index is gone (though strict permutations shouldn't delete)
  }

  /**
   * Expands a source-map permutation when a new element is inserted.
   * insertIndex is the insertion position in the pre-permute list (0..length).
   * The new element is coupled with its adjacent element, permuted as a slot,
   * then decoupled to produce the expanded permutation.
   */
  static expandPermutation(
    sourceMap: number[],
    insertIndex: number
  ): number[] {
    const length = sourceMap.length;
    if (insertIndex < 0 || insertIndex > length) {
      throw new Error(`Invalid insertIndex ${insertIndex} for permutation length ${length}`);
    }

    const pairStart = insertIndex === 0
      ? 0
      : Math.min(insertIndex - 1, length - 1);
    const pair: [number, number] = [pairStart, pairStart + 1];

    const slots: Array<number | [number, number]> = new Array(length);
    for (let i = 0; i < length; i++) {
      if (i === pairStart) {
        slots[i] = pair;
      } else {
        slots[i] = i < pairStart ? i : i + 1;
      }
    }

    const permutedSlots: Array<number | [number, number]> = new Array(length);
    for (let i = 0; i < length; i++) {
      permutedSlots[i] = slots[sourceMap[i]];
    }

    const expanded: number[] = [];
    for (const slot of permutedSlots) {
      if (Array.isArray(slot)) {
        expanded.push(slot[0], slot[1]);
      } else {
        expanded.push(slot);
      }
    }
    return expanded;
  }

  /**
   * Shrinks a source-map permutation when an element is removed.
   * removeIndex is the index in the pre-permute list (0..length-1).
   */
  static shrinkPermutation(sourceMap: number[], removeIndex: number): number[] {
    const length = sourceMap.length;
    if (removeIndex < 0 || removeIndex >= length) {
      throw new Error(`Invalid removeIndex ${removeIndex} for permutation length ${length}`);
    }

    const removedAt = this.mapIndex(sourceMap, removeIndex);
    if (removedAt === -1) {
      throw new Error(`Failed to locate removeIndex ${removeIndex} in permutation`);
    }

    const shrunk: number[] = [];
    for (let i = 0; i < sourceMap.length; i++) {
      if (i === removedAt) continue;
      const value = sourceMap[i];
      shrunk.push(value > removeIndex ? value - 1 : value);
    }

    return shrunk;
  }
}

/**
 * JSON Pointer Utilities (RFC 6901 style)
 */
export class PathUtils {
  static parse(path: string): string[] {
    if (path === '' || path === '/') return [];
    // Remove leading slash and split
    return path.substring(1).split('/');
  }

  static compile(segments: string[]): string {
    if (segments.length === 0) return '/';
    return '/' + segments.join('/');
  }

  /**
   * Checks if 'child' is strictly a descendant of 'parent'.
   * e.g. parent="/a", child="/a/b" -> true
   */
  static isDescendant(child: string, parent: string): boolean {
    if (parent === '/') return child !== '/';
    if (!child.startsWith(parent + '/')) return false;
    return true;
  }

  /**
   * Checks if 'child' is a descendant OR the same path as 'parent'.
   */
  static isDescendantOrSelf(child: string, parent: string): boolean {
    if (child === parent) return true;
    return this.isDescendant(child, parent);
  }

  /**
   * Gets the relative path segments from parent to child.
   * Throws if not related.
   */
  static getRelativeSegments(child: string, parent: string): string[] {
    if (child === parent) return [];
    if (!this.isDescendant(child, parent)) {
      throw new Error(`Path '${child}' is not a descendant of '${parent}'`);
    }

    // parent="/" -> child="/a/b" -> suffix="a/b"
    // parent="/a" -> child="/a/b" -> suffix="b"
    const prefixLen = parent === '/' ? 1 : parent.length + 1;
    const suffix = child.substring(prefixLen);
    return suffix.split('/');
  }
}
