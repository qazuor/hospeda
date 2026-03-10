import { describe, expect, it } from 'vitest';
import {
    CATEGORY_DISPLAY_ORDER,
    CATEGORY_LABELS,
    inferCategory,
    inferMode
} from '../categories.js';
import type { CommandCategory } from '../types.js';

describe('CATEGORY_DISPLAY_ORDER', () => {
    it('should have exactly 9 entries', () => {
        expect(CATEGORY_DISPLAY_ORDER).toHaveLength(9);
    });

    it('should contain all expected categories', () => {
        const expected: CommandCategory[] = [
            'development',
            'database',
            'testing',
            'code-quality',
            'build',
            'environment',
            'documentation',
            'infrastructure',
            'package-tools'
        ];
        expect([...CATEGORY_DISPLAY_ORDER]).toEqual(expected);
    });
});

describe('CATEGORY_LABELS', () => {
    it('should have an entry for every category in CATEGORY_DISPLAY_ORDER', () => {
        for (const category of CATEGORY_DISPLAY_ORDER) {
            expect(CATEGORY_LABELS).toHaveProperty(category);
            expect(typeof CATEGORY_LABELS[category]).toBe('string');
            expect(CATEGORY_LABELS[category].length).toBeGreaterThan(0);
        }
    });

    it('should have exactly 9 label entries', () => {
        expect(Object.keys(CATEGORY_LABELS)).toHaveLength(9);
    });
});

describe('inferCategory', () => {
    it('should return build for build* scripts', () => {
        expect(inferCategory({ scriptName: 'build' })).toBe('build');
        expect(inferCategory({ scriptName: 'build:api' })).toBe('build');
        expect(inferCategory({ scriptName: 'build:all' })).toBe('build');
    });

    it('should return development for dev* scripts', () => {
        expect(inferCategory({ scriptName: 'dev' })).toBe('development');
        expect(inferCategory({ scriptName: 'dev:api' })).toBe('development');
        expect(inferCategory({ scriptName: 'dev:all' })).toBe('development');
    });

    it('should return testing for test* scripts', () => {
        expect(inferCategory({ scriptName: 'test' })).toBe('testing');
        expect(inferCategory({ scriptName: 'test:watch' })).toBe('testing');
        expect(inferCategory({ scriptName: 'test:coverage' })).toBe('testing');
    });

    it('should return code-quality for lint* scripts', () => {
        expect(inferCategory({ scriptName: 'lint' })).toBe('code-quality');
        expect(inferCategory({ scriptName: 'lint:md' })).toBe('code-quality');
    });

    it('should return code-quality for format* scripts', () => {
        expect(inferCategory({ scriptName: 'format' })).toBe('code-quality');
        expect(inferCategory({ scriptName: 'format:md' })).toBe('code-quality');
    });

    it('should return code-quality for check* scripts', () => {
        expect(inferCategory({ scriptName: 'check' })).toBe('code-quality');
        expect(inferCategory({ scriptName: 'check:types' })).toBe('code-quality');
    });

    it('should return code-quality for typecheck* scripts', () => {
        expect(inferCategory({ scriptName: 'typecheck' })).toBe('code-quality');
        expect(inferCategory({ scriptName: 'typecheck:strict' })).toBe('code-quality');
    });

    it('should return database for db:* scripts', () => {
        expect(inferCategory({ scriptName: 'db:start' })).toBe('database');
        expect(inferCategory({ scriptName: 'db:migrate' })).toBe('database');
        expect(inferCategory({ scriptName: 'db:seed' })).toBe('database');
    });

    it('should return database for seed* scripts', () => {
        expect(inferCategory({ scriptName: 'seed' })).toBe('database');
        expect(inferCategory({ scriptName: 'seed:required' })).toBe('database');
    });

    it('should return database for migrate* scripts', () => {
        expect(inferCategory({ scriptName: 'migrate' })).toBe('database');
        expect(inferCategory({ scriptName: 'migrate:prod' })).toBe('database');
    });

    it('should return build for clean* scripts', () => {
        expect(inferCategory({ scriptName: 'clean' })).toBe('build');
        expect(inferCategory({ scriptName: 'clean:all' })).toBe('build');
    });

    it('should return package-tools for unknown scripts', () => {
        expect(inferCategory({ scriptName: 'generate:types' })).toBe('package-tools');
        expect(inferCategory({ scriptName: 'telemetry:report' })).toBe('package-tools');
        expect(inferCategory({ scriptName: 'i18n:generate-types' })).toBe('package-tools');
        expect(inferCategory({ scriptName: 'unknown-command' })).toBe('package-tools');
    });

    it('should return environment for env* scripts', () => {
        expect(inferCategory({ scriptName: 'env:check' })).toBe('environment');
        expect(inferCategory({ scriptName: 'env:pull' })).toBe('environment');
    });

    it('should return documentation for docs:* and doc:* scripts', () => {
        expect(inferCategory({ scriptName: 'docs:build' })).toBe('documentation');
        expect(inferCategory({ scriptName: 'doc:generate' })).toBe('documentation');
    });

    it('should return infrastructure for setup* scripts', () => {
        expect(inferCategory({ scriptName: 'setup' })).toBe('infrastructure');
        expect(inferCategory({ scriptName: 'setup:db' })).toBe('infrastructure');
    });

    it('should handle empty string gracefully', () => {
        // Empty string doesn't match any prefix, falls through to package-tools
        expect(inferCategory({ scriptName: '' })).toBe('package-tools');
    });

    it('should be case-sensitive (uppercase BUILD is not build)', () => {
        // Uppercase doesn't match lowercase-only startsWith checks
        expect(inferCategory({ scriptName: 'BUILD' })).toBe('package-tools');
    });

    it('should match first matching rule (priority order)', () => {
        // "dev:test" starts with "dev" so it should be development, not testing
        expect(inferCategory({ scriptName: 'dev:test' })).toBe('development');
    });
});

describe('inferMode', () => {
    it('should return long-running for dev* scripts', () => {
        expect(inferMode({ scriptName: 'dev' })).toBe('long-running');
        expect(inferMode({ scriptName: 'dev:api' })).toBe('long-running');
        expect(inferMode({ scriptName: 'dev:all' })).toBe('long-running');
    });

    it('should return long-running for *:watch scripts', () => {
        expect(inferMode({ scriptName: 'test:watch' })).toBe('long-running');
        expect(inferMode({ scriptName: 'build:watch' })).toBe('long-running');
        expect(inferMode({ scriptName: 'lint:watch' })).toBe('long-running');
    });

    it('should return one-shot for all other scripts', () => {
        expect(inferMode({ scriptName: 'test' })).toBe('one-shot');
        expect(inferMode({ scriptName: 'build' })).toBe('one-shot');
        expect(inferMode({ scriptName: 'lint' })).toBe('one-shot');
        expect(inferMode({ scriptName: 'db:migrate' })).toBe('one-shot');
        expect(inferMode({ scriptName: 'env:check' })).toBe('one-shot');
    });
});
