<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useVacancies } from '../composables/useVacancies'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Card from 'primevue/card'
import InputNumber from 'primevue/inputnumber'

const { vacancies, load, create, remove, loading } = useVacancies()

const reqTypes = [
  { value: 'technical_skill', label: 'Hard скилл' },
  { value: 'soft_skill', label: 'Soft скилл' },
]

const showCreate = ref(false)
type ReqRow = { id: string; description: string; type: 'technical_skill' | 'soft_skill'; weight: number }
const form = reactive<{ title: string; description_text: string; requirements: Array<ReqRow> }>(
  { title: '', description_text: '', requirements: [{ id: 'req1', description: '', type: 'technical_skill', weight: 1 }] }
)

function addReq() {
  const nextId = `req${form.requirements.length + 1}`
  form.requirements.push({ id: nextId, description: '', type: 'technical_skill', weight: 1 })
}
function delReq(idx: number) { 
  form.requirements.splice(idx, 1)
 }

async function submit() {
  const checklist = form.requirements.map(it => ({ id: it.id, description: it.description, type: it.type, weight: it.weight }))
  await create({ title: form.title, description_text: form.description_text, requirements_checklist: checklist })
  showCreate.value = false
  form.title = ''
  form.description_text = ''
  form.requirements = [{ id: 'req1', description: '', type: 'technical_skill', weight: 1 }]
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="header">
      <h2>Вакансии</h2>
      <Button label="Создать" icon="pi pi-plus" @click="showCreate = true" :disabled="loading" />
    </div>

    <div class="grid">
      <Card v-for="v in vacancies" :key="v.id" class="vacancy">
        <template #title>{{ v.title }}</template>
        <template #subtitle>#{ v.id.slice(0,6) }</template>
        <template #content>
          <p class="desc">{{ v.description_text }}</p>
          <ul class="reqs">
            <li v-for="(val, key) in v.requirements_checklist" :key="key"><strong>{{ key }}:</strong> {{ val }}</li>
          </ul>
        </template>
        <template #footer>
          <Button label="Удалить" icon="pi pi-trash" severity="danger" @click="remove(v.id)" :disabled="loading" />
        </template>
      </Card>
    </div>

    <Dialog v-model:visible="showCreate" modal header="Новая вакансия" :style="{ width: '720px' }">
      <div class="form">
        <label>Название</label>
        <InputText v-model="form.title" placeholder="Senior Node.js Developer" />

        <label>Описание</label>
        <Textarea v-model="form.description_text" rows="4" autoResize placeholder="Короткое описание позиции" />

        <label>Требования</label>
        <div class="req-list">
          <div v-for="(it, idx) in form.requirements" :key="idx" class="req-row">
            <InputText v-model="it.description" placeholder="Описание (напр. Знание React)" />
            <Select
              v-model="it.type"
              :options="reqTypes"
              optionLabel="label"
              optionValue="value"
              placeholder="Тип"
            />
            <InputNumber v-model="it.weight" :min="1" :max="10" mode="decimal" :step="0.1" inputClass="p-inputtext p-component" placeholder="Вес (1-10)" />
            <Button icon="pi pi-minus" severity="secondary" @click="delReq(idx)" outlined />
          </div>
          <Button icon="pi pi-plus" label="Добавить" @click="addReq" outlined />
        </div>

        <div class="actions">
          <Button label="Отмена" severity="secondary" @click="showCreate = false" />
          <Button label="Создать" @click="submit" :disabled="!form.title.trim()" />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.page { padding: 12px; }
.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.desc { white-space: pre-wrap; }
.reqs { margin: 8px 0 0; padding-left: 16px; }
.form { display: grid; gap: 10px; }
.req-list { display: grid; gap: 8px; }
.req-row { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 8px; align-items: center; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
</style>
