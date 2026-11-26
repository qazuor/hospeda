import { describe, expect, it } from 'vitest';
import { isRedundantText } from '@/lib/is-redundant-text';

describe('isRedundantText', () => {
    it.each([
        [' ¡Ático, céntrico! ', 'atico  centrico', true],
        ['Ático céntrico.', 'Atico centrico, con balcón', true],
        ['Sol', 'Solarium', false],
        ['Casa con luces', 'Casa de dos plantas iluminada', false],
        ['Casa con patio', 'Casa', false],
        ['...', 'Casa', false]
    ] as const)('compares %s against %s', (a, b, expected) => {
        const redundant = isRedundantText({ a, b });

        expect(redundant).toBe(expected);
    });
});
