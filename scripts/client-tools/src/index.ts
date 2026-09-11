import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolveRunContext, runBarContext } from './lib/context.ts';
import { splitPassthrough } from './lib/passthrough.ts';
import { renderOpen, withStatusBar } from './lib/statusbar.ts';
import { extractTarget } from './lib/target.ts';
import { extractWorktreeFlag } from './lib/wt-flag.ts';
import { COMMANDS, findCommand } from './registry.ts';

/** Flags that ask for the help page rather than running anything. */
const HELP_FLAGS = ['--help', '-h'] as const;

/** Renders the top-level help page. */
function renderHelp(): string {
    // Padded to the longest name, not to a constant: `db-update-template` is
    // 18 characters and ran straight into its own summary.
    const width = Math.max(...COMMANDS.map((command) => command.name.length)) + 7;
    const rows = COMMANDS.map(
        (command) => `  ${pc.bold(`hops ${command.name}`.padEnd(width))}${command.summary}`
    ).join('\n');
    const aliases = COMMANDS.map((command) => `  hops-${command.name}`).join('\n');
    return `
${pc.bold('hops')} — herramientas de desarrollo del monorepo Hospeda

${pc.dim('El gemelo local de `hops` del VPS: un solo comando que agrupa las')}
${pc.dim('herramientas de esta máquina. Sin argumentos abre un menú.')}

${pc.bold('Uso')}

  hops                    Abre el menú interactivo
  hops <comando> [args]   Corre un comando directo
  hops --help             Esta página

${pc.bold('Comandos')}

${rows}

${pc.bold('Binarios sueltos')}

${pc.dim('Cada comando existe además como binario propio, con los mismos argumentos:')}

${aliases}

${pc.dim('`hops-stats --help` y `hops <comando> --help` muestran la ayuda de cada uno.')}
`;
}

/**
 * Runs one command by name, loading it on demand.
 *
 * This is the single entry point every standalone binary funnels through, so a
 * command behaves identically whether it was reached as `hops stats`, as
 * `hops-stats`, or picked from the menu.
 *
 * @param input.name - The command to run.
 * @param input.argv - Arguments after the command name.
 * @returns The command's exit code, or 1 when the name is unknown.
 */
export async function runCommand({
    name,
    argv
}: {
    readonly name: string;
    readonly argv: readonly string[];
}): Promise<number> {
    const entry = findCommand({ name });
    if (entry === undefined) {
        process.stderr.write(`${pc.red('Comando desconocido:')} ${name}\n`);
        process.stderr.write(renderHelp());
        return 1;
    }
    const command = await entry.load();

    // No exceptions, not even `--help`: a bar that is sometimes there is a bar
    // you stop reading. Uniform beats clever.
    // Only the half before `--` is ours; the rest is addressed to whatever the
    // command ends up running.
    const { own } = splitPassthrough({ argv });
    const { target } = extractTarget({ argv: own });
    if (command.scope === 'local' && target !== 'local') {
        process.stderr.write(
            `${pc.red(`«${command.name}» sólo corre en local.`)} Pediste --target=${target}.\n`
        );
        return 1;
    }

    // Wrapped HERE, once, rather than inside each command: a command that
    // forgets the bar is a command that runs without saying where — which is
    // exactly the confusion the bar exists to prevent.
    const { name: worktreeName } = extractWorktreeFlag({ argv: own });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });

    if (worktreeName !== null && context.worktree === null) {
        process.stderr.write(
            `${pc.red(`No encontré un worktree que matchee «${worktreeName}».`)}\n` +
                `${pc.dim('Probá con un nombre más específico: hay varios que empiezan igual.')}\n`
        );
        return 1;
    }

    return await withStatusBar({
        context: runBarContext({ context }),
        run: () => command.run(argv)
    });
}

/**
 * Shows the interactive picker and runs whatever is chosen.
 *
 * @returns The chosen command's exit code, or 0 when cancelled.
 */
async function interactivePicker(): Promise<number> {
    // The menu opens with the same bar every command does. Where you are is not
    // something to find out after picking.
    const context = await resolveRunContext({ cwd: process.cwd(), target: 'local' });
    process.stderr.write(renderOpen({ context: runBarContext({ context }) }));
    process.stderr.write('\n');
    const choice = await p.select({
        message: '¿Qué corro?',
        options: COMMANDS.map((command) => ({
            value: command.name,
            label: command.name,
            hint: command.summary
        }))
    });
    if (p.isCancel(choice)) {
        p.cancel('Cancelado.');
        return 0;
    }
    p.outro(`Corriendo ${String(choice)}…`);
    return await runCommand({ name: String(choice), argv: [] });
}

/**
 * Entry point: routes to the picker, the help page, or a command.
 *
 * @param input.argv - Arguments after the executable.
 * @returns The process exit code.
 */
export async function main({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    const [first, ...rest] = argv;

    // Machine-readable command list. `install.sh` consumes it so the shell
    // functions are generated from the registry instead of a second, hand-kept
    // list that silently goes stale every time a command is added.
    if (first === '--commands') {
        for (const command of COMMANDS)
            process.stdout.write(`${command.name}\t${command.summary}\n`);
        return 0;
    }

    if (first === undefined) return await interactivePicker();
    if (HELP_FLAGS.includes(first as (typeof HELP_FLAGS)[number])) {
        process.stdout.write(renderHelp());
        return 0;
    }
    return await runCommand({ name: first, argv: rest });
}

// Only self-execute when run as a program, never when imported by a test.
if (import.meta.main) {
    process.exit(await main({ argv: process.argv.slice(2) }));
}
