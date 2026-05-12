/**
 * `hops app-restart <api|web|admin>` — `docker restart` an app
 * container without going through Coolify's redeploy pipeline.
 *
 * Use this when:
 *   - The image is fine but the running process is wedged (memory leak,
 *     hung dependency, stale connection pool).
 *   - You changed an env var via Coolify and Coolify did not auto-restart
 *     the container.
 *
 * For an actual code change use `hops redeploy` — `docker restart` does
 * NOT pull a new image.
 */

import * as p from '@clack/prompts';
import { findContainer } from '../lib/container-lookup.ts';
import { docker } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';

const KINDS = ['api', 'web', 'admin'] as const;
type App = (typeof KINDS)[number];

const HELP = `
hops app-restart <api|web|admin> [--yes]

Restart an app container in place (\`docker restart\`). Does NOT pull a
new image — for that use \`hops redeploy\`.

Flags:
  --yes         Skip the confirmation prompt (for automation).
  --help, -h    Show this help.

Examples:
  hops app-restart api
  hops app-restart admin --yes
`.trim();

function isApp(value: string): value is App {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

export async function appRestart(argv: ReadonlyArray<string>): Promise<void> {
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
            message: 'Which app do you want to restart?',
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
    log.info(`Resolved ${kindRaw} → container ${container}`);

    if (!skipConfirm) {
        const ok = await confirm(`Restart container '${container}'?`);
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    const result = await docker(['restart', container]);
    if (result.exitCode !== 0) {
        die(`docker restart failed: ${result.stderr.trim() || `exit ${result.exitCode}`}`);
    }
    log.ok(`Restarted ${container}`);
    log.hint('Allow ~10-30s for the app to finish its boot sequence before hitting it.');
}
