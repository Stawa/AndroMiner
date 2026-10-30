import type { Ref } from 'vue';

interface SwipeStart {
  id: number;
  x: number;
  y: number;
  scrollY: number;
  time: number;
  page: string;
}

export function usePageSwipe<T extends string>(
  pages: readonly T[],
  current: Ref<T>,
  enabled: () => boolean
) {
  let start: SwipeStart | null = null;
  const cancel = () => {
    start = null;
  };
  const blocked = () => !enabled() || Boolean(document.querySelector('[aria-modal="true"]'));
  const interactive = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return true;
    if (
      target.closest(
        'button, a, input, textarea, select, label, summary, canvas, [contenteditable], [role="slider"], [data-swipe-ignore], .terminal'
      )
    )
      return true;
    for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(el).overflowX))
        return true;
    }
    return false;
  };
  const onTouchStart = (event: TouchEvent) => {
    cancel();
    if (
      event.touches.length !== 1 ||
      blocked() ||
      !pages.includes(current.value) ||
      interactive(event.target)
    )
      return;
    const touch = event.touches[0]!;
    // Keep Android's edge gestures available to the operating system.
    if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
    if (window.getSelection()?.isCollapsed === false) return;
    start = {
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      scrollY: window.scrollY,
      time: performance.now(),
      page: current.value
    };
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!start) return;
    if (event.touches.length !== 1) {
      cancel();
      return;
    }
    const touch = event.touches[0]!;
    const dx = Math.abs(touch.clientX - start.x);
    const dy = Math.abs(touch.clientY - start.y);
    if (dy > 24 && dy > dx) cancel();
  };
  const onTouchEnd = (event: TouchEvent) => {
    const gesture = start;
    cancel();
    if (!gesture || blocked() || event.touches.length || gesture.page !== current.value) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === gesture.id);
    if (
      !touch ||
      performance.now() - gesture.time > 700 ||
      Math.abs(window.scrollY - gesture.scrollY) > 12 ||
      window.getSelection()?.isCollapsed === false
    )
      return;
    const dx = touch.clientX - gesture.x;
    const dy = Math.abs(touch.clientY - gesture.y);
    if (Math.abs(dx) < 72 || dy > 56 || Math.abs(dx) < dy * 1.8) return;
    const next = pages[pages.indexOf(current.value) + (dx < 0 ? 1 : -1)];
    if (next) current.value = next;
  };
  return { onTouchStart, onTouchMove, onTouchEnd, cancel };
}
