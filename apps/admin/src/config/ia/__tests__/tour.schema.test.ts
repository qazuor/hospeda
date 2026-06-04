/**
 * Unit tests for TourSchema, TourStepSchema, and ToursRecordSchema (SPEC-174 T-005).
 *
 * Coverage (per SPEC-174 §14):
 * - Valid welcome tour parses successfully.
 * - Valid contextual tour parses successfully.
 * - Contextual tour without route is rejected.
 * - Welcome tour with route is rejected.
 * - Duplicate step ids are rejected.
 * - Bad step target 'data-tour:UPPER' (uppercase) is rejected.
 * - Bad step target 'random' (no prefix) is rejected.
 * - Version 0 is rejected (must be positive integer).
 * - Version float is rejected (must be integer).
 * - Target 'center' is always valid.
 * - Target 'data-tour:<id>' with valid lowercase kebab id is accepted.
 * - Roles 'all' is accepted.
 * - Explicit roles array is accepted.
 * - permissions on a step are optional.
 * - side and align on a step are optional.
 */

import { describe, expect, it } from 'vitest';
import {
    TourSchema,
    TourStepSchema,
    TourStepTargetSchema,
    ToursRecordSchema
} from '../tour.schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLabel = (text: string) => ({ es: `${text} es`, en: `${text} en`, pt: `${text} pt` });

const makeStep = (id: string, target = 'center') => ({
    id,
    target,
    title: makeLabel(`${id} title`),
    body: makeLabel(`${id} body`)
});

const makeWelcomeTour = (overrides: Record<string, unknown> = {}) => ({
    id: 'host.welcome',
    roles: ['HOST'] as ['HOST'],
    kind: 'welcome' as const,
    version: 1,
    trigger: 'auto-first-visit' as const,
    showWelcomeModal: true,
    steps: [makeStep('greeting'), makeStep('main-nav', 'data-tour:main-menu')],
    ...overrides
});

const makeContextualTour = (overrides: Record<string, unknown> = {}) => ({
    id: 'host.misAlojamientos',
    roles: ['HOST'] as ['HOST'],
    kind: 'contextual' as const,
    route: '/me/accommodations',
    version: 1,
    trigger: 'auto-first-visit' as const,
    showWelcomeModal: false,
    steps: [makeStep('list', 'data-tour:sidebar')],
    ...overrides
});

// ---------------------------------------------------------------------------
// TourStepTargetSchema
// ---------------------------------------------------------------------------

