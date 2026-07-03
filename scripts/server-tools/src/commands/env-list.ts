/**
 * `hops env-list <api|web|admin>` — list Coolify env vars for an app
 * with values redacted by default. Pass `--reveal` to show actual
 * values (requires the API token to have `read:sensitive` scope).
 *
 * The token-on-Coolify-UI shows env values in plaintext; this command
 * exists so you can audit "what variables exist on this app" from the
 * terminal without clicking through 150 rows in the dashboard.
 *
 * Coolify stores a separate row per (key, is_preview) slot. This toolkit
 * does not use Coolify preview releases, so the default view shows only
 * the production (non-preview) slot; pass `--preview` or `--all` to see
 * otherwise. This is unrelated to our own `--target=prod|staging` flag —
 * that picks WHICH app (prod vs staging), this picks WHICH slot within it.
 */

import * as p from '@clack/prompts';
import { findContainer, getApplicationUuid } from '../lib/container-lookup.ts';
import { CoolifyApiError, type CoolifyEnvVar, createCoolifyClient } from '../lib/coolify.ts';
import { die, log } from '../lib/log.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

const HELP = `
hops env-list <api|web|admin> [--reveal] [--match <regex>] [--preview] [--all]

List Coolify env vars for the given app. Defaults to the production
(non-preview) slot only. Values are redacted unless --reveal is passed.

Flags:
  --reveal           Show real values (token must have read:sensitive scope).
  --match <regex>    Only show vars whose key matches the regex (case-insensitive).
  --preview          Show the preview slot instead of production.
  --all              Show both slots (each row tagged [preview]/[main]).
  --help, -h         Show this help.

Examples:
  hops env-list api
  hops env-list api --preview
  hops env-list api --all --match '^HOSPEDA_(MERCADO|EMAIL)_'
  hops env-list api --reveal --match BREVO
`.trim();

function isApp(value: string): value is App {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

export async function envList(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const reveal = args.includes('--reveal');
    const showPreview = args.includes('--preview');
    const showAll = args.includes('--all');
    if (showPreview && showAll) {
        die('--preview and --all are mutually exclusive.');
    }
    const matchIndex = args.indexOf('--match');
    const matchRegex = matchIndex >= 0 ? args[matchIndex + 1] : undefined;
    if (matchIndex >= 0 && !matchRegex) {
        die('--match requires a regex pattern');
    }

    const positional = args.filter((a) => !a.startsWith('--')).filter((a) => a !== matchRegex);

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

    let filter: RegExp | undefined;
    if (matchRegex) {
        try {
            filter = new RegExp(matchRegex, 'i');
        } catch (err) {
            die(
                `Invalid regex '${matchRegex}': ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    // Scope to the requested Coolify slot before applying --match, so the
    // "X/Y" summary counts against the slot the operator asked to see.
    const slotFiltered = showAll ? vars : vars.filter((v) => Boolean(v.is_preview) === showPreview);
    const filtered = filter ? slotFiltered.filter((v) => filter?.test(v.key)) : slotFiltered;
    const slotLabel = showAll ? 'all slots' : showPreview ? 'preview' : 'production';

    log.info(
        `${filtered.length}/${slotFiltered.length} env vars on ${kindRaw} [${slotLabel}] ` +
            `(${reveal ? 'values revealed' : 'values redacted'})`
    );

    if (filtered.length === 0) {
        log.warn('No matches.');
        return;
    }

    const sorted = [...filtered].sort((a, b) => {
        const byKey = a.key.localeCompare(b.key);
        if (byKey !== 0) return byKey;
        // Stable secondary sort so main-slot entries always come before
        // their preview siblings — easier to scan when --all shows both.
        return Number(Boolean(a.is_preview)) - Number(Boolean(b.is_preview));
    });
    for (const v of sorted) {
        const value = reveal ? (v.value ?? '') : v.value ? '***REDACTED***' : '<empty>';
        // Single-slot views already announced the slot in the summary line
        // above; only tag each row when --all mixes both slots together.
        const prefix = showAll ? `${v.is_preview ? '[preview]' : '[main]   '} ` : '';
        process.stdout.write(`${prefix}${v.key}=${value}\n`);
    }
}
