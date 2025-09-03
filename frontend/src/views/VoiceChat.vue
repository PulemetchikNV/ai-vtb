<script setup lang="ts">
import { ref, onMounted, nextTick, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChat } from '../composables/useChat'

// PrimeVue components
import Button from 'primevue/button'
import InputTextarea from 'primevue/textarea'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Divider from 'primevue/divider'
import Panel from 'primevue/panel'
import ChatHistory from '../components/ChatHistory.vue'
import Messages from '../components/Messages.vue'

// Chat composable
const { startChat, sendMessage, fetchChat, deleteChat, currentChatId, messages, loadChatHistory, loading } = useChat()
const route = useRoute()
const router = useRouter()

// UI state
const activeTab = ref('text')
const inputText = ref('')

async function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  await sendMessage(text)
  inputText.value = ''
}

// Voice/WebSocket area
const isRecording = ref(false)
const statusText = ref('disconnected')
const chunkCount = ref(0)
const bytesSent = ref(0)

let mediaRecorder: MediaRecorder | null = null
let ws: WebSocket | null = null
let stream: MediaStream | null = null

async function startRecording() {
  if (isRecording.value) return
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    ws = new WebSocket('ws://localhost:3000/ws/audio')
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      statusText.value = 'connected'
      mediaRecorder = new MediaRecorder(stream as MediaStream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorder.ondataavailable = (ev: BlobEvent) => {
        if (!ev.data || ev.data.size === 0) return
        ev.data.arrayBuffer().then((buf) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(buf)
            chunkCount.value += 1
            bytesSent.value += buf.byteLength
          }
        })
      }
      mediaRecorder.start(250)
      isRecording.value = true
    }

    ws.onclose = () => {
      statusText.value = 'closed'
    }

    ws.onerror = () => {
      statusText.value = 'error'
    }
  } catch (err) {
    statusText.value = 'permission-error'
    console.error(err)
  }
}

function stopRecording() {
  if (!isRecording.value) return
  mediaRecorder?.stop()
  mediaRecorder = null
  ws?.close()
  ws = null
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
  isRecording.value = false
}

async function handleNewChat() {
  const chat = await startChat('Новый чат')
  router.push({ path: `/voice-chat/${chat.id}` })
  loadChatHistory()
}

async function handleDeleteChat() {
  if (!currentChatId.value) return
  await deleteChat(currentChatId.value)

  const chat = await startChat('Новый чат')
  router.replace({ path: `/voice-chat/${chat.id}` })
}

// Autostart chat on first mount
onMounted(async () => {
  if (!currentChatId.value) {
    const chat = await startChat('Новый чат')
    router.replace({ name: undefined, params: { chatId: chat.id } as any })
  } else {
    router.replace({ name: undefined, params: { chatId: currentChatId.value } as any })
  }
  // messages autoscroll handled inside Messages component
})

watchEffect(async () => {
  if (currentChatId.value) {
    await fetchChat(currentChatId.value)
  }
})
</script>

<template>
  <div class="chat-page">
    <div class="chat-container">
      <Panel>
      <!-- Header -->
        <div class="chat-header">
          <div class="title">
            <span class="app-title">Чат</span>
            <span class="chat-id" v-if="currentChatId">#{{ currentChatId?.slice(0, 6) }}</span>
          </div>
          <div class="actions">
            <Button label="Новый" icon="pi pi-plus" size="small" @click="handleNewChat" :disabled="loading" />
            <Button label="Удалить" icon="pi pi-trash" size="small" severity="danger" class="ml-8" @click="handleDeleteChat" :disabled="!currentChatId || loading" />
          </div>
        </div>

        <Divider class="my-12" />

        <div class="content">
          <div class="main">
            <!-- Tabs for modes (PrimeVue 4 Tabs API) -->
            <Tabs v-model:value="activeTab">
              <TabList>
                <Tab value="text">Текст</Tab>
                <Tab value="voice">Звонок</Tab>
              </TabList>
              <TabPanels>
              <TabPanel value="text">
                <Messages :messages="messages" />

                <!-- Input area -->
                <div class="input-bar">
                  <InputTextarea v-model="inputText" autoResize rows="1" :disabled="loading" placeholder="Введите сообщение..." class="flex-1" />
                  <Button icon="pi pi-send" label="Отправить" class="send-btn" :disabled="loading || !inputText.trim()" @click="handleSend" />
                </div>
              </TabPanel>

              <TabPanel value="voice">
                <div class="voice">
                  <div class="voice-stats">
                    <div class="stat-item"><span class="label">Статус:</span> <span class="value">{{ statusText }}</span></div>
                    <div class="stat-item"><span class="label">Чанков:</span> <span class="value">{{ chunkCount }}</span></div>
                    <div class="stat-item"><span class="label">Байт:</span> <span class="value">{{ bytesSent }}</span></div>
                  </div>
                  <div class="voice-actions">
                    <Button label="Старт" icon="pi pi-microphone" :disabled="isRecording" @click="startRecording" />
                    <Button label="Стоп" icon="pi pi-stop" severity="danger" :disabled="!isRecording" class="ml-8" @click="stopRecording" />
                  </div>

                  <Divider class="my-12" />

                  <Messages :messages="messages" />
                </div>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </div>
          <div class="aside">
            <div class="chat-history-wrapper">
              <ChatHistory 
                :active-id="currentChatId"
                :loading="loading"
                @select="id => router.push({ path: `/voice-chat/${id}` })"
                @create="handleNewChat"
                @delete="loadChatHistory"
              />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  </div>
  
</template>

<style scoped>
.ml-8 { margin-left: 8px; }
.my-12 { margin-top: 12px; margin-bottom: 12px; }

.chat-page {
  display: flex;
  justify-content: center;
  padding: 12px;
}

.chat-container {
  width: 100%;
  max-width: 920px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 12px;
}

.content { display: grid; grid-template-columns: 1fr 280px; gap: 12px; }
.main { min-width: 0; }
.aside { min-width: 0; }

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title { display: flex; align-items: baseline; gap: 8px; }
.app-title { font-size: 18px; font-weight: 600; }
.chat-id { font-size: 12px; opacity: 0.7; }

/* Messages styles moved into Messages.vue */

.input-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin-top: 10px;
}
.send-btn { white-space: nowrap; }

.voice { display: flex; flex-direction: column; gap: 12px; }
.voice-stats { display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; }
.stat-item .label { opacity: 0.7; margin-right: 6px; }
.voice-actions { display: flex; align-items: center; }

.chat-history-wrapper {
  max-height: calc(65vh);
  overflow-y: auto;
}

/* Mobile tweaks */
@media (max-width: 600px) {
  .chat-container { padding: 8px; border: none; border-radius: 0; }
  .messages { height: 50vh; }
  .msg .bubble { max-width: 90%; }
}

@media (max-width: 900px) {
  .content { grid-template-columns: 1fr; }
}
</style>
