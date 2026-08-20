/**
 * @file plan-usage-config.test.ts
 * @description Tests for the plan-usage presentation rules: audience grouping,
 * visibility, add-on mapping, and when the upgrade prompt appears.
 */

import { describe, expect, it } from 'vitest';
import type { LimitUsage } from '../../../src/lib/api/endpoints-protected';
import {
    addonSlugForLimit,
    audienceForLimit,
    groupLimitsByAudience,
    needsUpgradePrompt,
    shouldDisplayLimit
} from '../../../src/lib/billing/plan-usage-config';

/**
 * Builds a `LimitUsage` with sensible defaults so each test states only the
 * field it is about.
 */
function buildLimit(overrides: Partial<LimitUsage> & { limitKey: string }): LimitUsage {
    return {
        displayName: 'Some limit',
        currentUsage: 0,
        maxAllowed: 10,
        usagePercentage: 0,
        threshold: 'ok',
        planBaseLimit: 10,
        addonBonusLimit: 0,
        isMeasured: true,
        usageKind: 'stock',
        ...overrides
    };
}

describe('audienceForLimit', () => {
    it('should place listing limits under host', () => {
        expect(audienceForLimit('max_accommodations')).toBe('host');
        expect(audienceForLimit('max_active_promotions')).toBe('host');
        expect(audienceForLimit('max_photos_per_accommodation')).toBe('host');
    });

    it('should place traveller tools under traveler', () => {
        expect(audienceForLimit('max_favorites')).toBe('traveler');
        expect(audienceForLimit('max_collections')).toBe('traveler');
        expect(audienceForLimit('max_active_alerts')).toBe('traveler');
    });

    it('should split the AI meters by which side they serve', () => {
        // Improving a listing's text is host work; searching is traveller work.
        expect(audienceForLimit('max_ai_text_improve_per_month')).toBe('host');
        expect(audienceForLimit('max_ai_translate_per_month')).toBe('host');
        expect(audienceForLimit('max_ai_accommodation_import_per_month')).toBe('host');
        expect(audienceForLimit('max_ai_search_per_month')).toBe('traveler');
        expect(audienceForLimit('max_ai_chat_consumer_per_month')).toBe('traveler');
    });

    it('should split owner-side and consumer-side chat', () => {
        // Same `ai_usage` feature, opposite sides of the conversation.
        expect(audienceForLimit('max_ai_chat_per_month')).toBe('host');
        expect(audienceForLimit('max_ai_chat_consumer_per_month')).toBe('traveler');
    });
});

describe('shouldDisplayLimit', () => {
    it('should hide a limit the plan does not grant', () => {
        expect(shouldDisplayLimit(buildLimit({ limitKey: 'max_favorites', maxAllowed: 0 }))).toBe(
            false
        );
    });

    it('should hide a limit whose feature does not exist', () => {
        expect(
            shouldDisplayLimit(
                buildLimit({ limitKey: 'max_properties', maxAllowed: 5, usageKind: 'unbuilt' })
            )
        ).toBe(false);
    });

    it('should show an unlimited grant', () => {
        // -1 is "no ceiling", not "not granted".
        expect(shouldDisplayLimit(buildLimit({ limitKey: 'max_favorites', maxAllowed: -1 }))).toBe(
            true
        );
    });

    it('should show a per-operation cap', () => {
        // No consumption, but the cap itself is true and useful.
        expect(
            shouldDisplayLimit(
                buildLimit({
                    limitKey: 'max_compare_items',
                    maxAllowed: 4,
                    usageKind: 'per_operation',
                    isMeasured: false
                })
            )
        ).toBe(true);
    });
});

