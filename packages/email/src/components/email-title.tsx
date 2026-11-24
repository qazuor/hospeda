/**
 * The first title of a USER mail (HOS-2565 PR-4): the teal section bar above it and
 * the declared illustration to its right, on the same row and vertically centered,
 * as in the approved mockup.
 *
 * The user layout opens a slot per render; the first `EmailTitle` that renders claims
 * it and draws the bar and the illustration. Every later `EmailTitle`, and every one
 * rendered outside the user layout (the staff layout opens no slot), is a plain
 * heading. Templates never pass the illustration: it comes from the catalog through
 * the layout context.
 *
 * @module components/email-title
 */

import { Heading } from '@react-email/components';
import {
    type CSSProperties,
    createContext,
    type ReactElement,
    type ReactNode,
    useContext
} from 'react';
import { resolveEmailAssetUrl } from '../email-assets.js';
import {
    EMAIL_ILLUSTRATION_PATHS,
    type EmailIllustration
} from '../templates/user-layout/user-assets.js';
import { EMAIL_USER_CLASSES } from '../templates/user-layout/user-styles.js';
import { SectionBar } from './section-bar.js';

/** Rendered illustration size (84px on narrow screens through the style block). */
const ILLUSTRATION_SIZE = 112;

/** The per-render slot the user layout opens. */
export interface EmailTitleSlot {
    /** Illustration the mail declares, if any. */
    readonly illustration?: EmailIllustration;
    /** Returns `true` once, for the first title that asks. */
    readonly claim: () => boolean;
}

/** Context the user layout fills with a fresh slot per render; `null` elsewhere. */
export const EmailTitleSlotContext = createContext<EmailTitleSlot | null>(null);

/**
 * Opens a fresh title slot (called by the user layout once per render).
 *
 * @param input - The declared illustration, if any.
 * @returns The slot.
 */
export function createEmailTitleSlot(input: {
    readonly illustration?: EmailIllustration;
}): EmailTitleSlot {
    let claimed = false;
    return {
        ...(input.illustration ? { illustration: input.illustration } : {}),
        claim: () => {
            if (claimed) return false;
            claimed = true;
            return true;
        }
    };
}

/** Props of {@link EmailTitle}. */
export interface EmailTitleProps {
    readonly children: ReactNode;
    /** Inline style of the heading itself (the template's typography). */
    readonly style?: CSSProperties;
}

/**
 * Renders a mail title. The first one in a user mail carries the section bar and the
 * illustration; any other is a plain heading.
 *
 * @param props - The title and its heading style.
 * @returns The title element.
 */
export function EmailTitle({ children, style }: EmailTitleProps): ReactElement {
    const slot = useContext(EmailTitleSlotContext);
    if (!slot?.claim()) return <Heading style={style}>{children}</Heading>;

    return (
        <table
            role="presentation"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            border={0}
            className={EMAIL_USER_CLASSES.title}
            data-email-title="true"
        >
            <tbody>
                <tr>
                    <td style={titleCellStyle}>
                        <SectionBar spaceBelow={12} />
                        {/* Margin lives in the spacer row: a heading margin would pull the
                            illustration off the vertical centre. */}
                        <Heading style={{ ...style, margin: '0' }}>{children}</Heading>
                    </td>
                    {slot.illustration ? (
                        <td
                            width={ILLUSTRATION_SIZE}
                            align="right"
                            className={EMAIL_USER_CLASSES.illustrationCell}
                            style={illustrationCellStyle}
                            data-email-illustration={slot.illustration}
                            data-skip-in-text="true"
                        >
                            <img
                                className={EMAIL_USER_CLASSES.illustration}
                                src={resolveEmailAssetUrl({
                                    path: EMAIL_ILLUSTRATION_PATHS[slot.illustration]
                                })}
                                width={ILLUSTRATION_SIZE}
                                height={ILLUSTRATION_SIZE}
                                alt=""
                                style={illustrationStyle}
                            />
                        </td>
                    ) : null}
                </tr>
                <tr>
                    <td
                        colSpan={slot.illustration ? 2 : 1}
                        height={TITLE_SPACE_BELOW}
                        style={spacerStyle}
                    >
                        &nbsp;
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

/** Space between the title row and the copy below it. */
const TITLE_SPACE_BELOW = 16;

const spacerStyle = {
    fontSize: '0',
    height: `${TITLE_SPACE_BELOW}px`,
    lineHeight: '0'
};

const titleCellStyle = {
    verticalAlign: 'middle' as const
};

const illustrationCellStyle = {
    paddingLeft: '16px',
    verticalAlign: 'middle' as const,
    width: `${ILLUSTRATION_SIZE}px`
};

const illustrationStyle = {
    border: '0',
    display: 'block',
    height: `${ILLUSTRATION_SIZE}px`,
    width: `${ILLUSTRATION_SIZE}px`
};
