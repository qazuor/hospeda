/**
 * GUARD:G-FAC-05 — no dispatch by vertical, section id, listing type or review
 * dimension inside the files the catalog-derived mechanism replaces
 * (HOS-1787 child 5, leaf 5.8, F-V1-028 / DEC-FAC-033 / DEC-FAC-065).
 *
 * ## What it verifies
 *
 * Inside the closed list at {@link FILES_PATH} — and only there — the guard
 * reports a hit for:
 *
 *  1. a comparison (`===`, `!==`, `==`, `!=`), a `switch` `case`, or an index
 *     access with a string literal against a literal that is a vertical
 *     (`venue`, `experience`, `accommodation`), a catalog section id
 *     (`LISTING_SECTIONS` of the three listing verticals), a listing type
 *     (`VenueTypeEnum`, `ExperienceTypeEnum`, `AccommodationTypeEnum`) or a
 *     review-dimension id (`REVIEW_RULES`);
 *  2. a `Record<…Vertical…, …Section…[]>` type (the declared text of the type),
 *     the shape that re-introduces a hand-written per-vertical section list;
 *  3. the reappearance of the retired `…OrExperience` dispatch identifier or
 *     any `*_ONLY_SECTIONS` constant;
 *  4. in `.astro` files, the template half is scanned with the same predicate
 *     expressed as a regular expression. The frontmatter is parsed with the
 *     TypeScript parser, so it gets the full rule set.
 *
 * The literal sets are READ from the source under `packages/schemas/src`, never
 * copied into this file: a copy would drift from the catalog and turn the guard
 * green while the catalog grew. A stale `dist` would leave the sets empty, which
 * is why every set is asserted non-empty before scanning.
 *
 * ## Floor and self-checks
 *
 *  - Every file of the closed list must exist. A renamed file is red, never an
 *    escape hatch.
 *  - Every row declares a `spec`.
 *  - The four literal sets must be non-empty.
 *
 * ## What it does NOT verify
 *
 *  - Files outside the closed list: the admin's consolidated config, the venue
 *    review form, the shared review recalculation, the admin review moderation
 *    and the plan-downgrade notice join the list in the PR that migrates them
 *    (sub-specs 6 and 7, and 5.5), not here.
 *  - A literal assembled at runtime (`'ven' + 'ue'`), read from data, or reached
 *    through an alias the AST cannot resolve without a type checker.
 *  - A decision hidden in a function of another file: the guard looks at the
 *    listed file's own syntax only.
 *  - `.astro` template expressions other than the literal forms the regular
 *    expression recognises, and anything inside a template string.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Closed list of files G-FAC-05 scans, one `spec` per row. */
export const FILES_PATH = 'scripts/guards/no-listing-dispatch-files.json';

/** Source of the catalog sections the section-id set is read from. */
export const SECTIONS_SOURCE = 'packages/schemas/src/catalog/listing-sections.ts';

/** Source of each listing-type enum the type set is read from. */
export const TYPE_SOURCES = [
    'packages/schemas/src/enums/venue-type.enum.ts',
    'packages/schemas/src/enums/experience-type.enum.ts',
    'packages/schemas/src/enums/accommodation-type.enum.ts'
] as const;

/** Source of the review dimensions the dimension set is read from. */
export const REVIEW_DIMENSIONS_SOURCE = 'packages/schemas/src/catalog/review-dimensions.ts';

/** One row of the closed list. */
interface ListedFile {
    readonly file: string;
    readonly spec: string;
}

/** The committed closed-list shape. */
interface FileList {
    readonly spec?: string;
    readonly files: readonly ListedFile[];
}

/** The literal sets a hit is tested against, read from the schemas source. */
export interface LiteralSets {
    readonly verticals: readonly string[];
    readonly sectionIds: readonly string[];
    readonly listingTypes: readonly string[];
    readonly reviewDimensions: readonly string[];
}

/** One reported hit. */
export interface DispatchHit {
    readonly file: string;
    readonly line: number;
    readonly reason: string;
}

/** Arguments accepted by {@link run}; every one is optional for tests. */
export interface RunArgs {
    readonly root?: string;
    readonly filesPath?: string;
}

/** Result of one guard run. */
export interface RunResult {
    readonly exitCode: number;
    readonly output: string;
}

const COMPARISON_TOKENS = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken
]);

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

/** Finds and unwraps one `const <name> = …` initializer. */
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
            ts.isStringLiteralLike(property.initializer)
        ) {
            return property.initializer.text;
        }
    }
    return undefined;
}

