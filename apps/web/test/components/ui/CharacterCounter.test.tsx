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
            fallback.replaceAll('{{count}}', params.count).replaceAll('{{max}}', params.max)
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
});

describe('CharacterCounter', () => {
    it('renders used/total and exposes the state', () => {
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
