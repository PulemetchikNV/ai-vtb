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
import Dropdown from 'primevue/dropdown'
import Dialog from 'primevue/dialog'
import { useVacancies } from '../composables/useVacancies'

// Chat composable
const { startChat, sendMessage, fetchChat, deleteChat, finishChat, currentChatId, messages, loadChatHistory, loading } = useChat()
const route = useRoute()
const router = useRouter()

// UI state
const activeTab = ref('text')
const inputText = ref('')
const selectedVacancyId = ref<string | null>(null)
const showNewChat = ref(false)
const { vacancies, load: loadVacancies } = useVacancies()

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

    const cid = currentChatId.value
    const wsUrl = `ws://localhost:3000/ws/audio${cid ? `?chatId=${encodeURIComponent(cid)}` : ''}`
    ws = new WebSocket(wsUrl)
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

function handleNewChat() {
  showNewChat.value = true
}

async function confirmStartChat() {
  if (!selectedVacancyId.value) return
  const chat = await startChat(`Собеседование (${selectedVacancyId.value})`, selectedVacancyId.value)
  showNewChat.value = false
  router.push({ path: `/voice-chat/${chat.id}` })
  loadChatHistory()
}

async function handleDeleteChat(id: string) {
  if (currentChatId.value === id) router.replace({ path: `/voice-chat` })
}

// Autostart chat on first mount
onMounted(async () => {
  await loadVacancies()
  if (currentChatId.value) {
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
            <Button label="Удалить" icon="pi pi-trash" size="small" severity="danger" class="ml-8" @click="handleDeleteChat(currentChatId as string)" :disabled="!currentChatId || loading" />
            <Button label="Завершить" icon="pi pi-check-circle" size="small" severity="success" class="ml-8" @click="finishChat" :disabled="!currentChatId || loading" />
          </div>
        </div>

        <Divider class="my-12" />

        <div class="content">
          <div class="main">
            <div v-if="!currentChatId" class="placeholder">
              <p>Создайте новый чат или выберите существующий в истории справа.</p>
            </div>
            <template v-else>
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
            </template>
          </div>
          <div class="aside">
            <div class="chat-history-wrapper">
              <ChatHistory 
                :active-id="currentChatId"
                :loading="loading"
                @select="id => router.push({ path: `/voice-chat/${id}` })"
                @create="handleNewChat"
                @delete="handleDeleteChat"
              />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  </div>
  
  <Dialog v-model:visible="showNewChat" modal header="Новый диалог" :style="{ width: '520px' }">
    <div class="new-chat-form">
      <label>Выберите вакансию</label>
      <Dropdown v-model="selectedVacancyId" :options="vacancies" optionLabel="title" optionValue="id" placeholder="Выбор вакансии" class="w-full" style="width: 100%" />
      <div class="actions mt-12">
        <Button label="Отмена" severity="secondary" @click="showNewChat = false" />
        <Button label="Начать" icon="pi pi-arrow-right" @click="confirmStartChat" :disabled="!selectedVacancyId" />
      </div>
    </div>
  </Dialog>

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

.placeholder {
  display: grid;
  place-items: center;
  height: 50vh;
  color: var(--text-color-secondary, #6b7280);
  border: 1px dashed var(--surface-border);
  border-radius: 8px;
}

.new-chat-form { display: grid; gap: 10px; }
.mt-12 { margin-top: 12px; }

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
