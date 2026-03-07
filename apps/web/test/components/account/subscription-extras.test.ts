import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source file reads
// ---------------------------------------------------------------------------

const accountDir = resolve(__dirname, '../../../src/components/account');

const statusBadgeContent = readFileSync(
    resolve(accountDir, 'SubscriptionStatusBadge.client.tsx'),
    'utf8'
);

const featuresListContent = readFileSync(
    resolve(accountDir, 'SubscriptionFeaturesList.client.tsx'),
    'utf8'
);

const subscriptionCardTypesContent = readFileSync(
    resolve(accountDir, 'subscription-card.types.ts'),
    'utf8'
);

// ---------------------------------------------------------------------------
// SubscriptionStatusBadge.client.tsx
// ---------------------------------------------------------------------------

describe('SubscriptionStatusBadge.client.tsx', () => {
    describe('Named export', () => {
        it('should use named export for the component', () => {
            expect(statusBadgeContent).toContain('export function SubscriptionStatusBadge');
        });
    });

    describe('Props interface', () => {
        it('should define the props interface', () => {
            expect(statusBadgeContent).toContain('interface SubscriptionStatusBadgeProps');
        });

        it('should have readonly statusKey prop', () => {
            expect(statusBadgeContent).toContain('readonly statusKey:');
        });

        it('should have readonly label prop', () => {
            expect(statusBadgeContent).toContain('readonly label: string');
        });

        it('should accept free as a valid status', () => {
            expect(statusBadgeContent).toContain("'free'");
        });
    });

    describe('Design tokens', () => {
        it('should use STATUS_BADGE_CLASSES for color classes', () => {
            expect(statusBadgeContent).toContain('STATUS_BADGE_CLASSES');
        });

        it('should import STATUS_BADGE_CLASSES from subscription-card.types', () => {
            expect(statusBadgeContent).toContain("from './subscription-card.types'");
        });

        it('should NOT hardcode color classes inline', () => {
            // Should not contain raw color utilities like bg-green-*, bg-red-*, etc.
            expect(statusBadgeContent).not.toMatch(/bg-green-\d+/);
            expect(statusBadgeContent).not.toMatch(/bg-red-\d+/);
            expect(statusBadgeContent).not.toMatch(/bg-yellow-\d+/);
        });

        it('should NOT use hardcoded hex colors', () => {
            expect(statusBadgeContent).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });

        it('should use rounded-full for pill shape', () => {
            expect(statusBadgeContent).toContain('rounded-full');
        });
    });

    describe('Accessibility', () => {
        it('should use <output> element for status badge', () => {
            // <output> is the correct semantic element for computed values like status
            expect(statusBadgeContent).toContain('<output');
        });

        it('should render visible text label', () => {
            expect(statusBadgeContent).toContain('{label}');
        });
    });

    describe('Code quality', () => {
        it('should NOT contain console.log', () => {
            expect(statusBadgeContent).not.toContain('console.log');
        });

        it('should NOT use any type', () => {
            expect(statusBadgeContent).not.toMatch(/:\s*any\b/);
        });

        it('should have JSDoc on the component', () => {
            expect(statusBadgeContent).toContain('/**');
        });
    });
});

// ---------------------------------------------------------------------------
// SubscriptionFeaturesList.client.tsx
// ---------------------------------------------------------------------------

