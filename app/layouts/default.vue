<template>
  <slot />
  <SearchButton @toggle="showSearch = !showSearch" />
  <div v-if="showSearch" class="search-modal" @click.self="showSearch = false">
    <div class="search-modal-content">
      <button @click="showSearch = false" class="close-btn">×</button>
      <Search />
    </div>
  </div>
</template>

<script setup lang="ts">
import SearchButton from '~/components/UI/SearchButton.vue'
import Search from '~/pages/Search.vue'

const showSearch = ref(false)
</script>

<style scoped lang="scss">
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
  padding: 2rem;
}

.search-modal-content {
  background: white;
  border-radius: 1rem;
  max-width: 1400px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  padding: 0;
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
