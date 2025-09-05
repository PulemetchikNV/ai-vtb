<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import Avatar from 'primevue/avatar'
import Chip from 'primevue/chip';

type Message = {
  id: string
  chatId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

const props = defineProps<{ messages: Message[] }>()
const filteredMessages = computed(() => props.messages.filter(m => m.content !== ''))

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
  () => filteredMessages.value.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)
</script>

<template>
  <div ref="listRef" class="messages">
    <div v-for="m in filteredMessages" :key="m.id" class="msg" :class="m.role">
      <template v-if="m.role !== 'system'">
        <div class="avatar">
          <Avatar :label="m.role === 'user' ? 'U' : 'A'" :severity="m.role === 'user' ? 'info' : 'success'" shape="circle" size="large" />
        </div>
        <div class="bubble">
          <div class="content">{{ m.content }}</div>
        </div>
      </template>
      <template v-else>
        <Chip :label="m.content" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.messages {
  height: calc(60vh - 80px);
  overflow-y: auto;
  background: var(--surface-ground);
  border-radius: 8px;
}

.msg { 
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.msg.user { 
  flex-direction: row-reverse; 
}

.msg .avatar { 
  flex-shrink: 0; 
  margin-inline: 5px;
}

.msg .bubble {
  max-width: 80%;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
}

.msg.user .bubble {
  background: var(--p-primary-50);
  border-color: var(--p-primary-200);
}

.msg .content {
  white-space: pre-wrap;
  word-break: break-word;
}

.msg.system { 
  display: flex;
  justify-content: center;
  margin-block: 5px;
}

@media (max-width: 600px) {
  .messages { height: 50vh; }
  .msg .bubble { max-width: 90%; }
}
</style>


