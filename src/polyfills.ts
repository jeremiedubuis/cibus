// Global polyfills for Hermes JS engine in React Native

if (typeof globalThis !== 'undefined' && typeof (globalThis as any).window === 'undefined') {
  try {
    Object.defineProperty(globalThis, 'window', {
      value: globalThis,
      writable: true,
      configurable: true,
    });
  } catch (e) {
    (globalThis as any).window = globalThis;
  }
}

if (typeof global !== 'undefined' && typeof (global as any).window === 'undefined') {
  try {
    Object.defineProperty(global, 'window', {
      value: global,
      writable: true,
      configurable: true,
    });
  } catch (e) {
    (global as any).window = global;
  }
}

if (typeof globalThis.DOMRectReadOnly === 'undefined') {
  const DOMRectReadOnlyPolyfill = function (this: any, x?: number, y?: number, width?: number, height?: number) {
    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
    this.width = Number(width) || 0;
    this.height = Number(height) || 0;
    this.top = this.y;
    this.right = this.x + this.width;
    this.bottom = this.y + this.height;
    this.left = this.x;
  } as any;

  DOMRectReadOnlyPolyfill.fromRect = function (r: any) {
    return new DOMRectReadOnlyPolyfill(r ? r.x : 0, r ? r.y : 0, r ? r.width : 0, r ? r.height : 0);
  };

  const DOMRectPolyfill = function (this: any, x?: number, y?: number, width?: number, height?: number) {
    DOMRectReadOnlyPolyfill.call(this, x, y, width, height);
  } as any;

  DOMRectPolyfill.prototype = Object.create(DOMRectReadOnlyPolyfill.prototype);
  DOMRectPolyfill.prototype.constructor = DOMRectPolyfill;

  try {
    Object.defineProperty(globalThis, 'DOMRectReadOnly', { value: DOMRectReadOnlyPolyfill, writable: true, configurable: true });
    Object.defineProperty(globalThis, 'DOMRect', { value: DOMRectPolyfill, writable: true, configurable: true });
  } catch (e) {}

  if (typeof global !== 'undefined') {
    try {
      Object.defineProperty(global, 'DOMRectReadOnly', { value: DOMRectReadOnlyPolyfill, writable: true, configurable: true });
      Object.defineProperty(global, 'DOMRect', { value: DOMRectPolyfill, writable: true, configurable: true });
    } catch (e) {}
  }
}
