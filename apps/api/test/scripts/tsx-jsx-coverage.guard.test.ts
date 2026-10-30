import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../../..');
const SCRIPT_DOC_EXEMPTIONS = new Map([
    [
        'scripts/bootstrap-linear-feedback.ts',
        'Its docblock points to scripts/linear/bootstrap-feedback.ts, which is absent from the repository; updating that stale command is outside this task.'
    ]
]);
const EXEMPT = new Map([
    [
        join(ROOT, 'apps/e2e/tsconfig.json'),
        'Its only tsx script is apps/e2e/seeds/e2e-seed.ts; createProgram over that root reaches zero notifications/email TSX files (measured in .hoja/tmp/measure-e2e.ts).'
    ]
]);

function filesUnder(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory()
            ? filesUnder(path)
            : entry.isFile() && /\.tsx?$/.test(path)
              ? [path]
              : [];
    });
}

function readConfig(configPath: string) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    return ts.parseJsonConfigFileContent(
        config.config,
        ts.sys,
        resolve(configPath, '..'),
        undefined,
        configPath
    );
}

function tsxConfigs(): { configPath: string; script: string }[] {
    const packageFiles = [
        join(ROOT, 'package.json'),
        ...['apps', 'packages'].flatMap((group) =>
            readdirSync(join(ROOT, group), { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => join(ROOT, group, entry.name, 'package.json'))
                .filter((file) => ts.sys.fileExists(file))
        )
    ];
    const configs = new Map<string, string>();
    for (const packageFile of packageFiles) {
        const pkg = JSON.parse(readFileSync(packageFile, 'utf8')) as {
            scripts?: Record<string, string>;
        };
        const directory = resolve(packageFile, '..');
        for (const [scriptName, command] of Object.entries(pkg.scripts ?? {}).filter(([, script]) =>
            /\btsx\b/.test(script)
        )) {
            const option = command.match(/--tsconfig(?:=|\s+)([^\s]+)/)?.[1];
            const configPath = resolve(directory, option ?? 'tsconfig.json');
            configs.set(configPath, `${packageFile.slice(ROOT.length + 1)}#${scriptName}`);
        }
    }
    return [...configs].map(([configPath, script]) => ({ configPath, script }));
}

describe('TEST:1779:3 tsx JSX aliases include source templates', () => {
    it('covers every source alias used by tsx scripts', () => {
        // Arrange
        const configs = tsxConfigs();
        const evaluatedConfigs = configs.filter(
            ({ configPath }) => ts.sys.fileExists(configPath) && !EXEMPT.has(configPath)
        );
        const failures = configs.flatMap(({ configPath, script }) => {
            if (!ts.sys.fileExists(configPath))
                return [
                    `${script} references missing tsconfig ${configPath.slice(ROOT.length + 1)}`
                ];
            if (EXEMPT.has(configPath)) return [];
            const config = readConfig(configPath);
            return Object.entries(config.options.paths ?? {}).flatMap(([alias, targets]) => {
                if (
                    !['@repo/notifications', '@repo/email'].includes(alias) ||
                    !targets.some((target) => target.includes('/src/'))
                )
                    return [];
                const packageRoot = resolve(dirname(configPath), targets[0]!)
                    .replace(/\/index\.ts$/, '')
                    .replace(/\/[^/]+$/, '');
                const hasTemplate = config.fileNames.some(
                    (file) => file.startsWith(packageRoot) && file.endsWith('.tsx')
                );
                return !hasTemplate ||
                    ![ts.JsxEmit.ReactJSX, ts.JsxEmit.ReactJSXDev].includes(
                        config.options.jsx as ts.JsxEmit
                    )
                    ? [
                          `${configPath.slice(ROOT.length + 1)} ${alias} source alias lacks TSX include or automatic JSX runtime`
                      ]
                    : [];
            });
        });

        // Act
        const result = failures;

        // Assert
        expect(evaluatedConfigs.length).toBeGreaterThan(0);
        expect(result).toEqual([]);
    });
});

describe('TEST:1779:4 api script invocation documentation', () => {
    it('documents a canonical tsx invocation for every API script', () => {
        // Arrange
        const scripts = filesUnder(join(ROOT, 'apps/api/scripts'));
        const packageJson = JSON.parse(
            readFileSync(join(ROOT, 'apps/api/package.json'), 'utf8')
        ) as { scripts?: Record<string, string> };

        // Act
        const undocumented = scripts.filter((file) => {
            const relative = file.slice(join(ROOT, 'apps/api').length + 1).replaceAll('\\', '/');
            if (SCRIPT_DOC_EXEMPTIONS.has(relative)) return false;
            if (
                Object.values(packageJson.scripts ?? {}).some((command) =>
                    command.includes(relative)
                )
            )
                return false;
            const source = readFileSync(file, 'utf8');
            const base = relative
                .split('/')
                .at(-1)
                ?.replace(/\.tsx?$/, '');
            return !source.includes('tsx') || !source.includes(base ?? '');
        });

        // Assert
        expect(undocumented.map((file) => file.slice(join(ROOT, 'apps/api').length + 1))).toEqual(
            []
        );
    });
});
