import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';
import { resolveRepoRoot } from '../../lib/repo.ts';
import { collectCode, collectPackages, scanWorkspace } from './collectors/code.ts';
import { collectDebt } from './collectors/debt.ts';
import { collectGit } from './collectors/git.ts';
import { collectI18n } from './collectors/i18n.ts';
import { collectLinear } from './collectors/linear.ts';
import { collectPrs } from './collectors/prs.ts';
import { collectRepo } from './collectors/repo.ts';
import { collectTests } from './collectors/tests.ts';
import { daysAgo } from './dates.ts';
import { run } from './exec.ts';
import * as history from './history.ts';
import { renderHelp } from './report/help.ts';
import {
    drawCode,
    drawDebt,
    drawGit,
    drawI18n,
    drawLinear,
    drawPackages,
    drawPrs,
    drawRepo,
    drawTests,
    heading,
    section
} from './report/render.ts';
import { collectDebtDetail, drawDebtDetail } from './reports/debt-detail.ts';
import { collectStalled, drawStalled } from './reports/linear-stalled.ts';
import { collectOpenPrs, drawOpenPrs } from './reports/prs-open.ts';
import { collectUntranslated, drawUntranslated } from './reports/untranslated.ts';
import {
    type Period,
    type PeriodSpec,
    REPORT_IDS,
    REPORTS,
    type Report,
    type ReportId,
    SECTION_IDS,
    SECTIONS,
    type SectionId
} from './types.ts';

const PERIODS: Readonly<Record<Period, { label: string; days: number | null }>> = {
    '1w': { label: 'última semana', days: 7 },
    '1m': { label: 'último mes', days: 30 },
    '3m': { label: 'últimos 3 meses', days: 90 },
    all: { label: 'toda la historia', days: null }
};

function periodSpec(id: Period): PeriodSpec {
    const { label, days } = PERIODS[id];
    return { id, label, since: days === null ? null : daysAgo(days) };
}

/** Resolve the repository root and the branch everything is measured against. */
async function resolveRepo(
    hint: string
): Promise<{ root: string; base: string; sha: string } | null> {
    const top = await run('git', ['rev-parse', '--show-toplevel'], { cwd: hint });
    if (!top.ok) return null;
    const root = top.stdout.trim();
    const sha = (await run('git', ['rev-parse', '--short', 'HEAD'], { cwd: root })).stdout.trim();
    for (const candidate of ['origin/staging', 'origin/main', 'origin/master', 'main', 'master']) {
        const found = await run('git', ['rev-parse', '--verify', '--quiet', candidate], {
            cwd: root
        });
        if (found.ok) return { root, base: candidate, sha };
    }
    return { root, base: 'HEAD', sha };
}

/**
 * Ask which sections to run.
 *
 * Shown whenever a terminal is attached. Without a TTY there is nothing to
 * prompt, so the caller's flags decide instead — a menu that blocks on a closed
 * stdin is how a tool hangs forever in a cron.
 */
type Choice =
    | { readonly kind: 'sections'; readonly ids: SectionId[] }
    | { readonly kind: 'report'; readonly id: ReportId };

async function chooseReport(): Promise<ReportId | null> {
    const picked = await p.select<ReportId>({
        message: '¿Qué informe?',
        options: REPORTS.map((r) => ({
            value: r.id,
            label: r.label,
            hint: `${r.hint}  ·  ${r.cost}${r.network ? ' · red' : ''}`
        }))
    });
    return p.isCancel(picked) ? null : picked;
}

