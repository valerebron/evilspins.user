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
  @apply m-[2%] p-[2%] bg-esyellow rounded-full text-black font-bold transition-all active:scale-95;

  &:hover {
    @apply p-[3%];
  }
}
</style>
