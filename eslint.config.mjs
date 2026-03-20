import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    '@typescript-eslint/ban-types': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/script-setup-uses-vars': 'error'
  }
})
