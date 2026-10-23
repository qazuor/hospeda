/** @module test/components/shared/layout/ListingPageHeader */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/layout/ListingPageHeader.astro'),
    'utf8'
);

const ruleFor = (className: string): string => {
    const match = source.match(new RegExp(`\\.${className}\\s*\\{([^}]+)\\}`));
    expect(match, `missing CSS rule for ${className}`).not.toBeNull();
    return match?.[1] ?? '';
};

describe('TEST:1768:10 ListingPageHeader mobile tagline', () => {
    it.each([
        'listing-page-header__tagline',
        'listing-page-header__subtitle'
    ])('%s allows four complete lines and keeps compact collapse timing', (className) => {
        const rule = ruleFor(className);
        expect(rule).toMatch(/line-height:\s*1\.6\s*;/);
        expect(rule).toMatch(/max-height:\s*6\.4em\s*;/);
        expect(rule).toMatch(/overflow:\s*hidden\s*;/);
        expect(rule).toMatch(/max-height\s+var\(--wave-header-anim-duration,\s*0\.3s\)/);
    });
});
