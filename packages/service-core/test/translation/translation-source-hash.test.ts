/**
 * @file translation-source-hash.test.ts
 *
 * Unit tests for the translation source fingerprint (HOS-2658, DL-2).
 */

import { describe, expect, it } from 'vitest';
import {
    computeTranslationSourceHash,
    normalizeTranslationSource
} from '../../src/translation/translation-source-hash';

const CASA_DEL_SOL_SHA256 = 'e7783497930418ae6ee6caf5942791ed8ba8ce22a206d4407b5f7649b81e1559';

describe('normalizeTranslationSource', () => {
    it('trims both ends and converts CRLF and CR to LF', () => {
        // Arrange
        const text = '  Línea 1\r\nLínea 2\rLínea 3\n  ';

        // Act
        const result = normalizeTranslationSource({ text });

        // Assert
        expect(result).toEqual({ normalized: 'Línea 1\nLínea 2\nLínea 3' });
    });

    it('keeps internal whitespace', () => {
        // Arrange / Act
        const result = normalizeTranslationSource({ text: 'a  b\n\nc' });

        // Assert
        expect(result).toEqual({ normalized: 'a  b\n\nc' });
    });
});

describe('computeTranslationSourceHash', () => {
    it('matches the known sha256 vector for "Casa del Sol"', () => {
        // Arrange / Act
        const result = computeTranslationSourceHash({ text: 'Casa del Sol' });

        // Assert
        expect(result).toEqual({ hash: CASA_DEL_SOL_SHA256 });
    });

    it('hashes a padded CRLF-terminated source like its trimmed form', () => {
        // Arrange / Act
        const padded = computeTranslationSourceHash({ text: ' Casa del Sol\r\n' });

        // Assert
        expect(padded.hash).toBe(CASA_DEL_SOL_SHA256);
    });

    it('hashes composed and decomposed characters identically (NFC)', () => {
        // Arrange
        const composed = 'Cañada';
        const decomposed = 'Cañada';

        // Act
        const a = computeTranslationSourceHash({ text: composed });
        const b = computeTranslationSourceHash({ text: decomposed });

        // Assert
        expect(composed).not.toBe(decomposed);
        expect(b.hash).toBe(a.hash);
    });

    it('distinguishes sources that differ only in internal whitespace', () => {
        // Arrange / Act
        const double = computeTranslationSourceHash({ text: 'a  b' });
        const single = computeTranslationSourceHash({ text: 'a b' });

        // Assert
        expect(double.hash).not.toBe(single.hash);
    });

    it('returns 64 lowercase hex characters', () => {
        // Arrange / Act
        const { hash } = computeTranslationSourceHash({ text: 'Descripción con acentos' });

        // Assert
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
});
