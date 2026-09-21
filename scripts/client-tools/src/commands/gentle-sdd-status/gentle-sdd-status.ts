import { spawnSync } from 'node:child_process';
import pc from 'picocolors';

function help(): string {
    return `
${pc.bold('hops gentle-sdd-status')} — estado/routing SDD read-only

  hops gentle-sdd-status [change]           Consulta el estado del change
  hops gentle-sdd-status [change] --continue Consulta sólo el routing recomendado
  hops gentle-sdd-status [change] --json     Envuelve la salida en JSON
  hops gentle-sdd-status --help              Muestra esta ayuda

No adquiere locks, no aplica tareas, no verifica ni archiva cambios.
`;
}

export function runGentleSddStatus({
    argv
}: {
    readonly argv: readonly string[];
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(help());
        return Promise.resolve(0);
    }
    const json = argv.includes('--json');
    const continueMode = argv.includes('--continue');
    const change = argv.find((arg) => !arg.startsWith('-'));
    const args = [continueMode ? 'sdd-continue' : 'sdd-status'];
    if (change) args.push(change);
    const result = spawnSync('gentle-ai', args, { encoding: 'utf8' });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (json) {
        process.stdout.write(`${JSON.stringify({ readOnly: true, command: args, ok: result.status === 0, output })}
`);
    } else {
        process.stdout.write(`${pc.bold('GENTLE SDD · READ-ONLY')}
${output}
`);
        process.stdout.write(`${pc.dim('mutaciones: ninguna · apply/verify/archive: no ejecutados')}
`);
    }
    return Promise.resolve(result.error === undefined && result.status === 0 ? 0 : 1);
}
