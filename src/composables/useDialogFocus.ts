import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue';
const dialogStack: symbol[] = [];
let previousOverflow = '';
/** Contain keyboard focus in an open dialog and restore the invoking control. */
export function useDialogFocus(
  open: () => boolean,
  panel: Ref<HTMLElement | null>,
  close: () => void
) {
  const id = Symbol('dialog');
  const unlock = () => {
    const index = dialogStack.indexOf(id);
    if (index < 0) return;
    dialogStack.splice(index, 1);
    if (!dialogStack.length) document.body.style.overflow = previousOverflow;
  };
  let previous: HTMLElement | null = null;
  const focusable = () =>
    Array.from(
      panel.value?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
      ) || []
    ).filter((el) => el.getClientRects().length > 0);
  const key = (event: KeyboardEvent) => {
    if (!open() || !panel.value || dialogStack[dialogStack.length - 1] !== id) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (event.key === 'Tab') {
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        panel.value.focus();
        return;
      }
      const first = items[0]!,
        last = items[items.length - 1]!;
      if (
        event.shiftKey &&
        (document.activeElement === first || !panel.value.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !panel.value.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  watch(
    open,
    async (active) => {
      if (active) {
        if (!dialogStack.length) {
          previousOverflow = document.body.style.overflow;
          document.body.style.overflow = 'hidden';
        }
        if (!dialogStack.includes(id)) dialogStack.push(id);
        previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        await nextTick();
        (focusable()[0] || panel.value)?.focus();
        document.addEventListener('keydown', key, true);
      } else {
        unlock();
        document.removeEventListener('keydown', key, true);
        previous?.focus();
        previous = null;
      }
    },
    { immediate: true }
  );
  onBeforeUnmount(() => {
    unlock();
    document.removeEventListener('keydown', key, true);
    previous?.focus();
  });
}
