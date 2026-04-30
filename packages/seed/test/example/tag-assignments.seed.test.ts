/**
 * Unit tests for example tag-assignment seeds (SPEC-086 E-1, E-2, E-3).
 *
 * All three seeds accept optional model-port overrides, so tests use
 * in-memory stubs — no live database connection required.
 *
 * Coverage:
 *   AC-F21 / E-1: USER tags per role (HOST=4, EDITOR=4, ADMIN=4, SUPER_ADMIN=0)
 *   AC-F22 / E-2: r_post_post_tag rows (≥ 10 total)
 *   AC-F22 / E-3: r_entity_tag rows with correct types and assignedById
 *   Idempotency: double-run creates zero duplicates for all three seeds
 *
 * References: AC-F21, AC-F22, E-1, E-2, E-3, tag-seeds.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityTagSeedModels } from '../../src/example/entityTagAssignments.seed.js';
import { seedEntityTagAssignments } from '../../src/example/entityTagAssignments.seed.js';
import type {
    PostTagModelPort,
    RPostPostTagModelPort
} from '../../src/example/postTagAssignments.seed.js';
import { seedPostTagAssignments } from '../../src/example/postTagAssignments.seed.js';
import type { TagModelPort, UserModelPort } from '../../src/example/userTags.seed.js';
import { seedUserTags } from '../../src/example/userTags.seed.js';

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
// Shared in-memory store helpers
// ---------------------------------------------------------------------------

/** Generic in-memory record store used across stub factories. */
type StoreRecord = Record<string, unknown>;

function makeStore(): StoreRecord[] {
    return [];
}

// ---------------------------------------------------------------------------
// E-1: seedUserTags
// ---------------------------------------------------------------------------

