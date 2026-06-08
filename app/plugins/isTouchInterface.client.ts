import { isTouchInterface } from '~/composables/useIsTouchInterface'

export default defineNuxtPlugin(() => {
  return {
    provide: {
      isTouchInterface,
    },
  }
})
