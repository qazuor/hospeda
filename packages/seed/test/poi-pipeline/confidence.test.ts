import { describe, expect, it } from 'vitest';
import { classifyConfidence, resolveConfidence } from '../../scripts/poi-pipeline/confidence.js';
import type { RawGeocodeHit } from '../../scripts/poi-pipeline/geocoder.js';

function hit(importance: number): RawGeocodeHit {
    return {
        lat: -31.4,
        long: -58,
        importance,
        featureClass: 'place',
        featureType: 'town',
        displayName: 'X',
        provider: 'nominatim'
    };
}

describe('classifyConfidence', () => {
    it('classifies importance >= 0.5 as high', () => {
        expect(classifyConfidence(hit(0.5))).toBe('high');
        expect(classifyConfidence(hit(0.9))).toBe('high');
    });

    it('classifies 0.35 <= importance < 0.5 as medium', () => {
        expect(classifyConfidence(hit(0.35))).toBe('medium');
        expect(classifyConfidence(hit(0.49))).toBe('medium');
    });

    it('classifies importance < 0.35 as low', () => {
        expect(classifyConfidence(hit(0.34))).toBe('low');
        expect(classifyConfidence(hit(0))).toBe('low');
    });
});

describe('resolveConfidence', () => {
    it('accepts a high hit as a written coordinate', () => {
        const { tier, result } = resolveConfidence(hit(0.7));
        expect(tier).toBe('high');
        expect(result).toEqual({
            lat: -31.4,
            long: -58,
            confidence: 'high',
            provider: 'nominatim'
        });
    });

    it('accepts a medium hit', () => {
        const { tier, result } = resolveConfidence(hit(0.4));
        expect(tier).toBe('medium');
        expect(result?.confidence).toBe('medium');
    });

    it('rejects a low hit: reported as low but no coordinate written', () => {
        const { tier, result } = resolveConfidence(hit(0.1));
        expect(tier).toBe('low');
        expect(result).toBeNull();
    });

    it('reports unresolved for a null hit', () => {
        const { tier, result } = resolveConfidence(null);
        expect(tier).toBe('unresolved');
        expect(result).toBeNull();
    });
});
