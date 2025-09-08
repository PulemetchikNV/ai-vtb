<script setup lang="ts">
import { ref, onMounted, onUnmounted, watchEffect, onBeforeMount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
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
import { synthesizeAndPlay } from '../services/ttsClient'

// Chat composable
const { startChat, sendMessage, fetchChat, chat, finishChat, currentChatId, messages, loadChatHistory, loading, analysis, analysisError, error: chatError, wsConnected, wsReconnecting, getErrorMessage } = useChat()
const route = useRoute()
const router = useRouter()

// UI state
const activeTab = ref('voice') // Дефолт - звуковая вкладка
const inputText = ref('')
const selectedVacancyId = ref<string | null>(null)
const selectedResumeId = ref<string | null>(null)
const showNewChat = ref(false)
const { vacancies, load: loadVacancies } = useVacancies()
const { resumes, load: loadResumes } = useResumes()

// HR режим просмотра (только чтение)
const isHrViewMode = ref(false)

// Voice UI state
const isAssistantSpeaking = ref(false)
const currentAssistantText = ref('')
const typingSpeed = 70 // миллисекунды между символами
const typingDelay = 0 // задержка перед началом печати (мс)
const isTyping = ref(false)
const isProcessingMessage = ref(false) // индикатор обработки записанного сообщения
const isWaitingForAI = ref(false) // индикатор ожидания ответа от AI
let typingInterval: number | null = null

async function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  await sendMessage(text)
  inputText.value = ''
}

// Voice/WebSocket area via composable
const voice = useVoiceChat(() => currentChatId.value)
const isRecording = voice.isRecording
const lastSegment = voice.lastSegment
const voiceError = voice.error
const wsAudioConnected = voice.wsAudioConnected
const wsChatConnected = voice.wsChatConnected
const getVoiceErrorMessage = voice.getErrorMessage

function startRecording() { voice.startRecording() }
function stopRecording() { 
  voice.stopRecording()
  // Устанавливаем флаг обработки сообщения после остановки записи
  isProcessingMessage.value = true
}

// Функции для синхронизации текста со звуком
function startTypingEffect(text: string) {
  if (typingInterval) {
    clearInterval(typingInterval)
  }
  
  currentAssistantText.value = ''
  isTyping.value = true
  
  // Задержка перед началом печати
  setTimeout(() => {
    let index = 0
    
    typingInterval = setInterval(() => {
      if (index < text.length) {
        currentAssistantText.value += text[index]
        index++
      } else {
        clearInterval(typingInterval!)
        typingInterval = null
        isTyping.value = false
      }
    }, typingSpeed)
  }, typingDelay)
}

function stopTypingEffect() {
  if (typingInterval) {
    clearInterval(typingInterval)
    typingInterval = null
  }
  isTyping.value = false
}

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

// Обработчик TTS событий
function handleTTSMessage(event: CustomEvent) {
  const { text } = event.detail
  
  // Начинаем воспроизведение и синхронизацию
  isAssistantSpeaking.value = true
  
  synthesizeAndPlay(text, {
    onStart: () => {
      startTypingEffect(text)
    },
    onEnd: () => {
      isAssistantSpeaking.value = false
      currentAssistantText.value = text // Показываем полный текст
    },
    onError: (error) => {
      console.error('TTS Error:', error)
      isAssistantSpeaking.value = false
      stopTypingEffect()
      currentAssistantText.value = text // Показываем полный текст даже при ошибке
    }
  }).catch(error => {
    console.error('TTS playback failed:', error)
    isAssistantSpeaking.value = false
    stopTypingEffect()
    currentAssistantText.value = text
  })
}

onBeforeMount(() => {
  const route = router.currentRoute.value
  if (route.query.is_hr_view === 'true') {
    isHrViewMode.value = true
    activeTab.value = 'text' // Принудительно устанавливаем текстовый режим для HR
  }
})

