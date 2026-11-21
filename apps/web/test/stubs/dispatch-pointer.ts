import { fireEvent } from '@testing-library/react';

/** jsdom has no PointerEvent constructor; preserve pointer fields on a bubbling mouse event. */
export function dispatchPointer({
    target,
    type,
    pointerId = 1,
    pointerType = 'touch',
    ...coordinates
}: {
    readonly target: Element;
    readonly type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';
    readonly pointerId?: number;
    readonly pointerType?: string;
    readonly clientX?: number;
    readonly clientY?: number;
}) {
    fireEvent(
        target,
        Object.assign(new MouseEvent(type, { bubbles: true, ...coordinates }), {
            pointerId,
            pointerType,
            isPrimary: true
        })
    );
}
