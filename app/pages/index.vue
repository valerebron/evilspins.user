<template>
  <Random v-for="i in [0, 1, 2, 3, 4, 1, 2, 3, 4]" :key="i" />
</template>

<script setup>
definePageMeta({
  layout: 'list'
})
</script>
