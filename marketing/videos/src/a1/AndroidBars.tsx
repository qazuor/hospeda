/**
 * The system and browser bars of the reference phone (config/device.ts), drawn in editing:
 * the recording is only the page area, and these complete the 892 CSS px of the screen.
 * Minimal and always identical, per REGLAS.md («Dispositivo de referencia»).
 */
import type React from 'react';
import { bodyFont } from './brand';

const INK = '#1b1b1f';
const MUTED = '#5f6368';

/** Props shared by the three bars: their height and the CSS → composition px scale. */
export type BarProps = {
    /** Height of the bar in composition px. */
    readonly height: number;
    /** Composition px per CSS px, used to size icons and text like the real phone. */
    readonly unit: number;
};

/**
 * Android status bar: clock on the left, signal / wifi / battery on the right, and the
 * centred punch-hole camera of the S24 Ultra. No notification icons (they read as clutter).
 */
export const AndroidStatusBar: React.FC<BarProps> = ({ height, unit }) => {
    const hole = 13 * unit;
    return (
        <div
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height,
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `0 ${18 * unit}px`,
                fontFamily: bodyFont,
                fontWeight: 500,
                fontSize: 13 * unit,
                color: INK
            }}
        >
            <span>10:30</span>
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: (height - hole) / 2,
                    width: hole,
                    height: hole,
                    marginLeft: -hole / 2,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 40% 38%, #2a3238 0%, #050607 55%)'
                }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 * unit }}>
                <svg
                    aria-hidden="true"
                    width={16 * unit}
                    height={12 * unit}
                    viewBox="0 0 16 12"
                >
                    <path
                        d="M8 11.5 L0.6 3.6 A10.6 10.6 0 0 1 15.4 3.6 Z"
                        fill={INK}
                    />
                </svg>
                <svg
                    aria-hidden="true"
                    width={13 * unit}
                    height={12 * unit}
                    viewBox="0 0 13 12"
                >
                    <path
                        d="M12.5 0.5 V11.5 H1.5 Z"
                        fill={INK}
                    />
                </svg>
                <svg
                    aria-hidden="true"
                    width={24 * unit}
                    height={12 * unit}
                    viewBox="0 0 24 12"
                >
                    <rect
                        x={0.75}
                        y={1.25}
                        width={20}
                        height={9.5}
                        rx={2.5}
                        stroke={INK}
                        strokeWidth={1.2}
                        fill="none"
                    />
                    <rect
                        x={2.5}
                        y={3}
                        width={16.5}
                        height={6}
                        rx={1.2}
                        fill={INK}
                    />
                    <rect
                        x={21.6}
                        y={4.2}
                        width={1.6}
                        height={3.6}
                        rx={0.6}
                        fill={INK}
                    />
                </svg>
            </div>
        </div>
    );
};

/** Chrome for Android address bar: home, the URL pill, the tab counter and the menu. */
export const ChromeAddressBar: React.FC<
    BarProps & { readonly top: number; readonly host: string }
> = ({ height, unit, top, host }) => (
    <div
        style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top,
            height,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 10 * unit,
            padding: `0 ${10 * unit}px`,
            fontFamily: bodyFont,
            color: INK,
            borderBottom: `${Math.max(1, unit * 0.6)}px solid #e3e3e3`,
            boxSizing: 'border-box'
        }}
    >
        <svg
            aria-hidden="true"
            width={20 * unit}
            height={20 * unit}
            viewBox="0 0 20 20"
        >
            <path
                d="M3 9 L10 3 L17 9 V17 H12 V12 H8 V17 H3 Z"
                stroke={MUTED}
                strokeWidth={1.6}
                strokeLinejoin="round"
                fill="none"
            />
        </svg>
        <div
            style={{
                flex: 1,
                height: 38 * unit,
                borderRadius: 19 * unit,
                background: '#f1f3f4',
                display: 'flex',
                alignItems: 'center',
                gap: 8 * unit,
                padding: `0 ${12 * unit}px`,
                fontSize: 15 * unit
            }}
        >
            <svg
                aria-hidden="true"
                width={14 * unit}
                height={14 * unit}
                viewBox="0 0 14 14"
            >
                <path
                    d="M2 4 H12 M2 10 H12"
                    stroke={MUTED}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                />
                <circle
                    cx={5}
                    cy={4}
                    r={1.8}
                    fill="#f1f3f4"
                    stroke={MUTED}
                    strokeWidth={1.4}
                />
                <circle
                    cx={9}
                    cy={10}
                    r={1.8}
                    fill="#f1f3f4"
                    stroke={MUTED}
                    strokeWidth={1.4}
                />
            </svg>
            <span>{host}</span>
        </div>
        <div
            style={{
                width: 18 * unit,
                height: 18 * unit,
                border: `${1.6 * unit}px solid ${MUTED}`,
                borderRadius: 4 * unit,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10 * unit,
                fontWeight: 700,
                color: MUTED
            }}
        >
            1
        </div>
        <svg
            aria-hidden="true"
            width={6 * unit}
            height={20 * unit}
            viewBox="0 0 6 20"
        >
            {[4, 10, 16].map((cy) => (
                <circle
                    key={cy}
                    cx={3}
                    cy={cy}
                    r={1.7}
                    fill={MUTED}
                />
            ))}
        </svg>
    </div>
);

/** Android three-button navigation bar in the Samsung order: recents, home, back. */
export const AndroidNavBar: React.FC<BarProps> = ({ height, unit }) => (
    <div
        style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: `0 ${40 * unit}px`
        }}
    >
        <svg
            aria-hidden="true"
            width={18 * unit}
            height={18 * unit}
            viewBox="0 0 18 18"
        >
            <path
                d="M4 3 V15 M9 3 V15 M14 3 V15"
                stroke={MUTED}
                strokeWidth={1.8}
                strokeLinecap="round"
            />
        </svg>
        <svg
            aria-hidden="true"
            width={18 * unit}
            height={18 * unit}
            viewBox="0 0 18 18"
        >
            <rect
                x={2.5}
                y={2.5}
                width={13}
                height={13}
                rx={4.5}
                stroke={MUTED}
                strokeWidth={1.8}
                fill="none"
            />
        </svg>
        <svg
            aria-hidden="true"
            width={18 * unit}
            height={18 * unit}
            viewBox="0 0 18 18"
        >
            <path
                d="M11.5 3 L5.5 9 L11.5 15"
                stroke={MUTED}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </svg>
    </div>
);
