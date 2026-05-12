/**
 * `hops update` — pull the latest changes for the Hospeda repo and
 * reinstall the hops binary in one step.
 *
 * Equivalent to typing by hand:
 *   cd ~/hospeda
 *   git pull
 *   cd scripts/server-tools
 *   ./install.sh
 *
 * Reuses the directory the current binary lives in as HOPS_TARGET so
 * the installer runs without prompting (assuming the operator wants
 * to overwrite the same install location). On Linux, overwriting the
 * executable while it is running is safe — the running process keeps
 * its own inode mapped, and the next invocation picks up the new file.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { die, log } from '../lib/log.ts';
import { runner } from '../lib/runner.ts';

const HELP = `
hops update [--repo <path>] [--branch <name>] [--no-install]

Pull the latest commits for the Hospeda repo and reinstall the hops
binary in one step.

Flags:
  --repo <path>      Repo root (default: $HOPS_REPO_ROOT or ~/hospeda).
  --branch <name>    Branch to pull (default: current branch).
  --no-install       Skip the reinstall step (just git pull).
  --help, -h         Show this help.

Examples:
  hops update
  hops update --branch main
  hops update --no-install
  hops update --repo /opt/hospeda

Notes:
  When invoked as a compiled binary, the installer is reused with
  HOPS_TARGET set to the current binary's directory, so no prompts
  appear. When run from source (\`bun run src/index.ts update\`),
  the installer falls back to interactive mode.
`.trim();

export async function update(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const repoIdx = argv.indexOf('--repo');
    const repoArg = repoIdx >= 0 ? argv[repoIdx + 1] : undefined;
    if (repoIdx >= 0 && !repoArg) die('--repo requires a path.');

    const branchIdx = argv.indexOf('--branch');
    const branch = branchIdx >= 0 ? argv[branchIdx + 1] : undefined;
    if (branchIdx >= 0 && !branch) die('--branch requires a branch name.');

    const skipInstall = argv.includes('--no-install');

    // Resolve repo root: --repo flag > HOPS_REPO_ROOT env > ~/hospeda.
    const repoRoot = repoArg ?? process.env.HOPS_REPO_ROOT ?? path.join(os.homedir(), 'hospeda');
    if (!existsSync(repoRoot)) {
        die(`Repo not found at '${repoRoot}'. Pass --repo or set HOPS_REPO_ROOT.`);
    }
    if (!existsSync(path.join(repoRoot, '.git'))) {
        die(`'${repoRoot}' is not a git repository.`);
    }

    // ── git pull ────────────────────────────────────────────────────────
    log.info(`git pull in ${repoRoot}${branch ? ` (branch ${branch})` : ''}`);
    const pullArgs = ['-C', repoRoot, 'pull'];
    if (branch) pullArgs.push('origin', branch);
    const pull = await runner.run(['git', ...pullArgs], { inherit: true });
    if (pull.exitCode !== 0) {
        die(`git pull failed (exit ${pull.exitCode}). Resolve manually before retrying.`);
    }
    log.ok('Repo updated.');

    if (skipInstall) {
        log.hint('--no-install was passed; binary not reinstalled.');
        return;
    }

    // ── ./install.sh ────────────────────────────────────────────────────
    const installerDir = path.join(repoRoot, 'scripts/server-tools');
    const installerPath = path.join(installerDir, 'install.sh');
    if (!existsSync(installerPath)) {
        die(`install.sh not found at ${installerPath}.`);
    }

    // Reuse the directory of the current binary as HOPS_TARGET so the
    // installer runs unattended. When `hops` is being executed via
    // `bun run src/index.ts ...` the execPath is bun itself, in which
    // case we leave HOPS_TARGET unset and let the installer prompt.
    const currentBin = process.execPath;
    const looksLikeHops = path.basename(currentBin) === 'hops';
    const env = { ...process.env };
    if (looksLikeHops) {
        env.HOPS_TARGET = path.dirname(currentBin);
        log.info(`Reinstalling to ${env.HOPS_TARGET} (current binary location).`);
    } else {
        log.hint('Running from source; installer will prompt for target dir.');
    }

    const installer = spawn('bash', [installerPath], {
        stdio: 'inherit',
        env,
        cwd: installerDir
    });

    await new Promise<void>((resolve) => {
        installer.on('exit', (code) => {
            if (code !== null && code !== 0) {
                process.exitCode = code;
            }
            resolve();
        });
    });

    if (process.exitCode === 0 || process.exitCode === undefined) {
        log.ok('Update complete.');
    }
}
