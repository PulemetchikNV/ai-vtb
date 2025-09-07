import { createRouter, createWebHistory } from 'vue-router';
import VoiceChat from '../views/VoiceChat.vue';
import Vacancies from '../views/Vacancies.vue';
import Resumes from '../views/Resumes.vue';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', redirect: '/resumes' },
        { path: '/voice-chat/:chatId?', component: VoiceChat },
        { path: '/vacancies', component: Vacancies },
        { path: '/resumes', component: Resumes },
    ],
});

export default router;