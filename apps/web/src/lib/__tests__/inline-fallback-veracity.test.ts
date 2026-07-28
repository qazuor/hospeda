/**
 * @file inline-fallback-veracity.test.ts
 * @description Companion to `plan-copy-veracity.test.ts`, covering the copy
 * that guard structurally cannot see (HOS-331 round 3).
 *
 * That guard reads locale JSON. But a large share of this app's user-visible
 * marketing text never reaches the catalog: pages call
 * `t('some.key', 'a Spanish fallback')` for keys that do not exist in ANY
 * locale, so `resolve()` returns the fallback and the fallback is what ships —
 * in every language. `/beneficios` is the whole page (`benefits.owner.*` /
 * `benefits.tourist.*` are absent; the file defines `owners.*` / `tourists.*`),
 * and so are `owners.hero.desc`, `about.mission.text` and
 * `pricing.owner.cta.description`.
 *
 * The cost of that blind spot is concrete: a sweep to remove "soporte dedicado"
 * edited `benefits.json`'s `tourists.customerSupport.description` — a key with
 * zero consumers — while `/beneficios` kept rendering "Soporte dedicado" from a
 * fallback, with a phone icon next to it. The diff looked complete and changed
 * nothing a user sees.
 *
 * So this file inverts the lookup: extract every inline fallback from the page
 * sources, keep the ones whose key is absent from all locales (those are the
 * live strings), and hold them to the same claims rules.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { EntitlementKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;
const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');
const WEB_SRC = resolve(__dirname, '../..');

/**
 * Claims no plan can make, because no entitlement backs them. Mirrors
 * `PHANTOM_CLAIMS` in `plan-copy-veracity.test.ts`; kept as plain phrases here
 * because a fallback is not attached to any one plan.
 *
 * `dedicated_manager` / `dedicated support` are the same claim in two dresses:
 * neither `DEDICATED_MANAGER` nor any support entitlement beyond
 * `PRIORITY_SUPPORT` / `VIP_SUPPORT` exists, and the two that do are tier-scoped
 * rather than "dedicated".
 */
const BANNED_PHRASES: readonly string[] = [
    // ad_free — deleted by HOS-16
    'sin publicidad',
    'sin anuncios',
    'ad-free',
    'sem anúncios',
    // no entitlement models a dedicated person
    'soporte dedicado',
    'gestor dedicado',
    'dedicated support',
    'dedicated manager',
    'suporte dedicado',
    'gerente dedicado',
    // never modeled at all
    'conserjería',
    'concierge',
    'traslados al aeropuerto',
    'airport transfer',
    'acceso a la api',
    'api access',
    // card-first (HOS-171): the card is collected on day 1
    'sin tarjeta',
    'sin poner la tarjeta',
    'no pedimos método de pago',
    'no credit card',
    'sem cartão',
    // publishing starts nothing — `first_publish` is rejected
    'trial empieza cuando publicás',
    'arranca tu trial gratis',
    'trial starts when you publish'
];

/** A literal day count in trial prose — the number must come from the catalog. */
const LITERAL_DAYS = [
    /\b\d+[\s-]*(d[ií]as?|dias?|days?)\b/i,
    /\b(d[ií]as?|dias?|days?)[\s-]*\d+\b/i
] as const;

interface InlineFallback {
    readonly file: string;
    readonly key: string;
    readonly text: string;
}

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (entry === '__tests__' || entry === 'node_modules') continue;
            out.push(...walk(full));
        } else if (['.astro', '.tsx', '.ts'].includes(extname(full))) {
            out.push(full);
        }
    }
    return out;
}

/**
 * Extract `(key, fallback)` pairs from page sources.
 *
 * Two shapes are used across this app:
 *   - `t('some.key', 'fallback text')` — the direct call
 *   - `{ titleKey: 'k', titleFb: 'f' }` — the table-driven pages
 *
 * Only single-quoted literals are matched, which is the house style enforced by
 * Biome. Template literals and concatenations are skipped: they cannot be
 * statically resolved, and none of them carry marketing prose today.
 */
