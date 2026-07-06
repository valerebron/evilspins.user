<template>
  <div>
    {{ tapeList }}
  </div>
</template>

<script setup lang="ts">
const tapeList = ref()

onMounted(async () => {
  tapeList.value = await $fetch('/api/tarot/tape')
})
</script>
