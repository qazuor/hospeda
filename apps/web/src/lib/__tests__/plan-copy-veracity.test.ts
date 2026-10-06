/** Locale-only marketing copy guard restored from HOS-331. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];
const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');
interface PlanClaim {
    readonly id: string;
    readonly entitlement: string;
    readonly phrases: Readonly<Record<Locale, readonly string[]>>;
}
const PHANTOM_CLAIMS: readonly PlanClaim[] = [
    {
        id: 'ad-free',
        entitlement: 'ad_free',
        phrases: {
            es: ['sin publicidad', 'sin anuncios'],
            en: ['ad-free', 'ad free'],
            pt: ['sem anúncios', 'sem publicidade']
        }
    },
    {
        id: 'early-access-events',
        entitlement: 'early_access_events',
        phrases: {
            es: ['acceso anticipado'],
            en: ['early access'],
            pt: ['acesso antecipado']
        }
    },
    {
        id: 'concierge',
        entitlement: 'concierge',
        phrases: { es: ['conserjería'], en: ['concierge'], pt: ['concierge'] }
    },
    {
        id: 'airport-transfers',
        entitlement: 'airport_transfers',
        phrases: {
            es: ['traslados al aeropuerto'],
            en: ['airport transfer'],
            pt: ['traslados ao aeroporto']
        }
    },
    {
        id: 'api-access',
        entitlement: 'api_access',
        phrases: {
            es: ['acceso a api', 'acceso a la api'],
            en: ['api access'],
            pt: ['acesso à api', 'acesso a api']
        }
    },
    {
        id: 'dedicated-manager',
        entitlement: 'dedicated_manager',
        phrases: {
            es: ['gestor dedicado', 'soporte dedicado'],
            en: ['dedicated manager', 'dedicated support'],
            pt: ['gerente dedicado', 'suporte dedicado']
        }
    },
    {
        // Not an entitlement question at all — the site contradicts itself.
        // /contacto publishes office hours (Sundays closed) and the owners FAQ
        // says "en horario de oficina", so any round-the-clock wording is false
        // on the site's own evidence. It shipped in /beneficios' meta
        // description, which is what Google puts in the snippet.
        id: 'always-on-support',
        entitlement: 'round_the_clock_support',
        // Tied to SUPPORT, not to the duration. A bare "24 horas" is true in 14
        // catalog strings — the `24h_reception` amenity, an exchange-rate
        // interval, a response-time SLA — and banning it would turn the guard
        // red on facts while blocking any widening of PROSE_SURFACES.
        phrases: {
            es: [
                'soporte 24/7',
                'soporte 24 horas',
                'soporte las 24',
                'las 24 horas del día',
                'siempre disponible'
            ],
            en: ['24/7 support', 'support 24/7', 'round-the-clock support', 'always available'],
            pt: ['suporte 24/7', 'suporte 24 horas', 'sempre disponível']
        }
    }
];

// HOS-1352: transitional until V3 (HOS-1357), see PR — plan-entitlement checks await the replacement catalogue.
function readLocaleJson(locale: Locale, file: string): Record<string, unknown> {
    return JSON.parse(readFileSync(resolve(LOCALES_DIR, locale, file), 'utf8'));
}

function lookupExact(source: Record<string, unknown>, path: string): string | undefined {
    let cursor: unknown = source;
    for (const segment of path.split('.')) {
        if (typeof cursor !== 'object' || cursor === null) return undefined;
        cursor = (cursor as Record<string, unknown>)[segment];
    }
    return typeof cursor === 'string' ? cursor : undefined;
}

/**
 * Resolves `path`, falling back to `${path}_other` when the bare leaf is
 * gone. Several `PROSE_SURFACES` entries (and `faqAnswerPaths()`'s derived
 * list) name a leaf that the HOS plural audit converted to a CLDR
 * `_one`/`_other` pair — without this fallback `lookup()` would return
 * `undefined` and `collectProseCopy()`'s `if (copy)` guard would DROP the
 * row silently, shrinking this guard's coverage with no failure to notice
 * it by. `_other` (not `_one`) is deliberate: this file only substring-matches
 * marketing phrases, not grammar, and `_other` is the form every one of
 * these prose strings actually had before pluralization.
 */
