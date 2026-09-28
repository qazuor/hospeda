/**
 * Every public commerce read that returns a WHOLE listing filters hidden FAQs
 * (HOS-1263).
 *
 * WHY A STATIC GUARD: the services load `faqs: true` by default, so any route
 * that returns `getById` / `getBySlug` data ships the embedded FAQs whether or
 * not it ever mentions the word `faqs`. Forgetting the filter therefore leaves
 * no trace in the file and no failing test, and it already happened once: the
 * dedicated `/faqs` route filtered while the listing page's own read did not.
 * A route named after its file would not cover the next vertical, so this scans
 * the public directory of each commerce vertical for anything that calls the
 * service's whole-entity reads.
 *
 * @module test/utils/commerce-faq-visibility.guard
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES = join(import.meta.dirname, '..', '..', 'src', 'routes');
const VERTICALS = ['gastronomy', 'experience'] as const;

/** A call that returns a listing with its embedded `faqs` relation. */
const WHOLE_ENTITY_READ = /Service\.(getById|getBySlug)\(/;

const publicRouteFiles = (vertical: string): readonly string[] =>
    readdirSync(join(ROUTES, vertical, 'public'))
        .filter((f) => f.endsWith('.ts'))
        .map((f) => join(ROUTES, vertical, 'public', f));

describe('commerce public routes filter hidden FAQs (HOS-1263)', () => {
    const readers = VERTICALS.flatMap((v) => publicRouteFiles(v)).filter((file) =>
        WHOLE_ENTITY_READ.test(readFileSync(file, 'utf8'))
    );

    it('finds the whole-entity readers (guard is not vacuous)', () => {
        expect(readers.length).toBeGreaterThanOrEqual(4);
    });

    it.each(readers)('%s applies withPublicVisibleFaqs', (file) => {
        expect(readFileSync(file, 'utf8')).toContain('withPublicVisibleFaqs(');
    });
});
