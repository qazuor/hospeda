import { Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Resolved copy and link shown when an approved Partner needs to be claimed. */
export interface PartnerClaimNoticeProps {
    readonly preview: string;
    readonly heading: string;
    readonly paragraphs: readonly string[];
    readonly cta: string;
    readonly claimUrl: string;
}

/** Email that lets the recipient claim an approved Partner. */
export function PartnerClaimNotice({
    preview,
    heading,
    paragraphs,
    cta,
    claimUrl
}: PartnerClaimNoticeProps) {
    return (
        <EmailLayout previewText={preview}>
            <Heading>{heading}</Heading>
            {paragraphs.map((paragraph) => (
                <Text key={paragraph}>{paragraph}</Text>
            ))}
            <Button href={claimUrl}>{cta}</Button>
        </EmailLayout>
    );
}
