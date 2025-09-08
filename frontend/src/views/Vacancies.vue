<script setup lang="ts">
import { onMounted, ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useVacancies } from '../composables/useVacancies'
import { useAuth } from '../composables/useAuth'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Card from 'primevue/card'
import { REQUIREMENT_TYPES } from '../__data__/constants'
import VacancyForm from '../components/VacancyForm.vue'

// Mobile detection
const isMobile = ref(window.innerWidth < 768)
const updateMobile = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  window.addEventListener('resize', updateMobile)
  load()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateMobile)
})

const { vacancies, load, create, remove, update, loading } = useVacancies()
const { isHr } = useAuth()
const router = useRouter()

const reqTypes = REQUIREMENT_TYPES as unknown as Array<{ value: 'technical_skill' | 'soft_skill'; label: string }>
const weightsDefault = reqTypes.reduce((acc, it) => {
  acc[it.value] = Math.round(1 / reqTypes.length * 100) / 100
  return acc
}, {} as Record<string, number>)

const showCreate = ref(false)
const showEdit = ref(false)
const editingId = ref<string | null>(null)

type ReqRow = { id: string; description: string; type: 'technical_skill' | 'soft_skill'; weight: number }
type Form = { title: string; description_text: string; requirements: Array<ReqRow>; weights: Record<string, number> }

const formDefaultValue: Form = { 
  title: '',
  description_text: '',
  requirements: [{ id: 'req1', description: '', type: 'technical_skill', weight: 1 }],
  weights: weightsDefault
}
const form = ref<Form>({...formDefaultValue})

function addReq() {
  const nextId = `req${form.value.requirements.length + 1}`
  form.value.requirements.push({ id: nextId, description: '', type: 'technical_skill', weight: 1 })
}
function delReq(idx: number) { 
  form.value.requirements.splice(idx, 1)
}

function shortenDescription(text: string) {
  return text.length > 100 ? text.slice(0, 100) + '...' : text
}

async function submit() {
  const checklist = form.value.requirements.map(it => ({ id: it.id, description: it.description, type: it.type, weight: it.weight }))
  await create({ title: form.value.title, description_text: form.value.description_text, requirements_checklist: checklist, category_weights: form.value.weights })
  showCreate.value = false
  form.value.title = ''
  form.value.description_text = ''
  form.value.requirements = [{ id: 'req1', description: '', type: 'technical_skill', weight: 1 }]
  form.value.weights = weightsDefault
}

function openCreate() {
  form.value = {...formDefaultValue}
  showCreate.value = true
}

function openEdit(v: any) {
  editingId.value = v.id
  form.value.title = v.title
  form.value.description_text = v.description_text
  form.value.requirements = Array.isArray(v.requirements_checklist) ? v.requirements_checklist.map((r: any) => ({ id: r.id, description: r.description, type: r.type, weight: r.weight })) : []
  form.value.weights = v.category_weights || weightsDefault
  showEdit.value = true
}

async function submitEdit(newForm: Form) {  
  if (!editingId.value) return
  console.log('submitEdit', newForm)

  const checklist = newForm.requirements
    .map(it => ({ 
      id: it.id,
      description: it.description,
      type: it.type,
      weight: it.weight
    }))

  await update(editingId.value, {
    title: newForm.title,
    description_text: newForm.description_text,
    requirements_checklist: checklist,
    category_weights: newForm.weights
  })
  
  showEdit.value = false
  editingId.value = null
}

// Function to start chat for regular users
function startChatWithVacancy(vacancyId: string) {
  // Navigate to voice chat with the vacancy pre-selected
  router.push({
    path: '/voice-chat',
    query: { 
      vacancy: vacancyId,
      newChat: 'true'
    }
  })
}

// Moved to the mobile detection onMounted above
</script>

