import { existsSync, readdirSync } from 'node:fs';
import pc from 'picocolors';
import type { RunContext } from '../../lib/context.ts';
import { run } from '../../lib/exec.ts';
import { findPr } from '../../lib/github.ts';
import { fetchIssue } from '../../lib/linear.ts';
import { collectEnvDrift } from '../env/drift.ts';

function issueFromBranch(branch: string): string | null {
    const match = branch.match(/(?:^|\/)([a-z]+-\d+)(?:-|$)/i);
    return match?.[1]?.toUpperCase() ?? null;
}

async function git(cwd: string, args: string[]): Promise<string> {
    const result = await run({ command: 'git', args, cwd });
    return result.ok ? result.stdout.trim() : '';
}

export async function runCloseIssue({
    argv,
    context
}: {
    readonly argv: readonly string[];
    readonly context?: RunContext;
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(
            'hops close-issue --plan [--issue HOS-NNN] [--json] — preflight read-only; no aplica mutaciones.\n'
        );
        return 0;
    }
    if (!argv.includes('--plan')) {
        process.stderr.write(
            'close-issue es sólo preflight por ahora. Usá: hops close-issue --plan\n'
        );
        return 2;
    }
    const json = argv.includes('--json');
    if (context?.worktree === null || context?.worktree === undefined) {
        process.stderr.write(
            'No estás dentro de un worktree. El cierre debe ejecutarse desde el worktree del issue.\n'
        );
        return 1;
    }
    const cwd = context.worktree.path;
    const branch = await git(cwd, ['branch', '--show-current']);
    const issueFlag = argv.indexOf('--issue');
    const explicitIssue = issueFlag >= 0 ? argv[issueFlag + 1] : undefined;
    const issueId =
        explicitIssue?.match(/^[A-Za-z]+-\d+$/)?.[0].toUpperCase() ?? issueFromBranch(branch);
    const dirty = await git(cwd, ['status', '--porcelain']);
    const ahead = await git(cwd, ['rev-list', '--count', '@{upstream}..HEAD']);
    const specs = existsSync(`${context.repoRoot}/.specs`)
        ? readdirSync(`${context.repoRoot}/.specs`).filter(
              (name) => issueId && name.toUpperCase().startsWith(issueId)
          )
        : [];
    const specPath = specs[0] ? `${context.repoRoot}/.specs/${specs[0]}` : null;
    const closeout = specPath !== null && existsSync(`${specPath}/closeout.md`);
    const taskState = specPath !== null && existsSync(`${specPath}/tasks/state.json`);
    const state = issueId
        ? await fetchIssue({ issueId })
        : { ok: false as const, reason: 'no se pudo inferir issue desde la branch' };
    const envReport = collectEnvDrift({ root: cwd });
    const envDrift = {
        clean: envReport.clean,
        missing: envReport.files.reduce((sum, file) => sum + file.missing.length, 0),
        requiredMissing: envReport.files.reduce(
            (sum, file) => sum + file.requiredMissing.length,
            0
        ),
        optionalMissing: envReport.files.reduce(
            (sum, file) => sum + file.optionalMissing.length,
            0
        ),
        obsolete: envReport.files.reduce((sum, file) => sum + file.obsolete.length, 0),
        needsValue: envReport.files.reduce((sum, file) => sum + file.needsValue.length, 0),
        mismatched: envReport.mismatched.length,
        absentCrossChecks: envReport.absentCrossChecks.length
    };
    // main/staging do not have an issue PR of their own. Avoid asking GitHub
    // about them: an empty PR result would look like a missing closeout signal
    // instead of the structural fact that this is a protected base branch.
    const pr =
        branch && !['main', 'staging'].includes(branch) ? await findPr({ branch, cwd }) : 'none';

    const actions: string[] = [];
    if (dirty.length > 0) actions.push('resolver cambios sin commit antes del cierre');
    if (ahead !== '') actions.push('publicar o revisar commits que todavía no están en upstream');
    if (specPath !== null && !closeout) actions.push('completar closeout.md de la spec');
    if (specPath !== null && !taskState)
        actions.push('registrar el estado final de tasks/state.json');
    if (specPath === null)
        actions.push('confirmar si el issue requiere spec y dónde queda el closeout');
    if (!state.ok) actions.push('resolver la consulta de Linear antes de cambiar el estado');
    else if (state.issue.stateType !== 'completed')
        actions.push(`confirmar el estado final de Linear (actual: ${state.issue.stateName})`);
    if (state.ok && state.issue.labels.some((label) => label.startsWith('status-needs-smoke-')))
        actions.push('ejecutar y evidenciar los smoke gates pendientes');
    if (!envDrift.clean) actions.push('resolver drift de variables de entorno antes del cierre');
    if (pr === 'none' && branch && !['main', 'staging'].includes(branch))
        actions.push('abrir o vincular el PR antes del cierre');
    else if (typeof pr === 'object' && 'error' in pr)
        actions.push('reintentar la consulta de PR/CI con GitHub disponible');
    else if (typeof pr === 'object' && pr.state !== 'MERGED')
        actions.push('revisar PR y CI antes de cerrar');
    const externalLookupFailed = !state.ok || (typeof pr === 'object' && 'error' in pr);

    if (json) {
        const smoke = state.ok
            ? state.issue.labels.filter((label) => label.startsWith('status-needs-smoke-'))
            : [];
        process.stdout.write(
            `${JSON.stringify({
                branch: branch || null,
                issue: issueId,
                git: { dirty: dirty.length > 0, ahead: ahead || null },
                specs,
                closeout,
                taskState,
                linear: state.ok
                    ? {
                          identifier: state.issue.identifier,
                          state: state.issue.stateName,
                          labels: state.issue.labels,
                          smokePending: smoke
                      }
                    : { error: state.reason },
                envDrift,
                pullRequest: pr,
                actions,
                readOnly: true
            })}\n`
        );
        return externalLookupFailed ? 1 : 0;
    }

    process.stdout.write(`${pc.bold('PLAN READ-ONLY close-issue')}\n`);
    process.stdout.write(`branch: ${branch || '(sin branch)'}\n`);
    process.stdout.write(`issue: ${issueId ?? '(no inferido)'}\n`);
    process.stdout.write(`git: ${dirty.length === 0 ? 'clean' : 'DIRTY — bloquea cierre'}\n`);
    process.stdout.write(`commits sin upstream: ${ahead || '(sin upstream o no disponible)'}\n`);
    process.stdout.write(`specs: ${specs.length ? specs.join(', ') : '(no encontrada)'}\n`);
    process.stdout.write(`closeout: ${closeout ? 'presente' : 'ausente'}\n`);
    process.stdout.write(`tasks/state: ${taskState ? 'presente' : 'ausente'}\n`);
    process.stdout.write(
        `env drift: ${envDrift.clean ? 'limpio' : `${envDrift.requiredMissing} obligatorias faltantes · ${envDrift.optionalMissing} opcionales ausentes · ${envDrift.obsolete} obsoletas · ${envDrift.needsValue} sin valor`}\n`
    );
    process.stdout.write(
        `Linear: ${state.ok ? `${state.issue.stateName} (${state.issue.identifier})` : state.reason}\n`
    );
    if (state.ok) {
        const smoke = state.issue.labels.filter((label) => label.startsWith('status-needs-smoke-'));
        process.stdout.write(`labels: ${state.issue.labels.join(', ') || '(ninguno)'}\n`);
        process.stdout.write(
            `smoke pendientes: ${smoke.length ? smoke.join(', ') : '(ninguno detectado)'}\n`
        );
    }
    process.stdout.write(
        `PR/CI: ${pr === 'none' ? 'sin PR' : typeof pr === 'object' && 'error' in pr ? `error: ${pr.error}` : `PR #${pr.number} · ${pr.state} · ${pr.mergeStateStatus} · checks ${pr.checks.length}`}\n`
    );
    process.stdout.write(`smoke/closeout: pendiente de verificación\n`);
    process.stdout.write(
        `acciones propuestas: ${actions.length ? actions.join(' · ') : 'ninguna detectada'}\n`
    );
    process.stdout.write(
        `acciones ejecutadas: ninguna (no marca Done, no comenta, no limpia worktree)\n`
    );
    return externalLookupFailed ? 1 : 0;
}
