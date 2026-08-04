<template>
  <div class="collection-actions">
    <button type="button" class="btn" v-if="false">
      <CreateCardSVG />
      Create card
    </button>

    <button type="button" class="btn" v-if="false">
      <printSVG />
      Print
    </button>

    <!-- Google -->
    <button type="button" class="btn" v-if="false">
      <MixSVG />
      Mix
    </button>

    <button v-if="props.showNfc" type="button" class="btn" :disabled="props.isWritingNfc" @click="emit('nfc')">
      <NfcSVG />
      {{ props.isWritingNfc ? 'ecritures ...' : 'NFC' }}
    </button>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  showNfc?: boolean
  isWritingNfc?: boolean
}>(), {
  showNfc: true,
  isWritingNfc: false,
})

const emit = defineEmits<{
  nfc: []
}>()
</script>

<style scoped>
.collection-actions {
  width: 100%;
  justify-content: space-around;
  max-width: 500px;
  display: flex;
}

.icon {
  height: 30px;
}
</style>