<script setup lang="ts">
import { useAuth } from '../composables/useAuth'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import Badge from 'primevue/badge'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import { ref } from 'vue'

const { user, toggleRole, logout, loading } = useAuth()
const toggleLoading = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

async function handleToggleRole() {
  try {
    toggleLoading.value = true
    await toggleRole()
    message.value = `Роль успешно изменена на ${user.value?.role}`
    messageType.value = 'success'
    setTimeout(() => message.value = '', 3000)
  } catch (error: any) {
    message.value = error?.response?.data?.error || 'Ошибка при изменении роли'
    messageType.value = 'error'
    setTimeout(() => message.value = '', 5000)
  } finally {
    toggleLoading.value = false
  }
}

function getRoleColor(role: string) {
  return role === 'hr' ? 'success' : 'info'
}

function getRoleLabel(role: string) {
  return role === 'hr' ? 'HR' : 'Пользователь'
}
</script>

<template>
  <div class="profile-page">
    <div class="profile-container">
      <!-- Header -->
      <div class="page-header">
        <h1 class="page-title">Профиль пользователя</h1>
        <p class="page-subtitle">Управление учетной записью и настройками</p>
      </div>

      <!-- Message -->
      <Message 
        v-if="message" 
        :severity="messageType" 
        :closable="false" 
        class="profile-message"
      >
        {{ message }}
      </Message>

      <!-- Profile Card -->
      <Card class="profile-card">
        <template #header>
          <div class="profile-header">
            <Avatar 
              :label="user?.email?.charAt(0).toUpperCase()" 
              size="xlarge" 
              shape="circle"
              class="profile-avatar"
            />
            <div class="profile-info">
              <h2 class="profile-name">{{ user?.email }}</h2>
              <Badge 
                :value="getRoleLabel(user?.role || 'user')" 
                :severity="getRoleColor(user?.role || 'user')"
                class="profile-badge"
              />
            </div>
          </div>
        </template>

        <template #content>
          <div class="profile-content">
            <!-- User Details -->
            <div class="profile-section">
              <h3 class="section-title">
                <i class="pi pi-user"></i>
                Информация об аккаунте
              </h3>
              <div class="info-grid">
                <div class="info-item">
                  <label class="info-label">Email адрес</label>
                  <div class="info-value">{{ user?.email }}</div>
                </div>
                <div class="info-item">
                  <label class="info-label">Текущая роль</label>
                  <div class="info-value">
                    <Badge 
                      :value="getRoleLabel(user?.role || 'user')" 
                      :severity="getRoleColor(user?.role || 'user')"
                    />
                  </div>
                </div>
                <div class="info-item">
                  <label class="info-label">ID пользователя</label>
                  <div class="info-value code">{{ user?.id }}</div>
                </div>
              </div>
            </div>

            <Divider />

            <!-- Role Management -->
            <div class="profile-section">
              <h3 class="section-title">
                <i class="pi pi-cog"></i>
                Управление ролью
              </h3>
              <div class="role-management">
                <div class="role-description">
                  <p>
                    <strong>Текущая роль:</strong> {{ getRoleLabel(user?.role || 'user') }}
                  </p>
                  <p class="role-help">
                    <i class="pi pi-info-circle"></i>
                    {{ user?.role === 'hr' 
                      ? 'HR роль дает доступ к управлению вакансиями и расширенным функциям.' 
                      : 'Пользовательская роль предоставляет базовый доступ к системе.' 
                    }}
                  </p>
                </div>
                <Button 
                  :label="`Переключить на ${user?.role === 'hr' ? 'Пользователя' : 'HR'}`"
                  :loading="toggleLoading"
                  :disabled="loading"
                  severity="secondary"
                  icon="pi pi-refresh"
                  @click="handleToggleRole"
                  class="toggle-button"
                />
                <small class="dev-note">
                  <i class="pi pi-wrench"></i>
                  Функция разработчика для тестирования
                </small>
              </div>
            </div>

            <Divider />

            <!-- Actions -->
            <div class="profile-section">
              <h3 class="section-title">
                <i class="pi pi-sign-out"></i>
                Действия
              </h3>
              <div class="profile-actions">
                <Button 
                  label="Выйти из аккаунта" 
                  severity="danger"
                  icon="pi pi-sign-out"
                  outlined
                  @click="logout"
                  class="logout-button"
                />
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: var(--surface-ground);
  padding: 2rem 1rem;
}

.profile-container {
  max-width: 800px;
  margin: 0 auto;
}

/* Header */
.page-header {
  text-align: center;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
}

.page-subtitle {
  font-size: 1.1rem;
  color: var(--text-color-secondary);
  margin: 0;
}

/* Message */
.profile-message {
  margin-bottom: 1.5rem;
}

/* Profile Card */
.profile-card {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--surface-border);
}

/* Profile Header */
.profile-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: linear-gradient(135deg, var(--surface-card) 0%, var(--surface-section) 100%);
}

.profile-avatar {
  background: var(--p-primary-color);
  color: white;
  font-weight: 700;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-name {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.profile-badge {
  align-self: flex-start;
}

/* Profile Content */
.profile-content {
  padding: 0 2rem 2rem 2rem;
}

.profile-section {
  margin-bottom: 2rem;
}

.profile-section:last-child {
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--text-color);
}

.section-title i {
  color: var(--p-primary-color);
}

/* Info Grid */
.info-grid {
  display: grid;
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 1rem;
  color: var(--text-color);
}

.info-value.code {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  background: var(--surface-section);
  padding: 0.5rem;
  border-radius: 4px;
  color: var(--text-color-secondary);
}

/* Role Management */
.role-management {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.role-description p {
  margin: 0 0 0.5rem 0;
  line-height: 1.5;
}

.role-help {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-color-secondary);
  background: var(--surface-section);
  padding: 0.75rem;
  border-radius: 6px;
  border-left: 3px solid var(--p-primary-color);
}

.role-help i {
  color: var(--p-primary-color);
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.toggle-button {
  align-self: flex-start;
}

.dev-note {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  font-style: italic;
}

.dev-note i {
  color: var(--text-color-secondary);
}

/* Actions */
.profile-actions {
  display: flex;
  gap: 1rem;
}

.logout-button {
  min-width: 160px;
}

/* Responsive */
@media (max-width: 768px) {
  .profile-page {
    padding: 1rem 0.5rem;
  }
  
  .page-title {
    font-size: 2rem;
  }
  
  .profile-header {
    flex-direction: column;
    text-align: center;
    padding: 1.5rem;
  }
  
  .profile-content {
    padding: 0 1rem 1.5rem 1rem;
  }
  
  .profile-actions {
    flex-direction: column;
  }
  
  .logout-button {
    width: 100%;
  }
}
</style>
