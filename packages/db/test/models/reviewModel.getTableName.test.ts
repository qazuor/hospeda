import { describe, expect, it } from 'vitest';
import { schema } from '../../src/client';
import { AccommodationReviewModel } from '../../src/models/accommodation/accommodationReview.model';
import { ExperienceReviewModel } from '../../src/models/experience/experienceReview.model';
import { GastronomyReviewModel } from '../../src/models/gastronomy/gastronomyReview.model';

/**
 * BETA-150 regression.
 *
 * `getTableName()` must return the Drizzle *query key* (the camelCase JS export
 * name of the table in the schema object), NOT the snake_case SQL table name.
 *
 * `findAllWithRelations` / `findOneWithRelations` read `db.query[getTableName()]`,
 * and Drizzle keys `db.query` by the schema object's export names. A snake_case
 * value (e.g. `gastronomy_reviews`) is absent from that object, so the relation
 * query threw `Invalid table configuration for: gastronomy_reviews` and every
 * public `GET /gastronomies/:id/reviews` request returned HTTP 500 in production.
 *
 * Mocked unit/service tests never exercise the real `db.query` object, so they
 * did not catch this — hence the structural assertion below against the actual
 * exported `schema`.
 */
const getTableName = (model: unknown): string =>
    (model as { getTableName: () => string }).getTableName();

describe('Review model getTableName() (BETA-150 regression)', () => {
    const cases = [
        {
            name: 'GastronomyReviewModel',
            model: new GastronomyReviewModel(),
            expected: 'gastronomyReviews'
        },
        {
            name: 'ExperienceReviewModel',
            model: new ExperienceReviewModel(),
            expected: 'experienceReviews'
        },
        {
            name: 'AccommodationReviewModel',
            model: new AccommodationReviewModel(),
            expected: 'accommodationReviews'
        }
    ] as const;

    for (const { name, model, expected } of cases) {
        it(`${name} returns the camelCase Drizzle query key`, () => {
            expect(getTableName(model)).toBe(expected);
        });

        it(`${name} query key exists on the Drizzle schema (valid db.query key)`, () => {
            // This is the root-cause guard: a snake_case name is NOT a key of the
            // schema object, so relation queries would 500 at runtime.
            expect(Object.keys(schema)).toContain(getTableName(model));
        });
    }
});
