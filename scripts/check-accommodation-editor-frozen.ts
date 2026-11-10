/**
 * GUARD:G-FAC-08 — the accommodation editor's hand-written section list is
 * frozen and matches the catalog (HOS-1787 leaf 5.1, DEC-FAC-033).
 *
 * What it verifies:
 *  1. `ACCOMMODATION_EDITOR_SECTIONS` equals the committed inventory: exact
 *     count, ids, slugs and groups, in order. Any add, remove or reorder fails
 *     until the child 8 migration replaces this guard.
 *  2. The accommodation half of `LISTING_SECTIONS` has the same ids in the same
 *     order and with the same groups as the inventory. A section added to the
 *     catalog alone fails, so child 8 cannot start from a catalog that has
 *     already drifted.
 *  3. The manual file does NOT import `LISTING_SECTIONS` or the presentation
 *     Record. Deriving the list from the catalog before child 8 fails.
 *  4. The floor and the self-checks: the file and inventory exist and parse,
 *     the inventory declares a `spec`, its `count` matches its rows, ids/slugs
 *     are unique, and it holds at least {@link MIN_INVENTORY_SECTIONS}.
 *
 * What it does NOT verify: the per-field gating of accommodation
 * (`apps/web/src/lib/editor/entitlement-filter.ts`). Fields and entitlements are
 * outside this guard; child 8 keeps them under G-FAC-05.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const INVENTORY_PATH = 'scripts/guards/accommodation-editor-sections.json';
export const MANUAL_FILE = 'apps/web/src/lib/editor/accommodation-editor-sections.ts';
export const CATALOG_FILE = 'packages/schemas/src/catalog/listing-sections.ts';
export const MIN_INVENTORY_SECTIONS = 10;

/** One frozen section row. */
interface InventorySection {
    readonly id: string;
    readonly slug: string;
    readonly group: string;
}

/** The committed inventory shape. */
interface Inventory {
    readonly count: number;
    readonly sections: readonly InventorySection[];
    readonly spec: string;
}

/** A section read out of the TypeScript source. */
interface SourceSection {
    readonly id: string;
    readonly slug?: string;
    readonly group: string;
    readonly order?: number;
}

/** Arguments accepted by {@link run}; every one is optional for tests. */
export interface RunArgs {
    readonly root?: string;
    readonly inventoryPath?: string;
    readonly minSections?: number;
}

/** Result of one guard run. */
export interface RunResult {
    readonly exitCode: number;
    readonly output: string;
}

/** Removes `as const` / `satisfies` / parentheses around an initializer. */
function unwrap(expression: ts.Expression): ts.Expression {
    let current = expression;
    while (
        ts.isAsExpression(current) ||
        ts.isSatisfiesExpression(current) ||
        ts.isParenthesizedExpression(current) ||
        ts.isTypeAssertionExpression(current)
    ) {
        current = current.expression;
    }
    return current;
}

/** Returns the property name of an object-literal assignment, when literal. */
function propertyName(property: ts.PropertyAssignment): string | undefined {
    if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
        return property.name.text;
    }
    return undefined;
}

