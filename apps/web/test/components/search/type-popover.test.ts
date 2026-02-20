import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/search/popovers/TypePopover.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

describe('TypePopover.client.tsx', () => {
    describe('Architecture', () => {
        it('should import from @floating-ui/react', () => {
            expect(content).toContain("from '@floating-ui/react'");
        });

        it('should export named TypePopover function', () => {
            expect(content).toContain('export function TypePopover');
        });

        it('should not have a default export', () => {
            expect(content).not.toContain('export default');
        });

        it('should import AccommodationTypeEnum type', () => {
            expect(content).toContain('AccommodationTypeEnum');
        });
    });

    describe('Props', () => {
        it('should accept selected types array', () => {
            expect(content).toContain('selected: readonly AccommodationTypeEnum[]');
        });

        it('should accept onToggle callback', () => {
            expect(content).toContain('onToggle: (type: AccommodationTypeEnum)');
        });

        it('should accept typeLabels for translations', () => {
            expect(content).toContain('typeLabels');
        });

        it('should accept isMobile prop', () => {
            expect(content).toContain('isMobile');
        });
    });

    describe('Multi-select behavior', () => {
        it('should use ACCOMMODATION_TYPE_OPTIONS from constants', () => {
            expect(content).toContain('ACCOMMODATION_TYPE_OPTIONS');
        });

        it('should render options using cmdk Command.List (not a grid)', () => {
            // Layout changed from CSS grid to cmdk Command.List
            expect(content).toContain('Command.List');
            expect(content).toContain('Command.Item');
        });

        it('should toggle selection on click', () => {
            expect(content).toContain('handleToggle');
        });
    });

    describe('Accessibility', () => {
        it('should use useRole from floating-ui for dialog semantics', () => {
            // cmdk manages its own list/option roles internally;
            // the popover itself uses useRole(context, { role: 'dialog' })
            expect(content).toContain("useRole(context, { role: 'dialog' })");
        });

        it('should use cmdk Command.Item with onSelect for keyboard interaction', () => {
            expect(content).toContain('Command.Item');
            expect(content).toContain('onSelect');
        });

        it('should have aria-expanded on trigger', () => {
            expect(content).toContain('aria-expanded');
        });
    });

    describe('Visual feedback', () => {
        it('should differentiate selected items with primary text color', () => {
            // Selected items use text-primary class (not bg-primary-50 directly)
            expect(content).toContain('text-primary');
        });

        it('should show emoji icons', () => {
            expect(content).toContain('{emoji}');
        });
    });

    describe('File constraints', () => {
        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });
    });
});
