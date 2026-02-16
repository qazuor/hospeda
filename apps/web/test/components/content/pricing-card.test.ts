/**
 * Tests for PricingCard component file content validation.
 * Validates props, structure, highlighted state, features list, and accessibility.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/content/PricingCard.astro');
const content = readFileSync(componentPath, 'utf8');

describe('PricingCard - File content', () => {
    describe('Component documentation', () => {
        it('should have JSDoc documentation', () => {
            expect(content).toContain('/**');
            expect(content).toContain('*/');
        });

        it('should describe purpose as pricing card', () => {
            expect(content.toLowerCase()).toContain('pricing');
        });
    });

    describe('Props interface', () => {
        it('should define Props interface', () => {
            expect(content).toContain('interface Props');
        });

        it('should accept plan prop with required fields', () => {
            expect(content).toContain('plan:');
            expect(content).toContain('name: string');
            expect(content).toContain('price: number');
            expect(content).toContain('features: string[]');
        });

        it('should accept optional currency and period in plan', () => {
            expect(content).toContain('currency?');
            expect(content).toContain('period?');
        });

        it('should accept cta object in plan with label and href', () => {
            expect(content).toContain('cta:');
            expect(content).toContain('label: string');
            expect(content).toContain('href: string');
        });

        it('should accept optional highlighted prop', () => {
            expect(content).toContain('highlighted?');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?');
        });
    });

    describe('Default values', () => {
        it('should default currency to ARS', () => {
            expect(content).toContain('ARS');
        });

        it('should default period to /mes', () => {
            expect(content).toContain('/mes');
        });

        it('should default highlighted to false', () => {
            expect(content).toContain('highlighted = false');
        });
    });

    describe('Structure', () => {
        it('should render card container with div', () => {
            expect(content).toContain('<div class={cardClasses}');
        });

        it('should render plan name as h3', () => {
            expect(content).toContain('<h3');
            expect(content).toContain('{plan.name}');
        });

        it('should render price display', () => {
            expect(content).toContain('{plan.price}');
        });

        it('should render currency symbol', () => {
            expect(content).toContain('{currency}');
        });

        it('should render period text', () => {
            expect(content).toContain('{period}');
        });

        it('should render features list', () => {
            expect(content).toContain('<ul');
            expect(content).toContain('plan.features.map');
        });

        it('should import Button component', () => {
            expect(content).toContain('import Button from');
            expect(content).toContain('Button.astro');
        });

        it('should render Button with plan CTA', () => {
            expect(content).toContain('<Button');
            expect(content).toContain('{plan.cta.href}');
            expect(content).toContain('{plan.cta.label}');
        });
    });

    describe('Highlighted state', () => {
        it('should conditionally render Popular badge when highlighted', () => {
            expect(content).toContain('{highlighted');
            expect(content).toContain('Popular');
        });

        it('should apply ring and shadow styles when highlighted', () => {
            expect(content).toContain('ring-2');
            expect(content).toContain('ring-primary');
            expect(content).toContain('shadow-xl');
        });

        it('should apply scale transform when highlighted', () => {
            expect(content).toContain('scale-105');
        });

        it('should use primary variant for Button when highlighted', () => {
            expect(content).toContain('variant={highlighted');
            expect(content).toContain('primary');
        });

        it('should use outline variant for Button when not highlighted', () => {
            expect(content).toContain('outline');
        });
    });

    describe('Features list', () => {
        it('should render checkmark icon for each feature', () => {
            expect(content).toContain('CheckIcon');
            expect(content).toContain('size={20}');
            expect(content).toContain('weight="bold"');
        });

        it('should render feature text', () => {
            expect(content).toContain('{feature}');
        });

        it('should use flex layout for feature items', () => {
            expect(content).toContain('flex items-start');
        });

        it('should use list element for features', () => {
            expect(content).toContain('<li');
        });
    });

    describe('Styling', () => {
        it('should use rounded corners', () => {
            expect(content).toContain('rounded-lg');
        });

        it('should use border', () => {
            expect(content).toContain('border');
            expect(content).toContain('border-border');
        });

        it('should use bg-surface', () => {
            expect(content).toContain('bg-surface');
        });

        it('should use padding', () => {
            expect(content).toContain('p-6');
        });

        it('should use hover shadow effect', () => {
            expect(content).toContain('hover:shadow-lg');
        });

        it('should use transition for smooth effects', () => {
            expect(content).toContain('transition-all');
        });

        it('should use large font size for price', () => {
            expect(content).toContain('text-4xl');
        });

        it('should use bold font for price and title', () => {
            expect(content).toContain('font-bold');
        });
    });

    describe('Responsive design', () => {
        it('should use flex layout for price display', () => {
            expect(content).toContain('flex items-baseline');
        });

        it('should apply full width to CTA button', () => {
            expect(content).toContain('w-full');
        });
    });

    describe('Accessibility', () => {
        it('should hide decorative SVG from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should use semantic heading for plan name', () => {
            expect(content).toContain('<h3');
        });

        it('should use semantic list for features', () => {
            expect(content).toContain('<ul');
            expect(content).toContain('<li');
        });
    });

    describe('Layout', () => {
        it('should use relative positioning on card', () => {
            expect(content).toContain('relative');
        });

        it('should use absolute positioning for Popular badge', () => {
            expect(content).toContain('absolute');
            expect(content).toContain('-top-4');
        });

        it('should center Popular badge horizontally', () => {
            expect(content).toContain('left-1/2');
            expect(content).toContain('-translate-x-1/2');
        });

        it('should use space-y for features list spacing', () => {
            expect(content).toContain('space-y-3');
        });

        it('should use margin bottom for sections', () => {
            expect(content).toContain('mb-6');
            expect(content).toContain('mb-8');
        });
    });
});