// Autostart chat on first mount
onMounted(async () => {
  await loadVacancies()
  await loadResumes()
  
  // Подписываемся на TTS события только если не HR режим
  if (!isHrViewMode.value) {
    window.addEventListener('tts-message', handleTTSMessage as EventListener)
  }
  
  // Check for query parameters to auto-open new chat dialog
  if (route.query.newChat === 'true' && route.query.vacancy) {
    selectedVacancyId.value = route.query.vacancy as string
    showNewChat.value = true
    // Clean up the URL
    router.replace({ path: '/voice-chat' })
  } else if (currentChatId.value) {
    router.replace({ 
      name: undefined,
      params: { chatId: currentChatId.value } as any,
      query: { 
        is_hr_view: String(isHrViewMode.value),
        newChat: String(showNewChat.value)
      }
    })
  }
  // messages autoscroll handled inside Messages component
})

onUnmounted(() => {
  // Отписываемся от событий и очищаем интервалы
  window.removeEventListener('tts-message', handleTTSMessage as EventListener)
  stopTypingEffect()
})

watchEffect(async () => {
  if (currentChatId.value) {
    analysis.value = null
    analysisError.value = false
    await fetchChat(currentChatId.value)
  }
})

// Отслеживаем новые сообщения для управления состояниями
watchEffect(() => {
  if (messages.value.length > 0) {
    const lastMessage = messages.value[messages.value.length - 1]
    
    // Если получили новое user сообщение
    if (lastMessage.role === 'user') {
      if (isProcessingMessage.value) {
        isProcessingMessage.value = false
        // Начинаем ожидание ответа AI
        isWaitingForAI.value = true
      }
    }
    
    // Если получили новое assistant сообщение
    if (lastMessage.role === 'assistant') {
      if (isWaitingForAI.value) {
        isWaitingForAI.value = false
      }
    }
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
          <div class="actions" v-if="!isHrViewMode">
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

        <div class="content" :class="{ 'hr-mode': isHrViewMode }">
          <div class="main">
            <div v-if="!currentChatId" class="placeholder">
              <p>Создайте новый чат или выберите существующий в истории справа.</p>
            </div>
            <template v-else>
            <!-- Tabs for modes (PrimeVue 4 Tabs API) -->
            <Tabs v-model:value="activeTab" v-if="!isHrViewMode">
              <TabList>
                <Tab value="voice">Звонок</Tab>
                <Tab value="text">Текст</Tab>
              </TabList>
              <TabPanels>
              <TabPanel value="voice">
                <!-- Call Interface -->
                <div class="call-interface">
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

                  <!-- Main Call Area -->
                  <div class="call-main">
                    <!-- Assistant Speaking Area -->
                    <div class="speaker-area" :class="{ 'speaking': isAssistantSpeaking, 'thinking': isWaitingForAI }">
                      <div class="speaker-avatar">
                        <i class="pi" :class="{ 
                          'pi-user': !isWaitingForAI, 
                          'pi-spin pi-spinner': isWaitingForAI,
                          'pulse': isAssistantSpeaking 
                        }"></i>
                      </div>
                      <div class="speaker-content">
                        <div class="speaker-label">AI Собеседник</div>
                        <div class="speaker-text" v-if="currentAssistantText || isTyping">
                          {{ currentAssistantText }}
                          <span v-if="isTyping" class="typing-cursor">|</span>
                        </div>
                        <div class="speaker-status" v-if="isWaitingForAI">
                          <i class="pi pi-spin pi-cog"></i>
                          Думает над ответом...
                        </div>
                        <div class="speaker-status" v-else-if="isAssistantSpeaking">
                          <i class="pi pi-volume-up"></i>
                          Говорит...
                        </div>
                      </div>
                    </div>

                    <!-- User Speaking Area -->
                    <div class="user-area" :class="{ 'speaking': isRecording, 'processing': isProcessingMessage }">
                      <div class="user-avatar">
                        <i class="pi" :class="{ 
                          'pi-microphone': !isProcessingMessage, 
                          'pi-spin pi-spinner': isProcessingMessage,
                          'pulse': isRecording 
                        }"></i>
                      </div>
                      <div class="user-content">
                        <div class="user-label">Вы</div>
                        <div class="user-status" v-if="isProcessingMessage">
                          <div class="processing-indicator">
                            <i class="pi pi-spin pi-cog"></i>
                            Обработка сообщения...
                          </div>
                        </div>
                        <div class="user-status" v-else-if="isRecording">
                          <div class="recording-indicator">
                            <span class="recording-dot"></span>
                            Запись...
                          </div>
                        </div>
                        <div class="user-status" v-else-if="lastSegment?.recognized_text">
                          "{{ lastSegment.recognized_text }}"
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Call Controls -->
                  <div class="call-controls">
                    <Button 
                      :label="isProcessingMessage ? 'Обработка сообщения...' : (isRecording ? 'Остановить' : 'Говорить')" 
                      :icon="isProcessingMessage ? 'pi pi-spin pi-spinner' : (isRecording ? 'pi pi-stop' : 'pi pi-microphone')"
                      :severity="isProcessingMessage ? 'info' : (isRecording ? 'danger' : 'success')"
                      size="large"
                      :disabled="!currentChatId || isAssistantSpeaking || isProcessingMessage"
                      :loading="isProcessingMessage"
                      @click="isRecording ? stopRecording() : startRecording()"
                      class="record-button"
                    />
                  </div>

                  <!-- Connection Status -->
                  <div class="connection-status-bar">
                    <div class="status-item">
                      <span class="status-dot" :class="{ 'connected': wsAudioConnected }"></span>
                      Аудио: {{ wsAudioConnected ? 'Подключено' : 'Отключено' }}
                    </div>
                    <div class="status-item">
                      <span class="status-dot" :class="{ 'connected': wsChatConnected }"></span>
                      Чат: {{ wsChatConnected ? 'Подключен' : 'Отключен' }}
                    </div>
                  </div>

                  <!-- Compact Message History -->
                  <div class="compact-history" v-if="messages.length > 0">
                    <div class="history-header">
                      <i class="pi pi-clock"></i>
                      История разговора
                    </div>
                    <div class="history-messages">
                      <div 
                        v-for="msg in messages.slice(-5)" 
                        :key="msg.id" 
                        class="history-message"
                        :class="{ 'user': msg.role === 'user', 'assistant': msg.role === 'assistant' }"
                      >
                        <div class="message-role">{{ msg.role === 'user' ? 'Вы' : 'AI' }}</div>
                        <div class="message-content">{{ msg.content }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabPanel>

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
              </TabPanels>
            </Tabs>
            
            <!-- HR View Mode: только текстовый интерфейс без ввода -->
            <div v-if="isHrViewMode" class="hr-view-mode">
              <div class="hr-view-header">
                <i class="pi pi-eye"></i>
                <span>Режим просмотра HR</span>
              </div>
              <Messages :messages="messages" />
              <Divider class="my-12" />
              <div v-if="analysis" class="analysis">
                <AnalysisView :analysis="analysis as any" />
              </div>
            </div>
            </template>
          </div>
          <div class="aside" v-if="!isHrViewMode">
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
.content.hr-mode { grid-template-columns: 1fr; }
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

/* HR View Mode Styles */
.hr-view-mode {
  max-width: 800px;
  margin: 0 auto;
}

.hr-view-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: linear-gradient(135deg, var(--blue-50), var(--surface-section));
  border: 2px solid var(--blue-200);
  border-radius: 12px;
  margin-bottom: 1.5rem;
  color: var(--blue-700);
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Call Interface Styles */
.call-interface {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 600px;
  margin: 0 auto;
}

.call-main {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  min-height: 300px;
}

.speaker-area, .user-area {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 16px;
  border: 2px solid transparent;
  background: var(--surface-section);
  transition: all 0.3s ease;
}

.speaker-area.speaking {
  border-color: var(--green-400);
  background: linear-gradient(135deg, var(--green-50), var(--surface-section));
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);
}

.speaker-area.thinking {
  border-color: var(--purple-400);
  background: linear-gradient(135deg, var(--purple-50), var(--surface-section));
  box-shadow: 0 0 20px rgba(147, 51, 234, 0.2);
}

.user-area.speaking {
  border-color: var(--blue-400);
  background: linear-gradient(135deg, var(--blue-50), var(--surface-section));
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
}

.user-area.processing {
  border-color: var(--orange-400);
  background: linear-gradient(135deg, var(--orange-50), var(--surface-section));
  box-shadow: 0 0 20px rgba(251, 146, 60, 0.2);
}

.speaker-avatar, .user-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  background: var(--surface-card);
  border: 3px solid var(--surface-border);
  transition: all 0.3s ease;
}

