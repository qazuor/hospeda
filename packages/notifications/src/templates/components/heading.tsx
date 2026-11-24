import { EmailTitle, SectionBar, type SectionBarTone } from '@repo/email';
import type React from 'react';

/**
 * Props for Heading component
 */
export interface HeadingProps {
    /** Heading text/content */
    children: React.ReactNode;
    /**
     * Draws the small section bar above the heading (HOS-2565 PR-4). Teal is the
     * default section accent; orange is the occasional one. Absent: no bar. The
     * first heading of a user mail needs none: it draws the teal bar and the
     * illustration itself (`EmailTitle`).
     */
    readonly accent?: SectionBarTone;
}

/**
 * Section heading component for email templates. Provides consistent styling for
 * headings across all email types; in a user mail the first one becomes the title
 * row with the section bar and the illustration beside it.
 *
 * @param props - The heading text and its optional accent bar.
 * @returns The heading.
 */
export function Heading({ children, accent }: HeadingProps) {
    return (
        <>
            {accent ? (
                <SectionBar
                    tone={accent}
                    spaceAbove={16}
                    spaceBelow={10}
                />
            ) : null}
            <EmailTitle style={styles.heading}>{children}</EmailTitle>
        </>
    );
}

const styles = {
    heading: {
        color: '#1e293b',
        fontSize: '24px',
        fontWeight: '700',
        lineHeight: '32px',
        margin: '0 0 16px',
        padding: '0'
    }
};
