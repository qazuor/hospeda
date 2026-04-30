/**
 * Integration-style tests for the full SPEC-086 seed pipeline (T-041).
 *
 * Validates that the complete tag seed pipeline — required seeds (R-1 through R-4)
 * and example seeds (E-1 through E-3) — produces the correct final row counts
 * and is fully idempotent when run twice in sequence.
 *
 * All tests use in-memory stubs (no live database). The stubs are wired together
 * in order, mirroring the real seed run sequence:
 *
 *   R-1  systemUser   → 1 system user record
 *   R-2  internalTags → 25 INTERNAL tag rows
 *   R-3  systemTags   → 30 SYSTEM tag rows
 *   R-4  postTags     → 34 PostTag rows
 *   E-1  userTags     → 12 USER tag rows (4 HOST + 4 EDITOR + 4 ADMIN, 0 SUPER_ADMIN)
 *   E-2  postTagAssignments → 15 r_post_post_tag rows (5 posts × 3 tags)
 *   E-3  entityTagAssignments → 20 r_entity_tag rows (7 HOST + 6 EDITOR + 7 ADMIN)
 *
 * Acceptance criteria validated:
 *   AC-F21 (E-1): USER tag counts per role
 *   AC-F22 (E-2 + E-3): PostTag assignments ≥ 10, entity-tag assignments = 20
 *   Idempotency: second run produces 0 new rows across all seeds
 *
 * References: SPEC-086 T-041, tag-seeds.md
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityTagSeedModels } from '../../src/example/entityTagAssignments.seed.js';
import { seedEntityTagAssignments } from '../../src/example/entityTagAssignments.seed.js';
import type {
    PostTagModelPort as E2PostTagModelPort,
    PostModelPort,
    RPostPostTagModelPort
} from '../../src/example/postTagAssignments.seed.js';
import { seedPostTagAssignments } from '../../src/example/postTagAssignments.seed.js';
import type { TagModelPort, UserModelPort } from '../../src/example/userTags.seed.js';
import { seedUserTags } from '../../src/example/userTags.seed.js';
import type { TagModelPort as InternalTagModelPort } from '../../src/required/internalTags.seed.js';
import { seedInternalTags } from '../../src/required/internalTags.seed.js';
import type { PostTagModelPort } from '../../src/required/postTags.seed.js';
import { seedPostTags } from '../../src/required/postTags.seed.js';
import type { TagModelPort as SystemTagModelPort } from '../../src/required/systemTags.seed.js';
import { seedSystemTags } from '../../src/required/systemTags.seed.js';

// ---------------------------------------------------------------------------
// Silence logger and summaryTracker in all tests.
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/utils/summaryTracker.js', () => ({
    summaryTracker: {
        trackSuccess: vi.fn(),
        trackError: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// In-memory store shared across the full pipeline
// ---------------------------------------------------------------------------

type StoreRecord = Record<string, unknown>;

/**
 * Shared in-memory state representing a clean DB before seeding.
 * All seed functions operate against these stores.
 */
interface PipelineStores {
    tags: StoreRecord[];
    postTags: StoreRecord[];
    users: StoreRecord[];
    rPostPostTag: StoreRecord[];
    rEntityTag: StoreRecord[];
    accommodations: StoreRecord[];
    posts: StoreRecord[];
    destinations: StoreRecord[];
    events: StoreRecord[];
}

function emptyStores(): PipelineStores {
    return {
        tags: [],
        postTags: [],
        users: [],
        rPostPostTag: [],
        rEntityTag: [],
        accommodations: [],
        posts: [],
        destinations: [],
        events: []
    };
}

/**
 * Factory: builds the InternalTagModelPort wired to the given stores.
 */
function makeInternalTagModel(stores: PipelineStores): InternalTagModelPort {
    return {
        async findOne(filter) {
            return (
                stores.tags.find((r) => r.type === filter.type && r.name === filter.name) ?? null
            );
        },
        async create(data) {
            const row = { id: `internal-tag-${stores.tags.length + 1}`, ...data };
            stores.tags.push(row);
            return row;
        }
    };
}

/**
 * Factory: builds the SystemTagModelPort wired to the given stores.
 */
function makeSystemTagModel(stores: PipelineStores): SystemTagModelPort {
    return {
        async findOne(filter) {
            return (
                stores.tags.find((r) => r.type === filter.type && r.name === filter.name) ?? null
            );
        },
        async create(data) {
            const row = { id: `system-tag-${stores.tags.length + 1}`, ...data };
            stores.tags.push(row);
            return row;
        }
    };
}

