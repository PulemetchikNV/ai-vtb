<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="auth-layout">
    <div class="container">
      <RouterView />
    </div>
  </div>
  
</template>

<style scoped>
.auth-layout { display: grid; place-items: center; min-height: 100vh; }
.container { width: 100%; max-width: 480px; padding: 16px; }
</style>


