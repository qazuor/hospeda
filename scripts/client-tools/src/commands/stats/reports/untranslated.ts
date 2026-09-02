import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pc from 'picocolors';
import type { Outcome } from '../types.ts';

const LOCALES_DIR = 'packages/i18n/src/locales';
const REFERENCE = 'es';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Flatten to `dotted.path -> value`, keeping only string leaves. */
function leaves(
    value: Json,
    prefix = '',
    out: Map<string, string> = new Map()
): Map<string, string> {
    if (typeof value === 'string') {
        if (prefix.length > 0) out.set(prefix, value);
        return out;
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return out;
    for (const [key, child] of Object.entries(value)) {
        leaves(child, prefix.length === 0 ? key : `${prefix}.${key}`, out);
    }
    return out;
}

/**
 * Strings that are legitimately identical across languages.
 *
 * Without this filter the report is useless in the other direction: "OK",
 * "WhatsApp", a URL and a number are supposed to match, and counting them as
 * untranslated buries the real cases under noise.
 */
function isExpectedMatch(value: string): boolean {
    const text = value.trim();
    if (text.length <= 2) return true;
    if (/^[\d\s.,:%+×/-]+$/.test(text)) return true; // numbers, dates, ranges
    if (/^https?:\/\//.test(text)) return true; // URLs
    if (/^[{[<].*[}\]>]$/.test(text)) return true; // pure interpolation
    if (/^[\p{Emoji}\p{P}\s]+$/u.test(text)) return true; // emoji and punctuation
    const brands =
        /^(ok|email|e-mail|whatsapp|instagram|facebook|google|mercadopago|mercado pago|airbnb|booking|wifi|check-in|check out|check-out|pdf|url|id|api|sms|hospeda|password|pin|qr|tv|gps|iva|cbu|cuit|dni)$/i;
    return brands.test(text);
}

export type UntranslatedRow = {
    readonly namespace: string;
    readonly key: string;
    readonly locale: string;
    readonly value: string;
    /** Words in the string. Length is what separates signal from cognate noise. */
    readonly words: number;
};

/** Below this, an identical string is more likely a cognate than an oversight. */
export const STRONG_SIGNAL_WORDS = 4;

export type UntranslatedReport = {
    readonly reference: string;
    readonly totalStrings: number;
    readonly byLocale: Readonly<Record<string, number>>;
    /** Only matches of STRONG_SIGNAL_WORDS words or more, per locale. */
    readonly strongByLocale: Readonly<Record<string, number>>;
    readonly byNamespace: readonly { readonly namespace: string; readonly count: number }[];
    readonly rows: readonly UntranslatedRow[];
    readonly ignoredAsExpected: number;
};

/**
 * Keys that exist in every language but hold the reference text verbatim.
 *
 * The structural i18n check reports these as 100% complete, because the key IS
 * there — it just was never translated. This is the only way to see that from
 * the outside, and it is why the summary carries a warning about it.
 */
export async function collectUntranslated(repo: string): Promise<Outcome<UntranslatedReport>> {
    let locales: string[];
    try {
        const entries = await readdir(join(repo, LOCALES_DIR), { withFileTypes: true });
        locales = entries
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort();
    } catch {
        return { ok: false, reason: `no se encontró ${LOCALES_DIR} en este repositorio` };
    }
    if (!locales.includes(REFERENCE)) {
        return { ok: false, reason: `falta el locale de referencia '${REFERENCE}'` };
    }
    const others = locales.filter((l) => l !== REFERENCE);
    const files = (await readdir(join(repo, LOCALES_DIR, REFERENCE))).filter((f) =>
        f.endsWith('.json')
    );

    const rows: UntranslatedRow[] = [];
    const byLocale: Record<string, number> = Object.fromEntries(others.map((l) => [l, 0]));
    const strongByLocale: Record<string, number> = Object.fromEntries(others.map((l) => [l, 0]));
    const perNamespace = new Map<string, number>();
    let totalStrings = 0;
    let ignoredAsExpected = 0;

    const read = async (locale: string, file: string): Promise<Map<string, string> | null> => {
        try {
            return leaves(
                JSON.parse(await readFile(join(repo, LOCALES_DIR, locale, file), 'utf8')) as Json
            );
        } catch {
            return null;
        }
    };

    for (const file of files) {
        const reference = await read(REFERENCE, file);
        if (reference === null) continue;
        totalStrings += reference.size;
        const namespace = file.replace(/\.json$/, '');

        for (const locale of others) {
            const translated = await read(locale, file);
            if (translated === null) continue;
            for (const [key, refValue] of reference) {
                const value = translated.get(key);
                if (value === undefined || value !== refValue) continue;
                if (isExpectedMatch(refValue)) {
                    ignoredAsExpected += 1;
                    continue;
                }
                const words = refValue.trim().split(/\s+/).length;
                rows.push({ namespace, key, locale, value: refValue, words });
                if (words >= STRONG_SIGNAL_WORDS) {
                    strongByLocale[locale] = (strongByLocale[locale] ?? 0) + 1;
                }
                byLocale[locale] = (byLocale[locale] ?? 0) + 1;
                if (words >= STRONG_SIGNAL_WORDS) {
                    perNamespace.set(namespace, (perNamespace.get(namespace) ?? 0) + 1);
                }
            }
        }
    }

    // Longest first: a full sentence repeated verbatim is a real oversight,
    // while a single word matching is usually just Spanish and Portuguese
    // sharing it. Sorting by length puts the signal at the top.
    rows.sort((a, b) => b.words - a.words || a.namespace.localeCompare(b.namespace));

    return {
        ok: true,
        data: {
            reference: REFERENCE,
            totalStrings,
            byLocale,
            strongByLocale,
            byNamespace: [...perNamespace.entries()]
                .map(([namespace, count]) => ({ namespace, count }))
                .sort((a, b) => b.count - a.count),
            rows,
            ignoredAsExpected
        }
    };
}

const num = (v: number): string => v.toLocaleString('es-AR');

export function drawUntranslated(r: UntranslatedReport): void {
    const locales = Object.keys(r.byLocale);
    const strongTotal = Object.values(r.strongByLocale).reduce((a, b) => a + b, 0);

    process.stdout.write(`  Cadenas en '${r.reference}': ${num(r.totalStrings)}\n`);
    process.stdout.write(
        `  Coincidencias esperadas descartadas: ${num(r.ignoredAsExpected)}  ${pc.dim('(marcas, números, URLs)')}\n\n`
    );

    process.stdout.write(
        `  ${'IDIOMA'.padEnd(8)}${'IDÉNTICAS'.padStart(11)}${`DE ${STRONG_SIGNAL_WORDS}+ PALABRAS`.padStart(18)}\n`
    );
    for (const locale of locales) {
        const all = r.byLocale[locale] ?? 0;
        const strong = r.strongByLocale[locale] ?? 0;
        process.stdout.write(
            `  ${locale.padEnd(8)}${pc.dim(num(all).padStart(11))}` +
                `${(strong === 0 ? pc.green(num(strong)) : pc.yellow(num(strong))).padStart(strong === 0 ? 27 : 28)}\n`
        );
    }

    process.stdout.write(
        `\n  ${pc.dim('La primera columna incluye cognados: «Bar», «Tipo» o «Piscina» son iguales')}\n` +
            `  ${pc.dim('en español y portugués y están bien. La segunda es la que vale: una frase')}\n` +
            `  ${pc.dim(`de ${STRONG_SIGNAL_WORDS} palabras o más repetida palabra por palabra no es una coincidencia.`)}\n`
    );

    if (strongTotal === 0) {
        process.stdout.write(`\n  ${pc.green('Ninguna frase larga quedó sin traducir.')}\n`);
        return;
    }

    process.stdout.write(
        `\n  ${pc.bold(`Por namespace`)}  ${pc.dim(`(sólo frases de ${STRONG_SIGNAL_WORDS}+ palabras)`)}\n`
    );
    for (const ns of r.byNamespace.slice(0, 15)) {
        process.stdout.write(`    ${String(ns.count).padStart(6)}  ${ns.namespace}\n`);
    }
    if (r.byNamespace.length > 15) {
        process.stdout.write(`    ${pc.dim(`… y ${r.byNamespace.length - 15} namespaces más`)}\n`);
    }

    process.stdout.write(
        `\n  ${pc.bold('Las más largas')}  ${pc.dim('— las que con más seguridad nunca se tradujeron')}\n`
    );
    for (const row of r.rows.slice(0, 15)) {
        process.stdout.write(
            `    ${pc.dim(`[${row.locale}]`)} ${row.namespace}.${row.key}  ${pc.dim(`(${row.words} palabras)`)}\n`
        );
        process.stdout.write(`        ${pc.yellow(`"${row.value.slice(0, 68)}"`)}\n`);
    }
    const strongRows = r.rows.filter((row) => row.words >= STRONG_SIGNAL_WORDS).length;
    if (strongRows > 15) {
        process.stdout.write(`    ${pc.dim(`… y ${strongRows - 15} frases largas más`)}\n`);
    }
}
