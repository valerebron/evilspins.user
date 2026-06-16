export function useGlobalCardShortcuts() {
  const { openCardId } = useCardOpenState()
  const isTouch = useIsTouchInterface()

  onMounted(() => {
    if (!import.meta.client) return

    const handler = (e: KeyboardEvent) => {
      if (isTouch.value) return
      if (e.key !== 'Escape') return
      if (!openCardId.value) return

      window.dispatchEvent(new CustomEvent('card-close-request'))
    }

    window.addEventListener('keydown', handler)

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handler)
    })
  })
}