function extractFallbacks(source: string, file: string): InlineFallback[] {
    const out: InlineFallback[] = [];
    const call = /\bt\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g;
    for (let m = call.exec(source); m !== null; m = call.exec(source)) {
        const [, key, text] = m;
        if (key && text) out.push({ file, key, text });
    }
    const pair = /(\w*)Key:\s*'([^']+)'\s*,\s*\1Fb:\s*'((?:[^'\\]|\\.)*)'/g;
    for (let m = pair.exec(source); m !== null; m = pair.exec(source)) {
        const [, , key, text] = m;
        if (key && text) out.push({ file, key, text });
    }
    return out;
}

/** Flatten a locale file into `namespace.dotted.path` → value. */
function flatten(prefix: string, value: unknown, sink: Map<string, string>): void {
    if (typeof value === 'string') {
        sink.set(prefix, value);
        return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        flatten(prefix ? `${prefix}.${k}` : k, v, sink);
    }
}

function buildCatalog(locale: string): Map<string, string> {
    const dir = join(LOCALES_DIR, locale);
    const sink = new Map<string, string>();
    for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json')) continue;
        const namespace = file.replace(/\.json$/, '');
        flatten(namespace, JSON.parse(readFileSync(join(dir, file), 'utf8')), sink);
    }
    return sink;
}

const CATALOGS = LOCALES.map((locale) => buildCatalog(locale));
const ALL_FALLBACKS = walk(WEB_SRC).flatMap((file) =>
    extractFallbacks(readFileSync(file, 'utf8'), relative(WEB_SRC, file))
);

/**
 * The fallbacks that are actually rendered: their key resolves in NO locale, so
 * `resolve()` can only return the fallback. A key present in even one locale is
 * excluded — `plan-copy-veracity.test.ts` owns the catalog side.
 */
const LIVE_FALLBACKS = ALL_FALLBACKS.filter((fb) =>
    CATALOGS.every((catalog) => !catalog.get(fb.key)?.trim())
);

describe('inline fallback veracity (HOS-331)', () => {
    it('finds fallbacks in the page sources at all', () => {
        // Guards the guard: a regex that stopped matching would make every
        // assertion below silently vacuous.
        expect(ALL_FALLBACKS.length).toBeGreaterThan(50);
    });

    it('finds fallbacks whose key is missing from every locale', () => {
        // If this ever hits zero, either the catalog got complete (good — then
        // delete this file) or the key comparison broke (bad).
        expect(LIVE_FALLBACKS.length).toBeGreaterThan(0);
    });

    it('never renders a claim no entitlement backs', () => {
        const violations: string[] = [];
        for (const fb of LIVE_FALLBACKS) {
            const haystack = fb.text.toLowerCase();
            for (const phrase of BANNED_PHRASES) {
                if (haystack.includes(phrase)) {
                    violations.push(`${fb.file} → ${fb.key}: "${phrase}"`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('never hardcodes a trial length in a rendered fallback', () => {
        const violations: string[] = [];
        for (const fb of LIVE_FALLBACKS) {
            if (!/prueba|trial|gratis|free|teste/i.test(fb.text)) continue;
            if (LITERAL_DAYS.some((re) => re.test(fb.text))) {
                violations.push(`${fb.file} → ${fb.key}: "${fb.text.slice(0, 70)}…"`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('has no support entitlement that would make "dedicated support" true', () => {
        // Non-vacuity for the support half of BANNED_PHRASES: if a dedicated
        // support entitlement is ever added, this fails and the phrases must
        // move out of the ban list rather than staying banned by inertia.
        const keys = new Set<string>(Object.values(EntitlementKey));
        expect(keys.has('dedicated_manager')).toBe(false);
        expect(keys.has('dedicated_support')).toBe(false);
    });
});
