import type { Config } from 'tailwindcss';

export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}', './public/**/*.html'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#5eead4',
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    600: '#0d9488',
                    700: '#0f766e',
                    800: '#115e59',
                    900: '#134e4a',
                    950: '#042f2e'
                },
                secondary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                    950: '#082f49'
                },
                accent: {
                    50: '#fef7ee',
                    100: '#fdedd3',
                    200: '#fbd6a5',
                    300: '#f8b86d',
                    400: '#f59332',
                    500: '#f2750a',
                    600: '#e35d05',
                    700: '#bc4508',
                    800: '#96370e',
                    900: '#792f0f',
                    950: '#411505'
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Montserrat', 'system-ui', 'sans-serif']
            },
            spacing: {
                '2xs': '0.25rem', // 4px
                xs: '0.5rem', // 8px
                sm: '0.75rem', // 12px
                md: '1rem', // 16px
                lg: '1.5rem', // 24px
                xl: '2rem', // 32px
                '2xl': '3rem', // 48px
                '3xl': '4rem' // 64px
            },
            zIndex: {
                60: '60',
                70: '70',
                80: '80',
                90: '90',
                100: '100'
            },
            animation: {
                fadeIn: 'fadeIn 0.3s ease-out'
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' }
                }
            }
        }
    },
    plugins: []
} satisfies Config;
