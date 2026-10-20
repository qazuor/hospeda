/**
 * The probe manifest: pure data at a fixed path, validated when the module
 * loads, readable both as a module and as a file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    isProbeSubject,
    PROBE_MANIFEST,
    PROBE_MANIFEST_PATH,
    parseProbeManifest
} from '../src/index';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

describe('the probe manifest', () => {
    it('lives at the fixed path other tooling reads', () => {
        expect(PROBE_MANIFEST_PATH).toBe('packages/payments/src/probes/probes.json');
        expect(existsSync(resolve(REPO_ROOT, PROBE_MANIFEST_PATH))).toBe(true);
    });

    it('is pure data, and the module exposes exactly what the file holds', () => {
        // Arrange
        const raw: unknown = JSON.parse(
            readFileSync(resolve(REPO_ROOT, PROBE_MANIFEST_PATH), 'utf8')
        );

        // Assert
        expect(Object.keys(raw as object)).toEqual(['ids']);
        expect(PROBE_MANIFEST).toEqual(raw);
    });

    it('is born empty', () => {
        expect(PROBE_MANIFEST.ids).toEqual([]);
    });

    it.each([
        ['an extra key', { ids: [], note: 'x' }],
        ['a duplicated id', { ids: ['a', 'a'] }],
        ['an empty id', { ids: [' '] }],
        ['a non-string id', { ids: [1] }],
        ['no ids', {}]
    ])('refuses %s', (_name, input) => {
        expect(() => parseProbeManifest({ input })).toThrow();
    });

    it('answers whether a subject is a probe', () => {
        // Arrange
        const { manifest } = parseProbeManifest({ input: { ids: ['probe-1'] } });

        // Assert
        expect(isProbeSubject({ id: 'probe-1', manifest }).isProbe).toBe(true);
        expect(isProbeSubject({ id: 'other', manifest }).isProbe).toBe(false);
        expect(isProbeSubject({ id: 'probe-1' }).isProbe).toBe(false);
    });
});
