/**
 * `hops env-list <api|web|admin>` — list Coolify env vars for an app
 * with values redacted by default. Pass `--reveal` to show actual
 * values (requires the API token to have `read:sensitive` scope).
 *
 * The token-on-Coolify-UI shows env values in plaintext; this command
 * exists so you can audit "what variables exist on this app" from the
 * terminal without clicking through 150 rows in the dashboard.
 */

import * as p from '@clack/prompts';
import { findContainer, getApplicationUuid } from '../lib/container-lookup.ts';
import { CoolifyApiError, type CoolifyEnvVar, createCoolifyClient } from '../lib/coolify.ts';
import { die, log } from '../lib/log.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

const HELP = `
hops env-list <api|web|admin> [--reveal] [--match <regex>]

List Coolify env vars for the given app. Values are redacted by default.

Flags:
  --reveal           Show real values (token must have read:sensitive scope).
  --match <regex>    Only show vars whose key matches the regex (case-insensitive).
  --help, -h         Show this help.

Examples:
  hops env-list api
  hops env-list api --match '^HOSPEDA_(MERCADO|EMAIL)_'
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

    const filtered = filter ? vars.filter((v) => filter?.test(v.key)) : vars;

    log.info(
        `${filtered.length}/${vars.length} env vars on ${kindRaw} ` +
            `(${reveal ? 'values revealed' : 'values redacted'})`
    );

    if (filtered.length === 0) {
        log.warn('No matches.');
        return;
    }

    const sorted = [...filtered].sort((a, b) => a.key.localeCompare(b.key));
    for (const v of sorted) {
        const value = reveal ? (v.value ?? '') : v.value ? '***REDACTED***' : '<empty>';
        process.stdout.write(`${v.key}=${value}\n`);
    }
}
