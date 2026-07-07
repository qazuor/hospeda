/**
 * Determinism tests for the `example` seed factories wired with deterministic
 * ids (HOS-25 T-016).
 *
 * These tests intentionally stay at the "factory/config level" (per the task
 * spec) rather than running a full seed against a real database: they import
 * the exported, pure id-derivation helpers (`getAccommodationFixtureId`,
 * `getAccommodationFaqFixtureId`, `getEventFixtureId`) and assert the core
 * property a versioned data-migration depends on — the SAME fixture always
 * produces the SAME UUID, in any process, any number of times.
 *
 * A full reseed-stability integration test (actually running the seed twice
 * against a real/ephemeral database and comparing persisted ids) belongs to
 * HOS-25 T-022, which this test file explicitly does not attempt to
 * duplicate.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    AccommodationFaqModel,
    AccommodationModel,
    AccommodationReviewModel,
    DestinationReviewModel,
    EventLocationModel,
    EventModel,
    EventOrganizerModel,
    PostModel
} from '@repo/db';
import { describe, expect, it } from 'vitest';
import { getAccommodationReviewFixtureId } from '../../src/example/accommodationReviews.seed.js';
import {
    getAccommodationFaqFixtureId,
    getAccommodationFixtureId
} from '../../src/example/accommodations.seed.js';
import { getDestinationReviewFixtureId } from '../../src/example/destinationReviews.seed.js';
import { getEventLocationFixtureId } from '../../src/example/eventLocations.seed.js';
import { getEventOrganizerFixtureId } from '../../src/example/eventOrganizers.seed.js';
import { getEventFixtureId } from '../../src/example/events.seed.js';
import { getExperienceFixtureId } from '../../src/example/experiences.seed.js';
import {
    getGastronomyFaqFixtureId,
    getGastronomyFixtureId,
    getGastronomyReviewFixtureId
} from '../../src/example/gastronomies.seed.js';
import { getPostFixtureId } from '../../src/example/posts.seed.js';
import { deterministicFixtureId } from '../../src/utils/deterministicFixtureId.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_SRC_DIR = join(__dirname, '../../src');

/** Minimal shape of an accommodation fixture, for the fields these tests need. */
interface AccommodationFixture {
    id: string;
    faqs?: Array<{ question: string; answer: string; category?: string }>;
}

/** Minimal shape of an event fixture, for the fields these tests need. */
interface EventFixture {
    id: string;
}

/** Minimal shape shared by review/location/organizer fixtures, for the fields these tests need. */
interface IdOnlyFixture {
    id: string;
}

/** Minimal shape of a gastronomy FAQ/review wrapper fixture, for the fields these tests need. */
interface GastronomyChildFixtureFile {
    $gastronomyId: string;
    faqs?: unknown[];
    reviews?: Array<{ userId: string }>;
}

/** Loads and parses a JSON fixture file relative to `src/data/<entity>`. */
function loadFixture<T>(relativePath: string, folder: string): T {
    const fullPath = join(SEED_SRC_DIR, 'data', folder, relativePath);
    return JSON.parse(readFileSync(fullPath, 'utf-8')) as T;
}

