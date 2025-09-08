<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import Drawer from 'primevue/drawer'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Avatar from 'primevue/avatar'
import { useAuth } from '../composables/useAuth'

const sidebarWidth = '260px'
const drawerOpen = ref(false)
const isDesktop = ref(false)
const router = useRouter()
const { user, isAuthorized, logout: logoutAuth } = useAuth()

// Navigation items with icons
const navigationItems = [
  {
    label: 'Загрузка резюме',
    icon: 'pi pi-upload',
    route: '/resumes'
  },
  {
    label: 'Голосовой чат',
    icon: 'pi pi-microphone',
    route: '/voice-chat'
  },
  {
    label: 'Вакансии',
    icon: 'pi pi-briefcase',
    route: '/vacancies'
  },
  {
    label: 'Профиль',
    icon: 'pi pi-user',
    route: '/profile'
  }
]

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

function handleLogout() {
  logoutAuth()
  router.push('/login')
}

function navigateAndClose(route: string) {
  router.push(route)
  if (!isDesktop.value) {
    drawerOpen.value = false
  }
}
</script>

<template>
  <div class="layout">
    <!-- Mobile top bar with hamburger -->
    <div class="topbar" v-if="!isDesktop">
      <Button icon="pi pi-bars" class="menu-btn" text rounded @click="openDrawer" />
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
          <img src="../assets/the-one-logo.svg" alt="The One Market" class="logo-svg" />
        </div>
      </template>
      <div class="sidebar">
        <!-- Navigation Menu -->
        <nav class="nav">
          <div class="nav-items">
            <div 
              v-for="item in navigationItems" 
              :key="item.route"
              class="nav-item"
              :class="{ 'active': $route.path === item.route || ($route.path.startsWith('/voice-chat') && item.route === '/voice-chat') }"
              @click="navigateAndClose(item.route)"
            >
              <i :class="item.icon" class="nav-icon"></i>
              <span class="nav-label">{{ item.label }}</span>
            </div>
          </div>
        </nav>

        <!-- User Section -->
        <div class="user-section">
          <div v-if="!isAuthorized" class="auth-section">
            <Button 
              label="Войти" 
              icon="pi pi-sign-in"
              class="w-full" 
              @click="router.push('/login')" 
            />
          </div>
          <div v-else class="user-info">
            <div class="user-profile">
              <Avatar 
                :label="user?.email?.charAt(0).toUpperCase()" 
                size="large" 
                shape="circle"
                class="user-avatar"
              />
              <div class="user-details">
                <div class="user-email">{{ user?.email }}</div>
                <div class="user-role">{{ user?.role === 'hr' ? 'HR' : 'Пользователь' }}</div>
              </div>
            </div>
            <Button 
              label="Выйти" 
              icon="pi pi-sign-out"
              severity="secondary"
              outlined
              size="small"
              class="logout-btn"
              @click="handleLogout" 
            />
          </div>
        </div>
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
  display: flex;
  flex-direction: column;
}

.logo { 
  display: flex; 
  align-items: center; 
  justify-content: center;
  gap: 8px; 
  padding: 16px 8px; 
  cursor: pointer;
  transition: all 0.3s ease;
}

.logo:hover {
  transform: translateY(-1px);
}

.logo-svg {
  height: 40px;
  width: auto;
  transition: all 0.3s ease;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.1));
}

.logo:hover .logo-svg {
  transform: scale(1.05);
  filter: drop-shadow(0 4px 12px rgba(39, 87, 252, 0.2));
}

/* Navigation */
.nav {
  flex: 1;
  padding: 1rem 0;
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-color);
  font-weight: 500;
}

.nav-item:hover {
  background: var(--surface-hover);
  color: var(--p-primary-color);
  transform: translateX(2px);
}

.nav-item.active {
  background: var(--p-primary-color);
  color: white;
  box-shadow: 0 2px 8px rgba(39, 87, 252, 0.3);
}

.nav-item.active:hover {
  background: var(--p-primary-color);
  color: white;
  transform: translateX(0);
}

.nav-icon {
  font-size: 1.1rem;
  width: 20px;
  text-align: center;
}

.nav-label {
  font-size: 0.95rem;
}

/* User Section */
.user-section {
  padding: 1rem;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-section);
}

.auth-section {
  display: flex;
  justify-content: center;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  background: var(--p-primary-color);
  color: white;
  font-weight: 600;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-email {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.logout-btn {
  width: 100%;
}

/* Utility */
.w-full {
  width: 100%;
}

.content {
  max-width: 1400px; width: 100%; margin: 0 auto; padding: 16px;
}
</style>
