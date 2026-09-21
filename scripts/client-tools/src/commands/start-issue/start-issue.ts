import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { fetchIssue } from '../../lib/linear.ts';
import { resolveRepoRoot } from '../../lib/repo.ts';
import {
    BRANCH_TYPES,
    type BranchType,
    buildSlug,
    deriveBranchType,
    extractWorktreePath,
    normalizeIssueId
} from './derive.ts';

/** Options parsed from the command line. */
export interface StartIssueOptions {
    /** The raw issue argument, or `null` when none was given. */
    readonly issueArg: string | null;
    /** Branch type override, or `null` to derive it from the issue's labels. */
    readonly type: BranchType | null;
    /** Whether to launch the selected agent once the worktree exists. */
    readonly launchClaude: boolean;
    /** Agent to launch after the worktree exists. */
    readonly agent: 'claude' | 'opencode' | 'codex' | 'none';
    /** Whether to hand the selected agent `/hops-start-issue` instead of an empty prompt. */
    readonly withStartIssue: boolean;
    /** Whether to stop after reporting what would be created. */
    readonly dryRun: boolean;
    /** Whether the user asked for help. */
    readonly help: boolean;
    /** Invalid mutually-exclusive agent flags, if any. */
    readonly agentError: string | null;
}

/**
 * Parses the command line.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The parsed {@link StartIssueOptions}.
 */
export function parseStartIssueArgs({
    argv
}: {
    readonly argv: readonly string[];
}): StartIssueOptions {
    const positionals = argv.filter((arg) => !arg.startsWith('-'));
    const typeArg = positionals[1];
    const explicitAgentIndex = argv.indexOf('--agent');
    const explicitAgent = explicitAgentIndex >= 0 ? argv[explicitAgentIndex + 1] : null;
    const convenienceAgents = (['claude', 'opencode', 'codex'] as const).filter((name) =>
        argv.includes(`--${name}`)
    );
    const selectedAgents = explicitAgent
        ? [explicitAgent, ...convenienceAgents]
        : convenienceAgents;
    const agentValue = selectedAgents[0];
    const agentError =
        selectedAgents.length > 1
            ? 'Elegí un solo agente: --agent <nombre> o un único alias --claude/--opencode/--codex.'
            : null;
    const agent =
        agentValue === 'opencode' || agentValue === 'claude' || agentValue === 'codex'
            ? agentValue
            : 'none';
    return {
        issueArg: positionals[0] ?? null,
        type: BRANCH_TYPES.includes(typeArg as BranchType) ? (typeArg as BranchType) : null,
        launchClaude: agent !== 'none' && !argv.includes('--no-claude'),
        agent: argv.includes('--no-claude') ? 'none' : agent,

        withStartIssue: !argv.includes('--bare'),
        dryRun: argv.includes('--dry-run'),
        help: argv.includes('--help') || argv.includes('-h'),
        agentError
    };
}

/** The help page for this command. */
export function renderStartIssueHelp(): string {
    return `
${pc.bold('hops start-issue')} — arrancar a laburar un issue de Linear

  ${pc.dim('Lee el issue en Linear, arma el worktree con su branch cortada de staging,')}
  ${pc.dim('y opcionalmente abre el agente elegido adentro. El nombre de la branch sale del título')}
  ${pc.dim('del issue, igual que el comando /hops-start-issue — para que todos los clientes coincidan.')}

${pc.bold('Uso')}

  hops start-issue <issue> [tipo] [--agent claude|opencode|codex] [--claude|--opencode|--codex] [--bare]

  ${pc.bold('<issue>')}       273, hos-273, HOS-273 o #273 — todos valen.
  ${pc.bold('[tipo]')}        ${BRANCH_TYPES.join(' | ')}. Si no lo pasás sale de los labels
                del issue (bug → fix, improvement → refactor, resto → feat).
  ${pc.bold('--bare')}        Abre el agente elegido sin prompt inicial. Por default le pasa
                «/hops-start-issue HOS-N», que flipea el issue a In Progress en
                Linear y te resume los criterios de aceptación.
  ${pc.bold('--agent')}       Agente a abrir: claude, opencode o codex. Si falta, no abre ninguno.
  ${pc.bold('--claude/--opencode/--codex')}  Alias directos de --agent; no combines más de uno.
  ${pc.bold('--dry-run')}     Te dice qué branch y qué worktree armaría, y no toca nada.
  ${pc.bold('--help')}        Esta página.

${pc.bold('Qué NO hace')}

  No levanta los servers. Cuando los necesites, adentro del worktree:
  ${pc.dim('hops servers-up')}
`;
}

/** Runs `wt-create.sh`, capturing its output so the path can be read back. */
function createWorktree({
    type,
    slug,
    repoRoot
}: {
    readonly type: string;
    readonly slug: string;
    readonly repoRoot: string;
}): Promise<{ readonly code: number; readonly output: string }> {
    const configured = process.env.HOPS_WORKTREE_SCRIPT_DIR;
    const configuredScript = configured ? join(configured, 'wt-create.sh') : null;
    const repoScript = join(repoRoot, 'scripts', 'worktree', 'wt-create.sh');
    const script =
        configuredScript && existsSync(configuredScript)
            ? configuredScript
            : existsSync(repoScript)
              ? repoScript
              : join(homedir(), '.claude', 'skills', 'worktree', 'scripts', 'wt-create.sh');
    return new Promise((resolve) => {
        const child = spawn('bash', [script, type, slug], { cwd: repoRoot });
        let output = '';
        const capture = (chunk: Buffer): void => {
            const text = chunk.toString();
            output += text;
            // Streamed as it arrives: the script installs and builds, and a
            // silent two-minute wait reads as a hang.
            process.stderr.write(text);
        };
        child.stdout.on('data', capture);
        child.stderr.on('data', capture);
        child.on('error', () => resolve({ code: 1, output }));
        child.on('close', (code) => resolve({ code: code ?? 1, output }));
    });
}

