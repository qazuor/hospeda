import pc from 'picocolors';
import {
    type CodeStats,
    type Counted,
    type DebtStats,
    type GitStats,
    type I18nStats,
    type LanguageBreakdown,
    type LinearStats,
    type Outcome,
    type PackageStats,
    type PrStats,
    type RepoStats,
    STALE_DAYS,
    type TestStats,
    type Windowed,
    type WorktreeState
} from '../types.ts';

const WIDTH = 74;

const num = (value: number): string => value.toLocaleString('es-AR');
const gb = (mb: number): string => `${(mb / 1024).toFixed(1)} GB`;

export function heading(title: string): void {
    process.stdout.write(`\n${pc.bold(title)}\n${pc.dim('─'.repeat(WIDTH))}\n`);
}

export function row(label: string, value: string): void {
    process.stdout.write(`  ${label.padEnd(34)}${value}\n`);
}

function note(text: string): void {
    for (const line of text.split('\n')) process.stdout.write(`  ${pc.dim(line)}\n`);
}

/** Header for the three-window columns, printed once per table. */
function windowHeader(label: string): void {
    process.stdout.write(
        `  ${label.padEnd(28)}${'SEMANA'.padStart(10)}${'MES'.padStart(10)}${'TOTAL'.padStart(12)}\n`
    );
}

function windowRow(label: string, w: Windowed): void {
    process.stdout.write(
        `  ${label.padEnd(28)}${num(w.week).padStart(10)}${num(w.month).padStart(10)}${num(w.total).padStart(12)}\n`
    );
}

function languages(rows: readonly LanguageBreakdown[], total: number): void {
    for (const lang of rows) {
        const share = total === 0 ? 0 : Math.round((100 * lang.loc) / total);
        process.stdout.write(
            `    ${lang.language.padEnd(20)}${num(lang.loc).padStart(12)}` +
                `${`${share}%`.padStart(6)}${`${num(lang.files)} arch.`.padStart(14)}\n`
        );
    }
}

/**
 * Render a section, or the reason it produced nothing.
 *
 * A failed section prints why it failed. It never falls back to zeros — a
 * formatted zero is the most believable wrong answer a report can give.
 */
export function section<T>(
    title: string,
    outcome: Outcome<T> | undefined,
    draw: (data: T) => void
): void {
    if (outcome === undefined) return;
    heading(title);
    if (!outcome.ok) {
        note(outcome.reason);
        return;
    }
    draw(outcome.data);
}

export function drawCode(s: CodeStats): void {
    row('Archivos trackeados', num(s.trackedFiles));
    process.stdout.write('\n');
    row(pc.bold('Código fuente'), pc.bold(`${num(s.srcLoc)} LOC en ${num(s.srcFiles)} archivos`));
    languages(s.srcByLanguage, s.srcLoc);
    process.stdout.write('\n');
    row(pc.bold('Tests'), pc.bold(`${num(s.testLoc)} LOC en ${num(s.testFiles)} archivos`));
    languages(s.testByLanguage, s.testLoc);
    process.stdout.write('\n');
    row('Ratio test/fuente', `${(s.srcLoc === 0 ? 0 : s.testLoc / s.srcLoc).toFixed(2)}×`);
    row('Datos (.json)', `${num(s.jsonLoc)} LOC en ${num(s.jsonFiles)} archivos`);
    row('Documentación (.md)', `${num(s.mdLoc)} LOC en ${num(s.mdFiles)} archivos`);
    row('SQL', `${num(s.sqlLoc)} LOC en ${num(s.sqlFiles)} archivos`);
    note('El total crudo no significa nada: cada cifra nombra su bucket.');
}

