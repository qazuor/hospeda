import type React from 'react';
import { useCurrentFrame } from 'remotion';
import { PAGE_TOP, type RecordingFit } from '../a1/Phone';
import type { Box } from '../a1/timeline';

/**
 * Redaction over a box of the recording between two composition frames, for text that must not
 * be legible (e.g. a pasted third-party URL): an opaque field-coloured fill with a soft blurred
 * bar where the text was. It does not use `backdrop-filter`: under the camera's scale transform
 * Chrome samples the backdrop at the unscaled size and leaves part of the text uncovered.
 * Drawn in whole-screen coordinates, so it goes in {@link PhoneTutorial}'s `screenOverlay`.
 */
export const Mask: React.FC<{
    readonly box: Box;
    readonly from: number;
    readonly to: number;
    readonly fit: RecordingFit;
    /** Recording px kept clear inside the box (shows the field's own border). */
    readonly inset?: number;
}> = ({ box, from, to, fit, inset = 10 }) => {
    const frame = useCurrentFrame();
    if (frame < from || frame >= to) return null;
    const height = (box.h - inset * 2) * fit.k;
    return (
        <div
            style={{
                position: 'absolute',
                left: (box.x + inset) * fit.k + fit.ox,
                top: (box.y + inset) * fit.k + fit.oy + PAGE_TOP,
                width: (box.w - inset * 2) * fit.k,
                height,
                borderRadius: 8,
                background: '#FFFFFF',
                overflow: 'hidden',
                pointerEvents: 'none'
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: '6%',
                    right: '8%',
                    top: '34%',
                    height: '32%',
                    borderRadius: 999,
                    background: 'rgba(13,43,62,0.28)',
                    filter: `blur(${Math.max(3, height * 0.12)}px)`
                }}
            />
        </div>
    );
};
