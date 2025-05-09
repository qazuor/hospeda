import { atom } from 'nanostores';

type Language = 'es' | 'en';

// Initialize language store
export const languageStore = atom<Language>('es');

// Load language from localStorage on client side
if (typeof window !== 'undefined') {
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage) {
        languageStore.set(savedLanguage);
    }
}

/**
 * Set the active language
 */
export function setLanguage(language: Language) {
    // Save to localStorage
    localStorage.setItem('language', language);

    // Update store
    languageStore.set(language);
}
