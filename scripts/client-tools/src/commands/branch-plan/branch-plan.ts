import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { localRunner } from '../../lib/runner.ts';

type ProjectConfig = {
    readonly branches?: {
        readonly base?: string;
        readonly protected?: readonly string[];
        readonly promotion?: readonly string[];
        readonly backMerge?: readonly { readonly from: string; readonly to: string }[];
    };
};

export type BranchPlanKind = 'promote' | 'back-merge';

type PullRequestResult = {
    readonly number: number;
    readonly url: string;
};

async function loadConfig(repoRoot: string): Promise<ProjectConfig> {
    return JSON.parse(await readFile(join(repoRoot, '.qz/project.json'), 'utf8')) as ProjectConfig;
}

async function refState(repoRoot: string, ref: string): Promise<'local' | 'remote' | 'missing'> {
    const runner = localRunner();
    const local = await runner.execCapture({
        command: 'git',
        args: ['show-ref', '--verify', '--quiet', `refs/heads/${ref}`],
        cwd: repoRoot
    });
    if (local.code === 0) return 'local';
    const remote = await runner.execCapture({
        command: 'git',
        args: ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${ref}`],
        cwd: repoRoot
    });
    return remote.code === 0 ? 'remote' : 'missing';
}

async function divergence(
    repoRoot: string,
    from: string,
    to: string
): Promise<{ ahead: number; behind: number } | null> {
    const result = await localRunner().execCapture({
        command: 'git',
        args: ['rev-list', '--left-right', '--count', `origin/${to}...origin/${from}`],
        cwd: repoRoot
    });
    if (result.code !== 0) return null;
    const values = result.stdout.trim().split(/\s+/).map(Number);
    const behind = values[0];
    const ahead = values[1];
    return typeof ahead === 'number' &&
        Number.isFinite(ahead) &&
        typeof behind === 'number' &&
        Number.isFinite(behind)
        ? { ahead, behind }
        : null;
}

async function checkoutState(repoRoot: string): Promise<{ branch: string | null; clean: boolean }> {
    const runner = localRunner();
    const [branch, status] = await Promise.all([
        runner.execCapture({
            command: 'git',
            args: ['symbolic-ref', '--quiet', '--short', 'HEAD'],
            cwd: repoRoot
        }),
        runner.execCapture({
            command: 'git',
            args: ['status', '--porcelain', '--untracked-files=all'],
            cwd: repoRoot
        })
    ]);
    return {
        branch: branch.code === 0 ? branch.stdout.trim() || null : null,
        clean: status.code === 0 && status.stdout.trim() === ''
    };
}

function parseArgs(
    argv: readonly string[],
    kind: BranchPlanKind
): { from?: string; to?: string; json: boolean; plan: boolean; confirm: boolean } {
    const positional = argv.filter((arg) => !arg.startsWith('--'));
    const fromAt = argv.indexOf('--from');
    const toAt = argv.indexOf('--to');
    const fromFlag =
        argv.find((arg) => arg.startsWith('--from='))?.slice(7) ??
        (fromAt >= 0 ? argv[fromAt + 1] : undefined);
    const toFlag =
        argv.find((arg) => arg.startsWith('--to='))?.slice(5) ??
        (toAt >= 0 ? argv[toAt + 1] : undefined);
    return {
        from: fromFlag ?? (kind === 'promote' ? positional[0] : undefined),
        to: toFlag ?? (kind === 'promote' ? positional[1] : undefined),
        json: argv.includes('--json'),
        plan: argv.includes('--plan'),
        confirm: argv.includes('--confirm')
    };
}

async function findOpenPromotionPr(
    repoRoot: string,
    from: string,
    to: string
): Promise<PullRequestResult | null> {
    const result = await localRunner().execCapture({
        command: 'gh',
        args: [
            'pr',
            'list',
            '--head',
            from,
            '--base',
            to,
            '--state',
            'open',
            '--json',
            'number,url',
            '--limit',
            '1'
        ],
        cwd: repoRoot
    });
    if (result.code !== 0) throw new Error(result.stderr.trim() || 'gh pr list falló');
    const rows = JSON.parse(result.stdout) as readonly PullRequestResult[];
    return rows[0] ?? null;
}

async function createPromotionPr(
    repoRoot: string,
    kind: BranchPlanKind,
    from: string,
    to: string
): Promise<PullRequestResult> {
    const existing = await findOpenPromotionPr(repoRoot, from, to);
    if (existing) return existing;
    const label = kind === 'promote' ? 'Promoción' : 'Back-merge';
    const result = await localRunner().execCapture({
        command: 'gh',
        args: [
            'pr',
            'create',
            '--head',
            from,
            '--base',
            to,
            '--title',
            `${label}: ${from} → ${to}`,
            '--body',
            `PR generado por qz ${kind}.\n\nOrigen: ${from}\nDestino: ${to}\n\nRevisar checks y mergear manualmente.`
        ],
        cwd: repoRoot
    });
    if (result.code !== 0) throw new Error(result.stderr.trim() || 'gh pr create falló');
    const url = result.stdout.trim().split(/\s+/).at(-1) ?? '';
    const numberMatch = /\/pull\/(\d+)(?:\s|$)/.exec(url);
    if (!url || !numberMatch) throw new Error('gh pr create no devolvió una URL de PR reconocible');
    return { number: Number(numberMatch[1]), url };
}

export async function runBranchPlan({
    argv,
    kind
}: {
    readonly argv: readonly string[];
    readonly kind: BranchPlanKind;
}): Promise<number> {
    const args = parseArgs(argv, kind);
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(
            `${kind === 'promote' ? 'hops promote' : 'hops back-merge'} --plan ${kind === 'promote' ? '[from] [to]' : '--from <branch> --to <branch>'} [--json]\n` +
                `${kind === 'promote' ? 'hops promote' : 'hops back-merge'} --confirm ${kind === 'promote' ? '[from] [to]' : '--from <branch> --to <branch>'} [--json]\n`
        );
        return 0;
    }
    if (!args.plan && !args.confirm) {
        process.stderr.write(
            `${pc.yellow('Falta modo de ejecución:')} usá --plan para sólo inspeccionar o --confirm para crear el PR.\n`
        );
        return 1;
    }
    const context = await resolveRunContext({ cwd: process.cwd(), target: 'local' });
    const config = await loadConfig(context.repoRoot);
    const declaredPromotion =
        config.branches?.promotion ?? ([config.branches?.base, 'main'].filter(Boolean) as string[]);
    const declaredBackMerge = config.branches?.backMerge ?? [
        { from: 'main', to: config.branches?.base ?? 'develop' }
    ];
    const from = args.from ?? (kind === 'back-merge' ? undefined : config.branches?.base);
    const defaultPromotionTarget =
        from === undefined ? undefined : declaredPromotion[declaredPromotion.indexOf(from) + 1];
    const to = args.to ?? (kind === 'promote' ? defaultPromotionTarget : undefined);
    const allowed =
        kind === 'promote'
            ? Boolean(
                  from &&
                      to &&
                      declaredPromotion.includes(from) &&
                      declaredPromotion.includes(to) &&
                      declaredPromotion.indexOf(to) === declaredPromotion.indexOf(from) + 1
              )
            : Boolean(
                  from &&
                      to &&
                      declaredBackMerge.some((pair) => pair.from === from && pair.to === to)
              );
    const state = {
        from: from ?? null,
        to: to ?? null,
        fromRef: from ? await refState(context.repoRoot, from) : 'missing',
        toRef: to ? await refState(context.repoRoot, to) : 'missing'
    };
    const diff = from && to ? await divergence(context.repoRoot, from, to) : null;
    const checkout = await checkoutState(context.repoRoot);
    const preconditions = {
        clean: checkout.clean,
        refsAvailable: state.fromRef !== 'missing' && state.toRef !== 'missing',
        divergenceKnown: diff !== null,
        safeToPrepare:
            allowed &&
            checkout.clean &&
            diff !== null &&
            state.fromRef !== 'missing' &&
            state.toRef !== 'missing'
    };
    const result = {
        kind,
        readOnly: !args.confirm,
        plan: args.plan,
        confirm: args.confirm,
        allowed,
        declaredPromotion,
        declaredBackMerge,
        ...state,
        checkout,
        divergence: diff,
        preconditions,
        actions:
            allowed && preconditions.safeToPrepare
                ? args.confirm
                    ? ['buscar PR abierto', 'crear PR si no existe', 'esperar aprobación humana']
                    : [
                          'comparar commits y checks',
                          'preparar PR de promoción',
                          'esperar aprobación humana'
                      ]
                : ['resolver precondiciones del plan', 'no crear PR ni ejecutar merge']
    };
    if (args.confirm && allowed && preconditions.safeToPrepare) {
        if (!from || !to) {
            const failure = {
                ...result,
                error: 'faltan ramas de origen o destino',
                mutations: 'none'
            };
            if (args.json) process.stdout.write(`${JSON.stringify(failure)}\n`);
            else process.stderr.write(`${pc.red('No se pudo crear el PR.')} ${failure.error}\n`);
            return 1;
        }
        try {
            const pullRequest = await createPromotionPr(context.repoRoot, kind, from, to);
            const applied = { ...result, pullRequest, mutations: 'pull_request_created_or_reused' };
            if (args.json) process.stdout.write(`${JSON.stringify(applied)}\n`);
            else
                process.stdout.write(
                    `${pc.green('PR LISTO')}  #${pullRequest.number} ${pullRequest.url}\n`
                );
            return 0;
        } catch (error) {
            const failure = {
                ...result,
                error: error instanceof Error ? error.message : String(error),
                mutations: 'none'
            };
            if (args.json) process.stdout.write(`${JSON.stringify(failure)}\n`);
            else process.stderr.write(`${pc.red('No se pudo crear el PR.')} ${failure.error}\n`);
            return 1;
        }
    }
    if (args.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else
        process.stdout.write(
            `${pc.bold(kind === 'promote' ? 'PLAN PROMOTE' : 'PLAN BACK-MERGE')}\n${JSON.stringify(result, null, 2)}\n`
        );
    return allowed ? 0 : 1;
}
