import { createApp } from 'vue';
import LegalApp from './LegalApp.vue';
import '../site/site.css';
import '../docs/docs.css';

document.documentElement.classList.add('js');
createApp(LegalApp).mount('#legal');
