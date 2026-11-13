import es from '@repo/i18n/locales/es/admin-billing.json';

type TranslationNode = Record<string, unknown>;

function getTranslationNode(path: string): unknown {
    let node: unknown = es;
    for (const part of path.split('.').slice(1)) {
        if (typeof node !== 'object' || node === null || !(part in node)) return undefined;
        node = (node as TranslationNode)[part];
    }
    return node;
}

function interpolate(text: string, values: Record<string, string | number> = {}): string {
    return Object.entries(values).reduce(
        (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
        text
    );
}

/** Creates a Spanish translation hook mock backed by the real locale JSON. */
export function createTranslationMock() {
    return {
        locale: 'es-AR',
        t: (key: string, values?: Record<string, string | number>) => {
            const value = getTranslationNode(key);
            return interpolate(typeof value === 'string' ? value : key, values);
        },
        tPlural: (key: string, count: number) => {
            const parts = key.split('.');
            const leaf = parts.pop();
            const parent = getTranslationNode(parts.join('.'));
            const pluralKey = `${leaf}_${count === 1 ? 'one' : 'other'}`;
            const value =
                typeof parent === 'object' && parent !== null && pluralKey in parent
                    ? (parent as TranslationNode)[pluralKey]
                    : undefined;
            return typeof value === 'string' ? value.replaceAll('{{count}}', String(count)) : key;
        }
    };
}
