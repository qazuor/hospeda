/** GUARD:G-FAC-06 — venue content routes declare and use their own listing section. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const INVENTORY_FILE = 'scripts/content-routes-declare-section-inventory.json';
export const MIN_ROUTES = 10;
const PREFIX = 'FAIL GUARD:G-FAC-06:';
const CONTENT_TABLE_REFERENCES =
    /(?:get|replace|update|delete|upload)Venue(?:Menu|DailySpecials|Events)|venueMenu|venueDailySpecials|venueEvents|menuFilePublicId/;
type Entry = { section: string; intent: string };

export function run(args: { root?: string; minRoutes?: number } = {}) {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const fail = (problems: string[]) => ({ exitCode: 1, output: problems.join('\n') });
    let inventory: Record<string, Entry>;
    try {
        inventory = JSON.parse(readFileSync(join(root, INVENTORY_FILE), 'utf8'));
    } catch {
        return fail([`${PREFIX} cannot read ${INVENTORY_FILE}`]);
    }
    const problems: string[] = [];
    const discovered = new Set<string>();
    for (const area of ['protected', 'admin']) {
        const directory = join(root, 'apps/api/src/routes/venue', area);
        let files: string[] = [];
        try {
            files = readdirSync(directory, { recursive: true, withFileTypes: true })
                .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
                .map((entry) => join(entry.parentPath, entry.name));
        } catch {
            problems.push(`${PREFIX} cannot scan apps/api/src/routes/venue/${area}`);
        }
        for (const absolute of files) {
            const source = readFileSync(absolute, 'utf8');
            if (CONTENT_TABLE_REFERENCES.test(source))
                discovered.add(absolute.slice(root.length + 1));
        }
    }
    for (const file of discovered) {
        if (!inventory[file])
            problems.push(
                `${PREFIX} route touches a venue content subresource but is missing from the closed inventory: ${file}`
            );
    }
    if (Object.keys(inventory).length < (args.minRoutes ?? MIN_ROUTES))
        problems.push(
            `${PREFIX} inventory has ${Object.keys(inventory).length} routes; expected at least ${args.minRoutes ?? MIN_ROUTES}`
        );
    for (const [file, expected] of Object.entries(inventory)) {
        if (
            !file.startsWith('apps/api/src/routes/venue/protected/') &&
            !file.startsWith('apps/api/src/routes/venue/admin/')
        ) {
            problems.push(`${PREFIX} inventory route outside venue protected/admin: ${file}`);
            continue;
        }
        let source: string;
        try {
            source = readFileSync(join(root, file), 'utf8');
        } catch {
            problems.push(`${PREFIX} cannot read inventoried route ${file}`);
            continue;
        }
        const label = `${file} must declare section ${expected.section}`;
        const access = source.match(/listingAccess\s*:\s*\{([\s\S]*?)\n\s*\},/);
        if (!access) {
            problems.push(`${PREFIX} ${label} and use listingAccess chain`);
            continue;
        }
        const body = access[1];
        const sectionDeclaration = body.match(
            /listingSection\s*:[\s\S]*?\bid\s*:\s*['"]([^'"]+)['"]/
        );
        if (!sectionDeclaration) problems.push(`${PREFIX} ${file} does not declare listingSection`);
        else if (sectionDeclaration[1] !== expected.section) problems.push(`${PREFIX} ${label}`);
        if (sectionDeclaration && /^(?:common|listing)$/.test(sectionDeclaration[1]))
            problems.push(
                `${PREFIX} ${file} declares a common section instead of ${expected.section}`
            );
        if (!/createProtectedRoute\s*\(/.test(source) || /createCRUDRoute\s*\(/.test(source))
            problems.push(
                `${PREFIX} ${file} declares a section but does not use the listingAccess chain`
            );
        if (expected.intent === 'dynamic-write-delete') {
            if (
                !/intent\s*:[\s\S]{0,150}?(?:'write'|"write")/.test(body) ||
                !/intent\s*:[\s\S]{0,150}?(?:'delete'|"delete")/.test(body)
            )
                problems.push(`${PREFIX} ${file} must distinguish write and delete intent`);
        } else if (
            !body.includes(`intent: '${expected.intent}'`) &&
            !body.includes(`intent: "${expected.intent}"`)
        ) {
            problems.push(`${PREFIX} ${file} must declare intent ${expected.intent}`);
        }
        if (file.endsWith('/deleteMenuFile.ts') && !body.includes("intent: 'delete'"))
            problems.push(`${PREFIX} deleteMenuFile must declare delete intent`);
    }
    if (problems.length) return fail(problems);
    return {
        exitCode: 0,
        output: `OK GUARD:G-FAC-06: ${Object.keys(inventory).length} inventoried venue content routes declare their section, intent and listing access chain`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
