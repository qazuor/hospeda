import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    SkeletonCard,
    SkeletonCardList
} from '../../../../src/components/shared/feedback/SkeletonCard';

vi.mock('../../../../src/components/shared/feedback/SkeletonCard.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

describe('SkeletonCard', () => {
    it('is decorative (aria-hidden) so screen readers skip it', () => {
        // Arrange / Act
        const { container } = render(<SkeletonCard />);

        // Assert
        expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });

    it('applies width, height and borderRadius inline styles', () => {
        // Arrange / Act
        const { container } = render(
            <SkeletonCard
                width="200px"
                height="80px"
                borderRadius="12px"
            />
        );

        // Assert
        const el = container.firstChild as HTMLElement;
        expect(el.style.width).toBe('200px');
        expect(el.style.height).toBe('80px');
        expect(el.style.borderRadius).toBe('12px');
    });
});

describe('SkeletonCardList', () => {
    it('renders the requested number of cards', () => {
        // Arrange / Act
        const { container } = render(<SkeletonCardList count={4} />);

        // Assert
        const list = container.firstChild as HTMLElement;
        expect(list.children).toHaveLength(4);
        expect(list).toHaveAttribute('aria-hidden', 'true');
    });

    it('defaults to three cards', () => {
        // Arrange / Act
        const { container } = render(<SkeletonCardList />);

        // Assert
        expect((container.firstChild as HTMLElement).children).toHaveLength(3);
    });

    it('clamps a negative count to zero cards', () => {
        // Arrange / Act
        const { container } = render(<SkeletonCardList count={-2} />);

        // Assert
        expect((container.firstChild as HTMLElement).children).toHaveLength(0);
    });
});
