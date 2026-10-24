import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../../..');
const API_ROOT = join(ROOT, 'apps/api');
const SCRIPTS_DIR = join(API_ROOT, 'scripts');
const TIMEOUT_MS = 180_000;

function listScripts(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory()
            ? listScripts(path)
            : entry.isFile() && /\.tsx?$/.test(path)
              ? [path]
              : [];
    });
}

function importSpecifiers(file: string): string[] {
    const source = ts.createSourceFile(
        file,
        ts.sys.readFile(file) ?? '',
        ts.ScriptTarget.Latest,
        true
    );
    const specifiers: string[] = [];
    const visit = (node: ts.Node): void => {
        if (
            ts.isImportDeclaration(node) &&
            !node.importClause?.isTypeOnly &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            specifiers.push(node.moduleSpecifier.text);
        }
        if (
            ts.isExportDeclaration(node) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            specifiers.push(node.moduleSpecifier.text);
        }
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            const arg = node.arguments[0];
            if (!arg || !ts.isStringLiteral(arg))
                throw new Error(`${file}: non-literal dynamic import cannot be audited`);
            specifiers.push(arg.text);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return specifiers;
}

function resolveImport(
    file: string,
    specifier: string,
    options: ts.CompilerOptions
): string | undefined {
    if (specifier.startsWith('node:')) return 'node:skip';
    if (
        !specifier.startsWith('.') &&
        !specifier.startsWith('/') &&
        !specifier.startsWith('@repo/')
    ) {
        return createRequire(join(API_ROOT, 'package.json')).resolve(specifier);
    }
    const result = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
    return result?.resolvedFileName;
}

describe('TEST:1779:2 api script import graphs load under tsx', () => {
    it(
        'loads every discovered import without invoking scripts',
        () => {
            // Arrange
            const configPath = join(API_ROOT, 'tsconfig.json');
            const config = ts.readConfigFile(configPath, ts.sys.readFile);
            const parsed = ts.parseJsonConfigFileContent(
                config.config,
                ts.sys,
                API_ROOT,
                undefined,
                configPath
            );
            const discovered = listScripts(SCRIPTS_DIR).flatMap((script) =>
                importSpecifiers(script).flatMap((specifier) => {
                    const resolved = resolveImport(script, specifier, parsed.options);
                    if (resolved === 'node:skip') return [];
                    if (!resolved)
                        throw new Error(`${script}: unable to resolve import ${specifier}`);
                    return [
                        {
                            script: script.slice(SCRIPTS_DIR.length + 1),
                            specifier,
                            url: pathToFileURL(resolved).href
                        }
                    ];
                })
            );
            const tempDir = mkdtempSync(join(tmpdir(), 'hos-1779-load-'));
            const entry = join(tempDir, 'load.mts');
            const loads = discovered.map(
                ({ script, specifier, url }) =>
                    `try { await import(${JSON.stringify(url)}); console.log(${JSON.stringify(`OK ${script} ${specifier}`)}); } catch (error) { console.log(${JSON.stringify(`FAIL ${script} ${specifier}`)} + ' ' + String(error)); }`
            );
            writeFileSync(entry, `${loads.join('\n')}\n`, 'utf8');

            try {
                // Act
                const child = spawnSync('pnpm', ['--filter', 'hospeda-api', 'exec', 'tsx', entry], {
                    cwd: ROOT,
                    env: process.env,
                    encoding: 'utf8',
                    timeout: TIMEOUT_MS
                });

                // Assert
                const details = `exit=${child.status}\nerror=${child.error?.message ?? 'none'}\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}`;
                const ok = child.stdout.match(/^OK /gm) ?? [];
                const fail = child.stdout.match(/^FAIL /gm) ?? [];
                expect(child.error, details).toBeUndefined();
                expect(child.status, details).toBe(0);
                expect(fail, details).toEqual([]);
                expect(ok.length, details).toBe(discovered.length);
                expect(ok.length).toBeGreaterThan(0);
            } finally {
                rmSync(tempDir, { recursive: true, force: true });
            }
        },
        TIMEOUT_MS
    );
});
