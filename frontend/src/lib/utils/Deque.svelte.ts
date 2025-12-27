/**
 * Dumb Deque implementation. 
 * Future optimization: Replace internal array with Ring Buffer or Doubly Linked List.
 */
export class Deque<T> {
  // Using $state for internal storage ensures Svelte 5 reactivity when methods mutate it.
  private _data = $state<T[]>([]);

  pushBack(item: T) {
    this._data.push(item);
  }

  pushFront(item: T) {
    this._data.unshift(item); // O(N), but acceptable for "dumb" v1
  }

  popBack(): T | undefined {
    return this._data.pop();
  }

  popFront(): T | undefined {
    return this._data.shift(); // O(N)
  }

  peekFront(): T | undefined {
    return this._data[0];
  }

  get size() {
    return this._data.length;
  }

  get items() {
    return this._data;
  }

  // Helper to get all items as an array snapshot
  toArray(): T[] {
    return [...this._data];
  }

  clear() {
    this._data = [];
  }
}
