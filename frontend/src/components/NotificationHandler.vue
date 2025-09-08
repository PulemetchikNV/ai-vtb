<script setup lang="ts">
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { onMounted, watch } from 'vue'
import { pendingMessages, consumeMessages, type NotificationMessage } from '../__data__/store'

const toast = useToast()

// Следим за сообщениями в сторе и показываем их
watch(pendingMessages, (messages) => {
  if (messages.length > 0) {
    messages.forEach((message: NotificationMessage) => {
      toast.add(message)
    })
    consumeMessages()
  }
}, { deep: true })

// При монтировании компонента проверяем, есть ли ожидающие сообщения
onMounted(() => {
  const messages = consumeMessages()
  if (messages.length > 0) {
    messages.forEach((message: NotificationMessage) => {
      toast.add(message)
    })
  }
})
</script>

<template>
  <Toast />
</template>
