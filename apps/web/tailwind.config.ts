import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error js module without types
import themeExtend from './tailwind/theme.extend.js';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}',
        './components/**/*.{astro,html,js,jsx,ts,tsx,mdx}'
    ],
    darkMode: 'class',
    theme: {
        extend: {
            ...themeExtend
        }
    },
    plugins: [forms, typography]
};
