# Adding Translations

## Adding a New Key to an Existing Namespace

### Step 1 -- Add the key to all locale files

Edit the JSON file for each locale. Example: adding a new button label to `common.json`.

**`packages/i18n/src/locales/es/common.json`**:

```json
{
  "buttons": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "export": "Exportar"
  }
}
```

**`packages/i18n/src/locales/en/common.json`**:

```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "export": "Export"
  }
}
```

**`packages/i18n/src/locales/pt/common.json`**:

```json
{
  "buttons": {
    "save": "Salvar",
    "cancel": "Cancelar",
    "export": "Exportar"
  }
}
```

### Step 2 -- Use the key in code

The key path is: `{namespace}.{nested.path}`.

```tsx
const { t } = useTranslations();
t('common.buttons.export'); // "Exportar" (es), "Export" (en)
```

### Step 3 -- Verify

Start the dev server. If the key is missing, you will see `[MISSING: common.buttons.export]` in the UI and a console error.

## Adding Keys with Parameters

Use `{paramName}` syntax in the translation value:

```json
{
  "search": {
    "results": "Encontramos {count} resultados en {city}"
  }
}
```

```tsx
t('search.results', { count: 10, city: 'Concepcion del Uruguay' });
// "Encontramos 10 resultados en Concepcion del Uruguay"
```

Both `{param}` and `{{param}}` syntax are supported. Double braces are replaced first to avoid partial matches.

## Adding Pluralized Keys

Use the CLDR `_one` / `_other` suffix convention:

```json
{
  "items_one": "{count} item",
  "items_other": "{count} items"
}
```

```tsx
const { tPlural } = useTranslations();
tPlural('common.items', 1);  // "1 item"
tPlural('common.items', 5);  // "5 items"
tPlural('common.items', 0);  // "0 items" (uses _other)
```

The `count` parameter is automatically injected into the params.

## Adding a New Namespace

### Step 1 -- Create JSON files

Create a new JSON file in each locale directory:

```bash
touch packages/i18n/src/locales/es/booking.json
touch packages/i18n/src/locales/en/booking.json
touch packages/i18n/src/locales/pt/booking.json
```

**`packages/i18n/src/locales/es/booking.json`**:

```json
{
  "title": "Reservar Alojamiento",
  "checkIn": "Fecha de entrada",
  "checkOut": "Fecha de salida",
  "guests": "Huespedes",
  "confirm": "Confirmar Reserva"
}
```

### Step 2 -- Register the namespace in config.ts

Add the namespace to the `namespaces` array:

```ts
// packages/i18n/src/config.ts
export const namespaces = [
  'common',
  'nav',
  // ... existing namespaces
  'booking'  // Add here
] as const;
```

### Step 3 -- Import the JSON files

Add imports and register them in the `rawTranslations` object:

```ts
// packages/i18n/src/config.ts

// Spanish
import bookingEs from './locales/es/booking.json';
// English
import bookingEn from './locales/en/booking.json';
// Portuguese
import bookingPt from './locales/pt/booking.json';

const rawTranslations = {
  es: {
    // ... existing
    booking: bookingEs
  },
  en: {
    // ... existing
    booking: bookingEn
  },
  pt: {
    // ... existing
    booking: bookingPt
  }
};
```

### Step 4 -- Use the new namespace

```tsx
const { t } = useTranslations();
t('booking.title');    // "Reservar Alojamiento"
t('booking.checkIn');  // "Fecha de entrada"
```

## Translation File Format

### Nesting

Keys can be nested to any depth. They are flattened to dot notation at build time:

```json
{
  "section": {
    "subsection": {
      "key": "Value"
    }
  }
}
```

Accessed as: `t('namespace.section.subsection.key')`

### Naming Conventions

- Use **camelCase** for key names: `checkInDate`, not `check-in-date`
- Group related keys under a shared parent: `buttons.save`, `buttons.cancel`
- Use descriptive names: `hero.title`, not `t1`
- Keep namespace names lowercase with hyphens: `auth-ui`, `admin-billing`

### Consistency Rules

- Maintain the **same key structure** across all three locale files
- Use consistent terminology (e.g., always "Guardar" for save, never "Salvar" in Spanish)
- Add keys to **all three locales** at the same time, even if English/Portuguese translations are initially the same as Spanish

## Troubleshooting

### `[MISSING: key]` in the UI

1. Verify the key exists in the JSON file for the active locale
2. Check the namespace is registered in `config.ts`
3. Check the import is added to `rawTranslations`
4. Restart the dev server (translation files are loaded at startup)

### TypeScript errors on translation keys

If your IDE does not autocomplete the new key, rebuild the types:

```bash
cd packages/i18n
pnpm build
```

### Changes not reflected

1. Restart the dev server after modifying JSON files
2. Clear build cache: `pnpm clean` in the app directory
3. Rebuild: `pnpm build` from the monorepo root
