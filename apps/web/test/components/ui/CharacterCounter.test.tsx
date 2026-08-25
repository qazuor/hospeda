/**
 * @file CharacterCounter.test.tsx
 * @description Boundary coverage for the shared `used/total` readout (HOS-783 B5).
 *
 * The threshold lives here now, in one place, for both the publish mini form
 * and the section editor. These pin its exact edges — off by one on either side
 * and a field either nags too early or never turns red at all.
 *
 * @module test/components/ui/CharacterCounter
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CharacterCounter, getCharacterCounterState } from '@/components/ui/CharacterCounter';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (_key: string, fallback: string, params: Record<string, string>) =>
            fallback
                .replaceAll('{{count}}', params.count)
                .replaceAll('{{max}}', params.max)
                .replaceAll('{{min}}', params.min ?? '')
    })
}));

vi.mock('@/components/ui/CharacterCounter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

describe('getCharacterCounterState', () => {
    it.each([
        [0, 100, 'normal'],
        [79, 100, 'normal'],
        // Math.ceil(100 * 0.8) — the first character that warns.
        [80, 100, 'warning'],
        [99, 100, 'warning'],
        // The browser pins the value here via maxLength, so `>=` and not `>`.
        [100, 100, 'danger'],
        // A value already over the limit (imported content, a lowered cap).
        [140, 100, 'danger']
    ])('classifies %i of %i as %s', (current, max, expected) => {
        expect(getCharacterCounterState({ current, max })).toBe(expected);
    });

    it('rounds the warning threshold up', () => {
        // Math.ceil(3 * 0.8) === 3, which is also the limit → danger, never warning.
        expect(getCharacterCounterState({ current: 2, max: 3 })).toBe('normal');
        expect(getCharacterCounterState({ current: 3, max: 3 })).toBe('danger');
    });

    it('treats values below the minimum as their own state', () => {
        expect(getCharacterCounterState({ current: 2, min: 3, max: 100 })).toBe('under-minimum');
        expect(getCharacterCounterState({ current: 3, min: 3, max: 100 })).toBe('normal');
    });

    it('leaves an empty optional field alone, but holds it to the floor once typed in', () => {
        // `seoTitle` is `union([literal(''), string().min(30).max(60)])`:
        // empty is a valid "no override", one character is not.
        expect(getCharacterCounterState({ current: 0, min: 30, max: 60, optional: true })).toBe(
            'normal'
        );
        expect(getCharacterCounterState({ current: 1, min: 30, max: 60, optional: true })).toBe(
            'under-minimum'
        );
        expect(getCharacterCounterState({ current: 30, min: 30, max: 60, optional: true })).toBe(
            'normal'
        );

        // A required field with the same numbers still flags the empty case.
        expect(getCharacterCounterState({ current: 0, min: 30, max: 60 })).toBe('under-minimum');
    });
});

describe('CharacterCounter', () => {
    it('renders used/total and exposes the warning state', () => {
        render(
            <CharacterCounter
                id="c"
                locale="es"
                current={85}
                max={100}
                testId="counter"
            />
        );

        expect(screen.getByTestId('counter')).toHaveTextContent('85/100');
        expect(screen.getByTestId('counter')).toHaveAttribute('data-state', 'warning');
    });

    it('renders the minimum when one exists and marks values below it', () => {
        render(
            <CharacterCounter
                id="c"
                locale="es"
                current={2}
                min={3}
                max={100}
                testId="counter"
            />
        );

        expect(screen.getByTestId('counter')).toHaveTextContent('2/100 · mín. 3');
        expect(screen.getByTestId('counter')).toHaveAttribute('data-state', 'under-minimum');
    });

    it('spells the below-minimum state out for assistive tech, not just in colour', () => {
        const { rerender } = render(
            <CharacterCounter
                id="c"
                locale="es"
                current={2}
                min={3}
                max={100}
                testId="counter"
            />
        );

        const srText = screen
            .getByTestId('counter')
            .querySelector('.sr-only') as HTMLElement | null;
        expect(srText).not.toBeNull();
        expect(srText?.textContent).toContain('mínimo de 3');

        // Reaching the minimum must retract the announcement, otherwise a
        // screen reader keeps reporting a field that is already valid.
        rerender(
            <CharacterCounter
                id="c"
                locale="es"
                current={3}
                min={3}
                max={100}
                testId="counter"
            />
        );

        expect(screen.getByTestId('counter').querySelector('.sr-only')).toBeNull();
    });

    it('never names the paragraph with aria-label, which ARIA prohibits on generic roles', () => {
        render(
            <CharacterCounter
                id="c"
                locale="es"
                current={2}
                min={3}
                max={100}
                testId="counter"
            />
        );

        expect(screen.getByTestId('counter')).not.toHaveAttribute('aria-label');
    });

    it('never prints an undefined modifier class in the normal state', () => {
        render(
            <CharacterCounter
                id="c"
                locale="es"
                current={1}
                max={100}
                testId="counter"
            />
        );

        expect(screen.getByTestId('counter').className).not.toContain('undefined');
    });
});
