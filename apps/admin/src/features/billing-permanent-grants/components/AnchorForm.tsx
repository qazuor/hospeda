import type { PermanentGrantAnchorBody } from '@repo/schemas';
import { GrantForm } from './GrantForm';

export function AnchorForm({
    userId,
    onPreview
}: {
    userId: string;
    onPreview: (body: PermanentGrantAnchorBody) => void;
}) {
    return (
        <GrantForm
            userId={userId}
            mode="anchor"
            onPreview={(body) => onPreview(body as PermanentGrantAnchorBody)}
        />
    );
}
