import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { run } from '../../lib/exec.ts';
import { runnerFor } from '../../lib/runner.ts';
import { ensureStagingClone, STAGING_BRANCH } from '../../lib/staging-clone.ts';
import { extractTarget } from '../../lib/target.ts';
import { connStringFor } from './target-db.ts';

/** Steps that build a template from an empty database, in order. */
const PROVISION = [
    { script: 'db:migrate', label: 'esquema' },
    { script: 'db:apply-extras', label: 'extras' },
    { script: 'db:seed', label: 'datos base' },
    { script: 'db:seed:test-users', label: 'usuarios de prueba' }
] as const;

/** The help page. */
function renderHelp(): string {
    return `
${pc.bold('hops db-update-template')} — reconstruir hospeda_template desde staging

  ${pc.dim('hospeda_template es la base congelada de la que se clonan las bases de')}
  ${pc.dim('los worktrees nuevos (createdb -T, instantáneo). Queda vieja cada vez')}
  ${pc.dim('que staging mergea migraciones: la base clonada se cura a medias —')}
  ${pc.dim('le agregan las columnas nuevas, pero las tablas nuevas quedan VACÍAS,')}
  ${pc.dim('porque el heal no reseedea.')}

  ${pc.dim('Este comando la rehace desde CERO usando el código de staging, en el')}
  ${pc.dim('checkout dedicado. No refleja tu trabajo en curso, y no toca')}
  ${pc.dim('hospeda_dev.')}

${pc.bold('Uso')}

  hops db-update-template [--dry-run]

  ${pc.bold('--dry-run')}  Te dice qué haría y no toca nada.
  ${pc.bold('--help')}     Esta página.
`;
}

/** Computes the schema fingerprint of a git revision, without checking it out. */
async function fingerprintOf({
    repoPath,
    ref,
    paths
}: {
    readonly repoPath: string;
    readonly ref: string;
    readonly paths: readonly string[];
}): Promise<string | null> {
    const listed = await run({
        command: 'git',
        args: ['ls-tree', '-r', ref, '--', ...paths],
        cwd: repoPath,
        timeoutMs: 60_000
    });
    if (!listed.ok) return null;
    // The blob SHAs of the schema files ARE the fingerprint: identical content
    // yields identical hashes, and git computed them already.
    return listed.stdout
        .split('\n')
        .filter((line) => /\.(ts|sql)\s*$/.test(line) || /\.(ts|sql)\t/.test(line))
        .sort()
        .join('\n');
}

