import { Text } from '@react-email/components';
import { emailPalette } from '@repo/design-tokens';
import type { ReactElement, ReactNode } from 'react';

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
 * Always a visible tinted background plus a 4px left border, from the
 * `emailPalette` callout roles. Every visual style sits on the single `<td>` (Outlook
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
    const cellStyle = {
        backgroundColor: colors.background,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: '8px',
        color: colors.text,
        fontSize: '14px',
        lineHeight: '22px',
        padding: '16px 20px'
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
                                        style={cellStyle}
                                    >
                                        {title ? <Text style={titleStyle}>{title}</Text> : null}
                                        {typeof children === 'string' ? (
                                            <Text style={textStyle}>{children}</Text>
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
