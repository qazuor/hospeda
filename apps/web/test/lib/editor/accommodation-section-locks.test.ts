/**
 * @file accommodation-section-locks.test.ts
 * @description The accommodation hub shows a locked line for a section the
 * resolver reports as `locked` (HOS-1809).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyLockedSectionStatuses } from '@/lib/editor/accommodation-section-locks';
import type { EditorSectionStatus } from '@/lib/editor/editor-hub-status-model';

const NEUTRAL: EditorSectionStatus = { labelKey: 'x.neutral', tone: 'neutral' };
const BLOCKING: EditorSectionStatus = { labelKey: 'x.blocking', tone: 'blocking' };

describe('applyLockedSectionStatuses', () => {
    it('shows the locked line on a locked section (calendar without can_use_calendar)', () => {
        const result = applyLockedSectionStatuses({
            statuses: { basicInfo: NEUTRAL },
            sectionStates: {
                basicInfo: { state: 'available' },
                calendar: { state: 'locked', traits: { externalSync: 'locked' } }
            }
        });

        expect(result.calendar).toEqual({
            labelKey: 'listing.owner.editor.hub.status.lockedEmpty',
            tone: 'locked'
        });
        expect(result.basicInfo).toBe(NEUTRAL);
    });

    it('replaces a neutral line but never a blocking one', () => {
        const result = applyLockedSectionStatuses({
            statuses: { calendar: NEUTRAL, photos: BLOCKING },
            sectionStates: { calendar: { state: 'locked' }, photos: { state: 'locked' } }
        });

        expect(result.calendar?.tone).toBe('locked');
        expect(result.photos).toBe(BLOCKING);
    });

    it('leaves available sections and an unread (empty) map untouched', () => {
        const statuses = { calendar: NEUTRAL };

        expect(
            applyLockedSectionStatuses({
                statuses,
                sectionStates: { calendar: { state: 'available' } }
            })
        ).toEqual(statuses);
        expect(applyLockedSectionStatuses({ statuses, sectionStates: {} })).toEqual(statuses);
    });

    it('does not mutate its input', () => {
        const statuses = { calendar: NEUTRAL };
        applyLockedSectionStatuses({
            statuses,
            sectionStates: { calendar: { state: 'locked' } }
        });

        expect(statuses.calendar).toBe(NEUTRAL);
    });
});

describe('accommodation hub wiring', () => {
    const HUB = readFileSync(
        resolve(
            __dirname,
            '../../../src/pages/[lang]/mi-cuenta/propiedades/[id]/editar/index.astro'
        ),
        'utf8'
    );
    const CALENDAR = readFileSync(
        resolve(
            __dirname,
            '../../../src/pages/[lang]/mi-cuenta/propiedades/[id]/editar/calendario.astro'
        ),
        'utf8'
    );

    it('reads the section states and overlays the locked lines', () => {
        expect(HUB).toContain('getAccommodationSectionStates');
        expect(HUB).toContain('applyLockedSectionStatuses');
    });

    it('keeps the calendar page-level entitlement gate', () => {
        expect(CALENDAR).toContain('PlanEntitlementGate');
        expect(CALENDAR).toContain('entitlementKey="can_use_calendar"');
    });
});
