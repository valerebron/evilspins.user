/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './**/*.{vue,js,ts}'
  ],
  theme: {
    extend: {
      boxShadow: {
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        '2xl-custom': '0 0 60px 50px rgba(0, 0, 0, 0.25)'
      },
      colors: {
        esyellow: '#fdec50ff'
      },
      fontSize: {
        xxs: '0.625rem' // 10px par exemple
      },
      screens: {
        '2sm': '320px'
      },
      transitionDuration: {
        2000: '2000ms'
      }
    }
  },
  plugins: [
    require("daisyui"),
    function ({ addUtilities }) {
      addUtilities({
        '.screen-centered': {
          position: 'fixed',
          inset: '0',
          height: '100dvh',
          width: '100dvw',
          display: 'grid',
          'place-items': 'center'
        },
        '.full-screen': {
          height: '100dvh',
          width: '100dvw'
        },
        '.size-100vmin': {
          width: '100vmin',
          height: '100vmin'
        },
        '.debug': {
          position: 'absolute',
          'z-index': '1000',
          bottom: '16px',
          right: '25%',
          background: '#9CA3AF',
          'border-radius': '16px',
          padding: '16px'
        },
        '.debug > *': {
          display: 'block'
        }
      })
    }
  ]
}
