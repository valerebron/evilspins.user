import { ref, readonly } from 'vue'

export const isTouchInterface = ref<boolean>(false)

if (process.client) {
  const hasWindow = typeof window !== 'undefined'
  const hasNavigator = typeof navigator !== 'undefined'
  const touchSupport = (hasWindow && 'ontouchstart' in window) || (hasNavigator && (((navigator as any).maxTouchPoints || (navigator as any).msMaxTouchPoints) > 0))
  isTouchInterface.value = !!touchSupport
}

export function useIsTouchInterface() {
  return readonly(isTouchInterface)
}

export default useIsTouchInterface