export function drawTests(s: TestStats): void {
    row('Suites describe()', num(s.suites));
    row('Casos it()/test()', num(s.cases));
    for (const [kind, data] of Object.entries(s.byKind)) {
        process.stdout.write(
            `    ${kind.padEnd(20)}${num(data.cases).padStart(12)}${`${num(data.files)} arch.`.padStart(14)}\n`
        );
    }
    row('Aserciones expect()', num(s.assertions));
    row('  por caso', (s.cases === 0 ? 0 : s.assertions / s.cases).toFixed(1));
    row('Bloques .each', `${num(s.parameterised)}  ${pc.yellow('← cada uno expande a N tests')}`);
    row('.skip / .todo (duros)', s.hardSkips === 0 ? pc.green('0') : pc.yellow(num(s.hardSkips)));
    row('.skipIf (condicional)', num(s.conditionalSkips));
    note(
        'Conteo estático: no prueba que ninguno corra ni pase, y SUBESTIMA,\nporque los bloques .each se expanden en tiempo de ejecución.'
    );

    process.stdout.write('\n');
    row('Archivos en <pkg>/test/', pc.green(`${num(s.filesInPolicy)}  ← cumplen la política`));
    row('Exentos (docs, integraciones)', num(s.filesExempt));
    if (s.misplacedTotal === 0) {
        row('Fuera de política', pc.green('0'));
        return;
    }
    row('Fuera de política', pc.yellow(`${num(s.misplacedTotal)}  ← habría que migrarlos`));

    heading(`A MIGRAR A <pkg>/test/  ·  ${s.misplacedTotal} archivos`);
    for (const group of s.misplaced) {
        process.stdout.write(
            `\n  ${pc.yellow(LOCATION_LABEL[group.location])}  ·  ${group.files.length}\n`
        );
        // Grouping by directory keeps a 291-file list readable: what matters is
        // which directories to move, not each filename.
        const byDir = new Map<string, number>();
        for (const file of group.files) {
            const dir = file.slice(0, file.lastIndexOf('/'));
            byDir.set(dir, (byDir.get(dir) ?? 0) + 1);
        }
        const dirs = [...byDir.entries()].sort((a, b) => b[1] - a[1]);
        for (const [dir, count] of dirs.slice(0, 12)) {
            process.stdout.write(`    ${String(count).padStart(4)}  ${pc.dim(dir)}\n`);
        }
        if (dirs.length > 12) {
            process.stdout.write(`    ${pc.dim(`… y ${dirs.length - 12} directorios más`)}\n`);
        }
    }
    note(
        'Los tests mal ubicados SÍ se cuentan arriba: un test fuera de lugar\nsigue siendo un test. Esta lista es deuda de convención, no de cobertura.'
    );
}

export function drawDebt(s: DebtStats): void {
    for (const key of [
        'TODO',
        'FIXME',
        'HACK',
        'XXX',
        '@ts-expect-error',
        '@ts-ignore',
        'biome-ignore'
    ]) {
        const count = s.annotations[key];
        if (count === undefined) continue;
        row(key, num(count));
    }
    row('`: any` en código propio', num(s.explicitAny));
    for (const entry of s.anyTop) {
        process.stdout.write(`    ${String(entry.count).padStart(6)}  ${pc.dim(entry.path)}\n`);
    }
    note(
        'Excluye generados, .d.ts y tests: más de la mitad de los hits crudos\nviven en routeTree.gen.ts, que no lo escribió nadie.'
    );

    if (s.todoOldestDays > 0) {
        process.stdout.write('\n');
        row('TODO más viejo', `${s.todoOldestDays} días`);
        row('  mediana', `${s.todoMedianDays} días`);
    }

    if (s.stale.length === 0) {
        process.stdout.write(
            `\n  ${pc.green(`Ningún FIXME/HACK ni TODO de más de ${STALE_DAYS} días.`)}\n`
        );
        return;
    }

    heading(`A REVISAR  ·  ${s.staleCount} anotaciones`);
    note(`Todos los FIXME y HACK, más los TODO de más de ${STALE_DAYS} días (6 meses).`);
    process.stdout.write('\n');
    for (const a of s.stale.slice(0, 25)) {
        const age = a.ageDays < 0 ? '   ?' : `${a.ageDays}d`;
        const tag = a.kind === 'TODO' ? pc.yellow(a.kind) : pc.red(a.kind);
        process.stdout.write(`  ${tag.padEnd(16)}${age.padStart(6)}  ${a.path}:${a.line}\n`);
        if (a.text.length > 0) process.stdout.write(`  ${' '.repeat(22)}${pc.dim(a.text)}\n`);
    }
    if (s.stale.length > 25) {
        process.stdout.write(`  ${pc.dim(`… y ${s.stale.length - 25} más`)}\n`);
    }
}

const LOCATION_LABEL: Readonly<Record<string, string>> = {
    __tests__: 'en __tests__/',
    'tests-plural': 'en <pkg>/tests/  (plural)',
    'beside-code': 'junto al código, dentro de src/'
};

