/**
 * @file section-scroll.test.ts
 * @description HOS-2605: a tab jump must land the section under the sticky band
 * even when the layout moves during the scroll (the wave band collapses and slides
 * out). The fake page below reproduces that: crossing scrollY 64 pulls the
 * section up by 127px, and after 280px the sticky offset drops from 158 to 76.
 */
import { describe, expect, it } from 'vitest';
import {
    nextSectionScrollY,
    type SectionScrollWindow,
    scrollToListingSection
} from '../../../src/lib/listing-detail/section-scroll';

interface FakePage {
    readonly win: SectionScrollWindow;
    readonly target: HTMLElement;
    readonly readOffset: () => number;
    /** Runs queued animation frames until none is left (or the cap). */
    readonly flush: (cap?: number) => number;
    readonly scrolls: number[];
    readonly fire: (type: string) => void;
}

/**
 * A page whose section sits at document y 968 while the band is expanded and at
 * 841 once it collapses (scrollY >= 64), like the measured venue page at 390px.
 */
function fakePage({ sectionDocTop = 968 } = {}): FakePage {
    let scrollY = 0;
    let clock = 0;
    let queue: FrameRequestCallback[] = [];
    const listeners = new Map<string, Set<() => void>>();
    const scrolls: number[] = [];
    const collapsed = (): boolean => scrollY >= 64;
    const win: SectionScrollWindow = {
        get scrollY() {
            return scrollY;
        },
        innerHeight: 844,
        document: { documentElement: { scrollHeight: 4000 } },
        scrollTo: ({ top = 0 }) => {
            scrollY = Math.round(top);
            scrolls.push(scrollY);
        },
        requestAnimationFrame: (callback) => {
            queue.push(callback);
            return queue.length;
        },
        cancelAnimationFrame: () => {
            queue = [];
        },
        addEventListener: (type, listener) => {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)?.add(listener);
        },
        removeEventListener: (type, listener) => {
            listeners.get(type)?.delete(listener);
        }
    };
    const target = {
        getBoundingClientRect: () =>
            ({ top: sectionDocTop - (collapsed() ? 127 : 0) - scrollY }) as DOMRect
    } as HTMLElement;
    // navbar 76 + band (expanded 197, compact 70, hidden 0) + tabs 49.
    const readOffset = (): number => {
        if (!collapsed()) return 76 + 197 + 49;
        return scrollY >= 344 ? 76 + 49 : 76 + 70 + 49;
    };
    const flush = (cap = 500): number => {
        let frames = 0;
        while (queue.length > 0 && frames < cap) {
            const next = queue;
            queue = [];
            for (const callback of next) {
                clock += 16;
                callback(clock);
            }
            frames += 1;
        }
        return frames;
    };
    const fire = (type: string): void => {
        for (const listener of listeners.get(type) ?? []) listener();
    };
    return { win, target, readOffset, flush, scrolls, fire };
}

describe('nextSectionScrollY', () => {
    it('jumps straight to the destination with reduced motion', () => {
        expect(nextSectionScrollY({ currentY: 0, desiredY: 700, reduceMotion: true })).toBe(700);
    });

    it('eases toward the destination and never passes it', () => {
        const next = nextSectionScrollY({ currentY: 0, desiredY: 700, reduceMotion: false });
        expect(next).toBeGreaterThan(0);
        expect(next).toBeLessThan(700);
        expect(nextSectionScrollY({ currentY: 698, desiredY: 700, reduceMotion: false })).toBe(700);
        expect(
            nextSectionScrollY({ currentY: 700, desiredY: 500, reduceMotion: false })
        ).toBeLessThan(700);
    });
});

describe('scrollToListingSection (HOS-2605)', () => {
    it.each([
        false,
        true
    ])('lands the section 8px under the final band although the layout moved (reduceMotion=%s)', (reduceMotion) => {
        const page = fakePage();
        let clock = 0;

        scrollToListingSection({
            target: page.target,
            readOffset: page.readOffset,
            gap: 8,
            reduceMotion,
            win: page.win,
            now: () => (clock += 16)
        });
        page.flush();

        const top = page.target.getBoundingClientRect().top;
        // Band hidden at the end: navbar 76 + tabs 49 = 125.
        expect(top - 125).toBe(8);
    });

    it('a one-shot destination computed at the start lands under the band (the bug)', () => {
        const page = fakePage();
        // What scrollIntoView did: destination from the expanded layout, applied once.
        page.win.scrollTo({ top: 968 - (76 + 78) - 56 });
        expect(page.target.getBoundingClientRect().top).toBeLessThan(125);
    });

    it('never ends with a correction back up (that would reveal the wave band)', () => {
        const page = fakePage();
        scrollToListingSection({
            target: page.target,
            readOffset: page.readOffset,
            gap: 8,
            reduceMotion: false,
            win: page.win
        });
        page.flush();
        const tail = page.scrolls.slice(-10);
        for (let i = 1; i < tail.length; i += 1) {
            expect(tail[i] as number).toBeGreaterThanOrEqual(tail[i - 1] as number);
        }
    });

    it('stops when the user takes over the scroll', () => {
        const page = fakePage();
        scrollToListingSection({
            target: page.target,
            readOffset: page.readOffset,
            gap: 8,
            reduceMotion: false,
            win: page.win
        });
        const before = page.scrolls.length;
        page.fire('touchstart');
        page.flush();
        expect(page.scrolls.length).toBe(before);
    });

    it('cancel() stops the animation', () => {
        const page = fakePage();
        const { cancel } = scrollToListingSection({
            target: page.target,
            readOffset: page.readOffset,
            gap: 8,
            reduceMotion: false,
            win: page.win
        });
        cancel();
        expect(page.flush()).toBe(0);
    });

    it('clamps to the bottom of the page and still stops', () => {
        const page = fakePage({ sectionDocTop: 3900 });
        let clock = 0;
        scrollToListingSection({
            target: page.target,
            readOffset: page.readOffset,
            gap: 8,
            reduceMotion: false,
            win: page.win,
            now: () => (clock += 16)
        });
        const frames = page.flush();
        expect(page.win.scrollY).toBe(4000 - 844);
        expect(frames).toBeLessThan(500);
    });
});
