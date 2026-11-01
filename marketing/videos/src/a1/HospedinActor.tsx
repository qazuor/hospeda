import layers from '@marketing-assets/hospedin/hd/layers.json';
import type React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND, headingFont } from './brand';

/** HD cutouts under <public dir>/hospedin/hd/ (tools/hd_cutouts.py). */
export type Pose =
    | 'main'
    | 'saludando'
    | 'senalando'
    | 'te-explico'
    | 'descubri'
    | 'es-facil'
    | 'enumerando'
    | 'vamos'
    | 'pensando'
    | 'lamparita'
    | 'telefono';

type Rect = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
};
type PoseLayers = {
    readonly file: string;
    readonly width: number;
    readonly height: number;
    readonly sun: Rect & { readonly file: string };
    readonly eyes?: { readonly left: Rect; readonly right: Rect; readonly headColor: string };
};

const POSES = (layers as unknown as { poses: Record<Pose, PoseLayers> }).poses;

/** Frames between blinks, varied so it never looks mechanical. */
const BLINKS = [40, 118, 131, 215, 300, 352, 430];

const blinkAmount = (frame: number): number => {
    for (const b of BLINKS) {
        const d = frame - b;
        if (d >= 0 && d <= 6) return interpolate(d, [0, 2, 3, 6], [0, 1, 1, 0]);
    }
    return 0;
};

type ActorProps = {
    readonly pose: Pose;
    readonly height: number;
    /** Frame at which this pose appeared: replays a soft squash-and-stretch pop. */
    readonly at: number;
    readonly style?: React.CSSProperties;
};

/**
 * Hospedín with life: the sun floats on its own layer (it is a separate object in the brand,
 * never touching the head), the body breathes subtly, and the main pose blinks.
 */
export const HospedinActor: React.FC<ActorProps> = ({ pose, height, at, style }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const p = POSES[pose];
    const scale = height / p.height;
    const pop = spring({
        frame: frame - at,
        fps,
        config: { damping: 9, stiffness: 170, mass: 0.8 }
    });
    const squash = 1 + (1 - pop) * 0.12;
    const breathe = Math.sin((frame - at) / 22) * 0.012;
    const sunDy = Math.sin(frame / 16) * p.sun.height * 0.09;
    const sunDx = Math.cos(frame / 23) * p.sun.width * 0.05;
    const blink = p.eyes ? blinkAmount(frame - at) : 0;
    return (
        <div
            style={{
                position: 'relative',
                width: p.width * scale,
                height,
                transformOrigin: '50% 100%',
                transform: `scale(${((0.88 + pop * 0.12) / squash) * (1 - breathe)}, ${(0.88 + pop * 0.12) * squash * (1 + breathe)})`,
                filter: 'drop-shadow(0 22px 26px rgba(13,43,62,0.25))',
                ...style
            }}
        >
            <Img
                src={staticFile(`hospedin/hd/${p.file}`)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
            {p.eyes &&
                [p.eyes.left, p.eyes.right].map((e) => (
                    <div
                        key={e.x}
                        style={{
                            position: 'absolute',
                            left: (e.x - e.width * 0.06) * scale,
                            top: (e.y - e.height * 0.04) * scale,
                            width: e.width * 1.12 * scale,
                            height: e.height * 1.08 * scale,
                            borderRadius: '50%',
                            background: `radial-gradient(ellipse at 50% 30%, ${p.eyes?.headColor} 60%, #1f9fe0 100%)`,
                            transformOrigin: '50% 0%',
                            transform: `scaleY(${blink})`
                        }}
                    />
                ))}
            <Img
                src={staticFile(`hospedin/hd/${p.sun.file}`)}
                style={{
                    position: 'absolute',
                    left: (p.sun.x + sunDx) * scale,
                    top: (p.sun.y + sunDy) * scale,
                    width: p.sun.width * scale,
                    height: p.sun.height * scale
                }}
            />
        </div>
    );
};

/** White speech bubble with a tail toward the bottom-right (where Hospedín stands). */
export const Bubble: React.FC<{
    readonly text: string;
    readonly at: number;
    readonly out?: number;
    readonly style?: React.CSSProperties;
}> = ({ text, at, out, style }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const enter = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 190 } });
    const leave =
        out === undefined
            ? 0
            : interpolate(frame, [out, out + 7], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp'
              });
    const s = enter * (1 - leave);
    return (
        <div
            style={{
                position: 'absolute',
                maxWidth: 600,
                padding: '28px 38px',
                borderRadius: 38,
                background: BRAND.white,
                color: BRAND.ink,
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: 48,
                lineHeight: 1.12,
                boxShadow: '0 18px 44px rgba(13,43,62,0.24)',
                transformOrigin: '88% 120%',
                transform: `scale(${s})`,
                opacity: Math.min(1, s * 1.5),
                ...style
            }}
        >
            {text}
            <div
                style={{
                    position: 'absolute',
                    right: 64,
                    bottom: -28,
                    width: 0,
                    height: 0,
                    borderLeft: '24px solid transparent',
                    borderRight: '24px solid transparent',
                    borderTop: `32px solid ${BRAND.white}`
                }}
            />
        </div>
    );
};