describe('seedUserTags — E-1 (AC-F21)', () => {
    /** Track calls to tagModel.create */
    let tagCreateCalls: StoreRecord[] = [];
    let tagStore: StoreRecord[] = [];

    function buildTagModel(): TagModelPort {
        return {
            async findOne(filter) {
                return (
                    tagStore.find(
                        (r) =>
                            r.ownerId === filter.ownerId &&
                            r.type === filter.type &&
                            r.name === filter.name
                    ) ?? null
                );
            },
            async create(data) {
                const row = { id: `tag-${tagCreateCalls.length + 1}`, ...data };
                tagStore.push(row);
                tagCreateCalls.push(row);
                return row;
            }
        };
    }

    /**
     * User model stub: looks up by `slug` to match the updated seed implementation.
     * The seed now uses `findOne({ slug: ... })` instead of `findOne({ id: ... })`.
     */
    function buildUserModel(users: StoreRecord[]): UserModelPort {
        return {
            async findOne(filter) {
                return users.find((u) => u.slug === filter.slug) ?? null;
            }
        };
    }

    /**
     * Fake users keyed by `slug` (the stable lookup field used by E-1).
     * Slugs match the ownerSlug values in USER_TAG_DEFINITIONS:
     *   HOST  → ana-rodríguez
     *   EDITOR → carlos-martínez
     *   ADMIN  → admin-user
     */
    function makeFakeUsers(): StoreRecord[] {
        return [
            { id: 'uuid-host-001', slug: 'ana-rodríguez', role: 'HOST' },
            { id: 'uuid-editor-002', slug: 'carlos-martínez', role: 'EDITOR' },
            { id: 'uuid-admin-003', slug: 'admin-user', role: 'ADMIN' }
        ];
    }

    beforeEach(() => {
        tagCreateCalls = [];
        tagStore = makeStore();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('when test users exist and no USER tags are pre-seeded', () => {
        it('should create exactly 4 USER tags for the HOST test user', async () => {
            const users = makeFakeUsers();

            const tagModel = buildTagModel();
            const userModel = buildUserModel(users);

            await seedUserTags(tagModel, userModel);

            const hostUserId = 'uuid-host-001';
            const hostTags = tagCreateCalls.filter((r) => r.ownerId === hostUserId);
            expect(hostTags).toHaveLength(4);
        });

        it('should create exactly 4 USER tags for the EDITOR test user', async () => {
            const users = makeFakeUsers();

            const tagModel = buildTagModel();
            const userModel = buildUserModel(users);

            await seedUserTags(tagModel, userModel);

            const editorUserId = 'uuid-editor-002';
            const editorTags = tagCreateCalls.filter((r) => r.ownerId === editorUserId);
            expect(editorTags).toHaveLength(4);
        });

        it('should create exactly 4 USER tags for the ADMIN test user', async () => {
            const users = makeFakeUsers();

            const tagModel = buildTagModel();
            const userModel = buildUserModel(users);

            await seedUserTags(tagModel, userModel);

            const adminUserId = 'uuid-admin-003';
            const adminTags = tagCreateCalls.filter((r) => r.ownerId === adminUserId);
            expect(adminTags).toHaveLength(4);
        });

        it('should NOT create any USER tags for the SUPER_ADMIN test user (E-1 baseline)', async () => {
            // SUPER_ADMIN is NOT in USER_TAG_DEFINITIONS — not even in the users array
            // for seed purposes.  Make sure no super-admin-user tags are created.
            const users = [
                ...makeFakeUsers(),
                { id: 'uuid-super-admin-004', slug: 'super-admin-user', role: 'SUPER_ADMIN' }
            ];

            const tagModel = buildTagModel();
            const userModel = buildUserModel(users);

            await seedUserTags(tagModel, userModel);

            const superAdminTags = tagCreateCalls.filter(
                (r) => r.ownerId === 'uuid-super-admin-004'
            );
            expect(superAdminTags).toHaveLength(0);
        });

        it('should insert all USER tags with type = USER', async () => {
            const users = makeFakeUsers();

            const tagModel = buildTagModel();
            const userModel = buildUserModel(users);

            await seedUserTags(tagModel, userModel);

            for (const call of tagCreateCalls) {
                expect(call.type).toBe('USER');
            }
        });

        it('should set ownerId = createdById for each tag (user created their own tag)', async () => {
            const users = makeFakeUsers();

            const tagModel = buildTagModel();
            const userModel = buildUserModel(users);

            await seedUserTags(tagModel, userModel);

            for (const call of tagCreateCalls) {
                expect(call.ownerId).toBe(call.createdById);
            }
        });

        it('should create 12 USER tags total (4 per role × 3 roles)', async () => {
            const users = makeFakeUsers();

            const tagModel = buildTagModel();
            const userModel = buildUserModel(users);

            await seedUserTags(tagModel, userModel);

            expect(tagCreateCalls).toHaveLength(12);
        });
    });

    describe('idempotency — when USER tags already exist', () => {
        it('should skip existing tags and create 0 rows on a second run', async () => {
            const users = makeFakeUsers();

            const tagModel = buildTagModel();
            const userModel = buildUserModel(users);

            // First run: creates all 12 tags
            await seedUserTags(tagModel, userModel);
            expect(tagCreateCalls).toHaveLength(12);

            const countAfterFirst = tagCreateCalls.length;

            // Second run: all already in tagStore — creates 0
            await seedUserTags(tagModel, userModel);
            expect(tagCreateCalls).toHaveLength(countAfterFirst);
        });

        it('should skip individual tags that already exist (partial idempotency)', async () => {
            const hostUserId = 'uuid-host-001';
            const users = makeFakeUsers();

            // Pre-seed 1 HOST tag
            tagStore = [
                {
                    id: 'pre-existing-tag',
                    name: 'Reservar después',
                    type: 'USER',
                    ownerId: hostUserId
                }
            ];

            const tagModel = buildTagModel();
            const userModel = buildUserModel(users);

            await seedUserTags(tagModel, userModel);

            // 12 total expected (4+4+4), minus the 1 pre-existing HOST tag = 11 new
            expect(tagCreateCalls).toHaveLength(11);
        });
    });

    describe('when a test user is not found in the DB', () => {
        it('should skip that user and continue seeding others', async () => {
            // Only HOST user exists — no EDITOR or ADMIN
            const users = [{ id: 'uuid-host-001', slug: 'ana-rodríguez', role: 'HOST' }];

            const tagModel = buildTagModel();
            const userModel = buildUserModel(users);

            await seedUserTags(tagModel, userModel);

            // Only HOST tags should be created (4)
            expect(tagCreateCalls).toHaveLength(4);
        });

        it('should resolve without error when NO test users are found', async () => {
            const tagModel = buildTagModel();
            const userModel = buildUserModel([]); // No users

            await expect(seedUserTags(tagModel, userModel)).resolves.toBeUndefined();
            expect(tagCreateCalls).toHaveLength(0);
        });
    });

    describe('error handling', () => {
        it('should propagate errors thrown by tagModel.create', async () => {
            const users = makeFakeUsers();

            const errorModel: TagModelPort = {
                async findOne() {
                    return null;
                },
                async create() {
                    throw new Error('DB write failed');
                }
            };
            const userModel = buildUserModel(users);

            await expect(seedUserTags(errorModel, userModel)).rejects.toThrow('DB write failed');
        });
    });
});

// ---------------------------------------------------------------------------
// E-2: seedPostTagAssignments
// ---------------------------------------------------------------------------

describe('seedPostTagAssignments — E-2 (AC-F22)', () => {
    /** Records all inserts into r_post_post_tag */
    let rPostPostTagInserts: StoreRecord[] = [];
    let rPostPostTagStore: StoreRecord[] = [];
    let postTagStore: StoreRecord[] = [];

    /** Fixed fake PostTags matching the slugs used by E-2 definitions. */
    const FAKE_POST_TAGS: StoreRecord[] = [
        { id: 'pt-guia-de-viaje', slug: 'guia-de-viaje' },
        { id: 'pt-destinos', slug: 'destinos' },
        { id: 'pt-recomendaciones-locales', slug: 'recomendaciones-locales' },
        { id: 'pt-donde-comer', slug: 'donde-comer' },
        { id: 'pt-cultura-entrerriana', slug: 'cultura-entrerriana' },
        { id: 'pt-carnaval', slug: 'carnaval' },
        { id: 'pt-eventos-locales', slug: 'eventos-locales' },
        { id: 'pt-turismo-termal', slug: 'turismo-termal' },
        { id: 'pt-escapadas', slug: 'escapadas' },
        { id: 'pt-fin-de-semana-largo', slug: 'fin-de-semana-largo' },
        { id: 'pt-naturaleza-entrerriana', slug: 'naturaleza-entrerriana' },
        { id: 'pt-turismo-rural', slug: 'turismo-rural' }
    ];

    /**
     * Fake posts keyed by `title` (the stable lookup field used by E-2).
     * Titles match the postTitle values in POST_TAG_ASSIGNMENTS.
     */
    const FAKE_POSTS: StoreRecord[] = [
        {
            id: 'uuid-post-001',
            title: 'Los 10 Destinos Imperdibles de Entre Ríos en 2024'
        },
        {
            id: 'uuid-post-002',
            title: 'Gastronomía Entrerriana: Sabores Auténticos del Litoral'
        },
        {
            id: 'uuid-post-003',
            title: 'El Carnaval de Gualeguaychú: Un Espectáculo de Color y Tradición'
        },
        {
            id: 'uuid-post-004',
            title: 'Termas de Federación: Tu Refugio de Relax y Bienestar'
        },
        {
            id: 'uuid-post-005',
            title: 'Aventura en el Delta del Paraná: Ecoturismo en Estado Puro'
        }
    ];

    function buildPostTagModel(): PostTagModelPort {
        return {
            async findOne(filter) {
                return postTagStore.find((r) => r.slug === filter.slug) ?? null;
            }
        };
    }

    function buildRPostPostTagModel(): RPostPostTagModelPort {
        return {
            async findOne(filter) {
                return (
                    rPostPostTagStore.find(
                        (r) => r.postId === filter.postId && r.postTagId === filter.postTagId
                    ) ?? null
                );
            },
            async create(data) {
                const row = { ...data };
                rPostPostTagStore.push(row);
                rPostPostTagInserts.push(row);
                return row;
            }
        };
    }

    /**
     * Post model stub: looks up by `title` to match the updated seed implementation.
     * The seed now uses `findOne({ title: ... })` instead of `findOne({ id: ... })`.
     */
    function buildPostModel(posts: StoreRecord[]): { findOne: PostTagModelPort['findOne'] } {
        return {
            async findOne(filter) {
                return posts.find((p) => p.title === filter.title) ?? null;
            }
        };
    }

    beforeEach(() => {
        rPostPostTagInserts = [];
        rPostPostTagStore = makeStore();
        postTagStore = [...FAKE_POST_TAGS];
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('when all posts and PostTags exist', () => {
        it('should create at least 10 rows in r_post_post_tag (AC-F22 minimum)', async () => {
            const postTagModel = buildPostTagModel();
            const rPostPostTagModel = buildRPostPostTagModel();
            const postModel = buildPostModel(FAKE_POSTS);

            await seedPostTagAssignments(postTagModel, rPostPostTagModel, postModel);

            // 5 posts × 3 tags each = 15 rows
            expect(rPostPostTagInserts.length).toBeGreaterThanOrEqual(10);
        });

        it('should create exactly 15 rows (5 posts × 3 tags each)', async () => {
            const postTagModel = buildPostTagModel();
            const rPostPostTagModel = buildRPostPostTagModel();
            const postModel = buildPostModel(FAKE_POSTS);

            await seedPostTagAssignments(postTagModel, rPostPostTagModel, postModel);

            expect(rPostPostTagInserts).toHaveLength(15);
        });

        it('should insert rows with postId populated from the post lookup', async () => {
            const postTagModel = buildPostTagModel();
            const rPostPostTagModel = buildRPostPostTagModel();
            const postModel = buildPostModel(FAKE_POSTS);

            await seedPostTagAssignments(postTagModel, rPostPostTagModel, postModel);

            for (const row of rPostPostTagInserts) {
                expect(typeof row.postId).toBe('string');
                expect((row.postId as string).length).toBeGreaterThan(0);
            }
        });

        it('should insert rows with postTagId populated from the PostTag lookup', async () => {
            const postTagModel = buildPostTagModel();
            const rPostPostTagModel = buildRPostPostTagModel();
            const postModel = buildPostModel(FAKE_POSTS);

            await seedPostTagAssignments(postTagModel, rPostPostTagModel, postModel);

            for (const row of rPostPostTagInserts) {
                expect(typeof row.postTagId).toBe('string');
                expect((row.postTagId as string).length).toBeGreaterThan(0);
            }
        });
    });

    describe('idempotency', () => {
        it('should create 0 new rows on a second run (all already exist)', async () => {
            const postTagModel = buildPostTagModel();
            const rPostPostTagModel = buildRPostPostTagModel();
            const postModel = buildPostModel(FAKE_POSTS);

            // First run: 15 rows
            await seedPostTagAssignments(postTagModel, rPostPostTagModel, postModel);
            expect(rPostPostTagInserts).toHaveLength(15);

            const countAfterFirst = rPostPostTagInserts.length;

            // Second run: all already in store
            await seedPostTagAssignments(postTagModel, rPostPostTagModel, postModel);
            expect(rPostPostTagInserts).toHaveLength(countAfterFirst);
        });
    });

    describe('when a post is not found', () => {
        it('should skip that post and continue with others', async () => {
            // Only first 3 posts exist
            const partialPosts = FAKE_POSTS.slice(0, 3);
            const postTagModel = buildPostTagModel();
            const rPostPostTagModel = buildRPostPostTagModel();
            const postModel = buildPostModel(partialPosts);

            await seedPostTagAssignments(postTagModel, rPostPostTagModel, postModel);

            // 3 posts × 3 tags = 9 rows
            expect(rPostPostTagInserts).toHaveLength(9);
        });
    });

    describe('when a PostTag slug is not found', () => {
        it('should skip that slug and continue with others', async () => {
            // Remove one PostTag from the store
            postTagStore = FAKE_POST_TAGS.filter((pt) => pt.slug !== 'guia-de-viaje');
            const postTagModel = buildPostTagModel();
            const rPostPostTagModel = buildRPostPostTagModel();
            const postModel = buildPostModel(FAKE_POSTS);

            await seedPostTagAssignments(postTagModel, rPostPostTagModel, postModel);

            // One slug missing from post-1's 3 tags → 14 rows instead of 15
            expect(rPostPostTagInserts).toHaveLength(14);
        });
    });

    describe('error handling', () => {
        it('should propagate errors thrown by rPostPostTagModel.create', async () => {
            const postTagModel = buildPostTagModel();
            const errorRModel: RPostPostTagModelPort = {
                async findOne() {
                    return null;
                },
                async create() {
                    throw new Error('Join table insert failed');
                }
            };
            const postModel = buildPostModel(FAKE_POSTS);

            await expect(
                seedPostTagAssignments(postTagModel, errorRModel, postModel)
            ).rejects.toThrow('Join table insert failed');
        });
    });
});

// ---------------------------------------------------------------------------
// E-3: seedEntityTagAssignments
// ---------------------------------------------------------------------------

describe('seedEntityTagAssignments — E-3 (AC-F22)', () => {
    /** Records all inserts into r_entity_tag */
    let rEntityTagInserts: StoreRecord[] = [];
    let rEntityTagStore: StoreRecord[] = [];

    /** Fixed fake tags covering all names used in E-3 definitions. */
    const FAKE_SYSTEM_TAGS: StoreRecord[] = [
        { id: 'st-favorito', name: 'Favorito', type: 'SYSTEM' },
        { id: 'st-importante', name: 'Importante', type: 'SYSTEM' },
        { id: 'st-revisar-luego', name: 'Revisar luego', type: 'SYSTEM' },
        { id: 'st-mejorar-fotos', name: 'Mejorar fotos', type: 'SYSTEM' },
        { id: 'st-revisar-precio', name: 'Revisar precio', type: 'SYSTEM' },
        { id: 'st-cliente-potencial', name: 'Cliente potencial', type: 'SYSTEM' },
        { id: 'st-borrador', name: 'Borrador', type: 'SYSTEM' },
        { id: 'st-listo', name: 'Listo para publicar', type: 'SYSTEM' },
        { id: 'st-pendiente', name: 'Pendiente', type: 'SYSTEM' },
        { id: 'st-mejorar-contenido', name: 'Mejorar contenido', type: 'SYSTEM' },
        { id: 'st-validar-datos', name: 'Validar datos', type: 'SYSTEM' }
    ];

    const FAKE_INTERNAL_TAGS: StoreRecord[] = [
        { id: 'it-pendiente-aprobacion', name: 'Pendiente de aprobación', type: 'INTERNAL' },
        { id: 'it-datos-incompletos', name: 'Datos incompletos', type: 'INTERNAL' },
        { id: 'it-posible-duplicado', name: 'Posible duplicado', type: 'INTERNAL' },
        { id: 'it-revisar-imagenes', name: 'Revisar imágenes', type: 'INTERNAL' },
        { id: 'it-cliente-prioritario', name: 'Cliente prioritario', type: 'INTERNAL' }
    ];

    const ALL_FAKE_TAGS = [...FAKE_SYSTEM_TAGS, ...FAKE_INTERNAL_TAGS];

    /**
     * Fake users keyed by `slug` (the stable lookup field used by E-3).
     * Slugs match the assignedBySlug values in ENTITY_TAG_ASSIGNMENTS.
     */
    const FAKE_USERS: StoreRecord[] = [
        { id: 'uuid-host-001', slug: 'ana-rodríguez', role: 'HOST' },
        { id: 'uuid-editor-002', slug: 'carlos-martínez', role: 'EDITOR' },
        { id: 'uuid-admin-003', slug: 'admin-user', role: 'ADMIN' },
        { id: 'uuid-guest-004', slug: 'usuario-invitado', role: 'GUEST' }
    ];

    /**
     * Fake accommodations keyed by `name` (stable lookup field for E-3).
     * Names match the entityLookupKey values for ACCOMMODATION type.
     */
    const FAKE_ACCOMMODATIONS: StoreRecord[] = [
        { id: 'uuid-acc-001', name: 'Retiro Soleado' },
        { id: 'uuid-acc-002', name: 'Rio Soleado Cabaña' },
        { id: 'uuid-acc-003', name: 'Sendero Natural Country House' }
    ];

    /**
     * Fake posts keyed by `title` (stable lookup field for E-3).
     * Titles match the entityLookupKey values for POST type.
     */
    const FAKE_POSTS: StoreRecord[] = [
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
     * Fake destinations keyed by `name` (stable lookup field for E-3).
     * Names match the entityLookupKey values for DESTINATION type.
     */
    const FAKE_DESTINATIONS: StoreRecord[] = [
        { id: 'uuid-dest-001', name: 'Chajarí' },
        { id: 'uuid-dest-002', name: 'Colón' }
    ];

    /**
     * Fake events keyed by `name` (stable lookup field for E-3).
     * Names match the entityLookupKey values for EVENT type.
     */
    const FAKE_EVENTS: StoreRecord[] = [
        { id: 'uuid-event-002', name: 'Encuentro de Historia en Palacio San José 2025' }
    ];

    function buildTagModel(): EntityTagSeedModels['tagModel'] {
        return {
            async findOne(filter) {
                return (
                    ALL_FAKE_TAGS.find((t) => t.type === filter.type && t.name === filter.name) ??
                    null
                );
            }
        };
    }

    /**
     * User model stub: looks up by `slug` (userModel for the "assigned by" user)
     * and also by `slug` when the entity type is USER (target entity lookup).
     */
    function buildUserModel(): EntityTagSeedModels['userModel'] {
        return {
            async findOne(filter) {
                return FAKE_USERS.find((u) => u.slug === filter.slug) ?? null;
            }
        };
    }

    /**
     * Accommodation model stub: looks up by `name`.
     */
    function buildAccommodationModel(): EntityTagSeedModels['accommodationModel'] {
        return {
            async findOne(filter) {
                return FAKE_ACCOMMODATIONS.find((r) => r.name === filter.name) ?? null;
            }
        };
    }

    /**
     * Post model stub: looks up by `title`.
     */
    function buildPostModel(): EntityTagSeedModels['postModel'] {
        return {
            async findOne(filter) {
                return FAKE_POSTS.find((r) => r.title === filter.title) ?? null;
            }
        };
    }

    /**
     * Destination model stub: looks up by `name`.
     */
    function buildDestinationModel(): EntityTagSeedModels['destinationModel'] {
        return {
            async findOne(filter) {
                return FAKE_DESTINATIONS.find((r) => r.name === filter.name) ?? null;
            }
        };
    }

    /**
     * Event model stub: looks up by `name`.
     */
    function buildEventModel(): EntityTagSeedModels['eventModel'] {
        return {
            async findOne(filter) {
                return FAKE_EVENTS.find((r) => r.name === filter.name) ?? null;
            }
        };
    }

    function buildREntityTagModel(): EntityTagSeedModels['rEntityTagModel'] {
        return {
            async findOne(filter) {
                return (
                    rEntityTagStore.find(
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
                rEntityTagStore.push(row);
                rEntityTagInserts.push(row);
                return row;
            }
        };
    }

    function buildAllModels(): EntityTagSeedModels {
        return {
            tagModel: buildTagModel(),
            userModel: buildUserModel(),
            accommodationModel: buildAccommodationModel(),
            postModel: buildPostModel(),
            destinationModel: buildDestinationModel(),
            eventModel: buildEventModel(),
            rEntityTagModel: buildREntityTagModel()
        };
    }

    beforeEach(() => {
        rEntityTagInserts = [];
        rEntityTagStore = makeStore();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('when all required records exist', () => {
        it('should create rows for HOST assignments (SYSTEM tags)', async () => {
            const models = buildAllModels();

            await seedEntityTagAssignments(models);

            const hostAssigned = rEntityTagInserts.filter(
                (r) => r.assignedById === 'uuid-host-001'
            );
            // HOST creates: Favorito×2, Importante, Revisar luego, Mejorar fotos, Revisar precio, Cliente potencial = 7
            expect(hostAssigned).toHaveLength(7);
        });

        it('should create rows for EDITOR assignments (SYSTEM tags)', async () => {
            const models = buildAllModels();

            await seedEntityTagAssignments(models);

            const editorAssigned = rEntityTagInserts.filter(
                (r) => r.assignedById === 'uuid-editor-002'
            );
            // EDITOR creates: Borrador×2, Listo para publicar, Revisar luego, Pendiente, Mejorar contenido = 6
            expect(editorAssigned).toHaveLength(6);
        });

        it('should create rows for ADMIN assignments (INTERNAL + SYSTEM)', async () => {
            const models = buildAllModels();

            await seedEntityTagAssignments(models);

            const adminAssigned = rEntityTagInserts.filter(
                (r) => r.assignedById === 'uuid-admin-003'
            );
            // ADMIN creates: 5 INTERNAL + 2 SYSTEM = 7
            expect(adminAssigned).toHaveLength(7);
        });

        it('should include INTERNAL tags only from ADMIN assignments', async () => {
            const models = buildAllModels();

            await seedEntityTagAssignments(models);

            // Verify INTERNAL tag IDs in admin rows
            const adminAssigned = rEntityTagInserts.filter(
                (r) => r.assignedById === 'uuid-admin-003'
            );
            const internalTagIds = FAKE_INTERNAL_TAGS.map((t) => t.id);
            const adminInternalRows = adminAssigned.filter((r) =>
                internalTagIds.includes(r.tagId as string)
            );
            // 5 INTERNAL assignments from admin
            expect(adminInternalRows).toHaveLength(5);
        });

        it('should include SYSTEM tags in HOST assignments', async () => {
            const models = buildAllModels();

            await seedEntityTagAssignments(models);

            const systemTagIds = FAKE_SYSTEM_TAGS.map((t) => t.id);
            const hostAssigned = rEntityTagInserts.filter(
                (r) => r.assignedById === 'uuid-host-001'
            );
            const hostSystemRows = hostAssigned.filter((r) =>
                systemTagIds.includes(r.tagId as string)
            );
            expect(hostSystemRows).toHaveLength(7);
        });

        it('should populate assignedById for every row', async () => {
            const models = buildAllModels();

            await seedEntityTagAssignments(models);

            for (const row of rEntityTagInserts) {
                expect(typeof row.assignedById).toBe('string');
                expect((row.assignedById as string).length).toBeGreaterThan(0);
            }
        });

        it('should populate entityType for every row', async () => {
            const models = buildAllModels();

            await seedEntityTagAssignments(models);

            const validEntityTypes = ['ACCOMMODATION', 'POST', 'DESTINATION', 'EVENT', 'USER'];
            for (const row of rEntityTagInserts) {
                expect(validEntityTypes).toContain(row.entityType as string);
            }
        });

        it('should total 20 rows across all actors (7 HOST + 6 EDITOR + 7 ADMIN)', async () => {
            const models = buildAllModels();

            await seedEntityTagAssignments(models);

            expect(rEntityTagInserts).toHaveLength(20);
        });
    });

    describe('idempotency', () => {
        it('should create 0 new rows on a second run', async () => {
            const models = buildAllModels();

            // First run
            await seedEntityTagAssignments(models);
            const countAfterFirst = rEntityTagInserts.length;

            // Second run: all assignments already exist
            await seedEntityTagAssignments(models);
            expect(rEntityTagInserts).toHaveLength(countAfterFirst);
        });
    });

    describe('when a user is not found', () => {
        it('should skip that actor and continue with others', async () => {
            const limitedUsers = FAKE_USERS.filter((u) => u.role !== 'EDITOR');
            const models: EntityTagSeedModels = {
                ...buildAllModels(),
                userModel: {
                    async findOne(f) {
                        return limitedUsers.find((u) => u.slug === f.slug) ?? null;
                    }
                }
            };

            await seedEntityTagAssignments(models);

            const editorAssigned = rEntityTagInserts.filter(
                (r) => r.assignedById === 'uuid-editor-002'
            );
            expect(editorAssigned).toHaveLength(0);
        });
    });

    describe('when a tag is not found', () => {
        it('should skip that specific assignment and continue', async () => {
            // Remove "Favorito" from the tag store
            const limitedTags = ALL_FAKE_TAGS.filter((t) => t.name !== 'Favorito');
            const models: EntityTagSeedModels = {
                ...buildAllModels(),
                tagModel: {
                    async findOne(f) {
                        return (
                            limitedTags.find((t) => t.type === f.type && t.name === f.name) ?? null
                        );
                    }
                }
            };

            await seedEntityTagAssignments(models);

            // Favorito was used twice by HOST (acc-1, acc-2) → 20 - 2 = 18 rows
            expect(rEntityTagInserts).toHaveLength(18);
        });
    });

    describe('error handling', () => {
        it('should propagate errors thrown by rEntityTagModel.create', async () => {
            const errorRModel: EntityTagSeedModels['rEntityTagModel'] = {
                async findOne() {
                    return null;
                },
                async create() {
                    throw new Error('r_entity_tag insert failed');
                }
            };
            const models: EntityTagSeedModels = {
                ...buildAllModels(),
                rEntityTagModel: errorRModel
            };

            await expect(seedEntityTagAssignments(models)).rejects.toThrow(
                'r_entity_tag insert failed'
            );
        });
    });
});
