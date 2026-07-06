/**
 * `hops env-check-rules [--target=prod|staging] [--app=<api|web|admin>]` —
 * evaluate every cross-app env-var consistency rule
 * (`packages/config/src/env-cross-checks.ts`, read via the committed JSON
 * bridge) whose `appliesTo` includes `'coolify'`, against LIVE Coolify env
 * var values for the resolved target (HOS-79 T-016).
 *
 * Mirrors the THREE-STATE semantics of the local `pnpm env:check:rules`
 * check (`scripts/check-env-rules.ts` / `evaluateCrossCheckRule`) —
 * `'pass' | 'fail' | 'partial'` — plus a FOURTH state unique to this
 * Coolify-backed variant: `'skipped'`.
 *
 * `'skipped'` (AC-5): a rule is skipped, never crashes the run, when ANY app
 * it references could not be reached — either because its Coolify container
 * lookup / API call failed for this invocation, or because the app has no
 * Coolify container at all (`mobile` / `docker` / `seed` — pseudo-apps `hops`
 * has no concept of deploying). One broken/unreachable app must never blank
 * the report for every OTHER rule: each app's env vars are fetched ONCE per
 * run (memoized in {@link envCheckRules}) and wrapped in its own try/catch,
 * so a single Coolify outage on `admin` still lets every rule that only
 * touches `api`/`web` evaluate normally.
 *
 * No positional argument — a single rule can span two apps (e.g. api+web),
 * so there is no one "the app" this command runs against. `--app` narrows
 * the report to rules that reference a specific app, it does not scope the
 * whole command to it.
 *
 * Exit codes: non-zero only when at least one rule resolves to `'fail'`.
 * `'partial'` and `'skipped'` are both non-failing — see the module docs on
 * `env-cross-checks.ts` for why `'partial'` must never be a hard failure.
 */

import { findContainer, getActiveTarget, getApplicationUuid } from '../lib/container-lookup.ts';
import { CoolifyApiError, createCoolifyClient } from '../lib/coolify.ts';
import { die, log } from '../lib/log.ts';
import {
    loadRegistryJson,
    type RegistryAppId,
    type RegistryCrossCheckRule
} from '../lib/repo-root.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

const HELP = `
hops env-check-rules [--target=prod|staging] [--app=<api|web|admin>]

Evaluate every cross-app env-var consistency rule whose appliesTo includes
'coolify' against LIVE Coolify values for the resolved target. Reports a
per-rule 'pass' | 'fail' | 'partial' | 'skipped' outcome — never a bare
boolean.

  pass     all referenced (app, key) values are present and equal.
  fail     all present, but NOT all equal.
  partial  at least one value is unset on Coolify (non-failing).
  skipped  at least one referenced app's Coolify container/API was
           unreachable for this run, OR is not a Coolify-deployed app at
           all (mobile / docker / seed) — non-failing. Other rules still
           evaluate normally (a broken app never blanks the whole report).

Flags:
  --app=<api|web|admin>   Only report rules that reference this app (a rule
                          can span two apps; this filters by "touches",
                          not "only about").
  --help, -h              Show this help.

Examples:
  hops --target=staging env-check-rules
  hops --target=prod env-check-rules --app=api

Notes:
  Read-only — safe with HOPS_DEFAULT_TARGET (targetPolicy: default-ok).
  For the local .env.local equivalent, see \`pnpm env:check:rules\`.
`.trim();

