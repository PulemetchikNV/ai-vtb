<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'
import Button from 'primevue/button'
import FloatLabel from 'primevue/floatlabel'
import { REQUIREMENT_TYPES } from '../__data__/constants'
import { ref, watch } from 'vue'

type ReqRow = { id: string; description: string; type: 'technical_skill' | 'soft_skill'; weight: number }
type FormModel = { title: string; description_text: string; requirements: Array<ReqRow>; weights: Record<string, number> }

const props = defineProps<{ modelValue: FormModel }>()
const emit = defineEmits<{ 
  (e: 'update:modelValue', v: FormModel): void;
  (e: 'add-req'): void;
  (e: 'del-req', idx: number): void;
  (e: 'submit', v: FormModel): void
}>()

const reqTypes = REQUIREMENT_TYPES as unknown as Array<{ value: 'technical_skill' | 'soft_skill'; label: string }>
const model = ref<FormModel>({...props.modelValue})

// Отслеживаем изменения весов и корректируем пропорции
function adjustWeights(changedType: string, newValue: number) {
  const weights = { ...model.value.weights }
  
  // Устанавливаем новое значение
  weights[changedType] = Math.max(0, Math.min(1, newValue))
  
  // Получаем остальные типы
  const otherTypes = reqTypes.filter(type => type.value !== changedType)
  
  if (otherTypes.length === 0) return weights
  
  // Вычисляем остаток для распределения
  const remaining = 1 - weights[changedType]
  
  // Получаем сумму остальных весов
  const otherSum = otherTypes.reduce((sum, type) => sum + weights[type.value], 0)
  
  if (otherSum > 0) {
    // Пропорционально распределяем остаток
    otherTypes.forEach(type => {
      const proportion = weights[type.value] / otherSum
      weights[type.value] = remaining * proportion
    })
  } else {
    // Если остальные веса равны 0, распределяем поровну
    const equalShare = remaining / otherTypes.length
    otherTypes.forEach(type => {
      weights[type.value] = equalShare
    })
  }
  
  model.value.weights = weights
  emit('update:modelValue', model.value)
}

// Функция для обновления веса конкретного типа
function updateWeight(type: string, value: number) {
  adjustWeights(type, value)
}

// Получаем процентное значение для отображения
function getPercentage(value: number): string {
  return `${Math.round(value * 100)}%`
}

function addReq() { 
  emit('add-req')
}

function delReq(idx: number) { 
  emit('del-req', idx)
}

function submit() {
  emit('submit', model.value)
}
</script>

<template>
  <div class="form">
    <label>Название</label>
    <InputText v-model="model.title" placeholder="Senior Node.js Developer" />

    <label>Описание</label>
    <Textarea v-model="model.description_text" rows="4" autoResize placeholder="Короткое описание позиции" />

    <label>Соотношение категорий</label>
    <div class="weights">
      <div v-for="type in reqTypes" :key="type.value" class="w-row">
        <span class="w-label">{{ type.label }}</span>
        <Slider 
          :modelValue="model.weights[type.value]" 
          @update:modelValue="(value) => updateWeight(type.value, Array.isArray(value) ? value[0] : value)"
          :min="0" 
          :max="1" 
          :step="0.01" 
          class="w-slider"
        />
        <div class="weight-display">
          <InputNumber 
            :modelValue="Math.round(model.weights[type.value] * 100)"
            @update:modelValue="(value) => updateWeight(type.value, (value || 0) / 100)"
            :min="0"
            :max="100"
            :step="1"
            mode="decimal"
            suffix="%"
            :id="`weight-${type.value}`"
            class="weight-input"
          />
        </div>
      </div>
      <div class="total-display">
        <span class="total-label">Общая сумма:</span>
        <span class="total-value">{{ getPercentage(Object.values(model.weights).reduce((sum, val) => sum + val, 0)) }}</span>
      </div>
    </div>

    <label>Требования</label>
    <div class="req-list">
      <div v-for="(it, idx) in model.requirements" :key="idx" class="req-row">
        <InputText v-model="it.description" placeholder="Описание (напр. Знание React)" />
        <Select v-model="it.type" :options="reqTypes" optionLabel="label" optionValue="value" placeholder="Тип" />
        <FloatLabel variant="on">
          <InputNumber 
            v-model="it.weight"
            :min="1"
            :max="10"
            mode="decimal"
            :step="0.1"
            inputClass="p-inputtext p-component"
            buttonLayout="stacked"
            :showButtons="true"
            id="addWeight"
          />
          <label for="addWeight">Доп. вес</label>
        </FloatLabel>
        <Button icon="pi pi-minus" severity="secondary" @click="delReq(idx)" outlined />
      </div>
      <Button icon="pi pi-plus" label="Добавить" @click="addReq" outlined />
    </div>

    <div class="actions">
      <slot name="actions">
        <Button label="Сохранить" @click="submit" :disabled="!model.title.trim()" />
      </slot>
    </div>
  </div>
</template>

<style scoped>
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
  font-size: 14px;
  opacity: 0.7;
}

.w-slider { 
  width: 100%;
}

.weight-display {
  display: flex;
  align-items: center;
}

.weight-input {
  width: 80px;
}

.total-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding: 8px;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  font-size: 14px;
}

.total-label {
  font-weight: 600;
  color: var(--text-color-secondary);
}

.total-value {
  font-weight: 700;
  color: var(--primary-color);
  font-size: 16px;
}

.req-list { 
  display: grid; 
  gap: 8px; 
}

.req-row { 
  display: grid; 
  grid-template-columns: 2fr 2fr 1fr auto; 
  gap: 8px; 
  align-items: center; 
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px; 
  margin-top: 8px; 
}
</style>


