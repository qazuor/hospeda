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
const COMMERCIAL_FIELD =
    /(?:price|precio|amount|monto|tariff|fee|monthly|quarterly|semiannual|annual)/i;

/** A commercial numeric literal found in source. */
export interface CommercialValueViolation {
    readonly line: number;
    readonly name: string;
    readonly value: string;
}

/** Remove syntax that changes typing or presentation without changing a number. */
function commercialNumber(expression: ts.Expression): ts.Expression | null {
    let current = expression;
    while (true) {
        if (ts.isParenthesizedExpression(current)) current = current.expression;
        else if (ts.isSatisfiesExpression(current) || ts.isAsExpression(current))
            current = current.expression;
        else if (
            ts.isPrefixUnaryExpression(current) &&
            (current.operator === ts.SyntaxKind.PlusToken ||
                current.operator === ts.SyntaxKind.MinusToken)
        )
            current = current.operand;
        else break;
    }
    return ts.isNumericLiteral(current) ? current : null;
}

/** Return the name of the function containing a return statement, when available. */
function enclosingFunctionName(node: ts.Node, file: ts.SourceFile): string | null {
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent))
            return parent.name?.getText(file) ?? null;
        if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
            const owner = parent.parent;
            return owner && (ts.isVariableDeclaration(owner) || ts.isPropertyAssignment(owner))
                ? owner.name.getText(file)
                : null;
        }
    }
    return null;
}

/** Detect numeric commercial literals through harmless TypeScript wrappers. */
export function scanCommercialValues(source: string): CommercialValueViolation[] {
    const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
    const violations: CommercialValueViolation[] = [];
    const visit = (node: ts.Node): void => {
        let name: string | null = null;
        let expression: ts.Expression | undefined;
        if (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) {
            name = node.name.getText(file);
            expression = node.initializer;
            if (expression && ts.isArrowFunction(expression) && !ts.isBlock(expression.body))
                expression = expression.body;
        } else if (ts.isReturnStatement(node)) {
            name = enclosingFunctionName(node, file);
            expression = node.expression;
        }
        if (name && expression && COMMERCIAL_FIELD.test(name)) {
            const literal = commercialNumber(expression);
            if (literal) {
                const line = file.getLineAndCharacterOfPosition(literal.getStart(file)).line + 1;
                violations.push({ line, name, value: expression.getText(file) });
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
