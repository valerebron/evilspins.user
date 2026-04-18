<template>
  <VueDraggablePlus :model-value="items" @update:model-value="emit('update:items', $event)" :group="group"
    :animation="200" ghostClass="card-ghost" chosenClass="card-chosen" dragClass="card-dragging" :forceFallback="true"
    :fallbackTolerance="3" @start="onStart" @end="onEnd" @add="onAdd" @remove="onRemove" item-key="id"
    class="draggable-zone">
    <template #item="{ element }">
      <CardElement :card="element" :is-face-up="true" @click="emit('card-click', element)" />
    </template>
  </VueDraggablePlus>
</template>

<script setup lang="ts">
import CardElement from './CardElement.vue'

// Import direct au cas où le plugin ne fonctionne pas
const VueDraggablePlus = resolveComponent('VueDraggablePlus')

const props = defineProps<{
  items: any[]
  group?: string | object
}>()

const emit = defineEmits(['update:items', 'start', 'end', 'add', 'remove', 'card-click'])

const onStart = (evt: any) => {
  evt.item.classList.add('is-dragging')
  emit('start', evt)
}

const onEnd = (evt: any) => {
  evt.item.classList.remove('is-dragging')
  emit('end', evt)
}

const onAdd = (evt: any) => emit('add', evt)
const onRemove = (evt: any) => emit('remove', evt)
</script>

<style scoped>
.draggable-zone {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  min-height: 200px;
  padding: 12px;
  border: 2px dashed #e5e7eb;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.draggable-zone:hover {
  border-color: #9ca3af;
  background: rgba(255, 255, 255, 0.15);
}

.card-ghost {
  opacity: 0.4;
  transform: scale(0.85) rotate(8deg);
  background: #ddd;
  border: 2px dashed #666;
  border-radius: 1rem;
}

.card-chosen {
  opacity: 0.6;
}

.card-dragging {
  opacity: 0.7;
  transform: scale(0.95) rotate(6deg);
}
</style>