describe('TourStepTargetSchema', () => {
    it("accepts 'center'", () => {
        expect(TourStepTargetSchema.safeParse('center').success).toBe(true);
    });

    it("accepts 'data-tour:main-menu'", () => {
        expect(TourStepTargetSchema.safeParse('data-tour:main-menu').success).toBe(true);
    });

    it("accepts 'data-tour:sidebar'", () => {
        expect(TourStepTargetSchema.safeParse('data-tour:sidebar').success).toBe(true);
    });

    it("accepts 'data-tour:user-menu'", () => {
        expect(TourStepTargetSchema.safeParse('data-tour:user-menu').success).toBe(true);
    });

    it("rejects 'data-tour:UPPER' (uppercase id)", () => {
        expect(TourStepTargetSchema.safeParse('data-tour:UPPER').success).toBe(false);
    });

    it("rejects 'data-tour:has_underscore' (underscore not allowed)", () => {
        expect(TourStepTargetSchema.safeParse('data-tour:has_underscore').success).toBe(false);
    });

    it("rejects 'random' (no prefix)", () => {
        expect(TourStepTargetSchema.safeParse('random').success).toBe(false);
    });

    it("rejects '' (empty string)", () => {
        expect(TourStepTargetSchema.safeParse('').success).toBe(false);
    });

    it("rejects 'data-tour:' (empty id part)", () => {
        // The regex requires at least one char in [a-z0-9-]+ after the colon
        expect(TourStepTargetSchema.safeParse('data-tour:').success).toBe(false);
    });

    // Section-prefix branch (camelCase section ids)
    it("accepts 'data-tour:main-menu-section-catalogo' (lowercase section id)", () => {
        expect(TourStepTargetSchema.safeParse('data-tour:main-menu-section-catalogo').success).toBe(
            true
        );
    });

    it("accepts 'data-tour:main-menu-section-misAlojamientos' (camelCase section id)", () => {
        expect(
            TourStepTargetSchema.safeParse('data-tour:main-menu-section-misAlojamientos').success
        ).toBe(true);
    });

    it("accepts 'data-tour:main-menu-section-miFacturacion' (camelCase section id)", () => {
        expect(
            TourStepTargetSchema.safeParse('data-tour:main-menu-section-miFacturacion').success
        ).toBe(true);
    });

    it("passes schema for 'data-tour:main-menu-section-' (Zod-level only — §T1 cross-check catches unknown section)", () => {
        // 'main-menu-section-' ends with a hyphen which the static [a-z0-9-]+ accepts.
        // The Zod schema itself allows this; the §T1 cross-check in AdminIAConfigSchema
        // is responsible for rejecting it at boot time when no matching section exists.
        expect(TourStepTargetSchema.safeParse('data-tour:main-menu-section-').success).toBe(true);
    });

    it("rejects 'data-tour:UPPER' (uppercase non-section target still rejected)", () => {
        // camelCase is only allowed WITH the section prefix; bare uppercase is invalid
        expect(TourStepTargetSchema.safeParse('data-tour:UPPER').success).toBe(false);
    });

    it("rejects 'data-tour:misAlojamientos' (camelCase without section prefix rejected)", () => {
        // camelCase without the full main-menu-section- prefix must be rejected
        expect(TourStepTargetSchema.safeParse('data-tour:misAlojamientos').success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// TourStepSchema
// ---------------------------------------------------------------------------

describe('TourStepSchema', () => {
    it('parses a minimal valid step (center target)', () => {
        const result = TourStepSchema.safeParse(makeStep('step-1'));
        expect(result.success).toBe(true);
    });

    it('parses a step with data-tour target and optional side + align', () => {
        const result = TourStepSchema.safeParse({
            ...makeStep('nav-step', 'data-tour:main-menu'),
            side: 'right',
            align: 'start'
        });
        expect(result.success).toBe(true);
    });

    it('parses a step with permissions gate', () => {
        const result = TourStepSchema.safeParse({
            ...makeStep('admin-step', 'data-tour:sidebar'),
            permissions: ['ACCOMMODATION_VIEW_ALL']
        });
        expect(result.success).toBe(true);
    });

    it('rejects when id is empty', () => {
        const result = TourStepSchema.safeParse({ ...makeStep(''), id: '' });
        expect(result.success).toBe(false);
    });

    it('rejects bad target (uppercase)', () => {
        const result = TourStepSchema.safeParse(makeStep('s1', 'data-tour:UPPER'));
        expect(result.success).toBe(false);
    });

    it('rejects bad target (no prefix)', () => {
        const result = TourStepSchema.safeParse(makeStep('s1', 'random'));
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// TourSchema — welcome tours
// ---------------------------------------------------------------------------

describe('TourSchema — welcome tours', () => {
    it('parses a valid welcome tour', () => {
        const result = TourSchema.safeParse(makeWelcomeTour());
        expect(result.success).toBe(true);
    });

    it("accepts roles: 'all'", () => {
        const result = TourSchema.safeParse(makeWelcomeTour({ roles: 'all' }));
        expect(result.success).toBe(true);
    });

    it('accepts roles as an array of multiple roles', () => {
        const result = TourSchema.safeParse(
            makeWelcomeTour({ roles: ['HOST', 'EDITOR', 'ADMIN', 'SUPER_ADMIN'] })
        );
        expect(result.success).toBe(true);
    });

    it('accepts trigger: manual', () => {
        const result = TourSchema.safeParse(makeWelcomeTour({ trigger: 'manual' }));
        expect(result.success).toBe(true);
    });

    it('rejects welcome tour WITH a route (must be absent)', () => {
        const result = TourSchema.safeParse(makeWelcomeTour({ route: '/dashboard' }));
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('route');
        }
    });

    it('rejects version 0 (must be positive)', () => {
        const result = TourSchema.safeParse(makeWelcomeTour({ version: 0 }));
        expect(result.success).toBe(false);
    });

    it('rejects version as float (must be integer)', () => {
        const result = TourSchema.safeParse(makeWelcomeTour({ version: 1.5 }));
        expect(result.success).toBe(false);
    });

    it('rejects negative version', () => {
        const result = TourSchema.safeParse(makeWelcomeTour({ version: -1 }));
        expect(result.success).toBe(false);
    });

    it('rejects empty steps array', () => {
        const result = TourSchema.safeParse(makeWelcomeTour({ steps: [] }));
        expect(result.success).toBe(false);
    });

    it('rejects duplicate step ids', () => {
        const result = TourSchema.safeParse(
            makeWelcomeTour({ steps: [makeStep('dup'), makeStep('dup')] })
        );
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('steps');
        }
    });

    it('accepts steps with unique ids (no false positives)', () => {
        const result = TourSchema.safeParse(
            makeWelcomeTour({
                steps: [makeStep('step-a'), makeStep('step-b'), makeStep('step-c')]
            })
        );
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// TourSchema — contextual tours
// ---------------------------------------------------------------------------

describe('TourSchema — contextual tours', () => {
    it('parses a valid contextual tour', () => {
        const result = TourSchema.safeParse(makeContextualTour());
        expect(result.success).toBe(true);
    });

    it('rejects contextual tour WITHOUT a route', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { route: _route, ...withoutRoute } = makeContextualTour();
        const result = TourSchema.safeParse(withoutRoute);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('route');
        }
    });

    it('accepts showWelcomeModal: false (typical for contextual)', () => {
        const result = TourSchema.safeParse(makeContextualTour({ showWelcomeModal: false }));
        expect(result.success).toBe(true);
    });

    it('accepts showWelcomeModal: true on contextual (no schema constraint)', () => {
        const result = TourSchema.safeParse(makeContextualTour({ showWelcomeModal: true }));
        expect(result.success).toBe(true);
    });

    it('rejects duplicate step ids on contextual tour', () => {
        const result = TourSchema.safeParse(
            makeContextualTour({ steps: [makeStep('s1'), makeStep('s1')] })
        );
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ToursRecordSchema
// ---------------------------------------------------------------------------

describe('ToursRecordSchema', () => {
    it('parses an empty record', () => {
        const result = ToursRecordSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('parses a record with one welcome tour', () => {
        const result = ToursRecordSchema.safeParse({
            'host.welcome': makeWelcomeTour()
        });
        expect(result.success).toBe(true);
    });

    it('parses a record with mixed welcome + contextual tours', () => {
        const result = ToursRecordSchema.safeParse({
            'host.welcome': makeWelcomeTour(),
            'host.misAlojamientos': makeContextualTour()
        });
        expect(result.success).toBe(true);
    });

    it('propagates tour-level errors (contextual without route)', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { route: _route, ...withoutRoute } = makeContextualTour();
        const result = ToursRecordSchema.safeParse({
            'host.misAlojamientos': withoutRoute
        });
        expect(result.success).toBe(false);
    });
});
