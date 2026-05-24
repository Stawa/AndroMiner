import { computed, ref } from 'vue';

const closeThresholdPx = 86;

export const useSheetDrag = (close: () => void) => {
  const dragStartY = ref<number | null>(null);
  const dragY = ref(0);

  const cleanupWindowListeners = (): void => {
    window.removeEventListener('pointermove', moveSheetDrag);
    window.removeEventListener('pointerup', endSheetDrag);
    window.removeEventListener('pointercancel', endSheetDrag);
  };

  const sheetDragStyle = computed(() =>
    dragStartY.value === null && dragY.value === 0
      ? {}
      : {
          transform: `translateY(${dragY.value}px)`,
          transition: 'none'
        }
  );

  const startSheetDrag = (event: PointerEvent): void => {
    dragStartY.value = event.clientY;
    dragY.value = 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', moveSheetDrag, { passive: true });
    window.addEventListener('pointerup', endSheetDrag);
    window.addEventListener('pointercancel', endSheetDrag);
  };

  const moveSheetDrag = (event: PointerEvent): void => {
    if (dragStartY.value === null) {
      return;
    }

    dragY.value = Math.max(0, event.clientY - dragStartY.value);
  };

  const endSheetDrag = (): void => {
    if (dragY.value > closeThresholdPx) {
      close();
    }

    dragStartY.value = null;
    dragY.value = 0;
    cleanupWindowListeners();
  };

  return {
    sheetDragStyle,
    startSheetDrag,
    moveSheetDrag,
    endSheetDrag
  };
};
