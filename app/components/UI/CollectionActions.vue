<template>
  <div class="collection-actions">
    <button v-if="!hasSelection" type="button" class="btn" @click="emit('create-card')">
      <CreateCardSVG />
      Create card
    </button>

    <div v-if="hasSelection" class="relative">
      <button type="button" class="btn" @click="emit('print')">
        <printSVG />
        Print
      </button>
      <button v-if="props.selectedCount > 0" type="button" @click.stop="emit('clear-selection')">
        <span class="badge badge-primary badge absolute -top-2 -right-2 size-5 p-0">{{ props.selectedCount }}</span>
      </button>
    </div>

    <div v-if="hasSelection" class="relative">
      <button type="button" class="btn" @click="emit('mix')">
        <MixSVG />
        Mix
      </button>
      <button v-if="props.selectedCount > 0" type="button" @click.stop="emit('clear-selection')">
        <span class="badge badge-primary badge absolute -top-2 -right-2 size-5 p-0">{{ props.selectedCount }}</span>
      </button>
    </div>

    <button type="button" class="btn btn-sm fixed top-4 right-4" :disabled="props.isLoadingAllCards"
      @click="emit('toggle-all-cards')">
      {{ props.allCardsButtonLabel }}
    </button>

    <button v-if="hasSelection && props.showNfc" type="button" class="btn"
      :class="{ 'btn-disabled': props.isWritingNfc || props.isNfcDisabled }"
      :disabled="props.isWritingNfc || props.isNfcDisabled" :title="props.nfcTitle" @click="emit('nfc')">
      <NfcSVG />
      {{ props.isWritingNfc ? 'ecritures ...' : 'NFC' }}
    </button>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  selectedCount?: number
  showNfc?: boolean
  isWritingNfc?: boolean
  isNfcDisabled?: boolean
  nfcTitle?: string
  isLoadingAllCards?: boolean
  allCardsButtonLabel?: string
}>(), {
  selectedCount: 0,
  showNfc: true,
  isWritingNfc: false,
  isNfcDisabled: false,
  nfcTitle: '',
  isLoadingAllCards: false,
  allCardsButtonLabel: 'All cards',
})

const hasSelection = computed(() => props.selectedCount > 0)

const emit = defineEmits<{
  'create-card': []
  nfc: []
  print: []
  mix: []
  'clear-selection': []
  'toggle-all-cards': []
}>()
</script>

<style scoped>
.collection-actions {
  width: 100%;
  justify-content: center;
  max-width: 500px;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.icon {
  height: 30px;
}
</style>