import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'apps', 'api');
const PACKAGES_DIR = path.join(ROOT, 'packages');

const includedPackages = ['config', 'db', 'logger', 'schemas', 'types', 'utils'];

async function main() {
    // Cargar package.json original de la app
    const appPkgPath = path.join(API_DIR, 'package.json');
    const appPkg = JSON.parse(await fs.readFile(appPkgPath, 'utf-8'));

    // Campos a conservar
    const fieldsToCopy = [
        'name',
        'version',
        'type',
        'main',
        'license',
        'engines',
        'exports',
        'bin',
        'files'
    ];

    // Base del nuevo package.json
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const newPkg: Record<string, any> = {};
    for (const field of fieldsToCopy) {
        if (field in appPkg) newPkg[field] = appPkg[field];
    }

    // Agregar script de start si existe
    if (appPkg.scripts?.start) {
        newPkg.scripts = { start: appPkg.scripts.start };
    }

    // Copiar solo dependencias externas (sin @repo/*)
    const externalDeps = Object.entries(appPkg.dependencies || {}).filter(
        ([name]) => !name.startsWith('@repo/')
    );
    newPkg.dependencies = Object.fromEntries(externalDeps);

    // Agregar dependencias externas de los packages @repo/*
    for (const name of includedPackages) {
        const pkgJsonPath = path.join(PACKAGES_DIR, name, 'package.json');
        const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));
        const deps = pkgJson.dependencies || {};
        for (const [dep, version] of Object.entries(deps)) {
            if (!dep.startsWith('@repo/')) {
                newPkg.dependencies[dep] ??= version;
            }
        }
    }

    const outPath = path.join(API_DIR, 'package.prod.json');
    await fs.writeFile(outPath, JSON.stringify(newPkg, null, 2));

    // biome-ignore lint/suspicious/noConsoleLog: logging script result
    console.log(
        `✅ Generated package.prod.json with ${Object.keys(newPkg.dependencies).length} production dependencies`
    );
}

main().catch((err) => {
    console.error('❌ Error generating production package.json:', err);
    process.exit(1);
});
