/**
 * Every public gastronomy or experience read that returns a WHOLE listing filters hidden FAQs
 * (HOS-1263).
 *
 * WHY A STATIC GUARD: the services load `faqs: true` by default, so any route
 * that returns `getById` / `getBySlug` data ships the embedded FAQs whether or
 * not it ever mentions the word `faqs`. Forgetting the filter therefore leaves
 * no trace in the file and no failing test, and it already happened once: the
 * dedicated `/faqs` route filtered while the listing page's own read did not.
 * A route named after its file would not cover the next vertical, so this scans
 * the public directory of each gastronomy or experience vertical for anything that calls the
 * service's whole-entity reads.
 *
 * @module test/utils/listing-faq-visibility.guard
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES = join(import.meta.dirname, '..', '..', 'src', 'routes');
const VERTICALS = ['gastronomy', 'experience'] as const;

/**
 * A call that returns a listing with its embedded `faqs` relation, on ANY
 * receiver (a service, a model, a local alias), or the dedicated FAQ list.
 */
const READ = /\.(getById|getBySlug|getByName|getByField)\(|\blist\w*Faqs\(/;

/** The filter helpers, with the first identifier of their argument captured. */
const HELPER_CALL = /\b(?:withPublicVisibleFaqs|filterPublicFaqs)\(\s*([A-Za-z_$][\w$]*)/g;

const filesUnder = (dir: string): readonly string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return filesUnder(full);
        return entry.name.endsWith('.ts') ? [full] : [];
    });

/** Names holding the read's result: `result` and anything assigned from `result.data`. */
const resultNames = (source: string): ReadonlySet<string> => {
    const names = new Set<string>(['result']);
    for (const m of source.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*result\.data/g)) {
        if (m[1]) names.add(m[1]);
    }
    return names;
};

/** Whether a helper call comes after the read AND wraps a value derived from it. */
const wrapsTheRead = (source: string): boolean => {
    const readAt = source.search(READ);
    const names = resultNames(source);
    return [...source.matchAll(HELPER_CALL)].some(
        (m) => (m.index ?? -1) > readAt && names.has(m[1] ?? '')
    );
};

describe('gastronomy and experience public routes filter non-public FAQs (HOS-1263)', () => {
    const readers = VERTICALS.flatMap((v) => filesUnder(join(ROUTES, v, 'public'))).filter((file) =>
        READ.test(readFileSync(file, 'utf8'))
    );

    it('finds the whole-entity and FAQ readers (guard is not vacuous)', () => {
        expect(readers.length).toBeGreaterThanOrEqual(6);
    });

    it.each(readers)('%s wraps the returned value in the FAQ filter', (file) => {
        expect(wrapsTheRead(readFileSync(file, 'utf8'))).toBe(true);
    });

    it('rejects a helper that merely appears in the file (self-check)', () => {
        const decoy = `const r = await svc.getBySlug(a, b);\nconst x = withPublicVisibleFaqs(other);`;
        expect(wrapsTheRead(decoy)).toBe(false);
    });
});