describe('needsUpgradePrompt', () => {
    it('should not prompt while comfortably under the limit', () => {
        expect(
            needsUpgradePrompt(buildLimit({ limitKey: 'max_accommodations', threshold: 'ok' }))
        ).toBe(false);
    });

    it('should prompt from the warning threshold onwards', () => {
        expect(
            needsUpgradePrompt(buildLimit({ limitKey: 'max_accommodations', threshold: 'warning' }))
        ).toBe(true);
        expect(
            needsUpgradePrompt(
                buildLimit({ limitKey: 'max_accommodations', threshold: 'critical' })
            )
        ).toBe(true);
        expect(
            needsUpgradePrompt(
                buildLimit({ limitKey: 'max_accommodations', threshold: 'exceeded' })
            )
        ).toBe(true);
    });

    it('should prompt for a per-accommodation cap when the fullest listing is at risk', () => {
        // The server's threshold for a per-accommodation limit is computed
        // from an account-wide usage that is structurally 0, so it always says
        // `ok`. An owner sitting at 25 of 15 photos on a listing would be
        // offered no way out — which is the case the photo add-on exists for.
        expect(
            needsUpgradePrompt(
                buildLimit({
                    limitKey: 'max_photos_per_accommodation',
                    usageKind: 'per_accommodation',
                    maxAllowed: 15,
                    currentUsage: 0,
                    threshold: 'ok',
                    perAccommodation: [
                        { accommodationId: 'a1', name: 'Casa', slug: 'casa', currentUsage: 25 }
                    ]
                })
            )
        ).toBe(true);
    });

    it('should not prompt for a per-accommodation cap when every listing has room', () => {
        expect(
            needsUpgradePrompt(
                buildLimit({
                    limitKey: 'max_photos_per_accommodation',
                    usageKind: 'per_accommodation',
                    maxAllowed: 50,
                    currentUsage: 0,
                    threshold: 'ok',
                    perAccommodation: [
                        { accommodationId: 'a1', name: 'Casa', slug: 'casa', currentUsage: 7 },
                        { accommodationId: 'a2', name: 'Depto', slug: 'depto', currentUsage: 12 }
                    ]
                })
            )
        ).toBe(false);
    });

    it('should not prompt for a per-accommodation cap with no breakdown to judge', () => {
        // Absent breakdown = the server could not build it. Prompting off a
        // number nobody has is guessing.
        expect(
            needsUpgradePrompt(
                buildLimit({
                    limitKey: 'max_photos_per_accommodation',
                    usageKind: 'per_accommodation',
                    maxAllowed: 15,
                    threshold: 'ok'
                })
            )
        ).toBe(false);
    });

    it('should never prompt on an unlimited grant', () => {
        // There is nothing to run out of, whatever the server's bucket says.
        expect(
            needsUpgradePrompt(
                buildLimit({
                    limitKey: 'max_favorites',
                    maxAllowed: -1,
                    threshold: 'exceeded'
                })
            )
        ).toBe(false);
    });
});

describe('audienceForLimit — commerce verticals (HOS-688)', () => {
    it('should group both commerce caps with the host block', () => {
        // A commerce owner is a host of a different kind, and is sent to a
        // subscription/add-on surface rather than a traveller plan.
        expect(audienceForLimit('max_gastronomies')).toBe('host');
        expect(audienceForLimit('max_experiences')).toBe('host');
    });
});

