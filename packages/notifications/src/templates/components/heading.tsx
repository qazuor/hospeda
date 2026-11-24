import { Heading as EmailHeading } from '@react-email/components';
import { SectionBar, type SectionBarTone } from '@repo/email';
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
     * first heading of a mail needs none: the user layout already draws it.
     */
    readonly accent?: SectionBarTone;
}

/**
 * Section heading component for email templates
 * Provides consistent styling for headings across all email types
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
            <EmailHeading style={styles.heading}>{children}</EmailHeading>
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
