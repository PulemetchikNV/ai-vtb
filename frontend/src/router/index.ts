import { createRouter, createWebHistory } from 'vue-router';
import VoiceChat from '../views/VoiceChat.vue';
import Vacancies from '../views/Vacancies.vue';
import Resumes from '../views/Resumes.vue';
import Login from '../views/Login.vue';
import Profile from '../views/Profile.vue';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', redirect: '/resumes' },
        { path: '/login', component: Login },
        { path: '/voice-chat/:chatId?', component: VoiceChat },
        { path: '/vacancies', component: Vacancies },
        { path: '/resumes', component: Resumes },
        { path: '/profile', component: Profile },
    ],
});

export default router;