import type React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { REFERENCE_DEVICE, type Size } from '../../config/device';
import { AndroidNavBar, AndroidStatusBar, ChromeAddressBar } from './AndroidBars';
import { BRAND } from './brand';
import type { Spot } from './timeline';

/** Phone screen width in composition px. */
export const SCREEN_W = 660;
/** Composition px per CSS px of the reference device (660 / 412). */
export const UNIT = SCREEN_W / REFERENCE_DEVICE.screen.width;
/** Screen height in composition px: the full 412 × 892 screen, so the frame keeps 19.5:9. */
export const SCREEN_H = Math.round(REFERENCE_DEVICE.screen.height * UNIT);
/** Android status bar height in composition px. */
export const STATUS_H = Math.round(REFERENCE_DEVICE.bars.status * UNIT);
/** Chrome address bar height in composition px. */
export const ADDRESS_H = Math.round(REFERENCE_DEVICE.bars.address * UNIT);
/** Android navigation bar height in composition px. */
export const NAV_H = Math.round(REFERENCE_DEVICE.bars.navigation * UNIT);
/** Top of the page area (below status + address bars), composition px from the screen top. */
export const PAGE_TOP = STATUS_H + ADDRESS_H;
/** Page area height in composition px: where the recording plays (412 × 750 CSS px). */
export const PAGE_H = SCREEN_H - PAGE_TOP - NAV_H;
/** Black glass between the titanium rim and the screen, composition px. */
export const BEZEL = 14;
/** Outer phone width in composition px (screen + bezel). */
export const PHONE_W = SCREEN_W + BEZEL * 2;
/** Outer phone height in composition px (screen + bezel). */
export const PHONE_H = SCREEN_H + BEZEL * 2;
/** Corner radius of the body: the S24 Ultra is nearly square-cornered. */
const BODY_RADIUS = 30;
const SCREEN_RADIUS = BODY_RADIUS - BEZEL + 2;

/** How a recording sits in the page area: recording px → composition px, plus its offset. */
export type RecordingFit = {
    /** Recording px → composition px. */
    readonly k: number;
    /** Left offset of the recording inside the page area, composition px. */
    readonly ox: number;
    /** Top offset of the recording inside the page area, composition px. */
    readonly oy: number;
    /** Drawn size of the recording, composition px. */
    readonly width: number;
    /** Drawn size of the recording, composition px. */
    readonly height: number;
};

/**
 * Fits a recording into the page area without cropping. A take recorded on the reference
 * viewport fills it exactly; an older take with another aspect is letterboxed (centred, with
 * white bands), so its event boxes still map with one uniform scale.
 *
 * @param input.size - Recording size in device pixels.
 * @returns `{ fit }` for {@link PhoneFrame}, {@link Spotlight} and {@link Touch}.
 */
export const fitRecording = ({ size }: { readonly size: Size }): { readonly fit: RecordingFit } => {
    const k = Math.min(SCREEN_W / size.width, PAGE_H / size.height);
    const width = size.width * k;
    const height = size.height * k;
    return { fit: { k, ox: (SCREEN_W - width) / 2, oy: (PAGE_H - height) / 2, width, height } };
};

/** Recording px → whole-screen composition px (what overlays use). */
const toScreen = (fit: RecordingFit, x: number, y: number): { x: number; y: number } => ({
    x: x * fit.k + fit.ox,
    y: y * fit.k + fit.oy + PAGE_TOP
});

/** Dims everything but the active field: a lit, rounded window with an orange outline. */
export const Spotlight: React.FC<{ readonly spot: Spot; readonly fit: RecordingFit }> = ({
    spot,
    fit
}) => {
    if (spot.a < 0.01 || spot.w < 1) return null;
    const pad = 16;
    const at = toScreen(fit, spot.x - pad, spot.y - pad);
    return (
        <div
            style={{
                position: 'absolute',
                left: at.x,
                top: at.y,
                width: (spot.w + pad * 2) * fit.k,
                height: (spot.h + pad * 2) * fit.k,
                borderRadius: 18,
                boxShadow: `0 0 0 3000px rgba(13,43,62,${0.38 * spot.a}), 0 0 0 4px rgba(245,166,35,${spot.a}), 0 0 26px 6px rgba(245,166,35,${0.45 * spot.a})`,
                pointerEvents: 'none'
            }}
        />
    );
};

