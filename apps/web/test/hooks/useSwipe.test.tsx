import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useSwipe } from '@/hooks/useSwipe';
import { dispatchPointer } from '../stubs/dispatch-pointer';

function setup() {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    function Target() {
        return (
            <div
                data-testid="swipe"
                {...useSwipe({ onLeft, onRight })}
            />
        );
    }
    render(<Target />);
    return { target: screen.getByTestId('swipe'), onLeft, onRight };
}

it.each([
    [-40, 'left'],
    [40, 'right']
])('recognizes a %dpx touch swipe', (dx, direction) => {
    const { target, onLeft, onRight } = setup();
    dispatchPointer({ target, type: 'pointerdown', clientX: 100 });
    dispatchPointer({ target, type: 'pointerup', clientX: 100 + dx });

    expect(onLeft).toHaveBeenCalledTimes(direction === 'left' ? 1 : 0);
    expect(onRight).toHaveBeenCalledTimes(direction === 'right' ? 1 : 0);
});

it.each([
    'short',
    'vertical',
    'vertical-first',
    'cancel',
    'mouse',
    'other-pointer'
])('ignores a %s gesture', (gesture) => {
    const { target, onLeft, onRight } = setup();
    const pointer = { target, pointerType: gesture === 'mouse' ? 'mouse' : 'touch' };

    dispatchPointer({ ...pointer, type: 'pointerdown', clientX: 100 });
    if (gesture === 'vertical-first') {
        dispatchPointer({ ...pointer, type: 'pointermove', clientX: 98, clientY: 30 });
    }
    if (gesture === 'cancel') dispatchPointer({ ...pointer, type: 'pointercancel' });
    dispatchPointer({
        ...pointer,
        type: 'pointerup',
        pointerId: gesture === 'other-pointer' ? 2 : 1,
        clientX: gesture === 'short' ? 61 : 50,
        clientY: gesture === 'vertical' ? 51 : 0
    });

    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
});
