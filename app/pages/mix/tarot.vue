<template>
  <TarotDeck v-if="boxId" :box-id="boxId" :start-slug="startSlug" />
</template>

<script setup lang="ts">
import TarotDeck from '~/components/player/TarotDeck.vue'

definePageMeta({
  inMenu: false,
})

const route = useRoute()

const resolveQueryString = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] || ''
  }
  return value || ''
}

const boxId = computed(() => resolveQueryString(route.query.box))
const startSlug = computed(() => resolveQueryString(route.query.start))

useHead({
  title: 'Tarot Deck Player',
  bodyAttrs: {
    class: 'mix-page-body',
  },
})
</script>
