import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
const PUBLIC_REVIEW_READERS: Readonly<Record<string, string>> = {
    'apps/api/src/routes/accommodation/reviews/public/list.ts': 'listingShowsReviews (HOS-1502)',
    'apps/api/src/routes/experience/public/getReviews.ts': 'listingShowsReviews (HOS-1502)',
    'apps/api/src/routes/gastronomy/public/getReviews.ts': 'listingShowsReviews (HOS-1502)',
    'apps/api/src/routes/stats/public/get-platform-stats.ts':
        'listingReviewsShownCondition (HOS-1686, S2-S4)',
    'apps/api/src/routes/testimonials/public/list.ts': 'listingReviewsShownCondition (HOS-1686, S1)'
};
const REVIEW_READER_PATTERN =
    /\b(AccommodationReviewService|GastronomyReviewService|ExperienceReviewService|StatsService)\b|\b(accommodationReviews|gastronomyReviews|experienceReviews)\b/;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const file = join(dir, name);
        return statSync(file).isDirectory()
            ? sourceFiles(file)
            : /\.tsx?$/.test(name)
              ? [file]
              : [];
    });
}

describe('TEST:1686:5 AC:1686:5 public review readers census', () => {
    it('matches the frozen public listing-review reader inventory and records each rule', () => {
        const routesRoot = join(REPO_ROOT, 'apps/api/src/routes');
        const detected = sourceFiles(routesRoot)
            .map((file) => relative(REPO_ROOT, file).replaceAll('\\', '/'))
            .filter((file) => file.includes('/public/'))
            .filter((file) =>
                REVIEW_READER_PATTERN.test(readFileSync(join(REPO_ROOT, file), 'utf8'))
            )
            .sort();
        const expected = Object.keys(PUBLIC_REVIEW_READERS).sort();
        const missing = expected.filter((file) => !detected.includes(file));
        const unexpected = detected.filter((file) => !expected.includes(file));

        expect(
            { missing, unexpected },
            `lector público de reseñas nuevo o faltante; aplicar la regla y sumarlo al inventario: falta [${missing.join(', ') || '(ninguno)'}], sobra [${unexpected.join(', ') || '(ninguno)'}]`
        ).toEqual({ missing: [], unexpected: [] });
        expect(Object.values(PUBLIC_REVIEW_READERS)).toHaveLength(5);
    });
});
