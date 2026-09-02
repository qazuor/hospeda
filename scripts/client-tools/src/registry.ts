/**
 * Where a command is allowed to act.
 *
 * `local` touches this machine only. `remote` needs a target on the VPS.
 * `both` works either way and reads its target from the command line.
 */
export type CommandScope = 'local' | 'remote' | 'both';

/**
 * One sub-command of the `hops` client CLI.
 *
 * Mirrors `scripts/server-tools`'s `Command` shape so the two CLIs read the
 * same, with one deliberate difference: `run` returns the process exit code
 * instead of calling `process.exit` itself. A command that owns the exit is a
 * command that cannot be composed — the dispatcher could never run cleanup, and
 * the interactive menu could never return to itself.
 */
export interface ClientCommand {
    /** Name typed after `hops`, and the suffix of its standalone binary. */
    readonly name: string;
    /** One line shown in `--help` and as the menu hint. */
    readonly summary: string;
    /**
     * Where this command may act.
     *
     * Declared now, before any remote command exists, because `hops` is meant
     * to drive the VPS over SSH later: a `local`-only command asked to run
     * against production must refuse, not quietly act on this machine.
     */
    readonly scope: CommandScope;
    /**
     * Executes the command.
     *
     * @param argv - Arguments after the command name.
     * @returns The exit code: 0 on success.
     */
    run(argv: readonly string[]): Promise<number>;
}

/**
 * Loads a command's implementation on demand.
 *
 * The imports are dynamic because the three commands pull in very different
 * weight — `stats` alone reaches for a dozen collectors — and paying for all of
 * them to print `--help` makes the menu feel slow for no reason.
 */
export interface CommandEntry {
    /** Name typed after `hops`. */
    readonly name: string;
    /** One line shown in `--help` and as the menu hint. */
    readonly summary: string;
    /** Resolves the command implementation. */
    load(): Promise<ClientCommand>;
}

/** Every command the client CLI exposes, in menu order. */
export const COMMANDS: readonly CommandEntry[] = [
    {
        name: 'stats',
        summary: 'Estadísticas del repo: código, tests, deuda, git, PRs, Linear',
        load: async () => (await import('./commands/stats/command.ts')).statsCommand
    },
    {
        name: 'wt-clean',
        summary: 'Borrado interactivo de worktrees (servers + DB + worktree + branch)',
        load: async () => (await import('./commands/wt-clean/command.ts')).wtCleanCommand
    },
    {
        name: 'start-issue',
        summary: 'Crea el worktree de un issue de Linear y abre Claude adentro',
        load: async () => (await import('./commands/start-issue/command.ts')).startIssueCommand
    },
    {
        name: 'db-start',
        summary: 'Levanta Postgres y Redis (compartidos por todos los worktrees)',
        load: async () => (await import('./commands/db/command.ts')).dbStartCommand
    },
    {
        name: 'db-stop',
        summary: 'Baja Postgres y Redis, avisando a qué worktrees corta',
        load: async () => (await import('./commands/db/command.ts')).dbStopCommand
    },
    {
        name: 'verify',
        summary: 'Corre lo que va a mirar CI, leyendo el workflow real',
        load: async () => (await import('./commands/verify/command.ts')).verifyCommand
    },
    {
        name: 'test',
        summary: 'Corre los tests de una categoría (billing, auth, gastronomy…)',
        load: async () => (await import('./commands/test/command.ts')).testCommand
    },
    {
        name: 'db-migrate',
        summary: 'Pone la base al día: esquema, extras y data-migrations',
        load: async () => (await import('./commands/db/command.ts')).dbMigrateCommand
    },
    {
        name: 'db-seed',
        summary: 'Carga datos en la base del worktree',
        load: async () => (await import('./commands/db/command.ts')).dbSeedCommand
    },
    {
        name: 'db-studio',
        summary: 'Abre Drizzle Studio apuntado a la base del worktree',
        load: async () => (await import('./commands/db/command.ts')).dbStudioCommand
    },
    {
        name: 'db-fresh',
        summary: 'Rehace una base desde el template (sin tocar el volumen)',
        load: async () => (await import('./commands/db/command.ts')).dbFreshCommand
    },
    {
        name: 'db-update-template',
        summary: 'Reconstruye hospeda_template con lo último de staging',
        load: async () => (await import('./commands/db/command.ts')).dbUpdateTemplateCommand
    },
    {
        name: 'servers-up',
        summary: 'Levanta DB + servers del worktree (idempotente)',
        load: async () => (await import('./commands/servers/command.ts')).serversUpCommand
    },
    {
        name: 'servers-down',
        summary: 'Para los servers del worktree (DB y worktree quedan)',
        load: async () => (await import('./commands/servers/command.ts')).serversDownCommand
    },
    {
        name: 'ci',
        summary: '¿Está verde el PR de esta branch?',
        load: async () => (await import('./commands/ci/command.ts')).ciCommand
    },
    {
        name: 'env',
        summary: 'Chequea las variables de entorno (los seis checks)',
        load: async () => (await import('./commands/env/command.ts')).envCommand
    },
    {
        name: 'run',
        summary: 'Corre cualquier script del repo, con búsqueda',
        load: async () => (await import('./commands/run/command.ts')).runCommand
    },
    {
        name: 'update',
        summary: 'Actualiza hops a lo último de staging',
        load: async () => (await import('./commands/update/command.ts')).updateCommand
    }
];

/**
 * Finds a command entry by name.
 *
 * @param input.name - The name typed by the user.
 * @returns The entry, or `undefined` when nothing matches.
 */
export function findCommand({ name }: { readonly name: string }): CommandEntry | undefined {
    return COMMANDS.find((command) => command.name === name);
}
