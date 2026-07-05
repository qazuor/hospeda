/**
 * `hops env-set <api|web|admin> <KEY> <VALUE>` — upsert a single Coolify
 * env var. Creates if missing, PATCHes if present.
 *
 * The Coolify env-var change does NOT take effect until the app is
 * redeployed (Coolify queues the new value but keeps the running
 * container's env intact). This command prints a hint to that effect
 * so the operator knows to follow up with `hops redeploy` (or
 * `app-restart` if the app reads env on every request).
 *
 * `--wizard` (HOS-79 T-019) is an ALTERNATE mode that replaces the single
 * `<KEY> <VALUE>` flow with an interactive walk over multiple registry
 * entries for one app:
 *   - DEFAULT (`--wizard` alone): only the registry-required vars missing
 *     from live Coolify for that app (via {@link diffRegistryVsCoolify},
 *     reused as-is from `env-reconcile.ts` — AC-6, never the full registry).
 *   - `--wizard --review-all`: every non-platform-injected registry entry
 *     applicable to the app, with a keep/change choice per entry; secret
 *     current values are shown redacted, never in the clear.
 * The positional `env-set <kind> <KEY> <VALUE>` behavior below is
 * completely unchanged — `--wizard` is checked first and returns early.
 */

import * as p from '@clack/prompts';
import { findContainer, getActiveTarget, getApplicationUuid } from '../lib/container-lookup.ts';
import { CoolifyApiError, type CoolifyEnvVar, createCoolifyClient } from '../lib/coolify.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';
import {
    loadRegistryJson,
    type RegistryAppId,
    type RegistryEnvVarConstraint,
    type RegistryEnvVarDefinition
} from '../lib/repo-root.ts';
import { diffRegistryVsCoolify } from './env-reconcile.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

/**
 * Thrown when the operator cancels (Ctrl+C) any wizard prompt. Caught by
 * {@link runEnvSetWizard} to abort the ENTIRE run with zero writes — a
 * cancel must never be confused with a per-entry "keep / skip" (which
 * returns `undefined` normally). Mirrors the LOCAL wizard's
 * `WizardCancelledError` contract.
 */
class WizardCancelledError extends Error {
    constructor() {
        super('Wizard cancelled by operator.');
        this.name = 'WizardCancelledError';
    }
}

/**
 * Framework/platform-level keys that must NEVER be hand-set into Coolify via
 * this VPS wizard: the runtime/deploy platform owns them (see CLAUDE.md env
 * policy — `NODE_ENV`, `API_PORT`, `API_HOST` are read as-is). The registry
 * does NOT flag them `platformInjected` on purpose, because they ARE
 * dev-settable locally — so the LOCAL wizard (`pnpm env:set`) still offers
 * them; only this Coolify-writing wizard excludes them. (Truly platform-only
 * vars like `CI`/`SOURCE_COMMIT` already carry `platformInjected` and are
 * excluded by that flag everywhere.)
 */
const VPS_WIZARD_EXCLUDED_KEYS: ReadonlySet<string> = new Set(['NODE_ENV', 'API_PORT', 'API_HOST']);

/**
 * Whether an entry may be prompted for by the VPS wizard: applicable to the
 * app, not platform-injected, and not a framework-level key we refuse to
 * hand-write into Coolify ({@link VPS_WIZARD_EXCLUDED_KEYS}).
 */
function isVpsWizardEligible(entry: RegistryEnvVarDefinition, app: RegistryAppId): boolean {
    return (
        entry.apps.includes(app) &&
        !entry.platformInjected &&
        !VPS_WIZARD_EXCLUDED_KEYS.has(entry.name)
    );
}

