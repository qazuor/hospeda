# Tanda formats

Three artifacts, three purposes. The **comment is canonical** — the contract and
the ledger are working state and may be regenerated from the comments.

## 1. Sign-off comment (canonical, goes on the Linear issue)

Machine-greppable header so a later sweep can find every sign-off, and
`Tanda` so the whole batch is reconstructible from Linear alone.

```markdown
<!-- smoke-signoff v1 -->
## Smoke sign-off

- **Resultado**: PASO | PARCIAL | FALLO | PENDIENTE
- **Entorno**: prod | staging | local
- **Grado**: ejecutado | declarado-de-memoria
- **Tanda**: <slug>  (`individual` for a one-off `/smoke HOS-N`)
- **Alcance**: camino | feature | individual
- **Paso**: <step id> — <step title>
- **Fecha**: YYYY-MM-DD
- **Observado por**: owner | claude
- **PR(s)**: #NNNN, #NNNN
- **Criterios**: 3/3 cubiertos   (or `2/3 — falta AC-2`)
- **Entornos pendientes**: ninguno   (or `prod — concerns_distintos: MP real`)
- **Labels retirados**: status-needs-smoke-staging
- **Observado**: <what was actually seen, in words. Never "step 12 passed".>
- **Hallazgo**: HOS-NNN   (only on FALLO)
```

`Grado: declarado-de-memoria` means the owner asserts the smoke was run but no
archived evidence exists. It removes the label like any other sign-off, and the
comment says so in as many words. Never infer this grade — only the owner declares
it.

## 2. Contract (`.smoke/tanda-<slug>.contract.json`)

Written in Phase 1, approved once by the owner, **frozen before any testing**.

```json
{
  "slug": "camino-anfitrion-2026-08-27",
  "alcance": "camino",
  "entorno_objetivo": "prod",
  "sha_desplegado": "abc123def456",
  "sha_fuente": "sentry-release",
  "rango": "abc123def456..HEAD",
  "abierta": "2026-08-27",
  "pasos": [
    {
      "id": "P-01",
      "titulo": "Registro de anfitrión con email",
      "accion": "Sign up at /es/registro with a fresh address and confirm the email.",
      "observacion_esperada": "The account lands on the onboarding screen and the row exists in users with emailVerified set."
    }
  ],
  "issues": [
    {
      "issue": "HOS-286",
      "prs": [2810, 2833],
      "desplegado": true,
      "entornos_requeridos": ["staging", "prod"],
      "motivo_entornos": "concerns_distintos",
      "motivo_detalle": "staging exercises the MP sandbox; prod is the only place the real Cloudflare purge runs.",
      "criterios": [
        { "id": "AC-1", "texto": "Short description is imported verbatim", "paso": "P-04" },
        { "id": "AC-2", "texto": "Destination is preselected from the source listing", "paso": "P-04" },
        { "id": "AC-3", "texto": "Dormitorios maps to the right amenity", "paso": "P-05" }
      ]
    }
  ],
  "no_cubierto": [
    { "issue": "HOS-412", "motivo": "No step in this journey reaches the admin partner editor." }
  ],
  "fuera_por_despliegue": [
    { "issue": "HOS-590", "prs": [2841], "motivo": "PR #2841 is in staging, not an ancestor of the prod SHA." }
  ]
}
```

Field notes:

- `motivo_entornos` — `escalacion` (default; **prod ⊇ staging ⊇ local** applies) or
  `concerns_distintos` (no subsumption; each environment needs its own sign-off).
  When `concerns_distintos`, `motivo_detalle` is mandatory.
- `paso` on a criterion may be `null`, which forces the issue into `no_cubierto`.
- A binding added after the tanda opened carries `"vinculo_tardio": true` and needs
  an explicit OK from the owner (I1).

## 3. Ledger (`.smoke/tanda-<slug>.json`)

Append-only observation log. Gitignored. Recovery aid, not the record.

```json
{
  "slug": "camino-anfitrion-2026-08-27",
  "estado": "abierta",
  "observaciones": [
    {
      "paso": "P-04",
      "issue": "HOS-286",
      "criterio": "AC-2",
      "veredicto": "FALLO",
      "entorno": "prod",
      "fecha": "2026-08-27",
      "observado_por": "owner",
      "cita": "Detects «C. del Uruguay» and does not apply it, leaving a required field empty.",
      "escrito_en_linear": true,
      "comentario_id": "..."
    }
  ]
}
```

`escrito_en_linear: false` on any row means the tanda is halted (I3). Resolve the
write before continuing.

## Closure report

```markdown
## Tanda <slug> — cierre

Entorno: prod · Alcance: camino · 2026-08-27 → 2026-08-29
Rango: abc123d..HEAD · 31 PRs · 24 issues

| Resultado | N | Issues |
|---|---|---|
| Cerrados (Done) | 11 | ... |
| Firmados, faltan entornos | 3 | ... |
| Parciales | 4 | ... |
| Rotos (vuelven a In Progress) | 2 | ... |
| No alcanzados por el recorrido | 4 | ... |
| Fuera por despliegue | 1 | ... |

Hallazgos nuevos: 6 (HOS-8xx ...)
```

The last three rows are the next tanda's input. A new tanda cannot open while any
of them is unsigned.
