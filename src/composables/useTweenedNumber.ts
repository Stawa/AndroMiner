import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ||
    document.documentElement.classList.contains('motion-reduced'));

/** Eases a displayed number toward `source`; snaps when reduced motion is requested. */
export const useTweenedNumber = (
  source: () => number | null,
  durationMs = 450
): Ref<number | null> => {
  const shown = ref<number | null>(source());
  let frame = 0;

  const stop = (): void => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  watch(source, (target) => {
    stop();
    const from = shown.value;
    if (target === null || from === null || prefersReducedMotion() || from === target) {
      shown.value = target;
      return;
    }
    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      shown.value = from + (target - from) * eased;
      frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  });

  onBeforeUnmount(stop);
  return shown;
};
