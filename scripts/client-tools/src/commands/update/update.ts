import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { run } from '../../lib/exec.ts';
import { resolveRepoRoot } from '../../lib/repo.ts';
import { runnerFor } from '../../lib/runner.ts';
import {
    clientToolsPath,
    ensureStagingClone,
    isUsableStagingClone,
    STAGING_BRANCH,
    stagingCloneExists,
    stagingClonePath
} from '../../lib/staging-clone.ts';
import { extractTarget } from '../../lib/target.ts';
import { listWorktrees } from '../../lib/worktree.ts';

/** The help page. */
function renderHelp(): string {
    return `
${pc.bold('hops update')} — actualizar hops a lo último de staging

  ${pc.dim('hops corre desde un checkout dedicado a staging, no desde el clon')}
  ${pc.dim('principal. Así la herramienta no cambia cuando vos cambiás de branch')}
  ${pc.dim('para revisar otra cosa.')}

  ${pc.dim('Este comando trae ese checkout al día: fetch, reset a origin/staging,')}
  ${pc.dim('reinstala si cambiaron las dependencias, y regenera las funciones de')}
  ${pc.dim('fish por si staging trajo comandos nuevos.')}

${pc.bold('Uso')}

  hops update [--dry-run]

  ${pc.bold('--dry-run')}  Te dice qué traería y no toca nada.
  ${pc.bold('--json')}     Con --dry-run devuelve un resultado estructurado por stdout.
  ${pc.bold('--help')}     Esta página.
`;
}

function printDryRunJson(value: Record<string, unknown>): void {
    process.stdout.write(`${JSON.stringify(value)}\n`);
}

/** Reads the SHA the staging checkout currently sits on. */
async function headSha({ cwd }: { readonly cwd: string }): Promise<string | null> {
    const result = await run({ command: 'git', args: ['rev-parse', 'HEAD'], cwd });
    return result.ok ? result.stdout.trim() : null;
}

