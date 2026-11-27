import { createBrandIcon } from '../../create-brand-icon';

/**
 * American Express wordmark (stroked "AMEX" inside an outlined pill).
 *
 * The upstream simpleicons mark is a full-bleed square whose letters are thin
 * cut-outs, which collapses into an illegible grey box at footer size
 * (HOS-2666 / CARD-100). This hand-drawn vector uses 2-unit strokes on a
 * 48x24 canvas so it stays crisp at 44px, and inherits `currentColor` like
 * the other payment marks. The 2:1 viewBox letterboxes inside the square
 * box the footer sizes every payment mark with.
 */
export const AmericanExpressIcon = createBrandIcon(
    <g
        fill="none"
        stroke="currentColor"
        strokeLinejoin="miter"
    >
        <rect
            x="1"
            y="1"
            width="46"
            height="22"
            rx="4"
            strokeWidth="1.5"
        />
        <g strokeWidth="2.2">
            <path d="M8.5 17 12 7l3.5 10M9.9 13.5h4.2" />
            <path d="M17.5 17V7l3.5 5.5L24.5 7v10" />
            <path d="M32 7h-4.5v10H32M27.5 12H31" />
            <path d="M34 7l6 10M40 7l-6 10" />
        </g>
    </g>,
    'American Express',
    { viewBox: '0 0 48 24' }
);
