import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DEFINING_STATEMENT = 'The single place where verticals and billing talk to each other';
const PACKAGE_ROOT = resolve(import.meta.dirname, '..');

describe('@repo/billing-verticals-contract package shape', () => {
    it('exports nothing from its entry point', async () => {
        // Arrange / Act
        const entry = await import('../src/index');

        // Assert
        expect(Object.keys(entry)).toEqual([]);
    });

    it('states in package.json what the package is', () => {
        // Arrange
        const manifest = JSON.parse(
            readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8')
        ) as {
            description: string;
        };

        // Act / Assert
        expect(manifest.description).toContain(DEFINING_STATEMENT);
    });

    it('states in README.md what the package is', () => {
        // Arrange
        const readme = readFileSync(resolve(PACKAGE_ROOT, 'README.md'), 'utf8');

        // Act / Assert
        expect(readme).toContain(DEFINING_STATEMENT);
    });
});
