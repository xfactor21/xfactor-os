import { useEffect } from 'react';

/**
 * Professional canvas navigation for Draw/Paint without coupling the paint
 * engine to the outer Design Lab shell.
 *
 * Space + drag pans the scrollable canvas, matching the muscle memory of
 * Photoshop/Figma-style creative tools. The hook is intentionally dormant
 * unless Draw/Paint is mounted.
 */
export function useDrawPaintNavigation() {
  useEffect(() => {
    let spaceHeld = false;
    let dragging = false;
    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let previousCursor = '';

    function drawRoot() {
      return document.querySelector<HTMLElement>('#dpRoot');
    }

    function scrollSurface() {
      return drawRoot()?.querySelector<HTMLElement>('#dpCanvasScroll') ?? null;
    }

    function setCursor(active: boolean) {
      const surface = scrollSurface();
      if (!surface) return;
      if (active) {
        if (!previousCursor) previousCursor = surface.style.cursor;
        surface.style.cursor = dragging ? 'grabbing' : 'grab';
      } else {
        surface.style.cursor = previousCursor;
        previousCursor = '';
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat) return;
      if (!drawRoot()) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      spaceHeld = true;
      setCursor(true);
      event.preventDefault();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space') return;
      spaceHeld = false;
      if (!dragging) setCursor(false);
    }

    function onPointerDown(event: PointerEvent) {
      if (!spaceHeld || event.button !== 0) return;
      const surface = scrollSurface();
      if (!surface || !surface.contains(event.target as Node)) return;
      dragging = true;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      setCursor(true);
      surface.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    }

    function onPointerMove(event: PointerEvent) {
      if (!dragging || pointerId !== event.pointerId) return;
      const surface = scrollSurface();
      if (!surface) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      surface.scrollLeft -= dx;
      surface.scrollTop -= dy;
      event.preventDefault();
    }

    function finishPointer(event?: PointerEvent) {
      if (!dragging) return;
      const surface = scrollSurface();
      if (surface && pointerId !== null) {
        try { surface.releasePointerCapture?.(pointerId); } catch { /* capture may already be released */ }
      }
      dragging = false;
      pointerId = null;
      if (spaceHeld) setCursor(true);
      else setCursor(false);
      event?.preventDefault();
    }

    function onBlur() {
      spaceHeld = false;
      dragging = false;
      pointerId = null;
      setCursor(false);
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('pointerup', finishPointer, { capture: true });
    window.addEventListener('pointercancel', finishPointer, { capture: true });
    window.addEventListener('blur', onBlur);

    return () => {
      setCursor(false);
      window.removeEventListener('keydown', onKeyDown, { capture: true } as EventListenerOptions);
      window.removeEventListener('keyup', onKeyUp, { capture: true } as EventListenerOptions);
      window.removeEventListener('pointerdown', onPointerDown, { capture: true } as EventListenerOptions);
      window.removeEventListener('pointermove', onPointerMove, { capture: true } as EventListenerOptions);
      window.removeEventListener('pointerup', finishPointer, { capture: true } as EventListenerOptions);
      window.removeEventListener('pointercancel', finishPointer, { capture: true } as EventListenerOptions);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
