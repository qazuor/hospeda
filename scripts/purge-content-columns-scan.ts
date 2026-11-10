/**
 * Parser half of GUARD:G-FAC-10 (HOS-1847, AC:4:9).
 *
 * Reads three things with the TypeScript AST and never imports them at runtime:
 * the columns of a listing `pgTable`, the flat `col = …` assignments of a `sql`
 * tagged template, and a const array of string literals. Keeping this half
 * import-free is deliberate: the Guards CI job installs dependencies but does
 * not build the workspace, so a runtime import of `@repo/schemas` (through a
 * `dbschema`) would fail there even though it works in a dev checkout with a
 * `dist/` already built.
 *
 * Two rules keep it honest:
 * - a spread (`...listingPublicationColumns()`) is resolved only through the
 *   helper the caller names; an unknown spread is an error, never silence;
 * - a value that is not the shape this module understands is an error too, so
 *   a future formatter or a new constructor cannot make the scan under-read.
 */

import ts from 'typescript';

/** One column list plus the reason it could not be read, when there is one. */
export type ColumnScan = {
    readonly columns: readonly string[];
    readonly error: string | null;
};

/** One `sql` template's assignments per vertical, or the reason it failed. */
export type SqlAssignmentScan = {
    readonly assignments: Readonly<Record<string, readonly string[]>>;
    readonly error: string | null;
};

/** One string-array declaration, or the reason it could not be read. */
export type StringArrayScan = {
    readonly values: readonly string[];
    readonly error: string | null;
};

function literalText(node: ts.Node | undefined): string | null {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return null;
}

function unwrap(node: ts.Expression): ts.Expression {
    let current = node;
    while (
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isSatisfiesExpression(current) ||
        ts.isTypeAssertionExpression(current)
    ) {
        current = current.expression;
    }
    return current;
}

function calleeName(call: ts.CallExpression): string | null {
    const callee = call.expression;
    if (ts.isIdentifier(callee)) return callee.text;
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
    return null;
}

type ObjectScan = { readonly columns: readonly string[]; readonly error: string | null };

/**
 * Walks a Drizzle column builder chain to its constructor call:
 * `uuid('id').primaryKey().defaultRandom()` → `uuid('id')`.
 */
function constructorCall(node: ts.Expression): ts.CallExpression | null {
    let current = unwrap(node);
    while (ts.isCallExpression(current)) {
        const callee = current.expression;
        if (
            ts.isPropertyAccessExpression(callee) &&
            ts.isCallExpression(unwrap(callee.expression))
        ) {
            current = unwrap(callee.expression);
            continue;
        }
        return current;
    }
    return null;
}

function columnsOfObject(args: {
    readonly object: ts.ObjectLiteralExpression;
    readonly file: string;
    readonly table: string;
    readonly resolveSpread: (name: string) => readonly string[] | null;
}): ObjectScan {
    const columns: string[] = [];
    for (const property of args.object.properties) {
        if (ts.isPropertyAssignment(property)) {
            const initializer = constructorCall(property.initializer);
            if (!initializer) {
                return {
                    columns,
                    error: `${args.file}: column ${args.table}.${property.name.getText()} is not a constructor call; cannot read its SQL name`
                };
            }
            const name = literalText(initializer.arguments[0]);
            if (name === null) {
                return {
                    columns,
                    error: `${args.file}: column ${args.table}.${property.name.getText()} has no string literal as its SQL name`
                };
            }
            columns.push(name);
            continue;
        }
        if (ts.isSpreadAssignment(property)) {
            const spread = unwrap(property.expression);
            const helper = ts.isCallExpression(spread) ? calleeName(spread) : null;
            const resolved = helper === null ? null : args.resolveSpread(helper);
            if (resolved === null) {
                return {
                    columns,
                    error: `${args.file}: table ${args.table} spreads ${spread.getText()}; the scan does not know how to resolve it`
                };
            }
            columns.push(...resolved);
            continue;
        }
        return {
            columns,
            error: `${args.file}: table ${args.table} has a property the scan cannot read (${property.getText()})`
        };
    }
    return { columns, error: null };
}

/**
 * Reads the SQL column names of one `pgTable('<table>', { … })` in a schema file.
 *
 * @param args.file - path used in errors
 * @param args.source - the file's source text
 * @param args.table - SQL table name (`venues`, `accommodations`, `experiences`)
 * @param args.resolveSpread - resolver for `...helper()` spreads; `null` fails closed
 * @returns the columns in declaration order, or the reason it could not read them
 */
