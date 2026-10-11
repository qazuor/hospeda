import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
export const TEST_FILE =
    /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;
const SCAN_ROOTS = [/^apps\/api\/src\//, /^packages\/[^/]+\/src\//];
const EXCLUDED = [/^packages\/billing\//, /^packages\/db\/src\/(?:schemas|migrations)\//];

export function listProductionFiles({ root }: { readonly root: string }): readonly string[] {
    const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return output
        .split('\0')
        .filter(Boolean)
        .filter((file) => CODE_FILE.test(file) && !TEST_FILE.test(file))
        .filter((file) => SCAN_ROOTS.some((pattern) => pattern.test(file)))
        .filter((file) => !EXCLUDED.some((pattern) => pattern.test(file)))
        .filter((file) => existsSync(join(root, file)));
}

export type SuccessionWrite = {
    readonly file: string;
    readonly line: number;
    readonly object: ts.ObjectLiteralExpression;
    readonly property: ts.PropertyAssignment | ts.ShorthandPropertyAssignment;
    readonly fn: ts.FunctionLikeDeclaration | ts.SourceFile;
    readonly sourceFile: ts.SourceFile;
};

function propName(node: ts.PropertyName): string | null {
    return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;
}
function functionFor(
    node: ts.Node,
    sourceFile: ts.SourceFile
): ts.FunctionLikeDeclaration | ts.SourceFile {
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (
            ts.isFunctionDeclaration(parent) ||
            ts.isFunctionExpression(parent) ||
            ts.isArrowFunction(parent) ||
            ts.isMethodDeclaration(parent) ||
            ts.isGetAccessorDeclaration(parent) ||
            ts.isSetAccessorDeclaration(parent) ||
            ts.isConstructorDeclaration(parent)
        )
            return parent;
    }
    return sourceFile;
}
function isSchemaCall(value: ts.Expression): boolean {
    let current: ts.Expression = value;
    while (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) {
        if (ts.isCallExpression(current)) current = current.expression;
        else current = current.expression;
    }
    return ts.isIdentifier(current) && current.text === 'z';
}
function nonNullValue(value: ts.Expression): boolean {
    if (value.kind === ts.SyntaxKind.NullKeyword || value.kind === ts.SyntaxKind.UndefinedKeyword)
        return false;
    if (ts.isIdentifier(value) && value.text === 'undefined') return false;
    if (isSchemaCall(value)) return false;
    return true;
}
export function findSuccessionWrites({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): readonly SuccessionWrite[] {
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const findings: SuccessionWrite[] = [];
    function visit(node: ts.Node): void {
        let property: ts.PropertyAssignment | ts.ShorthandPropertyAssignment | null = null;
        let value: ts.Expression | null = null;
        if (
            ts.isPropertyAssignment(node) &&
            ['succeedsId', 'succeeds_id'].includes(propName(node.name) ?? '')
        ) {
            property = node;
            value = node.initializer;
        } else if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'succeedsId') {
            property = node;
            value = node.name;
        }
        if (
            property &&
            value &&
            ts.isObjectLiteralExpression(property.parent) &&
            nonNullValue(value)
        ) {
            findings.push({
                file,
                line:
                    sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile)).line +
                    1,
                object: property.parent,
                property,
                fn: functionFor(property, sourceFile),
                sourceFile
            });
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return findings;
}
export type RawSqlWrite = {
    readonly file: string;
    readonly line: number;
    readonly node: ts.StringLiteralLike | ts.TemplateExpression;
};
export function findRawSqlSuccessionWrites({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): readonly RawSqlWrite[] {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const result: RawSqlWrite[] = [];
    const pattern = /\b(?:insert\s+into|update)\b[\s\S]*\bsucceeds_id\b/i;
    function visit(node: ts.Node): void {
        if (
            (ts.isStringLiteral(node) ||
                ts.isNoSubstitutionTemplateLiteral(node) ||
                ts.isTemplateExpression(node)) &&
            pattern.test(
                node
                    .getText(sf)
                    .replace(/^`|`$/g, '')
                    .replace(/^['"]|['"]$/g, '')
            )
        ) {
            result.push({
                file,
                line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
                node
            });
        }
        ts.forEachChild(node, visit);
    }
    visit(sf);
    return result;
}
