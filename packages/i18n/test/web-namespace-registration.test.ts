/**
 * Every web namespace must be registered for EVERY locale (HOS-1823).
 *
 * A namespace dropped from one locale's block in `rawWebTranslations` silently
 * falls back to the raw key for that language only; no other suite noticed
 * when `venue: venuePt` was removed.
 */

import { describe, expect, it } from 'vitest';
import { locales, rawWebTranslations, webNamespaces } from '../src/config.shared';

describe('web namespace registration', () => {
    it.each(locales)('registers every web namespace for %s', (locale) => {
        // Arrange
        const registered = Object.keys(rawWebTranslations[locale]);

        // Act
        const missing = webNamespaces.filter((namespace) => !registered.includes(namespace));

        // Assert
        expect(missing).toEqual([]);
    });

    it('registers the venue namespace in all three locales', () => {
        for (const locale of locales) {
            expect(Object.keys(rawWebTranslations[locale])).toContain('venue');
        }
    });
});
