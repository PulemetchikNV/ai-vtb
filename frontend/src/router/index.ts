import { createRouter, createWebHistory } from 'vue-router';
import ResumeUpload from '../views/ResumeUpload.vue';
import VoiceChat from '../views/VoiceChat.vue';
import Vacancies from '../views/Vacancies.vue';
import Resumes from '../views/Resumes.vue';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', component: ResumeUpload },
        { path: '/voice-chat/:chatId?', component: VoiceChat },
        { path: '/vacancies', component: Vacancies },
        { path: '/resumes', component: Resumes },
    ],
});

export default router;