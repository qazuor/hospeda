import { describe, expect, it } from 'vitest';
import {
    discoverCommands,
    getPackagePrefix,
    isExcludedScript,
    parseWorkspacePatterns
} from '../discovery.js';
import type { CliCommand } from '../types.js';

describe('parseWorkspacePatterns', () => {
    it('should parse standard pnpm-workspace.yaml format', () => {
        // Arrange
        const content = `packages:
  - "apps/*"
  - "packages/*"
`;

        // Act
        const patterns = parseWorkspacePatterns({ content });

        // Assert
        expect(patterns).toEqual(['apps/*', 'packages/*']);
    });

    it('should handle single-quoted patterns', () => {
        // Arrange
        const content = `packages:
  - 'apps/*'
`;

        // Act
        const patterns = parseWorkspacePatterns({ content });

        // Assert
        expect(patterns).toEqual(['apps/*']);
    });

    it('should handle unquoted patterns', () => {
        // Arrange
        const content = `packages:
  - apps/*
  - packages/*
`;

        // Act
        const patterns = parseWorkspacePatterns({ content });

        // Assert
        expect(patterns).toEqual(['apps/*', 'packages/*']);
    });

    it('should stop parsing at next top-level key', () => {
        // Arrange
        const content = `packages:
  - apps/*
catalog:
  react: ^19
`;

        // Act
        const patterns = parseWorkspacePatterns({ content });

        // Assert
        expect(patterns).toEqual(['apps/*']);
    });

    it('should skip comments within packages block', () => {
        // Arrange
        const content = `packages:
  - apps/*
  # This is a comment
  - packages/*
`;

        // Act
        const patterns = parseWorkspacePatterns({ content });

        // Assert
        expect(patterns).toEqual(['apps/*', 'packages/*']);
    });

    it('should return empty array when no packages key found', () => {
        // Arrange
        const content = `catalog:
  react: ^19
`;

        // Act
        const patterns = parseWorkspacePatterns({ content });

        // Assert
        expect(patterns).toEqual([]);
    });

    it('should return empty array for empty content', () => {
        // Arrange & Act
        const patterns = parseWorkspacePatterns({ content: '' });

        // Assert
        expect(patterns).toEqual([]);
    });

    it('should reject patterns with .. (directory traversal)', () => {
        // Arrange
        const content = `packages:
  - ../outside/*
  - apps/*
`;

        // Act
        const patterns = parseWorkspacePatterns({ content });

        // Assert
        expect(patterns).toEqual(['apps/*']);
    });

    it('should reject absolute path patterns', () => {
        // Arrange
        const content = `packages:
  - /etc/passwd
  - apps/*
`;

        // Act
        const patterns = parseWorkspacePatterns({ content });

        // Assert
        expect(patterns).toEqual(['apps/*']);
    });

    it('should skip empty patterns after stripping quotes', () => {
        // Arrange
        const content = `packages:
  - ""
  - apps/*
`;

        // Act
        const patterns = parseWorkspacePatterns({ content });

        // Assert
        expect(patterns).toEqual(['apps/*']);
    });
});

describe('getPackagePrefix', () => {
    it('should strip @repo/ prefix', () => {
        expect(getPackagePrefix({ name: '@repo/db' })).toBe('db');
    });

    it('should strip hospeda- prefix', () => {
        expect(getPackagePrefix({ name: 'hospeda-api' })).toBe('api');
    });

    it('should return name unchanged when no prefix matches', () => {
        expect(getPackagePrefix({ name: 'admin' })).toBe('admin');
    });

    it('should handle @repo/ with nested path', () => {
        expect(getPackagePrefix({ name: '@repo/service-core' })).toBe('service-core');
    });
});

describe('isExcludedScript', () => {
    const emptyCurated = new Set<string>();

    it('should exclude npm lifecycle hooks', () => {
        expect(isExcludedScript({ script: 'prepare', curatedIds: emptyCurated })).toBe(true);
        expect(isExcludedScript({ script: 'preinstall', curatedIds: emptyCurated })).toBe(true);
        expect(isExcludedScript({ script: 'postinstall', curatedIds: emptyCurated })).toBe(true);
        expect(isExcludedScript({ script: 'prepublishOnly', curatedIds: emptyCurated })).toBe(true);
    });

    it('should exclude turbo-orchestrated scripts when curated ID exists', () => {
        const curatedIds = new Set(['build', 'lint']);
        expect(isExcludedScript({ script: 'build', curatedIds })).toBe(true);
        expect(isExcludedScript({ script: 'lint', curatedIds })).toBe(true);
    });

    it('should not exclude turbo scripts when no curated ID exists', () => {
        expect(isExcludedScript({ script: 'build', curatedIds: emptyCurated })).toBe(false);
    });

    it('should not exclude regular scripts', () => {
        expect(isExcludedScript({ script: 'db:start', curatedIds: emptyCurated })).toBe(false);
        expect(isExcludedScript({ script: 'seed', curatedIds: emptyCurated })).toBe(false);
    });

    it('should exclude prebuild and postbuild hooks', () => {
        expect(isExcludedScript({ script: 'prebuild', curatedIds: emptyCurated })).toBe(true);
        expect(isExcludedScript({ script: 'postbuild', curatedIds: emptyCurated })).toBe(true);
    });
});

describe('discoverCommands', () => {
    it('should return empty when pnpm-workspace.yaml is not found', async () => {
        // Arrange - point to a directory that doesn't have the workspace file
        const result = await discoverCommands({
            curatedCommands: [],
            rootDir: '/tmp/nonexistent-dir-for-discovery-test'
        });

        // Assert
        expect(result).toEqual([]);
    });

    it('should deduplicate by execution (filter+script) not just ID', async () => {
        // Arrange - create curated command with different ID but same execution
        const curated: CliCommand[] = [
            {
                id: 'seed:required',
                description: 'Run required seeds',
                category: 'database',
                execution: { type: 'pnpm-filter', filter: '@repo/seed', script: 'seed:required' },
                source: '@repo/seed',
                mode: 'one-shot',
                curated: true
            }
        ];

        // Act - discover from the real workspace
        const discovered = await discoverCommands({
            curatedCommands: curated,
            rootDir: process.cwd()
        });

        // Assert - should not find a duplicate for @repo/seed seed:required
        const dupes = discovered.filter(
            (c) =>
                c.execution.type === 'pnpm-filter' &&
                c.execution.filter === '@repo/seed' &&
                c.execution.script === 'seed:required'
        );
        expect(dupes).toHaveLength(0);
    });

    it('should exclude turbo-orchestrated scripts that exist as root curated commands', async () => {
        // Arrange
        const curated: CliCommand[] = [
            {
                id: 'build',
                description: 'Build all packages',
                category: 'build',
                execution: { type: 'pnpm-root', script: 'build' },
                source: 'root',
                mode: 'one-shot',
                curated: true
            }
        ];

        // Act
        const discovered = await discoverCommands({
            curatedCommands: curated,
            rootDir: process.cwd()
        });

        // Assert - no package-level "build" scripts should appear
        const buildCommands = discovered.filter(
            (c) => c.execution.type === 'pnpm-filter' && c.execution.script === 'build'
        );
        expect(buildCommands).toHaveLength(0);
    });
});
