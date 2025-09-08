<script setup lang="ts">
import { ref, onMounted, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { useChat } from '../composables/useChat'
import { useVoiceChat } from '../composables/useVoiceChat'

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
import Message from 'primevue/message'
import { useVacancies } from '../composables/useVacancies'
import { useResumes } from '../composables/useResumes'
import AnalysisView from '../components/AnalysisView.vue'

// Chat composable
const { startChat, sendMessage, fetchChat, chat, finishChat, currentChatId, messages, loadChatHistory, loading, analysis, analysisError, error: chatError, wsConnected, wsReconnecting, getErrorMessage } = useChat()
const router = useRouter()

// UI state
const activeTab = ref('text')
const inputText = ref('')
const selectedVacancyId = ref<string | null>(null)
const selectedResumeId = ref<string | null>(null)
const showNewChat = ref(false)
const { vacancies, load: loadVacancies } = useVacancies()
const { resumes, load: loadResumes } = useResumes()

async function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  await sendMessage(text)
  inputText.value = ''
}

// Voice/WebSocket area via composable
const voice = useVoiceChat(() => currentChatId.value)
const isRecording = voice.isRecording
const statusText = voice.statusText
const chunkCount = voice.chunkCount
const bytesSent = voice.bytesSent
const lastSegment = voice.lastSegment
const lastAudioText = voice.lastAudioText
const voiceError = voice.error
const wsAudioConnected = voice.wsAudioConnected
const wsChatConnected = voice.wsChatConnected
const getVoiceErrorMessage = voice.getErrorMessage

function startRecording() { voice.startRecording() }
function stopRecording() { voice.stopRecording() }

function handleNewChat() {
  showNewChat.value = true
}

async function confirmStartChat() {
  if (!selectedVacancyId.value) return
  const chat = await startChat(`Собеседование (${selectedVacancyId.value})`, selectedVacancyId.value, selectedResumeId.value || undefined)
  showNewChat.value = false
  router.push({ path: `/voice-chat/${chat.id}` })
  loadChatHistory()
}

async function handleDeleteChat(id: string) {
  if (currentChatId.value === id) {
    router.replace({ path: `/voice-chat` })
    chat.value = null
    messages.value = []
    analysis.value = null
    analysisError.value = false

    loadChatHistory()
  }
}

// Autostart chat on first mount
onMounted(async () => {
  await loadVacancies()
  await loadResumes()
  
  // Check for query parameters to auto-open new chat dialog
  const route = router.currentRoute.value
  if (route.query.newChat === 'true' && route.query.vacancy) {
    selectedVacancyId.value = route.query.vacancy as string
    showNewChat.value = true
    // Clean up the URL
    router.replace({ path: '/voice-chat' })
  } else if (currentChatId.value) {
    router.replace({ name: undefined, params: { chatId: currentChatId.value } as any })
  }
  // messages autoscroll handled inside Messages component
})

