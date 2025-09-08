<script setup lang="ts">
import { useRoute } from 'vue-router'
import MainLayout from './layouts/Main.vue'
import AuthLayout from './layouts/Auth.vue'
const route = useRoute()
const isAuthRoute = () => route.path.startsWith('/login')
</script>

<template>
  <AuthLayout v-if="isAuthRoute()" />
  <MainLayout v-else />
 </template>

<style scoped>
</style>
