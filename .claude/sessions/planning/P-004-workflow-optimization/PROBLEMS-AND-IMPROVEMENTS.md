# Problemas Identificados y Mejoras Propuestas

Análisis crítico del sistema propuesto con problemas potenciales y mejoras sugeridas.

---

## ⚠️ Problemas Potenciales Identificados

### 1. Complejidad Aumentada por Skills

**Problema**: De 4-6 skills a 16 skills es un aumento significativo (4x)

**Riesgos**:
- Difícil de mantener todos los skills actualizados
- Puede ser abrumador para nuevos colaboradores
- Overlap potencial entre skills similares
- ¿Realmente se usarán todos?

**Severidad**: Media

**Decisión del Usuario**: Implementar todos de una, documentar claramente cuándo usar cada skill

**Mitigación APROBADA**:
1. ✅ Implementar todos los 16 skills desde el inicio
2. ✅ Documentar claramente "cuándo usar cada skill" en cada skill file
3. ✅ Agregar sección en skills/README.md con matriz de uso
4. ✅ Revisar quarterly qué skills realmente se usan para posible consolidación futura

**Implementación**:
- Crear todos los skills con documentación completa
- Cada skill debe tener sección "When to use this skill"
- README.md debe tener decision tree o matriz de skills vs scenarios

---

### 2. Meta-Commands Pueden Generar Inconsistencia

**Problema**: `/create-agent`, `/create-command`, `/create-skill` generan archivos automáticamente

**Riesgos**:
- Calidad inconsistente de archivos generados
- Puede omitir best practices
- Difícil validar que el output sea correcto
- READMEs pueden desincronizarse si falla actualización

**Severidad**: Media-Alta

**Decisión del Usuario**: Generar templates y buena documentación, actualizar docs al generar

**Mitigación APROBADA**:
1. ✅ Templates muy estrictos y validados con JSON Schema
2. ✅ Actualizar documentación (READMEs) automáticamente cuando se generan
3. ✅ Si falla actualización de docs, avisar al usuario para que lo haga manualmente
4. ✅ Validación automática post-creación
5. ✅ Review manual obligatorio antes de commit

**Implementación**:
- Crear templates validados en `.claude/docs/templates/`
- Meta-commands deben actualizar READMEs automáticamente
- Si falla, mostrar warning claro y pasos para actualizar manualmente
- Agregar tests para los templates

---

### 3. Planning System Registry Puede Desincronizarse

**Problema**: `.code-registry.json` debe mantenerse sincronizado con TODOs.md y GitHub Issues

**Riesgos**:
- Registry dice X completed pero TODOs.md dice Y
- Números pueden estar fuera de sync
- Si alguien edita TODOs.md manualmente, registry no se actualiza
- Merge conflicts en JSON son difíciles de resolver

**Severidad**: Alta

**Decisión del Usuario**: Sí a todas las propuestas de mitigación

**Mitigación APROBADA**:
1. ✅ Validación automática: script que verifica sync
2. ✅ Hook de git pre-commit que valida consistency
3. ✅ Source of truth claro (TODOs.md es master, registry es computed)
4. ✅ Comando `/sync-registry` para forzar re-sync
5. ✅ Usar JSON Schema validation

**Implementación ADICIONAL del usuario**:
6. ✅ Al iniciar nueva sesión de Claude Code, hacer chequeo de sincronización
7. ✅ Avisar si encuentra inconsistencias para que puedan ser resueltas
8. ✅ Hacer registry "computed" no "source of truth"
9. ✅ Regenerar automáticamente desde TODOs.md

---

### 4. Workflow de 24 Pasos es Complejo

**Problema**: Feature workflow tiene 24 pasos, puede ser abrumador

**Riesgos**:
- Fácil olvidar un paso
- Mucho overhead para features medianas
- Usuario puede sentirse micro-gestionado
- Claude puede confundirse en qué paso está

**Severidad**: Media

**Decisión del Usuario**: Sí a todas las propuestas de mitigación

**Mitigación APROBADA**:
1. ✅ Checklist automática que Claude sigue
2. ✅ Comandos que encapsulan múltiples pasos (`/start-implementation`)
3. ✅ Progress indicator visible ("Paso 12/24")
4. ✅ Permitir skip de pasos no críticos con user approval
5. ✅ Documentar "express workflow" para features pequeñas-medianas

**Implementación**:
- Workflow completo (24 pasos) solo para Large Features (Nivel 3)
- Medium workflow (Nivel 2) ya documentado con 11 pasos
- Small Fix (Nivel 1) con 8 pasos
- Claude debe mostrar progress indicator en cada step
- Crear comandos helper para encapsular steps comunes

---

### 5. Traducción ES→EN Puede Perder Contexto