const HELP = `
hops env-set <api|web|admin> <KEY> <VALUE>
hops env-set <api|web|admin> <KEY> --secret
hops env-set <api|web|admin> --wizard [--review-all]

Set or update a single Coolify env var. Requires --target= (this command
writes data; HOPS_DEFAULT_TARGET is not honoured).

  CREATE: Coolify v4 mirrors a new env var into BOTH the production
          and preview environments regardless of is_preview in the
          POST body. After the create, run \`hops env-delete <kind>
          <KEY> --preview\` if you want the preview copy gone.

  UPDATE: scoped to whichever environment matches. Pass --preview to
          target the preview entry instead of the production one.

  WIZARD: walks multiple registry entries interactively instead of one
          <KEY> <VALUE> pair. Default: only registry-required vars
          missing from live Coolify for <kind> (same gaps
          \`hops env-reconcile\` reports). --review-all walks every
          applicable entry with a keep/change choice per entry.

Flags:
  --preview     Target the preview environment instead of production
                (UPDATE only — see CREATE caveat above).
  --secret      Prompt for the value with masked input instead of
                taking it on the command line (avoids logging the
                value to your shell history).
  --wizard      Interactive multi-entry mode — see WIZARD above.
  --review-all  With --wizard: review every applicable entry instead
                of only the missing-required gaps.
  --yes         Skip the confirmation prompt (for automation).
  --help, -h    Show this help.

Examples:
  hops --target=prod env-set api FOO bar
  hops --target=prod env-set api MERCADO_PAGO_TOKEN --secret
  hops --target=staging env-set api LOG_LEVEL info --yes
  hops --target=prod env-set api EXPERIMENTAL_FLAG true --preview
  hops --target=staging env-set api --wizard
  hops --target=staging env-set api --wizard --review-all

Notes:
  Coolify does NOT auto-restart the running container after a single
  env-var change. Follow up with \`hops redeploy <kind>\` (full
  rebuild) or \`hops app-restart <kind>\` (in-place restart).
`.trim();