async function chooseAction(): Promise<Choice | null> {
    p.intro(pc.bgCyan(pc.black(' hops-stats ')));
    // Reports are a separate view, not extra sections: they answer "what do I
    // pick up now" with named rows, where a section answers "how are we".
    for (;;) {
        const action = await p.select<'measure' | 'report' | 'help'>({
            message: '¿Qué hacés?',
            options: [
                { value: 'measure', label: 'Medir', hint: 'resumen; elegís qué secciones' },
                {
                    value: 'report',
                    label: 'Informe detallado',
                    hint: 'listas accionables de una categoría'
                },
                {
                    value: 'help',
                    label: 'Ver la ayuda',
                    hint: 'qué mide cada cosa y qué NO prueba cada número'
                }
            ],
            initialValue: 'measure'
        });
        if (p.isCancel(action)) {
            p.cancel('Cancelado.');
            return null;
        }
        if (action === 'help') {
            renderHelp();
            continue;
        }
        if (action === 'report') {
            const id = await chooseReport();
            if (id === null) continue;
            return { kind: 'report', id };
        }

        const picked = await p.multiselect<SectionId>({
            message: '¿Qué querés medir?',
            options: SECTIONS.map((section) => ({
                value: section.id,
                label: section.label,
                hint: `${section.hint}  ·  ${section.cost}${section.network ? ' · red' : ''}`
            })),
            initialValues: ['code', 'tests', 'debt'],
            required: true
        });
        if (p.isCancel(picked)) {
            p.cancel('Cancelado.');
            return null;
        }
        return { kind: 'sections', ids: picked };
    }
}

/** Run one detailed report. Reports print and exit; they are never logged. */
async function runReport(
    id: ReportId,
    repo: string,
    base: string,
    teams: readonly string[]
): Promise<void> {
    const spin =
        process.stdout.isTTY === true
            ? p.spinner()
            : { start: () => {}, message: () => {}, stop: () => {} };
    const meta = REPORTS.find((r) => r.id === id);
    spin.start(`${meta?.label ?? id}…`);

    const title = (text: string): void => {
        process.stdout.write(`\n${pc.bold(text)}\n${pc.dim('─'.repeat(74))}\n`);
    };
    const fail = (reason: string): void => {
        for (const line of reason.split('\n')) process.stdout.write(`  ${pc.dim(line)}\n`);
    };

    switch (id) {
        case 'worktrees': {
            const out = await collectRepo(repo, base);
            spin.stop('Listo.');
            title('WORKTREES');
            if (out.ok) drawRepo(out.data);
            else fail(out.reason);
            break;
        }
        case 'linear-stalled': {
            const out = await collectStalled(teams);
            spin.stop('Listo.');
            title(`TRABAJO ESTANCADO  (${teams.join(' + ')})`);
            if (out.ok) drawStalled(out.data);
            else fail(out.reason);
            break;
        }
        case 'i18n-untranslated': {
            const out = await collectUntranslated(repo);
            spin.stop('Listo.');
            title('TRADUCCIONES FALSAS');
            if (out.ok) drawUntranslated(out.data);
            else fail(out.reason);
            break;
        }
        case 'prs-open': {
            const out = await collectOpenPrs(repo);
            spin.stop('Listo.');
            title('PULL REQUESTS ABIERTOS');
            if (out.ok) drawOpenPrs(out.data);
            else fail(out.reason);
            break;
        }
        case 'debt-detail': {
            const out = await collectDebtDetail(repo);
            spin.stop('Listo.');
            title('DEUDA EN DETALLE');
            if (out.ok) drawDebtDetail(out.data);
            else fail(out.reason);
            break;
        }
    }
    process.stdout.write('\n');
}

/**
 * Runs `hops stats` (or the standalone `hops-stats` binary) end to end.
 *
 * Wraps the same commander program the tool used as a standalone script,
 * but returns the exit code instead of calling `process.exit` — a command
 * that owns the exit cannot be composed under the `hops` dispatcher (see
 * `ClientCommand` in `registry.ts`). `exitOverride()` is required for that
 * same reason: without it, commander answers a parse error (e.g. an unknown
 * flag) by calling `process.exit` itself, which would kill the whole `hops`
 * process instead of just this subcommand.
 *
 * @param input.argv - Arguments after `stats` (or after the binary name for
 *                      the standalone `hops-stats`).
 * @returns The exit code: 0 on success, 1 when the repo could not be
 *          resolved, 2 for an invalid `--period` or `--report` value.
 */