/** Finds and unwraps one top-level `const <name> = …` initializer. */
function findVariable(source: ts.SourceFile, name: string): ts.Expression | undefined {
    let found: ts.Expression | undefined;
    const visit = (node: ts.Node): void => {
        if (
            found === undefined &&
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === name &&
            node.initializer !== undefined
        ) {
            found = unwrap(node.initializer);
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
}

/** Reads a string-valued property from an object literal. */
function stringProperty(object: ts.ObjectLiteralExpression, key: string): string | undefined {
    for (const property of object.properties) {
        if (
            ts.isPropertyAssignment(property) &&
            propertyName(property) === key &&
            ts.isStringLiteral(property.initializer)
        ) {
            return property.initializer.text;
        }
    }
    return undefined;
}

/** Reads a numeric-valued property from an object literal. */
function numberProperty(object: ts.ObjectLiteralExpression, key: string): number | undefined {
    for (const property of object.properties) {
        if (
            ts.isPropertyAssignment(property) &&
            propertyName(property) === key &&
            ts.isNumericLiteral(property.initializer)
        ) {
            return Number(property.initializer.text);
        }
    }
    return undefined;
}

/** Parses one file as TypeScript, or `undefined` when it cannot be read. */
function parseFile(path: string): ts.SourceFile | undefined {
    if (!existsSync(path)) return undefined;
    const text = readFileSync(path, 'utf8');
    return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Extracts the object literals of an array-valued initializer. */
function arrayObjects(expression: ts.Expression): readonly ts.ObjectLiteralExpression[] {
    if (!ts.isArrayLiteralExpression(expression)) return [];
    return expression.elements.filter((element): element is ts.ObjectLiteralExpression =>
        ts.isObjectLiteralExpression(element)
    );
}

/** Extracts `ACCOMMODATION_EDITOR_SECTIONS`. */
function extractManualSections(source: ts.SourceFile): readonly SourceSection[] {
    const initializer = findVariable(source, 'ACCOMMODATION_EDITOR_SECTIONS');
    if (!initializer) return [];

    return arrayObjects(initializer).map((object) => {
        const id = stringProperty(object, 'id');
        const slug = stringProperty(object, 'slug');
        const group = stringProperty(object, 'group');
        return { id: id ?? '', slug, group: group ?? '' };
    });
}

/** Extracts the `accommodation` array of `LISTING_SECTIONS`. */
function extractCatalogSections(source: ts.SourceFile): readonly SourceSection[] {
    const initializer = findVariable(source, 'LISTING_SECTIONS');
    if (!initializer || !ts.isObjectLiteralExpression(initializer)) return [];

    let accommodation: ts.Expression | undefined;
    for (const property of initializer.properties) {
        if (ts.isPropertyAssignment(property) && propertyName(property) === 'accommodation') {
            accommodation = unwrap(property.initializer);
            break;
        }
    }
    if (!accommodation) return [];

    return arrayObjects(accommodation).map((object) => ({
        id: stringProperty(object, 'id') ?? '',
        group: stringProperty(object, 'group') ?? '',
        order: numberProperty(object, 'order')
    }));
}

/** Whether the manual file imports the catalog or the presentation Record. */
function forbiddenImports(source: ts.SourceFile): readonly string[] {
    const found: string[] = [];

    for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement)) continue;
        if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;

        const moduleName = statement.moduleSpecifier.text;
        if (moduleName.includes('listing-section-presentation')) {
            found.push(moduleName);
            continue;
        }

        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
            for (const element of bindings.elements) {
                const imported = element.propertyName?.text ?? element.name.text;
                if (
                    imported === 'LISTING_SECTIONS' ||
                    imported === 'LISTING_SECTION_PRESENTATION'
                ) {
                    found.push(`${moduleName}#${imported}`);
                }
            }
        }
    }

    return found;
}

/** Reads and validates the inventory. */
function readInventory(
    path: string,
    minSections: number
): { readonly inventory: Inventory } | { readonly error: string } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        return { error: `inventory cannot be read: ${(error as Error).message}` };
    }

    if (!parsed || typeof parsed !== 'object') {
        return { error: 'inventory must be an object' };
    }
    const candidate = parsed as Partial<Inventory>;
    if (typeof candidate.spec !== 'string' || candidate.spec.trim() === '') {
        return { error: 'inventory must declare a non-empty spec reference' };
    }
    if (typeof candidate.count !== 'number' || !Number.isInteger(candidate.count)) {
        return { error: 'inventory must declare an integer count' };
    }
    if (!Array.isArray(candidate.sections)) {
        return { error: 'inventory must declare a sections array' };
    }
    if (candidate.sections.length !== candidate.count) {
        return {
            error: `inventory count ${candidate.count} does not match ${candidate.sections.length} rows`
        };
    }
    if (candidate.sections.length < minSections) {
        return {
            error: `inventory has ${candidate.sections.length} sections; expected at least ${minSections}`
        };
    }

    const ids = new Set<string>();
    const slugs = new Set<string>();
    for (const [index, section] of candidate.sections.entries()) {
        if (
            !section ||
            typeof section.id !== 'string' ||
            typeof section.slug !== 'string' ||
            typeof section.group !== 'string' ||
            section.id === '' ||
            section.slug === '' ||
            section.group === ''
        ) {
            return { error: `inventory row ${index} must declare id, slug and group` };
        }
        if (ids.has(section.id)) return { error: `duplicate inventory id ${section.id}` };
        if (slugs.has(section.slug)) return { error: `duplicate inventory slug ${section.slug}` };
        ids.add(section.id);
        slugs.add(section.slug);
    }

    return { inventory: candidate as Inventory };
}

