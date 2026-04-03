export default eventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug manquant dans la requête'
    })
  }

  try {
    const card = await $fetch(`${process.env.DATA_URL}api/card/slug/${slug}`)

    if (!card) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Morceau non trouvé'
      })
    }

    // Préfixer les URLs avec DATA_URL
    if (card.url_audio) {
      card.url_audio = `${process.env.DATA_URL}${card.url_audio}`
    }
    if (card.url_image) {
      card.url_image = `${process.env.DATA_URL}${card.url_image}`
    }

    return card
  } catch (error) {
    console.error('Error fetching card by slug:', error)
    throw createError({
      statusCode: 404,
      statusMessage: 'Morceau non trouvé'
    })
  }
})
