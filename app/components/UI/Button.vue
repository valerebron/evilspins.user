<template>
  <button ref="buttonRef">
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  keyAlias?: string;
}>()

const buttonRef = ref<HTMLButtonElement | null>(null)

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === props.keyAlias && buttonRef.value) {
    buttonRef.value.click()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped lang="scss">
button {
  @apply mx-4 my-2 px-4 py-2 bg-esyellow rounded-md text-black font-bold transition-transform active:scale-95;
}
</style>