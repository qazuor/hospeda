# @repo/email

Email presentation and delivery for the Hospeda platform: the shared [React Email](https://react.email) layout, the HTML + text rendering used by every send path, and a [Brevo](https://www.brevo.com) transactional send.

See [CLAUDE.md](./CLAUDE.md) for the full guide.

## Public API

| Export | What it is |
|---|---|
| `EmailLayout` | The single layout every Hospeda email renders inside (`previewText?`, `children`, `footerLink?: 'preferences' \| 'none'`) |
| `EMAIL_PUBLIC_SITE_URL`, `EMAIL_LOGO_URL`, `EMAIL_LOGO_WIDTH`, `EMAIL_LOGO_HEIGHT`, `EMAIL_PREFERENCES_URL` | Absolute URLs and logo size used by the layout |
| `renderEmailBodies({ react })` | Renders `{ html, text }`, exactly what the provider receives |
| `createEmailClient({ apiKey, baseUrl? })` | Opaque Brevo client |
| `sendEmail({ client, to, subject, react, fromEmail?, fromName?, replyTo? })` | Sends through Brevo; never throws, returns `{ success, messageId?, error? }` |
| `VerifyEmailTemplate`, `ResetPasswordTemplate` | Auth templates |
| `VERIFY_EMAIL_SUBJECT`, `RESET_PASSWORD_EMAIL_SUBJECT` | Their subjects |

## Usage

```tsx
import { EmailLayout, renderEmailBodies } from '@repo/email';
import { Text } from '@react-email/components';

function MyEmail() {
    return (
        <EmailLayout previewText="Tu reserva fue confirmada">
            <Text>Contenido</Text>
        </EmailLayout>
    );
}

const { html, text } = await renderEmailBodies({ react: <MyEmail /> });
```

In `apps/api`, send through `sendAppEmail` (`apps/api/src/utils/email-sender.ts`), which adds the `[STAGING]` subject prefix outside production.

## Development

```bash
pnpm build      # tsup; @repo/notifications resolves this package through dist
pnpm test
pnpm typecheck
pnpm lint
```
