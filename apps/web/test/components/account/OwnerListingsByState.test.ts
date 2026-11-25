/** SSR wiring contracts for the shared Astro list (logic is tested independently). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '@/lib/i18n';

const read = (path: string) => readFileSync(resolve(__dirname, '../../../src', path), 'utf8');

describe('D6 shared owner list', () => {
    const list = read('components/account/OwnerListingsByState.astro');
    it('omits empty buckets, counts each section, and collapses only archives and deleted rows', () => {
        expect(list).toContain('counts[bucket] > 0');
        // biome-ignore lint/suspicious/noTemplateCurlyInString: assert the Astro source expression.
        expect(list).toContain('`${label} (${counts[bucket]})`');
        expect(list).toContain("bucket === 'archived' || bucket === 'deleted'");
        expect(list).toContain('<Disclosure summary={title}>');
        expect(list).not.toContain('defaultOpen');
        expect(list).toContain("Astro.slots.render('default', [bucket])");
        expect(list.match(/<Section /g)).toHaveLength(2);
        expect(list.match(/helpId=\{helpId\}/g)?.length).toBeGreaterThanOrEqual(2);
    });
    it.each([
        'propiedades',
        'comercio'
    ])('%s uses the shared grouping and card rendering', (page) => {
        const source = read(`pages/[lang]/mi-cuenta/${page}/index.astro`);
        expect(source).toContain('<OwnerListingsByState');
        expect(source).toContain('bucketOwnerListings({ listings');
        expect(source).toContain('(bucket: OwnerListingBucket) => buckets[bucket].map');
        if (page === 'propiedades') {
            expect(source).toContain('<Pagination');
            expect(source).toContain('page={pageState.page}');
        }
    });
    it('the accommodation adapter delegates without retaining card decisions', () => {
        const source = read('components/host/PropertyCard.astro');
        expect(source).toContain('<OwnerListingCard {...Astro.props} />');
        expect(source).not.toContain('resolvePropertyCardActions');
    });
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('supplies translated bucket labels and explicit publishing capacity in %s', (locale) => {
        const { t, tPlural } = createTranslations(locale);
        for (const bucket of ['published', 'drafts', 'archived', 'deleted']) {
            expect(t(`listing.owner.list.buckets.${bucket}`)).not.toContain('listing.owner');
        }
        for (const key of [
            'host.properties.usage.label',
            'listing.owner.list.usage.venue.label',
            'listing.owner.list.usage.experience.label'
        ]) {
            const text = tPlural(key, 6, { current: 1, max: 6 });
            expect(text).toContain('1');
            expect(text).toContain('6');
            expect(text).toMatch(/publica|Publishing/);
        }
    });
});