/** Translation coverage against the default locale. */
export function drawI18n(s: I18nStats): void {
    row('Idiomas', `${s.locales.join(', ')}   (referencia: ${s.reference})`);
    row('Namespaces', num(s.namespaces));
    row(`Claves en '${s.reference}'`, num(s.totalKeys));

    const others = s.locales.filter((l) => l !== s.reference);
    process.stdout.write('\n');
    process.stdout.write(
        `  ${'IDIOMA'.padEnd(14)}${'FALTAN'.padStart(10)}${'OBSOLETAS'.padStart(12)}${'COMPLETO'.padStart(12)}\n`
    );
    const paint = (value: number, width: number, good = 0): string => {
        const text = num(value).padStart(width);
        return value === good ? pc.green(text) : pc.yellow(text);
    };
    for (const locale of others) {
        const missing = s.missingByLocale[locale] ?? 0;
        const extra = s.extraByLocale[locale] ?? 0;
        const pct =
            s.totalKeys === 0 ? 100 : Math.round((100 * (s.totalKeys - missing)) / s.totalKeys);
        const pctText = `${pct}%`.padStart(12);
        process.stdout.write(
            `  ${locale.padEnd(14)}${paint(missing, 10)}${paint(extra, 12)}` +
                `${pct === 100 ? pc.green(pctText) : pc.yellow(pctText)}\n`
        );
    }

    const incomplete = s.byNamespace.filter((ns) =>
        others.some((l) => (ns.missing[l] ?? 0) > 0 || (ns.extra[l] ?? 0) > 0)
    );

    if (incomplete.length === 0) {
        process.stdout.write(
            `\n  ${pc.green('Todos los namespaces están completos y sin claves obsoletas.')}\n`
        );
    } else {
        heading(`NAMESPACES CON DIFERENCIAS  ·  ${incomplete.length} de ${s.namespaces}`);
        process.stdout.write(`  ${'NAMESPACE'.padEnd(24)}${'CLAVES'.padStart(9)}`);
        for (const l of others)
            process.stdout.write(`${`${l} falta`.padStart(11)}${`${l} sobra`.padStart(11)}`);
        process.stdout.write('\n');
        for (const ns of incomplete.slice(0, 20)) {
            process.stdout.write(
                `  ${ns.namespace.slice(0, 23).padEnd(24)}${num(ns.keys).padStart(9)}`
            );
            for (const l of others) {
                const m = ns.missing[l] ?? 0;
                const e = ns.extra[l] ?? 0;
                const cell = (v: number): string =>
                    v === 0 ? pc.dim('·'.padStart(11)) : pc.yellow(String(v).padStart(11));
                process.stdout.write(`${cell(m)}${cell(e)}`);
            }
            process.stdout.write('\n');
        }
        if (incomplete.length > 20) {
            process.stdout.write(`  ${pc.dim(`… y ${incomplete.length - 20} namespaces más`)}\n`);
        }
    }

    if (s.orphanNamespaces.length > 0) {
        heading('NAMESPACES HUÉRFANOS');
        for (const o of s.orphanNamespaces) process.stdout.write(`    ${pc.yellow(o)}\n`);
        note(`Existen en una traducción pero no en '${s.reference}': nada los va a cargar.`);
    }

    note(
        `Se cuentan claves HOJA contra '${s.reference}'. «Faltan» es una clave que el\n` +
            'usuario va a ver sin traducir; «obsoletas» es peso muerto de un rename.\n' +
            'Que la clave exista NO significa que esté traducida: puede tener el texto\n' +
            'en español copiado tal cual.'
    );
}

