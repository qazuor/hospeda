import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
    resolve(
        __dirname,
        '../../../../src/components/shared/filters/filter-types/DualRangeFilter.module.css'
    ),
    'utf8'
);

describe('DualRangeFilter unbounded label contrast (HOS-2650)', () => {
    it('inks "Sin mínimo / Sin máximo" with the full muted token, never an alpha tint', () => {
        // Arrange
        const rule = css.match(/\.unboundedLabel\s*\{([^}]*)\}/)?.[1] ?? '';

        // Act
        const color = rule.match(/color:\s*([^;]+);/)?.[1]?.trim();

        // Assert
        expect(color).toBe('var(--core-muted-foreground)');
    });
});
