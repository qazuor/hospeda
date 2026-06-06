/**
 * `hops health [prod|staging]` — runs the existing
 * `scripts/smoke-test.sh` from the repo and reports its outcome.
 *
 * The smoke script lives in the repo (not the toolkit) because it is
 * also called from CI and the deploy pipeline. Locating it via
 * `git rev-parse --show-toplevel` keeps the toolkit decoupled from
 * cwd assumptions — `hops health` works as long as it is invoked from
 * inside a checkout of the repo.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { die, log } from '../lib/log.ts';
import { runner } from '../lib/runner.ts';

const HELP = `
hops health [prod|staging]

Run scripts/smoke-test.sh from the repo against the given environment
and exit with the script's status code.

Args:
  prod          Default. Smoke-tests hospeda.com.ar / api.hospeda.com.ar
                / admin.hospeda.com.ar.
  staging       Smoke-tests staging.hospeda.com.ar et al.

Note:
  The environment is a positional argument (prod|staging), NOT the global
  --target= flag. HOPS_DEFAULT_TARGET has no effect on this command.

Flags:
  --help, -h    Show this help.

Examples:
  hops health
  hops health staging
`.trim();

const VALID_ENVS = ['prod', 'production', 'staging'] as const;

export async function health(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const env = argv[0] ?? 'prod';
    if (!(VALID_ENVS as ReadonlyArray<string>).includes(env)) {
        die(`Unknown env '${env}'. Known: ${VALID_ENVS.join(', ')}.`);
    }

    // Resolve the repo root via git so the command works from any
    // subdirectory of the checkout.
    const top = await runner.run(['git', 'rev-parse', '--show-toplevel']);
    if (top.exitCode !== 0) {
        die('Not inside a git repository — cannot locate scripts/smoke-test.sh.');
    }
    const repoRoot = top.stdout.trim();
    const script = path.join(repoRoot, 'scripts/smoke-test.sh');
    if (!existsSync(script)) {
        die(`smoke-test.sh not found at ${script}.`);
    }

    log.info(`Running ${script} ${env}`);

    // Use spawn with stdio inherited so the script's pretty colored
    // output streams to the operator's terminal in real time. We do
    // NOT use the runner here because the runner buffers stdout/stderr
    // and we want immediate feedback for a multi-second probe.
    const child = spawn('bash', [script, env], { stdio: 'inherit' });

    await new Promise<void>((resolve) => {
        child.on('exit', (code) => {
            if (code === null) {
                process.exitCode = 1;
            } else if (code !== 0) {
                process.exitCode = code;
            }
            resolve();
        });
    });
}
