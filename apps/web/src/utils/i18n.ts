import { defaultLocale, ui } from '@/i18n/config';

export function getLangFromUrl(url: URL) {
    const [, lang] = url.pathname.split('/');
    if (lang && lang in ui) {
        return lang as keyof typeof ui;
    }
    return defaultLocale;
}

export function useTranslations(lang: keyof typeof ui) {
    return function t(key: keyof (typeof ui)[typeof defaultLocale]) {
        return ui[lang][key] || ui[defaultLocale][key];
    };
}
