/**
 * Tests for GET /api/v1/protected/whats-new handler (SPEC-175 T-006).
 *
 * Tests the pure `getWhatsNewHandler` directly with a stub UserService and
 * mocked `whatsNewEntries` data module — no app boot required.
 *
 * Coverage (per §12.3):
 * - 401 unauthenticated (actorMiddleware rejects — handler never runs)
 * - Guest actor rejected by protected tier
 * - Lazy init fires when onboarding.whatsNew is absent
 * - Lazy init skipped when state is present
 * - Role filter: ADMIN-targeted entries excluded from HOST response
 * - Seen computation via seenIds union and baselineAt comparison
 * - unseenCount matches items where seen === false
 * - Locale resolution: en field when languageAdmin = 'en', es fallback
 * - getById service error propagated as ServiceError
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the curated data module (the real file has an empty array; we need
// controlled fixtures to exercise filtering, seen computation, and locale).
// ---------------------------------------------------------------------------
vi.mock('../../../src/data/whats-new/whats-new', () => ({
    whatsNewEntries: [
        {
            id: 'entry-admin-only',
            publishedAt: '2026-06-01T00:00:00Z',
            highlight: true,
            roles: ['ADMIN', 'SUPER_ADMIN'],
            title: { es: 'Solo admins', en: 'Admins only' },
            body: { es: 'Cuerpo admin', en: 'Admin body' }
        },
        {
            id: 'entry-all-roles',
            publishedAt: '2026-05-20T00:00:00Z',
            highlight: false,
            // no roles → universal. Carries all three locales so the
            // `?locale=` query param test (HOS-964 follow-up) can assert
            // against `pt` too, not just the pre-existing `en`.
            title: { es: 'Título ES', en: 'Title EN', pt: 'Título PT' },
            body: { es: 'Cuerpo ES', en: 'Body EN', pt: 'Corpo PT' }
        },
        {
            id: 'entry-before-baseline',
            publishedAt: '2026-01-01T00:00:00Z',
            highlight: false,
            title: { es: 'Antiguo' },
            body: { es: 'Este es antiguo' }
        },
        {
            id: 'entry-host-only',
            publishedAt: '2026-05-25T00:00:00Z',
            highlight: true,
            roles: ['HOST'],
            // No 'en' key — used to test es fallback when languageAdmin = 'en'
            title: { es: 'Solo HOST' },
            body: { es: 'Cuerpo HOST' }
        },
        {
            // HOS-1216: scheduled far in the future relative to any real
            // clock this suite could run under. `highlight: true` and no
            // `roles` (universal) so it would, absent the fix, appear for
            // every actor, inflate unseenCount, and trip the auto-modal.
            id: 'entry-future-highlight',
            publishedAt: '2099-01-01T00:00:00Z',
            highlight: true,
            title: { es: 'Del futuro' },
            body: { es: 'Todavía no debería verse' }
        }
    ]
}));

import { getWhatsNewHandler } from '../../../src/routes/whats-new/protected/getWhatsNew';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Baseline set after the oldest test entries but before the recent ones. */
const BASELINE_AT = '2026-03-01T00:00:00Z';

const buildHostActor = () => ({
    id: '00000000-0000-0000-0000-000000000010',
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.USER_SETTINGS_UPDATE] as string[]
});

const buildGuestActor = () => ({
    id: '00000000-0000-4000-8000-000000000000',
    roles: [RoleEnum.GUEST],
    permissions: [PermissionEnum.ACCESS_API_PUBLIC] as string[]
});

const buildAdminActor = () => ({
    id: '00000000-0000-0000-0000-000000000020',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.USER_SETTINGS_UPDATE] as string[]
});

/**
 * Build a Hono context stub with the given actor.
 *
 * `req.query` mirrors Hono's real `ctx.req.query(name)` signature closely
 * enough for `getWhatsNewHandler`'s manual `?locale=` read (HOS-964
 * follow-up) — returns `undefined` when no query params were supplied.
 */
const buildCtx = (actor: ReturnType<typeof buildHostActor>, query: Record<string, string> = {}) =>
    ({
        get: (key: string) => (key === 'actor' ? actor : undefined),
        req: { query: (name: string) => query[name] }
    }) as Parameters<typeof getWhatsNewHandler>[0];