describe('SubscriptionFeaturesList.client.tsx', () => {
    describe('Named exports', () => {
        it('should use named export for SubscriptionFeaturesList', () => {
            expect(featuresListContent).toContain('export function SubscriptionFeaturesList');
        });

        it('should use named export for SubscriptionUpgradeCta', () => {
            expect(featuresListContent).toContain('export function SubscriptionUpgradeCta');
        });
    });

    describe('SubscriptionFeaturesList props', () => {
        it('should define the props interface', () => {
            expect(featuresListContent).toContain('interface SubscriptionFeaturesListProps');
        });

        it('should have readonly features prop as readonly array', () => {
            expect(featuresListContent).toContain('readonly features: readonly string[]');
        });

        it('should have readonly heading prop', () => {
            expect(featuresListContent).toContain('readonly heading: string');
        });
    });

    describe('SubscriptionUpgradeCta props', () => {
        it('should define the CTA props interface', () => {
            expect(featuresListContent).toContain('interface SubscriptionUpgradeCtaProps');
        });

        it('should have readonly heading prop', () => {
            expect(featuresListContent).toContain('readonly heading: string');
        });

        it('should have readonly description prop', () => {
            expect(featuresListContent).toContain('readonly description: string');
        });

        it('should have readonly buttonText prop', () => {
            expect(featuresListContent).toContain('readonly buttonText: string');
        });

        it('should have readonly href prop', () => {
            expect(featuresListContent).toContain('readonly href: string');
        });
    });

    describe('Design tokens - SubscriptionFeaturesList', () => {
        it('should use text-secondary for check icon', () => {
            expect(featuresListContent).toContain('text-secondary');
        });

        it('should use text-text-secondary for feature text', () => {
            expect(featuresListContent).toContain('text-text-secondary');
        });

        it('should NOT use hardcoded hex colors', () => {
            expect(featuresListContent).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });

        it('should NOT use hardcoded palette colors like text-green-*', () => {
            expect(featuresListContent).not.toMatch(/text-green-\d+/);
        });
    });

    describe('Design tokens - SubscriptionUpgradeCta', () => {
        it('should use bg-primary for the CTA button', () => {
            expect(featuresListContent).toContain('bg-primary');
        });

        it('should use text-primary-foreground for button text', () => {
            expect(featuresListContent).toContain('text-primary-foreground');
        });

        it('should use gradient with primary/10 and primary/5', () => {
            expect(featuresListContent).toContain('from-primary/10');
            expect(featuresListContent).toContain('to-primary/5');
        });

        it('should NOT use hardcoded hex colors', () => {
            expect(featuresListContent).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Accessibility', () => {
        it('should use <ul> and <li> for the features list', () => {
            expect(featuresListContent).toContain('<ul');
            expect(featuresListContent).toContain('<li');
        });

        it('should have aria-hidden on the check icon', () => {
            expect(featuresListContent).toContain('aria-hidden="true"');
        });

        it('should import CheckIcon from @repo/icons', () => {
            expect(featuresListContent).toContain("from '@repo/icons'");
            expect(featuresListContent).toContain('CheckIcon');
        });

        it('should use focus-visible styles for upgrade link', () => {
            expect(featuresListContent).toContain('focus-visible:');
        });
    });

    describe('Code quality', () => {
        it('should NOT contain console.log', () => {
            expect(featuresListContent).not.toContain('console.log');
        });

        it('should NOT use any type', () => {
            expect(featuresListContent).not.toMatch(/:\s*any\b/);
        });

        it('should have JSDoc on each exported component', () => {
            // Both components should have JSDoc blocks
            const jsdocCount = (featuresListContent.match(/\/\*\*/g) ?? []).length;
            expect(jsdocCount).toBeGreaterThanOrEqual(2);
        });
    });
});

// ---------------------------------------------------------------------------
// subscription-card.types.ts (STATUS_BADGE_CLASSES coverage)
// ---------------------------------------------------------------------------

describe('subscription-card.types.ts', () => {
    describe('Named exports', () => {
        it('should export TFunction type', () => {
            expect(subscriptionCardTypesContent).toContain('export type TFunction');
        });

        it('should export ActionCallback type', () => {
            expect(subscriptionCardTypesContent).toContain('export type ActionCallback');
        });

        it('should export STATUS_BADGE_CLASSES constant', () => {
            expect(subscriptionCardTypesContent).toContain('export const STATUS_BADGE_CLASSES');
        });
    });

    describe('STATUS_BADGE_CLASSES', () => {
        it('should cover active status', () => {
            expect(subscriptionCardTypesContent).toContain('active:');
        });

        it('should cover trial status', () => {
            expect(subscriptionCardTypesContent).toContain('trial:');
        });

        it('should cover cancelled status', () => {
            expect(subscriptionCardTypesContent).toContain('cancelled:');
        });

        it('should cover expired status', () => {
            expect(subscriptionCardTypesContent).toContain('expired:');
        });

        it('should cover past_due status', () => {
            expect(subscriptionCardTypesContent).toContain('past_due:');
        });

        it('should cover pending status', () => {
            expect(subscriptionCardTypesContent).toContain('pending:');
        });

        it('should cover free status', () => {
            expect(subscriptionCardTypesContent).toContain('free:');
        });

        it('should use semantic color tokens only', () => {
            // All entries should use semantic tokens like bg-secondary/15, not hardcoded palette
            expect(subscriptionCardTypesContent).toContain('bg-secondary/15');
            expect(subscriptionCardTypesContent).toContain('bg-accent/15');
            expect(subscriptionCardTypesContent).toContain('bg-destructive/15');
            expect(subscriptionCardTypesContent).toContain('bg-muted');
            expect(subscriptionCardTypesContent).toContain('bg-primary/15');
        });

        it('should NOT use hardcoded hex colors', () => {
            expect(subscriptionCardTypesContent).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });

        it('should use as const for immutability', () => {
            expect(subscriptionCardTypesContent).toContain('as const');
        });
    });

    describe('Code quality', () => {
        it('should NOT contain console.log', () => {
            expect(subscriptionCardTypesContent).not.toContain('console.log');
        });

        it('should NOT use any type', () => {
            expect(subscriptionCardTypesContent).not.toMatch(/:\s*any\b/);
        });
    });
});