/** Reads the real `manifest-example.json` file list for a given entity key. */
function readManifestFiles(
    entityKey:
        | 'accommodations'
        | 'events'
        | 'accommodationReviews'
        | 'destinationReviews'
        | 'eventLocations'
        | 'eventOrganizers'
        | 'posts'
        | 'gastronomies'
        | 'gastronomyFaqs'
        | 'gastronomyReviews'
): string[] {
    const manifestPath = join(SEED_SRC_DIR, 'manifest-example.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, string[]>;
    const files = manifest[entityKey];
    if (!files || files.length === 0) {
        throw new Error(`manifest-example.json has no entries for "${entityKey}"`);
    }
    return files;
}

/**
 * Runs the standard determinism assertions for a simple id-derivation getter
 * that follows the `deterministicFixtureId({ seedKey: '<prefix>:<fixture.id>' })`
 * convention with no additional composite key parts — accommodation reviews,
 * destination reviews, event locations, and event organizers (HOS-25 T-025)
 * all follow this shape, unlike accommodation/destination FAQs, which need a
 * composite (parent seed-key, index) key.
 */
function describeSimpleFixtureDeterminism(input: {
    label: string;
    manifestKey:
        | 'accommodationReviews'
        | 'destinationReviews'
        | 'eventLocations'
        | 'eventOrganizers'
        | 'posts';
    folder: string;
    seedKeyPrefix: string;
    getId: (item: unknown) => string;
}) {
    describe(input.label, () => {
        const files = readManifestFiles(input.manifestKey);
        const fixtures = files.map((file) => loadFixture<IdOnlyFixture>(file, input.folder));

        it('should return the same id across repeated calls for the same fixture', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            expect(input.getId(fixture)).toBe(input.getId(fixture));
        });

        it('should match the documented seed-key convention exactly', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            const expected = deterministicFixtureId({
                seedKey: `${input.seedKeyPrefix}:${fixture.id}`
            });
            expect(input.getId(fixture)).toBe(expected);
        });

        it('should produce a unique id for every real example fixture', () => {
            const ids = fixtures.map((fixture) => input.getId(fixture));
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('should be independent of process/module re-evaluation (pure function of seedKey)', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            expect(input.getId({ id: fixture.id })).toBe(input.getId(fixture));
        });
    });
}

