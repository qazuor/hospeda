import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { runnerFor } from '../../lib/runner.ts';
import { extractTarget } from '../../lib/target.ts';

const TEMPLATE_SCRIPT = 'scripts/worktree/template.sh';

function renderHelp(): string {
    return `
${pc.bold('hops db-update-template')} — ciclo seguro del template de bases

  ${pc.dim('El template activo nunca se reemplaza automáticamente.')}
  ${pc.dim('Primero se construye una candidata aislada; después se valida y')}
  ${pc.dim('finalmente se promociona con confirmación explícita.')}

${pc.bold('Uso')}

  hops db-update-template status
  hops db-update-template build-candidate <nombre>
  hops db-update-template promote <candidata> --confirm

  ${pc.bold('status')}              Estado, journal y manifest sin mutar nada.
  ${pc.bold('build-candidate')}     Migraciones, extras y seed desde cero.
  ${pc.bold('promote --confirm')}   Intercambia la candidata y conserva rollback.

  ${pc.yellow('No uses db:push --force ni borres el template manualmente.')}
`;
}

/**
 * Runs the versioned template lifecycle script from the current operational
 * checkout. The script is deliberately the single implementation of DB
 * promotion safety; this command only provides the Hops interface.
 */
export async function runDbUpdateTemplate({
    argv
}: {
    readonly argv: readonly string[];
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) {
        process.stdout.write(renderHelp());
        return argv.length === 0 ? 2 : 0;
    }

    const { target, rest } = extractTarget({ argv });
    const context = await resolveRunContext({ cwd: process.cwd(), target });
    const runner = runnerFor({ target });
    const script = `${context.repoRoot}/${TEMPLATE_SCRIPT}`;

    if (context.dbConfig === null) {
        process.stderr.write(`${pc.red('ERROR:')} no pude leer la configuración de base.\n`);
        return 1;
    }

    const action = rest[0];
    if (action === undefined) {
        process.stdout.write(renderHelp());
        return 2;
    }

    const args: string[] = [];
    if (action === 'status') {
        args.push('status', context.dbConfig.templateDb);
    } else if (action === 'build-candidate') {
        const candidate = rest[1];
        if (candidate === undefined || !/^[A-Za-z0-9_]+$/.test(candidate)) {
            process.stderr.write(`${pc.red('ERROR:')} indicá un nombre de candidata seguro.\n`);
            return 2;
        }
        args.push('build-candidate', candidate);
    } else if (action === 'promote') {
        const candidate = rest[1];
        if (candidate === undefined || !/^[A-Za-z0-9_]+$/.test(candidate)) {
            process.stderr.write(`${pc.red('ERROR:')} indicá la candidata a promover.\n`);
            return 2;
        }
        if (!rest.includes('--confirm')) {
            process.stderr.write(
                `${pc.red('ERROR:')} promover requiere --confirm; la candidata no se tocó.\n`
            );
            return 2;
        }
        args.push('promote', candidate, context.dbConfig.templateDb, '--confirm');
    } else {
        process.stderr.write(`${pc.red('ERROR:')} acción desconocida: ${action}\n`);
        process.stdout.write(renderHelp());
        return 2;
    }

    return runner.exec({
        command: 'bash',
        args: [script, ...args],
        cwd: context.repoRoot
    });
}
