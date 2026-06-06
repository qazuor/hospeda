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

Set or update a single Coolify env var. Requires --target= (this command
writes data; HOPS_DEFAULT_TARGET is not honoured).

  CREATE: Coolify v4 mirrors a new env var into BOTH the production
          and preview environments regardless of is_preview in the
          POST body. After the create, run \`hops env-delete <kind>
          <KEY> --preview\` if you want the preview copy gone.

  UPDATE: scoped to whichever environment matches. Pass --preview to
          target the preview entry instead of the production one.

Flags:
  --preview     Target the preview environment instead of production
                (UPDATE only — see CREATE caveat above).
  --secret      Prompt for the value with masked input instead of
                taking it on the command line (avoids logging the
                value to your shell history).
  --yes         Skip the confirmation prompt (for automation).
  --help, -h    Show this help.

Examples:
  hops --target=prod env-set api FOO bar
  hops --target=prod env-set api MERCADO_PAGO_TOKEN --secret
  hops --target=staging env-set api LOG_LEVEL info --yes
  hops --target=prod env-set api EXPERIMENTAL_FLAG true --preview

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
    const targetIsPreview = args.includes('--preview');
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

    // Match against the requested environment (production by default,
    // preview when --preview was passed). Coolify keeps separate entries
    // per (key, is_preview) tuple so we have to filter by both.
    const match = existing.find((v) => v.key === key && Boolean(v.is_preview) === targetIsPreview);
    const action = match ? 'UPDATE' : 'CREATE';
    const valuePreview = useSecretPrompt
        ? '***SECRET***'
        : value.length > 60
          ? `${value.slice(0, 57)}...`
          : value;
    const envLabel = targetIsPreview ? 'preview' : 'production';

    log.info(`${action} on ${kindRaw} [${envLabel}]: ${key} = ${valuePreview}`);

    if (!skipConfirm) {
        const ok = await confirm(`${action} env var '${key}' on '${kindRaw}' [${envLabel}]?`);
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

    log.ok(`${key} ${match ? 'updated' : 'created'} on ${kindRaw} [${envLabel}].`);
    if (!match) {
        log.hint(
            `Coolify mirrors new env vars into BOTH production and preview environments. Use \`hops env-delete ${kindRaw} ${key} --preview\` to drop the preview copy.`
        );
    }
    log.hint(
        'Run `hops redeploy <kind>` or `hops app-restart <kind>` for the change to take effect.'
    );
}
