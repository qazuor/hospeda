import { emailPalette } from '@repo/design-tokens';
import type { ReactElement, ReactNode } from 'react';
import { EMAIL_USER_CLASSES } from '../templates/user-layout/user-styles.js';

/** Color of an {@link OptionCard}: green for the first choice, cyan for the second. */
export type OptionCardTone = 'success' | 'info';

/** Props for {@link OptionCard}. */
export interface OptionCardProps {
    /** Stripe and band color. */
    readonly tone: OptionCardTone;
    /** Short label in the tinted band, rendered uppercase (e.g. "Opción 1"). */
    readonly label: string;
    /** Bold title under the band. */
    readonly title: string;
    /** Body: text and usually one `Button`. */
    readonly children: ReactNode;
}

interface ToneColors {
    readonly stripe: string;
    readonly band: string;
    readonly bandText: string;
    readonly bandClass: string;
}

const TONES: Readonly<Record<OptionCardTone, ToneColors>> = {
    success: {
        stripe: emailPalette.optionSuccessStripe,
        band: emailPalette.optionSuccessBand,
        bandText: emailPalette.optionSuccessBandText,
        bandClass: EMAIL_USER_CLASSES.optionBandSuccess
    },
    info: {
        stripe: emailPalette.optionInfoStripe,
        band: emailPalette.optionInfoBand,
        bandText: emailPalette.optionInfoBandText,
        bandClass: EMAIL_USER_CLASSES.optionBandInfo
    }
};

/**
 * One choice the reader can take, as a card with a 6px colored top stripe and a
 * tinted label band (HOS-2565 PR-4). Used where a mail offers alternatives
 * (`plan_downgrade_limit_warning`).
 *
 * Every style sits on `<td>`s for Outlook desktop; the vertical spacing is the
 * wrapper cell's padding, never a margin. Corners degrade to square in Outlook.
 *
 * @param props - Tone, band label, title and body.
 * @returns The card element.
 *
 * @example
 * ```tsx
 * <OptionCard tone="success" label="Opción 1" title="Actualizá tu plan">
 *     <Text>…</Text>
 *     <Button href={url}>Ver planes disponibles</Button>
 * </OptionCard>
 * ```
 */
export function OptionCard({ tone, label, title, children }: OptionCardProps): ReactElement {
    const colors = TONES[tone];
    return (
        <table
            role="presentation"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            border={0}
            data-option-card={tone}
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
                            className={EMAIL_USER_CLASSES.optionCard}
                            style={{ ...cardStyle, borderTop: `6px solid ${colors.stripe}` }}
                        >
                            <tbody>
                                <tr>
                                    <td
                                        className={colors.bandClass}
                                        style={{
                                            ...bandStyle,
                                            backgroundColor: colors.band,
                                            color: colors.bandText
                                        }}
                                    >
                                        {label.toUpperCase()}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={bodyCellStyle}>
                                        <h3 style={titleStyle}>{title}</h3>
                                        {children}
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

const spacerCellStyle = {
    padding: '10px 0'
};

const cardStyle = {
    border: `1px solid ${emailPalette.border}`,
    borderCollapse: 'separate' as const,
    borderRadius: '8px'
};

const bandStyle = {
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '1px',
    lineHeight: '16px',
    padding: '8px 22px'
};

const bodyCellStyle = {
    padding: '16px 22px 8px 22px'
};

const titleStyle = {
    color: emailPalette.text,
    fontSize: '18px',
    fontWeight: '700',
    lineHeight: '24px',
    margin: '0 0 8px 0'
};
