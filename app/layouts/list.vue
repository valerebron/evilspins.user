<template>
  <section class="card-list">
    <slot />
  </section>
  <SearchButton />
</template>

<script setup lang="ts">
import SearchButton from '~/components/UI/SearchButton.vue'
import Search from '~/pages/Search.vue'

const { openCardId, setAllowMultipleOpen } = useCardOpenState()

// Default behavior: only one card can be open at a time
setAllowMultipleOpen(false)

// Provide the open card ID to child components
provide('openCardId', openCardId)

const showSearch = ref(false)
</script>

<style lang="scss">
.card-list {
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;

  @screen md {
    flex-direction: row;
  }

  place-items: center;
  justify-content: center;
  gap: 20px;

  min-height: 100svh;
}

.card {
  width: 250px;
  transition: width height opacity 0.7s;

  &.open {
    width: 100%;
    overflow: hidden;
  }

  &.close {
    opacity: 0;
    width: 0;

    overflow: hidden;
    margin: 0;
    padding: 0;
  }
}

.search-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.search-modal-content {
  background: white;
  width: 100%;
  max-height: 100vh;
  overflow-y: auto;
  padding: 0;
  margin: 0;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2.5rem;
  height: 2.5rem;
  background: #fbbf24;
  border: none;
  border-radius: 50%;
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.2s;

  &:hover {
    background: #f59e0b;
  }
}
</style>
