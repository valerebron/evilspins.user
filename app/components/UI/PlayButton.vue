<template>
  <button tabindex="-1" class="play-button" :class="{ loading: isLoading }" :disabled="isLoading">
    <template v-if="props.isLoading">
      <Loader />
    </template>
    <template v-else>
      {{ props.isPlaying ? 'I I' : '▶' }}
    </template>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  isLoading?: boolean;
  isPlaying?: boolean;
}>(), {
  isLoading: false,
  isPlaying: false
})
</script>

<style scoped lang="scss">
.play-button {
  @apply pointer-events-none rounded-full size-24 flex items-center justify-center text-esyellow backdrop-blur-sm bg-black/25 transition-all duration-100 ease-in-out transform active:scale-90 scale-110 text-4xl font-bold;

  .loader {
    @apply size-14 fill-esyellow opacity-70;
  }
}

.loading,
.play-button-changed {
  opacity: 1 !important;
}
</style>
