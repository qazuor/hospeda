# Recomendación de Implementación - P-006 CI/CD

**Fecha:** 2025-11-01
**Contexto:** Proyecto en desarrollo inicial (pre-alpha), un solo desarrollador, sin usuarios
**Estado:** Recomendación estratégica

---

## Resumen Ejecutivo

**Recomendación:** Implementar **CI/CD Lite** ahora, postergar la migración completa de P-006 para más adelante.

**Razón:** La inversión de 75 horas en un sistema completo de worktrees/PRs/protecciones no aporta valor significativo en este momento del proyecto. Un enfoque minimalista (4 horas) proporciona el 80% de los beneficios con el 5% del esfuerzo.

---

## Análisis de Contexto

### Situación Actual

- **Equipo:** 1 desarrollador (tú)
- **Estado:** Pre-alpha, desarrollo inicial
- **Usuarios:** 0 (no hay versión pública)
- **Frecuencia de commits:** Probablemente varios por día en main
- **Riesgo de conflictos:** Prácticamente cero
- **Necesidad de review:** No hay quién revise PRs

### Problemas que P-006 Completo Resuelve

1. ✅ **Conflictos entre múltiples desarrolladores** → No aplica (solo tú)
2. ✅ **Code review obligatorio** → No hay quién revise
3. ✅ **Branch protection** → Innecesario sin equipo
4. ✅ **Worktrees para trabajo paralelo** → Puedes hacer checkout de branches normalmente
5. ✅ **CI en PRs antes de merge** → Puedes correr CI en main directamente

---

## Comparación: P-006 Completo vs CI/CD Lite

| Aspecto | P-006 Completo | CI/CD Lite | Justificación |
|---------|----------------|------------|---------------|
| **Esfuerzo** | 75 horas (4-5 semanas) | ~4 horas | Ahorro del 95% del tiempo |
| **Worktrees** | Sí | No | No necesitas trabajo paralelo |
| **PRs obligatorios** | Sí | No | No hay quién revise |
| **Branch protection** | Sí | No | Sin equipo, no hay riesgo |
| **CI/CD básico** | ✅ Sí | ✅ Sí | **Crítico** - calidad automática |
| **Renovate** | ✅ Sí | ✅ Sí | **Crítico** - seguridad deps |
| **Pre-commit hooks** | ✅ Sí | ✅ Sí | **Útil** - calidad local |
| **Lighthouse CI** | ✅ Sí | ⚠️ Opcional | Solo si web pública cerca |
| **Bundle size checks** | ✅ Sí | ⚠️ Opcional | Solo si web pública cerca |
| **CodeQL** | ✅ Sí | ⚠️ Opcional | Gratis en GitHub |
| **GitHub Projects** | ✅ Sí | ❌ No | Overhead innecesario |
| **Migrar 62 archivos** | ✅ Sí | ❌ No | Puedes hacer push a main |

---

## CI/CD Lite: Implementación Recomendada

### Componentes Esenciales (4 horas)

#### 1. CI Básico en Push a Main (2h)

**Archivo:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:coverage

      # Fallar si coverage < 90%
      - name: Check coverage
        run: |
          COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)
          if (( $(echo "$COVERAGE < 90" | bc -l) )); then
            echo "❌ Coverage $COVERAGE% < 90%"
            exit 1
          fi
```

**Beneficios:**

- Detecta errores automáticamente
- Fuerza mantener 90% coverage
- Valida que todo compile y pase tests
- Corre en cada push (feedback inmediato)

#### 2. Renovate para Dependencias (30min)

**Archivo:** `renovate.json`

```json
{
  "extends": ["config:base"],
  "schedule": ["every weekend"],
  "rangeStrategy": "bump",
  "semanticCommits": "enabled",
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": false
    }
  ]
}
```

**Beneficios:**

- Mantiene dependencias actualizadas automáticamente
- PRs semanales con actualizaciones
- Reduce deuda técnica
- Mejora seguridad (CVE patches)

#### 3. Pre-commit Hooks (1.5h)

**Instalar Husky:**

```bash
pnpm add -D husky lint-staged
pnpm exec husky init
```

**Archivo:** `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec lint-staged
```

**Archivo:** `package.json`

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

**Beneficios:**

- Código siempre formateado
- No se commitea código con errores de lint
- Feedback instantáneo antes de push

---

## Workflow Recomendado AHORA

### Flujo de Trabajo Simple

```bash
# 1. Hacer cambios normalmente en main
git checkout main
code .

