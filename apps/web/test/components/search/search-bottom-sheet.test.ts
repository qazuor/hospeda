import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/search/SearchBottomSheet.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

describe('SearchBottomSheet.client.tsx', () => {
    describe('Architecture', () => {
        it('should export named SearchBottomSheet function', () => {
            expect(content).toContain('export function SearchBottomSheet');
        });

        it('should not have a default export', () => {
            expect(content).not.toContain('export default');
        });

        it('should use <dialog> element', () => {
            expect(content).toContain('<dialog');
        });
    });

    describe('Dialog behavior', () => {
        it('should call showModal when isOpen becomes true', () => {
            expect(content).toContain('showModal()');
        });

        it('should call close when isOpen becomes false', () => {
            expect(content).toContain('dialog.close()');
        });

        it('should handle backdrop click to close', () => {
            expect(content).toContain('handleDialogClick');
            expect(content).toContain('e.target === dialogRef.current');
        });

        it('should handle native close event (Escape)', () => {
            expect(content).toContain('onClose={handleClose}');
        });
    });

    describe('Layout', () => {
        it('should have rounded top corners', () => {
            expect(content).toContain('rounded-t-3xl');
        });

        it('should have max height of 90svh', () => {
            expect(content).toContain('max-h-[90svh]');
        });

        it('should have a handle bar at the top', () => {
            expect(content).toContain('h-1 w-10 rounded-full');
        });

        it('should have scrollable content area', () => {
            expect(content).toContain('overflow-y-auto');
        });
    });

    describe('Sub-components', () => {
        it('should include all 4 popovers in mobile mode', () => {
            expect(content).toContain('DestinationPopover');
            expect(content).toContain('TypePopover');
            expect(content).toContain('DateRangePopover');
            expect(content).toContain('GuestsPopover');
        });

        it('should pass isMobile prop to all popovers', () => {
            const isMobileCount = (content.match(/isMobile$/gm) || []).length;
            expect(isMobileCount).toBeGreaterThanOrEqual(4);
        });
    });

    describe('Search button', () => {
        it('should have a full-width search button at the bottom', () => {
            expect(content).toContain('w-full');
            expect(content).toContain('bg-primary');
        });

        it('should call onSubmit when clicked', () => {
            expect(content).toContain('onClick={onSubmit}');
        });
    });

    describe('Close button', () => {
        it('should have a close button with X icon', () => {
            expect(content).toContain('onClick={onClose}');
            expect(content).toContain('closePanelAriaLabel');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on dialog', () => {
            expect(content).toContain('aria-label={labels.searchAriaLabel}');
        });
    });

    describe('File constraints', () => {
        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });
    });
});
