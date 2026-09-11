import type { RunContext } from '../../lib/context.ts';
import type { Job } from '../../lib/runner.ts';

/**
 * Builds the connection string for one database.
 *
 * @param input.template - Template carrying a `{dbname}` placeholder.
 * @param input.database - Database name.
 * @returns The connection string, or `null` without a usable template.
 */
export function connStringFor({
    template,
    database
}: {
    readonly template: string;
    readonly database: string;
}): string | null {
    if (!template.includes('{dbname}')) return null;
    return template.replace('{dbname}', database);
}

/**
 * Builds a job that runs a package.json script against the context's database.
 *
 * The database is chosen by an environment variable rather than by a flag,
 * because that is the only channel drizzle-kit and the seeders read. Which
 * means a command that forgets it does not fail — it silently operates on
 * whatever `.env.local` points at, and that file points at the worktree you
 * happened to set up last.
 *
 * @param input.context - Where the command acts.
 * @param input.script  - Root `package.json` script to run.
 * @returns The job, or `null` when the database cannot be resolved.
 */
export function dbJob({
    context,
    script
}: {
    readonly context: RunContext;
    readonly script: string;
}): Job | null {
    if (context.worktree === null || context.database === null || context.dbConfig === null) {
        return null;
    }
    const conn = connStringFor({
        template: context.dbConfig.connStringTemplate,
        database: context.database
    });
    if (conn === null) return null;

    return {
        command: 'pnpm',
        args: ['run', script],
        // From the worktree, not the main clone: migrations and seeders come
        // from ITS checkout, which is the whole reason a worktree has its own
        // database in the first place.
        cwd: context.worktree.path,
        env: { [context.dbConfig.connStringEnvVar]: conn }
    };
}

/** Why a database could not be resolved, phrased for the user. */
export function explainMissingDb({ context }: { readonly context: RunContext }): string {
    if (context.worktree === null) {
        return 'Estás fuera de un repositorio. Pasá --wt <nombre>.';
    }
    if (context.dbConfig === null) {
        return 'No pude leer .claude/project.config.json del repo.';
    }
    if (context.database === null) {
        return (
            `El worktree «${context.worktree.name}» no tiene una base registrada.\n` +
            'Corré `hops servers-up` una vez para que se cree.'
        );
    }
    return 'No pude armar la cadena de conexión: falta db.connStringTemplate en el config.';
}
