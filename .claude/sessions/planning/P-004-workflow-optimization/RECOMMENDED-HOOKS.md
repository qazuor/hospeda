# Hooks Recomendados para el Proyecto

## Introducción

Este documento contiene las configuraciones de hooks recomendadas para el proyecto Hospeda. Los hooks permiten automatizar tareas y mantener la calidad del código durante el desarrollo con Claude Code.

**IMPORTANTE:** Este archivo documenta los hooks recomendados. Para activarlos, deben agregarse al archivo `.claude/settings.json` (proyecto) o `~/.claude/settings.json` (global).

---

## Tabla de Contenidos

1. [Auto-formateo de Markdown](#1-auto-formateo-de-markdown)
2. [Lint Automático en TypeScript](#2-lint-automático-en-typescript)
3. [Git Status al Terminar Tarea](#3-git-status-al-terminar-tarea)
4. [Warning si Hay Tests Fallando](#4-warning-si-hay-tests-fallando)
5. [TypeCheck Rápido en Cambios](#5-typecheck-rápido-en-cambios)
6. [Prevenir Commits Accidentales de Secrets](#6-prevenir-commits-accidentales-de-secrets)
7. [Configuración Completa](#configuración-completa)

---

## 1. Auto-formateo de Markdown

**Propósito:** Formatear automáticamente archivos Markdown después de editarlos para mantener consistencia.

**Evento:** `PostToolUse`
**Matcher:** `Edit|MultiEdit|Write`
**Trigger:** Después de editar/crear archivos `.md`

**Beneficios:**

- Consistencia en formato de documentación
- Cumple estándares de markdownlint
- Evita commits con formato incorrecto

**Configuración:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ ${TOOL_INPUT} == *.md ]]; then pnpm format:md:claude \"${TOOL_INPUT}\" 2>/dev/null || true; fi",
            "timeout": 15000
          }
        ]
      }
    ]
  }
}
```

**Notas:**

- Usa `pnpm format:md:claude` que formatea solo archivos en `.claude/`
- Timeout de 15s para manejar archivos grandes
- `|| true` previene bloqueo si falla el formato

---

## 2. Lint Automático en TypeScript

**Propósito:** Ejecutar linter automáticamente después de modificar archivos TypeScript.

**Evento:** `PostToolUse`
**Matcher:** `Edit|MultiEdit|Write`
**Trigger:** Después de editar/crear archivos `.ts` o `.tsx`

**Beneficios:**

- Detecta problemas de estilo inmediatamente
- Mantiene código consistente
- Feedback rápido sobre errores comunes

**Configuración:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ ${TOOL_INPUT} == *.ts ]] || [[ ${TOOL_INPUT} == *.tsx ]]; then pnpm exec biome lint \"${TOOL_INPUT}\" --no-errors-on-unmatched 2>/dev/null || echo '⚠️  Lint check needed'; fi",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

**Notas:**

- Usa Biome como linter (más rápido que ESLint)
- Solo lintea el archivo modificado (no todo el proyecto)
- Muestra advertencia si hay problemas de lint

---

## 3. Git Status al Terminar Tarea ❌ NO IMPLEMENTAR

**Propósito:** Mostrar estado de Git cuando Claude termina de responder.

**Evento:** `Stop`
**Matcher:** N/A (aplica a todas las finalizaciones)
**Trigger:** Cuando Claude Code termina una respuesta

**Decisión del Usuario:** NO implementar este hook

**Razones para no implementar:**

- ❌ Puede ser demasiado verboso
- ❌ El usuario puede verificar git status manualmente cuando lo necesite
- ❌ No aporta suficiente valor para el overhead

**Alternativa:**

- Usuario ejecuta `git status` manualmente cuando necesita revisar cambios
- Usar comando `/commit` que ya muestra los cambios

---

## 4. Warning si Hay Tests Fallando ❌ NO IMPLEMENTAR

**Propósito:** Verificar si hay tests fallando después de modificar archivos de código.

**Evento:** `PostToolUse`
**Matcher:** `Edit|MultiEdit|Write`
**Trigger:** Después de editar archivos `.ts` o `.tsx`

**Decisión del Usuario:** NO implementar este hook

**Razones para no implementar:**

- ❌ MUY LENTO - puede tardar 30+ segundos por cada edit
- ❌ Interrumpe el flujo de trabajo constantemente
- ❌ Ejecutar tests después de cada modificación es excesivo
- ❌ El usuario prefiere ejecutar tests manualmente cuando complete cambios

**Alternativa:**

- Ejecutar `/run-tests` o `pnpm test` manualmente cuando se complete un conjunto de cambios
- Usar `/quality-check` al final de cada task que incluye tests
- Confiar en TDD: escribir tests primero, luego implementar

---

## 5. TypeCheck Rápido en Cambios ✅ SOLO EL MODIFICADO

**Propósito:** Verificar tipos de TypeScript después de modificar archivos.

**Evento:** `PostToolUse`
**Matcher:** `Edit|MultiEdit|Write`
**Trigger:** Después de editar archivos `.ts` o `.tsx`

**Decisión del Usuario:** Implementar solo para el package/app modificado (NO proyecto completo)

**Beneficios:**

- ✅ Detecta errores de tipos inmediatamente
- ✅ Mantiene type safety
- ✅ Previene commits con errores de compilación
- ✅ MÁS RÁPIDO que typecheck completo del proyecto

**Configuración APROBADA - TypeCheck Solo del Package Modificado:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ ${TOOL_INPUT} == *.ts ]] || [[ ${TOOL_INPUT} == *.tsx ]]; then PACKAGE_DIR=$(dirname $(dirname ${TOOL_INPUT})); cd ${PACKAGE_DIR} && pnpm run typecheck 2>/dev/null && echo '✅ Types OK' || echo '❌ Type errors in package'; fi",
            "timeout": 15000
          }
        ]
      }
    ]
  }
}
```

