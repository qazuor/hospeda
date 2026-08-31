/**
 * HOS-937 R-1 — static/behavioral guard: no MercadoPago `back_url` carries a
 * query param of our own.
 *
 * ## The bug this prevents
 *
 * MercadoPago's preapproval redirect concatenates its own query param
 * (`preapproval_id`) onto the configured `back_url` with a bare `?`, never
 * `&` (measured — see `.specs/HOS-937-preapproval-propio-por-usuario/spec.md`
 * §10 R-1). If our `back_url` already carries a `?` of its own, MercadoPago's
 * append produces a second `?` and `preapproval_id` stops parsing on return.
 *
 * It does not fire today only because every `back_url` builder in
 * `checkout-return-urls.ts` happens to return a clean URL — an accident, not
 * something previously defended. This guard makes that invariant explicit and
 * load-bearing.
 *
 * ## Why `notification_url` is exempt, on purpose
 *
 * `buildNotificationUrl()` is NOT a `back_url` — it is the webhook
 * `notification_url`, and it MUST carry `?source_news=webhooks`
 * (`V2_SOURCE_NEWS_MARKER`, HOS-159): the webhook router drops any delivery
 * missing that marker as a legacy IPN duplicate. MercadoPago appends its own
 * webhook params to `notification_url` with `&`, not `?`, so this file's bug
 * class does not apply there. This exemption is anchored on the MARKER VALUE
 * `buildNotificationUrl()` actually returns, not on its name.
 *
 * ## The arity escape hatch this version closes
 *
 * An earlier version of this guard skipped every export whose arity was
 * greater than 1, on the theory that the only arity-2 exports were the two
 * add-on Checkout Pro builders. That is an escape hatch, not a filter: its
 * own failure message even advertised it — "give it a second parameter so
 * this guard stops treating it as a candidate" — and HOS-937 is about to add
 * new preapproval `back_url` builders in exactly this file. A new arity-2
 * (or arity-3, ...) `back_url` builder with a stray query param would have
 * sailed through unseen.
 *
 * This version probes **every** function export, regardless of arity, with a
 * plausible argument list (mirroring how `checkout-return-urls.test.ts`
 * itself calls the add-on builders — `(locale, addonSlug)`). Two things are
 * anchored on VALUES rather than names or shapes, so neither a rename nor an
 * extra parameter can dodge them:
 *
 * - Which URLs are allowed to carry a query string: `QUERY_PARAM_ALLOWED_PATHS`
 *   lists the produced **paths** (origin and query stripped) that are
 *   legitimate — today only the add-on redirect page. A function's arity or
 *   name is irrelevant; what matters is the path it actually emits.
 * - Which exports are not URL builders at all (`resolveReturnUrlLocale`,
 *   which needs a Hono `Context`, not a locale): `NON_URL_BUILDER_EXPORTS`.
 *   This one genuinely has to be name-anchored — by definition it never
 *   produces a value to anchor to — but it is verified fresh below so a
 *   stale entry (an export that started returning a URL) is caught rather
 *   than silently trusted forever.
 *
 * Nothing is silently skipped: an export this guard cannot resolve to either
 * a URL or a documented non-URL export FAILS the run loudly, demanding it be
 * added to one of the two lists above with a reason — never that a caller
 * quietly reshapes it to fall outside the scan.
 *
 * @module test/routes/billing/back-url-no-query-params.guard
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/env.js', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://site.test',
        HOSPEDA_API_URL: 'https://api.test'
    }
}));

import * as returnUrlsModule from '../../../src/routes/billing/checkout-return-urls.js';

/** The marker unique to the webhook `notification_url` — the exemption anchor (a VALUE, not a name). */
const NOTIFICATION_MARKER = 'source_news=webhooks';

/**
 * Probe arguments tried against every exported function, in arity order —
 * mirrors the real call sites (`checkout-return-urls.test.ts`): a locale,
 * then an add-on slug. A function whose arity exceeds this pool's length
 * cannot be probed and is reported as unaccounted rather than skipped.
 */
const PROBE_ARGS_POOL: readonly unknown[] = ['es', 'probe-addon-slug'];