# 2. Commit (pre-commit hooks corren automáticamente)
git add .
git commit -m "feat: nueva funcionalidad"

# 3. Push a main
git push origin main

# 4. GitHub Actions corre CI automáticamente
# Si falla algo, arreglarlo y push de nuevo
```

### Cuándo Crear Branches (Opcional)

Solo si trabajas en algo experimental que no quieres en main:

```bash
git checkout -b experiment/nueva-idea
# Trabajas libremente
# Cuando esté listo:
git checkout main
git merge experiment/nueva-idea
git push origin main
```

**No es obligatorio.** Puedes trabajar directo en main sin problemas.

---

## Señales para Migrar a P-006 Completo

### Triggers Definitivos

1. **Segundo desarrollador se une al equipo**
   - Ahora sí necesitas PRs para code review
   - Worktrees serán útiles para trabajo paralelo
   - Branch protection previene conflictos

2. **Próximo a lanzar versión pública**
   - Lighthouse CI para garantizar performance
   - Bundle size checks para controlar peso
   - GitHub Projects para coordinar lanzamiento

3. **Equipo crece a 3+ desarrolladores**
   - Sistema completo se vuelve esencial
   - ROI de 75 horas se justifica

### Señales Intermedias (Evaluar)

- Empiezas a tener conflictos contigo mismo (olvidas qué cambios hiciste)
- Necesitas trabajar en 2+ features simultáneamente
- El proyecto alcanza 50,000+ líneas de código
- Tienes colaboradores ocasionales (diseñadores, QA)

---

## Plan de Acción

### Fase 1: Ahora (4 horas)

```bash
# Día 1: CI Básico (2h)
1. Crear .github/workflows/ci.yml
2. Testear que corra correctamente
3. Ajustar si hay fallos

# Día 2: Renovate (30min)
4. Crear renovate.json
5. Activar Renovate en GitHub

# Día 3: Pre-commit Hooks (1.5h)
6. Instalar Husky + lint-staged
7. Configurar hooks
8. Testear que funcionen
```

### Fase 2: Cuando Aplique (75 horas)

Implementar P-006 completo según planificación existente.

---

## Beneficios del Enfoque Lite

### Inmediatos

✅ **Calidad garantizada** - CI detecta errores
✅ **Dependencias actualizadas** - Renovate automatiza
✅ **Código limpio** - Pre-commit hooks fuerzan estándares
✅ **Velocidad** - No friction innecesario
✅ **Simplicidad** - Menos herramientas que aprender

### Largo Plazo

✅ **Migración fácil** - CI ya existe, solo agregar worktrees/PRs
✅ **Sin deuda técnica** - Dependencias mantenidas
✅ **Fundación sólida** - Bases de CI/CD ya implementadas
✅ **Tiempo ahorrado** - 71 horas para features reales

---

## Comparación de ROI

| Métrica | P-006 Completo | CI/CD Lite |
|---------|----------------|------------|
| **Inversión** | 75 horas | 4 horas |
| **Valor inmediato** | 20% (overkill) | 80% (justo lo necesario) |
| **Friction** | Alto (PRs obligatorios) | Bajo (push directo) |
| **Velocidad desarrollo** | -30% inicial | +5% (menos errores) |
| **Protección** | Máxima (innecesaria) | Suficiente |
| **Escalabilidad** | Perfecta para equipos | Fácil migrar después |

---

## Conclusión

**Implementa CI/CD Lite ahora, migra a P-006 completo cuando tengas un segundo desarrollador o estés cerca del lanzamiento público.**

**Razón:** No tiene sentido invertir 75 horas en infraestructura para colaboración cuando aún no hay con quién colaborar. Los 4 horas de CI/CD Lite te dan:

- ✅ Calidad automática
- ✅ Dependencias actualizadas
- ✅ Código formateado
- ✅ Zero friction
- ✅ 71 horas para desarrollar features reales

Cuando llegue el momento adecuado (segundo dev o lanzamiento), ya tendrás las bases de CI/CD y solo necesitarás agregar la capa de colaboración (worktrees, PRs, protections).

---

## Próximos Pasos

1. ¿Apruebas este enfoque?
2. Si sí → Implementamos CI/CD Lite (4 horas)
3. Marcamos P-006 como "Deferred - Waiting for Trigger"
4. Continuamos con desarrollo de features

---

**Documento creado:** 2025-11-01
**Autor:** Claude (Principal Software Architect)
**Estado:** Recomendación pendiente de aprobación