export function drawPackages(packages: readonly PackageStats[]): void {
    process.stdout.write(
        `  ${'PAQUETE'.padEnd(22)}${'SRC LOC'.padStart(11)}${'TEST LOC'.padStart(11)}` +
            `${'CASOS'.padStart(9)}${'RATIO'.padStart(9)}${'SIN TEST'.padStart(12)}\n`
    );
    process.stdout.write(`  ${pc.dim('─'.repeat(WIDTH - 2))}\n`);
    for (const p of packages) {
        const ratio = p.srcLoc === 0 ? 0 : p.testLoc / p.srcLoc;
        const pct =
            p.total === 0 ? '—' : `${p.untested} · ${Math.round((100 * p.untested) / p.total)}%`;
        process.stdout.write(
            `  ${p.name.replace(/^(apps|packages)\//, '').padEnd(22)}` +
                `${num(p.srcLoc).padStart(11)}${num(p.testLoc).padStart(11)}` +
                `${num(p.cases).padStart(9)}${`${ratio.toFixed(2)}×`.padStart(9)}` +
                `${pct.padStart(12)}\n`
        );
    }
    note(
        '«Sin test» cuenta .ts/.tsx/.astro bajo src/ y empareja por NOMBRE de archivo,\n' +
            'porque los tests viven en test/. Que el nombre exista no prueba que ese test\n' +
            'cubra el archivo, y una página .astro suele cubrirse por e2e, no por unit.'
    );
}

export function drawGit(s: GitStats): void {
    windowHeader('');
    windowRow('Commits', s.commits);
    windowRow('Migraciones nuevas', s.migrations);
    windowRow('Specs nuevas', s.specs);
    process.stdout.write('\n');
    row('Autores distintos (período)', String(s.authors));
    if (s.types.length > 0) {
        process.stdout.write('\n  Tipos de commit (período):\n');
        for (const t of s.types)
            process.stdout.write(`    ${String(t.count).padStart(6)}  ${t.type}\n`);
    }
    if (s.churn.length > 0) {
        process.stdout.write(
            `\n  Más tocados ${pc.dim('(sin lockfiles ni metadatos de task-master)')}:\n`
        );
        for (const c of s.churn)
            process.stdout.write(`    ${String(c.count).padStart(6)}  ${pc.dim(c.path)}\n`);
    }
}

export function drawPrs(s: PrStats): void {
    windowHeader('');
    windowRow('PRs mergeados', s.merged);
    windowRow('Reverts', s.reverts);
    process.stdout.write('\n');
    row('Abiertos ahora', num(s.open));
    row('Lead time · mediana', `${s.leadMedianH.toFixed(1)} h`);
    row('Lead time · p90', `${s.leadP90H.toFixed(1)} h`);
    row('Lead time · máximo', `${s.leadMaxH.toFixed(1)} h`);
    row('Tamaño mediano', `${num(s.sizeMedian)} líneas`);
    if (s.biggest.length > 0) {
        process.stdout.write('\n  Los más grandes del período:\n');
        for (const pr of s.biggest) {
            process.stdout.write(
                `    #${pr.number}  ${num(pr.lines).padStart(8)} líneas  ${pc.dim(pr.title.slice(0, 48))}\n`
            );
        }
    }
    process.stdout.write('\n');
    row('PRs que tocaron código', num(s.withTests + s.withoutTests));
    row('  con tests', pc.green(num(s.withTests)));
    row('  SIN tests', s.withoutTests === 0 ? pc.green('0') : pc.yellow(num(s.withoutTests)));
    row('PRs sin código (docs…)', num(s.noCode));
    if (s.untested.length > 0) {
        process.stdout.write('\n  Tocaron código sin tocar un test:\n');
        for (const pr of s.untested) {
            const id = pr.number === null ? '     —' : `#${pr.number}`.padStart(6);
            process.stdout.write(`    ${id}  ${pr.from}\n`);
        }
    }
    note(
        'Agrupado por merge commit (el PR entero), no por commit suelto.\nLead time y tamaño salen de GitHub para el período; las columnas de\nsemana/mes/total se cuentan sobre los merges locales.'
    );
}

