/**
 * Unit tests for the markUserReady helper (SPEC-264).
 *
 * Uses an in-memory port stub so no live database is required.
 * Mirrors the port-injection + stub pattern from
 * `packages/seed/test/required/systemUser.seed.test.ts`.
 */
import { UserSettingsSchema } from '@repo/schemas';
import type { User } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type MarkUserReadyResult,
    TOUR_READY_SENTINEL,
    type UserReadyModelPort,
    markUserReady
} from '../../src/test-users/markUserReady.js';

// ---------------------------------------------------------------------------
// Mock the logger so test output stays clean (markUserReady itself doesn't log,
// but import side effects from @repo/schemas might indirectly pull it in).
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// In-memory stub — satisfies UserReadyModelPort without a DB.
// ---------------------------------------------------------------------------

/** The user row returned by findOne (null = not found). */
let storedUser: Partial<User> | null = null;

/** Captures the last payload passed to update(). */
let capturedUpdatePayload: Record<string, unknown> | null = null;

/** Number of times update() was called. */
let updateCallCount = 0;

/** Builds a fresh stub for each test. */
function buildStubModel(): UserReadyModelPort {
    return {
        async findOne(_filter: Record<string, unknown>) {
            return storedUser as User | null;
        },
        async update(_where: Record<string, unknown>, data: Partial<User>) {
            updateCallCount++;
            capturedUpdatePayload = data as Record<string, unknown>;
            // Return the merged row so callers can inspect it.
            return { ...(storedUser ?? {}), ...data } as User;
        }
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal user stub with the given settings shape. */
function makeUser(overrides: Partial<User> = {}): Partial<User> {
    return {
        id: 'user-123',
        email: 'test@local.test',
        settings: undefined,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('markUserReady (SPEC-264)', () => {
    let model: UserReadyModelPort;

    beforeEach(() => {
        storedUser = null;
        capturedUpdatePayload = null;
        updateCallCount = 0;
        model = buildStubModel();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // AC-2.2 — missing user
    // -----------------------------------------------------------------------

    describe('when the user is not found', () => {
        it('returns { ok: false, reason: "not_found" } (AC-2.2)', async () => {
            // Arrange: no user in store
            storedUser = null;

            // Act
            const result: MarkUserReadyResult = await markUserReady({
                email: 'nobody@local.test',
                model
            });

            // Assert
            expect(result).toStrictEqual({ ok: false, reason: 'not_found' });
        });

        it('does NOT call update when user is not found (AC-2.2)', async () => {
            storedUser = null;

            await markUserReady({ email: 'nobody@local.test', model });

            expect(updateCallCount).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // AC-1.1 — profileCompleted = true
    // -----------------------------------------------------------------------

    describe('AC-1.1 — profileCompleted', () => {
        it('writes profileCompleted = true in the update payload', async () => {
            storedUser = makeUser();

            await markUserReady({ email: 'test@local.test', model });

            expect(capturedUpdatePayload?.profileCompleted).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // AC-1.4 — mustChangePassword = false
    // -----------------------------------------------------------------------

    describe('AC-1.4 — mustChangePassword cleared', () => {
        it('writes mustChangePassword = false in the update payload', async () => {
            storedUser = makeUser();

            await markUserReady({ email: 'test@local.test', model });

            const payload = capturedUpdatePayload as Record<string, unknown>;
            // Verifies the in-memory update payload only. Real DB persistence relies on
            // Drizzle mapping mustChangePassword → must_change_password (verified manually)
            // and is out of scope for this unit suite.
            expect(payload.mustChangePassword).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // AC-1.2 — adminTours["host.welcome"] = TOUR_READY_SENTINEL
    // -----------------------------------------------------------------------

    describe('AC-1.2 — welcome tour sentinel', () => {
        it('sets adminTours["host.welcome"] to TOUR_READY_SENTINEL', async () => {
            storedUser = makeUser();

            await markUserReady({ email: 'test@local.test', model });

            const settings = capturedUpdatePayload?.settings as Record<string, unknown>;
            const onboarding = settings?.onboarding as Record<string, unknown>;
            const adminTours = onboarding?.adminTours as Record<string, number>;
            expect(adminTours['host.welcome']).toBe(TOUR_READY_SENTINEL);
        });

        it('TOUR_READY_SENTINEL equals 9999', () => {
            expect(TOUR_READY_SENTINEL).toBe(9999);
        });
    });

    // -----------------------------------------------------------------------
    // AC-1.3 — whatsNew.baselineAt is a valid ISO datetime
    // -----------------------------------------------------------------------

    describe('AC-1.3 — whatsNew.baselineAt', () => {
        it('sets whatsNew.baselineAt to a valid ISO datetime string', async () => {
            storedUser = makeUser();

            const before = new Date().toISOString();
            await markUserReady({ email: 'test@local.test', model });
            const after = new Date().toISOString();

            const settings = capturedUpdatePayload?.settings as Record<string, unknown>;
            const onboarding = settings?.onboarding as Record<string, unknown>;
            const whatsNew = onboarding?.whatsNew as Record<string, unknown>;
            const baselineAt = whatsNew?.baselineAt as string;

            // Must be a string
            expect(typeof baselineAt).toBe('string');
            // Must be a valid ISO datetime (parseable by Date)
            expect(Number.isNaN(new Date(baselineAt).getTime())).toBe(false);
            // Must be within the test window
            expect(baselineAt >= before).toBe(true);
            expect(baselineAt <= after).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Happy-path return value
    // -----------------------------------------------------------------------

    describe('success return value', () => {
        it('returns { ok: true, userId } with the correct user id', async () => {
            storedUser = makeUser({ id: 'user-abc-123' });

            const result = await markUserReady({ email: 'test@local.test', model });

            expect(result).toStrictEqual({ ok: true, userId: 'user-abc-123' });
        });
    });

    // -----------------------------------------------------------------------
    // AC-3.1 — preserves existing settings keys
    // -----------------------------------------------------------------------

    describe('AC-3.1 — non-destructive merge of existing settings', () => {
        it('preserves a top-level theme key in settings', async () => {
            storedUser = makeUser({
                settings: {
                    themeWeb: 'dark'
                }
            });

            await markUserReady({ email: 'test@local.test', model });

            const settings = capturedUpdatePayload?.settings as Record<string, unknown>;
            expect(settings.themeWeb).toBe('dark');
        });

        it('preserves other adminTours entries (e.g. "other.tour")', async () => {
            storedUser = makeUser({
                settings: {
                    onboarding: {
                        adminTours: { 'other.tour': 1 }
                    }
                }
            });

            await markUserReady({ email: 'test@local.test', model });

            const settings = capturedUpdatePayload?.settings as Record<string, unknown>;
            const onboarding = settings?.onboarding as Record<string, unknown>;
            const adminTours = onboarding?.adminTours as Record<string, number>;
            // Existing entry preserved
            expect(adminTours['other.tour']).toBe(1);
            // New entry written alongside
            expect(adminTours['host.welcome']).toBe(TOUR_READY_SENTINEL);
        });

        it('preserves both theme and other.tour together', async () => {
            storedUser = makeUser({
                settings: {
                    themeWeb: 'dark',
                    onboarding: {
                        adminTours: { 'other.tour': 1 }
                    }
                }
            });

            await markUserReady({ email: 'test@local.test', model });

            const settings = capturedUpdatePayload?.settings as Record<string, unknown>;
            expect(settings.themeWeb).toBe('dark');
            const onboarding = settings?.onboarding as Record<string, unknown>;
            const adminTours = onboarding?.adminTours as Record<string, number>;
            expect(adminTours['other.tour']).toBe(1);
            expect(adminTours['host.welcome']).toBe(TOUR_READY_SENTINEL);
        });
    });

    // -----------------------------------------------------------------------
    // AC-3.2 — settings = null creates a valid object from scratch
    // -----------------------------------------------------------------------

    describe('AC-3.2 — settings = null handled gracefully', () => {
        it('creates a valid settings object when stored settings is null', async () => {
            storedUser = makeUser({ settings: undefined });

            await markUserReady({ email: 'test@local.test', model });

            const settings = capturedUpdatePayload?.settings as Record<string, unknown>;
            expect(settings).toBeTruthy();
            expect(typeof settings).toBe('object');
        });

        it('the created settings contains the onboarding namespace', async () => {
            storedUser = makeUser({ settings: undefined });

            await markUserReady({ email: 'test@local.test', model });

            const settings = capturedUpdatePayload?.settings as Record<string, unknown>;
            expect(settings?.onboarding).toBeTruthy();
        });

        it('the created settings parses cleanly against UserSettingsSchema', async () => {
            storedUser = makeUser({ settings: undefined });

            await markUserReady({ email: 'test@local.test', model });

            const settings = capturedUpdatePayload?.settings;
            const parseResult = UserSettingsSchema.safeParse(settings);
            expect(parseResult.success).toBe(true);
            // UserSettingsSchema is not .strict() and all fields are optional, so
            // success=true alone is a weak assertion. Verify the sentinel survived the parse.
            expect(parseResult.data?.onboarding?.adminTours?.['host.welcome']).toBe(
                TOUR_READY_SENTINEL
            );
        });
    });

    // -----------------------------------------------------------------------
    // UserSettingsSchema validation — full happy-path parse
    // -----------------------------------------------------------------------

    describe('UserSettingsSchema validation', () => {
        it('the produced settings object parses cleanly via UserSettingsSchema (AC schema parse)', async () => {
            storedUser = makeUser({
                settings: {
                    themeWeb: 'dark',
                    onboarding: {
                        adminTours: { 'other.tour': 1 }
                    }
                }
            });

            await markUserReady({ email: 'test@local.test', model });

            const settings = capturedUpdatePayload?.settings;
            const parseResult = UserSettingsSchema.safeParse(settings);
            expect(parseResult.success).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Idempotency — second run keeps the same baselineAt
    // -----------------------------------------------------------------------

    describe('idempotency', () => {
        it('a second run preserves the same baselineAt (does not move it forward)', async () => {
            // First run: user has no existing settings
            storedUser = makeUser({ settings: undefined });
            await markUserReady({ email: 'test@local.test', model });

            // Capture baselineAt from first run
            const firstSettings = capturedUpdatePayload?.settings as Record<string, unknown>;
            const firstOnboarding = firstSettings?.onboarding as Record<string, unknown>;
            const firstWhatsNew = firstOnboarding?.whatsNew as Record<string, unknown>;
            const firstBaselineAt = firstWhatsNew?.baselineAt as string;

            // Second run: simulate the user now has the first-run settings stored
            storedUser = makeUser({
                settings: firstSettings
            });
            capturedUpdatePayload = null;

            await markUserReady({ email: 'test@local.test', model });

            // The second run must NOT change baselineAt
            const secondSettings = capturedUpdatePayload?.settings as Record<string, unknown>;
            const secondOnboarding = secondSettings?.onboarding as Record<string, unknown>;
            const secondWhatsNew = secondOnboarding?.whatsNew as Record<string, unknown>;
            const secondBaselineAt = secondWhatsNew?.baselineAt as string;

            expect(secondBaselineAt).toBe(firstBaselineAt);
        });

        it('a second run preserves the TOUR_READY_SENTINEL (idempotent for adminTours)', async () => {
            // First run
            storedUser = makeUser({ settings: undefined });
            await markUserReady({ email: 'test@local.test', model });

            const firstSettings = capturedUpdatePayload?.settings as Record<string, unknown>;

            // Second run with first-run settings
            storedUser = makeUser({ settings: firstSettings });
            capturedUpdatePayload = null;
            await markUserReady({ email: 'test@local.test', model });

            const secondSettings = capturedUpdatePayload?.settings as Record<string, unknown>;
            const onboarding = secondSettings?.onboarding as Record<string, unknown>;
            const adminTours = onboarding?.adminTours as Record<string, number>;
            expect(adminTours['host.welcome']).toBe(TOUR_READY_SENTINEL);
        });
    });
});
