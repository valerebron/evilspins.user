// https://nuxt.com/docs/api/configuration/nuxt-config

const isProd = process.env.NODE_ENV === 'production'

export default defineNuxtConfig({
  runtimeConfig: {
    dataUrl: '',
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxtjs/tailwindcss', '@pinia/nuxt'],
  components: [
    {
      path: '~/components',
      pathPrefix: false
    }
  ],
  typescript: {
    tsConfig: {
      include: ['types/**/*.ts']
    }
  },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon/favicon-96x96.png', sizes: '96x96' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon/favicon.svg' },
        { rel: 'shortcut icon', href: '/favicon/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon/apple-touch-icon.png' },
        { rel: 'manifest', href: '/favicon/site.webmanifest' }
      ],
      viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0',
      script: isProd
        ? [
            {
              src: 'https://umami.erudi.fr/script.js',
              defer: true,
              'data-website-id': '615690ea-0306-48cc-8feb-e9093fe6a1b7'
            }
          ]
        : [],
      meta: [{ name: 'apple-mobile-web-app-title', content: 'evilSpins' }]
    }
  }
})
