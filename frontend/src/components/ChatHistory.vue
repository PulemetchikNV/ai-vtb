<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useChat } from '../composables/useChat'
import { chatHistory } from '../__data__/store'

export type ChatItem = {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{ activeId: string | null; backendUrl?: string }>()
const emit = defineEmits<{ (e: 'select', id: string): void; (e: 'create'): void; (e: 'delete', id: string): void }>()

const loading = ref(false)

const {deleteChat, loadChatHistory}  = useChat()

function selectChat(id: string) {
  emit('select', id)
}

async function handleDeleteChat(id: string) {
  if (!id) return
  await deleteChat(id)
  emit('delete', id)
}

onMounted(loadChatHistory)
</script>

<template>
  <div class="history">
    <div class="header">
      <div class="title">История</div>
      <!-- <Button label="Новый" size="small" icon="pi pi-plus" @click="$emit('create')" /> -->
    </div>

    <div v-if="loading" class="list loading">
      <Skeleton v-for="i in 6" :key="i" height="36px" class="mb-8" />
    </div>

    <div v-else class="list">
      <div v-for="c in chatHistory" :key="c.id" class="row" :class="{ active: c.id === props.activeId }" @click="selectChat(c.id)">
        <div class="row-title">
          {{ c.title || 'Без названия' }}
          <Button size="small" rounded variant="text" icon="pi pi-trash" severity="danger" @click.stop="handleDeleteChat(c.id)" />
        </div>
        <div class="row-sub">#{{ c.id.slice(0,6) }}</div>
      </div>
      <div v-if="!chatHistory.length" class="empty">Нет чатов</div>
    </div>
  </div>
</template>

<style scoped>
.history { width: 100%; max-width: 280px; border-left: 1px solid var(--surface-border); padding-left: 12px; }
.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.title { font-weight: 600; }
.list { display: flex; flex-direction: column; gap: 8px; }
.row { padding: 8px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
.row:hover { background: var(--surface-ground); }
.row.active { border-color: var(--primary-300); background: var(--primary-50); }
.row-title { font-size: 14px; }
.row-sub { font-size: 12px; opacity: .7; }
.empty { opacity: .6; font-size: 14px; padding: 12px; text-align: center; }
@media (max-width: 900px) {
  .history { max-width: none; border-left: none; padding-left: 0; border-top: 1px solid var(--surface-border); padding-top: 12px; }
}
</style>
