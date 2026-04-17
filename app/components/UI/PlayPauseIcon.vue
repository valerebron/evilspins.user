<template>
  <button class="play-pause-btn" :class="{ isPlaying }" :aria-label="isPlaying ? 'Pause' : 'Play'" tabindex="-1">
    <svg class="icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Pause bars -->
      <g class="pause-icon">
        <rect class="bar bar-left" x="12" y="11" width="9" height="26" rx="2" />
        <rect class="bar bar-right" x="27" y="11" width="9" height="26" rx="2" />
      </g>

      <!-- Play triangle -->
      <path class="play-icon" d="M16 10.5 L16 37.5 L39 24 Z" />
    </svg>
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  isPlaying: boolean
}>()
</script>

<style scoped>
.play-pause-btn {
  --size: 100%;
  --color: currentColor;
  --duration: 220ms;
  --ease: cubic-bezier(0.34, 1.56, 0.64, 1);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--size);
  height: var(--size);
  padding: 20%;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--color);
}

.play-pause-btn:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
  border-radius: 4px;
}

.icon {
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* ── Play icon ─────────────────────────────────────────── */
.play-icon {
  fill: currentColor;
  transform-origin: center;
  transition:
    opacity var(--duration) ease,
    transform var(--duration) var(--ease),
    clip-path var(--duration) var(--ease);
}

/* ── Pause bars ─────────────────────────────────────────── */
.bar {
  fill: currentColor;
  transform-origin: center;
  transition:
    opacity var(--duration) ease,
    transform var(--duration) var(--ease);
}

.bar-left {
  transform-origin: 16.5px 24px;
}

.bar-right {
  transform-origin: 31.5px 24px;
}

/* ── État PLAY (playing = false) → affiche ▶ ─────────────── */
.pause-icon {
  opacity: 0;
  pointer-events: none;
}

.bar-left {
  transform: scaleX(0) translateX(-4px);
}

.bar-right {
  transform: scaleX(0) translateX(4px);
}

.play-icon {
  opacity: 1;
  transform: scale(1);
}

/* ── État PAUSE (isPlaying = true) → affiche ⏸ ────────────── */
.isPlaying .pause-icon {
  opacity: 1;
  pointer-events: auto;
}

.isPlaying .bar-left {
  transform: scaleX(1) translateX(0);
}

.isPlaying .bar-right {
  transform: scaleX(1) translateX(0);
}

.isPlaying .play-icon {
  opacity: 0;
  transform: scale(0.6);
}
</style>