export function parsePgTableColumns(args: {
    readonly file: string;
    readonly source: string;
    readonly table: string;
    readonly resolveSpread: (name: string) => readonly string[] | null;
}): ColumnScan {
    const sourceFile = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const found: ts.ObjectLiteralExpression[] = [];
    const visit = (node: ts.Node): void => {
        if (
            found.length === 0 &&
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'pgTable' &&
            literalText(node.arguments[0]) === args.table
        ) {
            const columns = node.arguments[1];
            const object = columns ? unwrap(columns) : undefined;
            if (object && ts.isObjectLiteralExpression(object)) found.push(object);
        }
        if (found.length === 0) ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    const object = found[0];
    if (!object) {
        return { columns: [], error: `${args.file}: no pgTable('${args.table}', { … }) found` };
    }
    return columnsOfObject({ object, ...args });
}

/**
 * Reads the columns a helper factory returns, e.g. `listingPublicationColumns()`.
 *
 * @param args.file - path used in errors
 * @param args.source - the file's source text
 * @param args.functionName - the exported helper's name
 * @returns the SQL column names of its returned object literal, or the reason
 */
export function parseFunctionReturnColumns(args: {
    readonly file: string;
    readonly source: string;
    readonly functionName: string;
}): ColumnScan {
    const sourceFile = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const returned: ts.ObjectLiteralExpression[] = [];
    const visit = (node: ts.Node): void => {
        if (
            returned.length === 0 &&
            ts.isFunctionDeclaration(node) &&
            node.name?.text === args.functionName &&
            node.body
        ) {
            for (const statement of node.body.statements) {
                if (!ts.isReturnStatement(statement) || !statement.expression) continue;
                const object = unwrap(statement.expression);
                if (ts.isObjectLiteralExpression(object)) returned.push(object);
            }
        }
        if (returned.length === 0) ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    const object = returned[0];
    if (!object) {
        return {
            columns: [],
            error: `${args.file}: ${args.functionName}() returns no object literal`
        };
    }
    return columnsOfObject({
        object,
        file: args.file,
        table: `${args.functionName}()`,
        resolveSpread: () => null
    });
}

function templateText(template: ts.TemplateLiteral): string {
    if (ts.isNoSubstitutionTemplateLiteral(template)) return template.text;
    return `${template.head.text}${template.templateSpans
        .map((span) => span.literal.text)
        .join('')}`;
}

function assignmentsOf(text: string, file: string, vertical: string): ObjectScan {
    const columns: string[] = [];
    for (const segment of text.split(',')) {
        const trimmed = segment.trim();
        if (!trimmed) continue;
        const match = /^([a-z_][a-z0-9_]*)\s*=\s*[\s\S]+$/.exec(trimmed);
        if (!match?.[1]) {
            return {
                columns,
                error: `${file}: ${vertical} SET segment "${trimmed}" is not a "column = value" assignment`
            };
        }
        columns.push(match[1]);
    }
    return { columns, error: null };
}

/**
 * Reads the `col = value` assignments of each `vertical: sql\`…\`` template of a
 * `Record<ListingVertical, SQL>` declaration (the purge's `BLANK_CONTENT`).
 *
 * @param args.file - path used in errors
 * @param args.source - the file's source text
 * @param args.variableName - the declaration's name (`BLANK_CONTENT`)
 * @returns the assigned column per vertical, or the reason it could not read them
 */
export function parseSqlAssignments(args: {
    readonly file: string;
    readonly source: string;
    readonly variableName: string;
}): SqlAssignmentScan {
    const sourceFile = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const found: ts.ObjectLiteralExpression[] = [];
    const visit = (node: ts.Node): void => {
        if (
            found.length === 0 &&
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === args.variableName &&
            node.initializer
        ) {
            const initializer = unwrap(node.initializer);
            if (ts.isObjectLiteralExpression(initializer)) found.push(initializer);
        }
        if (found.length === 0) ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    const object = found[0];
    if (!object) {
        return {
            assignments: {},
            error: `${args.file}: no ${args.variableName} object literal found`
        };
    }
    const assignments: Record<string, readonly string[]> = {};
    for (const property of object.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
            return {
                assignments: {},
                error: `${args.file}: ${args.variableName} has a property the scan cannot read (${property.getText()})`
            };
        }
        const vertical = property.name.text;
        const initializer = unwrap(property.initializer);
        if (!ts.isTaggedTemplateExpression(initializer) || !ts.isIdentifier(initializer.tag)) {
            return {
                assignments: {},
                error: `${args.file}: ${args.variableName}.${vertical} is not a tagged sql template`
            };
        }
        const text = templateText(initializer.template);
        const scan = assignmentsOf(text, args.file, vertical);
        if (scan.error) return { assignments: {}, error: scan.error };
        assignments[vertical] = scan.columns;
    }
    return { assignments, error: null };
}

/**
 * Reads a `const NAME = ['a', 'b'] as const` declaration.
 *
 * @param args.file - path used in errors
 * @param args.source - the file's source text
 * @param args.variableName - the declaration's name
 * @returns the string literals, or the reason it could not read them
 */
export function parseStringArray(args: {
    readonly file: string;
    readonly source: string;
    readonly variableName: string;
}): StringArrayScan {
    const sourceFile = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const found: ts.ArrayLiteralExpression[] = [];
    const visit = (node: ts.Node): void => {
        if (
            found.length === 0 &&
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === args.variableName &&
            node.initializer
        ) {
            const initializer = unwrap(node.initializer);
            if (ts.isArrayLiteralExpression(initializer)) found.push(initializer);
        }
        if (found.length === 0) ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    const array = found[0];
    if (!array) {
        return { values: [], error: `${args.file}: no ${args.variableName} string array found` };
    }
    const values: string[] = [];
    for (const element of array.elements) {
        const text = literalText(unwrap(element));
        if (text === null) {
            return {
                values,
                error: `${args.file}: ${args.variableName} has a non-string element (${element.getText()})`
            };
        }
        values.push(text);
    }
    return { values, error: null };
}

/**
 * Converts one field name between the purge's snake_case and the action-15
 * list's camelCase. Explicit and tested: `entry_note_i18n` ↔ `entryNoteI18n`.
 *
 * @param name - a snake_case column
 * @returns the camelCase field name
 */
export function snakeToCamel(name: string): string {
    return name.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

/**
 * Converts one camelCase field name to the purge's snake_case column name.
 *
 * @param name - a camelCase field
 * @returns the snake_case column name
 */
export function camelToSnake(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
