import type { Directive } from 'vue';

const prefersStill = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

let observer: IntersectionObserver | null = null;

const shared = (): IntersectionObserver => {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px' }
  );
  return observer;
};

/** `v-reveal`: rises and fades in once as the element enters. Content stays visible without script. */
export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    el.classList.add('reveal');
    if (prefersStill() || !('IntersectionObserver' in window)) {
      el.classList.add('in');
      return;
    }
    el.style.transitionDelay = `${(binding.value ?? 0) * 70}ms`;
    shared().observe(el);
  },
  unmounted(el) {
    observer?.unobserve(el);
  }
};
