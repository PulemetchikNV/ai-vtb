<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Message from 'primevue/message'
import FloatLabel from 'primevue/floatlabel'

const router = useRouter()
const { login, register } = useAuth()

const email = ref('')
const password = ref('')
const role = ref<'user' | 'hr'>('user')
const isRegister = ref(false)
const loading = ref(false)
const error = ref('')

const roleOptions = [
  { label: 'Пользователь', value: 'user' },
  { label: 'HR', value: 'hr' }
]

async function submit() {
  loading.value = true
  error.value = ''
  try {
    if (isRegister.value) {
      await register({ email: email.value, password: password.value, role: role.value })
    } else {
      await login({ email: email.value, password: password.value })
    }
    router.push('/resumes')
  } catch (e: any) {
    error.value = e?.response?.data?.error || e?.message || 'Произошла ошибка'
  } finally { 
    loading.value = false 
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <!-- Logo/Brand Section -->
      <div class="brand-section">
        <div class="logo">
          <img src="../assets/the-one-logo.svg" alt="The One Market" class="logo-svg" />
        </div>
        <p class="brand-subtitle">Система анализа резюме и проведения интервью</p>
      </div>

      <!-- Auth Card -->
      <Card class="auth-card">
        <template #title>
          <div class="card-title">
            {{ isRegister ? 'Создать аккаунт' : 'Войти в систему' }}
          </div>
        </template>
        
        <template #content>
          <form @submit.prevent="submit" class="auth-form">
            <!-- Error Message -->
            <Message v-if="error" severity="error" :closable="false" class="error-message">
              {{ error }}
            </Message>

            <!-- Email Field -->
            <div class="field">
              <FloatLabel>
                <InputText 
                  id="email" 
                  v-model="email" 
                  type="email"
                  :invalid="!!error"
                  class="w-full"
                  autocomplete="email"
                />
                <label for="email">Email адрес</label>
              </FloatLabel>
            </div>

            <!-- Password Field -->
            <div class="field">
              <FloatLabel>
                <Password 
                  id="password"
                  v-model="password" 
                  :invalid="!!error"
                  toggleMask 
                  :feedback="isRegister"
                  fluid
                  class="w-full"
                  inputClass="w-full"
                  autocomplete="current-password"
                />
                <label for="password">Пароль</label>
              </FloatLabel>
            </div>

            <!-- Role Field (only for registration) -->
            <div class="field" v-if="isRegister">
              <FloatLabel>
                <Dropdown 
                  id="role"
                  v-model="role" 
                  :options="roleOptions" 
                  optionLabel="label" 
                  optionValue="value"
                  class="w-full"
                />
                <label for="role">Выберите роль</label>
              </FloatLabel>
            </div>

            <!-- Submit Button -->
            <Button 
              type="submit"
              :label="isRegister ? 'Зарегистрироваться' : 'Войти'"
              :loading="loading"
              class="submit-btn w-full"
              size="large"
            />

            <!-- Toggle Mode -->
            <div class="toggle-section">
              <span class="toggle-text">
                {{ isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?' }}
              </span>
              <Button 
                :label="isRegister ? 'Войти' : 'Создать аккаунт'"
                link 
                class="toggle-btn"
                @click="isRegister = !isRegister; error = ''"
              />
            </div>
          </form>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--surface-ground) 0%, var(--surface-section) 100%);
  padding: 1rem;
}

.auth-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  max-width: 420px;
  width: 100%;
}

/* Brand Section */
.brand-section {
  text-align: center;
  margin-bottom: 1rem;
}

.logo {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.logo-svg {
  height: 64px;
  width: auto;
  transition: all 0.3s ease;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
}

.logo-svg:hover {
  transform: translateY(-2px) scale(1.05);
  filter: drop-shadow(0 8px 24px rgba(39, 87, 252, 0.3));
}

.brand-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0.5rem 0;
  color: var(--text-color);
}

.brand-subtitle {
  font-size: 0.95rem;
  color: var(--text-color-secondary);
  margin: 0;
  line-height: 1.4;
}

/* Auth Card */
.auth-card {
  width: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border: 1px solid var(--surface-border);
}

.card-title {
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
  color: var(--text-color);
  margin: 0;
}

/* Form */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
}

.error-message {
  margin-bottom: 0.5rem;
}

.submit-btn {
  margin-top: 0.5rem;
}

/* Toggle Section */
.toggle-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border);
}

.toggle-text {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

.toggle-btn {
  font-weight: 600;
}

/* Responsive */
@media (max-width: 480px) {
  .auth-page {
    padding: 0.5rem;
  }
  
  .auth-container {
    gap: 1.5rem;
  }
  
  .brand-title {
    font-size: 1.75rem;
  }
  
  .brand-subtitle {
    font-size: 0.9rem;
  }
  
  .logo-svg {
    height: 56px;
  }
}

/* Utility classes for PrimeVue */
.w-full {
  width: 100%;
}
</style>


