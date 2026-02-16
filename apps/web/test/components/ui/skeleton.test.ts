import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/Skeleton.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Skeleton.astro', () => {
    describe('Props', () => {
        it('should accept type prop', () => {
            expect(content).toContain("type?: 'card' | 'text' | 'image'");
        });

        it('should accept count prop', () => {
            expect(content).toContain('count?: number');
        });

        it('should accept class prop', () => {
            expect(content).toContain('class?: string');
        });

        it('should default type to text', () => {
            expect(content).toContain("type = 'text'");
        });

        it('should default count to 1', () => {
            expect(content).toContain('count = 1');
        });
    });

    describe('Type variants', () => {
        it('should have text type styles', () => {
            expect(content).toContain('text: ');
            expect(content).toContain('h-4');
            expect(content).toContain('w-full');
        });

        it('should have card type styles', () => {
            expect(content).toContain('card: ');
            expect(content).toContain('aspect-[4/3]');
            expect(content).toContain('rounded-lg');
        });

        it('should have image type styles', () => {
            expect(content).toContain('image: ');
            expect(content).toContain('aspect-square');
            expect(content).toContain('rounded-lg');
        });
    });

    describe('Base styles', () => {
        it('should apply base background color', () => {
            expect(content).toContain('bg-border/50');
        });

        it('should apply shimmer animation', () => {
            expect(content).toContain('animate-shimmer');
        });
    });

    describe('Count rendering', () => {
        it('should render multiple text skeletons when count > 1', () => {
            expect(content).toContain('count > 1');
            expect(content).toContain('Array.from({ length: count }');
        });

        it('should make last text skeleton 75% width', () => {
            expect(content).toContain('width: 75%');
            expect(content).toContain('count - 1');
        });

        it('should add spacing between multiple text skeletons', () => {
            expect(content).toContain('space-y-3');
        });
    });

    describe('Card type rendering', () => {
        it('should render inner text lines for card type', () => {
            expect(content).toContain("type === 'card'");
            expect(content).toContain('bg-surface');
        });

        it('should have padding in card content', () => {
            expect(content).toContain('p-4');
        });

        it('should have different width text lines in card', () => {
            expect(content).toContain('w-3/4');
            expect(content).toContain('w-1/2');
        });
    });

    describe('Accessibility', () => {
        it('should have role status', () => {
            expect(content).toContain('role="status"');
        });

        it('should be hidden from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have sr-only loading text', () => {
            expect(content).toContain('sr-only');
            expect(content).toContain('Loading...');
        });
    });

    describe('Class composition', () => {
        it('should merge base classes with type classes', () => {
            expect(content).toContain('baseClasses');
            expect(content).toContain('typeClasses');
        });

        it('should filter and join classes', () => {
            expect(content).toContain('.filter(Boolean).join');
        });
    });
});