/** Lists the commits touching this CLI between two revisions. */
async function toolChanges({
    cwd,
    from,
    to
}: {
    readonly cwd: string;
    readonly from: string;
    readonly to: string;
}): Promise<readonly string[]> {
    const result = await run({
        command: 'git',
        args: ['log', '--oneline', '--no-decorate', `${from}..${to}`, '--', 'scripts/client-tools'],
        cwd
    });
    if (!result.ok) return [];
    return result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

/** Reconciles ignored local env files after the code checkout moves. */
async function reconcileLocalEnv({
    stagingPath,
    exec
}: {
    readonly stagingPath: string;
    readonly exec: (job: Parameters<ReturnType<typeof runnerFor>['exec']>[0]) => Promise<number>;
}): Promise<number> {
    const script = join(stagingPath, 'scripts/reconcile-local-env.sh');
    if (!existsSync(script)) {
        process.stderr.write(
            `${pc.yellow('Aviso:')} staging todavía no trae reconcile-local-env.sh; ` +
                'se mantiene el entorno existente.\n'
        );
        return 0;
    }
    return await exec({ command: 'bash', args: [script, stagingPath], cwd: stagingPath });
}

/** Hashes a lockfile so a dependency change can be detected. */
function lockfileOf({ toolsPath }: { readonly toolsPath: string }): string | null {
    const path = join(toolsPath, 'bun.lock');
    if (!existsSync(path)) return null;
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

/**
 * Brings the staging checkout — and with it, `hops` itself — up to date.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runUpdate({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }
    const { target, rest } = extractTarget({ argv });
    const dryRun = rest.includes('--dry-run');
    const json = rest.includes('--json');
    const runner = runnerFor({ target });
    const steps: Array<{ readonly name: string; readonly code: number }> = [];
    const execStep = async (
        name: string,
        job: Parameters<ReturnType<typeof runnerFor>['exec']>[0]
    ): Promise<number> => {
        if (!json) return await runner.exec(job);
        const result = await runner.execCapture(job);
        steps.push({ name, code: result.code });
        return result.code;
    };

    const repoRoot = await resolveRepoRoot({ cwd: process.cwd() });
    const all = await listWorktrees({ repoRoot });
    const mainRepoPath = all[0]?.path ?? repoRoot;

    const candidate = stagingClonePath({ mainRepoPath });

    // Three distinct states, three distinct messages: a dry run must not be the
    // thing that creates the checkout, and "exists but has no client-tools yet"
    // is not the same problem as "does not exist".
    if (!isUsableStagingClone({ path: candidate })) {
        if (stagingCloneExists({ path: candidate })) {
            process.stderr.write(
                `${pc.yellow('El checkout de staging existe pero todavía no tiene scripts/client-tools.')}\n` +
                    `${pc.dim(candidate)}\n` +
                    'Hasta que se mergee a staging, hops corre desde el checkout donde lo instalaste.\n'
            );
            if (dryRun && json) {
                printDryRunJson({
                    dryRun: true,
                    status: 'unusable-staging-checkout',
                    checkout: candidate,
                    touched: false
                });
            }
            return dryRun ? 0 : 1;
        }
        if (dryRun) {
            if (json) {
                printDryRunJson({
                    dryRun: true,
                    status: 'would-create-staging-checkout',
                    checkout: candidate,
                    touched: false
                });
                return 0;
            }
            process.stderr.write(
                `${pc.dim('(--dry-run)')} crearía el checkout de staging en ${candidate}\n`
            );
            return 0;
        }
    }

    const prepared = await ensureStagingClone({ mainRepoPath });
    if (!prepared.ok) {
        process.stderr.write(`${pc.red('ERROR:')} ${prepared.reason}\n`);
        return 1;
    }
    const stagingPath = prepared.path;
    const toolsPath = clientToolsPath({ repoPath: stagingPath });

    // The dispatcher already framed this run; what it cannot know is which
    // checkout `update` decided to act on, so that goes here.
    process.stderr.write(
        `${pc.dim('checkout ')}${stagingPath}` +
            `${prepared.created ? pc.green('  (recién creado)') : ''}\n`
    );

    const before = await headSha({ cwd: stagingPath });
    const lockBefore = lockfileOf({ toolsPath });

    if (dryRun) {
        // `git fetch --dry-run` still advertises FETCH_HEAD and can touch Git
        // metadata on some versions. ls-remote is enough to compare SHAs and
        // is the only network operation allowed in a genuinely read-only plan.
        const remote = await run({
            command: 'git',
            args: ['ls-remote', 'origin', `refs/heads/${STAGING_BRANCH}`],
            cwd: stagingPath
        });
        const wanted = remote.ok ? (remote.stdout.trim().split(/\s+/)[0] ?? null) : null;
        if (json) {
            printDryRunJson({
                dryRun: true,
                status: before !== null && wanted === before ? 'up-to-date' : 'would-update',
                checkout: stagingPath,
                before,
                wanted,
                touched: false,
                remoteOk: remote.ok
            });
            return remote.ok ? 0 : 1;
        }
        if (before !== null && wanted === before) {
            process.stderr.write(
                `${pc.green('Ya estabas al día.')} ${pc.dim(before.slice(0, 9))}\n`
            );
            return 0;
        }
        process.stderr.write(
            `${pc.dim('(--dry-run) no se tocó nada.')} ` +
                `${before?.slice(0, 9) ?? '?'} → ${wanted?.slice(0, 9) ?? '?'}\n`
        );
        return remote.ok ? 0 : 1;
    }

    const fetched = await execStep('fetch', {
        command: 'git',
        args: ['fetch', 'origin', STAGING_BRANCH],
        cwd: stagingPath
    });
    if (fetched !== 0) return fetched;

    const remote = await run({
        command: 'git',
        args: ['rev-parse', `origin/${STAGING_BRANCH}`],
        cwd: stagingPath
    });
    const wanted = remote.ok ? remote.stdout.trim() : null;

    if (before !== null && wanted === before) {
        process.stderr.write(`${pc.green('Ya estabas al día.')} ${pc.dim(before.slice(0, 9))}\n`);
        if (dryRun) return 0;
        const reconciled = await reconcileLocalEnv({
            stagingPath,
            exec: (job) => execStep('env-reconcile', job)
        });
        if (json) {
            printDryRunJson({
                dryRun: false,
                status: reconciled === 0 ? 'up-to-date' : 'failed',
                checkout: stagingPath,
                steps,
                touched: false
            });
        }
        return reconciled;
    }

    if (before !== null && wanted !== null) {
        const changes = await toolChanges({ cwd: stagingPath, from: before, to: wanted });
        if (changes.length > 0) {
            process.stderr.write(`\n${pc.bold('Cambios en hops:')}\n`);
            for (const line of changes) process.stderr.write(`  ${line}\n`);
            process.stderr.write('\n');
        }
    }

    // Hard reset, not pull: nothing is ever authored in this checkout, so there
    // is no work to preserve and a rewritten history upstream must not be able
    // to wedge the tool.
    const reset = await execStep('reset', {
        command: 'git',
        args: ['reset', '--hard', `origin/${STAGING_BRANCH}`],
        cwd: stagingPath
    });
    if (reset !== 0) return reset;

    const reconciled = await reconcileLocalEnv({
        stagingPath,
        exec: (job) => execStep('env-reconcile', job)
    });
    if (reconciled !== 0) return reconciled;

    if (lockfileOf({ toolsPath }) !== lockBefore) {
        process.stderr.write(`${pc.dim('Cambiaron las dependencias, reinstalando…')}\n`);
        const installed = await execStep('install-dependencies', {
            command: 'bun',
            args: ['install'],
            cwd: toolsPath
        });
        if (installed !== 0) return installed;
    }

    // Regenerate the shell functions: staging may have added a command, and
    // without this it exists in the menu but has no binary alias.
    const installedWrappers = await execStep('install-wrappers', {
        command: 'bash',
        args: [join(toolsPath, 'install.sh')],
        cwd: toolsPath
    });
    if (json) {
        printDryRunJson({
            dryRun: false,
            status: installedWrappers === 0 ? 'updated' : 'failed',
            checkout: stagingPath,
            steps,
            touched: true
        });
    }
    return installedWrappers;
}
