import pc from 'picocolors';
import { countLines, listTracked } from '../collectors/files.ts';
import { run } from '../exec.ts';
import type { Outcome } from '../types.ts';

const SOURCE_GLOBS = ['-g', '*.ts', '-g', '*.tsx', '-g', '*.astro'];

export type IgnoreRule = { readonly rule: string; readonly count: number };

export type DebtDetail = {
    readonly biomeByRule: readonly IgnoreRule[];
    readonly biomeTotal: number;
    readonly biomeUnattributed: number;
    readonly anyByFile: readonly { readonly path: string; readonly count: number }[];
    readonly anyTotal: number;
    readonly hugeFiles: readonly { readonly path: string; readonly loc: number }[];
};

/**
 * Which lint rule gets suppressed, not just how many suppressions exist.
 *
 * 582 scattered ignores and 582 ignores of one rule are different problems: the
 * second is a rule the project is not actually following, which is a decision to
 * revisit rather than debt to pay file by file.
 */
async function biomeByRule(
    repo: string
): Promise<{ rules: IgnoreRule[]; total: number; unattributed: number } | null> {
    const result = await run(
        'rg',
        [
            '-o',
            '--no-messages',
            '-e',
            'biome-ignore\\s+([a-z0-9]+(?:/[a-zA-Z0-9]+)+)',
            '-r',
            '$1',
            ...SOURCE_GLOBS,
            '-g',
            '!**/dist/**',
            '--',
            '.'
        ],
        { cwd: repo, okCodes: [1], timeoutMs: 120_000 }
    );
    if (!result.ok) return null;

    const counts = new Map<string, number>();
    let attributed = 0;
    for (const line of result.stdout.split('\n')) {
        const rule = line.slice(line.lastIndexOf(':') + 1).trim();
        if (rule.length === 0) continue;
        counts.set(rule, (counts.get(rule) ?? 0) + 1);
        attributed += 1;
    }

    const all = await run(
        'rg',
        [
            '-o',
            '--no-messages',
            '-e',
            'biome-ignore',
            ...SOURCE_GLOBS,
            '-g',
            '!**/dist/**',
            '--',
            '.'
        ],
        { cwd: repo, okCodes: [1], timeoutMs: 120_000 }
    );
    const total = all.ok
        ? all.stdout.split('\n').filter((l) => l.trim().length > 0).length
        : attributed;

    return {
        rules: [...counts.entries()]
            .map(([rule, count]) => ({ rule, count }))
            .sort((a, b) => b.count - a.count),
        total,
        unattributed: Math.max(0, total - attributed)
    };
}

export async function collectDebtDetail(repo: string): Promise<Outcome<DebtDetail>> {
    const biome = await biomeByRule(repo);
    if (biome === null) return { ok: false, reason: 'ripgrep falló al leer los biome-ignore' };

    const anyResult = await run(
        'rg',
        [
            '-c',
            '--no-messages',
            '-e',
            ':\\s*any\\b',
            '-e',
            '<any>',
            '-e',
            '\\bas any\\b',
            ...SOURCE_GLOBS,
            '-g',
            '!**/*.test.*',
            '-g',
            '!**/*.spec.*',
            '-g',
            '!**/*.d.ts',
            '-g',
            '!**/*.gen.ts',
            '-g',
            '!**/*.gen.tsx',
            '-g',
            '!**/generated/**',
            '-g',
            '!**/test/**',
            '-g',
            '!**/tests/**',
            '-g',
            '!**/e2e/**',
            '--',
            '.'
        ],
        { cwd: repo, okCodes: [1], timeoutMs: 120_000 }
    );
    const anyByFile: { path: string; count: number }[] = [];
    let anyTotal = 0;
    if (anyResult.ok) {
        for (const line of anyResult.stdout.split('\n')) {
            const sep = line.lastIndexOf(':');
            if (sep <= 0) continue;
            const count = Number.parseInt(line.slice(sep + 1), 10);
            if (Number.isNaN(count)) continue;
            anyByFile.push({ path: line.slice(0, sep).replace(/^\.\//, ''), count });
            anyTotal += count;
        }
        anyByFile.sort((a, b) => b.count - a.count);
    }

    const sources = await listTracked(repo, ['*.ts', '*.tsx', '*.astro']);
    const entries = sources === null ? [] : await countLines(repo, sources);
    const hugeFiles = entries
        .filter((e) => e.loc > 1000)
        .filter((e) => !/(^|\/)(dist|build)\//.test(e.path))
        .filter((e) => !/\.gen\.tsx?$/.test(e.path))
        .sort((a, b) => b.loc - a.loc);

    return {
        ok: true,
        data: {
            biomeByRule: biome.rules,
            biomeTotal: biome.total,
            biomeUnattributed: biome.unattributed,
            anyByFile,
            anyTotal,
            hugeFiles
        }
    };
}

const num = (v: number): string => v.toLocaleString('es-AR');

export function drawDebtDetail(d: DebtDetail): void {
    process.stdout.write(`\n  ${pc.bold('BIOME-IGNORE POR REGLA')}  ·  ${num(d.biomeTotal)}\n`);
    process.stdout.write(
        `  ${pc.dim('qué regla se suprime más: una sola dominante es una regla a discutir')}\n\n`
    );
    for (const rule of d.biomeByRule.slice(0, 18)) {
        const share = d.biomeTotal === 0 ? 0 : Math.round((100 * rule.count) / d.biomeTotal);
        const family = rule.rule.split('/').slice(0, 2).join('/');
        const name = rule.rule.split('/').slice(2).join('/');
        process.stdout.write(
            `    ${String(rule.count).padStart(6)}  ${`${share}%`.padStart(5)}  ` +
                `${pc.dim(`${family}/`)}${name.length > 0 ? name : rule.rule}\n`
        );
    }
    if (d.biomeUnattributed > 0) {
        process.stdout.write(
            `    ${String(d.biomeUnattributed).padStart(6)}  ${''.padStart(5)}  ${pc.dim('sin regla declarada en el comentario')}\n`
        );
    }

    process.stdout.write(`\n  ${pc.bold('`any` POR ARCHIVO')}  ·  ${num(d.anyTotal)}\n`);
    process.stdout.write(`  ${pc.dim('sólo código propio: sin generados, .d.ts ni tests')}\n\n`);
    for (const file of d.anyByFile.slice(0, 20)) {
        process.stdout.write(`    ${String(file.count).padStart(6)}  ${file.path}\n`);
    }
    if (d.anyByFile.length > 20) {
        process.stdout.write(`    ${pc.dim(`… y ${d.anyByFile.length - 20} archivos más`)}\n`);
    }

    process.stdout.write(
        `\n  ${pc.bold('ARCHIVOS DE MÁS DE 1.000 LÍNEAS')}  ·  ${d.hugeFiles.length}\n`
    );
    process.stdout.write(`  ${pc.dim('la regla del proyecto es 500; estos la duplican')}\n\n`);
    for (const file of d.hugeFiles.slice(0, 25)) {
        process.stdout.write(`    ${num(file.loc).padStart(7)}  ${file.path}\n`);
    }
    if (d.hugeFiles.length > 25) {
        process.stdout.write(`    ${pc.dim(`… y ${d.hugeFiles.length - 25} archivos más`)}\n`);
    }
}
