import { spawnSync } from 'node:child_process';
import pc from 'picocolors';

type Probe = { readonly label: string; readonly args: readonly string[] };
const PROBES: readonly Probe[] = [
    { label: 'version', args: ['version'] },
    { label: 'review', args: ['review', 'status'] },
    { label: 'telemetry-preview', args: ['telemetry', 'preview', '--json'] }
];

function help(): string {
    return `
${pc.bold('hops gentle-status')} — estado local read-only de Gentle-AI

  hops gentle-status          Consulta versión, review y preview de telemetría
  hops gentle-status --json   Devuelve probes y salidas en JSON
  hops gentle-status --help   Muestra esta ayuda

No instala, sincroniza, actualiza, restaura ni escribe Engram.
`;
}

function probe(probe: Probe): {
    readonly label: string;
    readonly ok: boolean;
    readonly output: string;
} {
    const result = spawnSync('gentle-ai', probe.args, { encoding: 'utf8' });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    return { label: probe.label, ok: result.error === undefined && result.status === 0, output };
}

export function runGentleStatus({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(help());
        return Promise.resolve(0);
    }
    const results = PROBES.map(probe);
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ readOnly: true, results })}
`);
    } else {
        process.stdout.write(`${pc.bold('GENTLE-AI STATUS · READ-ONLY')}
`);
        for (const result of results) {
            const marker = result.ok ? pc.green('✓') : pc.red('✗');
            process.stdout.write(`${marker} ${result.label}
`);
            if (result.output)
                process.stdout.write(`${result.output}
`);
        }
        process.stdout.write(`${pc.dim('mutaciones: ninguna · instalación/sync/upgrade: no ejecutados')}
`);
    }
    return Promise.resolve(results.every((result) => result.ok) ? 0 : 1);
}
