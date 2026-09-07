import 'react';

declare module 'react' {
  interface MouseEvent<T = Element, E = NativeMouseEvent> {
    /** Optional compatibility probe used by the Wireframe canvas pointer guard. */
    readonly spaceKey?: boolean;
  }
}
