<template>
  <div class="grid">
    <card v-for="card in cards" :card="card" />
  </div>
</template>
<script setup lang="ts">
const cards = fetch('api/cards')
</script>
