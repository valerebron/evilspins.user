import { computed, ref } from 'vue'

type CardState = {
	flipped: boolean
	playedToEnd: boolean
}

const STORAGE_KEY = 'evilspins:card-state:v1'
const LEGACY_COLLECTION_KEY = 'evilspins:collection:v1'

const stateBySlug = ref<Record<string, CardState>>({})
const loaded = ref(false)

const createDefaultState = (): CardState => ({
	flipped: false,
	playedToEnd: false,
})

const normalizeStateMap = (input: unknown): Record<string, CardState> => {
	const normalized: Record<string, CardState> = {}

	if (Array.isArray(input)) {
		for (const value of input) {
			if (typeof value === 'string' && value) {
				normalized[value] = {
					flipped: true,
					playedToEnd: false,
				}
			}
		}

		return normalized
	}

	if (!input || typeof input !== 'object') {
		return normalized
	}

	for (const [slug, raw] of Object.entries(input as Record<string, unknown>)) {
		if (!slug) continue

		if (raw === true) {
			normalized[slug] = {
				flipped: true,
				playedToEnd: false,
			}
			continue
		}

		if (!raw || typeof raw !== 'object') {
			continue
		}

		const state = raw as Partial<CardState>
		normalized[slug] = {
			flipped: Boolean(state.flipped),
			playedToEnd: Boolean(state.playedToEnd),
		}
	}

	return normalized
}

const notifyStateChanged = () => {
	if (import.meta.server) {
		return
	}

	window.dispatchEvent(new CustomEvent('collection-state-changed'))
}

const save = () => {
	if (import.meta.server) {
		return
	}

	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateBySlug.value))
	notifyStateChanged()
}

const ensureLoaded = () => {
	if (import.meta.server || loaded.value) {
		return
	}

	const next = normalizeStateMap(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}'))
	const legacy = normalizeStateMap(JSON.parse(window.localStorage.getItem(LEGACY_COLLECTION_KEY) || '[]'))

	for (const [slug, legacyState] of Object.entries(legacy)) {
		if (!next[slug]) {
			next[slug] = createDefaultState()
		}

		if (legacyState.flipped) {
			next[slug].flipped = true
		}
	}

	stateBySlug.value = next
	loaded.value = true
}

const upsertState = (slug: string, patch: Partial<CardState>) => {
	if (!slug) {
		return
	}

	ensureLoaded()
	const current = stateBySlug.value[slug] || createDefaultState()
	const nextState: CardState = {
		flipped: patch.flipped ?? current.flipped,
		playedToEnd: patch.playedToEnd ?? current.playedToEnd,
	}

	stateBySlug.value = {
		...stateBySlug.value,
		[slug]: nextState,
	}

	save()
}

const markCardFlipped = (slug: string) => {
	upsertState(slug, { flipped: true })
}

const markCardPlayedToEnd = (slug: string) => {
	upsertState(slug, { playedToEnd: true })
}

const resetAllStates = () => {
	ensureLoaded()
	stateBySlug.value = {}

	if (!import.meta.server) {
		window.localStorage.removeItem(STORAGE_KEY)
		window.localStorage.removeItem(LEGACY_COLLECTION_KEY)
	}

	notifyStateChanged()
}

export function usePersistentCardState() {
	const flippedSlugs = computed(() => {
		const slugs = new Set<string>()

		for (const [slug, state] of Object.entries(stateBySlug.value)) {
			if (state?.flipped) {
				slugs.add(slug)
			}
		}

		return slugs
	})

	return {
		ensureLoaded,
		stateBySlug: computed(() => stateBySlug.value),
		flippedSlugs,
		markCardFlipped,
		markCardPlayedToEnd,
		resetAllStates,
	}
}
