import { resolve } from 'node:path';
import type { Subprocess } from 'bun';

function appRoot(): string {
    return resolve(import.meta.dir, '../../../../..');
}
function usage(): void {
    process.stdout.write(
        `Uso: hops artifact <validate|publish|list|state> [archivo|slug]\n\n  validate <bundle.json>  Valida un snapshot sin escribir\n  publish <bundle.json>   Publica un snapshot artifact/v1 local\n  list                    Lista artifacts del servidor local\n  state <slug>            Lee el estado persistente de sus widgets\n`
    );
}
async function validate(file: string): Promise<number> {
    const child: Subprocess = Bun.spawn(
        [
            'node',
            resolve(appRoot(), 'tools/artifact-app/validate-bundle.mjs'),
            resolve(process.cwd(), file)
        ],
        { cwd: appRoot(), stdout: 'inherit', stderr: 'inherit' }
    );
    return await child.exited;
}
async function publish(file: string): Promise<number> {
    const child: Subprocess = Bun.spawn(
        [
            'node',
            resolve(appRoot(), 'tools/artifact-app/publish-bundle.mjs'),
            resolve(process.cwd(), file)
        ],
        { cwd: appRoot(), stdout: 'inherit', stderr: 'inherit' }
    );
    return await child.exited;
}
async function list(): Promise<number> {
    try {
        const response = await fetch(
            `http://127.0.0.1:${process.env.ARTIFACT_PORT || '4317'}/api/artifacts`
        );
        if (!response.ok) {
            process.stderr.write(`Servidor de artifacts respondió ${response.status}.\n`);
            return 1;
        }
        process.stdout.write(`${JSON.stringify(await response.json(), null, 2)}\n`);
        return 0;
    } catch {
        process.stderr.write(
            'No pude conectar el servidor local de artifacts. Corré `node tools/artifact-app/server.mjs`.\n'
        );
        return 1;
    }
}
async function state(slug: string): Promise<number> {
    try {
        const response = await fetch(
            `http://127.0.0.1:${process.env.ARTIFACT_PORT || '4317'}/api/artifacts/${encodeURIComponent(slug)}/state`
        );
        if (!response.ok) {
            process.stderr.write(`Servidor de artifacts respondió ${response.status}.\n`);
            return 1;
        }
        process.stdout.write(`${JSON.stringify(await response.json(), null, 2)}\n`);
        return 0;
    } catch {
        process.stderr.write(
            'No pude conectar el servidor local de artifacts. Corré `node tools/artifact-app/server.mjs`.\n'
        );
        return 1;
    }
}
export async function runArtifact({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    const [action, file] = argv;
    if (!action || action === '--help' || action === '-h') {
        usage();
        return action ? 0 : 1;
    }
    if ((action === 'validate' || action === 'publish') && file)
        return action === 'validate' ? await validate(file) : await publish(file);
    if (action === 'list' && !file) return await list();
    if (action === 'state' && file) return await state(file);
    usage();
    return 1;
}
