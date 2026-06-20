<template>
  <div class="crossfader" :class="[`crossfader--${orientation}`]">
    <div ref="trackRef" class="crossfader__track-wrap" :class="{ 'crossfader__track-wrap--dragging': isDragging }"
      role="slider" tabindex="0" :aria-valuemin="0" :aria-valuemax="1" :aria-valuenow="clampedValue"
      aria-label="Crossfader" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp"
      @pointercancel="onPointerUp" @lostpointercapture="onPointerUp" @keydown="onKeyDown">
      <div class="crossfader__track" />
      <div class="crossfader__thumb" :style="thumbStyle" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  orientation?: 'horizontal' | 'vertical'
  disabled?: boolean
}>(), {
  orientation: 'horizontal',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'interaction-start': []
  'interaction-end': []
}>()

const clamp = (value: number) => Math.max(0, Math.min(1, value))

const clampedValue = computed(() => clamp(props.modelValue))
const trackRef = ref<HTMLElement | null>(null)
const activePointerId = ref<number | null>(null)
const isDragging = ref(false)

const thumbStyle = computed(() => {
  const percent = clampedValue.value * 100

  if (props.orientation === 'vertical') {
    return {
      left: '50%',
      top: `${percent}%`,
      transform: 'translate(-50%, -50%)',
    }
  }

  return {
    left: `${percent}%`,
    top: '50%',
    transform: 'translate(-50%, -50%)',
  }
})

const setValueFromPointer = (clientX: number, clientY: number) => {
  const track = trackRef.value
  if (!track) return

  const rect = track.getBoundingClientRect()
  const rawValue = props.orientation === 'vertical'
    ? (clientY - rect.top) / rect.height
    : (clientX - rect.left) / rect.width

  emit('update:modelValue', clamp(rawValue))
}

const onInteractionStart = () => {
  emit('interaction-start')
}

const onInteractionEnd = () => {
  emit('interaction-end')
}

const onPointerDown = (event: PointerEvent) => {
  if (props.disabled || !trackRef.value) return

  activePointerId.value = event.pointerId
  isDragging.value = true
  trackRef.value.setPointerCapture(event.pointerId)
  onInteractionStart()
  setValueFromPointer(event.clientX, event.clientY)
}

const onPointerMove = (event: PointerEvent) => {
  if (!isDragging.value) return
  if (activePointerId.value !== null && event.pointerId !== activePointerId.value) return
  setValueFromPointer(event.clientX, event.clientY)
}

const onPointerUp = (event: PointerEvent) => {
  if (!isDragging.value) return
  if (activePointerId.value !== null && event.pointerId !== activePointerId.value) return

  if (trackRef.value?.hasPointerCapture(event.pointerId)) {
    trackRef.value.releasePointerCapture(event.pointerId)
  }

  activePointerId.value = null
  isDragging.value = false
  onInteractionEnd()
}

const onKeyDown = (event: KeyboardEvent) => {
  if (props.disabled) return

  const key = event.key
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return

  event.preventDefault()

  const step = 0.02
  const value = clampedValue.value

  if (key === 'Home') {
    emit('update:modelValue', 0)
    return
  }

  if (key === 'End') {
    emit('update:modelValue', 1)
    return
  }

  const decreaseKey = props.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  const increaseKey = props.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'

  if (key === decreaseKey) {
    emit('update:modelValue', clamp(value - step))
  }

  if (key === increaseKey) {
    emit('update:modelValue', clamp(value + step))
  }
}
</script>

<style scoped lang="scss">
.crossfader {
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  padding: 0;
}

.crossfader__track-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 360px;
  height: 40px;
  touch-action: none;
  outline: none;
}

.crossfader__track-wrap:focus-visible {
  box-shadow: 0 0 0 2px rgba(90, 90, 90, 0.35);
  border-radius: 8px;
}

.crossfader__track {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 6px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: #d3d3d3;
}

.crossfader__thumb {
  position: absolute;
  width: 26px;
  height: 36px;
  border-radius: 6px;
  @apply bg-esyellow;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
  cursor: pointer;
}

.crossfader__track-wrap--dragging .crossfader__thumb {
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.22);
}

.crossfader--vertical {
  .crossfader__track-wrap {
    width: 40px;
    height: 150px;
  }

  .crossfader__track {
    top: 0;
    bottom: 0;
    left: 50%;
    right: auto;
    width: 6px;
    height: auto;
    transform: translateX(-50%);
    background: #a6a6a6;
  }

  .crossfader__thumb {
    position: absolute;
    width: 36px;
    height: 26px;
  }
}
</style>