/**
 * Guard: en/pt values must not be identical to their Spanish (es) value.
 *
 * Existing i18n guards only check STRUCTURE (key parity, placeholders). This
 * one checks CONTENT: a value copied verbatim from `es` into `en` or `pt` is
 * almost always untranslated Spanish (HOS-1317, e.g. `sectionsLabel`).
 *
 * Two escape hatches, both explicit:
 *  - `LEGITIMATE_IDENTICAL`: values that are genuinely the same word in the
 *    target locale (brand names, loanwords). Permanent. Add here only with a
 *    reason; never add a Spanish sentence.
 *  - `untranslated-spanish.baseline.json`: TEMPORARY ratchet of the debt that
 *    existed when the guard landed (HOS-1317). The test fails when a NEW
 *    identical value appears AND when a baseline entry is fixed but not removed,
 *    so the list can only shrink. Fix entries by translating them, then delete
 *    them from the baseline (or regenerate it by running the test with
 *    UPDATE_UNTRANSLATED_BASELINE=1 in the environment).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const BASELINE_PATH = path.resolve(__dirname, 'untranslated-spanish.baseline.json');
const TARGET_LOCALES = ['en', 'pt'] as const;
type TargetLocale = (typeof TARGET_LOCALES)[number];

/**
 * Permanent allowlist: value -> locales where an identical value is correct.
 * Brand names and words that are spelled the same in English / Brazilian Portuguese.
 */
const LEGITIMATE_IDENTICAL: Readonly<Record<string, readonly TargetLocale[]>> = {
    Email: ['en', 'pt'],
    // HOS-2589 promotion labels: loanwords and same-spelling Portuguese.
    VIP: ['en', 'pt'],
    Promo: ['en', 'pt'],
    'Para todos': ['pt'],
    'Ver {{name}}': ['pt'],
    'Página {{page}} de {{total}}': ['pt'],
    // Spelled the same in English / Brazilian Portuguese (HOS-2485 subscription tabs
    // and the add-on purchase steps).
    Plan: ['en'],
    Complementos: ['pt'],
    Complemento: ['pt'],
    Destino: ['pt'],
    // Same word in Brazilian Portuguese (HOS-2628 favorites singular card type).
    Evento: ['pt'],
    Confirmar: ['pt'],
    WhatsApp: ['en', 'pt'],
    // Correct in both Spanish and Brazilian Portuguese (HOS-2521 contact copy).
    '/hora': ['pt'],
    '/grupo': ['pt'],
    // Bed/beds share the same spelling in Spanish and Brazilian Portuguese.
    '{{count}} cama': ['pt'],
    '{{count}} camas': ['pt'],
    // Same words in Brazilian Portuguese (HOS-2527 listing section tab labels).
    Fotos: ['pt'],
    Comodidades: ['pt'],
    Facebook: ['en', 'pt'],
    Instagram: ['en', 'pt'],
    YouTube: ['en', 'pt'],
    // Brand names of the editor social links (HOS-2497).
    TikTok: ['en', 'pt'],
    LinkedIn: ['en', 'pt'],
    'X (Twitter)': ['en', 'pt'],
    Hospeda: ['en', 'pt'],
    Hotel: ['en', 'pt'],
    Motel: ['en', 'pt'],
    Premium: ['en', 'pt'],
    Total: ['en', 'pt'],
    Manual: ['en', 'pt'],
    Blog: ['en', 'pt'],
    Videos: ['en'],
    Camping: ['en'],
    Error: ['en'],
    Partner: ['en'],
    Slug: ['en', 'pt'],
    // Spelled the same in Brazilian Portuguese (HOS-2184 AI assistants / consent).
    Copiar: ['pt'],
    Desconectar: ['pt'],
    'Desconectar {{name}}': ['pt'],
    Cancelar: ['pt'],
    // Same word in Brazilian Portuguese (HOS-2432 collection card count label).
    favoritos: ['pt'],
    Permitir: ['pt'],
    'Conectando...': ['pt'],
    'Cancelando...': ['pt'],
    // Same word in Brazilian Portuguese (HOS-2192 location-exception screens).
    Conceder: ['pt'],
    Concedida: ['pt'],
    Motivo: ['pt'],
    Sistema: ['pt'],
    Anterior: ['pt'],
    // Same words in Brazilian Portuguese (HOS-2436 rich-text toolbar and weekday abbreviations).
    Lista: ['pt'],
    'Lista numerada': ['pt'],
    Sáb: ['pt'],
    // Same adjectives in Brazilian Portuguese (HOS-2415 editor nav status).
    Completa: ['pt'],
    // Same words in Brazilian Portuguese (HOS-2496 editor location fields).
    Coordenadas: ['pt'],
    Número: ['pt'],
    Incompleta: ['pt'],
    Dom: ['pt'],
    // Placeholder-only wording that reads the same in Brazilian Portuguese (HOS-2192).
    '{{count}} de {{max}} caracteres': ['pt'],
    // HOS-2565 email previewer audience filter: "Staff" is the owner's term in es and the English word; "Todos" is the same in Brazilian Portuguese.
    Staff: ['en'],
    Todos: ['pt'],
    // Same word in Brazilian Portuguese / English (HOS-2413 Mi Cuenta kit: status words, counter, error prefix).
    'Error:': ['en'],
    Abandonada: ['pt'],
    Cancelada: ['pt'],
    Confirmado: ['pt'],
    Pausada: ['pt'],
    Pausado: ['pt'],
    Publicado: ['pt'],
    Vencida: ['pt'],
    Vencido: ['pt'],
    Vigente: ['pt'],
    '{{current}} de {{max}} caracteres': ['pt'],
    'Página anterior': ['pt'],
    'Página {{page}}': ['pt'],
    Descartar: ['pt'],
    'Kit de componentes': ['pt'],
    // Same spelling in Brazilian Portuguese / English (HOS-2119 owner traffic panel).
    Países: ['pt'],
    Dispositivos: ['pt'],
    Notebook: ['pt'],
    Celular: ['pt'],
    Tablet: ['en', 'pt'],
    Período: ['pt'],
    '{{count}} visitante': ['pt'],
    '{{count}} visitantes': ['pt'],
    // Same word in Brazilian Portuguese (HOS-2349 assistant activity log).
    Tipo: ['pt'],
    Resultado: ['pt'],
    Consulta: ['pt'],
    // Loanwords used as-is in the admin email previewer (HOS-2519).
    Emails: ['en'],
    Newsletter: ['en', 'pt'],
    Partners: ['en'],
    Outbox: ['en', 'pt'],
    Alertas: ['pt'],
    '{{shown}} de {{total}}': ['pt'],
    // Same word in Brazilian Portuguese (HOS-2413 account kit field hint).
    '(opcional)': ['pt']
};