**Problema**: PDR/Tech Analysis se escriben en español, luego se traducen a inglés

**Riesgos**:
- Pérdida de matices en traducción
- Puede generar inconsistencias terminológicas
- Doble trabajo (escribir en ES, traducir a EN)
- Si necesitas cambiar después, ¿cuál editas?

**Severidad**: Baja-Media

**Decisión del Usuario**: Solo inglés

**Solución APROBADA**:
1. ✅ Mantener SOLO versión EN en todos los archivos de planificación
2. ✅ Durante discusión con usuario, hablar en ES (chat)
3. ✅ Escribir directamente en EN al guardar archivos
4. ✅ Evitar doble versión (elimina confusión y duplicación)
5. ✅ Source of truth único: versión EN

**Implementación**:
- PDR.md, tech-analysis.md, TODOs.md: siempre en inglés
- Chat con usuario: siempre en español
- Eliminar necesidad de traducción
- Archivos existentes: pueden mantenerse como están, nuevos solo EN

---

### 6. add-memory Skill Puede Crear Ruido

**Problema**: Skill que "auto-aprende" y actualiza documentación

**Riesgos**:
- Puede agregar learnings triviales
- Puede modificar docs sin user approval
- Difícil decidir QUÉ es un learning válido
- Puede crear inconsistencias si aprende incorrectamente

**Severidad**: Media

**Decisión del Usuario**: Sí a todas las propuestas de mitigación

**Mitigación APROBADA**:
1. ✅ Approval obligatorio de usuario antes de agregar learning
2. ✅ Threshold: solo agregar si se intentó 3+ veces o es significativo
3. ✅ Review semanal de learnings agregados
4. ✅ Comando `/review-learnings` para audit
5. ✅ Posibilidad de revertir learnings incorrectos

**Implementación**:
- Implementar como "suggest learning" NO "auto-add"
- Claude propone learning, usuario debe aprobar
- Mantener log de learnings agregados con fecha y contexto
- Skill debe detectar patterns y sugerir documentarlos
- No modificar docs sin explicit user approval

---

### 7. Demasiados Hooks Pueden Ralentizar

**Problema**: 6 hooks recomendados ejecutándose en cada acción

**Riesgos**:
- Performance degradation (cada edit ejecuta 3-4 hooks)
- Puede interrumpir flujo si hooks son lentos
- Si hook falla, puede bloquear trabajo
- Output verboso de hooks puede ser ruido

**Severidad**: Media

**Decisión del Usuario**: Sí a todas las propuestas de mitigación

**Mitigación APROBADA**:
1. ✅ Timeouts cortos (5-10s max para fast, 15-30s para slow)
2. ✅ Ejecutar en background cuando posible
3. ✅ Filtros estrictos (solo .ts, solo .md, etc.)
4. ✅ Quiet mode por defecto
5. ✅ Monitorear performance de hooks

**Implementación**:
- Start con hooks esenciales (markdown format, git status)
- Agregar hooks de validación gradualmente
- Medir y reportar impacto en performance
- Hooks lentos (tests, typecheck) como opcionales
- Documentar en RECOMMENDED-HOOKS.md qué hooks usar según necesidad

---

### 8. Sincronización con GitHub Issues Frágil

**Problema**: Dependencia de GitHub API que puede fallar

**Riesgos**:
- API rate limits
- Auth tokens que expiran
- Network issues
- Desincronización si alguien edita issues manualmente en GitHub
- No funciona offline

**Severidad**: Media-Alta

**Decisión del Usuario**: Sí a todas las propuestas + chequeo al inicio de sesión

**Mitigación APROBADA**:
1. ✅ Graceful degradation (trabajar sin sync si falla)
2. ✅ Retry logic con exponential backoff
3. ✅ Cache local de issues
4. ✅ Comando `/force-sync` para resincronizar
5. ✅ Detectar conflicts y pedir user resolution
6. ✅ **NUEVO**: Al iniciar nueva sesión de Claude Code, hacer chequeo de sincronización
7. ✅ **NUEVO**: Avisar si encuentra inconsistencias para que puedan ser resueltas

**Implementación**:
- Hacer sync opcional, NO obligatorio
- Sistema debe funcionar completamente offline
- Sync es "nice to have" NO "must have"
- Hook de inicio de sesión verifica estado de sync
- Warning claro si hay issues desincronizados
- Comando `/sync-status` para ver estado actual

---

## 💡 Mejoras Sugeridas

### 1. Agregar Telemetría y Analytics

**Propuesta**: Track qué agents/commands/skills se usan más

**Decisión del Usuario**: Ok, implementar

**Beneficios**:
- Identificar tools infrautilizados (candidates para removal)
- Optimizar workflows basado en uso real
- Detectar bottlenecks en proceso

