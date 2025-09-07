<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Card from 'primevue/card'
import { useResumes } from '../composables/useResumes'
import ResumeForm from '../components/ResumeForm.vue'
import type { ResumeForm as Form } from '../types/resume'

const { resumes, load, create, update, remove, loading } = useResumes()

const showCreate = ref(false)
const showEdit = ref(false)
const editingId = ref<string | null>(null)

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
  console.log('submitCreate', newForm)
  await create({ fileName: newForm.fileName, text: newForm.text, file: newForm.file })
  showCreate.value = false
  form.value = { ...formDefaultValue }
}

async function submitEdit(newForm: Form) {
  if (!editingId.value) return
  await update(editingId.value, { fileName: newForm.fileName, text: newForm.text, pdfBase64: newForm.pdfBase64 })
  showEdit.value = false
  editingId.value = null
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="header">
      <h2>Резюме</h2>
      <Button label="Загрузить резюме" icon="pi pi-plus" @click="openCreate" :disabled="loading" />
    </div>

    <div class="grid">
      <Card v-for="r in resumes" :key="r.id" class="resume">
        <template #title>{{ r.fileName }}</template>
        <template #content>
          <p class="desc">{{ r.text.slice(0, 240) }}{{ r.text.length > 240 ? '…' : '' }}</p>
        </template>
        <template #footer>
          <div class="buttons">
            <Button size="small" icon="pi pi-pencil" class="mr-2" @click="openEdit(r)" :disabled="loading" />
            <Button size="small" variant="text" icon="pi pi-trash" severity="danger" @click="remove(r.id)" :disabled="loading" />
          </div>
        </template>
      </Card>
      <p v-if="!resumes.length">Нет резюме</p>
    </div>

    <Dialog v-model:visible="showCreate" modal header="Новое резюме" :style="{ width: '720px' }">
      <ResumeForm v-model="form" @submit="submitCreate" />
    </Dialog>

    <Dialog v-model:visible="showEdit" modal header="Редактировать резюме" :style="{ width: '720px' }">
      <ResumeForm v-model="form" @submit="submitEdit" />
    </Dialog>
  </div>
</template>

<style scoped>
.page { padding: 12px; }
.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.desc { white-space: pre-wrap; }
.buttons { display: flex; justify-content: flex-end; gap: 8px; }
</style>


