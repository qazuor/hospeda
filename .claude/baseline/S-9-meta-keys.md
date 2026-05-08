# S-9: Home Page Meta i18n Keys — Findings

**Task**: T-031 (prerequisite of T-032). Audit `home.title` / `home.description`
keys across the 3 supported locales before localizing the homepage `<title>`
and `<meta name="description">`.

## Files inspected

- `packages/i18n/src/locales/es/home.json`
- `packages/i18n/src/locales/en/home.json`
- `packages/i18n/src/locales/pt/home.json`

## Current keys per locale

| Locale | `home.title`                  | `home.description`                                                                                                                                |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| es     | `Alojamientos en Entre Ríos`  | `Descubrí los mejores alojamientos en Entre Ríos, Argentina. Desde cabañas hasta hoteles, tenemos opciones para todos los gustos y presupuestos.` |
| en     | `Accommodations in Entre Rios`| `Discover the best accommodations in Entre Rios, Argentina. From cabins to hotels, we have options for every taste and budget.`                  |
| pt     | `Hospedagens em Entre Rios`   | `Descubra as melhores hospedagens em Entre Rios, Argentina. De cabanas a hoteis, temos opcoes para todos os gostos e orcamentos.`                 |

## Conclusion

**All three locales already define both keys.** No additions to the locale
files are required for T-032.

## Hardcoded values currently rendered

`apps/web/src/pages/[lang]/index.astro:133-135`:

```astro
<DefaultLayout
    locale={locale}
    title="Inicio"
    description="Descubrí los mejores alojamientos, destinos y experiencias del Litoral Entrerriano."
    canonicalPath={`/${locale}/`}
>
```

Both values are hardcoded Spanish strings. EN and PT visitors see Spanish in
their tab title and meta description today.

## Title conflict resolution

Hardcoded value `"Inicio"` vs existing key `home.title` value
`"Alojamientos en Entre Ríos"`.

**Decision**: keep the existing key value (`"Alojamientos en Entre Ríos"` and
its EN/PT equivalents). The SEO-friendly product title that already lives in
the i18n catalog wins; `"Inicio"` was a placeholder that drifted from the
catalog and offers no SEO value.

## Action plan for T-032

1. Replace hardcoded `title="Inicio"` with `title={t('home.title')}`.
2. Replace hardcoded Spanish description with `description={t('home.description')}`.
3. No locale file changes needed.
