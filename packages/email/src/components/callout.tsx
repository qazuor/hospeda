import { Text } from '@react-email/components';
import { emailPalette } from '@repo/design-tokens';
import type { ReactElement, ReactNode } from 'react';
import { resolveEmailAssetUrl } from '../email-assets.js';
import { EMAIL_USER_ASSET_PATHS } from '../templates/user-layout/user-assets.js';
import { EMAIL_USER_CLASSES } from '../templates/user-layout/user-styles.js';

/** Visual tone of a {@link Callout}. */
export type CalloutTone = 'info' | 'success' | 'warning' | 'danger';

/**
 * Props for {@link Callout}.
 */
export interface CalloutProps {
    /** Semantic tone. Picks the tinted background, the 4px border and the text color. */
    readonly tone: CalloutTone;
    /** Optional bold first line. */
    readonly title?: string;
    /**
     * Callout content. A plain string is wrapped in a margin-free `Text`; any other
     * node (for example several `Text`) is rendered as is and keeps its own margins.
     */
    readonly children: ReactNode;
}

/**
 * The three palette roles of one tone, resolved from `emailPalette`.
 */
interface ToneColors {
    readonly background: string;
    readonly border: string;
    readonly text: string;
}

/** Line icon of each tone (ⓘ ✓ ⚠ ✕), drawn in the tone's border color, and its dark-mode class. */
const TONE_DECOR: Readonly<
    Record<CalloutTone, { readonly icon: `/email/${string}`; readonly className: string }>
> = {
    info: { icon: EMAIL_USER_ASSET_PATHS.calloutInfo, className: EMAIL_USER_CLASSES.calloutInfo },
    success: {
        icon: EMAIL_USER_ASSET_PATHS.calloutSuccess,
        className: EMAIL_USER_CLASSES.calloutSuccess
    },
    warning: {
        icon: EMAIL_USER_ASSET_PATHS.calloutWarning,
        className: EMAIL_USER_CLASSES.calloutWarning
    },
    danger: {
        icon: EMAIL_USER_ASSET_PATHS.calloutDanger,
        className: EMAIL_USER_CLASSES.calloutDanger
    }
};

/** Rendered icon size in CSS pixels (the PNG is 2x). */
const ICON_SIZE = 20;

const TONE_COLORS: Readonly<Record<CalloutTone, ToneColors>> = {
    info: {
        background: emailPalette.calloutInfoBackground,
        border: emailPalette.calloutInfoBorder,
        text: emailPalette.calloutInfoText
    },
    success: {
        background: emailPalette.calloutSuccessBackground,
        border: emailPalette.calloutSuccessBorder,
        text: emailPalette.calloutSuccessText
    },
    warning: {
        background: emailPalette.calloutWarningBackground,
        border: emailPalette.calloutWarningBorder,
        text: emailPalette.calloutWarningText
    },
    danger: {
        background: emailPalette.calloutDangerBackground,
        border: emailPalette.calloutDangerBorder,
        text: emailPalette.calloutDangerText
    }
};

/**
 * Shared callout box for every Hospeda email (HOS-2565 D3).
 *
 * Always a visible tinted background plus a 6px left border, from the
 * `emailPalette` callout roles, and a small line icon in the tone's border color
 * (HOS-2565 PR-4; the icon cell is skipped in the text part). Every visual style sits on the single `<td>` (Outlook
 * desktop ignores most table-level styling and `border-radius`, which then
 * degrades to square corners); the vertical spacing sits in a wrapper cell's padding
 * because Outlook ignores table margins. The `<td>` carries `data-callout-tone` so tests
 * and the static guard can count callouts.
 *
 * @param props - Tone, optional title and content.
 * @returns The callout element.
 *
 * @example
 * ```tsx
 * <Callout tone="warning" title="Tu pago no se pudo procesar">
 *     Actualizá tu medio de pago antes del 12/12.
 * </Callout>
 * ```
 */
export function Callout({ tone, title, children }: CalloutProps): ReactElement {
    const colors = TONE_COLORS[tone];
    const decor = TONE_DECOR[tone];
    const cellStyle = {
        backgroundColor: colors.background,
        borderLeft: `6px solid ${colors.border}`,
        borderRadius: '8px',
        color: colors.text,
        fontSize: '14px',
        lineHeight: '22px',
        padding: '16px 20px 16px 16px'
    };

    return (
        <table
            role="presentation"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            border={0}
        >
            <tbody>
                <tr>
                    <td style={spacerCellStyle}>
                        <table
                            role="presentation"
                            width="100%"
                            cellPadding={0}
                            cellSpacing={0}
                            border={0}
                            style={tableStyle}
                        >
                            <tbody>
                                <tr>
                                    <td
                                        data-callout-tone={tone}
                                        className={decor.className}
                                        style={cellStyle}
                                    >
                                        <table
                                            role="presentation"
                                            width="100%"
                                            cellPadding={0}
                                            cellSpacing={0}
                                            border={0}
                                        >
                                            <tbody>
                                                <tr>
                                                    <td
                                                        width={ICON_SIZE}
                                                        data-skip-in-text="true"
                                                        style={iconCellStyle}
                                                    >
                                                        <img
                                                            src={resolveEmailAssetUrl({
                                                                path: decor.icon
                                                            })}
                                                            width={ICON_SIZE}
                                                            height={ICON_SIZE}
                                                            alt=""
                                                            style={iconStyle}
                                                        />
                                                    </td>
                                                    <td
                                                        style={{
                                                            ...contentCellStyle,
                                                            color: colors.text
                                                        }}
                                                    >
                                                        {title ? (
                                                            <Text style={titleStyle}>{title}</Text>
                                                        ) : null}
                                                        {typeof children === 'string' ? (
                                                            <Text style={textStyle}>
                                                                {children}
                                                            </Text>
                                                        ) : (
                                                            children
                                                        )}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

/**
 * Outlook desktop (Word) drops table margins, so consecutive callouts would fuse into
 * one block. The vertical spacing lives in the padding of this wrapper cell instead:
 * 12px above and below, which gives 24px between two stacked callouts.
 */
const spacerCellStyle = {
    padding: '12px 0'
};

const tableStyle = {
    borderCollapse: 'separate' as const
};

const iconCellStyle = {
    padding: '1px 12px 0 0',
    verticalAlign: 'top' as const,
    width: `${ICON_SIZE}px`
};

const iconStyle = {
    border: '0',
    display: 'block'
};

const contentCellStyle = {
    verticalAlign: 'top' as const
};

const titleStyle = {
    fontSize: '14px',
    fontWeight: '700',
    lineHeight: '22px',
    margin: '0 0 4px'
};

const textStyle = {
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0'
};
