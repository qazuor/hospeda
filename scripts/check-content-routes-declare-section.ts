/** GUARD:G-FAC-06 — venue content routes and accommodation calendar writes declare and use their own listing section. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const INVENTORY_FILE = 'scripts/content-routes-declare-section-inventory.json';
export const MIN_ROUTES = 10;
const PREFIX = 'FAIL GUARD:G-FAC-06:';
const CONTENT_TABLE_REFERENCES =
    /(?:get|replace|update|delete|upload)Venue(?:Menu|DailySpecials|Events)|venueMenu|venueDailySpecials|venueEvents|menuFilePublicId/;
/**
 * Accommodation routes that write the calendar (HOS-1809): the occupancy writes
 * and the external-sync connect/trigger routes. The read, disconnect and status
 * routes deliberately carry no entitlement gate (a downgraded host can still
 * read, disconnect and see status), so they are not discovered here.
 *
 * LIMITATION: discovery is by NAME (the service verbs and the sync paths above).
 * A new calendar write route that uses other verbs or paths is NOT discovered
 * and must be added to the inventory by hand; the guard cannot find it.
 */
const ACCOMMODATION_CALENDAR_WRITES =
    /\b(?:addOccupancy|removeOccupancy|batchToggleOccupancy|updateOccupancyEvent)\s*\(|calendar-sync\/(?:sync|connect-google|connect-ical)/;
const SCANNED_AREAS = [
    { directory: 'apps/api/src/routes/venue/protected', pattern: CONTENT_TABLE_REFERENCES },
    { directory: 'apps/api/src/routes/venue/admin', pattern: CONTENT_TABLE_REFERENCES },
    {
        directory: 'apps/api/src/routes/accommodation/protected',
        pattern: ACCOMMODATION_CALENDAR_WRITES
    }
] as const;
type Entry = { section: string; intent: string; traits?: readonly string[] };

/** Run GUARD:G-FAC-06 over a repository root.
 * @param args.root Repository root to scan; defaults to the repository containing this script.
 * @param args.minRoutes Minimum number of inventoried routes required; defaults to `MIN_ROUTES`.
 * @returns Exit code and diagnostic or success output from the guard.
 */
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
    for (const { directory: area, pattern } of SCANNED_AREAS) {
        const directory = join(root, area);
        let files: string[] = [];
        try {
            files = readdirSync(directory, { recursive: true, withFileTypes: true })
                .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
                .map((entry) => join(entry.parentPath, entry.name));
        } catch {
            problems.push(`${PREFIX} cannot scan ${area}`);
        }
        for (const absolute of files) {
            const source = readFileSync(absolute, 'utf8');
            if (pattern.test(source)) discovered.add(absolute.slice(root.length + 1));
        }
    }
    for (const file of discovered) {
        if (!inventory[file])
            problems.push(
                `${PREFIX} route touches a content subresource but is missing from the closed inventory: ${file}`
            );
    }
    if (Object.keys(inventory).length < (args.minRoutes ?? MIN_ROUTES))
        problems.push(
            `${PREFIX} inventory has ${Object.keys(inventory).length} routes; expected at least ${args.minRoutes ?? MIN_ROUTES}`
        );
    for (const [file, expected] of Object.entries(inventory)) {
        if (!SCANNED_AREAS.some(({ directory }) => file.startsWith(`${directory}/`))) {
            problems.push(`${PREFIX} inventory route outside the scanned route areas: ${file}`);
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
        for (const trait of expected.traits ?? []) {
            const declared = body.match(/sectionTraits\s*:\s*\[([^\]]*)\]/);
            if (!declared || !new RegExp(`['"]${trait}['"]`).test(declared[1]))
                problems.push(`${PREFIX} ${file} must declare sectionTraits including ${trait}`);
        }
        if (file.endsWith('/deleteMenuFile.ts') && !body.includes("intent: 'delete'"))
            problems.push(`${PREFIX} deleteMenuFile must declare delete intent`);
    }
    if (problems.length) return fail(problems);
    return {
        exitCode: 0,
        output: `OK GUARD:G-FAC-06: ${Object.keys(inventory).length} inventoried content routes declare their section, intent and listing access chain`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
