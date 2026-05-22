import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import 'material-symbols/rounded.css';
import './styles.css';

createApp(App).use(createPinia()).mount('#app');