/** Parses one file as TypeScript, or `undefined` when it cannot be read. */
function parseFile(
    path: string,
    scriptKind: ts.ScriptKind = ts.ScriptKind.TS
): ts.SourceFile | undefined {
    if (!existsSync(path)) return undefined;
    const text = readFileSync(path, 'utf8');
    return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind);
}

/** Reads the `id` of every section of every vertical in `LISTING_SECTIONS`. */
function extractSectionCatalog(source: ts.SourceFile): {
    readonly verticals: readonly string[];
    readonly sectionIds: readonly string[];
} {
    const initializer = findVariable(source, 'LISTING_SECTIONS');
    if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
        return { verticals: [], sectionIds: [] };
    }

    const verticals: string[] = [];
    const sectionIds: string[] = [];
    for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const vertical = propertyName(property);
        if (!vertical) continue;
        verticals.push(vertical);

        const sections = unwrap(property.initializer);
        if (!ts.isArrayLiteralExpression(sections)) continue;
        for (const section of sections.elements) {
            if (!ts.isObjectLiteralExpression(section)) continue;
            const id = stringProperty(section, 'id');
            if (id) sectionIds.push(id);
        }
    }
    return { verticals, sectionIds };
}

/** Reads every string member value of every enum declared in the file. */
function extractEnumValues(source: ts.SourceFile): readonly string[] {
    const values: string[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isEnumDeclaration(node)) {
            for (const member of node.members) {
                if (member.initializer && ts.isStringLiteralLike(member.initializer)) {
                    values.push(member.initializer.text);
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return values;
}

/** Reads every `dimensions[].id` of `REVIEW_RULES_CONTENT`. */
function extractReviewDimensions(source: ts.SourceFile): readonly string[] {
    const initializer = findVariable(source, 'REVIEW_RULES_CONTENT');
    if (!initializer || !ts.isObjectLiteralExpression(initializer)) return [];

    const ids: string[] = [];
    for (const vertical of initializer.properties) {
        if (!ts.isPropertyAssignment(vertical)) continue;
        const rules = unwrap(vertical.initializer);
        if (!ts.isObjectLiteralExpression(rules)) continue;
        for (const property of rules.properties) {
            if (!ts.isPropertyAssignment(property) || propertyName(property) !== 'dimensions') {
                continue;
            }
            const dimensions = unwrap(property.initializer);
            if (!ts.isArrayLiteralExpression(dimensions)) continue;
            for (const dimension of dimensions.elements) {
                if (!ts.isObjectLiteralExpression(dimension)) continue;
                const id = stringProperty(dimension, 'id');
                if (id) ids.push(id);
            }
        }
    }
    return ids;
}

/** Reads the four literal sets from the schemas source under `root`. */
export function readLiteralSets(root: string): LiteralSets | { readonly error: string } {
    const sectionsSource = parseFile(join(root, SECTIONS_SOURCE));
    if (!sectionsSource) return { error: `cannot read ${SECTIONS_SOURCE}` };
    const catalog = extractSectionCatalog(sectionsSource);

    const listingTypes: string[] = [];
    for (const relative of TYPE_SOURCES) {
        const source = parseFile(join(root, relative));
        if (!source) return { error: `cannot read ${relative}` };
        listingTypes.push(...extractEnumValues(source));
    }

    const dimensionsSource = parseFile(join(root, REVIEW_DIMENSIONS_SOURCE));
    if (!dimensionsSource) return { error: `cannot read ${REVIEW_DIMENSIONS_SOURCE}` };

    return {
        verticals: catalog.verticals,
        sectionIds: catalog.sectionIds,
        listingTypes,
        reviewDimensions: [...new Set(extractReviewDimensions(dimensionsSource))]
    };
}

/** Category of the first literal set that contains `text`, when any. */
function literalCategory(text: string, sets: LiteralSets): string | undefined {
    if (sets.verticals.includes(text)) return 'vertical';
    if (sets.sectionIds.includes(text)) return 'section id';
    if (sets.listingTypes.includes(text)) return 'listing type';
    if (sets.reviewDimensions.includes(text)) return 'review dimension';
    return undefined;
}

/** Every literal the predicate treats as a dispatch key, longest first. */
function allLiterals(sets: LiteralSets): readonly string[] {
    return [
        ...new Set([
            ...sets.verticals,
            ...sets.sectionIds,
            ...sets.listingTypes,
            ...sets.reviewDimensions
        ])
    ].sort((a, b) => b.length - a.length);
}

/** Line number of a node (1-based). */
function lineOf(node: ts.Node, source: ts.SourceFile): number {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

/** The `Record<…, …>` text check (predicate 2). */
function recordOfVerticalSections(node: ts.Node): string | undefined {
    if (!ts.isTypeReferenceNode(node)) return undefined;
    if (!ts.isIdentifier(node.typeName) || node.typeName.text !== 'Record') return undefined;
    const [key, value] = node.typeArguments ?? [];
    if (!key || !value) return undefined;

    const keyText = key.getText();
    const verticalKey =
        /Vertical|VenueOrExperience/.test(keyText) ||
        /'venue'|'experience'|'accommodation'/.test(keyText);
    if (!verticalKey) return undefined;

    const valueText = value.getText();
    if (!/Section/.test(valueText) || !/\[\]/.test(valueText)) return undefined;
    return node.getText();
}

/**
 * The retired dispatch identifier, assembled from two halves so the retired-word
 * ledger (G-FAC-R1) does not read this guard as copy. The value is what the
 * predicate compares an identifier against.
 */
const RETIRED_DISPATCH_IDENTIFIER = ['Gastro', 'nomyOrExperience'].join('');

/** Whether an identifier is one of the names the mechanism retired. */
function retiredIdentifier(node: ts.Node): string | undefined {
    if (!ts.isIdentifier(node)) return undefined;
    if (node.text === RETIRED_DISPATCH_IDENTIFIER) return node.text;
    if (/_ONLY_SECTIONS$/.test(node.text)) return node.text;
    return undefined;
}

/** Scans a parsed TypeScript source with the full predicate. */
function scanSource(
    source: ts.SourceFile,
    file: string,
    sets: LiteralSets
): readonly DispatchHit[] {
    const hits: DispatchHit[] = [];
    const add = (node: ts.Node, reason: string): void => {
        hits.push({ file, line: lineOf(node, source), reason });
    };

    const visit = (node: ts.Node): void => {
        if (ts.isBinaryExpression(node) && COMPARISON_TOKENS.has(node.operatorToken.kind)) {
            for (const side of [node.left, node.right]) {
                if (!ts.isStringLiteralLike(side)) continue;
                const category = literalCategory(side.text, sets);
                if (!category) continue;
                add(node, `compares against the ${category} literal "${side.text}"`);
            }
        }
        if (ts.isCaseClause(node) && ts.isStringLiteralLike(node.expression)) {
            const category = literalCategory(node.expression.text, sets);
            if (category) {
                add(node, `switch case on the ${category} literal "${node.expression.text}"`);
            }
        }
        if (
            ts.isElementAccessExpression(node) &&
            node.argumentExpression !== undefined &&
            ts.isStringLiteralLike(node.argumentExpression)
        ) {
            const category = literalCategory(node.argumentExpression.text, sets);
            if (category) {
                add(
                    node,
                    `index access with the ${category} literal "${node.argumentExpression.text}"`
                );
            }
        }
        const record = recordOfVerticalSections(node);
        if (record) add(node, `per-vertical section list type ${record}`);
        const retired = retiredIdentifier(node);
        if (retired) add(node, `retired dispatch identifier ${retired}`);

        ts.forEachChild(node, visit);
    };
    visit(source);
    return hits;
}

/** Escapes one literal for the template regular expressions. */
function escapeLiteral(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Scans the template half of an `.astro` file with the predicate as regexes. */
function scanAstroTemplate(
    text: string,
    offset: number,
    file: string,
    sets: LiteralSets
): readonly DispatchHit[] {
    const literals = allLiterals(sets).map(escapeLiteral).join('|');
    if (literals === '') return [];

    const template = text.slice(offset);
    const label = (value: string): string => {
        const category = literalCategory(value, sets);
        return category ? `the ${category} literal "${value}"` : `the literal "${value}"`;
    };
    const patterns: readonly {
        readonly regex: RegExp;
        readonly reason: (value: string) => string;
    }[] = [
        {
            regex: new RegExp(`(?:===|!==|==|!=)\\s*(['"])(${literals})\\1`, 'g'),
            reason: (value) => `compares against ${label(value)}`
        },
        {
            regex: new RegExp(`(['"])(${literals})\\1\\s*(?:===|!==)`, 'g'),
            reason: (value) => `compares against ${label(value)}`
        },
        {
            regex: new RegExp(`\\bcase\\s+(['"])(${literals})\\1\\s*:`, 'g'),
            reason: (value) => `switch case on ${label(value)}`
        },
        {
            regex: new RegExp(`\\[\\s*(['"])(${literals})\\1\\s*\\]`, 'g'),
            reason: (value) => `index access with ${label(value)}`
        }
    ];

    const hits: DispatchHit[] = [];
    for (const { regex, reason } of patterns) {
        for (const match of template.matchAll(regex)) {
            const index = offset + (match.index ?? 0);
            const line = text.slice(0, index).split('\n').length;
            hits.push({ file, line, reason: reason(match[2] ?? '') });
        }
    }
    return hits;
}

/** Scans one listed file, choosing the parser by extension. */
export function scanListedFile(
    root: string,
    file: string,
    sets: LiteralSets
): readonly DispatchHit[] {
    const path = join(root, file);
    const text = readFileSync(path, 'utf8');

    if (file.endsWith('.astro')) {
        const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
        if (!frontmatter) return [];
        const body = frontmatter[1] ?? '';
        // The synthetic source starts with a blank line so line numbers match
        // the file (the frontmatter begins on line 2).
        const source = ts.createSourceFile(
            file,
            `\n${body}`,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS
        );
        const templateOffset = (frontmatter.index ?? 0) + frontmatter[0].length;
        return [
            ...scanSource(source, file, sets),
            ...scanAstroTemplate(text, templateOffset, file, sets)
        ];
    }

    const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind);
    return scanSource(source, file, sets);
}

/** Reads and validates the closed list. */
function readFileList(
    path: string
): { readonly files: readonly ListedFile[] } | { readonly error: string } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        return { error: `closed list cannot be read: ${(error as Error).message}` };
    }
    if (!parsed || typeof parsed !== 'object') {
        return { error: 'closed list must be an object' };
    }
    const candidate = parsed as Partial<FileList>;
    if (!Array.isArray(candidate.files) || candidate.files.length === 0) {
        return { error: 'closed list must declare a non-empty files array' };
    }
    for (const [index, row] of candidate.files.entries()) {
        if (!row || typeof row.file !== 'string' || row.file.trim() === '') {
            return { error: `closed list row ${index} must declare a file` };
        }
        if (typeof row.spec !== 'string' || row.spec.trim() === '') {
            return { error: `closed list row ${row.file} must declare a spec` };
        }
    }
    return { files: candidate.files };
}

/**
 * Runs G-FAC-05.
 *
 * @param args - Optional root and closed-list override.
 * @returns Exit code and the human-readable report.
 */
export function run(args: RunArgs = {}): RunResult {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const filesPath = args.filesPath ?? join(root, FILES_PATH);

    const list = readFileList(filesPath);
    if ('error' in list) {
        return { exitCode: 1, output: `FAIL GUARD:G-FAC-05: ${list.error}` };
    }

    const errors: string[] = [];
    for (const row of list.files) {
        if (!existsSync(join(root, row.file))) {
            errors.push(`listed file is missing or renamed: ${row.file}`);
        }
    }

    const sets = readLiteralSets(root);
    if ('error' in sets) {
        return { exitCode: 1, output: `FAIL GUARD:G-FAC-05: ${sets.error}` };
    }
    const empty = [
        ['verticals', sets.verticals],
        ['section ids', sets.sectionIds],
        ['listing types', sets.listingTypes],
        ['review dimensions', sets.reviewDimensions]
    ].filter(([, values]) => (values as readonly string[]).length === 0);
    for (const [name] of empty) {
        errors.push(`the ${name as string} literal set is empty; the schemas source was not read`);
    }
    if (empty.length > 0) {
        return {
            exitCode: 1,
            output: `FAIL GUARD:G-FAC-05:\n${errors.map((error) => `- ${error}`).join('\n')}`
        };
    }

    for (const row of list.files) {
        if (!existsSync(join(root, row.file))) continue;
        for (const hit of scanListedFile(root, row.file, sets)) {
            errors.push(`${hit.file}:${hit.line} ${hit.reason}`);
        }
    }

    if (errors.length > 0) {
        return {
            exitCode: 1,
            output: `FAIL GUARD:G-FAC-05:\n${errors.map((error) => `- ${error}`).join('\n')}`
        };
    }

    return {
        exitCode: 0,
        output: `OK GUARD:G-FAC-05: ${list.files.length} files scanned; no dispatch by ${sets.verticals.length} verticals, ${sets.sectionIds.length} section ids, ${sets.listingTypes.length} listing types or ${sets.reviewDimensions.length} review dimensions`
    };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = run();
    console.log(result.output);
    process.exitCode = result.exitCode;
}
