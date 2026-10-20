/** GUARD:G2 (c): an existing listing's vertical is not writable. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SCAN_ROOTS = [
    /^apps\/api\/src\//,
    /^packages\/service-core\/src\//,
    /^packages\/schemas\/src\//
];
const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEST_FILE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;
const LISTING_PATH = /(?:accommodation|gastronomy|experience)/i;
const UPDATE_SCHEMA = /(?:update|patch).*schema/i;
const LISTING_TABLE = /\b(?:accommodations|gastronomies|experiences)\b/;
const FORBIDDEN = new Set(['vertical', 'productDomain']);
export const MIN_SCANNED_FILES = 500;

function propertyName(name: ts.PropertyName): string | null {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
    return null;
}

function forbiddenProperty(node: ts.Node): ts.PropertyAssignment | null {
    let match: ts.PropertyAssignment | null = null;
    function visit(current: ts.Node): void {
        if (match) return;
        if (ts.isPropertyAssignment(current) && FORBIDDEN.has(propertyName(current.name) ?? '')) {
            match = current;
            return;
        }
        ts.forEachChild(current, visit);
    }
    visit(node);
    return match;
}

export function findImmutableVerticalWrites(args: {
    readonly file: string;
    readonly source: string;
}): readonly { readonly file: string; readonly line: number; readonly detail: string }[] {
    const sourceFile = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const violations: { file: string; line: number; detail: string }[] = [];
    const report = (node: ts.Node, detail: string) => {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        violations.push({ file: args.file, line, detail });
    };
    function visit(node: ts.Node): void {
        if (
            LISTING_PATH.test(args.file) &&
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            UPDATE_SCHEMA.test(node.name.text) &&
            node.initializer
        ) {
            const key = forbiddenProperty(node.initializer);
            if (key)
                report(key, `update schema ${node.name.text} declares ${propertyName(key.name)}`);
        }

        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            const method = node.expression.name.text;
            const objectArg =
                method === 'set'
                    ? node.arguments[0]
                    : node.arguments.find(ts.isObjectLiteralExpression);
            if (objectArg && ts.isObjectLiteralExpression(objectArg)) {
                const key = forbiddenProperty(objectArg);
                if (key) {
                    const chain = node.expression.expression.getText(sourceFile);
                    const listingService =
                        /packages\/service-core\/src\/services\/(?:accommodation|gastronomy|experience)\//.test(
                            args.file
                        );
                    const writesListing = LISTING_TABLE.test(chain) || listingService;
                    if (
                        (method === 'set' ||
                            /^(?:update|updateById|updateOwn|patch)$/.test(method)) &&
                        writesListing
                    ) {
                        report(key, `${method} writes ${propertyName(key.name)} on a listing`);
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return violations;
}

function listFiles(root: string): readonly string[] {
    const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return output
        .split('\0')
        .filter(Boolean)
        .filter((file) => CODE_FILE.test(file) && !TEST_FILE.test(file))
        .filter((file) => SCAN_ROOTS.some((rootPattern) => rootPattern.test(file)))
        .filter((file) => existsSync(join(root, file)));
}

export function run(args: { readonly root?: string; readonly minScannedFiles?: number } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const files = listFiles(root);
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (files.length < minScannedFiles) {
        return {
            exitCode: 1,
            output: `G2 (c): scanned ${files.length} files; expected at least ${minScannedFiles}`
        };
    }
    const violations = files.flatMap((file) =>
        findImmutableVerticalWrites({ file, source: readFileSync(join(root, file), 'utf8') })
    );
    if (violations.length > 0) {
        return {
            exitCode: 1,
            output: violations.map((v) => `G2 (c): ${v.file}:${v.line} ${v.detail}`).join('\n')
        };
    }
    return { exitCode: 0, output: `G2 (c): OK; ${files.length} production files scanned` };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