function isApp(value: string): value is App {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

// ---------------------------------------------------------------------------
// Wizard mode — pure helpers (exported for unit testing, zero I/O)
// ---------------------------------------------------------------------------

/**
 * Computes the DEFAULT wizard prompt set for one app: every registry entry
 * required for a deployed target but missing on live Coolify, reusing
 * {@link diffRegistryVsCoolify}'s `missing` list (HOS-79 T-015) rather than
 * re-deriving the gating rules. Never returns more than that gap set — the
 * AC-6 guarantee that `env-set --wizard` (no `--review-all`) never walks the
 * full registry.
 *
 * @param input - The full registry, which app to scope to, and the app's
 *   current live Coolify keys (production/non-preview slot).
 * @returns The registry entries that are missing on Coolify, in registry order.
 */
export function selectWizardGaps(input: {
    registry: readonly RegistryEnvVarDefinition[];
    app: RegistryAppId;
    coolifyKeys: readonly string[];
}): RegistryEnvVarDefinition[] {
    const { registry, app, coolifyKeys } = input;
    const { missing } = diffRegistryVsCoolify({ registry, app, coolifyKeys });
    const missingSet = new Set(missing);
    return registry.filter(
        (entry) => isVpsWizardEligible(entry, app) && missingSet.has(entry.name)
    );
}

/**
 * Computes the `--review-all` wizard prompt set for one app: every registry
 * entry applicable to the app, EXCLUDING `platformInjected` vars and the
 * framework-level keys this VPS wizard refuses to hand-write into Coolify
 * ({@link VPS_WIZARD_EXCLUDED_KEYS}). Sorted by category then name for a
 * deterministic, scannable walk order.
 *
 * @param input - The full registry and which app to scope to.
 * @returns Every VPS-wizard-eligible entry for `app`.
 */
export function selectWizardReviewAllEntries(input: {
    registry: readonly RegistryEnvVarDefinition[];
    app: RegistryAppId;
}): RegistryEnvVarDefinition[] {
    const { registry, app } = input;
    return registry
        .filter((entry) => isVpsWizardEligible(entry, app))
        .sort((a, b) => {
            const catCmp = a.category.localeCompare(b.category);
            return catCmp === 0 ? a.name.localeCompare(b.name) : catCmp;
        });
}

/**
 * Builds the redacted display label shown in the `--review-all` "keep
 * current value?" prompt. A secret entry with a set value is ALWAYS shown as
 * `***REDACTED***` — its real value is never echoed to the terminal, even
 * when the operator is only being asked whether to keep it.
 *
 * @param input - The registry entry and its current Coolify value (`undefined`
 *   when unset).
 * @returns The label to display: the real value for a non-secret, a redaction
 *   marker for a set secret, or `<unset>` when there is no current value.
 */
export function formatCurrentValueLabel(input: {
    entry: Pick<RegistryEnvVarDefinition, 'secret'>;
    currentValue: string | undefined;
}): string {
    const { entry, currentValue } = input;
    if (currentValue === undefined || currentValue === '') return '<unset>';
    return entry.secret ? '***REDACTED***' : currentValue;
}

/**
 * Decides whether a wizard-collected value should CREATE a new Coolify env
 * var or UPDATE an existing one, given the app's current live keys (the same
 * decision `envSet`'s non-wizard flow makes via `existing.find(...)`, kept
 * as a pure, independently testable function here).
 *
 * @param input - The key being written and the app's current Coolify keys
 *   (production/non-preview slot).
 * @returns `'update'` when the key already exists on Coolify, else `'create'`.
 */
export function planWizardWriteAction(input: {
    key: string;
    existingKeys: readonly string[];
}): 'create' | 'update' {
    return input.existingKeys.includes(input.key) ? 'update' : 'create';
}

/** One resolved answer from the wizard's prompting loop, ready to write. */
export interface WizardAnswer {
    readonly key: string;
    readonly value: string;
}

export async function envSet(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const skipConfirm = args.includes('--yes');
    const useSecretPrompt = args.includes('--secret');
    const targetIsPreview = args.includes('--preview');
    const wizard = args.includes('--wizard');
    const positional = args.filter((a) => !a.startsWith('--'));

    if (wizard) {
        await runEnvSetWizard({
            positional,
            reviewAll: args.includes('--review-all'),
            skipConfirm
        });
        return;
    }

    const [kindRaw, key, valueArg] = positional;
    if (!kindRaw) die('Missing <kind>. Run with --help for usage.');
    if (!isApp(kindRaw)) {
        die(`Unknown app '${kindRaw}'. Known: ${KINDS.join(', ')}.`);
    }
    if (!key) die('Missing <KEY>. Run with --help for usage.');

    let value: string;
    if (useSecretPrompt) {
        if (valueArg !== undefined) {
            die('--secret is mutually exclusive with passing a value on the command line.');
        }
        const answer = await p.password({
            message: `Value for ${key}`,
            validate(v) {
                if (!v) return 'Value cannot be empty.';
                return undefined;
            }
        });
        if (p.isCancel(answer)) {
            log.warn('Cancelled.');
            return;
        }
        value = answer;
    } else {
        if (valueArg === undefined) {
            die('Missing <VALUE>. Pass a value or use --secret to prompt for one.');
        }
        value = valueArg;
    }

    const target = getActiveTarget();
    const container = await findContainer(kindRaw);
    const uuid = await getApplicationUuid(container);
    log.info(`Target  : ${target} (${kindRaw} → container ${container})`);
    const client = createCoolifyClient();

    let existing: ReadonlyArray<CoolifyEnvVar>;
    try {
        existing = await client.listEnvVars(uuid);
    } catch (err) {
        if (err instanceof CoolifyApiError) {
            die(`Coolify rejected env list (${err.status}): ${JSON.stringify(err.body)}`);
        }
        throw err;
    }

    // Match against the requested Coolify environment slot (production by
    // default, preview when --preview was passed). Coolify keeps separate
    // entries per (key, is_preview) tuple so we have to filter by both.
    // This is unrelated to our own prod/staging target — see `envLabel`.
    const match = existing.find((v) => v.key === key && Boolean(v.is_preview) === targetIsPreview);
    const action = match ? 'UPDATE' : 'CREATE';
    const valuePreview = useSecretPrompt
        ? '***SECRET***'
        : value.length > 60
          ? `${value.slice(0, 57)}...`
          : value;
    // Displayed label reflects our prod/staging target, NOT Coolify's
    // is_preview flag — the toolkit does not use Coolify preview releases,
    // so surfacing that flag here only invited confusion with the target.
    const envLabel = target === 'prod' ? 'production' : 'staging';
    const previewNote = targetIsPreview ? ' (preview row)' : '';

    log.info(`${action} on ${kindRaw} [${envLabel}]${previewNote}: ${key} = ${valuePreview}`);

    if (!skipConfirm) {
        const ok = await confirm(
            `${action} env var '${key}' on ${kindRaw} [${envLabel}]${previewNote}?`
        );
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    try {
        if (match) {
            await client.updateEnvVar(uuid, key, { value, is_preview: targetIsPreview });
        } else {
            await client.createEnvVar(uuid, { key, value, is_preview: targetIsPreview });
        }
    } catch (err) {
        if (err instanceof CoolifyApiError) {
            die(`Coolify rejected the change (${err.status}): ${JSON.stringify(err.body)}`);
        }
        throw err;
    }

    log.ok(`${key} ${match ? 'updated' : 'created'} on ${kindRaw} [${envLabel}]${previewNote}.`);
    if (!match) {
        log.hint(
            `Coolify mirrors new env vars into BOTH production and preview environments. Use \`hops env-delete ${kindRaw} ${key} --preview\` to drop the preview copy.`
        );
    }
    log.hint(
        'Run `hops redeploy <kind>` or `hops app-restart <kind>` for the change to take effect.'
    );
}

// ---------------------------------------------------------------------------
// Wizard mode — interactive orchestration (I/O; not unit-tested directly —
// only the pure helpers above and the prompt-shaping below are exercised by
// tests, always against a mocked Coolify client, never a real network call)
// ---------------------------------------------------------------------------

/**
 * Prompts for one registry entry's value, shaped by its `type` and the
 * introspected `constraints` entry (mirrors the LOCAL wizard's
 * `scripts/env-set-wizard.ts` UX, reading the JSON registry instead of the
 * live TS one — the two are deliberately separate implementations, see that
 * file's module doc for why). In review mode, first asks whether to keep the
 * current value (redacted for secrets via {@link formatCurrentValueLabel});
 * answering "keep" (`p.isCancel` aside) skips the type-specific prompt.
 *
 * @returns The new value, or `undefined` when the operator kept the current
 *   value (review mode only). Throws {@link WizardCancelledError} on a
 *   Ctrl+C cancel — the caller aborts the whole run with zero writes.
 */
async function promptWizardEntry(input: {
    entry: RegistryEnvVarDefinition;
    constraint: RegistryEnvVarConstraint | undefined;
    currentValue: string | undefined;
    mode: 'gap' | 'review';
}): Promise<string | undefined> {
    const { entry, constraint, currentValue, mode } = input;

    if (mode === 'review') {
        const label = formatCurrentValueLabel({ entry, currentValue });
        const keep = await p.confirm({ message: `${entry.name} — keep current value (${label})?` });
        if (p.isCancel(keep)) throw new WizardCancelledError();
        if (keep) return undefined;
    }

    if (entry.secret) {
        if (entry.howToObtain) log.hint(entry.howToObtain);
        if (entry.helpUrl) log.hint(`More info: ${entry.helpUrl}`);
    }

    if (entry.type === 'enum') {
        const enumValues = constraint?.enumValues;
        if (enumValues && enumValues.length > 0) {
            const answer = await p.select({
                message: `${entry.name} — ${entry.description}`,
                options: enumValues.map((value) => ({ value, label: value }))
            });
            if (p.isCancel(answer)) throw new WizardCancelledError();
            return answer;
        }
    }

    if (entry.type === 'boolean') {
        const answer = await p.confirm({
            message: `${entry.name} — ${entry.description}`,
            initialValue: currentValue === 'true'
        });
        if (p.isCancel(answer)) throw new WizardCancelledError();
        return String(answer);
    }

    if (entry.secret) {
        const answer = await p.password({
            message: `${entry.name} — ${entry.description}`,
            validate(v) {
                if (!v) return 'Value cannot be empty.';
                return undefined;
            }
        });
        if (p.isCancel(answer)) throw new WizardCancelledError();
        return answer;
    }

    if (entry.type === 'number') {
        const min = constraint?.numeric?.min;
        const max = constraint?.numeric?.max;
        const boundsHint =
            min !== undefined || max !== undefined ? ` (${min ?? '-inf'}..${max ?? '+inf'})` : '';
        const answer = await p.text({
            message: `${entry.name} — ${entry.description}${boundsHint}`,
            validate(v) {
                if (!v) return 'Value cannot be empty.';
                const num = Number(v);
                if (Number.isNaN(num)) return 'Must be a number.';
                if (min !== undefined && num < min) return `Must be >= ${min}.`;
                if (max !== undefined && num > max) return `Must be <= ${max}.`;
                return undefined;
            }
        });
        if (p.isCancel(answer)) throw new WizardCancelledError();
        return answer;
    }

    const answer = await p.text({
        message: `${entry.name} — ${entry.description}`,
        validate(v) {
            if (!v) return 'Value cannot be empty.';
            return undefined;
        }
    });
    if (p.isCancel(answer)) return undefined;
    return answer;
}

/**
 * Runs `env-set --wizard`: resolves the target app, computes the prompt set
 * (gaps-only by default, every applicable entry with `--review-all`),
 * prompts for each entry, then writes every collected answer to Coolify —
 * but only after ALL prompting has completed, so a cancelled prompt aborts
 * the whole run with zero writes (mirrors the LOCAL wizard's contract).
 */
async function runEnvSetWizard(input: {
    positional: ReadonlyArray<string>;
    reviewAll: boolean;
    skipConfirm: boolean;
}): Promise<void> {
    const { positional, reviewAll, skipConfirm } = input;

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
    log.info(`Target  : ${target} (${kindRaw} → container ${container})`);
    const client = createCoolifyClient();

    let existing: ReadonlyArray<CoolifyEnvVar>;
    try {
        existing = await client.listEnvVars(uuid);
    } catch (err) {
        if (err instanceof CoolifyApiError) {
            die(`Coolify rejected env list (${err.status}): ${JSON.stringify(err.body)}`);
        }
        throw err;
    }

    // Only the production (non-preview) slot represents live config —
    // mirrors env-reconcile's / env-list's default scoping.
    const liveVars = existing.filter((v) => !v.is_preview);
    const coolifyKeys = liveVars.map((v) => v.key);

    const entries = reviewAll
        ? selectWizardReviewAllEntries({ registry: registryJson.registry, app: kindRaw })
        : selectWizardGaps({ registry: registryJson.registry, app: kindRaw, coolifyKeys });

    if (entries.length === 0) {
        log.ok(
            reviewAll
                ? 'No applicable registry entries for this app.'
                : 'No required env vars missing — nothing to prompt for.'
        );
        return;
    }

    log.info(`${entries.length} var(s) to ${reviewAll ? 'review' : 'fill'} on ${kindRaw}.`);

    const answers: WizardAnswer[] = [];
    try {
        for (const entry of entries) {
            const currentValue = liveVars.find((v) => v.key === entry.name)?.value ?? undefined;
            const value = await promptWizardEntry({
                entry,
                constraint: registryJson.constraints[entry.name],
                currentValue: currentValue ?? undefined,
                mode: reviewAll ? 'review' : 'gap'
            });
            if (value !== undefined) {
                answers.push({ key: entry.name, value });
            }
        }
    } catch (err) {
        // A cancel (Ctrl+C) on ANY prompt aborts the whole run with zero
        // writes — never a partial write, even under --yes. A per-entry
        // "keep / skip" returns undefined normally and does NOT reach here.
        if (err instanceof WizardCancelledError) {
            log.warn('Cancelled — no changes written.');
            return;
        }
        throw err;
    }

    if (answers.length === 0) {
        log.ok('Nothing to update.');
        return;
    }

    log.info(`Pending writes on ${kindRaw}:`);
    for (const { key, value } of answers) {
        const action = planWizardWriteAction({ key, existingKeys: coolifyKeys });
        const entry = entries.find((e) => e.name === key);
        const preview = entry?.secret ? '***SECRET***' : value;
        process.stdout.write(`  ${action.toUpperCase()} ${key} = ${preview}\n`);
    }

    if (!skipConfirm) {
        const ok = await confirm(`Write ${answers.length} env var(s) to ${kindRaw}?`);
        if (!ok) {
            log.warn('Aborted — no changes written.');
            return;
        }
    }

    for (const { key, value } of answers) {
        const action = planWizardWriteAction({ key, existingKeys: coolifyKeys });
        try {
            if (action === 'update') {
                await client.updateEnvVar(uuid, key, { value, is_preview: false });
            } else {
                await client.createEnvVar(uuid, { key, value, is_preview: false });
            }
        } catch (err) {
            if (err instanceof CoolifyApiError) {
                die(
                    `Coolify rejected the change for '${key}' (${err.status}): ${JSON.stringify(err.body)}`
                );
            }
            throw err;
        }
        log.ok(`${key} ${action === 'update' ? 'updated' : 'created'} on ${kindRaw}.`);
    }

    log.hint(
        'Run `hops redeploy <kind>` or `hops app-restart <kind>` for the changes to take effect.'
    );
}