/**
 * Real, documented function exports that are NOT URL builders at all, so
 * they can never be expected to resolve to an absolute URL under the
 * standard probes. Anchored on the export NAME because — unlike
 * {@link QUERY_PARAM_ALLOWED_PATHS} — there is no *produced value* to anchor
 * to here: the defining trait of this bucket is precisely that no URL is
 * ever produced. Verified fresh in a dedicated test below, so an entry that
 * quietly starts returning a URL does not stay silently exempted forever.
 */
const NON_URL_BUILDER_EXPORTS: ReadonlySet<string> = new Set([
    // Resolves a locale STRING from a Hono Context; it takes a Context
    // object, not a locale, so a locale-string probe throws (`c.get` is not
    // a function on a string) rather than returning anything.
    'resolveReturnUrlLocale'
]);

/**
 * URL PATHS (origin and query string stripped) that are legitimately allowed
 * to carry a query string of our own. Anchored on the produced PATH, not on
 * a function name or its arity — a rename of the builder, or giving it an
 * extra harmless-looking parameter, does not change the path it emits, so
 * neither can be used to dodge this allowlist.
 *
 * The one entry today is the Checkout Pro add-on redirect page (HOS-224),
 * which reads `?status=` / `?addon=` to render its purchase-result banner.
 * It is a DIFFERENT MercadoPago flow from the recurring-preapproval
 * `back_url` this guard protects: MercadoPago's preapproval redirect
 * concatenates its own param with a bare `?` (the R-1 defect), but Checkout
 * Pro's `back_urls` do not have that failure mode. See
 * `checkout-return-urls.test.ts` for the add-on builders' own regression
 * coverage — this guard only needs to know their produced path is expected.
 */
const QUERY_PARAM_ALLOWED_PATHS: ReadonlySet<string> = new Set(['/es/mi-cuenta/addons/']);

/** One function export, resolved to a URL and its path (query/origin stripped). */
interface UrlBuilderOutcome {
    readonly name: string;
    readonly url: string;
    readonly path: string;
}

/** Result of probing every function export of a return-url module namespace. */
interface ScanResult {
    readonly urlBuilders: readonly UrlBuilderOutcome[];
    readonly nonUrlNames: readonly string[];
    readonly unaccountedNames: readonly string[];
}

/**
 * Probes every function export of `moduleNamespace` and classifies it into
 * one of three buckets — never a fourth, silent one:
 *
 * 1. `urlBuilders` — resolved to an absolute `http(s)` URL under the standard
 *    probe args.
 * 2. `nonUrlNames` — threw or returned a non-URL value, AND is explicitly
 *    listed in `nonUrlAllowlist`.
 * 3. `unaccountedNames` — everything else: an arity this scan cannot probe,
 *    or a value that neither resolved to a URL nor is explicitly documented
 *    as a non-URL export. Callers MUST fail loudly on a non-empty
 *    `unaccountedNames` — that is the whole point of this function existing
 *    instead of a `try { … } catch { continue }` loop that quietly drops
 *    whatever it cannot handle.
 *
 * @param moduleNamespace - The imported module namespace to scan.
 * @param nonUrlAllowlist - Names allowed to land in bucket 2. Defaults to
 *   {@link NON_URL_BUILDER_EXPORTS}; callers may pass a different set for
 *   self-tests of this very function.
 */
function scanReturnUrlModule(
    moduleNamespace: Record<string, unknown>,
    nonUrlAllowlist: ReadonlySet<string> = NON_URL_BUILDER_EXPORTS
): ScanResult {
    const urlBuilders: UrlBuilderOutcome[] = [];
    const nonUrlNames: string[] = [];
    const unaccountedNames: string[] = [];

    for (const [name, value] of Object.entries(moduleNamespace)) {
        if (typeof value !== 'function') {
            continue; // Constants (locale arrays, defaults) — nothing to probe.
        }

        if (value.length > PROBE_ARGS_POOL.length) {
            unaccountedNames.push(name);
            continue;
        }

        const args = PROBE_ARGS_POOL.slice(0, value.length);
        let result: unknown;
        try {
            result = value.apply(undefined, args);
        } catch {
            if (nonUrlAllowlist.has(name)) {
                nonUrlNames.push(name);
            } else {
                unaccountedNames.push(name);
            }
            continue;
        }

        if (typeof result === 'string' && /^https?:\/\//.test(result)) {
            urlBuilders.push({ name, url: result, path: new URL(result).pathname });
        } else if (nonUrlAllowlist.has(name)) {
            nonUrlNames.push(name);
        } else {
            unaccountedNames.push(name);
        }
    }

    return { urlBuilders, nonUrlNames, unaccountedNames };
}