**Notas:**

- ✅ Solo typecheck del package/app modificado
- ✅ Mucho más rápido que proyecto completo
- ✅ Timeout reducido a 15s
- ✅ Suficiente para detectar errores en el código modificado

**NO usar typecheck completo del proyecto** (muy lento)

---

## 6. Prevenir Commits Accidentales de Secrets ⚠️ MODO WARNING CON BYPASS

**Propósito:** Escanear archivos antes de guardarlos para detectar secrets hardcodeados.

**Evento:** `PreToolUse`
**Matcher:** `Write|Edit|MultiEdit`
**Trigger:** Antes de guardar cualquier archivo

**Decisión del Usuario:** Modo warning con bypass - detecta secret, no commitea y avisa, si el user le dice que lo haga igual, hace el commit bypaseando ese warning

**Beneficios:**

- ⚠️ Previene leaks de API keys, tokens, passwords
- ⚠️ Protege seguridad del proyecto
- ⚠️ Detecta problemas antes del commit
- ✅ NO BLOQUEA si el usuario decide proceder de todas formas

**Configuración APROBADA (Warning Mode con Bypass):**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "if grep -iE '(api[_-]?key|secret[_-]?key|password|token|auth[_-]?token)\\s*=\\s*[\\'\\\"][A-Za-z0-9+/=]{16,}' \"${TOOL_INPUT}\" 2>/dev/null; then echo '⚠️  WARNING: Potential secret detected in ${TOOL_INPUT}. Please review before committing. Claude will ask for confirmation.'; exit 0; else echo '✅ No obvious secrets'; fi",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

**Comportamiento:**

1. ⚠️ Hook detecta potential secret → Muestra warning
2. ⚠️ Claude ve el warning → Pregunta al usuario si está seguro
3. ✅ Usuario dice "sí, proceder" → Claude commitea de todas formas
4. ❌ Usuario dice "no" → Claude no commitea, usuario revisa

**Notas:**

- ✅ Usa regex simple (no requiere instalar gitleaks)
- ✅ NO BLOQUEA la operación (exit 0)
- ✅ Genera warning visible
- ✅ Claude debe preguntar al usuario antes de commitear si detecta warning
- ⚠️ Puede tener falsos positivos (pero no bloquea)

**Workflow con Secret Detectado:**

```
Claude: ⚠️ WARNING: Detecté un posible secret en el archivo config.ts
        ¿Estás seguro de que quieres commitear este archivo?

Usuario: [Opción 1] Sí, es un secret de testing, procede
         [Opción 2] No, déjame revisarlo primero
```

---

## Configuración Completa APROBADA

