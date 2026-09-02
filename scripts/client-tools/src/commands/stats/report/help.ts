import pc from 'picocolors';
import { CONFIG_PATH } from '../collectors/linear.ts';
import { LOG_PATH } from '../history.ts';
import { REPORTS, SECTIONS } from '../types.ts';

const W = 74;
const line = (): void => {
    process.stdout.write(`${pc.dim('─'.repeat(W))}\n`);
};

function title(text: string): void {
    process.stdout.write(`\n${pc.bold(text)}\n`);
    line();
}

function entry(left: string, right: string, pad = 26): void {
    process.stdout.write(`  ${pc.cyan(left.padEnd(pad))}${right}\n`);
}

/**
 * The full help, shared by `--help` and the interactive menu.
 *
 * The "how to read this" block is the part worth the screen space: every number
 * here has a way of being wrong that looks perfectly plausible, and a reader who
 * does not know which ones will trust all of them equally.
 */
export function renderHelp(): void {
    process.stdout.write(
        `\n${pc.bgCyan(pc.black(' hops-stats '))}  ${pc.dim('estadísticas de código y de trabajo')}\n`
    );

    title('USO');
    entry('hops-stats', 'abre el menú y elegís qué medir');
    entry('hops-stats -s tests debt', 'secciones puntuales, sin menú');
    entry('hops-stats --quick', 'código + tests + deuda  (~2s)');
    entry('hops-stats --work -p 1w', 'git + PRs + Linear, última semana');
    entry('hops-stats --all --diff', 'todo, y qué cambió desde la corrida anterior');
    entry('hops-stats -r worktrees', 'un informe detallado, sin pasar por el menú');
    process.stdout.write(
        `\n  ${pc.dim('Correrlo desde tu terminal no consume contexto del agente.')}\n`
    );

    title('SECCIONES');
    for (const s of SECTIONS) {
        const cost = s.network ? `${s.cost} · red` : s.cost;
        process.stdout.write(`  ${pc.cyan(s.id.padEnd(10))}${s.hint.padEnd(44)}${pc.dim(cost)}\n`);
    }

    title('INFORMES DETALLADOS');
    process.stdout.write(
        `  ${pc.dim('Vista aparte: listas accionables, no números. `hops-stats -r <id>`')}\n\n`
    );
    for (const r of REPORTS) {
        const cost = r.network ? `${r.cost} · red` : r.cost;
        process.stdout.write(`  ${pc.cyan(r.id.padEnd(20))}${r.hint.padEnd(46)}${pc.dim(cost)}\n`);
    }

    title('OPCIONES');
    entry('-r, --report <id>', 'correr un informe detallado y salir');
    entry('-s, --section <ids...>', 'elegir secciones por nombre');
    entry('--quick / --work', 'presets: código+tests+deuda / git+prs+linear');
    entry('--offline', 'todo lo que no necesita red');
    entry('-a, --all', 'todas las secciones');
    entry('-p, --period <id>', '1w · 1m (default) · 3m · all');
    entry('-t, --team <key>', 'equipo de Linear (default: HOS)');
    entry('-d, --diff', 'deltas contra la corrida anterior');
    entry('--no-log', 'no registrar esta corrida');
    entry('--json', 'emitir el registro plano en vez del reporte');

    title('CÓMO LEER LOS NÚMEROS');
    process.stdout.write(
        `  ${pc.dim('Cada uno de estos tiene una forma de estar mal que parece verosímil.')}\n\n`
    );
    const caveats: readonly [string, string][] = [
        [
            'Tests',
            'conteo ESTÁTICO y por lo bajo. Cuenta `it(`/`test(` en el fuente:\nno prueba que ninguno corra, y cada bloque .each se expande a N\ntests recién en ejecución. No es "N tests pasando".'
        ],
        [
            'Tests mal ubicados',
            'se cuentan igual — un test fuera de lugar sigue siendo un test.\nSe listan aparte como deuda de convención. Un paquete sin src/\nestá exento, no incumple.'
        ],
        [
            'LOC',
            'el total crudo no dice nada: el JSON solo es casi 3× el fuente.\nCada cifra nombra su bucket.'
        ],
        [
            'Cobertura por paquete',
            'empareja por NOMBRE de archivo, porque los tests viven en test/.\nQue el nombre exista no prueba que ese test cubra el archivo.'
        ],
        [
            'i18n',
            'que la clave exista no significa que esté traducida: puede tener\nel texto en español copiado tal cual, y eso no se detecta\ncomparando estructura.'
        ],
        [
            '`any`',
            'excluye generados: más de la mitad de los hits crudos viven en\nrouteTree.gen.ts, que no lo escribió nadie.'
        ],
        [
            'Churn',
            'filtrado. Sin filtrar, arriba quedan el lockfile y los metadatos\nde task-master, que no dicen nada del código.'
        ],
        [
            'Higiene de PRs',
            'agrupada por merge commit (el PR entero). Juzgarlo por commit\nsuelto es ruido: tests y código se commitean por separado.'
        ],
        [
            'Worktrees',
            '«terminados» se decide con estado local, sin mirar el PR.\nVerificá con git log antes de borrar. El clon principal va\nmarcado y nunca se ofrece para borrar.'
        ],
        [
            'Ventanas de fecha',
            'son LOCALES, no UTC. Usar toISOString() corría toda ventana un\ndía y llegó a reportar la mitad de los commits de la semana.'
        ],
        [
            'Linear',
            'sus conteos son PERECEDEROS: su API responde por el presente.\nUna foto que no sacás hoy no se recupera mañana. Por eso se\nregistra cada corrida.'
        ],
        [
            'Una sección que falla',
            'imprime el motivo y no reporta nada. Nunca cae a cero: un cero\nbien formateado es la respuesta equivocada más creíble que hay.'
        ]
    ];
    for (const [label, text] of caveats) {
        const [first, ...rest] = text.split('\n');
        process.stdout.write(`  ${pc.yellow(label.padEnd(23))}${first ?? ''}\n`);
        for (const extra of rest) process.stdout.write(`  ${' '.repeat(23)}${extra}\n`);
        process.stdout.write('\n');
    }

    title('CONFIGURACIÓN');
    entry('LINEAR_API_KEY', 'necesaria solo para la sección linear');
    process.stdout.write(`  ${pc.dim(`en el entorno, o en ${CONFIG_PATH}`)}\n`);
    process.stdout.write(`  ${pc.dim("como  LINEAR_API_KEY='lin_api_...'  con permisos 600")}\n`);
    process.stdout.write(
        `  ${pc.dim('El archivo importa: una universal de fish no la ve un subproceso ni cron.')}\n`
    );
    process.stdout.write(`\n  ${pc.cyan('historial'.padEnd(26))}${LOG_PATH}\n`);
    process.stdout.write(
        `  ${pc.cyan('fuente'.padEnd(26))}scripts/client-tools/src/commands/stats\n\n`
    );
}
