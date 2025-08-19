export const defaultLocale = 'es';
export const locales = ['es'];
export const namespaces = [
    'common',
    'nav',
    'footer',

    'accommodations',
    'blog',
    'destinations',
    'events',

    'home',
    'newsletter',
    'contact'
];

function flattenObject(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    obj: Record<string, any>,
    parentKey = '',
    result: Record<string, string> = {}
): Record<string, string> {
    for (const key in obj) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            flattenObject(obj[key], newKey, result);
        } else {
            result[newKey] = obj[key];
        }
    }
    return result;
}

const modules = import.meta.glob('./**/**.json', { eager: true });

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const translations: Record<string, any> = {};

for (const path in modules) {
    const [, locale, file] = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/) || [];
    if (!locale || !file) continue;

    const ns = file;
    if (!translations[locale]) translations[locale] = {};

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    translations[locale][ns] = (modules[path] as { default: any }).default;
}

for (const locale in translations) {
    translations[locale] = flattenObject(translations[locale]);
}

export const trans = translations;
