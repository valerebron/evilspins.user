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

    <button type="button" class="btn" @click="emit('nfc')">
      <NfcSVG />
      NFC
    </button>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  showNfc?: boolean
}>(), {
  showNfc: true,
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