export async function runStats({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    let exitCode = 0;
    const program = new Command();
    program
        .name('hops-stats')
        .description('Estadísticas de código y de trabajo del monorepo')
        .argument('[repo]', 'ruta del repositorio')
        .option('-s, --section <ids...>', `secciones: ${SECTION_IDS.join(', ')}`)
        .option('-a, --all', 'todas las secciones')
        .option('--quick', 'código, tests y deuda')
        .option('--work', 'git, PRs y Linear')
        .option('--offline', 'todo lo que no necesita red')
        .option('-p, --period <id>', 'período: 1w | 1m | 3m | all', '1m')
        .option('-t, --team <keys...>', 'equipos de Linear (default: HOS y BETA)')
        .option('-d, --diff', 'comparar contra la corrida anterior')
        .option('--no-log', 'no registrar esta corrida en el historial')
        .option('-r, --report <id>', `informe detallado: ${REPORT_IDS.join(', ')}`)
        .option('--json', 'emitir el registro plano en vez del reporte')
        .helpOption(false)
        .option('-h, --help', 'mostrar esta ayuda')
        .exitOverride()
        .action(async (repoArg: string | undefined, opts) => {
            if (opts.help === true) {
                renderHelp();
                return;
            }
            // No positional path: fall back to the shared repo-root resolver so
            // `hops stats` (no args) behaves the same as every other `hops`
            // command run from anywhere inside the repo, instead of defaulting to
            // the literal process.cwd() the standalone script used.
            const repoHint = repoArg ?? (await resolveRepoRoot({ cwd: process.cwd() }));
            const resolved = await resolveRepo(repoHint);
            if (resolved === null) {
                process.stderr.write(pc.red(`no es un repositorio git: ${repoHint}\n`));
                exitCode = 1;
                return;
            }

            // Specs live in HOS and user-reported bugs in BETA. Reading only one of
            // them gives a backlog balance that ignores half the intake.
            const teams: string[] =
                Array.isArray(opts.team) && opts.team.length > 0
                    ? (opts.team as string[]).map((t) => t.toUpperCase())
                    : ['HOS', 'BETA'];

            const period = periodSpec((opts.period as Period) ?? '1m');
            if (!(period.id in PERIODS)) {
                process.stderr.write(pc.red(`período inválido: ${opts.period}\n`));
                exitCode = 2;
                return;
            }

            // A report is a separate view: it prints and returns, without touching
            // the section pipeline or the history log.
            if (typeof opts.report === 'string') {
                const id = opts.report as ReportId;
                if (!(REPORT_IDS as readonly string[]).includes(id)) {
                    process.stderr.write(pc.red(`informe desconocido: ${opts.report}\n`));
                    process.stderr.write(pc.dim(`  disponibles: ${REPORT_IDS.join(', ')}\n`));
                    exitCode = 2;
                    return;
                }
                await runReport(id, resolved.root, resolved.base, teams);
                return;
            }

            let sections: SectionId[] = [];
            if (opts.all === true) sections = [...SECTION_IDS];
            else if (opts.quick === true) sections = ['code', 'tests', 'debt'];
            else if (opts.work === true) sections = ['git', 'prs', 'linear'];
            else if (opts.offline === true)
                sections = SECTIONS.filter((s) => !s.network).map((s) => s.id);
            else if (Array.isArray(opts.section)) {
                sections = (opts.section as string[]).filter((id): id is SectionId =>
                    (SECTION_IDS as readonly string[]).includes(id)
                );
            }

            if (sections.length === 0) {
                if (process.stdin.isTTY) {
                    const choice = await chooseAction();
                    if (choice === null) return;
                    if (choice.kind === 'report') {
                        await runReport(choice.id, resolved.root, resolved.base, teams);
                        return;
                    }
                    sections = choice.ids;
                } else {
                    process.stderr.write(
                        pc.dim(
                            'sin terminal interactiva — usando código, tests y deuda; pasá --section para elegir\n'
                        )
                    );
                    sections = ['code', 'tests', 'debt'];
                }
            }

            const wants = (id: SectionId): boolean => sections.includes(id);
            // Clack's spinner writes cursor and redraw escapes unconditionally. Piped
            // into a file or another program those become line noise around the data,
            // so progress is only drawn when something can actually animate it.
            const spin =
                process.stdout.isTTY === true
                    ? p.spinner()
                    : { start: () => {}, message: () => {}, stop: () => {} };
            const report: Record<string, unknown> = {
                repoName: resolved.root.slice(resolved.root.lastIndexOf('/') + 1),
                repoPath: resolved.root,
                sha: resolved.sha,
                at: new Date().toISOString(),
                period
            };

            spin.start('Midiendo…');
            const needsWorkspace = wants('code') || wants('packages');
            if (needsWorkspace) {
                spin.message('Leyendo archivos del repositorio…');
                const ws = await scanWorkspace(resolved.root);
                if (ws.ok) {
                    if (wants('code')) report['code'] = { ok: true, data: collectCode(ws.data) };
                    if (wants('packages')) {
                        spin.message('Contando tests por paquete…');
                        const scan = await collectTests(resolved.root);
                        const cases = scan.ok
                            ? scan.data.casesByPackage
                            : new Map<string, number>();
                        report['packages'] = { ok: true, data: collectPackages(ws.data, cases) };
                    }
                } else {
                    report['code'] = ws;
                    report['packages'] = ws;
                }
            }
            if (wants('tests')) {
                spin.message('Contando casos de test…');
                const scan = await collectTests(resolved.root);
                report['tests'] = scan.ok ? { ok: true, data: scan.data.stats } : scan;
            }
            if (wants('debt')) {
                spin.message('Buscando deuda técnica y fechando TODOs…');
                report['debt'] = await collectDebt(resolved.root);
            }
            if (wants('i18n')) {
                spin.message('Comparando traducciones…');
                report['i18n'] = await collectI18n(resolved.root);
            }
            if (wants('git')) {
                spin.message('Leyendo el historial de commits…');
                report['git'] = await collectGit(resolved.root, resolved.base, period);
            }
            if (wants('prs')) {
                spin.message('Consultando pull requests en GitHub…');
                report['prs'] = await collectPrs(resolved.root, resolved.base, period);
            }
            if (wants('linear')) {
                spin.message('Consultando issues en Linear…');
                report['linear'] = await collectLinear(teams, period);
            }
            spin.stop('Listo.');

            const final = report as unknown as Report;
            const record = history.toRecord(final);

            if (opts.json === true) {
                process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
                return;
            }

            const before = opts.diff === true ? await history.previous() : null;

            process.stdout.write(
                `\n${pc.bold('ESTADÍSTICAS')}  ·  ${final.repoName}  ·  ${final.sha}  ·  ` +
                    `${new Date().toLocaleString('es-AR')}  ·  ${period.label}\n`
            );

            section('CÓDIGO', final.code, drawCode);
            section('TESTS  (conteo estático — declarados, no ejecutados)', final.tests, drawTests);
            section('DEUDA TÉCNICA', final.debt, drawDebt);
            section('POR PAQUETE', final.packages, drawPackages);
            section('TRADUCCIONES', final.i18n, drawI18n);
            section(`COMMITS  (${period.label})`, final.git, drawGit);
            section(`PULL REQUESTS  (${period.label})`, final.prs, drawPrs);
            section(`ISSUES DE LINEAR  (${teams.join(' + ')})`, final.linear, drawLinear);

            if (opts.diff === true) {
                heading('DELTA vs la corrida anterior');
                if (before === null) {
                    process.stdout.write(
                        `  ${pc.dim('sin historial previo — esta es la primera corrida')}\n`
                    );
                } else {
                    const rows = history.diff(before, record);
                    if (rows.length === 0) {
                        process.stdout.write(
                            `  ${pc.dim('sin cambios en las métricas comparadas')}\n`
                        );
                    } else {
                        process.stdout.write(
                            `  ${pc.dim(`comparando contra ${before['ts']}`)}\n\n`
                        );
                        for (const r of rows) {
                            const delta =
                                r.delta > 0 ? pc.yellow(`+${r.delta}`) : pc.green(String(r.delta));
                            process.stdout.write(
                                `  ${r.key.padEnd(22)}${String(r.before).padStart(9)} → ${String(r.after).padEnd(9)} ${delta}\n`
                            );
                        }
                    }
                }
            }

            if (opts.log !== false) {
                await history.append(record);
                process.stdout.write(`\n${pc.dim(`registrado en ${history.LOG_PATH}`)}\n`);
            }
            process.stdout.write('\n');
        });

    try {
        await program.parseAsync(argv, { from: 'user' });
    } catch {
        // exitOverride() turns a commander parse failure (e.g. an unknown
        // flag) into a thrown CommanderError instead of a process.exit call.
        // The exact code does not matter here — what matters is that it never
        // reaches 0, which would report the failed parse as a success.
        return 1;
    }
    return exitCode;
}