/** Flattens a nested JSON object to dot-notation leaf entries. */
function flatten({
    obj,
    prefix = ''
}: {
    obj: Record<string, unknown>;
    prefix?: string;
}): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(out, flatten({ obj: value as Record<string, unknown>, prefix: full }));
        } else {
            out[full] = value;
        }
    }
    return out;
}

/** Returns sorted `file:key` ids of target values identical to es, minus the permanent allowlist. */
function collectIdentical({ locale }: { locale: TargetLocale }): string[] {
    const found: string[] = [];
    const files = fs.readdirSync(path.join(LOCALES_DIR, 'es')).filter((f) => f.endsWith('.json'));
    for (const file of files) {
        const targetPath = path.join(LOCALES_DIR, locale, file);
        if (!fs.existsSync(targetPath)) continue;
        const es = flatten({
            obj: JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'es', file), 'utf-8'))
        });
        const target = flatten({ obj: JSON.parse(fs.readFileSync(targetPath, 'utf-8')) });
        for (const [key, value] of Object.entries(target)) {
            if (typeof value !== 'string' || es[key] !== value) continue;
            // Placeholders / symbols only: nothing to translate.
            if (!/\p{L}/u.test(value.replace(/\{\{\w+\}\}/g, ''))) continue;
            if (LEGITIMATE_IDENTICAL[value]?.includes(locale)) continue;
            // snake_case identifiers (MCP tool names, HOS-2349) are never translated.
            if (/^[a-z]+(?:_[a-z]+)+$/.test(value)) continue;
            found.push(`${file}:${key}`);
        }
    }
    return found.sort();
}

describe('en/pt values are not untranslated Spanish', () => {
    const current: Record<TargetLocale, string[]> = {
        en: collectIdentical({ locale: 'en' }),
        pt: collectIdentical({ locale: 'pt' })
    };

    if (process.env.UPDATE_UNTRANSLATED_BASELINE === '1') {
        fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
    }

    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as Record<
        TargetLocale,
        string[]
    >;

    for (const locale of TARGET_LOCALES) {
        it(`${locale}: no new value identical to es (fix by translating it)`, () => {
            const allowed = new Set(baseline[locale]);
            expect(current[locale].filter((id) => !allowed.has(id))).toEqual([]);
        });

        it(`${locale}: baseline has no stale entries (remove translated ones)`, () => {
            const now = new Set(current[locale]);
            expect(baseline[locale].filter((id) => !now.has(id))).toEqual([]);
        });
    }
});
