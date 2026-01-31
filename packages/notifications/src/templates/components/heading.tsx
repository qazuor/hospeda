import { Heading as EmailHeading } from '@react-email/components';
import type React from 'react';

/**
 * Props for Heading component
 */
export interface HeadingProps {
    /** Heading text/content */
    children: React.ReactNode;
}

/**
 * Section heading component for email templates
 * Provides consistent styling for headings across all email types
 */
export function Heading({ children }: HeadingProps) {
    return <EmailHeading style={styles.heading}>{children}</EmailHeading>;
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