export function drawLinear(s: LinearStats): void {
    const teams = s.teams.map((t) => t.team);
    const split = teams.length > 1;

    /** A `TOTAL | HOS | BETA` row. The per-team columns vanish with one team. */
    const counted = (rows: readonly Counted[], labelWidth = 26): void => {
        process.stdout.write(`  ${''.padEnd(labelWidth)}${'TOTAL'.padStart(8)}`);
        if (split) for (const t of teams) process.stdout.write(t.padStart(8));
        process.stdout.write('\n');
        for (const r of rows) {
            process.stdout.write(
                `  ${r.name.slice(0, labelWidth - 2).padEnd(labelWidth)}${num(r.total).padStart(8)}`
            );
            if (split) {
                for (const t of teams) {
                    const v = r.byTeam[t] ?? 0;
                    process.stdout.write(v === 0 ? pc.dim('·'.padStart(8)) : num(v).padStart(8));
                }
            }
            process.stdout.write('\n');
        }
    };

    if (split) {
        process.stdout.write(
            `  ${'EQUIPO'.padEnd(14)}${'TOTAL'.padStart(10)}${'ABIERTOS'.padStart(11)}` +
                `${'EN CURSO'.padStart(11)}${'SMOKE'.padStart(9)}\n`
        );
        for (const t of s.teams) {
            process.stdout.write(
                `  ${t.team.padEnd(14)}${num(t.total).padStart(10)}${num(t.open).padStart(11)}` +
                    `${num(t.started).padStart(11)}${num(t.smoke).padStart(9)}\n`
            );
        }
        process.stdout.write(`  ${pc.dim('─'.repeat(WIDTH - 2))}\n`);
    }
    row('Total', num(s.total));
    row('Abiertos', num(s.open));
    row('  en curso', num(s.started));
    row('Cerrados (histórico)', num(s.done));
    row('Creados en el período', num(s.createdInPeriod));
    row('Cerrados en el período', num(s.closedInPeriod));

    heading('BALANCE DEL BACKLOG  (últimas 8 semanas)');
    const teamCols = split ? teams.map((t) => t.slice(0, 4)) : [];
    process.stdout.write(`  ${''.padEnd(16)}${'CREADOS'.padStart(9)}`);
    for (const t of teamCols) process.stdout.write(t.padStart(7));
    process.stdout.write(`${'CERRADOS'.padStart(11)}`);
    for (const t of teamCols) process.stdout.write(t.padStart(7));
    process.stdout.write(`${'BALANCE'.padStart(10)}\n`);

    let created = 0;
    let closed = 0;
    for (const w of s.balance) {
        created += w.created;
        closed += w.closed;
        const delta = w.created - w.closed;
        const shown = (delta > 0 ? `+${delta}` : String(delta)).padStart(10);
        process.stdout.write(`  ${w.week.padEnd(16)}${String(w.created).padStart(9)}`);
        for (const t of teams) {
            const v = w.createdByTeam[t] ?? 0;
            process.stdout.write(v === 0 ? pc.dim('·'.padStart(7)) : String(v).padStart(7));
        }
        process.stdout.write(String(w.closed).padStart(11));
        for (const t of teams) {
            const v = w.closedByTeam[t] ?? 0;
            process.stdout.write(v === 0 ? pc.dim('·'.padStart(7)) : String(v).padStart(7));
        }
        process.stdout.write(`${delta > 0 ? pc.yellow(shown) : pc.green(shown)}\n`);
    }
    const net = created - closed;
    process.stdout.write(`  ${pc.dim('─'.repeat(WIDTH - 2))}\n`);
    process.stdout.write(
        `  ${pc.bold('TOTAL'.padEnd(16))}${pc.bold(String(created).padStart(9))}` +
            `${''.padEnd(teamCols.length * 7)}${pc.bold(String(closed).padStart(11))}` +
            `${''.padEnd(teamCols.length * 7)}` +
            `${pc.bold((net > 0 ? `+${net}` : String(net)).padStart(10))}\n`
    );
    process.stdout.write(
        net > 0
            ? `  ${pc.yellow('El backlog CRECE: se abren más de los que se cierran.')}\n`
            : `  ${pc.green('El backlog BAJA: se cierran más de los que se abren.')}\n`
    );

    heading('ABIERTOS POR PRIORIDAD');
    counted(s.byPriority, 20);

    heading('ABIERTOS POR ÁREA');
    counted(s.byArea, 20);

    heading('DEUDA DE SMOKE');
    counted(s.smokeByLabel, 30);
    process.stdout.write(`  ${pc.dim('─'.repeat(WIDTH - 2))}\n`);
    row('Issues esperando verificación', pc.bold(num(s.smokeTotal)));
    if (s.smokeOldest !== null) {
        const o = s.smokeOldest;
        process.stdout.write(`\n  El más viejo espera hace ${pc.bold(`${o.days} días`)}:\n`);
        process.stdout.write(`    ${pc.yellow(o.identifier)}  ${o.title.slice(0, 60)}\n`);
        process.stdout.write(`    ${pc.dim(o.labels.join(', '))}\n`);
    }
    if (s.cycleMedianDays > 0) {
        process.stdout.write('\n');
        row('Cycle time (mediana)', `${s.cycleMedianDays} días`);
    }
}

