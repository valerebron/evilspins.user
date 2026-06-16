type OutsideClickOptions = {
  exclude?: string[]
}

export function useOutsideClick(
  handler: (e: MouseEvent) => void,
  options: OutsideClickOptions = {}
) {
  const exclude = options.exclude ?? []

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target) return

    // Vérifie si on clique dans un élément exclu
    for (const selector of exclude) {
      if (target.closest(selector)) return
    }

    handler(e)
  }

  onMounted(() => {
    document.addEventListener('click', onClick)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', onClick)
  })
}
