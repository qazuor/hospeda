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
    // availability: /contacto publishes office hours (Sundays closed) and the
    // owners FAQ says "en horario de oficina", so round-the-clock wording is
    // contradicted by the site itself, no entitlement reasoning required
    'soporte 24/7',
    'soporte 24 horas',
    'soporte las 24',
    'las 24 horas del día',
    'siempre disponible',
    '24/7 support',
    'round-the-clock support',
    'always available',
    'suporte 24/7',
    'sempre disponível',
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
    /** Which extraction shape produced this row — asserted on, see below. */
    readonly shape: 'call' | 'pair';
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
 * BOTH quote styles are matched. Biome does NOT normalise quotes inside
 * `.astro` markup expressions, and 47 double-quoted calls live in exactly the
 * marketing surfaces this guard targets — `Footer.astro`, `Header.astro`, the
 * home page and the owner CTA. Assuming single quotes made the guard blind to
 * the pages where the next bad claim is most likely to land.
 *
 * Template literals and concatenations are still skipped: they cannot be
 * statically resolved, and none carry marketing prose today.
 */
function extractFallbacks(source: string, file: string): InlineFallback[] {
    const out: InlineFallback[] = [];
    // The body class excludes only the delimiter itself, via a backreference —
    // not both quote characters. Excluding both drops the whole match (the
    // engine restarts past it) on any fallback containing the other quote, and
    // three real call sites do: a Spanish fallback quoting «"Consulta sobre un
    // alojamiento"», an English `Don't have an account?`, and a hint quoting
    // 'Todas mis propiedades'.
    const call = /\bt\(\s*(['"])([^'"]+)\1\s*,\s*(['"])((?:(?!\3)[^\\]|\\.)*)\3/g;
    for (let m = call.exec(source); m !== null; m = call.exec(source)) {
        const key = m[2];
        const text = m[4];
        if (key && text) out.push({ file, key, text, shape: 'call' });
    }
    const pair = /(\w*)Key:\s*(['"])([^'"]+)\2\s*,\s*\1Fb:\s*(['"])((?:[^'"\\]|\\.)*)\4/g;
    for (let m = pair.exec(source); m !== null; m = pair.exec(source)) {
        const key = m[3];
        const text = m[5];
        if (key && text) out.push({ file, key, text, shape: 'pair' });
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

/**
 * Namespaces whose registered name differs from their file name.
 *
 * `config.shared.ts` binds `destination.json` to `destinations` and
 * `event.json` to `events`. Deriving the namespace from the file name — the
 * obvious thing — silently gets both wrong, mismatching this catalogue against
 * the keys the call sites actually name.
 *
 * The call sites themselves used to carry the same confusion, naming the
 * singular so that no key ever resolved. That was H-45, and it is fixed;
 * `i18n-namespace-prefix.guard.test.ts` now fails the build if a call site
 * names a namespace the catalogue does not register. This map remains because
 * the file/namespace split is still real on the catalogue side.
 */
const NAMESPACE_BY_FILE: Readonly<Record<string, string>> = {
    destination: 'destinations',
    event: 'events'
};

function buildCatalog(locale: string): Map<string, string> {
    const dir = join(LOCALES_DIR, locale);
    const sink = new Map<string, string>();
    for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json')) continue;
        const base = file.replace(/\.json$/, '');
        const namespace = NAMESPACE_BY_FILE[base] ?? base;
        flatten(namespace, JSON.parse(readFileSync(join(dir, file), 'utf8')), sink);
    }
    return sink;
}

const CATALOGS = LOCALES.map((locale) => buildCatalog(locale));
const ALL_FALLBACKS = walk(WEB_SRC).flatMap((file) =>
    extractFallbacks(readFileSync(file, 'utf8'), relative(WEB_SRC, file))
);

/**
 * The fallbacks that are actually rendered somewhere.
 *
 * `resolve()` reads ONE locale's dictionary (`getLocaleDict(locale)`) with no
 * cross-locale merge, so a key present only in `es` still renders the Spanish
 * fallback on `/en` and `/pt`. The condition is therefore "missing from AT
 * LEAST ONE locale", not "missing from all" — the stricter reading would let a
 * partially-translated key smuggle a bad claim into two of three languages.
 */
const LIVE_FALLBACKS = ALL_FALLBACKS.filter((fb) =>
    CATALOGS.some((catalog) => !catalog.get(fb.key)?.trim())
);

describe('inline fallback veracity (HOS-331)', () => {
    it('maps every locale file to the namespace config.shared.ts registers it under', () => {
        // The map above was justified by a comment with hard numbers and by
        // nothing else: setting it to `{}` re-introduced the round-4 bug with
        // every test still green. Derive the truth from the registry instead.
        //
        // `rawWebTranslations` binds `<namespace>: <import>` and the imports are
        // named after their file (`destinationEs` <- destination.json), so the
        // binding lines are enough to recover the file->namespace pairs without
        // executing the module.
        const registry = readFileSync(resolve(LOCALES_DIR, '../config.shared.ts'), 'utf8');
        const esBlock = registry.slice(registry.indexOf('export const rawWebTranslations'));
        const bindings = [...esBlock.matchAll(/^\s{8}'?([\w-]+)'?:\s*(\w+?)Es,?$/gm)];
        expect(bindings.length).toBeGreaterThan(40);

        const mismatches: string[] = [];
        for (const [, namespace, importName] of bindings) {
            if (!namespace || !importName) continue;
            // `aiSearchEs` <- aiSearch.json, `authUiEs` <- auth-ui.json: compare
            // case- and dash-insensitively, the file name is the source of truth.
            const normalise = (value: string) => value.replace(/-/g, '').toLowerCase();
            const expected = NAMESPACE_BY_FILE[importName] ?? importName;
            if (normalise(expected) !== normalise(namespace)) {
                mismatches.push(`${importName}.json is registered as '${namespace}'`);
            }
        }
        expect(mismatches).toEqual([]);
    });

    it('finds fallbacks of BOTH extraction shapes and BOTH file types', () => {
        // Guards the guard, on every axis that can silently collapse.
        //
        // A single global threshold cannot: the `pair` shape is ~110 of ~3100
        // rows and `.astro` is ~1300, so losing either entirely still leaves
        // thousands. Filtering by KEY PREFIX does not work either — the
        // `benefits.owner.*` keys come from BOTH shapes, so such a filter
        // survives total loss of the pair regex. Count the shapes themselves.
        const byShape = (shape: 'call' | 'pair') =>
            ALL_FALLBACKS.filter((fb) => fb.shape === shape).length;
        expect(byShape('call')).toBeGreaterThan(1000);
        expect(byShape('pair')).toBeGreaterThan(50);
        const astroRows = ALL_FALLBACKS.filter((fb) => fb.file.endsWith('.astro')).length;
        const tsxRows = ALL_FALLBACKS.filter((fb) => fb.file.endsWith('.tsx')).length;
        expect(astroRows).toBeGreaterThan(500);
        expect(tsxRows).toBeGreaterThan(500);
        // And pin the row this file was written for, which only `pair` produces.
        expect(LIVE_FALLBACKS.some((fb) => fb.key === 'benefits.owner.5.title')).toBe(true);
    });

    it('finds fallbacks whose key is missing from at least one locale', () => {
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

    it('never promises a trial in a fallback without the first-subscription qualifier', () => {
        // The catalog guard enforces this on 24 strings; it cannot reach a
        // fallback, because a fallback exists precisely where the catalog does
        // not. `pricing.owner.cta.description` — the CTA on
        // /suscriptores/planes/comparar — is the one live fallback carrying
        // `{{trialDays}}`, so dropping its qualifier was undetectable by either
        // guard: a rule-shaped seam, not a surface-shaped one.
        const HINTS = ['primera suscripción', 'first subscription', 'primeira assinatura'] as const;
        const withPlaceholder = LIVE_FALLBACKS.filter((fb) => fb.text.includes('{{trialDays}}'));
        // Non-vacuity: if no live fallback interpolates the trial any more, this
        // rule is scanning nothing and should be revisited rather than trusted.
        expect(withPlaceholder.length).toBeGreaterThan(0);
        const unqualified = withPlaceholder
            .filter((fb) => !HINTS.some((hint) => fb.text.toLowerCase().includes(hint)))
            .map((fb) => `${fb.file} → ${fb.key}`);
        expect(unqualified).toEqual([]);
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
