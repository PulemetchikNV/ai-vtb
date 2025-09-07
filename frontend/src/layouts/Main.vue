<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import Drawer from 'primevue/drawer'
import Button from 'primevue/button'

const sidebarWidth = '260px'
const drawerOpen = ref(false)
const isDesktop = ref(false)

function updateMedia() {
  isDesktop.value = window.matchMedia('(min-width: 1024px)').matches
  drawerOpen.value = isDesktop.value
}

onMounted(() => {
  updateMedia()
  window.addEventListener('resize', updateMedia)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateMedia)
})

const contentStyle = computed(() => ({
  paddingLeft: isDesktop.value ? sidebarWidth : undefined
}))

function openDrawer() {
  drawerOpen.value = true
}
</script>

<template>
  <div class="layout">
    <!-- Mobile top bar with hamburger -->
    <div class="topbar" v-if="!isDesktop">
      <Button icon="pi pi-bars" class="menu-btn" text rounded @click="openDrawer" />
      <div class="brand">Vanguard AI</div>
    </div>

    <!-- Sidebar Drawer -->
    <Drawer
      v-model:visible="drawerOpen"
      :modal="!isDesktop"
      :dismissable="!isDesktop"
      :blockScroll="!isDesktop"
      position="left"
      :showCloseIcon="!isDesktop"
      :pt="{ root: { style: { width: isDesktop ? sidebarWidth : '100%' } } }"
    >
      <template #header>
        <div class="logo">
          <div class="logo-mark">VA</div>
          <div class="logo-text">Vanguard AI</div>
        </div>
      </template>
      <div class="sidebar">
        <nav class="nav">
          <RouterLink to="/resumes" class="link" @click="!isDesktop && (drawerOpen = false)">Загрузка резюме</RouterLink>
          <RouterLink to="/voice-chat" class="link" @click="!isDesktop && (drawerOpen = false)">Чат</RouterLink>
          <RouterLink to="/vacancies" class="link" @click="!isDesktop && (drawerOpen = false)">Вакансии</RouterLink>
        </nav>
      </div>
    </Drawer>

    <main class="content" :style="contentStyle">
      <div class="page-content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--surface-border);
  background: color-mix(in srgb, var(--surface-card), transparent 20%);
  backdrop-filter: blur(6px);
}
.menu-btn { margin-right: 6px; }
.brand { font-weight: 600; }

.sidebar {
  height: 100%;
}
.logo { display: flex; align-items: center; gap: 8px; padding: 12px 8px; }
.logo-mark {
  width: 36px; height: 36px; border-radius: 8px; display: grid; place-items: center;
  background: var(--p-primary-color); color: #fff; font-weight: 700;
}
.logo-text { font-weight: 700; }

.nav { display: grid; gap: 6px; padding: 0 0; }
.link {
  padding: 8px 10px; border-radius: 8px; text-decoration: none; color: var(--text-color);
}
.link.router-link-active { background: var(--surface-ground); border: 1px solid var(--surface-border); }

.content {
  max-width: 1400px; width: 100%; margin: 0 auto; padding: 16px;
}
</style>