**Implementación APROBADA**:
```json
// .claude/.telemetry.json (local, no committear)
{
  "agents": {
    "product-functional": { "invocations": 45, "avgDuration": "3m" },
    "db-drizzle-engineer": { "invocations": 12, "avgDuration": "1m" }
  },
  "commands": {
    "/quality-check": { "invocations": 89, "avgDuration": "45s" }
  },
  "skills": {
    "tdd-methodology": { "references": 234 }
  }
}
```

---

### 2. Agregar Comando `/workflow-status`

**Propuesta**: Ver en qué paso del workflow estás

**Decisión del Usuario**: Ok, implementar

**Ejemplo**:
```
$ /workflow-status

📋 Planning: PF-003-user-authentication
📍 Current Step: 18/24 (Implementation)
🎯 Current Task: PF-003-T-005 (API endpoints)

Progress:
▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 60%

Recent Actions:
✅ Paso 17: Presentar informe de task
✅ Paso 18: Implementando con TDD
⏳ Paso 19: Pendiente validación

Next: Validar task completa
```

---

### 3. Agregar Comando `/estimate`

**Propuesta**: Estimar complejidad antes de decidir workflow

**Decisión del Usuario**: Ok, implementar

**Ejemplo**:
```
$ /estimate "Agregar sistema de notificaciones"

🤔 Analizando solicitud...

📊 Estimación:
- Archivos afectados: ~15
- Tiempo estimado: 8-12 horas
- Componentes: DB, API, Frontend, Background jobs
- Complejidad: Alta

✅ Recomendación: Feature Workflow (PF-XXX)

Razones:
- Requiere multiple packages (db, api, web)
- Necesita planning detallado
- Riesgo de regresión medio-alto
```

---

### 4. Agregar CLAUDE.md por App/Package

**Propuesta**: Además del CLAUDE.md principal, cada app/package tiene el suyo

**Decisión del Usuario**: Ya existen, revisar y mejorar

**Estructura ACTUAL**:
```
CLAUDE.md (main - genérico)
apps/web/CLAUDE.md (específico Astro web app) - EXISTE
apps/admin/CLAUDE.md (específico TanStack Start admin) - EXISTE
packages/db/CLAUDE.md (específico database) - EXISTE
packages/service-core/CLAUDE.md (específico services) - EXISTE
```

**Acción**:
- ✅ Revisar CLAUDE.md existentes en cada app/package
- ✅ Mejorar contenido y consistencia
- ✅ Asegurar que siguen mismo formato
- ✅ Actualizar con nuevos patterns y learnings

**Beneficio**:
- Contexto específico cuando trabajas en ese package
- Main CLAUDE.md más corto
- Mejor organización

---

### 5. Agregar Validación de Configs en CI

**Propuesta**: GitHub Action que valida consistencia

**Decisión del Usuario**: Ok, implementar

**Validaciones APROBADAS**:
- Conteos en READMEs coinciden con archivos reales
- Code registry sincronizado con TODOs.md
- Todos los agents/commands/skills tienen YAML frontmatter correcto
- Todos tienen version history
- Ningún link roto en docs

**Implementación**:
```yaml
# .github/workflows/validate-claude-config.yml
name: Validate Claude Config
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm run validate:claude-config
```

---

### 6. Agregar Templates Validados

**Propuesta**: JSON Schema para validar todos los docs generados

**Decisión del Usuario**: Ok, implementar + mostrar ejemplo

**Templates APROBADOS**:
- PDR.schema.json
- tech-analysis.schema.json
- TODOs.schema.json
- agent-definition.schema.json
- command-definition.schema.json
- skill-definition.schema.json

**Ejemplo de Schema (PDR.schema.json)**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Product Design Requirements",
  "type": "object",
  "required": ["overview", "userStories", "businessRules"],
  "properties": {
    "overview": {
      "type": "object",
      "required": ["description", "context", "businessValue"],
      "properties": {
        "description": {"type": "string", "minLength": 50},
        "context": {"type": "string"},
        "businessValue": {"type": "string"}
      }
    },
    "userStories": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "title", "description", "acceptanceCriteria"],
        "properties": {
          "id": {"type": "string", "pattern": "^US-\\d+$"},
          "title": {"type": "string"},
          "description": {"type": "string"},
          "acceptanceCriteria": {
            "type": "array",
            "items": {"type": "string"}
          },
          "priority": {"enum": ["high", "medium", "low"]},
          "complexity": {"enum": ["high", "medium", "low"]}
        }
      }
    },
    "businessRules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "rule", "validation"],
        "properties": {
          "id": {"type": "string", "pattern": "^BR-\\d+$"},
          "rule": {"type": "string"},
          "validation": {"type": "string"}
        }
      }
    }
  }
}
```

**Beneficio**:
- Asegurar consistencia
- Detectar campos faltantes automáticamente
- Validación automática en CI
- Prevenir errores de formato

---

### 7. Agregar Comando `/health-check`

**Propuesta**: Validar salud del sistema

**Decisión del Usuario**: Ok, implementar

**Ejemplo**:
```
$ /health-check