/**
 * Rebuilds the shared template database from staging.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runDbUpdateTemplate({
    argv
}: {
    readonly argv: readonly string[];
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }

    const { target, rest } = extractTarget({ argv });
    const dryRun = rest.includes('--dry-run');
    const context = await resolveRunContext({ cwd: process.cwd(), target });
    const runner = runnerFor({ target });

    if (context.dbConfig === null) {
        process.stderr.write(`${pc.red('ERROR:')} no pude leer la configuración de base.\n`);
        return 1;
    }
    const { templateDb, container, user, connStringTemplate, connStringEnvVar } = context.dbConfig;
    const mainRepoPath = context.all[0]?.path ?? context.repoRoot;

    const prepared = await ensureStagingClone({ mainRepoPath });
    if (!prepared.ok) {
        process.stderr.write(`${pc.red('ERROR:')} ${prepared.reason}\n`);
        return 1;
    }
    const stagingPath = prepared.path;

    // Bring the dedicated checkout to staging BEFORE reading any schema from
    // it: the whole promise of this command is "the template mirrors staging",
    // and a stale checkout quietly breaks that.
    const fetched = await runner.exec({
        command: 'git',
        args: ['fetch', 'origin', STAGING_BRANCH],
        cwd: stagingPath
    });
    if (fetched !== 0) return fetched;

    if (!dryRun) {
        const reset = await runner.exec({
            command: 'git',
            args: ['reset', '--hard', `origin/${STAGING_BRANCH}`],
            cwd: stagingPath
        });
        if (reset !== 0) return reset;
    }

    // Warn when the caller's checkout and staging disagree on the schema: the
    // template follows staging either way, which is the point, but it is worth
    // saying out loud rather than surprising someone later.
    const schemaPaths = [
        'packages/db/src/schemas',
        'packages/db/src/billing/schemas.ts',
        'packages/db/src/migrations/extras'
    ];
    const [mine, theirs] = await Promise.all([
        fingerprintOf({ repoPath: context.repoRoot, ref: 'HEAD', paths: schemaPaths }),
        fingerprintOf({
            repoPath: stagingPath,
            ref: `origin/${STAGING_BRANCH}`,
            paths: schemaPaths
        })
    ]);
    if (mine !== null && theirs !== null && mine !== theirs) {
        // Says only what it measured: the fingerprints differ. WHICH side is
        // ahead needs a real diff, and claiming a direction without one is how
        // a warning ends up telling you the opposite of what happened.
        process.stderr.write(
            `${pc.yellow('El esquema de tu checkout no coincide con el de staging.')}\n` +
                `${pc.dim('El template se construye desde STAGING: va a reflejar eso, no lo que tengas acá.')}\n`
        );
    }

    process.stderr.write(
        `${pc.dim('template ')}${templateDb}  ${pc.dim('desde')} ${stagingPath}\n`
    );

    if (dryRun) {
        process.stderr.write(
            `${pc.dim('(--dry-run) reharía ')}${templateDb}${pc.dim(' con: ')}` +
                `${PROVISION.map((step) => step.script).join(' → ')}\n`
        );
        return 0;
    }

    // The seeders import BUILT packages, so a fresh staging checkout has to be
    // built before it can provision anything. Turbo caches, so this is a no-op
    // once warm — but skipping it fails at `db:seed`, which is after the
    // template has already been dropped.
    process.stderr.write(`\n${pc.bold('→ build de packages')}  ${pc.dim('(turbo cachea)')}\n`);
    const built = await runner.exec({
        command: 'pnpm',
        args: ['exec', 'turbo', 'run', 'build', '--filter=./packages/*'],
        cwd: stagingPath
    });
    if (built !== 0) {
        process.stderr.write(
            `${pc.red('Falló el build de packages.')} Sin eso el seed no corre.\n`
        );
        return built;
    }

    const conn = connStringFor({ template: connStringTemplate, database: templateDb });
    if (conn === null) {
        process.stderr.write(`${pc.red('ERROR:')} falta db.connStringTemplate en el config.\n`);
        return 1;
    }

    // Drop and recreate EMPTY, then provision. Cloning hospeda_dev instead — the
    // old path — makes the template inherit whatever state that database drifted
    // into, and forces a rebuild of it too.
    const admin = async (sql: string): Promise<boolean> => {
        const result = await run({
            command: 'docker',
            args: [
                'exec',
                '-i',
                container,
                'psql',
                '-U',
                user,
                '-d',
                'postgres',
                '-v',
                'ON_ERROR_STOP=1',
                '-c',
                sql
            ],
            timeoutMs: 120_000
        });
        if (!result.ok) process.stderr.write(`${pc.red('psql:')} ${result.error}\n`);
        return result.ok;
    };

    await admin(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${templateDb}' AND pid <> pg_backend_pid();`
    );
    if (!(await admin(`DROP DATABASE IF EXISTS "${templateDb}";`))) return 1;
    if (!(await admin(`CREATE DATABASE "${templateDb}";`))) return 1;

    for (const step of PROVISION) {
        process.stderr.write(`\n${pc.bold(`→ ${step.script}`)}  ${pc.dim(step.label)}\n`);
        const code = await runner.exec({
            command: 'pnpm',
            args: ['run', step.script],
            cwd: stagingPath,
            env: { [connStringEnvVar]: conn }
        });
        if (code !== 0) {
            process.stderr.write(
                `${pc.red(`Falló ${step.script}.`)} El template quedó a medio construir:\n` +
                    `${pc.dim('volvé a correr el comando cuando esté resuelto.')}\n`
            );
            return code;
        }
    }

    p.log.success(`${templateDb} reconstruida desde ${STAGING_BRANCH}.`);
    process.stderr.write(
        `${pc.dim('Los worktrees que crees a partir de ahora la heredan. Los que ya existen,')}\n` +
            `${pc.dim('con `hops db-fresh`.')}\n`
    );
    return 0;
}