Para activar los hooks recomendados y aprobados, agregar al `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "if grep -iE '(api[_-]?key|secret[_-]?key|password|token|auth[_-]?token)\\s*=\\s*[\\'\\\"][A-Za-z0-9+/=]{16,}' \"${TOOL_INPUT}\" 2>/dev/null; then echo '⚠️  WARNING: Potential secret detected in ${TOOL_INPUT}. Please review before committing.'; exit 0; else echo '✅ No obvious secrets'; fi",
            "timeout": 5000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "if [[ ${TOOL_INPUT} == *.md ]]; then pnpm format:md:claude \"${TOOL_INPUT}\" 2>/dev/null || true; fi",
            "timeout": 15000
          },
          {
            "type": "command",
            "command": "if [[ ${TOOL_INPUT} == *.ts ]] || [[ ${TOOL_INPUT} == *.tsx ]]; then pnpm exec biome lint \"${TOOL_INPUT}\" --no-errors-on-unmatched 2>/dev/null || echo '⚠️  Lint check needed'; fi",
            "timeout": 10000
          },
          {
            "type": "command",
            "command": "if [[ ${TOOL_INPUT} == *.ts ]] || [[ ${TOOL_INPUT} == *.tsx ]]; then PACKAGE_DIR=$(dirname $(dirname ${TOOL_INPUT})); cd ${PACKAGE_DIR} && pnpm run typecheck 2>/dev/null && echo '✅ Types OK' || echo '❌ Type errors in package'; fi",
            "timeout": 15000
          }
        ]
      }
    ]
  }
}
```

**Hooks INCLUIDOS:**

1. ✅ Auto-formateo de Markdown
2. ✅ Lint Automático en TypeScript
3. ✅ TypeCheck SOLO del package modificado (NO proyecto completo)
4. ⚠️ Secrets detection en modo warning (NO bloquea)

**Hooks NO INCLUIDOS (por decisión del usuario):**

1. ❌ Git Status al terminar (demasiado verboso)
2. ❌ Warning si hay tests fallando (muy lento)

---

## Recomendaciones de Uso

### Configuración APROBADA por Usuario

Activar estos hooks desde el inicio:

**Hooks ESENCIALES (activar siempre):**

1. ✅ Auto-formateo de Markdown
2. ✅ Lint Automático en TypeScript
3. ✅ TypeCheck del Package Modificado (NO proyecto completo)
4. ⚠️ Secrets Detection en modo warning (NO bloquea)

**Hooks NO RECOMENDADOS (NO activar):**

1. ❌ Git Status al Terminar - Demasiado verboso
2. ❌ Warning Tests Fallando - Muy lento, interrumpe flujo

### Consideraciones de Performance

**Hooks Rápidos (< 5s):**

- Auto-formateo Markdown
- Lint TypeScript (archivo individual)
- Git Status
- Secrets detection (regex simple)

**Hooks Lentos (> 10s):**

- TypeCheck completo
- Tests completos
- Secrets detection (gitleaks)

**Recomendación:** Activar hooks lentos solo para proyectos pequeños o cuando se necesita validación estricta.

### Personalización por Desarrollador

Los developers pueden tener configuraciones diferentes:

**Developer A (Workflow Rápido):**

```json
// ~/.claude/settings.json
{
  "hooks": {
    "PostToolUse": [{"matcher": "Edit|MultiEdit|Write", "hooks": [{"type": "command", "command": "...markdown format..."}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "git status --short"}]}]
  }
}
```

**Developer B (Workflow Riguroso):**

```json
// ~/.claude/settings.json - Todos los hooks activados
```

---

## Troubleshooting

### Hook Falla y Bloquea Claude

**Solución:** Agregar `|| true` al final del comando:

```bash
command 2>/dev/null || true
```

### Hook es Muy Lento

**Opciones:**

1. Aumentar timeout
2. Optimizar comando (por ejemplo, typecheck solo del package)
3. Desactivar el hook

### Hook No Se Ejecuta

**Verificar:**

1. El comando existe en PATH
2. Los permisos de ejecución
3. El matcher coincide con el tool usado
4. No hay errores de sintaxis en el JSON

### Falsos Positivos en Secrets Detection

**Solución:**

- Agregar exclusiones para archivos de test
- Ajustar regex para ser más específico
- Usar whitelist de patrones aceptables

---

## Mantenimiento

### Agregar Nuevo Hook

1. Identificar el evento apropiado (Pre/Post/Stop)
2. Definir matcher si es necesario
3. Escribir comando con error handling
4. Testear manualmente
5. Agregar a configuración
6. Documentar en este archivo

### Revisar Performance

**Mensual:**

- Revisar logs de hooks lentos
- Considerar desactivar hooks no útiles
- Optimizar comandos si es posible

**Quarterly:**

- Evaluar si todos los hooks se usan
- Actualizar documentación
- Compartir mejores prácticas con equipo

---

## Recursos Adicionales

- [Claude Code Hooks Documentation](https://docs.claude.com/en/docs/claude-code/hooks)
- [Comando /rule2hook](.claude/commands/rule2hook.md) (si se reactiva en el futuro)
- [Gitleaks](https://github.com/gitleaks/gitleaks) - Secret detection
- [Biome](https://biomejs.dev/) - Linter y formatter

---

## Version History

- **v1.0.0** (2025-10-30): Initial hooks recommendations for P-004 workflow optimization
