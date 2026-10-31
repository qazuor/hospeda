import type React from 'react';
import {
    AbsoluteFill,
    Img,
    interpolate,
    spring,
    staticFile,
    useCurrentFrame,
    useVideoConfig
} from 'remotion';
import { BRAND, headingFont } from './brand';

/**
 * Layered sky: gradient, a slow sun, two rows of hills and soft light blobs. Each layer moves by a
 * different fraction of `parallax` (camera travel), which gives the scene depth when the phone moves.
 */
export const Backdrop: React.FC<{
    readonly parallax: { readonly x: number; readonly y: number };
}> = ({ parallax }) => {
    const frame = useCurrentFrame();
    const drift = Math.sin(frame / 90) * 14;
    const layer = (k: number): string => `translate(${parallax.x * k}px, ${parallax.y * k}px)`;
    return (
        <AbsoluteFill
            style={{
                background: `linear-gradient(180deg, #F7FBFD 0%, ${BRAND.sky} 45%, #D6EEF8 100%)`,
                overflow: 'hidden'
            }}
        >
            <div style={{ position: 'absolute', inset: -200, transform: layer(0.08) }}>
                <div
                    style={{
                        position: 'absolute',
                        width: 1000,
                        height: 1000,
                        left: -420 + drift,
                        top: 300,
                        borderRadius: '50%',
                        background: BRAND.blue,
                        opacity: 0.14,
                        filter: 'blur(70px)'
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        width: 800,
                        height: 800,
                        right: -360,
                        top: -120 - drift,
                        borderRadius: '50%',
                        background: BRAND.orange,
                        opacity: 0.12,
                        filter: 'blur(80px)'
                    }}
                />
            </div>
            <svg
                aria-hidden="true"
                width={1400}
                height={760}
                viewBox="0 0 1400 760"
                style={{
                    position: 'absolute',
                    left: -160,
                    bottom: -40,
                    transform: layer(0.16),
                    filter: 'blur(2px)'
                }}
            >
                <path
                    d="M0 330 C 300 200, 560 380, 820 290 S 1220 210, 1400 260 L1400 760 L0 760 Z"
                    fill={BRAND.green}
                    opacity={0.32}
                />
            </svg>
            <svg
                aria-hidden="true"
                width={1400}
                height={600}
                viewBox="0 0 1400 600"
                style={{ position: 'absolute', left: -160, bottom: -60, transform: layer(0.3) }}
            >
                <path
                    d="M0 330 C 340 230, 640 380, 940 300 S 1260 250, 1400 280 L1400 600 L0 600 Z"
                    fill={BRAND.teal}
                    opacity={0.2}
                />
            </svg>
            {/* Vignette keeps the eye on the centre. */}
            <AbsoluteFill
                style={{
                    background:
                        'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(13,43,62,0.10) 100%)'
                }}
            />
        </AbsoluteFill>
    );
};

/** Words that rise in one after another, with a slight overshoot. */
export const KineticText: React.FC<{
    readonly text: string;
    readonly at: number;
    readonly size: number;
    readonly color?: string;
    readonly stagger?: number;
    readonly out?: number;
}> = ({ text, at, size, color = BRAND.ink, stagger = 3, out }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const leave =
        out === undefined
            ? 0
            : interpolate(frame, [out, out + 8], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp'
              });
    const lines = text.split('\n');
    let index = 0;
    return (
        <div
            style={{
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: size,
                lineHeight: 1.04,
                color,
                textAlign: 'center'
            }}
        >
            {lines.map((line) => (
                <div
                    key={line}
                    style={{ overflow: 'hidden', paddingBottom: size * 0.12 }}
                >
                    {line.split(' ').map((word) => {
                        const s = spring({
                            frame: frame - at - index++ * stagger,
                            fps,
                            config: { damping: 13, stiffness: 170 }
                        });
                        return (
                            <span
                                key={`${word}-${index}`}
                                style={{
                                    display: 'inline-block',
                                    marginRight: size * 0.25,
                                    transform: `translateY(${(1 - s) * size * 1.1 - leave * size * 1.2}px)`,
                                    opacity: Math.min(1, s * 1.4) * (1 - leave)
                                }}
                            >
                                {word}
                            </span>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

/** Persistent step indicator (top-left, glass): "1/3 · Datos básicos". Animates when it changes. */
export const StepChip: React.FC<{
    readonly step: string;
    readonly label: string;
    readonly since: number;
    readonly visible: number;
}> = ({ step, label, since, visible }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const s = spring({ frame: frame - since, fps, config: { damping: 14, stiffness: 160 } });
    return (
        <div
            style={{
                position: 'absolute',
                top: 64,
                left: 56,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '12px 28px 12px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(14px)',
                boxShadow: '0 12px 30px rgba(13,43,62,0.16)',
                opacity: visible,
                transform: `translateY(${(1 - visible) * -30}px)`
            }}
        >
            <div
                style={{
                    width: 74,
                    height: 54,
                    borderRadius: 999,
                    background: BRAND.orange,
                    color: BRAND.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: headingFont,
                    fontWeight: 700,
                    fontSize: 28,
                    transform: `scale(${0.7 + s * 0.3})`
                }}
            >
                {step}
            </div>
            <div
                style={{
                    fontFamily: headingFont,
                    fontWeight: 700,
                    fontSize: 34,
                    color: BRAND.ink,
                    opacity: s,
                    transform: `translateX(${(1 - s) * 16}px)`
                }}
            >
                {label}
            </div>
        </div>
    );
};

/** Hospeda logo mark + URL pill + slogan for the closing. */
export const ClosingCard: React.FC<{ readonly at: number }> = ({ at }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const logo = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 140 } });
    const pill = spring({ frame: frame - at - 16, fps, config: { damping: 13 } });
    const slogan = interpolate(frame, [at + 24, at + 36], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp'
    });
    return (
        <div
            style={{
                position: 'absolute',
                top: 110,
                left: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 22
            }}
        >
            <Img
                src={staticFile('brand/logo.png')}
                style={{ width: 150, transform: `scale(${logo}) rotate(${(1 - logo) * -25}deg)` }}
            />
            <KineticText
                text={'Publicá tu\nalojamiento'}
                at={at + 6}
                size={92}
            />
            <div
                style={{
                    padding: '16px 44px',
                    borderRadius: 999,
                    background: BRAND.blue,
                    color: BRAND.white,
                    fontFamily: headingFont,
                    fontWeight: 700,
                    fontSize: 56,
                    boxShadow: '0 14px 30px rgba(58,167,217,0.35)',
                    transform: `scale(${pill})`
                }}
            >
                hospeda.com.ar
            </div>
            <div
                style={{
                    fontFamily: headingFont,
                    fontWeight: 500,
                    fontSize: 36,
                    color: BRAND.ink,
                    opacity: slogan * 0.85
                }}
            >
                Todo tu viaje, en un solo lugar.
            </div>
        </div>
    );
};