/** Build a minimal UserService stub returning the given user settings. */
const buildSvc = ({
    settings = {},
    initResult = { data: { initialized: true }, error: null },
    freshSettings = null as Record<string, unknown> | null
}: {
    settings?: Record<string, unknown>;
    initResult?: {
        data: { initialized: boolean } | null;
        error: { code: string; message: string } | null;
    };
    freshSettings?: Record<string, unknown> | null;
}) => {
    let callCount = 0;
    return {
        getById: vi.fn().mockImplementation(() => {
            callCount++;
            const settingsToUse =
                callCount > 1 && freshSettings !== null ? freshSettings : settings;
            return Promise.resolve({
                data: { id: '00000000-0000-0000-0000-000000000010', settings: settingsToUse },
                error: null
            });
        }),
        initWhatsNewBaseline: vi.fn().mockResolvedValue(initResult)
    };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getWhatsNewHandler (SPEC-175 T-006)', () => {
    describe('authentication / authorization', () => {
        it('propagates getById error as ServiceError', async () => {
            const actor = buildHostActor();
            const svc = {
                getById: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'INTERNAL_ERROR', message: 'db down' }
                }),
                initWhatsNewBaseline: vi.fn()
            };

            await expect(getWhatsNewHandler(buildCtx(actor), svc as never)).rejects.toThrow(
                ServiceError
            );
        });

        it('throws when getById returns null data (user not found)', async () => {
            const actor = buildHostActor();
            const svc = {
                getById: vi.fn().mockResolvedValue({ data: null, error: null }),
                initWhatsNewBaseline: vi.fn()
            };

            await expect(getWhatsNewHandler(buildCtx(actor), svc as never)).rejects.toThrow(
                'User not found'
            );
        });
    });

    describe('lazy init', () => {
        it('fires initWhatsNewBaseline when onboarding.whatsNew is absent', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: { onboarding: {} },
                freshSettings: {
                    onboarding: {
                        whatsNew: { baselineAt: '2026-06-04T00:00:00Z', seenIds: [] }
                    }
                }
            });

            await getWhatsNewHandler(buildCtx(actor), svc as never);

            expect(svc.initWhatsNewBaseline).toHaveBeenCalledOnce();
        });

        it('does NOT fire initWhatsNewBaseline when state is present', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: { whatsNew: { baselineAt: BASELINE_AT, seenIds: [] } }
                }
            });

            await getWhatsNewHandler(buildCtx(actor), svc as never);

            expect(svc.initWhatsNewBaseline).not.toHaveBeenCalled();
        });

        it('continues with fallback state when initWhatsNewBaseline fails', async () => {
            const actor = buildHostActor();
            const svc = {
                getById: vi.fn().mockResolvedValue({
                    data: { id: actor.id, settings: {} },
                    error: null
                }),
                initWhatsNewBaseline: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'INTERNAL_ERROR', message: 'write failed' }
                })
            };

            // Should not throw — failure is non-fatal.
            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);
            expect(result.items).toBeDefined();
        });
    });

    describe('role filter', () => {
        it('excludes ADMIN-only entries for a HOST actor', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const ids = result.items.map((i) => i.id);
            expect(ids).not.toContain('entry-admin-only');
            // HOST-targeted and universal entries ARE present
            expect(ids).toContain('entry-host-only');
            expect(ids).toContain('entry-all-roles');
        });

        it('includes ADMIN-only entries for an ADMIN actor', async () => {
            const actor = buildAdminActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const ids = result.items.map((i) => i.id);
            expect(ids).toContain('entry-admin-only');
            expect(ids).toContain('entry-all-roles');
            // HOST-only is excluded for ADMIN
            expect(ids).not.toContain('entry-host-only');
        });
    });

    describe('seen computation', () => {
        it('marks entry as seen when publishedAt <= baselineAt', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const old = result.items.find((i) => i.id === 'entry-before-baseline');
            // entry-before-baseline has publishedAt 2026-01-01 <= BASELINE_AT 2026-03-01
            expect(old?.seen).toBe(true);
        });

        it('marks entry as unseen when publishedAt > baselineAt and id not in seenIds', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const recent = result.items.find((i) => i.id === 'entry-all-roles');
            // publishedAt 2026-05-20 > BASELINE_AT 2026-03-01
            expect(recent?.seen).toBe(false);
        });

        it('marks entry as seen when its id is in seenIds regardless of date', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: {
                            baselineAt: BASELINE_AT,
                            seenIds: ['entry-all-roles', 'entry-host-only']
                        }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const all = result.items.find((i) => i.id === 'entry-all-roles');
            const host = result.items.find((i) => i.id === 'entry-host-only');
            expect(all?.seen).toBe(true);
            expect(host?.seen).toBe(true);
        });

        it('unseenCount matches items where seen === false', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const manualCount = result.items.filter((i) => !i.seen).length;
            expect(result.unseenCount).toBe(manualCount);
        });
    });

    describe('locale resolution', () => {
        it('resolves en field when languageAdmin = en', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    languageAdmin: 'en',
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const allRoles = result.items.find((i) => i.id === 'entry-all-roles');
            expect(allRoles?.title).toBe('Title EN');
            expect(allRoles?.body).toBe('Body EN');
        });

        it('falls back to es when requested locale field is absent', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    languageAdmin: 'en',
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            // entry-host-only has title.en absent → fallback to es
            const hostEntry = result.items.find((i) => i.id === 'entry-host-only');
            expect(hostEntry?.title).toBe('Solo HOST');
        });

        it('defaults to es when languageAdmin is absent', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const allRoles = result.items.find((i) => i.id === 'entry-all-roles');
            expect(allRoles?.title).toBe('Título ES');
        });

        // HOS-964 follow-up (2026-09-07 smoke finding): the endpoint is shared
        // by apps/admin and apps/web, but locale was only ever read from
        // `languageAdmin` — a web account has none, so it always fell back to
        // 'es' regardless of which `/en/` or `/pt/` page requested it. The
        // `?locale=` query param lets the CLIENT say which language it is
        // actually rendering.
        it('resolves en field when ?locale=en is passed, even without languageAdmin', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(
                buildCtx(actor, { locale: 'en' }),
                svc as never
            );

            const allRoles = result.items.find((i) => i.id === 'entry-all-roles');
            expect(allRoles?.title).toBe('Title EN');
            expect(allRoles?.body).toBe('Body EN');
        });

        it('resolves pt field when ?locale=pt is passed', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(
                buildCtx(actor, { locale: 'pt' }),
                svc as never
            );

            const allRoles = result.items.find((i) => i.id === 'entry-all-roles');
            expect(allRoles?.title).toBe('Título PT');
            expect(allRoles?.body).toBe('Corpo PT');
        });

        it('?locale= takes precedence over languageAdmin when both are present', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    languageAdmin: 'es',
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(
                buildCtx(actor, { locale: 'pt' }),
                svc as never
            );

            const allRoles = result.items.find((i) => i.id === 'entry-all-roles');
            expect(allRoles?.title).toBe('Título PT');
        });

        it('ignores an unsupported ?locale= value and falls back to languageAdmin', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    languageAdmin: 'en',
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(
                buildCtx(actor, { locale: 'fr' }),
                svc as never
            );

            const allRoles = result.items.find((i) => i.id === 'entry-all-roles');
            expect(allRoles?.title).toBe('Title EN');
        });

        it('falls back to languageWeb when languageAdmin is absent and no ?locale= is passed', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    languageWeb: 'pt',
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const allRoles = result.items.find((i) => i.id === 'entry-all-roles');
            expect(allRoles?.title).toBe('Título PT');
        });
    });

    describe('sort order', () => {
        it('returns items sorted newest-first by publishedAt', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const dates = result.items.map((i) => new Date(i.publishedAt).getTime());
            const sorted = [...dates].sort((a, b) => b - a);
            expect(dates).toEqual(sorted);
        });
    });

    describe('future publishedAt filtering (HOS-1216)', () => {
        it('excludes an entry scheduled for the future from items', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const ids = result.items.map((i) => i.id);
            expect(ids).not.toContain('entry-future-highlight');
        });

        it('does not let the future entry inflate unseenCount', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            // unseenCount must equal a manual recount over the (already
            // future-filtered) items — proves the future entry never
            // participated in the count at all, not even as a false-seen.
            const manualCount = result.items.filter((i) => !i.seen).length;
            expect(result.unseenCount).toBe(manualCount);
            expect(result.items.some((i) => i.id === 'entry-future-highlight')).toBe(false);
        });

        it('excludes the future highlighted entry so it cannot trip the auto-modal downstream', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            // apps/admin's hasUnseenHighlights (`item.highlight && !item.seen`)
            // only ever reads `items` — an entry excluded here can never
            // reach it, regardless of its `highlight` flag.
            const futureEntry = result.items.find((i) => i.id === 'entry-future-highlight');
            expect(futureEntry).toBeUndefined();
        });

        it('still returns a past entry unaffected by the future filter (no regression)', async () => {
            const actor = buildHostActor();
            const svc = buildSvc({
                settings: {
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [] }
                    }
                }
            });

            const result = await getWhatsNewHandler(buildCtx(actor), svc as never);

            const ids = result.items.map((i) => i.id);
            expect(ids).toContain('entry-before-baseline');
            expect(ids).toContain('entry-all-roles');
        });
    });

    describe('guest actor handling', () => {
        it('throws because guest actors lack a real user row', async () => {
            const actor = buildGuestActor();
            const svc = {
                getById: vi.fn().mockResolvedValue({ data: null, error: null }),
                initWhatsNewBaseline: vi.fn()
            };

            await expect(getWhatsNewHandler(buildCtx(actor), svc as never)).rejects.toThrow(
                'User not found'
            );
        });
    });
});
