/**
 * `hops prune` — Free disk and RAM by clearing Docker's stopped
 * containers, dangling images, unused networks, and build cache.
 *
 * Same operation that runs weekly inside `weekly-restart.sh`, exposed
 * here so an operator can trigger it on demand when a build OOMs or
 * the host runs low on disk. Safe by design: uses `docker system
 * prune -f` (no `-a`, no `--volumes`) so running containers, tagged
 * images in use, and named volumes (databases) are NEVER touched.
 *
 * Why not just inline `sudo docker system prune -f` in the shell?
 *   - Captures output so the reclaimed-space line is highlighted.
 *   - Works without sudo when the operator is in the `docker` group
 *     (the same access hops already requires for app-restart, exec,
 *     and friends).
 *   - Self-documenting: shows up in `hops --help` so anyone reading
 *     the toolkit discovers it.
 */

import { docker } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';

const HELP = `
hops prune [--yes]

Run \`docker system prune -f\` to reclaim disk and free the build-cache
memory reservation. Removes only dangling/unused resources — never
running containers, named volumes, or tagged images currently in use.

Flags:
  --yes         Skip the confirmation prompt (for automation).
  --help, -h    Show this help.

Examples:
  hops prune
  hops prune --yes

Notes:
  - This is the same step that runs weekly inside weekly-restart.sh.
  - For more aggressive cleanup (also removes UNUSED tagged images,
    not just dangling), run \`docker system prune -af\` manually.
  - For removing volumes too, add \`--volumes\` to that manual call —
    but verify first that none of them back a database (\`hops
    docker-by-name postgres\` shows what's mounted).
`.trim();

export async function prune(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const skipConfirm = argv.includes('--yes');

    if (!skipConfirm) {
        const ok = await confirm(
            'Run docker system prune -f? (clears stopped containers, dangling images, unused networks, build cache)'
        );
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    log.info('Pruning Docker dangling images / stopped containers / build cache...');
    const result = await docker(['system', 'prune', '-f']);
    if (result.exitCode !== 0) {
        die(`docker system prune failed: ${result.stderr.trim() || `exit ${result.exitCode}`}`);
    }

    // The prune output ends with a "Total reclaimed space: X" line. Pull
    // it out so the summary is informative without dumping the entire
    // (and noisy) list of cache-object IDs.
    const reclaimed = result.stdout
        .split('\n')
        .filter((line) => /total reclaimed space/i.test(line))
        .map((line) => line.trim())
        .join('\n');

    if (reclaimed) {
        log.ok(reclaimed);
    } else {
        log.ok('Prune ran (no space reclaimed this round — nothing to clean).');
    }
}