function lookup(source: Record<string, unknown>, path: string): string | undefined {
    return lookupExact(source, path) ?? lookupExact(source, `${path}_other`);
}

function faqAnswerPaths(): ReadonlyArray<{ readonly file: string; readonly path: string }> {
    const faq = readLocaleJson('es', 'faq.json');
    const categories = (faq.categories ?? {}) as Record<
        string,
        { items?: Record<string, unknown> }
    >;
    const out: Array<{ file: string; path: string }> = [];
    for (const [category, body] of Object.entries(categories)) {
        for (const item of Object.keys(body.items ?? {})) {
            out.push({ file: 'faq.json', path: `categories.${category}.items.${item}.answer` });
        }
    }
    return out;
}

/**
 * Every string leaf under a locale namespace file, as `{file, path}` pairs.
 *
 * Derived from `es` — the reference locale `check-locales` enforces, so every
 * path returned here is guaranteed to also resolve in `en`/`pt` (that script
 * hard-fails CI on an `es` key missing from either, independent of this file).
 *
 * HOS-616 is what this function exists for: it moves marketing prose OUT of
 * inline fallbacks (this file's companion, `inline-fallback-veracity.test.ts`,
 * covers those) and INTO these locale files — which only `plan-copy-veracity`
 * can see. An enumerated `{file, path}` list, the shape `PROSE_SURFACES` used
 * for `owners.json`/`benefits.json` before this function existed, misses every
 * key a future HOS-616 batch adds unless someone remembers to list it by
 * hand — the exact class of bug this guard exists to catch, turned on itself
 * (see `benefits.owner.5.title`, moved into `benefits.json` by the same PR
 * that added this sweep, and invisible to the old enumerated list). Sweeping
 * the whole namespace instead means new prose in these files is audited the
 * moment it lands, with no per-key bookkeeping.
 */
function namespaceLeafPaths(
    file: string
): ReadonlyArray<{ readonly file: string; readonly path: string }> {
    const out: Array<{ file: string; path: string }> = [];
    const walk = (value: unknown, prefix: string): void => {
        if (typeof value === 'string') {
            out.push({ file, path: prefix });
            return;
        }
        if (typeof value !== 'object' || value === null) return;
        for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
            walk(v, prefix ? `${prefix}.${key}` : key);
        }
    };
    walk(readLocaleJson('es', file), '');
    return out;
}

/**
 * Namespaces HOS-616 is actively draining inline fallbacks into. Swept whole
 * via `namespaceLeafPaths` rather than enumerated by path — see that
 * function's comment. Extend this list as later HOS-616 batches touch more
 * namespaces (`gastronomy.json` and `blog.json` are here even though this
 * round moved no PHANTOM/BACKED-claim-shaped copy into them, so the next
 * batch that does is covered without a second PR to this file).
 */
const HOS_616_DRAINED_NAMESPACES = [
    'benefits.json',
    'owners.json',
    'about.json',
    'blog.json',
    'gastronomy.json'
] as const;

const PROSE_SURFACES: ReadonlyArray<{ readonly file: string; readonly path: string }> = [
    ...faqAnswerPaths(),
    ...HOS_616_DRAINED_NAMESPACES.flatMap((file) => namespaceLeafPaths(file)),
    { file: 'host.json', path: 'landing.trialCallout' },
    { file: 'host.json', path: 'pages.nueva.trialNote' },
    { file: 'features.json', path: 'anfitriones.banner.title' },
    // The paragraph directly under the banner title. Correcting the title and
    // not this sentence is how "no pedimos método de pago" outlived the sweep
    // that removed "sin poner la tarjeta" one line above it.
    { file: 'features.json', path: 'anfitriones.banner.description' },
    { file: 'features.json', path: 'cta.description' },
    { file: 'host.json', path: 'pages.nueva.trialCalloutTitle' },
    { file: 'host.json', path: 'properties.card.publishSubscriptionRequiredMessage' }
];

