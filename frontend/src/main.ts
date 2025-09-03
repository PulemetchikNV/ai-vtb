import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import './plugins/primevue/theme'
import './plugins/primevue/locale'
import theme from './plugins/primevue/theme'
import 'primeicons/primeicons.css'

createApp(App)
    .use(router)
    .use(PrimeVue, { theme })
    .mount('#app')
