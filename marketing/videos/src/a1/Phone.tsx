import type React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { BRAND, bodyFont } from './brand';
import { REC_HEIGHT, REC_WIDTH, SCREEN_W, type Spot } from './timeline';

/** Recording px → composition px. */
export const K = SCREEN_W / REC_WIDTH;
/** iOS-style status bar: 47pt at 3x, drawn above the recording (the recording has none). */
export const STATUS_H = Math.round(47 * 3 * K);
/** Screen height in composition px: the scaled recording plus the drawn status bar. */
export const SCREEN_H = Math.round(REC_HEIGHT * K) + STATUS_H;
const BEZEL = 16;
/** Outer phone width in composition px (screen + bezel). */
export const PHONE_W = SCREEN_W + BEZEL * 2;
/** Outer phone height in composition px (screen + bezel). */
export const PHONE_H = SCREEN_H + BEZEL * 2;

const StatusBar: React.FC = () => (
    <div
        style={{
            position: 'absolute',
            inset: 0,
            height: STATUS_H,
            background: BRAND.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 46px 0 58px',
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 28,
            color: '#111'
        }}
    >
        <span>9:41</span>
        {/* Dynamic island. */}
        <div
            style={{
                position: 'absolute',
                left: '50%',
                top: 14,
                width: 210,
                height: 58,
                marginLeft: -105,
                borderRadius: 40,
                background: '#000'
            }}
        />
        <svg
            aria-hidden="true"
            width={118}
            height={26}
            viewBox="0 0 118 26"
        >
            {[0, 1, 2, 3].map((i) => (
                <rect
                    key={i}
                    x={i * 9}
                    y={18 - i * 5}
                    width={6}
                    height={8 + i * 5}
                    rx={1.5}
                    fill="#111"
                />
            ))}
            <path
                d="M52 9 a14 14 0 0 1 20 0 M55 13 a9 9 0 0 1 14 0 M58.5 17 a4 4 0 0 1 7 0"
                stroke="#111"
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
            />
            <rect
                x={80}
                y={4}
                width={32}
                height={17}
                rx={5}
                stroke="#111"
                strokeWidth={2}
                fill="none"
                opacity={0.5}
            />
            <rect
                x={83}
                y={7}
                width={26}
                height={11}
                rx={3}
                fill="#111"
            />
            <rect
                x={113.5}
                y={9.5}
                width={2.5}
                height={6}
                rx={1}
                fill="#111"
                opacity={0.5}
            />
        </svg>
    </div>
);

/** Dims everything but the active field: a lit, rounded window with an orange outline. */
export const Spotlight: React.FC<{ readonly spot: Spot }> = ({ spot }) => {
    if (spot.a < 0.01 || spot.w < 1) return null;
    const pad = 16;
    return (
        <div
            style={{
                position: 'absolute',
                left: (spot.x - pad) * K,
                top: (spot.y - pad) * K + STATUS_H,
                width: (spot.w + pad * 2) * K,
                height: (spot.h + pad * 2) * K,
                borderRadius: 18,
                boxShadow: `0 0 0 3000px rgba(13,43,62,${0.38 * spot.a}), 0 0 0 4px rgba(245,166,35,${spot.a}), 0 0 26px 6px rgba(245,166,35,${0.45 * spot.a})`,
                pointerEvents: 'none'
            }}
        />
    );
};

/** Touch indicator: a soft white press with an orange ring that expands and fades. */
export const Touch: React.FC<{ readonly x: number; readonly y: number; readonly at: number }> = ({
    x,
    y,
    at
}) => {
    const f = useCurrentFrame() - at;
    if (f < -6 || f > 20) return null;
    const press = interpolate(f, [-6, 0, 4, 20], [0, 1, 0.82, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp'
    });
    const ring = interpolate(f, [0, 20], [0.5, 1.7], { extrapolateLeft: 'clamp' });
    const ringA = interpolate(f, [0, 20], [0.9, 0], { extrapolateLeft: 'clamp' });
    const cx = x * K;
    const cy = y * K + STATUS_H;
    return (
        <>
            <div
                style={{
                    position: 'absolute',
                    left: cx - 60,
                    top: cy - 60,
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    border: `6px solid ${BRAND.orange}`,
                    transform: `scale(${ring})`,
                    opacity: f >= 0 ? ringA : 0
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    left: cx - 36,
                    top: cy - 36,
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.75)',
                    boxShadow: '0 4px 14px rgba(13,43,62,0.35)',
                    transform: `scale(${press})`,
                    opacity: press
                }}
            />
        </>
    );
};

/** Brand wipe that hides a page load: blue and green panels sweep across with the logo mark. */
export const Wipe: React.FC<{ readonly at: number }> = ({ at }) => {
    const f = useCurrentFrame() - at;
    if (f < -10 || f > 10) return null;
    const x = (lag: number): number =>
        interpolate(f - lag, [-10, 0, 10], [100, 0, -100], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
        });
    return (
        <>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: BRAND.green,
                    transform: `translateX(${x(2)}%)`
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: BRAND.blue,
                    transform: `translateX(${x(0)}%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <Img
                    src={staticFile('brand/logo.png')}
                    style={{ width: 150, filter: 'brightness(0) invert(1)' }}
                />
            </div>
        </>
    );
};

/** A believable phone: titanium edge, side buttons, status bar, glass highlight and deep shadow. */
export const PhoneFrame: React.FC<{
    /** The recording, placed under the status bar. */
    readonly children: React.ReactNode;
    /** Layers in whole-screen coordinates (spotlight, touches, wipes): drawn over everything. */
    readonly overlay?: React.ReactNode;
}> = ({ children, overlay }) => (
    <div style={{ position: 'relative', width: PHONE_W, height: PHONE_H }}>
        {/* Contact + ambient shadow. */}
        <div
            style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 96,
                boxShadow: '0 60px 120px rgba(13,43,62,0.35), 0 18px 40px rgba(13,43,62,0.25)'
            }}
        />
        {[
            { left: -5, top: 260, h: 90 },
            { left: -5, top: 380, h: 150 },
            { left: -5, top: 550, h: 150 },
            { left: PHONE_W - 1, top: 420, h: 220 }
        ].map((b) => (
            <div
                key={`${b.left}-${b.top}`}
                style={{
                    position: 'absolute',
                    left: b.left,
                    top: b.top,
                    width: 6,
                    height: b.h,
                    borderRadius: 3,
                    background: 'linear-gradient(90deg,#3c4b56,#1c2a33)'
                }}
            />
        ))}
        <div
            style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 96,
                padding: BEZEL,
                background:
                    'linear-gradient(145deg,#4a5a66 0%,#16232c 30%,#0b141a 70%,#3a4954 100%)'
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: SCREEN_W,
                    height: SCREEN_H,
                    borderRadius: 80,
                    overflow: 'hidden',
                    background: BRAND.white
                }}
            >
                <StatusBar />
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: STATUS_H,
                        width: SCREEN_W,
                        height: SCREEN_H - STATUS_H
                    }}
                >
                    {children}
                </div>
                {overlay}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                            'linear-gradient(118deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 32%)',
                        pointerEvents: 'none'
                    }}
                />
            </div>
        </div>
    </div>
);
