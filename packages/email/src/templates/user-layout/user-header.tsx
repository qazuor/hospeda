/**
 * Header and intro row of the USER email layout (HOS-2565 PR-4).
 *
 * @module templates/user-layout/user-header
 */

import { Column, Row } from '@react-email/components';
import { emailPalette } from '@repo/design-tokens';
import type { ReactElement } from 'react';
import { SectionBar } from '../../components/section-bar.js';
import { resolveEmailAssetUrl, resolveEmailIsotipoUrl } from '../../email-assets.js';
import {
    EMAIL_ILLUSTRATION_PATHS,
    EMAIL_USER_ASSET_PATHS,
    type EmailIllustration
} from './user-assets.js';
import { EMAIL_USER_CLASSES } from './user-styles.js';

/** Rendered isotipo size next to the wordmark (the asset is 89x96). */
const ISOTIPO_WIDTH = 44;
const ISOTIPO_HEIGHT = 48;

/** Rendered illustration size (84px on narrow screens through the style block). */
const ILLUSTRATION_SIZE = 112;

/** Shared font stack of the user layout. */
export const USER_FONT_STACK = 'Arial, Helvetica, sans-serif';

/**
 * The header: the blue-to-teal wave band, the isotipo next to the live "hospeda"
 * wordmark, and the "Descubrí el Litoral" tagline image. Skipped in the text part.
 *
 * The wordmark stays live text so the dark-mode block can turn it white; it is
 * never an image.
 *
 * @returns The header rows.
 */
export function UserHeader(): ReactElement {
    return (
        <>
            <Row data-skip-in-text="true">
                <Column style={waveCellStyle}>
                    <img
                        src={resolveEmailAssetUrl({ path: EMAIL_USER_ASSET_PATHS.headerWave })}
                        width={600}
                        alt=""
                        style={fluidImageStyle}
                    />
                </Column>
            </Row>
            <Row data-skip-in-text="true">
                <Column
                    align="center"
                    style={logoCellStyle}
                >
                    <table
                        role="img"
                        aria-label="Hospeda"
                        align="center"
                        cellPadding={0}
                        cellSpacing={0}
                        border={0}
                    >
                        <tbody>
                            <tr>
                                <td style={isotipoCellStyle}>
                                    <img
                                        src={resolveEmailIsotipoUrl()}
                                        width={ISOTIPO_WIDTH}
                                        height={ISOTIPO_HEIGHT}
                                        alt=""
                                        style={blockImageStyle}
                                    />
                                </td>
                                <td style={wordmarkCellStyle}>
                                    <span
                                        className={EMAIL_USER_CLASSES.wordmark}
                                        style={wordmarkStyle}
                                    >
                                        hospeda
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </Column>
            </Row>
            <Row data-skip-in-text="true">
                <Column
                    align="center"
                    style={taglineCellStyle}
                >
                    <img
                        src={resolveEmailAssetUrl({ path: EMAIL_USER_ASSET_PATHS.tagline })}
                        width={220}
                        height={44}
                        alt="Descubrí el Litoral"
                        style={{ ...blockImageStyle, margin: '0 auto' }}
                    />
                </Column>
            </Row>
        </>
    );
}

/** Props of {@link UserIntro}. */
export interface UserIntroProps {
    /** Illustration the mail declares, if any. */
    readonly illustration?: EmailIllustration;
}

/**
 * The row above the body copy: the teal section bar, sitting right above the mail's
 * first title, and the declared illustration on the right. Skipped in the text part.
 *
 * @param props - The optional illustration.
 * @returns The intro row.
 */
export function UserIntro({ illustration }: UserIntroProps): ReactElement {
    return (
        <Row data-skip-in-text="true">
            <Column
                className={EMAIL_USER_CLASSES.padded}
                style={introCellStyle}
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
                            <td style={barCellStyle}>
                                <SectionBar />
                            </td>
                            {illustration ? (
                                <td
                                    width={ILLUSTRATION_SIZE}
                                    align="right"
                                    style={illustrationCellStyle}
                                    data-email-illustration={illustration}
                                >
                                    <img
                                        className={EMAIL_USER_CLASSES.illustration}
                                        src={resolveEmailAssetUrl({
                                            path: EMAIL_ILLUSTRATION_PATHS[illustration]
                                        })}
                                        width={ILLUSTRATION_SIZE}
                                        height={ILLUSTRATION_SIZE}
                                        alt=""
                                        style={illustrationStyle}
                                    />
                                </td>
                            ) : null}
                        </tr>
                    </tbody>
                </table>
            </Column>
        </Row>
    );
}

const waveCellStyle = {
    fontSize: '0',
    lineHeight: '0'
};

const fluidImageStyle = {
    border: '0',
    display: 'block',
    height: 'auto',
    width: '100%'
};

const blockImageStyle = {
    border: '0',
    display: 'block'
};

const logoCellStyle = {
    padding: '14px 24px 0 24px',
    textAlign: 'center' as const
};

const isotipoCellStyle = {
    padding: '0 10px 0 0',
    verticalAlign: 'middle' as const
};

const wordmarkCellStyle = {
    verticalAlign: 'middle' as const
};

const wordmarkStyle = {
    color: emailPalette.brandStrong,
    fontFamily: USER_FONT_STACK,
    fontSize: '40px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
    lineHeight: `${ISOTIPO_HEIGHT}px`
};

const taglineCellStyle = {
    padding: '2px 24px 8px 24px',
    textAlign: 'center' as const
};

const introCellStyle = {
    padding: '28px 40px 0 40px'
};

const barCellStyle = {
    paddingBottom: '4px',
    verticalAlign: 'bottom' as const
};

const illustrationCellStyle = {
    paddingLeft: '12px',
    verticalAlign: 'middle' as const,
    width: `${ILLUSTRATION_SIZE}px`
};

const illustrationStyle = {
    border: '0',
    display: 'block',
    height: `${ILLUSTRATION_SIZE}px`,
    width: `${ILLUSTRATION_SIZE}px`
};
