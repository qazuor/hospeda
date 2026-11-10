/** GUARD:G-FAC-04 — section and trait keys come from the listing catalog. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXEMPTIONS = 'scripts/section-key-literal-inventory.json';
const PREFIX = 'FAIL GUARD:G-FAC-04:';
const ALLOWED_EXEMPTIONS = [
    'apps/api/src/routes/accommodation/protected/addOccupancy.ts',
    'apps/api/src/routes/accommodation/protected/removeOccupancy.ts',
    'apps/api/src/routes/accommodation/protected/batchOccupancy.ts',
    'apps/api/src/routes/accommodation/protected/updateOccupancyEvent.ts',
    'apps/api/src/routes/accommodation/protected/calendarSync.ts',
    'apps/api/src/routes/accommodation/protected/calendarConnectGoogle.ts',
    'apps/api/src/routes/accommodation/protected/calendarConnectIcal.ts',
    'apps/api/src/utils/entitlement-filter.ts',
    'apps/api/src/routes/accommodation/public/list.ts',
    'apps/api/src/routes/accommodation/protected/getWhatsApp.ts'
];
const MIN_FILES = 10;
export function inventoryIsExact(inventory: { count: number; files: readonly string[] }): boolean {
    return (
        inventory.count === ALLOWED_EXEMPTIONS.length &&
        inventory.count === inventory.files.length &&
        JSON.stringify([...inventory.files].sort()) ===
            JSON.stringify([...ALLOWED_EXEMPTIONS].sort())
    );
}
export function hasForbiddenKeyLiteral(source: string, keys: readonly string[]): boolean {
    const contexts =
        /(?:listingAccess\s*:\s*\{[\s\S]{0,500}?capabilities|step6Key|enforceUserGate\s*\(\s*\{[\s\S]{0,300}?keys|readEffectiveKeys\s*\()/g;
    if (
        [...source.matchAll(contexts)].some((match) => {
            const fragment = source.slice(match.index, match.index + 600);
            return keys.some(
                (key) => fragment.includes(`'${key}'`) || fragment.includes(`"${key}"`)
            );
        })
    )
        return true;
    return keys.some((key) => {
        const literal = new RegExp(`(?:const|let)\\s+\\w+\\s*=\\s*['"]${key}['"]`);
        const assignment = literal.exec(source);
        return Boolean(
            assignment &&
                /capabilities|step6Key|enforceUserGate|readEffectiveKeys/.test(
                    source.slice(assignment.index)
                )
        );
    });
}

export function forbiddenSourcePaths(
    sources: readonly { path: string; source: string }[],
    exemptions: readonly string[],
    keys: readonly string[]
): string[] {
    return sources
        .filter(
            ({ path, source }) => !exemptions.includes(path) && hasForbiddenKeyLiteral(source, keys)
        )
        .map(({ path }) => path);
}

function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? walk(path) : entry.name.endsWith('.ts') ? [path] : [];
    });
}

export function run({ root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..') } = {}) {
    const problems: string[] = [];
    let inventory: { count: number; files: string[] };
    try {
        inventory = JSON.parse(readFileSync(join(root, EXEMPTIONS), 'utf8'));
    } catch {
        return { exitCode: 1, output: `${PREFIX} cannot read ${EXEMPTIONS}` };
    }
    if (!inventoryIsExact(inventory))
        problems.push(
            `${PREFIX} exemption inventory must match its closed list and exact count ${ALLOWED_EXEMPTIONS.length}`
        );

    const enums = readFileSync(join(root, 'packages/schemas/src/catalog/key-enums.ts'), 'utf8');
    const enumValues = new Map(
        [...enums.matchAll(/(\w+)\s*=\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
    );
    const catalog = readFileSync(
        join(root, 'packages/schemas/src/catalog/listing-sections.ts'),
        'utf8'
    );
    const enumNames = [...catalog.matchAll(/entitlementKey:\s*K\.(\w+)/g)].map((m) => m[1]);
    const keys = [
        ...new Set(enumNames.map((name) => enumValues.get(name)).filter((x): x is string => !!x))
    ];
    const targets = [
        ...walk(join(root, 'apps/api/src/routes/venue/protected')),
        ...walk(join(root, 'apps/api/src/routes/experience/protected')),
        ...walk(join(root, 'apps/api/src/routes/accommodation')),
        ...walk(join(root, 'apps/api/src/utils')),
        join(root, 'apps/api/src/routes/ai/protected/chat.ts')
    ];
    const sources = targets.map((path) => ({
        path: path.slice(root.length + 1),
        source: readFileSync(path, 'utf8')
    }));
    const scanned = sources.filter(({ path }) => !inventory.files.includes(path));
    if (scanned.length < MIN_FILES)
        problems.push(`${PREFIX} scanned ${scanned.length} files; minimum is ${MIN_FILES}`);
    for (const path of forbiddenSourcePaths(sources, inventory.files, keys))
        problems.push(`${PREFIX} literal section/trait key in ${path}`);
    if (problems.length) return { exitCode: 1, output: problems.join('\n') };
    return {
        exitCode: 0,
        output: `OK GUARD:G-FAC-04: ${scanned.length} files scanned; ${inventory.count} exact exemptions`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
