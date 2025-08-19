import { defaultLocale, trans } from '@/i18n/config';
import type { TranslationKeys } from '@/i18n/translation-keys';

export function getLangFromUrl(url: URL) {
    const [, lang] = url.pathname.split('/');
    if (lang && lang in trans) {
        return lang as keyof typeof trans;
    }
    return defaultLocale;
}

export function useTranslations(lang: keyof typeof trans) {
    return function t(key: TranslationKeys, params?: Record<string, unknown>): string {
        const raw = trans[lang][key] || trans[defaultLocale][key];
        if (!raw) {
            console.error(`Translation key not found: ${key}`);
            return `[MISSING: ${key}]`;
        }
        if (!params) return raw;
        return Object.keys(params).reduce((acc, k) => {
            const v = params[k];
            // reemplaza {key} por el valor; soporta tanto {key} como {{key}}
            return acc
                .replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
                .replace(new RegExp(`\\{{${k}\\}}`, 'g'), String(v));
        }, raw);
    };
}
