/**
 * @file embla.ts
 * @description Reusable Embla Carousel mock helpers for vitest tests.
 *
 * Provides:
 * - `createEmblaMock(options?)`: factory that returns a deterministic mock of
 *   the Embla `EmblaCarouselType` API surface used by our island components
 *   (`selectedScrollSnap`, `scrollSnapList`, `scrollNext`, `scrollPrev`,
 *   `scrollTo`, `on`, `off`, `canScrollPrev`, `canScrollNext`, `slidesInView`,
 *   `slideNodes`).
 * - `mockUseEmblaCarousel(api)`: helper to mock the default export of
 *   `embla-carousel-react` so consumers receive a fixed `[ref, api]` tuple.
 *
 * Tasks: T-083 (S-11 prep)
 */

import type { Mock } from 'vitest';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape of the Embla API mock returned by {@link createEmblaMock}.
 * Each property is a `vi.fn()` so callers can assert calls and customize
 * return values on a per-test basis.
 */
export type EmblaApiMock = {
    readonly selectedScrollSnap: Mock<[], number>;
    readonly scrollSnapList: Mock<[], readonly number[]>;
    readonly scrollNext: Mock<[], void>;
    readonly scrollPrev: Mock<[], void>;
    readonly scrollTo: Mock<[number], void>;
    readonly on: Mock<[string, (...args: unknown[]) => void], EmblaApiMock>;
    readonly off: Mock<[string, (...args: unknown[]) => void], EmblaApiMock>;
    readonly canScrollPrev: Mock<[], boolean>;
    readonly canScrollNext: Mock<[], boolean>;
    readonly slidesInView: Mock<[], readonly number[]>;
    readonly slideNodes: Mock<[], readonly HTMLElement[]>;
};

/**
 * Optional overrides for {@link createEmblaMock}. Any property left undefined
 * falls back to the deterministic default (3 snaps, snap 0 selected, both
 * directions scrollable, slides 0 and 1 in view, no slide nodes).
 */
export interface CreateEmblaMockOptions {
    readonly selectedSnap?: number;
    readonly snapList?: readonly number[];
    readonly canPrev?: boolean;
    readonly canNext?: boolean;
    readonly slidesInView?: readonly number[];
    readonly slideNodes?: readonly HTMLElement[];
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/**
 * Build a deterministic Embla API mock suitable for testing carousel islands.
 *
 * Defaults:
 * - `selectedScrollSnap()` → 0
 * - `scrollSnapList()` → `[0, 0.5, 1]` (3 snap groups)
 * - `canScrollPrev()` / `canScrollNext()` → `true`
 * - `slidesInView()` → `[0, 1]`
 * - `slideNodes()` → `[]`
 *
 * `on()` / `off()` are chainable (return the same mock) to mirror the real
 * Embla API.
 *
 * @example
 * ```ts
 * import { createEmblaMock, mockUseEmblaCarousel } from '../mocks/embla';
 *
 * const api = createEmblaMock({ snapList: [0, 0.5, 1] });
 * mockUseEmblaCarousel(api);
 * ```
 */
export function createEmblaMock(options: CreateEmblaMockOptions = {}): EmblaApiMock {
    const {
        selectedSnap = 0,
        snapList = [0, 0.5, 1],
        canPrev = true,
        canNext = true,
        slidesInView = [0, 1],
        slideNodes = []
    } = options;

    const mock: EmblaApiMock = {
        selectedScrollSnap: vi.fn(() => selectedSnap),
        scrollSnapList: vi.fn(() => snapList),
        scrollNext: vi.fn(),
        scrollPrev: vi.fn(),
        scrollTo: vi.fn(),
        on: vi.fn((..._args: [string, (...a: unknown[]) => void]) => mock),
        off: vi.fn((..._args: [string, (...a: unknown[]) => void]) => mock),
        canScrollPrev: vi.fn(() => canPrev),
        canScrollNext: vi.fn(() => canNext),
        slidesInView: vi.fn(() => slidesInView),
        slideNodes: vi.fn(() => slideNodes)
    } as unknown as EmblaApiMock;

    return mock;
}

/**
 * Mock `embla-carousel-react` so its default export returns the supplied API
 * along with a no-op ref callback.
 *
 * Must be invoked at module scope (before tests run) because vitest hoists
 * `vi.mock` calls to the top of the file. Pass a getter so the test file can
 * swap the underlying mock via reassignment if needed.
 */
export function mockUseEmblaCarousel(getApi: () => EmblaApiMock): void {
    vi.mock('embla-carousel-react', () => ({
        default: () => {
            const refCallback: (node: HTMLElement | null) => void = () => {};
            return [refCallback, getApi()] as const;
        }
    }));
}