.speaker-avatar {
  background: linear-gradient(135deg, var(--green-100), var(--green-200));
  color: var(--green-700);
}

.user-avatar {
  background: linear-gradient(135deg, var(--blue-100), var(--blue-200));
  color: var(--blue-700);
}

.speaker-avatar.pulse, .user-avatar.pulse {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
  }
}

.user-avatar.pulse {
  animation: pulse-blue 1.5s infinite;
}

@keyframes pulse-blue {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
}

.speaker-content, .user-content {
  flex: 1;
  min-width: 0;
}

.speaker-label, .user-label {
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.speaker-text {
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--text-color);
  min-height: 3rem;
  margin-bottom: 0.5rem;
}

.typing-cursor {
  color: var(--green-500);
  font-weight: bold;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.speaker-status, .user-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
  font-style: italic;
}

.recording-indicator, .processing-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.recording-dot {
  width: 8px;
  height: 8px;
  background: var(--red-500);
  border-radius: 50%;
  animation: recording-pulse 1s infinite;
}

@keyframes recording-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.processing-indicator {
  color: var(--orange-600);
  font-weight: 500;
}

.call-controls {
  display: flex;
  justify-content: center;
  margin: 2rem 0;
}

.record-button {
  min-width: 150px;
  height: 60px;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 30px;
}

