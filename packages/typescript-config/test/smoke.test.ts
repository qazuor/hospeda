import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Resolved path to the package root */
const PACKAGE_ROOT = path.resolve(__dirname, '..');

/**
 * Reads and parses a JSON tsconfig file, returning its contents.
 * Throws a descriptive error if the file is missing or contains invalid JSON.
 */
const readTsConfig = (fileName: string): Record<string, unknown> => {
    const filePath = path.join(PACKAGE_ROOT, fileName);
    expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
};

describe('package.json', () => {
    it('exists at package root', () => {
        const pkgPath = path.join(PACKAGE_ROOT, 'package.json');
        expect(fs.existsSync(pkgPath)).toBe(true);
    });

    it('contains the correct package name', () => {
        const pkgPath = path.join(PACKAGE_ROOT, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name: string };
        expect(pkg.name).toBe('@repo/typescript-config');
    });
});

describe('base.json', () => {
    it('exists and is valid JSON', () => {
        expect(() => readTsConfig('base.json')).not.toThrow();
    });

    it('contains compilerOptions', () => {
        const config = readTsConfig('base.json');
        expect(config).toHaveProperty('compilerOptions');
        expect(typeof config.compilerOptions).toBe('object');
    });

    it('enables strict mode', () => {
        const config = readTsConfig('base.json');
        const opts = config.compilerOptions as Record<string, unknown>;
        expect(opts.strict).toBe(true);
    });

    it('targets ESNext module', () => {
        const config = readTsConfig('base.json');
        const opts = config.compilerOptions as Record<string, unknown>;
        expect(opts.module).toBe('ESNext');
    });

    it('has a target of ES2022 or higher', () => {
        const config = readTsConfig('base.json');
        const opts = config.compilerOptions as Record<string, unknown>;
        const target = opts.target as string;
        expect(['ES2022', 'ES2023', 'ES2024', 'ESNext']).toContain(target);
    });

    it('enables isolatedModules', () => {
        const config = readTsConfig('base.json');
        const opts = config.compilerOptions as Record<string, unknown>;
        expect(opts.isolatedModules).toBe(true);
    });

    it('has a $schema field pointing to tsconfig schema store', () => {
        const config = readTsConfig('base.json');
        expect(config).toHaveProperty('$schema');
        expect(config.$schema).toMatch(/tsconfig/);
    });
});

describe('react-library.json', () => {
    it('exists and is valid JSON', () => {
        expect(() => readTsConfig('react-library.json')).not.toThrow();
    });

    it('extends base.json', () => {
        const config = readTsConfig('react-library.json');
        expect(config).toHaveProperty('extends');
        expect(config.extends).toContain('base.json');
    });

    it('configures JSX for React', () => {
        const config = readTsConfig('react-library.json');
        const opts = config.compilerOptions as Record<string, unknown>;
        expect(opts.jsx).toBe('react-jsx');
    });
});

describe('package-base.json', () => {
    it('exists and is valid JSON', () => {
        expect(() => readTsConfig('package-base.json')).not.toThrow();
    });

    it('contains compilerOptions or extends another config', () => {
        const config = readTsConfig('package-base.json');
        const hasCompilerOptions = 'compilerOptions' in config;
        const hasExtends = 'extends' in config;
        expect(hasCompilerOptions || hasExtends).toBe(true);
    });
});

describe('app-base.json', () => {
    it('exists and is valid JSON', () => {
        expect(() => readTsConfig('app-base.json')).not.toThrow();
    });

    it('contains compilerOptions or extends another config', () => {
        const config = readTsConfig('app-base.json');
        const hasCompilerOptions = 'compilerOptions' in config;
        const hasExtends = 'extends' in config;
        expect(hasCompilerOptions || hasExtends).toBe(true);
    });

    it('does not emit files (noEmit)', () => {
        const config = readTsConfig('app-base.json');
        const opts = config.compilerOptions as Record<string, unknown> | undefined;
        // app-base uses noEmit: true or allowImportingTsExtensions which implies noEmit
        if (opts) {
            const isNoEmit = opts.noEmit === true || opts.allowImportingTsExtensions === true;
            expect(isNoEmit).toBe(true);
        }
    });
});

describe('all tsconfig files are parseable JSON', () => {
    const expectedFiles = ['base.json', 'react-library.json', 'package-base.json', 'app-base.json'];

    for (const fileName of expectedFiles) {
        it(`${fileName} parses without error`, () => {
            const filePath = path.join(PACKAGE_ROOT, fileName);
            const content = fs.readFileSync(filePath, 'utf-8');
            expect(() => JSON.parse(content)).not.toThrow();
        });
    }
});