function collectProseCopy(): ReadonlyArray<{
    readonly locale: Locale;
    readonly surface: string;
    readonly copy: string;
}> {
    const rows: Array<{ locale: Locale; surface: string; copy: string }> = [];
    const unresolved: string[] = [];
    for (const locale of LOCALES) {
        for (const { file, path } of PROSE_SURFACES) {
            const copy = lookup(readLocaleJson(locale, file), path);
            if (copy) {
                rows.push({ locale, surface: `${file}:${path}`, copy });
                continue;
            }
            unresolved.push(`${locale}/${file}:${path}`);
        }
    }

    // A declared surface that resolves to nothing is coverage this guard
    // silently stops providing. Dropping it kept the suite green while the
    // pluralization pass renamed leaves out from under PROSE_SURFACES — the
    // exact failure this file exists to prevent, turned on the file itself.
    // Fail loudly instead: either the path is stale and should be removed, or
    // the copy moved and the path should follow it.
    if (unresolved.length > 0) {
        throw new Error(
            'PROSE_SURFACES names copy that no longer exists, so these surfaces ' +
                `are no longer audited for trial-eligibility claims:\n${unresolved.join('\n')}`
        );
    }
    return rows;
}

/**
 * Wording that genuinely qualifies a trial promise.
 *
 * `primera propiedad` / `primera vez` are deliberately absent: both describe
 * WHEN someone thought the trial started rather than WHO is eligible, and on a
 * publish-blocked screen a reader binds "first time" to publishing. Only
 * wording that names the SUBSCRIPTION counts, because that is what
 * `resolveCheckoutFreeTrialDays` actually gates on.
 */
const FIRST_SUBSCRIPTION_HINTS: Record<Locale, readonly string[]> = {
    // The second hint in each language is HOS-1012's: eligibility is keyed on
    // `(customer, product domain)`, so the honest qualifier names the VERTICAL,
    // not the subscription. "one per account" would now be false in the
    // generous direction (someone who spent their accommodation trial does get
    // one in gastronomy) and "first subscription" false in the strict one
    // (within accommodation the trial is one, whichever plan is chosen). Both
    // spellings are accepted because the older copy is still true wherever it
    // survives. "primera propiedad" / "first property" stay REJECTED: they say
    // WHEN the trial starts, never WHO still has one.
    es: ['primera suscripción', 'una sola para alojamientos'],
    en: ['first subscription', 'only one for accommodation'],
    pt: ['primeira assinatura', 'uma só para hospedagens']
};

const PROSE_COPY = collectProseCopy();
function matchedPhrase(copy: string, claim: PlanClaim, _locale: Locale): string | undefined {
    const haystack = copy.toLowerCase();
    for (const locale of LOCALES) {
        const hit = claim.phrases[locale].find((phrase) => haystack.includes(phrase));
        if (hit) return hit;
    }
    return undefined;
}

