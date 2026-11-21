import type { PointerEvent } from 'react';
import { useRef } from 'react';

interface SwipeOptions {
    readonly onLeft: () => void;
    readonly onRight: () => void;
}

const SWIPE_THRESHOLD = 40;

/** Recognizes one horizontal touch swipe on release; vertical and canceled gestures are ignored. */
export function useSwipe({ onLeft, onRight }: SwipeOptions) {
    const start = useRef<{ readonly id: number; readonly x: number; readonly y: number } | null>(
        null
    );

    function cancel({ pointerId }: PointerEvent<HTMLElement>) {
        if (start.current?.id === pointerId) start.current = null;
    }

    return {
        onPointerDown(event: PointerEvent<HTMLElement>) {
            if (event.pointerType !== 'touch') return;
            if (!event.isPrimary) {
                start.current = null;
                return;
            }
            start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        onPointerMove(event: PointerEvent<HTMLElement>) {
            const origin = start.current;
            if (!origin || origin.id !== event.pointerId) return;
            if (Math.abs(event.clientY - origin.y) > Math.abs(event.clientX - origin.x)) {
                start.current = null;
            }
        },
        onPointerUp(event: PointerEvent<HTMLElement>) {
            const origin = start.current;
            if (!origin || origin.id !== event.pointerId) return;
            start.current = null;
            const dx = event.clientX - origin.x;
            if (
                Math.abs(dx) < SWIPE_THRESHOLD ||
                Math.abs(event.clientY - origin.y) > Math.abs(dx)
            ) {
                return;
            }
            if (dx < 0) onLeft();
            else onRight();
        },
        onPointerCancel: cancel,
        onLostPointerCapture: cancel
    };
}
