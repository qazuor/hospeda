import { resolveRunContext } from '../../lib/context.ts';
import { run } from '../../lib/exec.ts';
import { extractTarget } from '../../lib/target.ts';

async function git(cwd: string, args: string[]): Promise<string> {
    const result = await run({ command: 'git', args, cwd });
    return result.ok ? result.stdout.trim() : '';
}

function issueFromBranch(branch: string): string {
    return branch.match(/(?:^|\/)([A-Za-z]+-\d+)(?:-|$)/)?.[1]?.toUpperCase() ?? '(no inferido)';
}

export async function runRecap({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write('hops recap — resumen read-only del worktree actual.\n');
        return 0;
    }
    const { target } = extractTarget({ argv });
    const context = await resolveRunContext({ cwd: process.cwd(), target });
    if (context.worktree === null) {
        process.stderr.write('No estás dentro de un worktree.\n');
        return 1;
    }
    const cwd = context.worktree.path;
    const branch = await git(cwd, ['branch', '--show-current']);
    const dirty = await git(cwd, ['status', '--porcelain']);
    const commits = await git(cwd, ['log', '-5', '--format=%h %s']);
    const data = {
        worktree: context.worktree.name,
        branch: branch || null,
        issue: issueFromBranch(branch) === '(no inferido)' ? null : issueFromBranch(branch),
        dirty: dirty.length > 0,
        database: context.database,
        servers: context.worktree.servers.map((s) => ({ name: s.name, port: s.port })),
        commits: commits ? commits.split('\n') : []
    };
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(data)}\n`);
        return 0;
    }
    process.stdout.write(`worktree: ${data.worktree}\n`);
    process.stdout.write(`branch: ${branch || '(detached)'}\n`);
    process.stdout.write(`issue: ${data.issue ?? '(no inferido)'}\n`);
    process.stdout.write(`git: ${dirty ? 'DIRTY' : 'clean'}\n`);
    process.stdout.write(`database: ${data.database ?? '(sin base registrada)'}\n`);
    process.stdout.write(
        `servers: ${data.servers.length ? data.servers.map((s) => `${s.name}:${s.port}`).join(', ') : '(ninguno)'}\n`
    );
    process.stdout.write(`commits:\n${commits || '(ninguno)'}\n`);
    return 0;
}
