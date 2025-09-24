import { atom } from 'nanostores';

type Theme = 'light' | 'dark';

// Initialize theme store
export const themeStore = atom<Theme>('light');

// Load theme from localStorage on client side
if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
        themeStore.set(savedTheme);
    } else {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        themeStore.set(prefersDark ? 'dark' : 'light');
    }
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme() {
    const currentTheme = themeStore.get();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    // Update document classes
    if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // Save to localStorage
    localStorage.setItem('theme', newTheme);

    // Update store
    themeStore.set(newTheme);
}
