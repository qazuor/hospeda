import { spawnSync } from 'node:child_process';
import pc from 'picocolors';

const MUTATING = new Set(['save', 'delete', 'import', 'setup', 'sync', 'cloud', 'obsidian-export']);

function help(): string {
    return `
${pc.bold('hops engram')} — memoria persistente, con el CLI oficial como autoridad

${pc.bold('Lecturas frecuentes')}
  hops engram tui
  hops engram doctor --json
  hops engram projects list
  hops engram stats
  hops engram search <texto>
  hops engram context [proyecto]
  hops engram conflicts list|stats

${pc.bold('Operaciones con escritura')}
  save, delete, import, sync, setup, cloud y obsidian-export se delegan sólo con
  --confirm. El wrapper nunca agrega --hard, --apply ni --all por su cuenta.

${pc.dim('La DB local sigue siendo autoridad; no se copia al repositorio.')}
`;
}

function firstCommand(argv: readonly string[]): string | null {
    return argv.find((arg) => !arg.startsWith('-')) ?? null;
}

export function runEngram({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(help());
        return Promise.resolve(0);
    }

    const confirm = argv.includes('--confirm');
    const forwarded = argv.filter((arg) => arg !== '--confirm');
    const command = firstCommand(forwarded);
    if (command !== null && MUTATING.has(command) && !confirm) {
        process.stderr.write(
            `${pc.yellow('Engram puede modificar memoria o configuración.')}` +
                ' Repetí con --confirm si esa mutación es intencional.\n'
        );
        return Promise.resolve(2);
    }

    const result = spawnSync('engram', forwarded, { stdio: 'inherit' });
    if (result.error !== undefined) {
        process.stderr.write(
            `${pc.red('No encontré el binario engram:')} ${result.error.message}\n`
        );
        return Promise.resolve(1);
    }
    return Promise.resolve(result.status ?? 1);
}
