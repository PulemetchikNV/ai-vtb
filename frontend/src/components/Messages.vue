<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import Avatar from 'primevue/avatar'

type Message = {
  id: string
  chatId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

const props = defineProps<{ messages: Message[] }>()

const listRef = ref<HTMLDivElement | null>(null)

function scrollToBottom() {
  const el = listRef.value
  if (el) el.scrollTop = el.scrollHeight
}

onMounted(async () => {
  await nextTick()
  scrollToBottom()
})

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)
</script>

<template>
  <div ref="listRef" class="messages">
    <div v-for="m in props.messages" :key="m.id" class="msg" :class="m.role">
      <div class="avatar">
        <Avatar :label="m.role === 'user' ? 'U' : 'A'" :severity="m.role === 'user' ? 'info' : 'success'" shape="circle" size="large" />
      </div>
      <div class="bubble">
        <div class="content">{{ m.content }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.messages {
  height: calc(60vh - 80px);
  overflow-y: auto;
  padding: 8px;
  background: var(--surface-ground);
  border-radius: 8px;
}

.msg { display: flex; gap: 8px; margin-bottom: 10px; }
.msg.user { flex-direction: row-reverse; }
.msg .avatar { flex-shrink: 0; }
.msg .bubble {
  max-width: 80%;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
}
.msg.user .bubble { background: var(--primary-50); border-color: var(--primary-200); }
.msg .content { white-space: pre-wrap; word-break: break-word; }

@media (max-width: 600px) {
  .messages { height: 50vh; }
  .msg .bubble { max-width: 90%; }
}
</style>