describe('addonSlugForLimit', () => {
    it('should map the limits that have a purchasable add-on', () => {
        expect(addonSlugForLimit('max_accommodations')).toBe('extra-accommodations-5');
        expect(addonSlugForLimit('max_photos_per_accommodation')).toBe('extra-photos-20');
    });

    it('should NOT map limits whose add-on is inactive or targets an unbuilt feature', () => {
        // `extra-properties-5` raises a limit with no feature behind it, and
        // `ai-support-monthly` ships isActive:false — linking to either sends
        // the user to a card that is not on the add-ons page.
        expect(addonSlugForLimit('max_properties')).toBeUndefined();
        expect(addonSlugForLimit('max_ai_support_per_month')).toBeUndefined();
    });

    it('should return undefined for limits with no add-on at all', () => {
        expect(addonSlugForLimit('max_favorites')).toBeUndefined();
        expect(addonSlugForLimit('max_ai_search_per_month')).toBeUndefined();
    });

    it('should link each commerce vertical to its OWN extra-listing add-on (HOS-688 AC-34)', () => {
        // Without these entries each add-on exists, is purchasable and grants
        // the cap increase — and the usage panel never links to it from the
        // at-cap row, which is the only place anybody would go looking for it.
        // That is an add-on that exists and that nobody can find.
        expect(addonSlugForLimit('max_gastronomies')).toBe('extra-gastronomies-1');
        expect(addonSlugForLimit('max_experiences')).toBe('extra-experiences-1');
    });

    it('should never cross-link the two verticals add-ons', () => {
        // A swapped pair would sell the owner an extra excursion when they
        // asked for an extra restaurant, with every screen looking correct.
        expect(addonSlugForLimit('max_gastronomies')).not.toBe('extra-experiences-1');
        expect(addonSlugForLimit('max_experiences')).not.toBe('extra-gastronomies-1');
    });
});

describe('groupLimitsByAudience', () => {
    it('should split limits into host and traveler groups', () => {
        // Arrange
        const limits = [
            buildLimit({ limitKey: 'max_accommodations' }),
            buildLimit({ limitKey: 'max_favorites' })
        ];

        // Act
        const groups = groupLimitsByAudience(limits);

        // Assert
        expect(groups.map((g) => g.audience)).toEqual(['host', 'traveler']);
        expect(groups[0]?.limits.map((l) => l.limitKey)).toEqual(['max_accommodations']);
        expect(groups[1]?.limits.map((l) => l.limitKey)).toEqual(['max_favorites']);
    });

    it('should drop an audience with no visible limits', () => {
        // Arrange — a traveller-only user has no host limits granted.
        const limits = [
            buildLimit({ limitKey: 'max_accommodations', maxAllowed: 0 }),
            buildLimit({ limitKey: 'max_favorites' })
        ];

        // Act
        const groups = groupLimitsByAudience(limits);

        // Assert — no empty "as a host" heading.
        expect(groups).toHaveLength(1);
        expect(groups[0]?.audience).toBe('traveler');
    });

    it('should order stock before monthly and caps last within a group', () => {
        // Arrange — deliberately out of order.
        const limits = [
            buildLimit({ limitKey: 'max_ai_text_improve_per_month', usageKind: 'monthly' }),
            buildLimit({
                limitKey: 'max_photos_per_accommodation',
                usageKind: 'per_accommodation'
            }),
            buildLimit({ limitKey: 'max_accommodations', usageKind: 'stock' })
        ];

        // Act
        const groups = groupLimitsByAudience(limits);

        // Assert — rows with bars group at the top.
        expect(groups[0]?.limits.map((l) => l.limitKey)).toEqual([
            'max_accommodations',
            'max_photos_per_accommodation',
            'max_ai_text_improve_per_month'
        ]);
    });

    it('should return no groups when every limit is hidden', () => {
        // Arrange
        const limits = [
            buildLimit({ limitKey: 'max_properties', usageKind: 'unbuilt' }),
            buildLimit({ limitKey: 'max_favorites', maxAllowed: 0 })
        ];

        // Act + Assert
        expect(groupLimitsByAudience(limits)).toEqual([]);
    });

    it('should not mutate the input array order', () => {
        // Arrange
        const limits = [
            buildLimit({ limitKey: 'max_ai_text_improve_per_month', usageKind: 'monthly' }),
            buildLimit({ limitKey: 'max_accommodations', usageKind: 'stock' })
        ];
        const originalOrder = limits.map((l) => l.limitKey);

        // Act
        groupLimitsByAudience(limits);

        // Assert
        expect(limits.map((l) => l.limitKey)).toEqual(originalOrder);
    });
});
