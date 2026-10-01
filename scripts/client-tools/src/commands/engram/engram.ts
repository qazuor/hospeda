import { spawnSync } from 'node:child_process';
import pc from 'picocolors';

const MUTATING = new Set([
    'save',
    'delete',
    'import',
    'setup',
    'sync',
    'cloud',
    'export',
    'obsidian-export'
]);

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
  save, delete, import, export, sync, setup, cloud, obsidian-export,
  projects consolidate, conflicts scan --apply y conflicts deferred --replay se
  delegan sólo con --confirm. El wrapper nunca agrega --hard, --apply ni --all
  por su cuenta.

${pc.dim('La DB local sigue siendo autoridad; no se copia al repositorio.')}
`;
}

function firstCommand(argv: readonly string[]): string | null {
    return argv.find((arg) => !arg.startsWith('-')) ?? null;
}

function requiresConfirmation(argv: readonly string[]): boolean {
    const command = firstCommand(argv);
    if (command !== null && MUTATING.has(command)) return true;
    const positional = argv.filter((arg) => !arg.startsWith('-'));
    if (positional[0] === 'projects' && positional[1] === 'consolidate') return true;
    if (positional[0] === 'conflicts' && positional[1] === 'scan' && argv.includes('--apply'))
        return true;
    if (positional[0] === 'conflicts' && positional[1] === 'deferred' && argv.includes('--replay'))
        return true;
    return false;
}

export function runEngram({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(help());
        return Promise.resolve(0);
    }

    const confirm = argv.includes('--confirm');
    const forwarded = argv.filter((arg) => arg !== '--confirm');
    if (requiresConfirmation(forwarded) && !confirm) {
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
