/**
 * `hops env-delete <api|web|admin> <KEY>` — delete one or more Coolify
 * env vars by key.
 *
 * Coolify v4 stores separate entries per (key, is_preview) tuple, so
 * a key can have up to two backing rows (production + preview). By
 * default this command deletes EVERY entry that matches the key —
 * pass `--preview` or `--production` to scope the delete.
 *
 * Always prompts before destruction unless `--yes` is passed; the prompt
 * lists the exact entries that will be removed so the operator can
 * sanity-check before confirming.
 */

import { findContainer, getApplicationUuid } from '../lib/container-lookup.ts';
import { CoolifyApiError, type CoolifyEnvVar, createCoolifyClient } from '../lib/coolify.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

const HELP = `
hops env-delete <api|web|admin> <KEY> [--preview|--production] [--yes]

Delete one or more Coolify env vars matching <KEY>. Coolify stores
separate entries for production and preview environments, so a key
may have up to two backing rows. By default both are removed.

Flags:
  --preview        Only delete the preview entry (leave production).
  --production     Only delete the production entry (leave preview).
  --yes            Skip the confirmation prompt (for automation).
  --help, -h       Show this help.

Examples:
  hops env-delete api HOPS_SMOKE_TEST
  hops env-delete api HOPS_SMOKE_TEST --yes
  hops env-delete api OLD_FEATURE_FLAG --preview

Notes:
  Coolify does NOT auto-restart the running container after the change.
  Follow up with \`hops redeploy <kind>\` or \`hops app-restart <kind>\`.
`.trim();

function isApp(value: string): value is App {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

export async function envDelete(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const skipConfirm = args.includes('--yes');
    const onlyPreview = args.includes('--preview');
    const onlyProduction = args.includes('--production');
    if (onlyPreview && onlyProduction) {
        die('--preview and --production are mutually exclusive.');
    }

    const positional = args.filter((a) => !a.startsWith('--'));
    const [kindRaw, key] = positional;
    if (!kindRaw) die('Missing <kind>. Run with --help for usage.');
    if (!isApp(kindRaw)) {
        die(`Unknown app '${kindRaw}'. Known: ${KINDS.join(', ')}.`);
    }
    if (!key) die('Missing <KEY>. Run with --help for usage.');

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

    let candidates = existing.filter((v) => v.key === key);
    if (onlyPreview) candidates = candidates.filter((v) => Boolean(v.is_preview));
    if (onlyProduction) candidates = candidates.filter((v) => !v.is_preview);

    if (candidates.length === 0) {
        const scope = onlyPreview ? ' [preview]' : onlyProduction ? ' [production]' : '';
        log.warn(`No env var with key '${key}' on ${kindRaw}${scope}.`);
        return;
    }

    log.info(`Found ${candidates.length} entry(ies) on ${kindRaw} for key '${key}':`);
    for (const c of candidates) {
        const env = c.is_preview ? '[preview]' : '[prod]   ';
        process.stderr.write(`  ${env}  uuid=${c.uuid}\n`);
    }

    if (!skipConfirm) {
        const ok = await confirm(
            `Delete ${candidates.length} entry(ies) for '${key}' on '${kindRaw}'?`
        );
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    let deleted = 0;
    for (const c of candidates) {
        try {
            await client.deleteEnvVar(uuid, c.uuid);
            deleted++;
        } catch (err) {
            if (err instanceof CoolifyApiError) {
                log.error(
                    `Failed to delete uuid=${c.uuid} (${err.status}): ${JSON.stringify(err.body)}`
                );
            } else {
                log.error(
                    `Failed to delete uuid=${c.uuid}: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }
    }

    log.ok(`Deleted ${deleted}/${candidates.length} entry(ies) for '${key}' on ${kindRaw}.`);
    if (deleted > 0) {
        log.hint(
            'Run `hops redeploy <kind>` or `hops app-restart <kind>` for the change to take effect.'
        );
    }
}
