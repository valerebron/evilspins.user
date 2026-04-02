const PAGE_SIZE = 20 // Nombre d'éléments par page

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const search = query.search?.toString()
  const cardRank = query.rank?.toString()
  const cardSuit = query.suit?.toString()
  const year = query.year?.toString()

  const offset = (page - 1) * PAGE_SIZE

  // Log pour débogage
  console.log('Requête avec paramètres:', { search, cardRank, cardSuit, year })
  console.log('Schéma des card:', Object.keys(schema.card))

  // Construction des conditions de filtrage
  const conditions = []

  if (search) {
    const searchTerm = `%${search}%`
    conditions.push(
      or(ilike(schema.card.title, searchTerm), ilike(schema.card.artist, searchTerm))
    )
  }

  if (cardRank) {
    conditions.push(eq(schema.card.rank, cardRank))
  }

  if (cardSuit) {
    conditions.push(eq(schema.card.suit, cardSuit))
  }

  if (year) {
    conditions.push(eq(schema.card.year, year))
  }

  // Requête pour le comptage total
  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.card)
    .$dynamic()

  // Log pour débogage SQL
  console.log('Requête de comptage SQL:', countQuery.toSQL())

  // Requête pour les données paginées
  const cardQuery = db
    .select()
    .from(schema.card)
    .$dynamic()
    .limit(PAGE_SIZE)
    .offset(offset)
    .orderBy(schema.card.title)

  // Application des conditions si elles existent
  if (conditions.length > 0) {
    const where = and(...conditions)
    countQuery.where(where)
    cardQuery.where(where)
  }

  const [countResult, card] = await Promise.all([countQuery, cardQuery])

  const totalItems = countResult[0]?.count || 0
  const totalPages = Math.ceil(totalItems / PAGE_SIZE)

  return {
    data: card,
    pagination: {
      currentPage: page,
      pageSize: PAGE_SIZE,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  }
})