/** Compares two ordered section lists and reports every difference. */
function compareSections(
    label: string,
    expected: readonly InventorySection[],
    actual: readonly SourceSection[],
    checkSlug: boolean
): readonly string[] {
    const errors: string[] = [];
    if (expected.length !== actual.length) {
        errors.push(`${label} has ${actual.length} sections; inventory has ${expected.length}`);
    }
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
        const wanted = expected[index];
        const got = actual[index];
        if (!wanted || !got) {
            errors.push(`${label} differs at position ${index + 1}`);
            continue;
        }
        if (wanted.id !== got.id) {
            errors.push(
                `${label} position ${index + 1}: expected id "${wanted.id}", found "${got.id}"`
            );
        }
        if (checkSlug && wanted.slug !== got.slug) {
            errors.push(
                `${label} position ${index + 1}: expected slug "${wanted.slug}", found "${got.slug ?? ''}"`
            );
        }
        if (wanted.group !== got.group) {
            errors.push(
                `${label} position ${index + 1}: expected group "${wanted.group}", found "${got.group}"`
            );
        }
    }
    return errors;
}

/**
 * Runs G-FAC-08.
 *
 * @param args - Optional root, inventory override and section floor.
 * @returns Exit code and the human-readable report.
 */
export function run(args: RunArgs = {}): RunResult {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const inventoryPath = args.inventoryPath ?? join(root, INVENTORY_PATH);
    const minSections = args.minSections ?? MIN_INVENTORY_SECTIONS;

    const read = readInventory(inventoryPath, minSections);
    if ('error' in read) {
        return { exitCode: 1, output: `FAIL GUARD:G-FAC-08: ${read.error}` };
    }
    const { inventory } = read;

    const manualSource = parseFile(join(root, MANUAL_FILE));
    if (!manualSource) {
        return {
            exitCode: 1,
            output: `FAIL GUARD:G-FAC-08: cannot read ${MANUAL_FILE}`
        };
    }

    const errors: string[] = [];

    const imports = forbiddenImports(manualSource);
    if (imports.length > 0) {
        errors.push(
            `accommodation editor derives from the catalog (${imports.join(', ')}); the hand-written list is frozen until child 8`
        );
    }

    const manual = extractManualSections(manualSource);
    if (manual.length === 0) {
        errors.push(`no ACCOMMODATION_EDITOR_SECTIONS array found in ${MANUAL_FILE}`);
    }
    if (manual.some((section) => section.id === '' || section.group === '')) {
        errors.push('a manual section is missing its id or group');
    }
    errors.push(...compareSections('manual list', inventory.sections, manual, true));

    const catalogSource = parseFile(join(root, CATALOG_FILE));
    if (catalogSource) {
        const catalog = extractCatalogSections(catalogSource);
        if (catalog.length === 0) {
            errors.push('no LISTING_SECTIONS.accommodation array found in the catalog');
        }
        errors.push(
            ...compareSections('catalog accommodation sections', inventory.sections, catalog, false)
        );
    } else {
        errors.push(`cannot read ${CATALOG_FILE}`);
    }

    if (errors.length > 0) {
        return {
            exitCode: 1,
            output: `FAIL GUARD:G-FAC-08:\n${errors.map((error) => `- ${error}`).join('\n')}`
        };
    }

    return {
        exitCode: 0,
        output: `OK GUARD:G-FAC-08: ${inventory.count} accommodation editor sections frozen and equal to the catalog`
    };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = run();
    console.log(result.output);
    process.exitCode = result.exitCode;
}
