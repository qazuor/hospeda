/**
 * @file pricing-card.test.ts
 * @description Tests for PricingCard.astro.
 * Validates props interface, plan data rendering, price and currency display,
 * features list, CTA button, highlighted/popular state, and accessibility.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/PricingCard.astro');
const content = readFileSync(componentPath, 'utf8');

describe('PricingCard.astro', () => {
    describe('File documentation', () => {
        it('should have JSDoc documentation at the top of the file', () => {
            expect(content).toContain('/**');
            expect(content).toContain('*/');
        });

        it('should describe the pricing card purpose', () => {
            expect(content.toLowerCase()).toMatch(/pricing/);
        });
    });

    describe('Props interface', () => {
        it('should define Plan interface', () => {
            expect(content).toContain('interface Plan');
        });

        it('should define Props interface', () => {
            expect(content).toContain('interface Props');
        });

        it('should accept plan prop', () => {
            expect(content).toContain('readonly plan: Plan');
        });

        it('should have name property as required string in Plan', () => {
            expect(content).toContain('readonly name: string');
        });

        it('should have price property as required number in Plan', () => {
            expect(content).toContain('readonly price: number');
        });

        it('should have features as readonly string array in Plan', () => {
            expect(content).toContain('readonly features');
        });

        it('should have cta object in Plan with label and href', () => {
            expect(content).toContain('readonly cta');
            expect(content).toContain('readonly label: string');
            expect(content).toContain('readonly href: string');
        });

        it('should have optional currency in Plan', () => {
            expect(content).toContain('currency?');
        });

        it('should have optional period in Plan', () => {
            expect(content).toContain('period?');
        });

        it('should have optional highlighted prop in Props', () => {
            expect(content).toContain('highlighted?');
        });

        it('should have optional highlightLabel prop in Props', () => {
            expect(content).toContain('highlightLabel?');
        });

        it('should have optional class prop in Props', () => {
            expect(content).toContain('readonly class?: string');
        });
    });

    describe('Default values', () => {
        it('should default currency to "ARS"', () => {
            expect(content).toContain("plan.currency ?? 'ARS'");
        });

        it('should default period to "/mes"', () => {
            expect(content).toContain("plan.period ?? '/mes'");
        });

        it('should default highlighted to false', () => {
            expect(content).toContain('highlighted = false');
        });

        it('should default highlightLabel to "Popular"', () => {
            expect(content).toContain("highlightLabel = 'Popular'");
        });
    });

    describe('Plan name rendering', () => {
        it('should render plan name inside an h3 heading', () => {
            expect(content).toContain('<h3');
            expect(content).toContain('{plan.name}');
        });

        it('should use a bold font for the plan name', () => {
            expect(content).toContain('font-bold');
        });
    });

    describe('Price display', () => {
        it('should render the plan price value', () => {
            expect(content).toContain('{plan.price');
        });

        it('should render the currency symbol', () => {
            expect(content).toContain('{currency}');
        });

        it('should render the billing period', () => {
            expect(content).toContain('{period}');
        });

        it('should use a large font size for the price', () => {
            expect(content).toContain('text-4xl');
        });

        it('should use flex layout with baseline alignment for the price block', () => {
            expect(content).toContain('flex items-baseline');
        });
    });

    describe('Features list', () => {
        it('should render features as a ul list', () => {
            expect(content).toContain('<ul');
        });

        it('should iterate over plan.features', () => {
            expect(content).toContain('plan.features.map');
        });

        it('should render li elements for each feature', () => {
            expect(content).toContain('<li');
        });

        it('should render feature text inside each item', () => {
            expect(content).toContain('{feature}');
        });

        it('should import CheckIcon from @repo/icons for feature items', () => {
            expect(content).toContain("import { CheckIcon } from '@repo/icons'");
        });

        it('should render CheckIcon with size={20} and weight="bold"', () => {
            expect(content).toContain('size={20}');
            expect(content).toContain('weight="bold"');
        });

        it('should hide the CheckIcon from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should use flex items-start layout for feature items', () => {
            expect(content).toContain('flex items-start');
        });
    });

    describe('CTA button', () => {
        it('should render the CTA href', () => {
            expect(content).toContain('{plan.cta.href}');
        });

        it('should render the CTA label', () => {
            expect(content).toContain('{plan.cta.label}');
        });

        it('should use GradientButton for highlighted cards', () => {
            expect(content).toContain('GradientButton');
        });

        it('should render an anchor element for non-highlighted cards', () => {
            expect(content).toContain('<a\n');
        });

        it('should apply full width to the CTA', () => {
            expect(content).toContain('w-full');
        });
    });

    describe('Highlighted / Popular badge', () => {
        it('should conditionally render the Popular badge when highlighted is true', () => {
            expect(content).toContain('{highlighted');
            expect(content).toContain('{highlightLabel}');
        });

        it('should position the badge above the card with absolute positioning', () => {
            expect(content).toContain('absolute');
            expect(content).toContain('-top-4');
        });

        it('should centre the badge horizontally', () => {
            expect(content).toContain('left-1/2');
            expect(content).toContain('-translate-x-1/2');
        });

        it('should apply ring-2 and ring-primary styles when highlighted', () => {
            expect(content).toContain('ring-2');
            expect(content).toContain('ring-primary');
        });

        it('should apply shadow-xl when highlighted', () => {
            expect(content).toContain('shadow-xl');
        });

        it('should apply scale-105 transform when highlighted', () => {
            expect(content).toContain('scale-105');
        });

        it('should use the Badge component for the Popular badge', () => {
            expect(content).toContain('Badge');
        });
    });

    describe('Card structure and styling', () => {
        it('should render a div as the card root element', () => {
            expect(content).toContain('<div');
        });

        it('should use class:list for conditional class merging', () => {
            expect(content).toContain('class:list');
        });

        it('should use relative positioning on the card', () => {
            expect(content).toContain('relative');
        });

        it('should use rounded-xl corners', () => {
            expect(content).toContain('rounded-xl');
        });

        it('should use border and border-border tokens', () => {
            expect(content).toContain('border');
            expect(content).toContain('border-border');
        });

        it('should use bg-card token for the card background', () => {
            expect(content).toContain('bg-card');
        });

        it('should add p-6 padding', () => {
            expect(content).toContain('p-6');
        });

        it('should include hover shadow effect', () => {
            expect(content).toContain('hover:shadow-md');
        });

        it('should use transition-all for smooth hover effects', () => {
            expect(content).toContain('transition-all');
        });
    });

    describe('Accessibility', () => {
        it('should use a semantic h3 heading for the plan name', () => {
            expect(content).toContain('<h3');
        });

        it('should use semantic ul/li for the features list', () => {
            expect(content).toContain('<ul');
            expect(content).toContain('<li');
        });

        it('should hide decorative icons with aria-hidden="true"', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Imports', () => {
        it('should import Badge component', () => {
            expect(content).toContain('import Badge from');
        });

        it('should import GradientButton component', () => {
            expect(content).toContain('import GradientButton from');
        });

        it('should import CheckIcon from @repo/icons', () => {
            expect(content).toContain("'@repo/icons'");
        });
    });
});
