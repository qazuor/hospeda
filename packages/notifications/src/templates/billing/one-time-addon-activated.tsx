import { Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Resolved copy, base URL and locale of the one-time add-on activated mail (HOS-2405). */
export interface OneTimeAddonActivatedProps {
    readonly preview: string;
    readonly heading: string;
    readonly paragraphs: readonly string[];
    readonly cta: string;
    readonly baseUrl: string;
    readonly locale: 'es' | 'en' | 'pt';
}

/**
 * Tells the owner that the one-time add-on they bought on the payment page is active, naming
 * the add-on, the listing and the expiry, and links to their add-ons page.
 */
export function OneTimeAddonActivated({
    preview,
    heading,
    paragraphs,
    cta,
    baseUrl,
    locale
}: OneTimeAddonActivatedProps) {
    return (
        <EmailLayout previewText={preview}>
            <Heading>{heading}</Heading>
            {paragraphs.map((paragraph) => (
                <Text key={paragraph}>{paragraph}</Text>
            ))}
            <Button href={`${baseUrl}/${locale}/mi-cuenta/complementos/`}>{cta}</Button>
        </EmailLayout>
    );
}
