<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import FileUpload from 'primevue/fileupload'
import Button from 'primevue/button'
import type { ResumeForm as Form } from '../types/resume'

const model = defineModel<Form>({ required: true })
defineProps<{ loading: boolean }>()
const emit = defineEmits<{ submit: [Form] }>()
const acceptTypes = [
  'application/pdf',
  'application/rtf',
  'text/rtf',
  '.rtf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.docx'
]
const acceptString = acceptTypes.join(',')

function onFileSelect(e: any) {
  const file = e.files?.[0]
  if (!file) return
  model.value.fileName = file.name
  model.value.file = file
}

function handleSubmitClick() {
  emit('submit', model.value)
}
</script>

<template>
  <div class="form">
    <div class="row">
      <label>Название файла</label>
      <InputText v-model="model.fileName" placeholder="resume.pdf" />
    </div>
    <div class="row">
      <label>PDF</label>
      <FileUpload 
        mode="basic"
        name="pdf"
        :auto="false"
        :accept="acceptString"
        chooseLabel="Загрузить PDF"
        :maxFileSize="10 * 1024 * 1024"
        :disabled="loading"
        @select="onFileSelect"
      />
    </div>
    <div class="row">
      <label>Текст (опционально)</label>
      <Textarea v-model="model.text" rows="8" autoResize placeholder="Текст резюме, если нет PDF" />
    </div>
    <p v-if="loading && model.file">Парсим файл...</p>
    <p v-else-if="loading">Загрузка...</p>
    
    <div class="actions">
      <slot name="actions">
        <Button @click="handleSubmitClick">Сохранить</Button>
      </slot>
    </div>
  </div>
  
</template>

<style scoped>
.form { display: grid; gap: 10px; }
.row { display: grid; gap: 6px; }
.actions { display: flex; justify-content: flex-end; }
</style>