<template>
  <div class="page">
    <div class="header">
      <h2>Вакансии</h2>
      <Button 
        v-if="isHr" 
        :label="isMobile ? '' : 'Создать'"
        icon="pi pi-plus" 
        @click="openCreate" 
        :disabled="loading"
        :class="{ 'mobile-btn': isMobile }"
        v-tooltip.left="isMobile ? 'Создать вакансию' : ''"
      />
      <div v-else class="user-info">
        <span class="info-text" :class="{ 'mobile-text': isMobile }">
          {{ isMobile ? 'Выберите вакансию' : 'Выберите вакансию для начала собеседования' }}
        </span>
      </div>
    </div>

    <div class="grid">
      <Card
        v-for="v in vacancies"
        :key="v.id"
        :pt="{content: {style: {flexGrow: 1}}, body: {style: {height: '100%'}}}"
        class="vacancy"
      >
        <template #title>{{ v.title }}</template>
        <template #content>
          <p class="desc">{{ shortenDescription(v.description_text) }}</p>
          <!-- <ul class="reqs">
            <li v-for="(val, key) in v.requirements_checklist" :key="key"> {{
                val.description
              }}</li>
          </ul> -->
        </template>
        <template #footer>
          <div class="buttons">
            <!-- HR buttons -->
            <template v-if="isHr">
              <Button 
                :size="isMobile ? 'small' : 'small'"
                icon="pi pi-eye" 
                severity="secondary"
                outlined
                class="mr-2" 
                @click="router.push(`/vacancies/${v.id}/analytics`)" 
                :disabled="loading"
                v-tooltip.top="'Аналитика'"
              />
              <Button 
                size="small" 
                icon="pi pi-pencil" 
                class="mr-2" 
                @click="openEdit(v)" 
                :disabled="loading"
                v-tooltip.top="'Редактировать'"
              />
              <Button 
                size="small" 
                variant="text" 
                icon="pi pi-trash" 
                severity="danger" 
                @click="remove(v.id)" 
                :disabled="loading"
                v-tooltip.top="'Удалить'"
              />
            </template>
            <!-- User button -->
            <template v-else>
              <Button 
                :label="isMobile ? 'Чат' : 'Начать чат'"
                icon="pi pi-comments" 
                size="small" 
                class="start-chat-btn"
                @click="startChatWithVacancy(v.id)" 
                :disabled="loading" 
              />
            </template>
          </div>
        </template>
      </Card>
      <p v-if="!vacancies.length">Нет вакансий</p>
    </div>

    <!-- HR-only dialogs -->
    <template v-if="isHr">
      <Dialog 
        v-model:visible="showCreate" 
        modal 
        header="Новая вакансия" 
        :style="isMobile ? { width: '95vw', height: '90vh' } : { width: '720px' }"
        :breakpoints="{ '960px': '75vw', '640px': '95vw' }"
        :maximizable="!isMobile"
        :dismissableMask="!isMobile"
        class="vacancy-dialog"
      >
        <VacancyForm v-model="form" @add-req="addReq" @del-req="delReq" @submit="submit" />
      </Dialog>

      <Dialog 
        v-model:visible="showEdit" 
        modal 
        header="Редактировать вакансию" 
        :style="isMobile ? { width: '95vw', height: '90vh' } : { width: '720px' }"
        :breakpoints="{ '960px': '75vw', '640px': '95vw' }"
        :maximizable="!isMobile"
        :dismissableMask="!isMobile"
        class="vacancy-dialog"
      >
        <VacancyForm v-model="form" @add-req="addReq" @del-req="delReq" @submit="submitEdit" />
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.page { 
  padding: 12px; 
}

.header { 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); 
  gap: 12px; 
}

.desc { 
  white-space: pre-wrap; 
  line-height: 1.5;
}

.reqs { 
  margin: 8px 0 0; 
  padding-left: 16px; 
}

.form { 
  display: grid; 
  gap: 10px; 
}

.weights { 
  display: grid; 
  gap: 8px; 
  margin-bottom: 4px; 
}

.w-row { 
  display: grid; 
  grid-template-columns: auto 1fr auto; 
  gap: 8px; 
  align-items: center; 
}

.w-label { 
  min-width: 110px; 
}

.w-slider { 
  width: 100%; 
}

.req-list { 
  display: grid; 
  gap: 8px; 
}

.req-row { 
  display: grid; 
  grid-template-columns: 1fr 1fr auto auto; 
  gap: 8px; 
  align-items: center; 
}

.actions { 
  display: flex; 
  justify-content: flex-end; 
  gap: 8px; 
  margin-top: 8px; 
}

.buttons { 
  display: flex; 
  justify-content: flex-end; 
  gap: 8px; 
  flex-wrap: wrap;
}

/* User info styling */
.user-info {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: flex-end;
}

.info-text {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
  font-style: italic;
  text-align: right;
}

.mobile-text {
  font-size: 0.8rem;
  text-align: center;
}

/* Button styling */
.mobile-btn {
  min-width: 44px;
  height: 44px;
}

.start-chat-btn {
  background: var(--p-primary-color);
  border-color: var(--p-primary-color);
  color: white;
  flex: 1;
  justify-content: center;
}

.start-chat-btn:hover {
  background: var(--p-primary-600);
  border-color: var(--p-primary-600);
}

/* Dialog styling */
:deep(.vacancy-dialog) {
  margin: 0;
}

:deep(.vacancy-dialog .p-dialog-content) {
  padding: 1rem;
  overflow-y: auto;
  max-height: calc(90vh - 120px);
}

/* Mobile styles */
@media (max-width: 768px) {
  .page {
    padding: 8px;
  }
  
  .header {
    margin-bottom: 16px;
  }
  
  .header h2 {
    font-size: 1.5rem;
    margin: 0;
  }
  
  .grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .buttons {
    gap: 6px;
  }
  
  .user-info {
    width: 100%;
    justify-content: center;
    margin-top: 8px;
  }
  
  .info-text {
    text-align: center;
  }
  
  .start-chat-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .page {
    padding: 4px;
  }
  
  .header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header h2 {
    text-align: center;
    margin-bottom: 8px;
  }
  
  .grid {
    gap: 12px;
  }
  
  .buttons {
    justify-content: center;
  }
}
</style>
