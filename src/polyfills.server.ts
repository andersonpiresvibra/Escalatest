/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/consistent-indexed-object-style */
/* eslint-disable @typescript-eslint/no-empty-function */

// Server-side polyfills for Node.js environment during SSR and prerendering
if (typeof globalThis !== 'undefined') {
  // Polyfill DOMMatrix
  if (!(globalThis as any).DOMMatrix) {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor() {}
    };
  }

  // Polyfill localStorage and sessionStorage
  class MockStorage {
    private data: Record<string, string> = {};
    getItem(key: string): string | null {
      return this.data[key] || null;
    }
    setItem(key: string, value: string): void {
      this.data[key] = value;
    }
    removeItem(key: string): void {
      delete this.data[key];
    }
    clear(): void {
      this.data = {};
    }
    get length(): number {
      return Object.keys(this.data).length;
    }
    key(index: number): string | null {
      return Object.keys(this.data)[index] || null;
    }
  }

  if (!(globalThis as any).localStorage) {
    (globalThis as any).localStorage = new MockStorage();
  }
  if (!(globalThis as any).sessionStorage) {
    (globalThis as any).sessionStorage = new MockStorage();
  }
}
