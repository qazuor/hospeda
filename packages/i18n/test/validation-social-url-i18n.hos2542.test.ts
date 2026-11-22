/**
 * HOS-2542: the social-network URL validation messages were Spanish copies in
 * the en and pt catalogs, so the profile form showed Spanish (or zod's raw
 * "Invalid URL") outside es.
 */
import { describe, expect, it } from 'vitest';
import en from '../src/locales/en/validation.json';
import es from '../src/locales/es/validation.json';
import pt from '../src/locales/pt/validation.json';

type SocialBlock = Record<string, { invalid: string; pattern: string }>;
const social = (catalog: unknown): SocialBlock =>
    (catalog as { common: { social: SocialBlock } }).common.social;

const NETWORKS = ['facebook', 'instagram', 'twitter', 'linkedIn', 'tiktok', 'youtube'] as const;

describe('zodError.common.social messages (HOS-2542)', () => {
    it.each(NETWORKS)('%s is translated in en and pt (differs from es)', (network) => {
        // Arrange
        const base = social(es)[network];

        // Act
        const enBlock = social(en)[network];
        const ptBlock = social(pt)[network];

        // Assert
        for (const field of ['invalid', 'pattern'] as const) {
            expect(enBlock[field]).not.toBe(base[field]);
            expect(ptBlock[field]).not.toBe(base[field]);
            expect(enBlock[field]).not.toBe(ptBlock[field]);
        }
    });
});
