<template>
  <div class="crossfader" :class="[`crossfader--${orientation}`]">
    <div ref="trackWrapRef" class="crossfader__track-wrap" role="slider" :tabindex="disabled ? -1 : 0"
      :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="Math.round(clampedValue * 100)" aria-label="Crossfader"
      @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp"
      @keydown="onKeyDown">
      <div class="crossfader__track" />
      <div class="crossfader__thumb" :style="thumbStyle" />
    </div>
  </div>
</template>

<script setup lang="ts">
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
const isDragging = ref(false)
const trackWrapRef = ref<HTMLElement | null>(null)

const thumbStyle = computed(() => {
  const percent = `${clampedValue.value * 100}%`

  if (props.orientation === 'vertical') {
    return {
      top: percent,
      left: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  return {
    left: percent,
    top: '50%',
    transform: 'translate(-50%, -50%)',
  }
})

const valueFromPointer = (event: PointerEvent) => {
  const track = trackWrapRef.value
  if (!track) return clampedValue.value

  const rect = track.getBoundingClientRect()

  if (props.orientation === 'vertical') {
    const ratio = (event.clientY - rect.top) / rect.height
    return clamp(ratio)
  }

  const ratio = (event.clientX - rect.left) / rect.width
  return clamp(ratio)
}

const onInteractionStart = () => {
  emit('interaction-start')
}

const onInteractionEnd = () => {
  emit('interaction-end')
}

const emitValue = (value: number) => {
  emit('update:modelValue', clamp(value))
}

const onPointerDown = (event: PointerEvent) => {
  if (props.disabled) return

  isDragging.value = true
  trackWrapRef.value?.setPointerCapture?.(event.pointerId)
  onInteractionStart()
  emitValue(valueFromPointer(event))
}

const onPointerMove = (event: PointerEvent) => {
  if (!isDragging.value || props.disabled) return
  emitValue(valueFromPointer(event))
}

const onPointerUp = (event: PointerEvent) => {
  if (!isDragging.value) return
  isDragging.value = false
  trackWrapRef.value?.releasePointerCapture?.(event.pointerId)
  onInteractionEnd()
}

const onKeyDown = (event: KeyboardEvent) => {
  if (props.disabled) return

  const step = event.shiftKey ? 0.1 : 0.02
  let nextValue = clampedValue.value

  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    event.preventDefault()
    nextValue = clampedValue.value - step
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    event.preventDefault()
    nextValue = clampedValue.value + step
  } else if (event.key === 'Home') {
    event.preventDefault()
    nextValue = 0
  } else if (event.key === 'End') {
    event.preventDefault()
    nextValue = 1
  } else {
    return
  }

  onInteractionStart()
  emitValue(nextValue)
  onInteractionEnd()
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
  bottom: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 360px;
  height: 40px;
  touch-action: none;
  cursor: pointer;
  outline: none;
}

.crossfader__track-wrap:focus-visible {
  box-shadow: 0 0 0 2px rgba(120, 120, 120, 0.45);
  border-radius: 8px;
}

.crossfader__track {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: #9a9a9a;
}

.crossfader__thumb {
  position: absolute;
  width: 62px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #8d8d8d;
  background: linear-gradient(180deg, #d8d8d8 0%, #b8b8b8 100%);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.24);
  pointer-events: none;
}

.crossfader--vertical {
  .crossfader__track-wrap {
    width: 42px;
    height: 300px;
    bottom: 0;
  }

  .crossfader__track {
    top: 0;
    bottom: 0;
    left: 50%;
    right: auto;
    width: 6px;
    height: auto;
    transform: translateX(-50%);
    background: #9a9a9a;
  }

  .crossfader__thumb {
    width: 28px;
    height: 62px;
  }
}
</style>