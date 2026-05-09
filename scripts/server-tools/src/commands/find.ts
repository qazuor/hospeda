/**
 * `hops find <kind>` — resolve a Coolify-managed container by kind
 * (api / web / admin / postgres / redis / coolify) using label-,
 * image-, and port-based strategies. Prints the resolved name, useful
 * for shell scripts: `CONTAINER=$(hops find api)`.
 */

import * as p from '@clack/prompts';
import { type ContainerKind, findContainerVerbose } from '../lib/container-lookup.ts';
import { die, log } from '../lib/log.ts';

const KINDS: ReadonlyArray<ContainerKind> = ['api', 'web', 'admin', 'postgres', 'redis', 'coolify'];

const HELP = `
hops find <kind> [--verbose]

Resolve a single running container by role and print its name. Useful
in shell scripts: CONTAINER=$(hops find api).

Kinds:
  api         the long-running Hono API container
  web         the Astro Node SSR container
  admin       the TanStack Start admin container
  postgres    the Coolify-managed Postgres database
  redis       the Coolify-managed Redis instance
  coolify     the Coolify orchestrator itself

Flags:
  --verbose       Also print which lookup strategy matched and the
                  Coolify labels found on the container.
  --help, -h      Show this help.

Examples:
  hops find api
  hops find postgres --verbose

Notes:
  Without <kind>, opens an interactive picker.
`.trim();

function isKind(value: string): value is ContainerKind {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

export async function findCommand(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];
    const verbose = args.includes('--verbose');
    const positional = args.filter((arg) => !arg.startsWith('--'));

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    let kindRaw = positional[0];
    if (!kindRaw) {
        const answer = await p.select({
            message: 'Container kind',
            options: KINDS.map((k) => ({ value: k, label: k }))
        });
        if (p.isCancel(answer)) {
            log.warn('Cancelled.');
            return;
        }
        kindRaw = answer;
    }

    if (!isKind(kindRaw)) {
        die(`Unknown kind '${kindRaw}'. Known: ${KINDS.join(', ')}.`);
    }

    const result = await findContainerVerbose(kindRaw);

    if (verbose) {
        log.info(`Strategy: ${result.strategy}`);
        if (Object.keys(result.labels).length > 0) {
            log.info('Coolify labels:');
            for (const [k, v] of Object.entries(result.labels)) {
                if (k.startsWith('coolify.')) {
                    process.stderr.write(`  ${k}=${v}\n`);
                }
            }
        }
    }

    process.stdout.write(`${result.name}\n`);
}
