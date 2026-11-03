import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Resolved copy shown after a Partner application is rejected. */
export interface PartnerApplicationRejectedProps {
    readonly preview: string;
    readonly heading: string;
    readonly paragraphs: readonly string[];
}

/** Email communicating that a Partner application was rejected. */
export function PartnerApplicationRejected({
    preview,
    heading,
    paragraphs
}: PartnerApplicationRejectedProps) {
    return (
        <EmailLayout previewText={preview}>
            <Heading>{heading}</Heading>
            {paragraphs.map((paragraph) => (
                <Text key={paragraph}>{paragraph}</Text>
            ))}
        </EmailLayout>
    );
}
