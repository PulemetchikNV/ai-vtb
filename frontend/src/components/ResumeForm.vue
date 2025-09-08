<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import FileUpload from 'primevue/fileupload'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ref, computed } from 'vue'
import type { ResumeForm as Form } from '../types/resume'

const model = defineModel<Form>({ required: true })
const props = defineProps<{ loading?: boolean }>()
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

const fileError = ref<string>('')
const validationErrors = ref<string[]>([])

// Валидация формы
const isFormValid = computed(() => {
  const errors: string[] = []
  
  if (!model.value.fileName?.trim()) {
    errors.push('Название файла обязательно')
  }
  
  if (!model.value.file && !model.value.text?.trim()) {
    errors.push('Необходимо загрузить файл или ввести текст резюме')
  }
  
  if (model.value.text && model.value.text.length > 100000) {
    errors.push('Текст резюме слишком длинный (максимум 100,000 символов)')
  }
  
  validationErrors.value = errors
  return errors.length === 0 && !fileError.value
})

function onFileSelect(e: any) {
  const file = e.files?.[0]
  if (!file) return
  
  fileError.value = ''
  
  // Проверка размера файла
  if (file.size > 10 * 1024 * 1024) {
    fileError.value = 'Размер файла превышает 10 МБ'
    return
  }
  
  // Проверка типа файла
  const allowedTypes = [
    'application/pdf',
    'application/rtf', 
    'text/rtf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
  
  if (!allowedTypes.includes(file.type)) {
    fileError.value = 'Поддерживаются только файлы PDF, RTF и DOCX'
    return
  }
  
  model.value.fileName = file.name
  model.value.file = file
}

function handleSubmitClick() {
  if (isFormValid.value) {
    emit('submit', model.value)
  }
}
</script>

<template>
  <div class="form">
    <!-- Ошибки валидации -->
    <Message 
      v-if="validationErrors.length > 0" 
      severity="warn" 
      :closable="false"
      class="validation-message"
    >
      <template #icon>
        <i class="pi pi-exclamation-triangle"></i>
      </template>
      <ul class="error-list">
        <li v-for="error in validationErrors" :key="error">{{ error }}</li>
      </ul>
    </Message>

    <div class="row">
      <label>Название файла</label>
      <InputText 
        v-model="model.fileName" 
        placeholder="resume.pdf" 
        :disabled="props.loading"
        :class="{ 'p-invalid': validationErrors.some(e => e.includes('Название файла')) }"
      />
    </div>
    <div class="row">
      <label>PDF / DOC файл</label>
      <FileUpload 
        mode="basic"
        name="pdf"
        :auto="false"
        :accept="acceptString"
        chooseLabel="Загрузить файл"
        :maxFileSize="10 * 1024 * 1024"
        :disabled="props.loading"
        @select="onFileSelect"
        class="file-upload"
        :class="{ 'p-invalid': !!fileError }"
      />
      <small class="file-help">
        Поддерживаются форматы: PDF, RTF, DOCX (до 10 МБ)
      </small>
      
      <!-- Ошибка файла -->
      <Message 
        v-if="fileError" 
        severity="error" 
        :closable="false"
        class="file-error"
      >
        <template #icon>
          <i class="pi pi-times-circle"></i>
        </template>
        {{ fileError }}
      </Message>
    </div>
    <div class="row">
      <label>Текст (опционально)</label>
      <Textarea 
        v-model="model.text" 
        rows="8" 
        autoResize 
        placeholder="Текст резюме, если нет файла" 
        :disabled="props.loading"
        :class="{ 'p-invalid': validationErrors.some(e => e.includes('Текст резюме')) }"
      />
      <small class="text-counter" :class="{ 'text-counter-warning': model.text && model.text.length > 90000 }">
        {{ model.text?.length || 0 }} / 100,000 символов
      </small>
    </div>
    
    <!-- Loading States -->
    <div v-if="props.loading" class="loading-state">
      <div class="loading-content">
        <i class="pi pi-spin pi-spinner"></i>
        <span v-if="model.file" class="loading-text">
          Загружаем и обрабатываем файл...
        </span>
        <span v-else class="loading-text">
          Сохраняем резюме...
        </span>
      </div>
    </div>
    
    <div class="actions">
      <slot name="actions">
        <Button 
          @click="handleSubmitClick" 
          :loading="props.loading"
          :disabled="!isFormValid || props.loading"
          icon="pi pi-save"
          label="Сохранить"
          :severity="isFormValid ? 'primary' : 'secondary'"
        />
      </slot>
    </div>
  </div>
  
</template>

<style scoped>
.form { 
  display: grid; 
  gap: 1rem; 
}

.row { 
  display: grid; 
  gap: 0.5rem; 
}

.row label {
  font-weight: 600;
  color: var(--text-color);
  font-size: 0.9rem;
}

.file-help {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.file-upload {
  width: 100%;
}

.validation-message {
  margin-bottom: 1rem;
}

.error-list {
  margin: 0;
  padding-left: 1.5rem;
  list-style-type: disc;
}

.error-list li {
  margin-bottom: 0.25rem;
}

.file-error {
  margin-top: 0.5rem;
}

.text-counter {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
  margin-top: 0.25rem;
  display: block;
}

.text-counter-warning {
  color: var(--orange-500);
  font-weight: 600;
}

.loading-state {
  padding: 1rem;
  background: var(--surface-section);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  margin: 0.5rem 0;
}

.loading-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
}

.loading-content i {
  font-size: 1.25rem;
  color: var(--p-primary-color);
}

.loading-text {
  color: var(--text-color);
  font-weight: 500;
}

.actions { 
  display: flex; 
  justify-content: flex-end; 
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border);
}
</style>


