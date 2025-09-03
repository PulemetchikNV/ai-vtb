import { createRouter, createWebHistory } from 'vue-router';
import ResumeUpload from '../views/ResumeUpload.vue';
import VoiceChat from '../views/VoiceChat.vue';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', component: ResumeUpload },
        { path: '/voice-chat/:chatId?', component: VoiceChat },
    ],
});

export default router;