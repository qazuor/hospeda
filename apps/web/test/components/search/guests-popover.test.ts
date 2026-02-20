import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/search/popovers/GuestsPopover.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

describe('GuestsPopover.client.tsx', () => {
    describe('Architecture', () => {
        it('should import from @floating-ui/react', () => {
            expect(content).toContain("from '@floating-ui/react'");
        });

        it('should export named GuestsPopover function', () => {
            expect(content).toContain('export function GuestsPopover');
        });

        it('should not have a default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('Props', () => {
        it('should accept adults and children count props', () => {
            expect(content).toContain('adults: number');
            // Prop was renamed from `children` to `childrenCount` to avoid
            // conflict with React's reserved `children` prop name
            expect(content).toContain('childrenCount: number');
        });

        it('should accept change handlers', () => {
            expect(content).toContain('onAdultsChange');
            expect(content).toContain('onChildrenChange');
        });

        it('should accept isMobile prop', () => {
            expect(content).toContain('isMobile');
        });
    });

    describe('Stepper controls', () => {
        it('should have increment and decrement buttons', () => {
            expect(content).toContain('value - 1');
            expect(content).toContain('value + 1');
        });

        it('should respect min/max limits', () => {
            expect(content).toContain('Math.max(min');
            expect(content).toContain('Math.min(max');
        });

        it('should import ADULTS_MIN, ADULTS_MAX, CHILDREN_MIN, CHILDREN_MAX', () => {
            expect(content).toContain('ADULTS_MIN');
            expect(content).toContain('ADULTS_MAX');
            expect(content).toContain('CHILDREN_MIN');
            expect(content).toContain('CHILDREN_MAX');
        });
    });

    describe('Accessibility', () => {
        it('should use role="spinbutton" for counter display', () => {
            expect(content).toContain('role="spinbutton"');
        });

        it('should have aria-valuenow, aria-valuemin, aria-valuemax', () => {
            expect(content).toContain('aria-valuenow');
            expect(content).toContain('aria-valuemin');
            expect(content).toContain('aria-valuemax');
        });

        it('should have aria-expanded on trigger', () => {
            expect(content).toContain('aria-expanded');
        });
    });

    describe('Summary text', () => {
        it('should use guestsSummary template with placeholders', () => {
            expect(content).toContain("'{adults}'");
            expect(content).toContain("'{children}'");
        });
    });

    describe('File constraints', () => {
        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });
    });
});