/**
 * Builders (from a scan) whose URL carries a query string on a path that is
 * NOT in `allowedPaths`. The `notification_url` builder is exempt by its
 * marker VALUE, never by name.
 *
 * @param urlBuilders - The `urlBuilders` bucket of a {@link scanReturnUrlModule} result.
 * @param allowedPaths - Paths allowed to carry a query string. Defaults to
 *   {@link QUERY_PARAM_ALLOWED_PATHS}; callers may pass a different set for
 *   self-tests of this very function.
 */
function findQueryParamOffenders(
    urlBuilders: readonly UrlBuilderOutcome[],
    allowedPaths: ReadonlySet<string> = QUERY_PARAM_ALLOWED_PATHS
): readonly UrlBuilderOutcome[] {
    return urlBuilders
        .filter((builder) => !builder.url.includes(NOTIFICATION_MARKER))
        .filter((builder) => builder.url.includes('?'))
        .filter((builder) => !allowedPaths.has(builder.path));
}

const realModuleScan = scanReturnUrlModule(returnUrlsModule as unknown as Record<string, unknown>);

describe('HOS-937 R-1 guard — back_url builders carry no query params of our own', () => {
    it('discovers a non-empty set of URL builders and accounts for every function export (anti-vacuity)', () => {
        // Without this, a refactor that changes every builder's signature
        // (e.g. all take a full options object) could leave this guard
        // resolving ZERO URLs and reporting green on nothing.
        expect(realModuleScan.urlBuilders.length).toBeGreaterThanOrEqual(5);

        expect(
            realModuleScan.unaccountedNames,
            `These exports could not be resolved to a URL with the standard probes and are not ` +
                `listed in NON_URL_BUILDER_EXPORTS: ${realModuleScan.unaccountedNames.join(', ')}. ` +
                "Either extend PROBE_ARGS_POOL / scanReturnUrlModule to cover this export's real " +
                'shape (if it IS a return-url builder), or add it to NON_URL_BUILDER_EXPORTS with a ' +
                'reason (if it genuinely is not one). This guard refuses to silently skip an export ' +
                'it cannot classify.'
        ).toEqual([]);
    });

    it('every NON_URL_BUILDER_EXPORTS entry is still accurate (no stale exemptions)', () => {
        const stale = [...NON_URL_BUILDER_EXPORTS].filter(
            (name) => !realModuleScan.nonUrlNames.includes(name)
        );

        expect(
            stale,
            `These NON_URL_BUILDER_EXPORTS entries no longer match a non-URL export: ` +
                `${stale.join(', ')}. Either the export was removed/renamed (delete the entry) or it ` +
                'now resolves to a URL (remove the entry so this guard starts protecting it too).'
        ).toEqual([]);
    });

    it('every back_url builder returns a URL with no query string outside QUERY_PARAM_ALLOWED_PATHS', () => {
        const offenders = findQueryParamOffenders(realModuleScan.urlBuilders);

        expect(
            offenders.map((o) => `${o.name} -> ${o.url}`),
            'These builders return a URL carrying a `?` of our own on a path that is not in ' +
                'QUERY_PARAM_ALLOWED_PATHS. MercadoPago concatenates its own `preapproval_id` onto ' +
                'the configured preapproval back_url with a bare `?`, not `&`, so any query string we ' +
                'add here stops the returning redirect from parsing (HOS-937 R-1). If this is a real, ' +
                'deliberate exception — e.g. a new Checkout Pro redirect target rather than a ' +
                'preapproval back_url — justify it by adding its produced PATH to ' +
                'QUERY_PARAM_ALLOWED_PATHS with a reason. There is no way to opt an export out of this ' +
                'scan by its arity or its name.'
        ).toEqual([]);
    });

    it('QUERY_PARAM_ALLOWED_PATHS has no stale entries', () => {
        const producedQueryPaths = new Set(
            realModuleScan.urlBuilders.filter((b) => b.url.includes('?')).map((b) => b.path)
        );
        const stale = [...QUERY_PARAM_ALLOWED_PATHS].filter(
            (path) => !producedQueryPaths.has(path)
        );

        expect(
            stale,
            `These QUERY_PARAM_ALLOWED_PATHS entries are no longer produced by any builder with a ` +
                `query string: ${stale.join(', ')}. Remove them so the allowlist cannot rot into ` +
                'covering a path nothing emits anymore.'
        ).toEqual([]);
    });

    it('the notification builder still carries its required marker (exemption sanity check)', () => {
        // Guards the exemption itself: if buildNotificationUrl ever lost the
        // marker, it would silently fall into the "no query params allowed"
        // bucket above and fail for the wrong reason instead of surfacing the
        // webhook-router regression it actually is.
        const notificationOutcome = realModuleScan.urlBuilders.find(
            (b) => b.name === 'buildNotificationUrl'
        );
        expect(notificationOutcome?.url).toContain(NOTIFICATION_MARKER);
    });
});

