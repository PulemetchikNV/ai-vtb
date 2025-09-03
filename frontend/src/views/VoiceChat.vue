<script setup lang="ts">
import { ref } from 'vue'

const isRecording = ref(false)
const statusText = ref('idle')
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
</script>

<template>
  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; margin-top: 16px;">
    <h2>Voice Chat (WebSocket)</h2>
    <div style="margin: 8px 0;">
      <button @click="startRecording" :disabled="isRecording" style="margin-right: 8px;">Start</button>
      <button @click="stopRecording" :disabled="!isRecording">Stop</button>
    </div>
    <div style="font-size: 14px; color: #374151;">
      <div>Status: {{ statusText }}</div>
      <div>Chunks sent: {{ chunkCount }}</div>
      <div>Bytes sent: {{ bytesSent }}</div>
    </div>
  </div>
</template>

<style scoped>
h2 { margin: 0 0 8px; font-size: 16px; }
button { padding: 6px 12px; }
</style>