const STATE_LABEL: Readonly<Record<WorktreeState, string>> = {
    uncommitted: 'CON TRABAJO SIN COMMITEAR',
    unmerged: 'CON COMMITS SIN MERGEAR',
    merged: 'TERMINADOS — se pueden borrar',
    missing: 'ROTOS — el directorio no existe'
};

const STATE_COLOR: Readonly<Record<WorktreeState, (text: string) => string>> = {
    uncommitted: pc.red,
    unmerged: pc.yellow,
    merged: pc.green,
    missing: pc.dim
};

export function drawRepo(s: RepoStats): void {
    row('Worktrees', String(s.worktrees.length));
    row(
        'Ocupan',
        `${gb(s.totalMb)}  (promedio ${Math.round(s.totalMb / Math.max(s.worktrees.length, 1))} MB)`
    );
    row('Directorio .git', gb(s.gitMb));
    if (s.reclaimableMb > 0) {
        row('Recuperable', pc.green(`${gb(s.reclaimableMb)} en worktrees ya terminados`));
    }

    for (const state of ['uncommitted', 'unmerged', 'merged', 'missing'] as const) {
        const group = s.worktrees.filter((w) => w.state === state);
        if (group.length === 0) continue;
        const deletable = group.filter((w) => !w.isMain).length;
        const suffix =
            state === 'merged' && deletable !== group.length
                ? `  ·  ${deletable} borrables (+ el clon principal)`
                : `  ·  ${group.length}`;
        heading(`${STATE_COLOR[state](STATE_LABEL[state])}${suffix}`);
        for (const w of group) {
            const size = w.mb > 0 ? gb(w.mb).padStart(8) : '       —';
            const marks: string[] = [];
            if (w.dirty > 0) marks.push(pc.red(`${w.dirty} sin commitear`));
            if (w.ahead > 0) marks.push(pc.yellow(`${w.ahead} commits`));
            if (w.unpushed === null && w.ahead > 0) marks.push(pc.red('nunca pusheado'));
            else if (w.unpushed !== null && w.unpushed > 0)
                marks.push(pc.yellow(`${w.unpushed} sin pushear`));
            if (w.isMain) marks.push(pc.cyan('[clon principal]'));

            // Directory name first: it is what `wt:remove` and `cd` take.
            process.stdout.write(
                `  ${size}  ${pc.bold(w.name.slice(0, 44).padEnd(46))}${marks.join('  ')}\n`
            );

            // A recycled worktree keeps the directory name of whatever it was
            // created for. When the two disagree the branch is the truth, so the
            // mismatch is called out rather than left for the reader to spot.
            const nameId = /\b([a-z]+-\d+)\b/i.exec(w.name)?.[1]?.toUpperCase();
            const branchId = /\b([a-z]+-\d+)\b/i.exec(w.branch)?.[1]?.toUpperCase();
            const mismatch = nameId !== undefined && branchId !== undefined && nameId !== branchId;
            const branchLine = `${w.branch}${mismatch ? pc.yellow(`   ← el directorio dice ${nameId}`) : ''}`;
            process.stdout.write(`  ${' '.repeat(10)}${pc.dim('branch: ')}${branchLine}\n`);
            process.stdout.write(`  ${' '.repeat(10)}${pc.dim(w.lastCommit)}\n`);
        }
        const subtotal = group.reduce((sum, w) => sum + w.mb, 0);
        process.stdout.write(`  ${pc.dim('─'.repeat(WIDTH - 2))}\n`);
        process.stdout.write(
            `  ${pc.bold(gb(subtotal).padStart(8))}  ${pc.bold(`TOTAL · ${group.length} worktree${group.length === 1 ? '' : 's'}`)}` +
                `${state === 'merged' && deletable > 0 ? pc.green(`   ${gb(group.filter((w) => !w.isMain).reduce((sum, w) => sum + w.mb, 0))} recuperables`) : ''}\n`
        );
    }
    note(
        '«Terminados» = sin commits propios sobre la base y sin cambios locales:\n' +
            'lo que había ya está mergeado. El clon principal aparece marcado y NO se\n' +
            'borra. Verificá con `git log` antes de borrar: esto se decide con estado\n' +
            'local, sin consultar el estado del PR.'
    );
}