watchEffect(async () => {
  if (currentChatId.value) {
    analysis.value = null
    analysisError.value = false
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
            <Button 
              :label="chat?.is_finished ? 'Перегенерировать анализ' : 'Завершить'"
              icon="pi pi-check-circle"
              size="small"
              severity="success"
              class="ml-8"
              :disabled="!currentChatId || loading"
              :loading="loading"
              @click="finishChat"
            />
          </div>
        </div>

        <Divider class="my-12" />

        <!-- Общие ошибки чата -->
        <Message 
          v-if="chatError" 
          :severity="chatError.type === 'network' || chatError.type === 'websocket' ? 'warn' : 'error'" 
          :closable="true"
          @close="chatError = null"
          class="error-message"
        >
          <template #icon>
            <i class="pi" :class="{
              'pi-exclamation-triangle': chatError.type === 'validation',
              'pi-wifi': chatError.type === 'network',
              'pi-server': chatError.type === 'server',
              'pi-lock': chatError.type === 'auth',
              'pi-link': chatError.type === 'websocket',
              'pi-times-circle': chatError.type === 'unknown'
            }"></i>
          </template>
          {{ getErrorMessage(chatError) }}
          
          <!-- Статус подключения -->
          <div v-if="chatError.type === 'websocket'" class="connection-status">
            <small>
              WebSocket: {{ wsConnected ? '✅ Подключен' : wsReconnecting ? '🔄 Переподключение...' : '❌ Отключен' }}
            </small>
          </div>
        </Message>

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
                  <InputTextarea 
                    v-model="inputText" 
                    autoResize 
                    rows="1" 
                    :disabled="loading" 
                    placeholder="Введите сообщение..." 
                    class="flex-1"
                    :class="{ 'p-invalid': inputText.length > 10000 }"
                    @keydown.enter.exact.prevent="handleSend"
                  />
                  <Button 
                    icon="pi pi-send" 
                    label="Отправить" 
                    class="send-btn" 
                    :disabled="loading || !inputText.trim() || inputText.length > 10000" 
                    :loading="loading"
                    @click="handleSend" 
                  />
                </div>
                <small v-if="inputText.length > 9000" class="text-counter" :class="{ 'text-counter-warning': inputText.length > 10000 }">
                  {{ inputText.length }} / 10,000 символов
                </small>

                <Divider class="my-12" />
                <div v-if="analysis" class="analysis">
                  <AnalysisView :analysis="analysis as any" />
                  <div v-if="analysisError" class="error mt-8">
                    <Button label="Пересоздать отчёт" icon="pi pi-refresh" @click="finishChat" />
                  </div>
                </div>
              </TabPanel>

              <TabPanel value="voice">
                <div class="voice">
                  <!-- Ошибки голосового чата -->
                  <Message 
                    v-if="voiceError" 
                    :severity="voiceError.type === 'permission' ? 'warn' : 'error'" 
                    :closable="true"
                    @close="voiceError = null"
                    class="voice-error-message"
                  >
                    <template #icon>
                      <i class="pi" :class="{
                        'pi-microphone': voiceError.type === 'permission',
                        'pi-volume-up': voiceError.type === 'audio',
                        'pi-link': voiceError.type === 'websocket',
                        'pi-wifi': voiceError.type === 'network',
                        'pi-server': voiceError.type === 'server',
                        'pi-times-circle': voiceError.type === 'unknown'
                      }"></i>
                    </template>
                    {{ getVoiceErrorMessage(voiceError) }}
                  </Message>

                  <div class="voice-stats">
                    <div class="stat-item">
                      <span class="label">Статус:</span> 
                      <span class="value" :class="{
                        'status-connected': statusText === 'connected',
                        'status-error': statusText === 'error' || statusText === 'permission-error',
                        'status-disconnected': statusText === 'disconnected' || statusText === 'closed'
                      }">{{ statusText }}</span>
                    </div>
                    <div class="stat-item"><span class="label">Чанков:</span> <span class="value">{{ chunkCount }}</span></div>
                    <div class="stat-item"><span class="label">Байт:</span> <span class="value">{{ bytesSent }}</span></div>
                    <div class="stat-item">
                      <span class="label">Аудио:</span> 
                      <span class="value">{{ wsAudioConnected ? '✅' : '❌' }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="label">Чат:</span> 
                      <span class="value">{{ wsChatConnected ? '✅' : '❌' }}</span>
                    </div>
                  </div>
                  <div class="voice-actions">
                    <Button 
                      label="Старт" 
                      icon="pi pi-microphone" 
                      :disabled="isRecording || !currentChatId" 
                      @click="startRecording"
                      :severity="voiceError?.type === 'permission' ? 'warn' : 'primary'"
                    />
                    <Button 
                      label="Стоп" 
                      icon="pi pi-stop" 
                      severity="danger" 
                      :disabled="!isRecording" 
                      class="ml-8" 
                      @click="stopRecording" 
                    />
                  </div>

                  <Divider class="my-12" />

                  <div class="emotions" v-if="lastSegment">
                    <div class="emo-row">
                      <span class="label">Распознано:</span>
                      <span class="value">{{ lastSegment?.recognized_text }}</span>
                    </div>
                    <div class="emo-row">
                      <span class="label">Модель/уверенность:</span>
                      <span class="value">{{ lastSegment?.sentiment_model || '-' }} / {{ lastSegment?.sentiment_confidence ?? '-' }}</span>
                    </div>
                    <div class="emo-row">
                      <span class="label">Эмоция:</span>
                      <span class="value">{{ lastSegment?.final_emotion?.label || '-' }}</span>
                    </div>
                    <div class="emo-row">
                      <span class="label">Паузы:</span>
                      <span class="value">{{ lastSegment?.pause_count ?? 0 }} (∑ {{ lastSegment?.total_pause_duration_seconds ?? 0 }}s)</span>
                    </div>
                  </div>

                  <div class="tts" v-if="lastAudioText">
                    <div class="emo-row">
                      <span class="label">TTS ответ:</span>
                      <span class="value">{{ lastAudioText }}</span>
                    </div>
                  </div>

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
      <label>Выберите вакансию *</label>
      <Dropdown 
        v-model="selectedVacancyId" 
        :options="vacancies" 
        optionLabel="title" 
        optionValue="id" 
        placeholder="Выбор вакансии" 
        class="w-full" 
        style="width: 100%"
        :class="{ 'p-invalid': !selectedVacancyId && showNewChat }"
      />
      <small v-if="!selectedVacancyId && showNewChat" class="validation-error">
        Выбор вакансии обязателен
      </small>
      
      <label class="mt-12">Выберите резюме (опционально)</label>
      <Dropdown 
        v-model="selectedResumeId" 
        :options="resumes" 
        optionLabel="fileName" 
        optionValue="id" 
        placeholder="Выбор резюме" 
        class="w-full" 
        style="width: 100%" 
      />
      <small class="help-text">
        Резюме поможет AI лучше понять кандидата
      </small>
      
      <div class="actions mt-12">
        <Button label="Отмена" severity="secondary" @click="showNewChat = false" />
        <Button 
          label="Начать" 
          icon="pi pi-arrow-right" 
          @click="confirmStartChat" 
          :disabled="!selectedVacancyId"
          :loading="loading"
        />
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

.error-message { 
  margin-bottom: 1rem; 
}

.connection-status {
  margin-top: 0.5rem;
  opacity: 0.8;
}

.voice-error-message {
  margin-bottom: 1rem;
}

.status-connected {
  color: var(--green-500);
  font-weight: 600;
}

.status-error {
  color: var(--red-500);
  font-weight: 600;
}

.status-disconnected {
  color: var(--text-color-secondary);
}

.text-counter {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
  margin-top: 0.25rem;
  display: block;
}

.text-counter-warning {
  color: var(--red-500);
  font-weight: 600;
}

.new-chat-form { 
  display: grid; 
  gap: 1rem; 
}

.new-chat-form label {
  font-weight: 600;
  color: var(--text-color);
}

.validation-error {
  color: var(--red-500);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.help-text {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.mt-12 { margin-top: 12px; }

.analysis { text-align: left; }
.analysis .json {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 8px;
  overflow: auto;
}
.analysis .error { margin-top: 8px; }

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
