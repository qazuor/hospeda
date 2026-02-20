import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/search/popovers/DateRangePopover.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

describe('DateRangePopover.client.tsx', () => {
    describe('Architecture', () => {
        it('should import from @floating-ui/react', () => {
            expect(content).toContain("from '@floating-ui/react'");
        });

        it('should export named DateRangePopover function', () => {
            expect(content).toContain('export function DateRangePopover');
        });

        it('should not have a default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('Props', () => {
        it('should accept checkIn and checkOut props', () => {
            expect(content).toContain('checkIn: string');
            expect(content).toContain('checkOut: string');
        });

        it('should accept isMobile prop', () => {
            expect(content).toContain('isMobile');
        });

        it('should accept locale for date formatting', () => {
            expect(content).toContain('locale: string');
        });
    });

    describe('Date inputs', () => {
        it('should use native date inputs', () => {
            expect(content).toContain('type="date"');
        });

        it('should have two date inputs (check-in and check-out)', () => {
            const dateInputMatches = content.match(/type="date"/g);
            expect(dateInputMatches).not.toBeNull();
            expect(dateInputMatches?.length).toBe(2);
        });

        it('should set min date on check-in to today', () => {
            expect(content).toContain('min={todayIso}');
        });

        it('should set min date on check-out to check-in or today', () => {
            expect(content).toContain('min={checkIn || todayIso}');
        });
    });

    describe('Floating UI', () => {
        it('should use useFloating hook', () => {
            expect(content).toContain('useFloating');
        });

        it('should use offset, flip, and shift middleware', () => {
            expect(content).toContain('offset');
            expect(content).toContain('flip');
            expect(content).toContain('shift');
        });
    });

    describe('Auto-focus behavior', () => {
        it('should auto-focus checkout after selecting check-in', () => {
            expect(content).toContain('checkOutRef');
            expect(content).toContain('focus');
        });
    });

    describe('Date formatting', () => {
        it('should use Intl.DateTimeFormat for short date display', () => {
            expect(content).toContain('Intl.DateTimeFormat');
        });
    });

    describe('Mobile mode', () => {
        it('should render inline in mobile mode (no floating)', () => {
            expect(content).toContain('if (isMobile)');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-expanded on trigger', () => {
            expect(content).toContain('aria-expanded');
        });

        it('should have labels for date inputs', () => {
            expect(content).toContain('htmlFor="search-checkin"');
            expect(content).toContain('htmlFor="search-checkout"');
        });
    });

    describe('File constraints', () => {
        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });
    });
});
