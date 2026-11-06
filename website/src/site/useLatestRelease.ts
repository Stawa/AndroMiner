import { ref } from 'vue';
import { loadLatestRelease, type ReleaseInfo } from './release';

const release = ref<ReleaseInfo | null>(null);
const state = ref<'loading' | 'ready' | 'failed'>('loading');
let started = false;

/** One shared GitHub request for every component on the page. */
export const useLatestRelease = () => {
  if (!started && typeof window !== 'undefined') {
    started = true;
    loadLatestRelease().then(
      (info) => {
        release.value = info;
        state.value = 'ready';
      },
      () => {
        state.value = 'failed';
      }
    );
  }
  return { release, state };
};
