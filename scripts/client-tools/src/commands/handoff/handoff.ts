import { resolveRunContext } from '../../lib/context.ts';
import { run } from '../../lib/exec.ts';
import { extractTarget } from '../../lib/target.ts';

async function git(cwd: string, args: string[]): Promise<string> {
    const result = await run({ command: 'git', args, cwd });
    return result.ok ? result.stdout.trim() : '';
}

export async function runHandoff({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(
            'hops handoff --plan — prepara handoff read-only, sin commit ni memoria.\n'
        );
        return 0;
    }
    if (!argv.includes('--plan')) {
        process.stderr.write('handoff es sólo read-only por ahora. Usá: hops handoff --plan\n');
        return 2;
    }
    const { target } = extractTarget({ argv });
    const context = await resolveRunContext({ cwd: process.cwd(), target });
    if (context.worktree === null) {
        process.stderr.write('No estás dentro de un worktree.\n');
        return 1;
    }
    const cwd = context.worktree.path;
    const branch = await git(cwd, ['branch', '--show-current']);
    const status = await git(cwd, ['status', '--short']);
    const commits = await git(cwd, ['log', '-8', '--format=%h %s']);
    const data = {
        branch: branch || null,
        dirty: status.length > 0,
        changedFiles: status ? status.split('\n') : [],
        recentCommits: commits ? commits.split('\n') : [],
        tests: 'pendiente de ejecutar',
        next: 'revisar cambios, ejecutar gates y decidir commit',
        readOnly: true
    };
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(data)}\n`);
        return 0;
    }
    process.stdout.write(`branch: ${data.branch ?? '(detached)'}\n`);
    process.stdout.write(`git: ${data.dirty ? 'DIRTY' : 'clean'}\n`);
    process.stdout.write(`archivos cambiados: ${data.changedFiles.length}\n`);
    process.stdout.write(`commits recientes: ${data.recentCommits.length}\n`);
    process.stdout.write(`tests: ${data.tests}\nnext: ${data.next}\n`);
    process.stdout.write('acciones: ninguna (read-only)\n');
    return 0;
}
