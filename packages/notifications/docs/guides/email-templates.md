# Email Templates

## Overview

All email templates are built with [React Email](https://react.email/) components. They are server-rendered to HTML when sending, producing responsive emails that work across all major email clients.

## Template Organization

```
src/templates/
├── billing/
│   ├── purchase-confirmation.tsx     # Subscription/add-on purchase receipt
│   ├── payment-success.tsx           # Successful payment notification
│   ├── payment-failure.tsx           # Failed payment alert
│   ├── renewal-reminder.tsx          # Upcoming renewal reminder
│   └── plan-change-confirmation.tsx  # Plan upgrade/downgrade confirmation
├── addon/
│   ├── addon-expiration-warning.tsx  # Add-on expiring soon
│   ├── addon-expired.tsx             # Add-on expired
│   └── addon-renewal-confirmation.tsx # Add-on renewed
├── trial/
│   ├── trial-ending-reminder.tsx     # Trial ending soon
│   └── trial-expired.tsx             # Trial expired
├── admin/
│   ├── admin-payment-failure.tsx     # Payment failure alert for admins
│   └── admin-system-event.tsx        # System event notification
└── components/
    ├── heading.tsx   # Reusable heading component
    ├── button.tsx    # CTA button component
    └── info-row.tsx  # Key-value info row
```

## Shared Layout

All templates use `EmailLayout` from **`@repo/email`** (HOS-2519). It is the single layout for every Hospeda email, auth mails included; there is no layout inside this package anymore. It has two variants (HOS-2565 PR-4):

- **`variant="user"`** (default) .. The owner-approved design: wave header with the live "hospeda" wordmark and the "Descubrí el Litoral" tagline, a section bar plus the declared illustration above the body, and the rich footer (help, FAQ, channels, trust strip, social, small print with "Elegí qué correos recibís" and the D16 account link). Supports dark mode through one media block
- **`variant="staff"`** .. The HOS-2519 layout, frozen. The 13 staff templates (admin, contact/feedback, AI cost alert, billing ops, `listing-fix-reported`) pass it
- **Email-client-safe** .. `<html lang="es">`, inline styles with `emailPalette` hex colors, no flexbox/grid/CSS variables/SVG

Per-send layout data is declared in the catalog, not in templates: `src/catalog/layout-declarations.ts` maps each domain (and, when it does not fit, each key) to an illustration and 3-4 help article ids. The transport and the previewer pass it through `renderEmailBodies({ layout })`. `SendEmailInput.recipientVerticals` picks the D16 account link; without it the footer says "Gestioná tu cuenta".

```tsx
import { EmailLayout } from '@repo/email';

export function MyTemplate({ recipientName }: MyTemplateProps) {
  return (
    <EmailLayout previewText="Preview text for email client">
      <Heading>Hola {recipientName}</Heading>
      <Text>Email content here</Text>
    </EmailLayout>
  );
}
```

Full reference: [`packages/email/CLAUDE.md`](../../../email/CLAUDE.md).

## Shared Components

### EmailLayout

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `previewText` | `string` | Optional | Preview text shown in email client inbox (every template in this package sets it) |
| `children` | `ReactNode` | Required | Main email content |
| `variant` | `'user' \| 'staff'` | `'user'` | Staff mails pass `'staff'` |
| `footerLink` | `'preferences' \| 'none'` | `'preferences'` (user), `'none'` (staff) | User `'none'` hides the preferences and account links |

Readers who may have no account pass `footerLink="none"`: the 2 auth mails, the 5 anonymous conversation mails, the 3 newsletter mails, `alliance_claim_invite`, `partner-claim-notice` and `partner-application-rejected` (HOS-2565 §8.3, frozen by `email-catalog-layout.test.ts`). Every other user mail keeps the default. Never ship a `{{placeholder}}` href: nothing substitutes it.

For a section title after the first, `Heading accent="teal" | "orange"` draws the section bar. `OptionCard` (`@repo/email`) is the "Opción 1/2" card; today only `plan_downgrade_limit_warning` uses it.

### Button (CTA) and Callout

`Button` and `Callout` live in `@repo/email` (HOS-2565). Never hand-roll a callout box
(`borderLeft`, hex `backgroundColor`) or import `Button` from `@react-email/components`: the
`email-components.guard.test.ts` guard fails the build.

```tsx
import { Button, Callout } from '@repo/email';

// Content width on desktop, full width below 480px. It wraps itself in a centered block
// with vertical spacing, so do not add your own container.
<Button href="https://hospeda.com.ar/upgrade">Ver planes</Button>
<Button href={url} variant="secondary">Ver detalle</Button>

// tone: 'info' | 'success' | 'warning' | 'danger'. Tinted background plus a 4px left border.
<Callout tone="warning" title="Tu pago no se pudo procesar">
  Actualizá tu medio de pago antes del 12/12.
</Callout>
```

### InfoRow

```tsx
import { InfoRow } from '../components/info-row';

<InfoRow label="Plan" value="Premium" />
<InfoRow label="Monto" value="$5.000,00 ARS" />
<InfoRow label="Proximo cobro" value="4 de abril de 2026" />
```

## Email Subject Lines

Subjects are generated by `src/utils/subject-builder.ts` using patterns with `{variable}` placeholders:

| Type | Subject Pattern |
|------|----------------|
| `SUBSCRIPTION_PURCHASE` | `Confirmacion de compra - {planName}` |
| `ADDON_PURCHASE` | `Add-on adquirido - {addonName}` |
| `PAYMENT_SUCCESS` | `Pago recibido - ${amount}` |
| `PAYMENT_FAILURE` | `Error en tu pago - Accion requerida` |
| `RENEWAL_REMINDER` | `Tu suscripcion se renueva pronto - {planName}` |
| `PLAN_CHANGE_CONFIRMATION` | `Cambio de plan confirmado` |
| `ADDON_EXPIRATION_WARNING` | `Tu add-on {addonName} expira pronto` |
| `ADDON_EXPIRED` | `Tu add-on {addonName} ha expirado` |
| `ADDON_RENEWAL_CONFIRMATION` | `Add-on renovado - {addonName}` |
| `TRIAL_ENDING_REMINDER` | `Tu periodo de prueba termina pronto` |
| `TRIAL_EXPIRED` | `Tu periodo de prueba ha finalizado` |
| `ADMIN_PAYMENT_FAILURE` | `[Admin] Fallo de pago - {userEmail}` |
| `ADMIN_SYSTEM_EVENT` | `[Admin] Evento del sistema - {eventType}` |

Fallback subject: `Notificacion de Hospeda`

## Adding a New Email Template

### Step 1 -- Create the template component

```tsx
// src/templates/feature/feature-announcement.tsx
import { Text, Link } from '@react-email/components';
import { Button, EmailLayout } from '@repo/email';
import { EmailHeading } from '../components/heading';

export interface FeatureAnnouncementProps {
  recipientName: string;
  featureName: string;
  description: string;
  learnMoreUrl: string;
}

export function FeatureAnnouncement({
  recipientName,
  featureName,
  description,
  learnMoreUrl
}: FeatureAnnouncementProps) {
  return (
    <EmailLayout previewText={`Nueva funcion: ${featureName}`}>
      <EmailHeading>Nueva funcion disponible</EmailHeading>
      <Text>Hola {recipientName},</Text>
      <Text>
        Tenemos el placer de anunciarte: <strong>{featureName}</strong>
      </Text>
      <Text>{description}</Text>
      <Button href={learnMoreUrl}>Mas informacion</Button>
    </EmailLayout>
  );
}
```

### Step 2 -- Add the notification type

See [Notification Types](./notification-types.md) for full instructions on adding the enum value, category mapping, and payload interface.

### Step 3 -- Add subject pattern

In `src/utils/subject-builder.ts`:

```ts
const SUBJECT_PATTERNS: Record<NotificationType, string> = {
  // ... existing
  [NotificationType.NEW_FEATURE_ANNOUNCEMENT]: 'Nueva funcion: {featureName}'
};
```

### Step 4 -- Register in NotificationService

In `src/services/notification.service.ts`, add a case to the `selectTemplate` method:

```ts
case 'new_feature_announcement': {
  const p = payload as FeatureAnnouncementPayload;
  return FeatureAnnouncement({
    recipientName: p.recipientName,
    featureName: p.featureName,
    description: p.description,
    learnMoreUrl: p.learnMoreUrl
  });
}
```

### Step 5 -- Export from templates index

```ts
// src/templates/index.ts
export { FeatureAnnouncement } from './feature/feature-announcement';
```

## Email Transport Interface

Templates are rendered and sent via the `EmailTransport` interface:

```ts
interface EmailTransport {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;  // The template component
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}
```

Two implementations are provided:

- **BrevoEmailTransport** (`resend-transport.ts`, legacy file name) .. Production delivery via the Brevo API, rendering HTML + text through `renderEmailBodies` from `@repo/email`
- **MockEmailTransport** .. In-memory mock for testing (records sent emails)

## Previewing Templates

Every template has an entry in the email catalog (`src/catalog/`) with sample scenarios. The admin previewer renders them through the real pipeline (subject, HTML and text), and `apps/api/test/services/email-preview/` renders every scenario in CI, including the layout checks (one `<html lang="es">`, logo, footer, no unsafe CSS, no `{{`, text part, size under 90 KB). Add a catalog entry when you add a template.
