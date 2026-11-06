import { createApp } from 'vue';
import LandingPage from './LandingPage.vue';
import './landing.css';

// The public site is its own build (vite.stats.config.ts) and never ships inside the Android app.
document.documentElement.classList.add('js');
createApp(LandingPage).mount('#landing');
