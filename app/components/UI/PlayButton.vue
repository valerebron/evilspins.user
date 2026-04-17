<template>
  <button tabindex="-1" class="play-button" :class="{ loading: isLoading }" :disabled="isLoading">
    <Loader v-if="props.isLoading" />
    <template v-else>
      <PlayPauseIcon :isPlaying class="fill-esyellow" />
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
  @apply text-esyellow backdrop-blur-sm bg-black/25 transition-all duration-100 ease-in-out transform active:scale-90 scale-110 text-4xl font-bold;
  pointer-events: none;
  border-radius: 100%;
  height: 30%;
  font-size: 420%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  &::after {
    @apply bg-esyellow;
    width: 30%;
    height: 30%;
    clip-path: polygon(0% 5%, 95% 50%, 0% 95%);
    border-radius: 10px;
  }

  .loader {
    @apply fill-esyellow opacity-70;
    padding: 22%;
  }
}

.loading,
.play-button-changed {
  opacity: 1 !important;
}
</style>