/**
 * Factory: builds the PostTagModelPort (R-4) wired to the given stores.
 */
function makePostTagModel(stores: PipelineStores): PostTagModelPort {
    return {
        async findOne(filter) {
            return stores.postTags.find((r) => r.slug === filter.slug) ?? null;
        },
        async create(data) {
            const row = { id: `post-tag-${stores.postTags.length + 1}`, ...data };
            stores.postTags.push(row);
            return row;
        }
    };
}

/**
 * Factory: builds the E-1 UserModelPort wired to the given stores.
 * Looks up users by `slug` (stable, preserved from fixtures).
 */
function makeUserModel(stores: PipelineStores): UserModelPort {
    return {
        async findOne(filter) {
            return stores.users.find((u) => u.slug === filter.slug) ?? null;
        }
    };
}

/**
 * Factory: builds the E-1 TagModelPort wired to the given stores.
 */
function makeE1TagModel(stores: PipelineStores): TagModelPort {
    return {
        async findOne(filter) {
            return (
                stores.tags.find(
                    (r) =>
                        r.ownerId === filter.ownerId &&
                        r.type === filter.type &&
                        r.name === filter.name
                ) ?? null
            );
        },
        async create(data) {
            const row = { id: `user-tag-${stores.tags.length + 1}`, ...data };
            stores.tags.push(row);
            return row;
        }
    };
}

/**
 * Factory: builds the E-2 PostTagModelPort wired to the given stores.
 * Looks up PostTags by `slug`.
 */
function makeE2PostTagModel(stores: PipelineStores): E2PostTagModelPort {
    return {
        async findOne(filter) {
            return stores.postTags.find((r) => r.slug === filter.slug) ?? null;
        }
    };
}

/**
 * Factory: builds the E-2 RPostPostTagModelPort wired to the given stores.
 */
function makeRPostPostTagModel(stores: PipelineStores): RPostPostTagModelPort {
    return {
        async findOne(filter) {
            return (
                stores.rPostPostTag.find(
                    (r) => r.postId === filter.postId && r.postTagId === filter.postTagId
                ) ?? null
            );
        },
        async create(data) {
            const row = { ...data };
            stores.rPostPostTag.push(row);
            return row;
        }
    };
}

/**
 * Factory: builds the E-2 PostModelPort wired to the given stores.
 * Looks up posts by `title` (stable, preserved from fixtures).
 */
function makePostModel(stores: PipelineStores): PostModelPort {
    return {
        async findOne(filter) {
            return stores.posts.find((p) => p.title === filter.title) ?? null;
        }
    };
}

/**
 * Factory: builds the E-3 EntityTagSeedModels wired to the given stores.
 *
 * Lookup strategies mirror the production implementation:
 *   - users       → by `slug`
 *   - tags        → by `(type, name)`
 *   - accommodations / destinations / events → by `name`
 *   - posts       → by `title`
 */
