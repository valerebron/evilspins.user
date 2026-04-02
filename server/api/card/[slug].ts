export default eventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug manquant dans la requête'
    })
  }

  // const card = await db.select().from(schema.card).where(eq(schema.card.slug, slug)).get()

  if (!card) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Morceau non trouvé'
    })
  }

  return {
    id: card.id,
    esid: card.esid,
    title: card.title,
    artist: card.artist,
    url_audio: card.url_audio,
    url_image: card.url_image,
    year: card.year,
    month: card.month,
    day: card.day,
    hour: card.hour,
    slug: card.slug,
    suit: card.suit,
    rank: card.rank,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt
  }
})