.connection-status-bar {
  display: flex;
  justify-content: center;
  gap: 2rem;
  padding: 1rem;
  background: var(--surface-ground);
  border-radius: 12px;
  border: 1px solid var(--surface-border);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--red-400);
  transition: background-color 0.3s ease;
}

.status-dot.connected {
  background: var(--green-400);
}

.compact-history {
  margin-top: 2rem;
  background: var(--surface-ground);
  border-radius: 12px;
  border: 1px solid var(--surface-border);
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--surface-section);
  border-bottom: 1px solid var(--surface-border);
  font-weight: 600;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.history-messages {
  max-height: 200px;
  overflow-y: auto;
}

.history-message {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--surface-border);
  transition: background-color 0.2s ease;
}

.history-message:hover {
  background: var(--surface-hover);
}

.history-message:last-child {
  border-bottom: none;
}

.message-role {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  margin-bottom: 0.25rem;
}

.history-message.user .message-role {
  color: var(--blue-500);
}

.history-message.assistant .message-role {
  color: var(--green-500);
}

.message-content {
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--text-color);
}

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
  
  .call-interface {
    max-width: 100%;
    gap: 1rem;
  }
  
  .call-main {
    gap: 1rem;
    min-height: 200px;
  }
  
  .speaker-area, .user-area {
    padding: 1rem;
    border-radius: 12px;
  }
  
  .speaker-avatar, .user-avatar {
    width: 50px;
    height: 50px;
    font-size: 1.2rem;
  }
  
  .speaker-text {
    font-size: 1rem;
    min-height: 2rem;
  }
  
  .record-button {
    min-width: 120px;
    height: 50px;
    font-size: 1rem;
  }
  
  .connection-status-bar {
    gap: 1rem;
    padding: 0.75rem;
  }
  
  .compact-history {
    margin-top: 1rem;
  }
  
  .history-messages {
    max-height: 150px;
  }
}

@media (max-width: 900px) {
  .content { grid-template-columns: 1fr; }
}
</style>
