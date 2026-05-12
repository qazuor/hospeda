/**
 * @file TestimonialsCarousel.test.tsx
 * @description Unit tests for the TestimonialsCarousel React island.
 *
 * Coverage targets:
 * - Dot count matches scrollSnapList length (T-086 / S-11c).
 * - Next button click invokes scrollNext on the Embla API; mouseenter pauses
 *   the autoplay plugin (T-087 / S-11d).
 *
 * The Embla and autoplay plugin internals are stubbed via the helpers from
 * `apps/web/test/mocks/embla.ts` (T-083) and module-level `vi.mock` calls
 * here so tests are deterministic and never touch real DOM measurements.
 *
 * Tasks: T-086 (S-11c), T-087 (S-11d)
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewCardData } from '../../src/data/types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// CSS modules: stable proxy returning the requested key as className.
vi.mock('../../src/components/sections/TestimonialsCarousel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// i18n: stable t() that returns the fallback so labels stay deterministic.
vi.mock('../../src/lib/i18n', () => {
    const t = (_key: string, fallback?: string, vars?: Record<string, unknown>): string => {
        if (!fallback) return _key;
        if (!vars) return fallback;
        return Object.entries(vars).reduce<string>(
            (acc, [k, v]) => acc.replace(new RegExp(`{{${k}}}`, 'g'), String(v)),
            fallback
        );
    };
    return {
        createTranslations: () => ({ t })
    };
});

// ReviewCard renders the testimonial body. We don't care about its content
// here, only that the carousel rendered N slides; replacing it with a stub
// avoids pulling in icon, color, and avatar-utils dependencies.
vi.mock('../../src/components/shared/cards/ReviewCard', () => ({
    ReviewCard: ({ data }: { data: ReviewCardData }) => (
        <div data-testid="review-card">{data.id}</div>
    )
}));

// Module-level Embla API mock — the same instance is reused across both
// `useEmblaCarousel` invocations within a test. `vi.hoisted` lets us
// reference these stubs from the hoisted `vi.mock` factories below. We
// inline the Embla mock here rather than importing the shared helper to
// avoid module-resolution issues during the hoist phase.
const { embla, autoplayStub } = vi.hoisted(() => {
    type EmblaMock = {
        selectedScrollSnap: ReturnType<typeof vi.fn>;
        scrollSnapList: ReturnType<typeof vi.fn>;
        scrollNext: ReturnType<typeof vi.fn>;
        scrollPrev: ReturnType<typeof vi.fn>;
        scrollTo: ReturnType<typeof vi.fn>;
        on: ReturnType<typeof vi.fn>;
        off: ReturnType<typeof vi.fn>;
        canScrollPrev: ReturnType<typeof vi.fn>;
        canScrollNext: ReturnType<typeof vi.fn>;
        slidesInView: ReturnType<typeof vi.fn>;
        slideNodes: ReturnType<typeof vi.fn>;
    };
    const e: EmblaMock = {
        selectedScrollSnap: vi.fn(() => 0),
        scrollSnapList: vi.fn(() => [0, 0.5, 1]),
        scrollNext: vi.fn(),
        scrollPrev: vi.fn(),
        scrollTo: vi.fn(),
        on: vi.fn(function (this: EmblaMock) {
            return this;
        }),
        off: vi.fn(function (this: EmblaMock) {
            return this;
        }),
        canScrollPrev: vi.fn(() => true),
        canScrollNext: vi.fn(() => true),
        slidesInView: vi.fn(() => [0, 1]),
        slideNodes: vi.fn(() => [])
    };
    const autoplay = {
        name: 'autoplay',
        init: vi.fn(),
        destroy: vi.fn(),
        options: {},
        play: vi.fn(),
        stop: vi.fn(),
        reset: vi.fn(),
        isPlaying: vi.fn(() => true),
        timeUntilNext: vi.fn(() => 0)
    };
    return { embla: e, autoplayStub: autoplay };
});

vi.mock('embla-carousel-react', () => ({
    default: () => {
        const refCallback: (node: HTMLElement | null) => void = () => {};
        return [refCallback, embla] as const;
    }
}));

// Autoplay plugin: tests assert play/stop interactions on this stub.
vi.mock('embla-carousel-autoplay', () => ({
    default: vi.fn(() => autoplayStub)
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeReview(id: string): ReviewCardData {
    return {
        id,
        quote: `Quote ${id}`,
        rating: 5,
        reviewerName: `Reviewer ${id}`,
        reviewerOrigin: 'Buenos Aires, Argentina',
        initials: 'RX'
    };
}

const SIX_REVIEWS: readonly ReviewCardData[] = Array.from({ length: 6 }, (_, i) =>
    makeReview(`r${i + 1}`)
);

// ─── Component import (vi.mock is hoisted, so mocks are wired before this) ──

// Vitest hoists `vi.mock` / `vi.hoisted` above all imports, so the SUT can be
// imported statically here without breaking the mocks. The previous version
// of this file used a lazy `await import()` per test, but on CI's sharded
// coverage runs the v8 instrumentation pushed the first dynamic import past
// the 5–15s test timeout. Resolving the module once at file load eliminates
// the flake without losing mock determinism.
import { TestimonialsCarousel } from '../../src/components/sections/TestimonialsCarousel.client';

// ─── T-086: dot count ─────────────────────────────────────────────────────────

describe('TestimonialsCarousel — dot count', () => {
    beforeEach(() => {
        // Reset call history between tests so spies don't accumulate.
        embla.scrollNext.mockClear();
        embla.scrollPrev.mockClear();
        embla.scrollTo.mockClear();
        embla.on.mockClear();
        embla.off.mockClear();
        autoplayStub.play.mockClear();
        autoplayStub.stop.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders one navigation dot per scroll snap (3 dots for 6 reviews @ slidesToScroll:2)', async () => {
        render(
            <TestimonialsCarousel
                reviews={SIX_REVIEWS}
                locale="es"
            />
        );

        // The dots wrapper has role="tablist"; each dot is a role="tab" button.
        const tablist = screen.getByRole('tablist');
        const dots = tablist.querySelectorAll('button[role="tab"]');
        expect(dots).toHaveLength(embla.scrollSnapList().length);
        expect(dots).toHaveLength(3);
    });
});

// ─── T-087: next button + autoplay pause ──────────────────────────────────────

describe('TestimonialsCarousel — next button and autoplay pause', () => {
    beforeEach(() => {
        embla.scrollNext.mockClear();
        embla.scrollPrev.mockClear();
        embla.scrollTo.mockClear();
        embla.on.mockClear();
        embla.off.mockClear();
        autoplayStub.play.mockClear();
        autoplayStub.stop.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('calls scrollNext exactly once when the next arrow button is clicked', async () => {
        render(
            <TestimonialsCarousel
                reviews={SIX_REVIEWS}
                locale="es"
            />
        );

        // The component labels the next arrow with the i18n key; the stable
        // mock t() returns the fallback "Next testimonial".
        const nextButton = screen.getByRole('button', { name: 'Next testimonial' });

        fireEvent.click(nextButton);

        expect(embla.scrollNext).toHaveBeenCalledTimes(1);
    });

    it('pauses autoplay (calls plugin.stop) when the carousel is hovered', async () => {
        render(
            <TestimonialsCarousel
                reviews={SIX_REVIEWS}
                locale="es"
            />
        );

        // The wrapper is the outermost <div> rendered by the component. It
        // hosts the onMouseEnter/onMouseLeave handlers. We grab it via the
        // tablist's parent (sibling of the carousel area).
        const tablist = screen.getByRole('tablist');
        const wrapper = tablist.parentElement as HTMLElement;
        expect(wrapper).not.toBeNull();

        // Sanity: stop has not been invoked yet from setup.
        expect(autoplayStub.stop).not.toHaveBeenCalled();

        fireEvent.mouseEnter(wrapper);
        expect(autoplayStub.stop).toHaveBeenCalledTimes(1);

        // Leaving the carousel resumes autoplay.
        fireEvent.mouseLeave(wrapper);
        expect(autoplayStub.play).toHaveBeenCalledTimes(1);
    });
});
