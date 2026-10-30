import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './assets/icons.css';
import './styles.css';
import './assets/fonts/fonts.css';

createApp(App).use(createPinia()).mount('#app');
