/**
 * The adjustable clock (AC:B1:17): it reads still until a test moves it, and
 * moving it moves what `now()` answers.
 */
import { describe, expect, it } from 'vitest';
import { createAdjustableClock } from '../src/index';

const THREE_AM = new Date('2026-10-01T03:00:00.000Z');

describe('createAdjustableClock', () => {
    it('reads its start and stays still', () => {
        // Arrange
        const clock = createAdjustableClock({ start: THREE_AM });

        // Act / Assert
        expect(clock.now()).toEqual(THREE_AM);
        expect(clock.now()).toEqual(THREE_AM);
    });

    it('moves forward on advance', () => {
        // Arrange
        const clock = createAdjustableClock({ start: THREE_AM });

        // Act
        const { now } = clock.advance({ ms: 40 * 60_000 });

        // Assert
        expect(now).toEqual(new Date('2026-10-01T03:40:00.000Z'));
        expect(clock.now()).toEqual(new Date('2026-10-01T03:40:00.000Z'));
    });

    it('jumps to an exact instant on set, back included', () => {
        // Arrange
        const clock = createAdjustableClock({ start: THREE_AM });
        const before = new Date('2026-09-01T00:00:00.000Z');

        // Act
        clock.set({ at: before });

        // Assert
        expect(clock.now()).toEqual(before);
    });

    it('hands out a copy: mutating a read does not move the clock', () => {
        // Arrange
        const clock = createAdjustableClock({ start: THREE_AM });

        // Act
        clock.now().setTime(0);

        // Assert
        expect(clock.now()).toEqual(THREE_AM);
    });

    it('is not moved by mutating the start it was given', () => {
        // Arrange
        const start = new Date(THREE_AM);
        const clock = createAdjustableClock({ start });

        // Act
        start.setTime(0);

        // Assert
        expect(clock.now()).toEqual(THREE_AM);
    });

    it('refuses an invalid start, a negative or fractional advance, and an invalid set', () => {
        // Arrange
        const clock = createAdjustableClock({ start: THREE_AM });

        // Act / Assert
        expect(() => createAdjustableClock({ start: new Date('nope') })).toThrow();
        expect(() => clock.advance({ ms: -1 })).toThrow();
        expect(() => clock.advance({ ms: 0.5 })).toThrow();
        expect(() => clock.set({ at: new Date('nope') })).toThrow();
        expect(clock.now()).toEqual(THREE_AM);
    });
});
