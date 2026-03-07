import { cn } from '@/lib/cn';
/**
 * Tests for cn.ts - Tailwind-aware class merging utility.
 */
import { describe, expect, it } from 'vitest';

describe('cn', () => {
    describe('basic class joining', () => {
        it('should return a single class unchanged', () => {
            // Arrange / Act / Assert
            expect(cn('foo')).toBe('foo');
        });

        it('should join multiple classes with a space', () => {
            expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
        });

        it('should return an empty string when called with no arguments', () => {
            expect(cn()).toBe('');
        });
    });

    describe('conditional classes via clsx', () => {
        it('should include truthy conditional classes', () => {
            expect(cn('base', true && 'active')).toBe('base active');
        });

        it('should exclude falsy conditional classes', () => {
            expect(cn('base', false && 'hidden')).toBe('base');
        });

        it('should handle undefined values gracefully', () => {
            expect(cn('base', undefined)).toBe('base');
        });

        it('should handle null values gracefully', () => {
            expect(cn('base', null)).toBe('base');
        });

        it('should support object syntax { class: condition }', () => {
            expect(cn({ active: true, disabled: false })).toBe('active');
        });

        it('should support array syntax', () => {
            expect(cn(['foo', 'bar'])).toBe('foo bar');
        });
    });

    describe('Tailwind conflict resolution via twMerge', () => {
        it('should resolve conflicting text-size utilities (last wins)', () => {
            expect(cn('text-sm', 'text-lg')).toBe('text-lg');
        });

        it('should resolve conflicting background-color utilities (last wins)', () => {
            expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
        });

        it('should resolve conflicting padding utilities', () => {
            expect(cn('p-2', 'p-4')).toBe('p-4');
        });

        it('should keep non-conflicting utilities together', () => {
            const result = cn('text-sm', 'font-bold', 'bg-blue-500');
            expect(result).toContain('text-sm');
            expect(result).toContain('font-bold');
            expect(result).toContain('bg-blue-500');
        });

        it('should resolve px vs p conflict correctly', () => {
            // p-4 sets all sides; px-2 should override horizontal only
            // twMerge handles this correctly
            expect(cn('p-4', 'px-2')).toBe('p-4 px-2');
        });
    });

    describe('real-world component patterns', () => {
        it('should merge base + variant classes correctly', () => {
            const base = 'rounded px-3 py-2 text-sm font-medium';
            const variant = 'bg-primary text-primary-foreground';
            const result = cn(base, variant);
            expect(result).toContain('rounded');
            expect(result).toContain('bg-primary');
            expect(result).toContain('text-primary-foreground');
        });

        it('should allow className prop to override defaults', () => {
            const defaultClass = 'text-sm text-muted-foreground';
            const userClass = 'text-lg';
            // text-lg should override text-sm, text-muted-foreground remains
            const result = cn(defaultClass, userClass);
            expect(result).toContain('text-lg');
            expect(result).not.toContain('text-sm');
        });
    });
});
