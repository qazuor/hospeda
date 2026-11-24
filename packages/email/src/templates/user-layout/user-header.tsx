/**
 * Header of the USER email layout (HOS-2565 PR-4). The section bar and the
 * illustration sit beside the first title instead (`components/email-title.tsx`).
 *
 * @module templates/user-layout/user-header
 */

import { Column, Row } from '@react-email/components';
import { emailPalette } from '@repo/design-tokens';
import type { ReactElement } from 'react';
import { resolveEmailAssetUrl, resolveEmailIsotipoUrl } from '../../email-assets.js';
import { EMAIL_USER_ASSET_PATHS } from './user-assets.js';
import { EMAIL_USER_CLASSES } from './user-styles.js';

/** Rendered isotipo size next to the wordmark (the asset is 89x96). */
const ISOTIPO_WIDTH = 44;
const ISOTIPO_HEIGHT = 48;

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
