import { LISTING_SECTIONS, VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { isGranted } from '../../src/authorization/entitlement-step';
import { rehydrateEffectiveSet } from '../../src/effective-set-cache/snapshot';
import {
    resolveListingSections,
    UnknownBusinessLineError,
    UnknownListingSectionIdError,
    UnknownListingSectionKeyError
} from '../../src/listing-sections';

function effective(vertical: 'venue' | 'experience' | 'accommodation', keys: readonly string[]) {
    const userId = 'owner';
    return rehydrateEffectiveSet({
        version: 1,
        userId,
        vertical:
            vertical === 'venue'
                ? VerticalEnum.VENUE
                : vertical === 'experience'
                  ? VerticalEnum.EXPERIENCE
                  : VerticalEnum.ACCOMMODATION,
        hasLiveNonTrialTitle: false,
        inheritsTouristVip: false,
        entries: keys.map((key) => ({ key, value: 1, strategy: 'MAX' as const }))
    });
}

describe('resolveListingSections', () => {
    it('TEST:3.1:1 resolves venue food and nightlife, including locked, absent and multiline states', () => {
        const locked = resolveListingSections({
            vertical: 'venue',
            businessLines: ['food'],
            effective: effective('venue', []),
            userId: 'owner'
        });
        expect(locked.sections.get('menu')).toEqual({
            state: 'locked',
            traits: new Map([
                ['itemPhotos', 'locked'],
                ['translations', 'locked'],
                ['qr', 'locked'],
                ['qrMetrics', 'locked']
            ])
        });
        expect(locked.sections.get('basicInfo')?.state).toBe('available');

        const partial = resolveListingSections({
            vertical: 'venue',
            businessLines: ['food'],
            effective: effective('venue', [
                'manage_venue_menu',
                'multilingual_venue_menu',
                'menu_qr_scan_metrics'
            ]),
            userId: 'owner'
        });
        expect(partial.sections.get('menu')).toEqual({
            state: 'available',
            traits: new Map([
                ['itemPhotos', 'locked'],
                ['translations', 'available'],
                ['qr', 'available'],
                ['qrMetrics', 'available']
            ])
        });
        expect(partial.sections.get('dailySpecials')?.state).toBe('locked');

        const boliche = resolveListingSections({
            vertical: 'venue',
            businessLines: ['nightlife'],
            effective: effective('venue', []),
            userId: 'owner'
        });
        expect(boliche.sections.get('menu')).toEqual({
            state: 'absent',
            traits: new Map([
                ['itemPhotos', 'absent'],
                ['translations', 'absent'],
                ['qr', 'absent'],
                ['qrMetrics', 'absent']
            ])
        });
        expect(boliche.sections.get('dailySpecials')?.state).toBe('absent');
        expect(boliche.sections.get('nightInfo')?.state).toBe('available');
        expect(boliche.multiLine).toBe(false);
        const restoBar = resolveListingSections({
            vertical: 'venue',
            businessLines: ['food', 'nightlife'],
            effective: effective('venue', []),
            userId: 'owner'
        });
        expect(restoBar.sections.get('menu')?.state).toBe('locked');
        expect(restoBar.multiLine).toBe(true);
    });

    it('TEST:3.1:1 resolves experience and accommodation trait gates and common sections', () => {
        const experienceLocked = resolveListingSections({
            vertical: 'experience',
            businessLines: ['standard'],
            effective: effective('experience', []),
            userId: 'owner'
        });
        expect(experienceLocked.sections.get('meetingPoint')?.traits.get('directions')).toBe(
            'locked'
        );
        expect(experienceLocked.sections.get('basicInfo')?.state).toBe('available');
        const experienceGranted = resolveListingSections({
            vertical: 'experience',
            businessLines: ['standard'],
            effective: effective('experience', ['manage_experience_directions']),
            userId: 'owner'
        });
        expect(experienceGranted.sections.get('meetingPoint')?.traits.get('directions')).toBe(
            'available'
        );

        const accommodation = resolveListingSections({
            vertical: 'accommodation',
            businessLines: ['standard'],
            effective: effective('accommodation', ['can_sync_external_calendar']),
            userId: 'owner'
        });
        expect(accommodation.sections.get('calendar')).toEqual({
            state: 'locked',
            traits: new Map([['externalSync', 'locked']])
        });
        const accommodationGranted = resolveListingSections({
            vertical: 'accommodation',
            businessLines: ['standard'],
            effective: effective('accommodation', [
                'can_use_calendar',
                'can_sync_external_calendar'
            ]),
            userId: 'owner'
        });
        expect(accommodationGranted.sections.get('calendar')?.traits.get('externalSync')).toBe(
            'available'
        );
        expect(accommodationGranted.sections.get('basicInfo')?.state).toBe('available');
    });

    it('keeps every common catalog section present in all verticals', () => {
        const cases = [
            {
                vertical: 'venue' as const,
                lines: ['nightlife'],
                effectiveSet: effective('venue', [])
            },
            {
                vertical: 'experience' as const,
                lines: ['standard'],
                effectiveSet: effective('experience', [])
            },
            {
                vertical: 'accommodation' as const,
                lines: ['standard'],
                effectiveSet: effective('accommodation', [])
            }
        ];
        for (const item of cases) {
            const result = resolveListingSections({
                vertical: item.vertical,
                businessLines: item.lines,
                effective: item.effectiveSet,
                userId: 'owner'
            });
            for (const section of LISTING_SECTIONS[item.vertical].filter((entry) => entry.common)) {
                expect(result.sections.get(section.id)?.state).not.toBe('absent');
            }
        }
    });

    it('TEST:3.1:2 rejects unknown business lines, section ids and catalog keys', () => {
        const common = {
            vertical: 'venue' as const,
            businessLines: ['food'],
            effective: effective('venue', []),
            userId: 'owner'
        };
        expect(() => resolveListingSections({ ...common, businessLines: ['standard'] })).toThrow(
            UnknownBusinessLineError
        );
        const catalog = {
            sections: [
                {
                    id: 'invented',
                    vertical: 'venue' as const,
                    common: true,
                    fields: [],
                    order: 1,
                    group: 'content' as const
                }
            ],
            businessLines: [{ value: 'food', sections: ['unknown-section'] }]
        };
        expect(() => resolveListingSections({ ...common, catalog })).toThrow(
            UnknownListingSectionIdError
        );
        const badKey = {
            sections: [
                {
                    id: 'invented',
                    vertical: 'venue' as const,
                    common: true,
                    fields: [],
                    traits: [{ id: 'inventedTrait', entitlementKey: 'not_a_catalog_key' }],
                    order: 1,
                    group: 'content' as const
                }
            ],
            businessLines: [{ value: 'food', sections: ['invented'] }]
        };
        expect(() => resolveListingSections({ ...common, catalog: badKey })).toThrow(
            UnknownListingSectionKeyError
        );
    });
});

describe('isGranted', () => {
    it('TEST:3.1:3 grants only positive effective values and supports multiple keys at the caller', () => {
        const zero = rehydrateEffectiveSet({
            version: 1,
            userId: 'owner',
            vertical: VerticalEnum.VENUE,
            hasLiveNonTrialTitle: false,
            inheritsTouristVip: false,
            entries: [{ key: 'manage_venue_menu', value: 0, strategy: 'MAX' }]
        });
        expect(
            isGranted({
                effective: zero,
                key: 'manage_venue_menu',
                userId: 'owner',
                vertical: VerticalEnum.VENUE
            })
        ).toBe(false);
        expect(
            isGranted({
                effective: effective('venue', []),
                key: 'manage_venue_menu',
                userId: 'owner',
                vertical: VerticalEnum.VENUE
            })
        ).toBe(false);
        const positive = effective('venue', ['manage_venue_menu', 'manage_venue_daily_special']);
        expect(
            isGranted({
                effective: positive,
                key: 'manage_venue_menu',
                userId: 'owner',
                vertical: VerticalEnum.VENUE
            })
        ).toBe(true);
        expect(
            ['manage_venue_menu', 'manage_venue_daily_special'].some((key) =>
                isGranted({
                    effective: positive,
                    key,
                    userId: 'owner',
                    vertical: VerticalEnum.VENUE
                })
            )
        ).toBe(true);
    });
});
