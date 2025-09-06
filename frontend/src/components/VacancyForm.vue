<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'
import Button from 'primevue/button'
import { computed } from 'vue'
import { REQUIREMENT_TYPES } from '../__data__/constants'

type ReqRow = { id: string; description: string; type: 'technical_skill' | 'soft_skill'; weight: number }
type FormModel = { title: string; description_text: string; requirements: Array<ReqRow>; weights: Record<string, number> }

const props = defineProps<{ modelValue: FormModel }>()
const emit = defineEmits<{ 
  (e: 'update:modelValue', v: FormModel): void;
  (e: 'add-req'): void;
  (e: 'del-req', idx: number): void;
  (e: 'submit'): void
}>()

const reqTypes = REQUIREMENT_TYPES as unknown as Array<{ value: 'technical_skill' | 'soft_skill'; label: string }>
const model = computed({
  get: () => ({...props.modelValue}),
  set: (v: FormModel) => emit('update:modelValue', v)
})

function addReq() { 
  emit('add-req')
}

function delReq(idx: number) { 
  emit('del-req', idx)
}

function submit() {
  emit('submit')
}
</script>

<template>
  <div class="form">
    <label>Название</label>
    <InputText v-model="model.title" placeholder="Senior Node.js Developer" />

    <label>Описание</label>
    <Textarea v-model="model.description_text" rows="4" autoResize placeholder="Короткое описание позиции" />

    <label>Вес категорий</label>
    <div class="weights">
      <div v-for="type in reqTypes" :key="type.value" class="w-row">
        <span class="w-label">{{ type.label }}</span>
        <Slider v-model="model.weights[type.value]" :min="0" :max="1" :step="0.05" class="w-slider"/>
        <InputNumber v-model="model.weights[type.value]" :min="0" :max="1" :step="0.05" mode="decimal" />
      </div>
    </div>

    <label>Требования</label>
    <div class="req-list">
      <div v-for="(it, idx) in model.requirements" :key="idx" class="req-row">
        <InputText v-model="it.description" placeholder="Описание (напр. Знание React)" />
        <Select v-model="it.type" :options="reqTypes" optionLabel="label" optionValue="value" placeholder="Тип" />
        <InputNumber v-model="it.weight" :min="1" :max="10" mode="decimal" :step="0.1" inputClass="p-inputtext p-component" placeholder="Вес (1-10)" />
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
</style>


