/**
 * `hops env-reconcile <api|web|admin> [--target=prod|staging]` — diff the
 * committed env-var registry (`packages/config/generated/env-registry.json`)
 * against the LIVE Coolify env vars for a given app, and report every
 * registry-required var that is missing on Coolify (HOS-79 T-015, AC-4).
 *
 * This is presence-only reconciliation — it never reads or compares VALUES,
 * only which keys exist. Value correctness (secrets rotated, URLs pointing
 * at the right host, etc.) is out of scope; `hops env-check-rules` covers
 * cross-app value CONSISTENCY, and neither tool validates a single value in
 * isolation (that would need re-deriving each app's Zod schema, which this
 * bun-standalone package deliberately does not depend on — see
 * `src/lib/repo-root.ts` for why the JSON bridge exists instead).
 *
 * "Required" gating (which registry entries actually get reported as
 * missing) is judged as follows:
 *   - `required: true` (== `requiredScope: 'always'`) — always gated.
 *   - `requiredScope: 'production'` — ALSO gated. Both `prod` and `staging`
 *     hops targets are real deployed Coolify environments running
 *     `NODE_ENV=production` (confirmed in
 *     docs/guides/environment-variables.md's "Environment Differences"
 *     table — staging is NOT a dev-mode environment), so a var required
 *     "only in production" is required on every target this command can
 *     even point at.
 *   - `requiredScope: 'conditional'` — NOT gated (reported as informational
 *     only, never "missing"). Reconcile is a pure presence diff with no
 *     access to runtime values, so it cannot evaluate the condition (e.g.
 *     "required when HOSPEDA_MODERATION_PROVIDER=openai"). Flagging these
 *     as hard failures would produce false positives on every target where
 *     the condition happens not to hold.
 *
 * Extras (present on Coolify, absent from the registry entirely) are
 * reported too, but as informational output — never a failure. A var can
 * legitimately exist on Coolify without a registry entry yet (freshly added
 * by hand, ahead of the registry PR) or after a registry entry is removed
 * but the Coolify value was never cleaned up; neither case is this
 * command's job to fail the run over (that's a manual cleanup decision).
 */

import * as p from '@clack/prompts';
import { findContainer, getActiveTarget, getApplicationUuid } from '../lib/container-lookup.ts';
import { CoolifyApiError, type CoolifyEnvVar, createCoolifyClient } from '../lib/coolify.ts';
import { die, log } from '../lib/log.ts';
import {
    type RegistryAppId,
    type RegistryEnvVarDefinition,
    loadRegistryJson
} from '../lib/repo-root.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

const HELP = `
hops env-reconcile <api|web|admin> [--target=prod|staging]

Diff the committed env-var registry against the LIVE Coolify env vars for
the given app. Reports every registry-required var that is missing on
Coolify (exit 1 if any are missing), plus informational notes for vars
present on Coolify but absent from the registry.

This is a presence-only check — it never compares VALUES. For cross-app
value consistency (e.g. a secret that must match between api and web) use
\`hops env-check-rules\` instead.

Flags:
  --help, -h    Show this help.

Examples:
  hops --target=staging env-reconcile api
  hops --target=prod env-reconcile web

Notes:
  Without <kind>, opens an interactive picker.
  Read-only — safe with HOPS_DEFAULT_TARGET (targetPolicy: default-ok).
`.trim();