function isApp(value: string): value is App {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

/** Three-state-plus-skipped outcome of evaluating one Coolify cross-check rule. */
export type CoolifyRuleStatus = 'pass' | 'fail' | 'partial' | 'skipped';

/** Result of evaluating one {@link RegistryCrossCheckRule} against Coolify values. */
export interface CoolifyRuleEvaluationResult {
    /** The evaluated rule's {@link RegistryCrossCheckRule.id}. */
    readonly ruleId: string;
    /** Four-state outcome — see {@link CoolifyRuleStatus}. */
    readonly status: CoolifyRuleStatus;
    /** Human-readable explanation of the outcome. */
    readonly detail: string;
}

/**
 * Filter the full cross-check rule set down to the ones this command
 * evaluates: `appliesTo` includes `'coolify'`, and (when `appFilter` is
 * given) at least one `compare` side references that app.
 *
 * Exported separately from {@link evaluateCoolifyCrossCheckRule} because the
 * command wrapper needs the filtered rule list BEFORE fetching any Coolify
 * data — it determines which apps are even worth fetching.
 */
export function selectCoolifyRules(input: {
    readonly rules: readonly RegistryCrossCheckRule[];
    readonly appFilter?: RegistryAppId;
}): readonly RegistryCrossCheckRule[] {
    const { rules, appFilter } = input;
    return rules
        .filter((rule) => rule.appliesTo.includes('coolify'))
        .filter((rule) => !appFilter || rule.compare.some((side) => side.app === appFilter));
}

/**
 * Evaluate a single cross-check rule using a `(app, key) -> value` lookup,
 * treating any side whose app is in `unreachableApps` as `'skipped'` rather
 * than attempting the comparison (AC-5).
 *
 * The pass/fail/partial branch below intentionally mirrors
 * `evaluateCrossCheckRule` in `scripts/check-env-rules.ts` byte-for-byte in
 * semantics — same three-state contract, just sourced from live Coolify
 * values instead of local `.env.local` files.
 */
export function evaluateCoolifyCrossCheckRule(input: {
    readonly rule: RegistryCrossCheckRule;
    readonly getValue: (app: RegistryAppId, key: string) => string | undefined;
    readonly unreachableApps: ReadonlySet<RegistryAppId>;
}): CoolifyRuleEvaluationResult {
    const { rule, getValue, unreachableApps } = input;

    const unreachableSides = rule.compare.filter((side) => unreachableApps.has(side.app));
    if (unreachableSides.length > 0) {
        const apps = [...new Set(unreachableSides.map((s) => s.app))].sort().join(', ');
        return {
            ruleId: rule.id,
            status: 'skipped',
            detail: `skipped: container unreachable (or not Coolify-deployed) for ${apps} — comparison not attempted this run.`
        };
    }

    const resolved = rule.compare.map((side) => ({
        app: side.app,
        key: side.key,
        value: getValue(side.app, side.key)
    }));

    const missingSides = resolved.filter((side) => !side.value);
    if (missingSides.length > 0) {
        const missingDesc = missingSides.map((s) => `${s.app}:${s.key}`).join(', ');
        return {
            ruleId: rule.id,
            status: 'partial',
            detail: `partial: unset on ${missingDesc} — skipping comparison (not a failure).`
        };
    }

    const firstValue = resolved[0]?.value;
    const allEqual = resolved.every((side) => side.value === firstValue);
    if (allEqual) {
        return { ruleId: rule.id, status: 'pass', detail: 'pass: all sides match.' };
    }

    const sidesDesc = resolved.map((s) => `${s.app}:${s.key}`).join(', ');
    return {
        ruleId: rule.id,
        status: 'fail',
        detail: `fail: values differ between ${sidesDesc}.`
    };
}

/**
 * Evaluate a pre-filtered list of rules (see {@link selectCoolifyRules})
 * against a `(app, key) -> value` lookup and a set of unreachable apps.
 * Pure — zero I/O — the command wrapper below does all fetching first and
 * passes the results in.
 */
export function evaluateCoolifyCrossCheckRules(input: {
    readonly rules: readonly RegistryCrossCheckRule[];
    readonly getValue: (app: RegistryAppId, key: string) => string | undefined;
    readonly unreachableApps: ReadonlySet<RegistryAppId>;
}): CoolifyRuleEvaluationResult[] {
    const { rules, getValue, unreachableApps } = input;
    return rules.map((rule) => evaluateCoolifyCrossCheckRule({ rule, getValue, unreachableApps }));
}

/**
 * Fetch every referenced app's live (non-preview) Coolify env vars ONCE per
 * run, tolerating per-app failures (AC-5). Apps outside `api`/`web`/`admin`
 * (the only kinds `hops` can resolve a Coolify container for) are recorded
 * as unreachable without even attempting a lookup.
 *
 * @returns A per-app `Map<key, value>` for apps that were reachable, plus
 *   the set of apps that were not (container lookup failed, Coolify API
 *   call failed, or the app has no Coolify container concept at all).
 */
async function fetchCoolifyValues(apps: ReadonlySet<RegistryAppId>): Promise<{
    readonly valuesByApp: ReadonlyMap<RegistryAppId, ReadonlyMap<string, string>>;
    readonly unreachableApps: ReadonlySet<RegistryAppId>;
}> {
    const valuesByApp = new Map<RegistryAppId, ReadonlyMap<string, string>>();
    const unreachableApps = new Set<RegistryAppId>();
    const client = createCoolifyClient();

    for (const app of apps) {
        if (!isApp(app)) {
            log.warn(
                `env-check-rules: '${app}' has no Coolify container — rules touching it are skipped.`
            );
            unreachableApps.add(app);
            continue;
        }

        try {
            const container = await findContainer(app);
            const uuid = await getApplicationUuid(container);
            const vars = await client.listEnvVars(uuid);
            const kv = new Map<string, string>();
            for (const v of vars) {
                if (v.is_preview) continue; // production slot only, mirrors env-reconcile
                if (v.value) kv.set(v.key, v.value);
            }
            valuesByApp.set(app, kv);
        } catch (err) {
            const message =
                err instanceof CoolifyApiError
                    ? `${err.status} ${err.message}`
                    : String(err instanceof Error ? err.message : err);
            log.warn(
                `env-check-rules: could not fetch Coolify env vars for '${app}' (${message}) — rules touching it are skipped, not failed.`
            );
            unreachableApps.add(app);
        }
    }

    return { valuesByApp, unreachableApps };
}

export async function envCheckRules(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const appFlagIndex = args.findIndex((a) => a === '--app' || a.startsWith('--app='));
    let appFilter: App | undefined;
    if (appFlagIndex >= 0) {
        const token = args[appFlagIndex] as string;
        const raw = token.includes('=') ? token.slice('--app='.length) : args[appFlagIndex + 1];
        if (!raw || !isApp(raw)) {
            die(`--app requires one of: ${KINDS.join(', ')}. Got: '${raw ?? ''}'.`);
        }
        appFilter = raw;
    }

    const target = getActiveTarget();

    let registryJson: ReturnType<typeof loadRegistryJson>;
    try {
        registryJson = loadRegistryJson();
    } catch (err) {
        die(err instanceof Error ? err.message : String(err));
    }

    const applicableRules = selectCoolifyRules({ rules: registryJson.crossChecks, appFilter });

    if (applicableRules.length === 0) {
        log.warn(
            appFilter
                ? `No 'coolify'-applicable cross-check rules reference '${appFilter}'.`
                : "No 'coolify'-applicable cross-check rules are registered."
        );
        return;
    }

    const referencedApps = new Set<RegistryAppId>();
    for (const rule of applicableRules) {
        for (const side of rule.compare) {
            referencedApps.add(side.app);
        }
    }

    const { valuesByApp, unreachableApps } = await fetchCoolifyValues(referencedApps);
    const getValue = (app: RegistryAppId, key: string): string | undefined =>
        valuesByApp.get(app)?.get(key);

    const results = evaluateCoolifyCrossCheckRules({
        rules: applicableRules,
        getValue,
        unreachableApps
    });

    log.info(`env-check-rules [${target}]${appFilter ? ` (filtered to ${appFilter})` : ''}:`);
    for (const result of results) {
        const icon =
            result.status === 'pass'
                ? '✓'
                : result.status === 'partial'
                  ? '…'
                  : result.status === 'skipped'
                    ? '○'
                    : '✗';
        process.stdout.write(`${icon} [${result.ruleId}] ${result.detail}\n`);
    }

    const passes = results.filter((r) => r.status === 'pass');
    const partials = results.filter((r) => r.status === 'partial');
    const skipped = results.filter((r) => r.status === 'skipped');
    const failures = results.filter((r) => r.status === 'fail');

    log.info(
        `${passes.length} passed, ${partials.length} partial, ${skipped.length} skipped, ${failures.length} failed.`
    );

    if (failures.length > 0) {
        log.error(
            'Fix: make the failing rule(s) hold the same value across all listed (app, key) sides.'
        );
        process.exitCode = 1;
    }
}
