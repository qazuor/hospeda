/**
 * `hops env-set <api|web|admin> <KEY> <VALUE>` — upsert a single Coolify
 * env var. Creates if missing, PATCHes if present.
 *
 * The Coolify env-var change does NOT take effect until the app is
 * redeployed (Coolify queues the new value but keeps the running
 * container's env intact). This command prints a hint to that effect
 * so the operator knows to follow up with `hops redeploy` (or
 * `app-restart` if the app reads env on every request).
 */

import * as p from '@clack/prompts';
import { findContainer, getApplicationUuid } from '../lib/container-lookup.ts';
import { CoolifyApiError, type CoolifyEnvVar, createCoolifyClient } from '../lib/coolify.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

const HELP = `
hops env-set <api|web|admin> <KEY> <VALUE>
hops env-set <api|web|admin> <KEY> --secret

Set or update a single Coolify env var. Creates the var if it does not
exist; otherwise PATCHes its value.

Flags:
  --secret      Prompt for the value with masked input instead of
                taking it on the command line (avoids logging the
                value to your shell history).
  --yes         Skip the confirmation prompt (for automation).
  --help, -h    Show this help.

Examples:
  hops env-set api FOO bar
  hops env-set api MERCADO_PAGO_TOKEN --secret
  hops env-set api LOG_LEVEL info --yes

Notes:
  Coolify does NOT auto-restart the running container after a single
  env-var change. Follow up with \`hops redeploy <kind>\` (full
  rebuild) or \`hops app-restart <kind>\` (in-place restart).
`.trim();

function isApp(value: string): value is App {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

export async function envSet(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const skipConfirm = args.includes('--yes');
    const useSecretPrompt = args.includes('--secret');
    const positional = args.filter((a) => !a.startsWith('--'));

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

    const container = await findContainer(kindRaw);
    const uuid = await getApplicationUuid(container);
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

    const match = existing.find((v) => v.key === key);
    const action = match ? 'UPDATE' : 'CREATE';
    const preview = useSecretPrompt
        ? '***SECRET***'
        : value.length > 60
          ? `${value.slice(0, 57)}...`
          : value;

    log.info(`${action} on ${kindRaw}: ${key} = ${preview}`);

    if (!skipConfirm) {
        const ok = await confirm(`${action} env var '${key}' on '${kindRaw}'?`);
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    try {
        if (match) {
            await client.updateEnvVar(uuid, match.uuid, { value });
        } else {
            await client.createEnvVar(uuid, { key, value });
        }
    } catch (err) {
        if (err instanceof CoolifyApiError) {
            die(`Coolify rejected the change (${err.status}): ${JSON.stringify(err.body)}`);
        }
        throw err;
    }

    log.ok(`${key} ${match ? 'updated' : 'created'} on ${kindRaw}.`);
    log.hint(
        'Run `hops redeploy <kind>` or `hops app-restart <kind>` for the change to take effect.'
    );
}