function isApp(value: string): value is App {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

/**
 * Whether a registry entry is required for a deployed hops target (`prod`
 * or `staging`). See the module-level JSDoc for the full reasoning — in
 * short, both targets run `NODE_ENV=production`, so `requiredScope:
 * 'production'` is treated the same as `required: true`; `'conditional'`
 * is deliberately excluded (cannot be evaluated from presence alone).
 */
export function isRequiredForDeployedTarget(
    entry: Pick<RegistryEnvVarDefinition, 'required' | 'requiredScope'>
): boolean {
    // 'always' and 'production' are both required on a deployed target (prod
    // and staging both run NODE_ENV=production). 'conditional' cannot be
    // evaluated from presence alone, so it is never treated as required here
    // (it is surfaced separately as conditionalUnset). With no requiredScope,
    // fall back to the plain `required` flag. Mirrors check-env-local's
    // isAlwaysRequired shape so a { requiredScope: 'always', required: false }
    // entry is still caught.
    if (entry.requiredScope === 'always' || entry.requiredScope === 'production') return true;
    if (entry.requiredScope === 'conditional') return false;
    return entry.required === true;
}

/** Input to {@link diffRegistryVsCoolify} — pure, zero I/O. */
export interface DiffRegistryVsCoolifyInput {
    /** The full registry (from the committed JSON's `registry` field). */
    readonly registry: readonly RegistryEnvVarDefinition[];
    /** Which app's registry entries + Coolify keys to compare. */
    readonly app: RegistryAppId;
    /** Env var keys currently present on the app's Coolify application. */
    readonly coolifyKeys: readonly string[];
}

/** Result of {@link diffRegistryVsCoolify}. */
export interface DiffRegistryVsCoolifyResult {
    /**
     * Registry entries scoped to `app` that are required for a deployed
     * target (see {@link isRequiredForDeployedTarget}) but absent from
     * `coolifyKeys`. Non-empty ⇒ the reconcile check FAILS (AC-4).
     */
    readonly missing: readonly string[];
    /**
     * Keys present in `coolifyKeys` that have no registry entry scoped to
     * `app` at all. Informational only — never fails the check.
     */
    readonly unexpected: readonly string[];
    /**
     * Registry entries scoped to `app` with `requiredScope: 'conditional'`
     * that are absent from `coolifyKeys`. Informational only — reconcile
     * cannot evaluate the var's condition from presence alone, so these are
     * surfaced for awareness without being treated as failures.
     */
    readonly conditionalUnset: readonly string[];
}

/**
 * Diff the env-var registry against a live Coolify app's env var keys.
 * Pure — takes plain data in, returns plain data out, no network/filesystem
 * access — so it can be unit-tested with fixtures (HOS-79 T-015).
 */
export function diffRegistryVsCoolify(
    input: DiffRegistryVsCoolifyInput
): DiffRegistryVsCoolifyResult {
    const { registry, app, coolifyKeys } = input;
    const coolifySet = new Set(coolifyKeys);
    const appEntries = registry.filter((entry) => entry.apps.includes(app));

    const missing = appEntries
        .filter((entry) => isRequiredForDeployedTarget(entry) && !coolifySet.has(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

    const conditionalUnset = appEntries
        .filter((entry) => entry.requiredScope === 'conditional' && !coolifySet.has(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

    const registryNames = new Set(appEntries.map((entry) => entry.name));
    const unexpected = [...coolifySet]
        .filter((key) => !registryNames.has(key))
        .sort((a, b) => a.localeCompare(b));

    return { missing, unexpected, conditionalUnset };
}

export async function envReconcile(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const positional = args.filter((a) => !a.startsWith('--'));

    let kindRaw = positional[0];
    if (!kindRaw) {
        const answer = await p.select({
            message: 'Which app?',
            options: KINDS.map((k) => ({ value: k, label: k }))
        });
        if (p.isCancel(answer)) {
            log.warn('Cancelled.');
            return;
        }
        kindRaw = answer;
    }

    if (!isApp(kindRaw)) {
        die(`Unknown app '${kindRaw}'. Known: ${KINDS.join(', ')}.`);
    }

    const target = getActiveTarget();

    let registryJson: ReturnType<typeof loadRegistryJson>;
    try {
        registryJson = loadRegistryJson();
    } catch (err) {
        die(err instanceof Error ? err.message : String(err));
    }

    const container = await findContainer(kindRaw);
    const uuid = await getApplicationUuid(container);
    const client = createCoolifyClient();

    let vars: ReadonlyArray<CoolifyEnvVar>;
    try {
        vars = await client.listEnvVars(uuid);
    } catch (err) {
        if (err instanceof CoolifyApiError) {
            die(`Coolify rejected env list (${err.status}): ${JSON.stringify(err.body)}`);
        }
        throw err;
    }

    // Only the production (non-preview) Coolify slot represents the live
    // running config — mirrors env-list's default scope.
    //
    // Presence-only by design: a required var set to an EMPTY value would
    // ideally be flagged like a missing one, but Coolify returns `value: null`
    // BOTH for an empty field AND when the token lacks `read:sensitive` scope
    // (see coolify.ts). Filtering by empty value would false-positive EVERY
    // var whenever the token is unscoped — worse than the edge it would fix.
    // Key presence is the only signal Coolify reports reliably here.
    const coolifyKeys = vars.filter((v) => !v.is_preview).map((v) => v.key);

    const { missing, unexpected, conditionalUnset } = diffRegistryVsCoolify({
        registry: registryJson.registry,
        app: kindRaw,
        coolifyKeys
    });

    log.info(`env-reconcile ${kindRaw} [${target}]: ${container}`);

    if (missing.length > 0) {
        log.error(`${missing.length} required env var(s) MISSING on Coolify:`);
        for (const name of missing) {
            process.stdout.write(`  ✗ ${name}\n`);
        }
    } else {
        log.ok('No required env vars missing.');
    }

    if (conditionalUnset.length > 0) {
        log.hint(
            `${conditionalUnset.length} conditionally-required var(s) not set (not evaluated — condition unknown, informational only):`
        );
        for (const name of conditionalUnset) {
            process.stdout.write(`  … ${name}\n`);
        }
    }

    if (unexpected.length > 0) {
        log.hint(
            `${unexpected.length} var(s) present on Coolify but absent from the registry (informational only):`
        );
        for (const name of unexpected) {
            process.stdout.write(`  ? ${name}\n`);
        }
    }

    if (missing.length > 0) {
        process.exitCode = 1;
    }
}