describe('HOS-937 R-1 guard self-test — proves the detector actually catches each defect class', () => {
    /*
     * A guard nobody has ever seen fail proves nothing (the mutation-testing
     * convention this repo applies to every *.guard.test.ts). These three
     * tests feed the SAME scanReturnUrlModule / findQueryParamOffenders
     * functions used against the real module a synthetic fixture carrying
     * one specific defect each, and assert detection.
     *
     * Every fixture is built IN-MEMORY as a shallow copy of the real module
     * namespace (`{ ...returnUrlsModule, overriddenExport: … }`) — this never
     * writes to checkout-return-urls.ts on disk, so these defect classes stay
     * verifiably caught without ever risking a diff in a file another agent
     * is concurrently editing in this worktree.
     */

    it('(a) a query param added to an existing arity-1 back_url builder is caught', () => {
        const mutatedModule = {
            ...returnUrlsModule,
            buildPaymentMethodReturnUrl: (locale: string) =>
                `${returnUrlsModule.buildPaymentMethodReturnUrl(locale as 'es' | 'en' | 'pt')}?x=1`
        };

        const scan = scanReturnUrlModule(mutatedModule as unknown as Record<string, unknown>);
        const offenders = findQueryParamOffenders(scan.urlBuilders);

        expect(offenders.map((o) => o.name)).toContain('buildPaymentMethodReturnUrl');
    });

    it('(b) a NEW arity-2 builder returning a subscription-path back_url with a query param is caught (the escape hatch this fix closes)', () => {
        // Before this fix, EVERY export with arity > 1 was excluded outright,
        // so this exact shape — a two-argument back_url builder smuggling a
        // query param through — would have produced zero offenders. That was
        // the bug this correction exists to close.
        const mutatedModule = {
            ...returnUrlsModule,
            buildForgedSubscriptionReturnUrl: (locale: string, extra: string) =>
                `${returnUrlsModule.buildPaymentMethodReturnUrl(locale as 'es' | 'en' | 'pt')}?extra=${extra}`
        };

        const scan = scanReturnUrlModule(mutatedModule as unknown as Record<string, unknown>);
        const offenders = findQueryParamOffenders(scan.urlBuilders);

        expect(offenders.map((o) => o.name)).toContain('buildForgedSubscriptionReturnUrl');
    });

    it('(c) removing a still-used allowlisted path is caught', () => {
        const shrunkAllowlist = new Set(
            [...QUERY_PARAM_ALLOWED_PATHS].filter((path) => path !== '/es/mi-cuenta/addons/')
        );

        const offenders = findQueryParamOffenders(realModuleScan.urlBuilders, shrunkAllowlist);

        expect(offenders.map((o) => o.name)).toEqual(
            expect.arrayContaining(['buildAddonSuccessUrl', 'buildAddonCancelUrl'])
        );
    });
});
