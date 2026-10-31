import { createApp } from 'vue';
import '../assets/fonts/fonts.css';
import '../styles.css';
import StatsPage from './StatsPage.vue';

const dark = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = (): void => {
  document.documentElement.classList.toggle('dark', dark.matches);
};
applyTheme();
dark.addEventListener('change', applyTheme);

createApp(StatsPage).mount('#stats');