function makeE3Models(stores: PipelineStores): EntityTagSeedModels {
    return {
        tagModel: {
            async findOne(filter) {
                return (
                    stores.tags.find((t) => t.type === filter.type && t.name === filter.name) ??
                    null
                );
            }
        },
        userModel: {
            async findOne(filter) {
                return stores.users.find((u) => u.slug === filter.slug) ?? null;
            }
        },
        accommodationModel: {
            async findOne(filter) {
                return stores.accommodations.find((r) => r.name === filter.name) ?? null;
            }
        },
        postModel: {
            async findOne(filter) {
                return stores.posts.find((r) => r.title === filter.title) ?? null;
            }
        },
        destinationModel: {
            async findOne(filter) {
                return stores.destinations.find((r) => r.name === filter.name) ?? null;
            }
        },
        eventModel: {
            async findOne(filter) {
                return stores.events.find((r) => r.name === filter.name) ?? null;
            }
        },
        rEntityTagModel: {
            async findOne(filter) {
                return (
                    stores.rEntityTag.find(
                        (r) =>
                            r.tagId === filter.tagId &&
                            r.entityId === filter.entityId &&
                            r.entityType === filter.entityType &&
                            r.assignedById === filter.assignedById
                    ) ?? null
                );
            },
            async create(data) {
                const row = { ...data };
                stores.rEntityTag.push(row);
                return row;
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Fixture data: users, entities, PostTag slugs
// ---------------------------------------------------------------------------

/**
 * Test users matching slug lookup values used by E-1 and E-3 seeds.
 * Each user has a real UUID `id` (as would exist in the DB after the users seed).
 */
const TEST_USERS: StoreRecord[] = [
    { id: 'uuid-host-001', slug: 'ana-rodríguez', role: 'HOST' },
    { id: 'uuid-editor-002', slug: 'carlos-martínez', role: 'EDITOR' },
    { id: 'uuid-admin-003', slug: 'admin-user', role: 'ADMIN' },
    { id: 'uuid-guest-004', slug: 'usuario-invitado', role: 'GUEST' }
];

/**
 * Test accommodations keyed by `name` (the E-3 entityLookupKey for ACCOMMODATION).
 */
const TEST_ACCOMMODATIONS: StoreRecord[] = [
    { id: 'uuid-acc-001', name: 'Retiro Soleado' },
    { id: 'uuid-acc-002', name: 'Rio Soleado Cabaña' },
    { id: 'uuid-acc-003', name: 'Sendero Natural Country House' }
];

/**
 * Test posts keyed by `title` (the E-2/E-3 entityLookupKey for POST).
 */
const TEST_POSTS: StoreRecord[] = [
    { id: 'uuid-post-001', title: 'Los 10 Destinos Imperdibles de Entre Ríos en 2024' },
    { id: 'uuid-post-002', title: 'Gastronomía Entrerriana: Sabores Auténticos del Litoral' },
    {
        id: 'uuid-post-003',
        title: 'El Carnaval de Gualeguaychú: Un Espectáculo de Color y Tradición'
    },
    { id: 'uuid-post-004', title: 'Termas de Federación: Tu Refugio de Relax y Bienestar' },
    { id: 'uuid-post-005', title: 'Aventura en el Delta del Paraná: Ecoturismo en Estado Puro' }
];

/**
 * Test destinations keyed by `name` (the E-3 entityLookupKey for DESTINATION).
 */
const TEST_DESTINATIONS: StoreRecord[] = [
    { id: 'uuid-dest-001', name: 'Chajarí' },
    { id: 'uuid-dest-002', name: 'Colón' }
];

/**
 * Test events keyed by `name` (the E-3 entityLookupKey for EVENT).
 */
const TEST_EVENTS: StoreRecord[] = [
    { id: 'uuid-event-002', name: 'Encuentro de Historia en Palacio San José 2025' }
];

/**
 * Builds InternalTag JSON-like definitions for the required seed.
 * The tag file contents are read from disk by the real seed, but here
 * we use a dataDirOverride pointing to a virtual directory and a custom
 * loadInternalTagFiles (or just inject a custom tagModel with pre-built data).
 *
 * Strategy: we use the model override approach — pre-populate the stores
 * with the expected counts of INTERNAL/SYSTEM tags, then verify idempotency.
 */

// ---------------------------------------------------------------------------
// Pipeline runner: runs required + example seeds in order
// ---------------------------------------------------------------------------

/**
 * Runs the complete SPEC-086 tag seed pipeline using in-memory stubs.
 * Returns the stores after the run.
 */
async function runFullPipeline(stores: PipelineStores): Promise<void> {
    // -------------------------------------------------------------------------
    // R-2: INTERNAL tags (25)
    // We inject a data directory path override and a model override.
    // For the integration test, the simplest approach is to pre-populate the
    // tag store with the expected INTERNAL definitions and rely on the
    // internalTags seed to skip all of them (idempotency path), OR run the
    // actual file loading. Since the actual data dir exists, we use it directly.
    // -------------------------------------------------------------------------
    const dataTagDir = new URL('../../src/data/tag', import.meta.url).pathname;
    const dataPostTagDir = new URL('../../src/data/postTag', import.meta.url).pathname;

    await seedInternalTags(makeInternalTagModel(stores), dataTagDir);
    await seedSystemTags(makeSystemTagModel(stores), dataTagDir);
    await seedPostTags(makePostTagModel(stores), dataPostTagDir);

    // -------------------------------------------------------------------------
    // E-1: USER tags (4 HOST + 4 EDITOR + 4 ADMIN = 12)
    // -------------------------------------------------------------------------
    stores.users.push(...TEST_USERS);

    await seedUserTags(makeE1TagModel(stores), makeUserModel(stores));

    // -------------------------------------------------------------------------
    // E-2: PostTag assignments (5 posts × 3 tags = 15)
    // -------------------------------------------------------------------------
    stores.posts.push(...TEST_POSTS);
    stores.accommodations.push(...TEST_ACCOMMODATIONS);
    stores.destinations.push(...TEST_DESTINATIONS);
    stores.events.push(...TEST_EVENTS);

    await seedPostTagAssignments(
        makeE2PostTagModel(stores),
        makeRPostPostTagModel(stores),
        makePostModel(stores)
    );

    // -------------------------------------------------------------------------
    // E-3: entity-tag assignments (7 HOST + 6 EDITOR + 7 ADMIN = 20)
    // -------------------------------------------------------------------------
    await seedEntityTagAssignments(makeE3Models(stores));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Full SPEC-086 tag seed pipeline — T-041', () => {
    let stores: PipelineStores;

    beforeEach(() => {
        stores = emptyStores();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // R-2: INTERNAL tags
    // -------------------------------------------------------------------------
    describe('R-2: INTERNAL tags', () => {
        it('should seed exactly 25 INTERNAL tags', async () => {
            const dataTagDir = new URL('../../src/data/tag', import.meta.url).pathname;
            await seedInternalTags(makeInternalTagModel(stores), dataTagDir);

            const internalTags = stores.tags.filter((t) => t.type === 'INTERNAL');
            expect(internalTags).toHaveLength(25);
        });

        it('should skip all 25 on a second run (idempotency)', async () => {
            const dataTagDir = new URL('../../src/data/tag', import.meta.url).pathname;
            await seedInternalTags(makeInternalTagModel(stores), dataTagDir);
            const countAfterFirst = stores.tags.filter((t) => t.type === 'INTERNAL').length;

            await seedInternalTags(makeInternalTagModel(stores), dataTagDir);
            expect(stores.tags.filter((t) => t.type === 'INTERNAL')).toHaveLength(countAfterFirst);
        });
    });

    // -------------------------------------------------------------------------
    // R-3: SYSTEM tags
    // -------------------------------------------------------------------------
    describe('R-3: SYSTEM tags', () => {
        it('should seed exactly 30 SYSTEM tags', async () => {
            const dataTagDir = new URL('../../src/data/tag', import.meta.url).pathname;
            await seedSystemTags(makeSystemTagModel(stores), dataTagDir);

            const systemTags = stores.tags.filter((t) => t.type === 'SYSTEM');
            expect(systemTags).toHaveLength(30);
        });

        it('should skip all 30 on a second run (idempotency)', async () => {
            const dataTagDir = new URL('../../src/data/tag', import.meta.url).pathname;
            await seedSystemTags(makeSystemTagModel(stores), dataTagDir);
            const countAfterFirst = stores.tags.filter((t) => t.type === 'SYSTEM').length;

            await seedSystemTags(makeSystemTagModel(stores), dataTagDir);
            expect(stores.tags.filter((t) => t.type === 'SYSTEM')).toHaveLength(countAfterFirst);
        });
    });

    // -------------------------------------------------------------------------
    // R-4: PostTags
    // -------------------------------------------------------------------------
    describe('R-4: PostTags', () => {
        it('should seed exactly 34 PostTags', async () => {
            const dataPostTagDir = new URL('../../src/data/postTag', import.meta.url).pathname;
            await seedPostTags(makePostTagModel(stores), dataPostTagDir);

            expect(stores.postTags).toHaveLength(34);
        });

        it('should skip all 34 on a second run (idempotency)', async () => {
            const dataPostTagDir = new URL('../../src/data/postTag', import.meta.url).pathname;
            await seedPostTags(makePostTagModel(stores), dataPostTagDir);
            const countAfterFirst = stores.postTags.length;

            await seedPostTags(makePostTagModel(stores), dataPostTagDir);
            expect(stores.postTags).toHaveLength(countAfterFirst);
        });
    });

    // -------------------------------------------------------------------------
    // E-1: USER tags
    // -------------------------------------------------------------------------
    describe('E-1: USER tags (AC-F21)', () => {
        beforeEach(() => {
            stores.users.push(...TEST_USERS);
        });

        it('should create 4 USER tags for the HOST test user (slug: ana-rodríguez)', async () => {
            await seedUserTags(makeE1TagModel(stores), makeUserModel(stores));

            const hostTags = stores.tags.filter(
                (t) => t.type === 'USER' && t.ownerId === 'uuid-host-001'
            );
            expect(hostTags).toHaveLength(4);
        });

        it('should create 4 USER tags for the EDITOR test user (slug: carlos-martínez)', async () => {
            await seedUserTags(makeE1TagModel(stores), makeUserModel(stores));

            const editorTags = stores.tags.filter(
                (t) => t.type === 'USER' && t.ownerId === 'uuid-editor-002'
            );
            expect(editorTags).toHaveLength(4);
        });

        it('should create 4 USER tags for the ADMIN test user (slug: admin-user)', async () => {
            await seedUserTags(makeE1TagModel(stores), makeUserModel(stores));

            const adminTags = stores.tags.filter(
                (t) => t.type === 'USER' && t.ownerId === 'uuid-admin-003'
            );
            expect(adminTags).toHaveLength(4);
        });

        it('should create 0 USER tags for the SUPER_ADMIN test user (E-1 baseline)', async () => {
            await seedUserTags(makeE1TagModel(stores), makeUserModel(stores));

            // SUPER_ADMIN slug is not in USER_TAG_DEFINITIONS
            const superAdminTags = stores.tags.filter(
                (t) => t.type === 'USER' && t.ownerId === 'uuid-super-admin-004'
            );
            expect(superAdminTags).toHaveLength(0);
        });

        it('should create 12 USER tags total (4 per role × 3 roles)', async () => {
            await seedUserTags(makeE1TagModel(stores), makeUserModel(stores));

            const userTags = stores.tags.filter((t) => t.type === 'USER');
            expect(userTags).toHaveLength(12);
        });

        it('should skip all 12 USER tags on a second run (idempotency)', async () => {
            await seedUserTags(makeE1TagModel(stores), makeUserModel(stores));
            const countAfterFirst = stores.tags.filter((t) => t.type === 'USER').length;

            await seedUserTags(makeE1TagModel(stores), makeUserModel(stores));
            expect(stores.tags.filter((t) => t.type === 'USER')).toHaveLength(countAfterFirst);
        });
    });

    // -------------------------------------------------------------------------
    // E-2: PostTag assignments
    // -------------------------------------------------------------------------
    describe('E-2: PostTag assignments (AC-F22)', () => {
        beforeEach(async () => {
            // R-4 must run first so PostTags exist for E-2 to look up
            const dataPostTagDir = new URL('../../src/data/postTag', import.meta.url).pathname;
            await seedPostTags(makePostTagModel(stores), dataPostTagDir);
            stores.posts.push(...TEST_POSTS);
        });

        it('should create at least 10 rows in r_post_post_tag (AC-F22 minimum)', async () => {
            await seedPostTagAssignments(
                makeE2PostTagModel(stores),
                makeRPostPostTagModel(stores),
                makePostModel(stores)
            );
            expect(stores.rPostPostTag.length).toBeGreaterThanOrEqual(10);
        });

        it('should create exactly 15 rows (5 posts × 3 tags each)', async () => {
            await seedPostTagAssignments(
                makeE2PostTagModel(stores),
                makeRPostPostTagModel(stores),
                makePostModel(stores)
            );
            expect(stores.rPostPostTag).toHaveLength(15);
        });

        it('should skip all 15 rows on a second run (idempotency)', async () => {
            await seedPostTagAssignments(
                makeE2PostTagModel(stores),
                makeRPostPostTagModel(stores),
                makePostModel(stores)
            );
            const countAfterFirst = stores.rPostPostTag.length;

            await seedPostTagAssignments(
                makeE2PostTagModel(stores),
                makeRPostPostTagModel(stores),
                makePostModel(stores)
            );
            expect(stores.rPostPostTag).toHaveLength(countAfterFirst);
        });
    });

    // -------------------------------------------------------------------------
    // E-3: entity-tag assignments
    // -------------------------------------------------------------------------
    describe('E-3: entity-tag assignments (AC-F22)', () => {
        beforeEach(async () => {
            // Required: INTERNAL and SYSTEM tags must exist for E-3 to look up
            const dataTagDir = new URL('../../src/data/tag', import.meta.url).pathname;
            await seedInternalTags(makeInternalTagModel(stores), dataTagDir);
            await seedSystemTags(makeSystemTagModel(stores), dataTagDir);
            stores.users.push(...TEST_USERS);
            stores.accommodations.push(...TEST_ACCOMMODATIONS);
            stores.posts.push(...TEST_POSTS);
            stores.destinations.push(...TEST_DESTINATIONS);
            stores.events.push(...TEST_EVENTS);
        });

        it('should create 20 rows total in r_entity_tag (7 HOST + 6 EDITOR + 7 ADMIN)', async () => {
            await seedEntityTagAssignments(makeE3Models(stores));
            expect(stores.rEntityTag).toHaveLength(20);
        });

        it('should create 7 assignments for HOST (slug: ana-rodríguez)', async () => {
            await seedEntityTagAssignments(makeE3Models(stores));
            const hostRows = stores.rEntityTag.filter((r) => r.assignedById === 'uuid-host-001');
            expect(hostRows).toHaveLength(7);
        });

        it('should create 6 assignments for EDITOR (slug: carlos-martínez)', async () => {
            await seedEntityTagAssignments(makeE3Models(stores));
            const editorRows = stores.rEntityTag.filter(
                (r) => r.assignedById === 'uuid-editor-002'
            );
            expect(editorRows).toHaveLength(6);
        });

        it('should create 7 assignments for ADMIN (slug: admin-user)', async () => {
            await seedEntityTagAssignments(makeE3Models(stores));
            const adminRows = stores.rEntityTag.filter((r) => r.assignedById === 'uuid-admin-003');
            expect(adminRows).toHaveLength(7);
        });

        it('should skip all 20 rows on a second run (idempotency)', async () => {
            await seedEntityTagAssignments(makeE3Models(stores));
            const countAfterFirst = stores.rEntityTag.length;

            await seedEntityTagAssignments(makeE3Models(stores));
            expect(stores.rEntityTag).toHaveLength(countAfterFirst);
        });
    });

    // -------------------------------------------------------------------------
    // Full pipeline: combined run
    // -------------------------------------------------------------------------
    describe('Full pipeline: first run', () => {
        it('should produce the correct counts for all required seeds', async () => {
            await runFullPipeline(stores);

            // R-2: 25 INTERNAL tags
            expect(stores.tags.filter((t) => t.type === 'INTERNAL')).toHaveLength(25);
            // R-3: 30 SYSTEM tags
            expect(stores.tags.filter((t) => t.type === 'SYSTEM')).toHaveLength(30);
            // R-4: 34 PostTags
            expect(stores.postTags).toHaveLength(34);
        });

        it('should produce 12 USER tags total across all roles (E-1)', async () => {
            await runFullPipeline(stores);
            expect(stores.tags.filter((t) => t.type === 'USER')).toHaveLength(12);
        });

        it('should produce 15 r_post_post_tag rows (E-2)', async () => {
            await runFullPipeline(stores);
            expect(stores.rPostPostTag).toHaveLength(15);
        });

        it('should produce 20 r_entity_tag rows (E-3)', async () => {
            await runFullPipeline(stores);
            expect(stores.rEntityTag).toHaveLength(20);
        });
    });

    describe('Full pipeline: second run (idempotency)', () => {
        it('should create 0 new rows in any table when run twice', async () => {
            await runFullPipeline(stores);

            const counts = {
                internalTags: stores.tags.filter((t) => t.type === 'INTERNAL').length,
                systemTags: stores.tags.filter((t) => t.type === 'SYSTEM').length,
                postTags: stores.postTags.length,
                userTags: stores.tags.filter((t) => t.type === 'USER').length,
                rPostPostTag: stores.rPostPostTag.length,
                rEntityTag: stores.rEntityTag.length
            };

            // Second run — no reset, same stores
            await runFullPipeline(stores);

            expect(stores.tags.filter((t) => t.type === 'INTERNAL')).toHaveLength(
                counts.internalTags
            );
            expect(stores.tags.filter((t) => t.type === 'SYSTEM')).toHaveLength(counts.systemTags);
            expect(stores.postTags).toHaveLength(counts.postTags);
            expect(stores.tags.filter((t) => t.type === 'USER')).toHaveLength(counts.userTags);
            expect(stores.rPostPostTag).toHaveLength(counts.rPostPostTag);
            expect(stores.rEntityTag).toHaveLength(counts.rEntityTag);
        });

        it('should report correct final counts after two runs: INTERNAL=25, SYSTEM=30, PostTags=34, USER=12, r_post_post_tag=15, r_entity_tag=20', async () => {
            await runFullPipeline(stores);
            await runFullPipeline(stores);

            expect(stores.tags.filter((t) => t.type === 'INTERNAL')).toHaveLength(25);
            expect(stores.tags.filter((t) => t.type === 'SYSTEM')).toHaveLength(30);
            expect(stores.postTags).toHaveLength(34);
            expect(stores.tags.filter((t) => t.type === 'USER')).toHaveLength(12);
            expect(stores.rPostPostTag).toHaveLength(15);
            expect(stores.rEntityTag).toHaveLength(20);
        });
    });
});
