import { Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Resolved copy, base URL and locale of the manual installment opened mail (HOS-2130). */
export interface ManualInstallmentOpenedProps {
    readonly preview: string;
    readonly heading: string;
    readonly paragraphs: readonly string[];
    readonly cta: string;
    readonly baseUrl: string;
    readonly locale: 'es' | 'en' | 'pt';
}

/** Tells the owner that a manual installment is open and links to their partner account page. */
export function ManualInstallmentOpened({
    preview,
    heading,
    paragraphs,
    cta,
    baseUrl,
    locale
}: ManualInstallmentOpenedProps) {
    return (
        <EmailLayout previewText={preview}>
            <Heading>{heading}</Heading>
            {paragraphs.map((paragraph) => (
                <Text key={paragraph}>{paragraph}</Text>
            ))}
            <Button href={`${baseUrl}/${locale}/mi-cuenta/partner/`}>{cta}</Button>
        </EmailLayout>
    );
}
