/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f1ff',
          100: '#cce3ff',
          200: '#99c8ff',
          300: '#66acff',
          400: '#3391ff',
          500: '#0075ff',
          600: '#005ecc',
          700: '#004799',
          800: '#002f66',
          900: '#001833',
        },
        secondary: {
          50: '#e6fbfa',
          100: '#ccf7f5',
          200: '#99efeb',
          300: '#66e7e0',
          400: '#33dfd6',
          500: '#00d7cc',
          600: '#00aca3',
          700: '#00817a',
          800: '#005652',
          900: '#002b29',
        },
        accent: {
          50: '#fff5e6',
          100: '#ffeacc',
          200: '#ffd699',
          300: '#ffc166',
          400: '#ffad33',
          500: '#ff9800',
          600: '#cc7a00',
          700: '#995b00',
          800: '#663d00',
          900: '#331e00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}