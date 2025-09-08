import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import './plugins/primevue/theme'
import './plugins/primevue/locale'
import theme from './plugins/primevue/theme'
import 'primeicons/primeicons.css'
import { ToastService, ConfirmationService, Tooltip } from 'primevue'

createApp(App)
    .use(router)
    .use(PrimeVue, { theme })
    .use(ToastService)
    .use(ConfirmationService)
    .directive('tooltip', Tooltip)
    .mount('#app')
