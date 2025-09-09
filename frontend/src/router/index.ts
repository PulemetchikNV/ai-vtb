import { createRouter, createWebHistory } from 'vue-router';
import VoiceChat from '../views/VoiceChat.vue';
import Vacancies from '../views/Vacancies.vue';
import Resumes from '../views/Resumes.vue';
import Login from '../views/Login.vue';
import Profile from '../views/Profile.vue';
import VacancyAnalytics from '../views/VacancyAnalytics.vue';
import { isAuthorized } from '../__data__/store';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', redirect: '/resumes' },
        { path: '/login', component: Login },
        { path: '/voice-chat/:chatId?', component: VoiceChat },
        { path: '/vacancies', component: Vacancies },
        { path: '/vacancies/:id/analytics', component: VacancyAnalytics },
        { path: '/resumes', component: Resumes },
        { path: '/profile', component: Profile },
    ],
});

router.beforeEach((to, from, next) => {
    console.log(isAuthorized.value)
    if (isAuthorized.value) {
        next()
    } else if (to.path !== '/login') {
        console.log('login')
        next('/login')
    } else {
        next()
    }
})

export default router;