/** Touch indicator: a soft white press with an orange ring that expands and fades. */
export const Touch: React.FC<{
    readonly x: number;
    readonly y: number;
    readonly at: number;
    readonly fit: RecordingFit;
}> = ({ x, y, at, fit }) => {
    const f = useCurrentFrame() - at;
    if (f < -6 || f > 20) return null;
    const press = interpolate(f, [-6, 0, 4, 20], [0, 1, 0.82, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp'
    });
    const ring = interpolate(f, [0, 20], [0.5, 1.7], { extrapolateLeft: 'clamp' });
    const ringA = interpolate(f, [0, 20], [0.9, 0], { extrapolateLeft: 'clamp' });
    const { x: cx, y: cy } = toScreen(fit, x, y);
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

/** Side keys of the S24 Ultra: volume rocker and power, both on the right edge. */
const KEYS: ReadonlyArray<{ readonly top: number; readonly h: number }> = [
    { top: 0.2, h: 0.13 },
    { top: 0.37, h: 0.07 }
];

/**
 * A believable Galaxy S24 Ultra: flat titanium rim, nearly square corners, thin black glass
 * bezel, right-side keys, centred punch-hole, Android status bar, Chrome address bar and
 * three-button navigation bar around the page area, glass highlight and deep shadow.
 */
export const PhoneFrame: React.FC<{
    /** The recording (or its stills), drawn in the page area at `fit`. */
    readonly children: React.ReactNode;
    /** Where the recording sits inside the page area. */
    readonly fit: RecordingFit;
    /** Layers in whole-screen coordinates (spotlight, touches, wipes): drawn over everything. */
    readonly overlay?: React.ReactNode;
}> = ({ children, fit, overlay }) => (
    <div style={{ position: 'relative', width: PHONE_W, height: PHONE_H }}>
        {/* Contact + ambient shadow. */}
        <div
            style={{
                position: 'absolute',
                inset: 0,
                borderRadius: BODY_RADIUS,
                boxShadow: '0 60px 120px rgba(13,43,62,0.35), 0 18px 40px rgba(13,43,62,0.25)'
            }}
        />
        {KEYS.map((key) => (
            <div
                key={key.top}
                style={{
                    position: 'absolute',
                    left: PHONE_W - 2,
                    top: key.top * PHONE_H,
                    width: 6,
                    height: key.h * PHONE_H,
                    borderRadius: 2,
                    background: 'linear-gradient(90deg,#8d9397,#5d6468)'
                }}
            />
        ))}
        {/* Titanium rim: flat, brushed, a hair lighter at the edges. */}
        <div
            style={{
                position: 'absolute',
                inset: 0,
                borderRadius: BODY_RADIUS,
                background:
                    'linear-gradient(90deg,#9aa0a4 0%,#6c7377 6%,#7d8488 50%,#6c7377 94%,#9aa0a4 100%)'
            }}
        />
        <div
            style={{
                position: 'absolute',
                inset: 4,
                borderRadius: BODY_RADIUS - 4,
                padding: BEZEL - 4,
                background: '#050607'
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: SCREEN_W,
                    height: SCREEN_H,
                    borderRadius: SCREEN_RADIUS,
                    overflow: 'hidden',
                    background: BRAND.white
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: PAGE_TOP,
                        width: SCREEN_W,
                        height: PAGE_H,
                        overflow: 'hidden',
                        background: BRAND.white
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: fit.ox,
                            top: fit.oy,
                            width: fit.width,
                            height: fit.height
                        }}
                    >
                        {children}
                    </div>
                </div>
                <AndroidStatusBar
                    height={STATUS_H}
                    unit={UNIT}
                />
                <ChromeAddressBar
                    top={STATUS_H}
                    height={ADDRESS_H}
                    unit={UNIT}
                    host="hospeda.com.ar"
                />
                <AndroidNavBar
                    height={NAV_H}
                    unit={UNIT}
                />
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
