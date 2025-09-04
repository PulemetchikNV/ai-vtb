<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="layout">
    <header class="header">
      <nav class="nav">
        <RouterLink to="/" class="link">Загрузка резюме</RouterLink>
        <RouterLink to="/voice-chat" class="link">Чат</RouterLink>
        <RouterLink to="/vacancies" class="link">Вакансии</RouterLink>
      </nav>
    </header>

    <main class="content">
      <div class="page-content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout { 
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}
.header {
    position: sticky;
    top: 0;
    backdrop-filter: blur(6px);
    background: color-mix(in srgb, var(--surface-card), transparent 20%);
    border-bottom: 1px solid var(--surface-border);
    z-index: 10;
}
.nav {
    max-width: 1280px;
    margin: 0 auto;
    padding: 12px 16px;
    display: flex;
    gap: 12px;
    align-items: center;
}

.link {
    padding: 6px 10px;
    border-radius: 8px;
    text-decoration: none;
    color: var(--text-color);
    border: 1px solid transparent;
}

.link.router-link-active {
    background: var(--surface-ground);
    border-color: var(--surface-border);
}

.content { 
    flex: 1; 
    max-width: 1280px; 
    width: 100%;
    margin: 0 auto; 
    padding: 16px; 
    display: flex;
    flex-direction: column;
}
/* .page-content { 
    width: 100%;
} */
</style>
