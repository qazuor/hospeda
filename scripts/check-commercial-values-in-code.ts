/**
 * GUARD:G7 (AC:B2:2): reject numeric commercial price/amount constants in the
 * billing source tree. Provider test doubles and test files are not catalog data.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

const ROOTS = [
    'packages/billing/src',
    'packages/payments/src',
    'packages/service-core/src/services/billing'
] as const;
const COMMERCIAL_FIELD = /(?:price|precio|amount|monto|tariff|fee)/i;

/** A commercial numeric literal found in source. */
export interface CommercialValueViolation {
    readonly line: number;
    readonly name: string;
    readonly value: string;
}

/** Detect price/amount literals assigned to named constants or object fields. */
export function scanCommercialValues(source: string): CommercialValueViolation[] {
    const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
    const violations: CommercialValueViolation[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) {
            const name = node.name.getText(file);
            const raw = node.initializer;
            const value = raw && ts.isAsExpression(raw) ? raw.expression : raw;
            if (value && COMMERCIAL_FIELD.test(name) && ts.isNumericLiteral(value)) {
                const line = file.getLineAndCharacterOfPosition(value.getStart(file)).line + 1;
                violations.push({ line, name, value: value.getText(file) });
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(file);
    return violations;
}

/** Walk production code under one billing source root. */
function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return entry.name === 'fake' ? [] : sourceFiles(path);
        }
        return entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
            ? [path]
            : [];
    });
}

/** Run G7 against all declared billing production roots. */
export function checkCommercialValues(root: string): string[] {
    return ROOTS.flatMap((folder) =>
        sourceFiles(resolve(root, folder)).flatMap((path) =>
            scanCommercialValues(readFileSync(path, 'utf8')).map(
                ({ line, name, value }) =>
                    `${relative(root, path)}:${line}: commercial value ${name} = ${value} lives in code`
            )
        )
    );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
    const violations = checkCommercialValues(process.cwd());
    if (violations.length > 0) {
        for (const violation of violations) console.error(violation);
        process.exitCode = 1;
    } else {
        console.info('GUARD:G7 passed');
    }
}
