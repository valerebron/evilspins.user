<template>
  <Random v-for="width in widths" :key="width" :class="width" />
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'list'
})

const widths = ['w-12', 'w-24', 'w-36', 'w-56', 'w-96']
</script>