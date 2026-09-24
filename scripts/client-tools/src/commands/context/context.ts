import { existsSync, readdirSync } from 'node:fs';
import { resolveRunContext } from '../../lib/context.ts';
import { run } from '../../lib/exec.ts';
import { fetchIssue } from '../../lib/linear.ts';
import { extractTarget } from '../../lib/target.ts';

async function git(cwd: string, args: string[]): Promise<string> {
    const result = await run({ command: 'git', args, cwd });
    return result.ok ? result.stdout.trim() : '';
}

export async function runContextCommand({
    argv
}: {
    readonly argv: readonly string[];
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write('hops context HOS-NNN — contexto compacto read-only para agentes.\n');
        return 0;
    }
    const { target } = extractTarget({ argv });
    const context = await resolveRunContext({ cwd: process.cwd(), target });
    if (context.worktree === null) {
        process.stderr.write('No estás dentro de un worktree.\n');
        return 1;
    }
    const cwd = context.worktree.path;
    const issueId =
        argv.find((arg) => /^[A-Za-z]+-\d+$/.test(arg))?.toUpperCase() ??
        context.worktree.branch.match(/([A-Za-z]+-\d+)/)?.[1]?.toUpperCase() ??
        null;
    const issue = issueId ? await fetchIssue({ issueId }) : null;
    const spec =
        issueId && existsSync(`${context.repoRoot}/.specs`)
            ? (readdirSync(`${context.repoRoot}/.specs`).find((name) =>
                  name.toUpperCase().startsWith(issueId)
              ) ?? null)
            : null;
    const data = {
        issue: issue?.ok ? issue.issue : issueId,
        worktree: context.worktree.name,
        branch: context.worktree.branch || null,
        dirty: (await git(cwd, ['status', '--porcelain'])).length > 0,
        database: context.database,
        servers: context.worktree.servers.map((s) => ({ name: s.name, port: s.port })),
        spec,
        source: 'read-only'
    };
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(data)}\n`);
        return 0;
    }
    process.stdout.write(
        `issue: ${issue?.ok ? `${issue.issue.identifier} · ${issue.issue.title}` : (issueId ?? '(no inferido)')}\n`
    );
    process.stdout.write(
        `worktree: ${data.worktree}\nbranch: ${data.branch ?? '(detached)'}\ngit: ${data.dirty ? 'DIRTY' : 'clean'}\n`
    );
    process.stdout.write(`database: ${data.database ?? '(sin base registrada)'}\n`);
    process.stdout.write(
        `servers: ${data.servers.length ? data.servers.map((s) => `${s.name}:${s.port}`).join(', ') : '(ninguno)'}\nspec: ${data.spec ?? '(no encontrada)'}\n`
    );
    return 0;
}
