/**
 * @fileoverview
 * Unit tests for `0158-hos-2086-unify-family-feature` (HOS-2086): its meta and
 * the baseline half of the dual-write (HOS-25).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0158-hos-2086-unify-family-feature.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../../src');
const readFixture = (file: string) =>
    JSON.parse(readFileSync(join(SRC, 'data/feature', file), 'utf-8')) as {
        applicableVerticals: string[];
    };

describe('0158-hos-2086-unify-family-feature meta', () => {
    it('is a required, destructive migration that needs applicable_verticals', () => {
        expect(migration.meta.name).toBe('0158-hos-2086-unify-family-feature');
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(true);
        expect(migration.meta.requiresColumns).toEqual([
            { table: 'features', column: 'applicable_verticals' }
        ]);
    });
});

describe('baseline dual-write (HOS-25)', () => {
    it('seeds family_suitable for all three verticals', () => {
        // Arrange / Act
        const fixture = readFixture('012-feature-family_suitable.json');

        // Assert
        expect(fixture.applicableVerticals).toEqual(['accommodation', 'venue', 'experience']);
    });

    it('no longer seeds family_friendly, nor lists it in the manifest', () => {
        const manifest = readFileSync(join(SRC, 'manifest-required.json'), 'utf-8');
        expect(manifest).not.toContain('085-feature-family_friendly.json');
        expect(() => readFixture('085-feature-family_friendly.json')).toThrow();
    });
});