/** Launches Claude inside the worktree, inheriting the terminal. */
function launchAgentIn({
    cwd,
    prompt,
    agent
}: {
    readonly cwd: string;
    readonly prompt: string | null;
    readonly agent: 'claude' | 'opencode' | 'codex';
}): Promise<number> {
    return new Promise((resolve) => {
        const args = prompt === null ? [] : [prompt];
        const child = spawn(agent, args, { cwd, stdio: 'inherit' });
        child.on('error', () => {
            process.stderr.write(
                `${pc.red(`No pude ejecutar \`${agent}\`.`)} El worktree quedó creado en:\n  ${cwd}\n`
            );
            resolve(1);
        });
        child.on('close', (code) => resolve(code ?? 0));
    });
}

/**
 * Creates the worktree for a Linear issue and opens Claude inside it.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runStartIssue({
    argv
}: {
    readonly argv: readonly string[];
}): Promise<number> {
    const opts = parseStartIssueArgs({ argv });

    if (opts.agentError !== null) {
        process.stderr.write(
            `${pc.red('Argumentos de agente incompatibles:')} ${opts.agentError}\n`
        );
        return 2;
    }

    if (opts.help || opts.issueArg === null) {
        process.stdout.write(renderStartIssueHelp());
        return opts.help ? 0 : 1;
    }

    const issueId = normalizeIssueId({ raw: opts.issueArg });
    if (issueId === null) {
        process.stderr.write(`${pc.red('No entiendo el issue:')} ${opts.issueArg}\n`);
        process.stderr.write('Probá con 273, hos-273, HOS-273 o #273.\n');
        return 1;
    }

    const interactive = process.stdout.isTTY === true && process.stdin.isTTY === true;
    if (interactive) p.intro(pc.bgCyan(pc.black(` hops start-issue ${issueId} `)));

    const spin = interactive
        ? p.spinner()
        : { start: (): void => {}, message: (): void => {}, stop: (): void => {} };

    spin.start(`Buscando ${issueId} en Linear…`);
    const lookup = await fetchIssue({ issueId });
    if (!lookup.ok) {
        spin.stop(pc.red('Linear falló'));
        process.stderr.write(`${lookup.reason}\n`);
        return 1;
    }
    const issue = lookup.issue;
    spin.stop(`${issue.identifier} · ${issue.stateName}`);

    if (issue.stateType === 'completed' || issue.stateType === 'canceled') {
        // Reopening closed work is legitimate, but doing it by accident is not:
        // the state is the one thing the user cannot see from the terminal.
        if (!interactive) {
            process.stderr.write(
                `${pc.red(`${issueId} ya está ${issue.stateName}.`)} Corré esto en una terminal para confirmar.\n`
            );
            return 1;
        }
        const go = await p.confirm({
            message: `${issueId} ya está ${issue.stateName}. ¿Seguimos igual?`,
            initialValue: false
        });
        if (p.isCancel(go) || !go) {
            p.cancel('Cancelado.');
            return 0;
        }
    }

    const type = opts.type ?? deriveBranchType({ labels: issue.labels });
    const slug = buildSlug({ issueId, title: issue.title });

    p.note(
        [
            `${pc.bold('título')}  ${issue.title}`,
            `${pc.bold('estado')}  ${issue.stateName}`,
            `${pc.bold('branch')}  ${type}/${slug}`,
            `${pc.bold('url')}     ${pc.dim(issue.url)}`,
            opts.type === null
                ? pc.dim(
                      `tipo «${type}» derivado de los labels: ${issue.labels.join(', ') || '(ninguno)'}`
                  )
                : pc.dim(`tipo «${type}» forzado por argumento`)
        ].join('\n'),
        issueId
    );

    const repoRoot = await resolveRepoRoot({ cwd: process.cwd() });

    if (opts.dryRun) {
        process.stdout.write(`${type}/${slug}\n`);
        process.stderr.write(
            `${pc.dim(`(--dry-run) no se creó nada. Se armaría desde ${repoRoot}.`)}\n`
        );
        return 0;
    }

    process.stderr.write(`\n${pc.dim(`Creando worktree desde ${repoRoot}…`)}\n`);
    const created = await createWorktree({ type, slug, repoRoot });

    const worktreePath = extractWorktreePath({ output: created.output });
    if (worktreePath === null || !existsSync(worktreePath)) {
        process.stderr.write(
            `${pc.red('wt-create.sh no reportó una ruta usable.')} Revisá su salida de arriba.\n`
        );
        return created.code === 0 ? 1 : created.code;
    }

    process.stderr.write(`\n${pc.green('Worktree listo:')} ${worktreePath}\n`);

    if (opts.agent === 'none') {
        process.stdout.write(`${worktreePath}\n`);
        process.stderr.write(pc.dim(`Entrá con:  cd ${worktreePath}\n`));
        return 0;
    }

    process.stderr.write(`${pc.dim(`Abriendo ${opts.agent} adentro…`)}\n\n`);
    const code = await launchAgentIn({
        cwd: worktreePath,
        prompt: opts.withStartIssue ? `/hops-start-issue ${issueId}` : null,
        agent: opts.agent
    });

    process.stderr.write(
        `\n${pc.dim(`Volviste a ${process.cwd()}. El worktree sigue en ${worktreePath}`)}\n`
    );
    return code;
}
