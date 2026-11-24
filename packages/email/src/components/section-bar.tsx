import { emailPalette } from '@repo/design-tokens';
import type { ReactElement } from 'react';

/** Color of a {@link SectionBar}: teal by default, orange as an occasional accent. */
export type SectionBarTone = 'teal' | 'orange';

/** Props for {@link SectionBar}. */
export interface SectionBarProps {
    /** @default 'teal' */
    readonly tone?: SectionBarTone;
    /** Space above the bar in px, as a spacer cell (Outlook ignores table margins). @default 0 */
    readonly spaceAbove?: number;
    /** Space between the bar and the title below it, in px. @default 0 */
    readonly spaceBelow?: number;
}

/** A fixed-height empty row: the only vertical spacing Outlook desktop honours here. */
function SpacerRow({ height }: { readonly height: number }): ReactElement {
    return (
        <tr>
            <td
                height={height}
                style={{ fontSize: '0', height: `${height}px`, lineHeight: `${height}px` }}
            >
                &nbsp;
            </td>
        </tr>
    );
}

const BAR_COLORS: Readonly<Record<SectionBarTone, string>> = {
    teal: emailPalette.accentTeal,
    orange: emailPalette.accentOrange
};

/**
 * The short colored bar the user layout draws above a section title (HOS-2565 PR-4).
 *
 * A 36x4 cell in its own table: Outlook desktop keeps the height because the cell
 * carries `height`, `line-height` and `font-size: 0`. Marked `data-skip-in-text`.
 *
 * @param props - The tone.
 * @returns The bar element.
 *
 * @example
 * ```tsx
 * <SectionBar tone="orange" />
 * ```
 */
export function SectionBar({
    tone = 'teal',
    spaceAbove = 0,
    spaceBelow = 0
}: SectionBarProps): ReactElement {
    return (
        <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            border={0}
            data-skip-in-text="true"
        >
            <tbody>
                {spaceAbove > 0 ? <SpacerRow height={spaceAbove} /> : null}
                <tr>
                    <td
                        width={36}
                        height={4}
                        style={{ ...barStyle, backgroundColor: BAR_COLORS[tone] }}
                    >
                        &nbsp;
                    </td>
                </tr>
                {spaceBelow > 0 ? <SpacerRow height={spaceBelow} /> : null}
            </tbody>
        </table>
    );
}

const barStyle = {
    borderRadius: '2px',
    fontSize: '0',
    height: '4px',
    lineHeight: '4px',
    width: '36px'
};
