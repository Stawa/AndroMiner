import { createApp } from 'vue';
import DocsApp from './DocsApp.vue';
import '../site/site.css';
import './docs.css';

document.documentElement.classList.add('js');
createApp(DocsApp).mount('#docs');
