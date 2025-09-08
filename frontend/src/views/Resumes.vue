<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Card from 'primevue/card'
import Message from 'primevue/message'
import { useResumes } from '../composables/useResumes'
import ResumeForm from '../components/ResumeForm.vue'
import type { ResumeForm as Form } from '../types/resume'
import { addMessage } from '../__data__/notifications'

const { resumes, load, create, update, remove, loading, error, getErrorMessage } = useResumes()

const showCreate = ref(false)
const showEdit = ref(false)
const editingId = ref<string | null>(null)
const submitLoading = ref(false)

const formDefaultValue: Form = { fileName: '' }
const form = ref<Form>({ ...formDefaultValue })

function openCreate() {
  form.value = { ...formDefaultValue }
  showCreate.value = true
}

function openEdit(r: any) {
  editingId.value = r.id
  form.value.fileName = r.fileName
  form.value.text = r.text
  form.value.file = undefined
  showEdit.value = true
}

async function submitCreate(newForm: Form) {
  try {
    submitLoading.value = true
    await create({ fileName: newForm.fileName, text: newForm.text, file: newForm.file })
    showCreate.value = false
    form.value = { ...formDefaultValue }
    addMessage({
      severity: 'success',
      summary: 'Успешно!',
      detail: `Резюме "${newForm.fileName}" загружено`
    })
  } catch (error: any) {
    const errorMessage = error?.message || 'Не удалось загрузить резюме'
    const severity = error?.type === 'validation' || error?.type === 'file' ? 'warn' : 'error'
    
    addMessage({
      severity,
      summary: error?.type === 'validation' ? 'Проверьте данные' : 
               error?.type === 'file' ? 'Проблема с файлом' : 
               error?.type === 'network' ? 'Проблемы с сетью' : 'Ошибка',
      detail: errorMessage,
      life: error?.type === 'network' ? 5000 : 3000
    })
  } finally {
    submitLoading.value = false
  }
}

async function submitEdit(newForm: Form) {
  if (!editingId.value) return
  try {
    submitLoading.value = true
    await update(editingId.value, { fileName: newForm.fileName, text: newForm.text })
    showEdit.value = false
    editingId.value = null
    addMessage({
      severity: 'success',
      summary: 'Успешно!',
      detail: `Резюме "${newForm.fileName}" обновлено`
    })
  } catch (error: any) {
    const errorMessage = error?.message || 'Не удалось обновить резюме'
    const severity = error?.type === 'validation' || error?.type === 'file' ? 'warn' : 'error'
    
    addMessage({
      severity,
      summary: error?.type === 'validation' ? 'Проверьте данные' : 
               error?.type === 'file' ? 'Проблема с файлом' : 
               error?.type === 'network' ? 'Проблемы с сетью' : 'Ошибка',
      detail: errorMessage,
      life: error?.type === 'network' ? 5000 : 3000
    })
  } finally {
    submitLoading.value = false
  }
}

async function handleRemove(id: string, fileName: string) {
  try {
    await remove(id)
    addMessage({
      severity: 'success',
      summary: 'Удалено',
      detail: `Резюме "${fileName}" удалено`
    })
  } catch (error: any) {
    const errorMessage = error?.message || 'Не удалось удалить резюме'
    
    addMessage({
      severity: error?.type === 'auth' ? 'warn' : 'error',
      summary: error?.type === 'auth' ? 'Нет доступа' : 
               error?.type === 'network' ? 'Проблемы с сетью' : 'Ошибка',
      detail: errorMessage,
      life: error?.type === 'network' ? 5000 : 3000
    })
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="header">
      <h2>Резюме</h2>
      <Button label="Загрузить резюме" icon="pi pi-plus" @click="openCreate" :disabled="loading || submitLoading" />
    </div>

    <!-- Общие ошибки -->
    <Message 
      v-if="error && !submitLoading" 
      :severity="error.type === 'network' ? 'warn' : 'error'" 
      :closable="true"
      @close="error = null"
      class="error-message"
    >
      <template #icon>
        <i class="pi" :class="{
          'pi-exclamation-triangle': error.type === 'validation' || error.type === 'file',
          'pi-wifi': error.type === 'network',
          'pi-server': error.type === 'server',
          'pi-lock': error.type === 'auth',
          'pi-times-circle': error.type === 'unknown'
        }"></i>
      </template>
      {{ getErrorMessage(error) }}
    </Message>

    <div class="grid">
      <Card v-for="r in resumes" :key="r.id" class="resume">
        <template #title>{{ r.fileName }}</template>
        <template #content>
          <p class="desc">{{ r.text.slice(0, 240) }}{{ r.text.length > 240 ? '…' : '' }}</p>
        </template>
        <template #footer>
          <div class="buttons">
            <Button 
              size="small" 
              icon="pi pi-pencil" 
              class="mr-2" 
              @click="openEdit(r)" 
              :disabled="loading || submitLoading" 
            />
            <Button 
              size="small" 
              variant="text" 
              icon="pi pi-trash" 
              severity="danger" 
              @click="handleRemove(r.id, r.fileName)" 
              :disabled="loading || submitLoading"
              :loading="loading"
            />
          </div>
        </template>
      </Card>
      <p v-if="!resumes.length">Нет резюме</p>
    </div>

    <Dialog v-model:visible="showCreate" modal header="Новое резюме" :style="{ width: '720px' }">
      <ResumeForm v-model="form" :loading="submitLoading" @submit="submitCreate" />
    </Dialog>

    <Dialog v-model:visible="showEdit" modal header="Редактировать резюме" :style="{ width: '720px' }">
      <ResumeForm v-model="form" :loading="submitLoading" @submit="submitEdit" />
    </Dialog>
  </div>
</template>

<style scoped>
.page { padding: 12px; }
.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.error-message { margin-bottom: 1rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.desc { white-space: pre-wrap; }
.buttons { display: flex; justify-content: flex-end; gap: 8px; }
</style>