🏥 System Health Check

✅ Agents: 13/13 defined, 0 missing READMEs
✅ Commands: 18/18 documented
✅ Skills: 16/16 documented
⚠️  Code Registry: 2 plannings out of sync
❌ Hooks: 1 hook failing (markdown formatter)
✅ Documentation: All links valid

Overall Health: ⚠️ Warning (2 issues)

Recommendations:
1. Run `/sync-registry` to fix planning sync
2. Check hook config for markdown formatter

```

---

### 8. Simplificar Naming de Tasks

**Problema actual**: `PF-002-T-003-002-001` es muy largo

**Propuesta**: Usar naming más corto en código

**Alternativa 1: Flat con prefijo**
```
PF002-T001
PF002-T002
PF002-T002A (subtask)
PF002-T002B
```

**Alternativa 2: Usar IDs simples** ✅ APROBADA

**Decisión del Usuario**: Ir con alternativa 2

```
PF002-1       (task principal 1)
PF002-2       (task principal 2)
PF002-2.1     (subtask de la task 2)
PF002-2.2     (otra subtask de la task 2)
```

**Beneficio**:
- ✅ Más fácil de escribir y recordar
- ✅ Menos verbose en commits
- ✅ Mantiene trazabilidad completa
- ✅ Sistema jerárquico claro con punto decimal

**Implementación**:
- Aplicar en todos los nuevos plannings (PF, PR, PB)
- Actualizar documentación y templates
- Migrar plannings existentes gradualmente si es necesario

---

### 9. Agregar "Workflow Checkpoints"

**Propuesta**: Guardar estado del workflow para poder pausar/resumir

**Decisión del Usuario**: Ok, implementar

**Implementación APROBADA**:
```json
// .claude/sessions/planning/features/PF-003/.checkpoint.json
{
  "workflow": "feature",
  "currentStep": 18,
  "currentTask": "PF-003-T-005",
  "lastUpdate": "2025-10-30T14:30:00Z",
  "context": {
    "testsWritten": 5,
    "filesModified": ["src/api/users.ts", "test/users.test.ts"]
  }
}
```

**Beneficio**:
- Poder pausar trabajo y retomar
después
- Cross-session continuity
- Menos riesgo de perder contexto

---

### 10. Agregar Design Standards Doc

**Propuesta**: Documentar design patterns y standards

**Decisión del Usuario**: Ok, implementar

**Ubicación**: `.claude/docs/standards/design-standards.md`

**Contenido APROBADO**:
- Color palette
- Typography scales
- Component patterns
- Spacing system
- Animation guidelines
- Accessibility standards
- Responsive breakpoints
- Icon system

**Beneficio**:
- Consistencia visual
- Reference para ux-ui-designer agent
- Onboarding de designers

---

## 🎯 Priorización de Mejoras

### Must Have (Implementar en P-004)
1. ✅ Validación de configs en CI
2. ✅ CLAUDE.md por app/package
3. ✅ Design standards doc
4. ✅ Mitigaciones para sync registry
5. ✅ Templates con JSON Schema

### Should Have (Implementar después)
6. ⚠️ Telemetría y analytics
7. ⚠️ `/workflow-status` comando
8. ⚠️ `/health-check` comando
9. ⚠️ Workflow checkpoints

### Nice to Have (Considerar futuro)
10. 💡 `/estimate` comando
11. 💡 Simplificar naming de tasks
12. 💡 User dashboard de métricas

---

## 📊 Risk Matrix

| Problema | Probabilidad | Impacto | Prioridad |
|----------|--------------|---------|-----------|
| Registry desincronizado | Alta | Alto | 🔴 Crítico |
| Hooks ralentizan workflow | Media | Medio | 🟡 Atender |
| 24 pasos abrumador | Media | Medio | 🟡 Atender |
| Skills no se usan todos | Alta | Bajo | 🟢 Monitor |
| Sync GitHub falla | Media | Medio | 🟡 Atender |
| Meta-commands inconsistentes | Baja | Alto | 🟡 Atender |
| Traducción ES→EN | Baja | Bajo | 🟢 Aceptar |
| add-memory ruido | Media | Bajo | 🟢 Monitor |

---

## 📝 Version History

- v1.0.0 (2025-10-30): Initial problems and improvements analysis