describe('example seed determinism (HOS-25 T-016)', () => {
    describe('getAccommodationFixtureId', () => {
        const files = readManifestFiles('accommodations');
        const fixtures = files.map((file) =>
            loadFixture<AccommodationFixture>(file, 'accommodation')
        );

        it('should return the same id across repeated calls for the same fixture', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            const first = getAccommodationFixtureId(fixture);
            const second = getAccommodationFixtureId(fixture);

            expect(first).toBe(second);
        });

        it('should match the documented seed-key convention exactly', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            const expected = deterministicFixtureId({ seedKey: `accommodation:${fixture.id}` });
            expect(getAccommodationFixtureId(fixture)).toBe(expected);
        });

        it('should produce a unique id for every real example accommodation fixture', () => {
            const ids = fixtures.map((fixture) => getAccommodationFixtureId(fixture));
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('should be independent of process/module re-evaluation (pure function of seedKey)', () => {
            // Re-deriving from the raw fixture `id` string (not the object reference)
            // must produce the identical id — proves the function is a pure hash of
            // the seed-key, not something keyed off object identity or call order.
            const fixture = fixtures[10];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            const idFromOriginalObject = getAccommodationFixtureId(fixture);
            const idFromClonedObject = getAccommodationFixtureId({ id: fixture.id });

            expect(idFromClonedObject).toBe(idFromOriginalObject);
        });
    });

    describe('getEventFixtureId', () => {
        const files = readManifestFiles('events');
        const fixtures = files.map((file) => loadFixture<EventFixture>(file, 'event'));

        it('should return the same id across repeated calls for the same fixture', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            expect(getEventFixtureId(fixture)).toBe(getEventFixtureId(fixture));
        });

        it('should match the documented seed-key convention exactly', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            const expected = deterministicFixtureId({ seedKey: `event:${fixture.id}` });
            expect(getEventFixtureId(fixture)).toBe(expected);
        });

        it('should produce a unique id for every real example event fixture', () => {
            const ids = fixtures.map((fixture) => getEventFixtureId(fixture));
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    describe('cross-entity id isolation', () => {
        it('should never collide between an accommodation and an event sharing the same raw fixture id', () => {
            // A hypothetical raw fixture id string used verbatim by both entity
            // types (would never happen in practice — real ids are prefixed with
            // the entity name — but proves the entity-name prefix in the seed-key
            // genuinely isolates the two id spaces rather than relying on chance).
            const sharedRawId = 'shared-raw-fixture-id';

            const accommodationId = getAccommodationFixtureId({ id: sharedRawId });
            const eventId = getEventFixtureId({ id: sharedRawId });

            expect(accommodationId).not.toBe(eventId);
        });
    });

    describe('getAccommodationFaqFixtureId', () => {
        it('should return the same id across repeated calls for the same (accommodationSeedKey, index) pair', () => {
            const input = { accommodationSeedKey: 'accommodation:001-hotel-plaza', index: 0 };

            expect(getAccommodationFaqFixtureId(input)).toBe(getAccommodationFaqFixtureId(input));
        });

        it('should match the documented composite seed-key convention exactly', () => {
            const input = { accommodationSeedKey: 'accommodation:001-hotel-plaza', index: 2 };
            const expected = deterministicFixtureId({
                seedKey: `accommodationFaq:${input.accommodationSeedKey}:${input.index}`
            });

            expect(getAccommodationFaqFixtureId(input)).toBe(expected);
        });

        it('should produce distinct ids for different FAQ indices under the same accommodation', () => {
            const accommodationSeedKey = 'accommodation:001-hotel-plaza';
            const ids = [0, 1, 2, 3].map((index) =>
                getAccommodationFaqFixtureId({ accommodationSeedKey, index })
            );

            expect(new Set(ids).size).toBe(ids.length);
        });

        it('should produce distinct ids for the same index under different accommodations', () => {
            const idA = getAccommodationFaqFixtureId({
                accommodationSeedKey: 'accommodation:001-hotel-plaza',
                index: 0
            });
            const idB = getAccommodationFaqFixtureId({
                accommodationSeedKey: 'accommodation:002-cabana-rio',
                index: 0
            });

            expect(idA).not.toBe(idB);
        });

        it('should produce stable, unique ids for every FAQ across all real example accommodation fixtures with FAQs', () => {
            const files = readManifestFiles('accommodations');
            const fixtures = files.map((file) =>
                loadFixture<AccommodationFixture>(file, 'accommodation')
            );
            const withFaqs = fixtures.filter((fixture) => (fixture.faqs?.length ?? 0) > 0);

            // Sanity: the real dataset must actually exercise this path.
            expect(withFaqs.length).toBeGreaterThan(0);

            const allFaqIds: string[] = [];
            for (const fixture of withFaqs) {
                const accommodationSeedKey = `accommodation:${fixture.id}`;
                const faqs = fixture.faqs ?? [];
                for (let index = 0; index < faqs.length; index++) {
                    const id = getAccommodationFaqFixtureId({ accommodationSeedKey, index });
                    // Determinism: re-deriving from the same inputs is stable.
                    expect(getAccommodationFaqFixtureId({ accommodationSeedKey, index })).toBe(id);
                    allFaqIds.push(id);
                }
            }

            expect(new Set(allFaqIds).size).toBe(allFaqIds.length);
        });
    });

    describeSimpleFixtureDeterminism({
        label: 'getAccommodationReviewFixtureId (HOS-25 T-025)',
        manifestKey: 'accommodationReviews',
        folder: 'accommodationReview',
        seedKeyPrefix: 'accommodationReview',
        getId: getAccommodationReviewFixtureId
    });

    describeSimpleFixtureDeterminism({
        label: 'getDestinationReviewFixtureId (HOS-25 T-025)',
        manifestKey: 'destinationReviews',
        folder: 'destinationReview',
        seedKeyPrefix: 'destinationReview',
        getId: getDestinationReviewFixtureId
    });

    describeSimpleFixtureDeterminism({
        label: 'getEventLocationFixtureId (HOS-25 T-025)',
        manifestKey: 'eventLocations',
        folder: 'eventLocation',
        seedKeyPrefix: 'eventLocation',
        getId: getEventLocationFixtureId
    });

    describeSimpleFixtureDeterminism({
        label: 'getEventOrganizerFixtureId (HOS-25 T-025)',
        manifestKey: 'eventOrganizers',
        folder: 'eventOrganizer',
        seedKeyPrefix: 'eventOrganizer',
        getId: getEventOrganizerFixtureId
    });

    describeSimpleFixtureDeterminism({
        label: 'getPostFixtureId (HOS-25 T-026)',
        manifestKey: 'posts',
        folder: 'post',
        seedKeyPrefix: 'post',
        getId: getPostFixtureId
    });

    describe('getGastronomyFixtureId (HOS-25 T-026)', () => {
        const files = readManifestFiles('gastronomies');
        const fixtures = files.map((file) => loadFixture<IdOnlyFixture>(file, 'gastronomy'));

        it('should return the same id across repeated calls for the same fixture', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            expect(getGastronomyFixtureId(fixture.id)).toBe(getGastronomyFixtureId(fixture.id));
        });

        it('should match the documented seed-key convention exactly', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            const expected = deterministicFixtureId({ seedKey: `gastronomy:${fixture.id}` });
            expect(getGastronomyFixtureId(fixture.id)).toBe(expected);
        });

        it('should produce a unique id for every real example gastronomy fixture', () => {
            const ids = fixtures.map((fixture) => getGastronomyFixtureId(fixture.id));
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    describe('getGastronomyFaqFixtureId (HOS-25 T-026)', () => {
        it('should return the same id across repeated calls for the same (gastronomySeedId, index) pair', () => {
            const input = {
                gastronomySeedId: '001-gastronomy-uruguay-la-parrilla-del-puerto',
                index: 0
            };

            expect(getGastronomyFaqFixtureId(input)).toBe(getGastronomyFaqFixtureId(input));
        });

        it('should match the documented composite seed-key convention exactly', () => {
            const input = {
                gastronomySeedId: '001-gastronomy-uruguay-la-parrilla-del-puerto',
                index: 1
            };
            const expected = deterministicFixtureId({
                seedKey: `gastronomyFaq:${input.gastronomySeedId}:${input.index}`
            });

            expect(getGastronomyFaqFixtureId(input)).toBe(expected);
        });

        it('should produce stable, unique ids for every real example gastronomy FAQ fixture', () => {
            const files = readManifestFiles('gastronomyFaqs');
            const fixtures = files.map((file) =>
                loadFixture<GastronomyChildFixtureFile>(file, 'gastronomy/faqs')
            );
            expect(fixtures.length).toBeGreaterThan(0);

            const allIds: string[] = [];
            for (const fixture of fixtures) {
                const faqs = fixture.faqs ?? [];
                expect(faqs.length).toBeGreaterThan(0);
                for (let index = 0; index < faqs.length; index++) {
                    const id = getGastronomyFaqFixtureId({
                        gastronomySeedId: fixture.$gastronomyId,
                        index
                    });
                    expect(
                        getGastronomyFaqFixtureId({
                            gastronomySeedId: fixture.$gastronomyId,
                            index
                        })
                    ).toBe(id);
                    allIds.push(id);
                }
            }

            expect(new Set(allIds).size).toBe(allIds.length);
        });
    });

    describe('getGastronomyReviewFixtureId (HOS-25 T-026)', () => {
        it('should return the same id across repeated calls for the same (gastronomySeedId, reviewerSeedId) pair', () => {
            const input = {
                gastronomySeedId: '001-gastronomy-uruguay-la-parrilla-del-puerto',
                reviewerSeedId: '009-user-sofia-morales'
            };

            expect(getGastronomyReviewFixtureId(input)).toBe(getGastronomyReviewFixtureId(input));
        });

        it('should match the documented composite seed-key convention exactly', () => {
            const input = {
                gastronomySeedId: '001-gastronomy-uruguay-la-parrilla-del-puerto',
                reviewerSeedId: '004-user-ana-rodríguez'
            };
            const expected = deterministicFixtureId({
                seedKey: `gastronomyReview:${input.gastronomySeedId}:${input.reviewerSeedId}`
            });

            expect(getGastronomyReviewFixtureId(input)).toBe(expected);
        });

        it('should produce stable, unique ids for every real example gastronomy review fixture', () => {
            const files = readManifestFiles('gastronomyReviews');
            const fixtures = files.map((file) =>
                loadFixture<GastronomyChildFixtureFile>(file, 'gastronomy/reviews')
            );
            expect(fixtures.length).toBeGreaterThan(0);

            const allIds: string[] = [];
            for (const fixture of fixtures) {
                const reviews = fixture.reviews ?? [];
                expect(reviews.length).toBeGreaterThan(0);
                for (const review of reviews) {
                    const id = getGastronomyReviewFixtureId({
                        gastronomySeedId: fixture.$gastronomyId,
                        reviewerSeedId: review.userId
                    });
                    expect(
                        getGastronomyReviewFixtureId({
                            gastronomySeedId: fixture.$gastronomyId,
                            reviewerSeedId: review.userId
                        })
                    ).toBe(id);
                    allIds.push(id);
                }
            }

            expect(new Set(allIds).size).toBe(allIds.length);
        });
    });

    describe('getExperienceFixtureId (HOS-25 T-026)', () => {
        it('should return the same id across repeated calls for the same slug', () => {
            const input = { slug: 'excursion-rio-uruguay-concepcion' };

            expect(getExperienceFixtureId(input)).toBe(getExperienceFixtureId(input));
        });

        it('should match the documented slug-based seed-key convention exactly', () => {
            const input = { slug: 'alquiler-kayak-colon-termas' };
            const expected = deterministicFixtureId({ seedKey: `experience:${input.slug}` });

            expect(getExperienceFixtureId(input)).toBe(expected);
        });

        it('should produce a unique id for every real seeded experience slug', () => {
            const slugs = [
                'excursion-rio-uruguay-concepcion',
                'alquiler-kayak-colon-termas',
                'guia-turistica-gualeguaychu-carnaval',
                'paseo-en-lancha-concordia-lago',
                'tour-cultural-casas-historicas-concepcion'
            ];
            const ids = slugs.map((slug) => getExperienceFixtureId({ slug }));
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    describe('cross-entity id isolation (HOS-25 T-026)', () => {
        it('should never collide between a post and a gastronomy sharing the same raw fixture id', () => {
            const sharedRawId = 'shared-raw-fixture-id';

            const postId = getPostFixtureId({ id: sharedRawId });
            const gastronomyId = getGastronomyFixtureId(sharedRawId);

            expect(postId).not.toBe(gastronomyId);
        });
    });

    describe('wired modelClass shape (static contract)', () => {
        // `SeedFactoryConfig.deterministicId.modelClass` requires a `SeedModelConstructor`
        // (`new () => { create(data): Promise<unknown> }`). This is enforced at compile
        // time by `pnpm typecheck` for every `.seed.ts` file that wires `deterministicId` —
        // these assertions just document that the concrete `@repo/db` model classes wired
        // there satisfy that shape.
        it('should expose a no-arg constructor and a create() method', () => {
            expect(typeof new AccommodationModel().create).toBe('function');
            expect(typeof new AccommodationFaqModel().create).toBe('function');
            expect(typeof new EventModel().create).toBe('function');
            expect(typeof new AccommodationReviewModel().create).toBe('function');
            expect(typeof new DestinationReviewModel().create).toBe('function');
            expect(typeof new EventLocationModel().create).toBe('function');
            expect(typeof new EventOrganizerModel().create).toBe('function');
            expect(typeof new PostModel().create).toBe('function');
        });
    });
});
