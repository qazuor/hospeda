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
  ${pc.bold('--help')}     Esta página.
`;
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
    const runner = runnerFor({ target });

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
            return dryRun ? 0 : 1;
        }
        if (dryRun) {
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

    const fetched = await runner.exec({
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
        return 0;
    }

    if (before !== null && wanted !== null) {
        const changes = await toolChanges({ cwd: stagingPath, from: before, to: wanted });
        if (changes.length > 0) {
            process.stderr.write(`\n${pc.bold('Cambios en hops:')}\n`);
            for (const line of changes) process.stderr.write(`  ${line}\n`);
            process.stderr.write('\n');
        }
    }

    if (dryRun) {
        process.stderr.write(
            `${pc.dim('(--dry-run) no se tocó nada.')} ` +
                `${before?.slice(0, 9) ?? '?'} → ${wanted?.slice(0, 9) ?? '?'}\n`
        );
        return 0;
    }

    // Hard reset, not pull: nothing is ever authored in this checkout, so there
    // is no work to preserve and a rewritten history upstream must not be able
    // to wedge the tool.
    const reset = await runner.exec({
        command: 'git',
        args: ['reset', '--hard', `origin/${STAGING_BRANCH}`],
        cwd: stagingPath
    });
    if (reset !== 0) return reset;

    if (lockfileOf({ toolsPath }) !== lockBefore) {
        process.stderr.write(`${pc.dim('Cambiaron las dependencias, reinstalando…')}\n`);
        const installed = await runner.exec({
            command: 'bun',
            args: ['install'],
            cwd: toolsPath
        });
        if (installed !== 0) return installed;
    }

    // Regenerate the shell functions: staging may have added a command, and
    // without this it exists in the menu but has no binary alias.
    return await runner.exec({
        command: 'bash',
        args: [join(toolsPath, 'install.sh')],
        cwd: toolsPath
    });
}
