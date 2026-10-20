/** GUARD:G19 — a system actor is built only by the factory (V5.md §3.3, AC:V5:13). */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SCAN_ROOTS = [/^apps\/[^/]+\/src\//, /^packages\/[^/]+\/src\//];
const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEST_FILE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;
const FACTORY_FILE = 'packages/service-core/src/utils/system-actor.ts';
const FACTORY_HINT = 'use createSystemActor from @repo/service-core';
export const MIN_SCANNED_FILES = 1000;

type Mark = 'a' | 'b';
type Allowlist = Readonly<
    Record<string, { readonly mark: Mark; readonly count: number; readonly reason: string }>
>;
export const G19_ALLOWLIST: Allowlist = {
    'apps/api/src/middlewares/actor.ts': {
        mark: 'b',
        count: 1,
        reason: 'human SUPER_ADMIN actor; V5.6/V5.8'
    },
    'packages/seed/src/utils/superAdminLoader.ts': {
        mark: 'b',
        count: 3,
        reason: 'seeded human super admin'
    },
    'packages/schemas/src/utils/permission-grouping.ts': {
        mark: 'b',
        count: 1,
        reason: 'enum iteration'
    },
    'apps/admin/src/config/ia/permission-bundles.ts': {
        mark: 'b',
        count: 1,
        reason: 'UI permission bundle'
    },
    'packages/schemas/src/api/auth.schema.ts': {
        mark: 'a',
        count: 2,
        reason: 'schema definition and omit'
    }
};

type Finding = {
    readonly file: string;
    readonly line: number;
    readonly mark: Mark;
    readonly detail: string;
};

function isSystemActorName(name: ts.PropertyName): boolean {
    return (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === '_isSystemActor';
}

function isSystemActorTarget(node: ts.Expression): boolean {
    return (
        (ts.isPropertyAccessExpression(node) && node.name.text === '_isSystemActor') ||
        (ts.isElementAccessExpression(node) &&
            ts.isStringLiteral(node.argumentExpression) &&
            node.argumentExpression.text === '_isSystemActor')
    );
}

function isAllPermissions(node: ts.CallExpression): boolean {
    return (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'Object' &&
        node.expression.name.text === 'values' &&
        node.arguments.length === 1 &&
        ts.isIdentifier(node.arguments[0]) &&
        node.arguments[0].text === 'PermissionEnum'
    );
}

export function findSystemActorBuilds(args: {
    readonly file: string;
    readonly source: string;
}): readonly Finding[] {
    const sourceFile = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const findings: Finding[] = [];
    const report = (node: ts.Node, mark: Mark, detail: string): void => {
        findings.push({
            file: args.file,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            mark,
            detail: `(${mark}) ${detail}; ${FACTORY_HINT}`
        });
    };
    function visit(node: ts.Node): void {
        if (ts.isPropertyAssignment(node) && isSystemActorName(node.name)) {
            if (node.initializer.kind !== ts.SyntaxKind.FalseKeyword)
                report(node, 'a', '_isSystemActor assignment');
        } else if (ts.isShorthandPropertyAssignment(node) && node.name.text === '_isSystemActor') {
            report(node, 'a', '_isSystemActor shorthand assignment');
        } else if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            isSystemActorTarget(node.left)
        ) {
            if (node.right.kind !== ts.SyntaxKind.FalseKeyword)
                report(node, 'a', '_isSystemActor assignment');
        }
        if (ts.isCallExpression(node) && isAllPermissions(node)) {
            report(node, 'b', 'Object.values(PermissionEnum)');
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return findings;
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
        .filter((file) => CODE_FILE.test(file) && !TEST_FILE.test(file) && file !== FACTORY_FILE)
        .filter((file) => SCAN_ROOTS.some((rootPattern) => rootPattern.test(file)))
        .filter((file) => existsSync(join(root, file)));
}

export function run(
    args: {
        readonly root?: string;
        readonly minScannedFiles?: number;
        readonly allowlist?: Allowlist;
    } = {}
): { readonly exitCode: number; readonly output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const files = listFiles(root);
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (files.length < minScannedFiles) {
        return {
            exitCode: 1,
            output: `G19: scanned ${files.length} files; expected at least ${minScannedFiles}`
        };
    }
    const allowlist = args.allowlist ?? G19_ALLOWLIST;
    const findings = files.flatMap((file) =>
        findSystemActorBuilds({ file, source: readFileSync(join(root, file), 'utf8') })
    );
    const counts = new Map<string, number>();
    const errors: string[] = [];
    for (const finding of findings) {
        const key = `${finding.file}:${finding.mark}`;
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        const entry = allowlist[finding.file];
        if (!entry || entry.mark !== finding.mark || count > entry.count) {
            errors.push(`G19: ${finding.file}:${finding.line} ${finding.detail}`);
        }
    }
    for (const [file, entry] of Object.entries(allowlist)) {
        const actual = counts.get(`${file}:${entry.mark}`) ?? 0;
        if (actual < entry.count) {
            errors.push(
                `G19: ${file}:1 allowlist stale (${entry.mark}): expected ${entry.count}, found ${actual}; ${entry.reason}`
            );
        }
    }
    return errors.length > 0
        ? { exitCode: 1, output: errors.join('\n') }
        : { exitCode: 0, output: `G19: OK; ${files.length} production files scanned` };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