describe('plan copy veracity — FAQ and landing prose (HOS-331)', () => {
    it('never promises a feature that has no entitlement behind it', () => {
        const violations: string[] = [];
        for (const row of PROSE_COPY) {
            for (const claim of PHANTOM_CLAIMS) {
                const phrase = matchedPhrase(row.copy, claim, row.locale);
                if (phrase) {
                    violations.push(
                        `${row.locale}/${row.surface} sells "${phrase}" (${claim.id}), which no entitlement backs`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('states the trial length by interpolation, never as a literal number', () => {
        // The trial moves (D1 takes it from 14 to 30). Prose that types the
        // number cannot be kept in step with `OWNER_TRIAL_DAYS`, and the halves
        // that drift apart contradict each other on adjacent screens.
        //
        // Both orders are checked: "14 días" AND "día 14" / "day 14". The
        // postfix form is the one these very strings used ("no pagás nada hasta
        // el día 14"), so matching only the prefix would have missed them.
        const PREFIX = /\b\d+[\s-]*(d[ií]as?|dias?|days?)\b/i;
        const POSTFIX = /\b(d[ií]as?|dias?|days?)[\s-]*\d+\b/i;
        // Scoped to trial prose. Unscoped, the rule fires on any day count in
        // any guarded string — "eliminamos tus datos en un plazo máximo de 30
        // días" is a true, unrelated sentence that would be reported as a
        // hardcoded trial length, and the noise would get the rule deleted.
        const TRIAL_CONTEXT = /prueba|trial|gratis|gr[áa]tis|free|teste/i;
        const literals: string[] = [];
        for (const row of PROSE_COPY) {
            if (!TRIAL_CONTEXT.test(row.copy)) continue;
            if (PREFIX.test(row.copy) || POSTFIX.test(row.copy)) {
                literals.push(`${row.locale}/${row.surface}: "${row.copy.slice(0, 80)}…"`);
            }
        }
        expect(literals).toEqual([]);
    });

    it('does not promise a trial without saying it is for the first subscription', () => {
        // `resolveCheckoutFreeTrialDays` zeroes the trial once the customer has
        // ANY prior subscription — "one trial per customer, for life". Copy that
        // says "every plan includes N free days" full stop is false for a
        // returning host, who is then charged on day 1.
        // "primera propiedad" / "first property" are deliberately NOT accepted.
        // They describe WHEN someone thought the trial started, not WHO is
        // eligible for it — and eligibility is the thing this assertion is
        // about. Accepting them let this guard green-light exactly the copy it
        // exists to catch.
        //
        // The second half of that reason has expired and is kept out on
        // purpose: it used to add "and publishing an accommodation starts
        // nothing — `accommodation.service.ts` rejects `first_publish`", which
        // was true under HOS-171 and false since HOS-1012, where publishing
        // inserts a local trial row in the same transaction as the lifecycle
        // flip. The rejection above survives on the first reason alone, which
        // never depended on when the clock starts.
        // Hints from every language, for the same reason `matchedPhrase` scans
        // all three: a locale directory does not guarantee locale content.
        const allHints = LOCALES.flatMap((locale) => FIRST_SUBSCRIPTION_HINTS[locale]);
        // A trial can be promised in words as well as in a number: the banner
        // description says "no se cobra nada hasta que termina la prueba" with
        // no placeholder at all, and gating only on `{{trialDays}}` skipped
        // exactly the row whose comment explains why it is guarded.
        const PROMISES_A_TRIAL =
            /\{\{trialDays\}\}|prueba gratis|prueba gratuita|free trial|teste gr[áa]tis|d[ií]as gratis|days free|dias gr[áa]tis|termina la prueba|trial ends|teste terminar/i;
        const unqualified: string[] = [];
        for (const row of PROSE_COPY) {
            if (!PROMISES_A_TRIAL.test(row.copy)) continue;
            const haystack = row.copy.toLowerCase();
            if (!allHints.some((hint) => haystack.includes(hint))) {
                unqualified.push(`${row.locale}/${row.surface}`);
            }
        }
        expect(unqualified).toEqual([]);
    });
});

describe('plan copy veracity — hero trial', () => {
    it('qualifies the hero trial stat, whose claim is split across two keys', () => {
        // `hero.stats.trial` renders as one pill: `value` holds the
        // interpolated number and `label` holds the words. Neither key can be
        // guarded alone — the number-bearing one has no words to qualify, and
        // the word-bearing one has no placeholder, so the qualifier rule above
        // skips it. Listing `label` in PROSE_SURFACES looked like coverage and
        // was inert. The pair has to be read as the sentence it renders as.
        const features = LOCALES.map((locale) => ({
            locale,
            json: readLocaleJson(locale, 'features.json')
        }));
        const violations: string[] = [];
        for (const { locale, json } of features) {
            const value = lookup(json, 'hero.stats.trial.value');
            const label = lookup(json, 'hero.stats.trial.label');
            expect(value, `${locale}: hero.stats.trial.value missing`).toBeTruthy();
            expect(label, `${locale}: hero.stats.trial.label missing`).toBeTruthy();
            const sentence = `${value ?? ''} ${label ?? ''}`;
            if (!sentence.includes('{{trialDays}}')) {
                violations.push(`${locale}: hero trial stat hardcodes its number`);
            }
            const qualifiers = LOCALES.flatMap((l) => FIRST_SUBSCRIPTION_HINTS[l]);
            if (!qualifiers.some((hint) => sentence.toLowerCase().includes(hint))) {
                violations.push(
                    `${locale}: hero trial stat promises a trial without the first-subscription qualifier`
                );
            }
        }
        expect(violations).toEqual([]);
    });
});
