/**
 * `hctl redeploy <api|web|admin>` — trigger a Coolify redeploy for a
 * running app via the Coolify v4 REST API. Resolves the application
 * UUID from the running container's `coolify.name` label so we never
 * hard-code UUIDs into the toolkit (they would drift on every Coolify
 * project rename / re-import).
 */

import * as p from '@clack/prompts';
import { findContainer, getApplicationUuid } from '../lib/container-lookup.ts';
import { CoolifyApiError, createCoolifyClient } from '../lib/coolify.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

const HELP = `
hctl redeploy <api|web|admin> [--yes]

Trigger a Coolify redeploy for the given app. Resolves the application
UUID from the running container's coolify.name label.

Flags:
  --yes        Skip the confirmation prompt (for automation).
  --help       Show this help.

Examples:
  hctl redeploy api
  hctl redeploy web --yes
`.trim();

function isApp(value: string): value is App {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

export async function redeploy(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const skipConfirm = args.includes('--yes');
    const positional = args.filter((a) => !a.startsWith('--'));

    let kindRaw = positional[0];
    if (!kindRaw) {
        const answer = await p.select({
            message: 'Which app do you want to redeploy?',
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

    log.info(`Resolved ${kindRaw} → container ${container}`);
    log.info(`Coolify application UUID: ${uuid}`);

    if (!skipConfirm) {
        const ok = await confirm(`Trigger redeploy of '${kindRaw}'?`);
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    const client = createCoolifyClient();
    try {
        const result = await client.deploy(uuid);
        const deployment = result.deployments[0];
        if (deployment) {
            log.ok(`Redeploy queued. Deployment UUID: ${deployment.deployment_uuid}`);
            log.hint('Watch progress at https://coolify.hospeda.com.ar in the deployment log.');
        } else {
            log.ok('Redeploy queued.');
        }
    } catch (err) {
        if (err instanceof CoolifyApiError) {
            die(`Coolify rejected the deploy request (${err.status}): ${JSON.stringify(err.body)}`);
        }
        throw err;
    }
}
