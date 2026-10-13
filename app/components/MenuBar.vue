<template>
  <div class="fixed bottom-4 right-4 z-50">
    <div class="swap swap-rotate">
      <input type="checkbox" class="rating" />
      
      <div class="swap-on">
        <label tabindex="0" class="btn btn-primary btn-circle">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </label>
      </div>
      
      <div class="swap-off">
        <label tabindex="0" class="btn btn-primary btn-circle">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </label>
      </div>
    </div>
    
    <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
      <li><NuxtLink to="/" class="justify-between">Tirage</NuxtLink></li>
      <li><NuxtLink to="/compilations" class="justify-between">Compilations</NuxtLink></li>
      <li><NuxtLink to="/collection" class="justify-between">Collection</NuxtLink></li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// Composant MenuBar avec bouton hamburger et menu déroulant
</script>

<style scoped lang="scss">
/* Styles spécifiques au composant MenuBar */
</style>