import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/search/popovers/DestinationPopover.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

describe('DestinationPopover.client.tsx', () => {
    describe('Architecture', () => {
        it('should import from @floating-ui/react', () => {
            expect(content).toContain("from '@floating-ui/react'");
        });

        it('should export named DestinationPopover function', () => {
            expect(content).toContain('export function DestinationPopover');
        });

        it('should not have a default export', () => {
            expect(content).not.toContain('export default');
        });

        it('should import DestinationOption type', () => {
            expect(content).toContain('DestinationOption');
        });
    });

    describe('Props', () => {
        it('should accept destinations array', () => {
            expect(content).toContain('destinations: readonly DestinationOption[]');
        });

        it('should accept selected ids array', () => {
            expect(content).toContain('selected: readonly string[]');
        });

        it('should accept onToggle callback', () => {
            expect(content).toContain('onToggle: (id: string)');
        });

        it('should accept isLoading prop', () => {
            expect(content).toContain('isLoading: boolean');
        });

        it('should accept isMobile prop', () => {
            expect(content).toContain('isMobile');
        });
    });

    describe('Loading state', () => {
        it('should show skeleton rows while loading', () => {
            expect(content).toContain('SkeletonRow');
            expect(content).toContain('animate-pulse');
        });
    });

    describe('Multi-select behavior', () => {
        it('should toggle selection on click', () => {
            expect(content).toContain('handleToggle');
        });

        it('should show checkmark for selected items', () => {
            // cmdk uses onSelect, checkmark is rendered as SVG path
            expect(content).toContain('onSelect');
            expect(content).toContain(
                'd="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"'
            );
        });
    });

    describe('Accessibility', () => {
        it('should use useRole from floating-ui for dialog semantics', () => {
            // cmdk manages its own list/option roles internally;
            // the popover itself uses useRole(context, { role: 'dialog' })
            expect(content).toContain("useRole(context, { role: 'dialog' })");
        });

        it('should use cmdk Command.List for accessible item list', () => {
            expect(content).toContain('Command.List');
            expect(content).toContain('Command.Item');
        });

        it('should have aria-expanded on trigger', () => {
            expect(content).toContain('aria-expanded');
        });

        it('should disable trigger while loading', () => {
            expect(content).toContain('disabled={isLoading}');
        });
    });

    describe('Summary text', () => {
        it('should compute summary internally based on selected count', () => {
            // Summary is computed inline: first name + "& X more" for multiple
            expect(content).toContain('selected.length');
            expect(content).toContain('more');
        });
    });

    describe('File constraints', () => {
        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });
    });
});
