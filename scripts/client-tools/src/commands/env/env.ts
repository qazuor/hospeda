import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { runnerFor } from '../../lib/runner.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';

/**
 * The env checks, in the order that makes a failure informative.
 *
 * They live in five different scripts today, so "revisé el entorno" means
 * whichever subset you remembered. Here it means all of them.
 */
const CHECKS = [
    { script: 'env:doctor', label: 'diagnóstico local (sin red)' },
    { script: 'env:check:local', label: 'tu .env.local contra el registro' },
    { script: 'env:check:rules', label: 'reglas de nombres y prefijos' },
    { script: 'env:check:usage', label: 'uso en el código vs registro' },
    { script: 'env:check:registry', label: 'schemas Zod vs registro' },
    { script: 'env:check:examples', label: 'los .env.example al día' }
] as const;

/** Steps of adding a variable, which no tool can do end to end. */
const ADD_STEPS = [
    'Registrala en packages/config/src/env-registry.*.ts con su metadata completa',
    'Agregá la validación Zod en el env.ts de la app que la consume',
    'Actualizá el .env.example de cada app que la use (o corré gen:env-examples)',
    'Verificá con: hops env',
    'Seteala en Coolify para CADA entorno y redesplegá'
] as const;

/** The help page. */
function renderHelp(): string {
    return `
${pc.bold('hops env')} — revisar las variables de entorno

  ${pc.dim('Corre los seis chequeos de entorno de una. Hoy viven en scripts')}
  ${pc.dim('distintos, así que «revisé el entorno» significa el subconjunto que')}
  ${pc.dim('te acordaste.')}

${pc.bold('Uso')}

  hops env [--wt <nombre>]
  hops env --add

  ${pc.bold('--add')}    Muestra los pasos para agregar una variable nueva.
  ${pc.bold('--help')}   Esta página.

${pc.bold('Chequeos')}

${CHECKS.map((check) => `  ${pc.bold(check.script.padEnd(22))}${pc.dim(check.label)}`).join('\n')}
`;
}

/**
 * Runs every environment check, or prints the steps for adding a variable.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runEnv({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }

    if (argv.includes('--add')) {
        // Deliberately a checklist and not a wizard: the first three steps mean
        // editing TypeScript by hand, and a tool that half-edits a registry is
        // worse than one that tells you exactly what to edit.
        process.stdout.write(`\n${pc.bold('Agregar una variable de entorno')}\n\n`);
        ADD_STEPS.forEach((step, index) => {
            process.stdout.write(`  ${pc.bold(`${index + 1}.`)} ${step}\n`);
        });
        process.stdout.write(
            `\n${pc.yellow('El paso 5 no lo hace ninguna herramienta local.')}\n` +
                `${pc.dim('Desde el VPS:  hops env-set <kind> CLAVE VALOR  →  hops redeploy <kind>')}\n` +
                `${pc.dim('O por la UI de Coolify. Una variable registrada y no seteada rompe el deploy.')}\n`
        );
        return 0;
    }

    const { target, rest } = extractTarget({ argv });
    const { name: worktreeName } = extractWorktreeFlag({ argv: rest });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const runner = runnerFor({ target });
    const cwd = context.worktree?.path ?? context.repoRoot;

    const failures: string[] = [];
    let done = 0;
    for (const check of CHECKS) {
        done += 1;
        process.stderr.write(
            `\n${pc.dim(`[${done}/${CHECKS.length}]`)} ${pc.bold(check.script)} ${pc.dim(check.label)}\n`
        );
        const code = await runner.exec({
            command: 'pnpm',
            args: ['run', check.script],
            cwd
        });
        // All six run even when one fails: they check different things, and
        // stopping at the first hides the rest of what is wrong.
        if (code !== 0) failures.push(check.script);
    }

    if (failures.length === 0) {
        process.stderr.write(`\n${pc.green('Los seis chequeos pasaron.')}\n`);
        return 0;
    }
    process.stderr.write(
        `\n${pc.red(`${failures.length} de ${CHECKS.length} fallaron:`)} ${failures.join(', ')}\n`
    );
    return 1;
}
