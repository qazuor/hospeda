# Product Design Requirements: Optimización del Sistema de Workflow

## 1. Visión General

### Descripción del Proyecto

Optimización integral del sistema de desarrollo de Hospeda para hacerlo más eficiente, mantenible, usable y escalable. Este proyecto busca mejorar la experiencia tanto del desarrollador humano como de Claude Code al trabajar en el proyecto.

### Contexto Actual

**Sistema Existente:**
- 25 agentes especializados
- 15 comandos (12 documentados + 3 sin documentar)
- 5 skills (4 documentados + 1 sin documentar)
- CLAUDE.md principal (~1000 líneas)
- Workflow de 4 fases (Planning → Implementation → Validation → Finalization)
- Documentación en `.claude/docs/` (standards, workflows, templates)

**Problemas Identificados:**
- **Complejidad excesiva**: 25 agentes pueden ser demasiados para mantener
- **Documentación desincronizada**: READMEs con conteos incorrectos
- **Confusión de responsabilidades**: Overlap entre skills, commands y agents
- **CLAUDE.md muy extenso**: Difícil de mantener y navegar
- **Workflow rígido**: No se adapta bien a cambios pequeños vs grandes features
- **Baja discoverabilidad**: No siempre está claro qué tool usar cuándo

### Valor de Negocio

**Beneficios Esperados:**
- ⚡ **Mayor velocidad**: Reducción de overhead en decisiones y planificación
- 🎯 **Mayor claridad**: Mejor comprensión de qué tool usar cuándo
- 🔧 **Mejor mantenibilidad**: Sistema más fácil de actualizar y evolucionar
- 📚 **Mejor onboarding**: Nuevos colaboradores entienden el sistema más rápido
- 🚀 **Mayor agilidad**: Soporte para quick fixes sin burocracia

### Usuarios Objetivo

1. **Desarrollador principal** (tú): Necesita trabajar eficientemente con Claude Code
2. **Claude Code**: Necesita decisiones claras sobre qué herramientas usar
3. **Futuros colaboradores**: Necesitan onboarding rápido y claro

---

## 2. User Stories

### US-1: Desarrollador Iniciando una Nueva Feature Grande

**Como** desarrollador principal
**Quiero** tener un camino claro y eficiente para iniciar una nueva feature grande
**Para** no perder tiempo decidiendo qué herramientas usar y asegurar planificación completa

#### Acceptance Criteria

- [ ] Puedo identificar en <30 segundos si necesito workflow completo o simplificado
- [ ] Hay un comando obvio para iniciar (`/start-feature-plan`)
- [ ] El flujo me guía paso a paso sin ambigüedad
- [ ] La planificación genera todos los artefactos necesarios
- [ ] No hay pasos redundantes o innecesarios
- [ ] El resultado es un plan ejecutable y traceable

**Prioridad:** Alta
**Complejidad:** Media

---

### US-2: Desarrollador Haciendo un Quick Fix

**Como** desarrollador principal
**Quiero** poder hacer cambios pequeños sin pasar por todo el workflow de 4 fases
**Para** mantener agilidad y no introducir burocracia innecesaria

#### Acceptance Criteria

- [ ] Puedo identificar claramente cuando un cambio califica como "quick fix"
- [ ] Existe un camino simplificado documentado
- [ ] No necesito crear PDR.md para cambios triviales
- [ ] Puedo saltar directamente a implementación con TDD
- [ ] `/quality-check` sigue siendo obligatorio antes de commit
- [ ] El sistema me advierte si un "quick fix" se está volviendo complejo

**Prioridad:** Alta
**Complejidad:** Media

---

### US-3: Desarrollador Manteniendo el Sistema de Workflow

**Como** desarrollador principal
**Quiero** que el sistema de workflow sea fácil de mantener y actualizar
**Para** que no se vuelva obsoleto o inconsistente con el tiempo

#### Acceptance Criteria

- [ ] Todos los READMEs reflejan la realidad (conteos correctos)
- [ ] Hay un proceso claro para agregar/modificar/eliminar tools
- [ ] Los cambios en un lugar se propagan automáticamente donde sea necesario
- [ ] CLAUDE.md no crece infinitamente (tamaño controlado)
- [ ] "Recent Learnings" se procesa regularmente (no se acumula)
- [ ] Existe documentación sobre cómo mantener el sistema

**Prioridad:** Alta
**Complejidad:** Media

---

### US-4: Nuevo Colaborador Entendiendo el Sistema

**Como** nuevo colaborador en el proyecto
**Quiero** entender rápidamente cómo funciona el sistema de desarrollo
**Para** poder contribuir productivamente sin sentirme abrumado

#### Acceptance Criteria

- [ ] Puedo entender los conceptos básicos en <15 minutos
- [ ] Hay una guía "Getting Started" clara
- [ ] CLAUDE.md tiene una estructura fácil de navegar
- [ ] Los ejemplos son concretos y prácticos
- [ ] Hay un glosario de términos (agent vs command vs skill)
- [ ] Puedo encontrar rápidamente la info que necesito

**Prioridad:** Media
**Complejidad:** Pequeña

---

### US-5: Claude Code Decidiendo Qué Tool Usar

**Como** Claude Code (agente IA)
**Quiero** tener reglas claras y un árbol de decisión para elegir tools
**Para** no perder tiempo ni tokens analizando opciones en cada interacción

#### Acceptance Criteria

- [ ] Existe un flowchart claro: "¿Qué tool usar?"
- [ ] Las descripciones de agents/commands/skills son inequívocas
- [ ] No hay overlap de responsabilidades entre tools
- [ ] Puedo tomar decisiones sin consultar múltiples documentos
- [ ] Las reglas están en un solo lugar fácil de referenciar
- [ ] Los casos edge tienen guidance explícita

**Prioridad:** Alta
**Complejidad:** Alta

---

### US-6: Desarrollador Sincronizando Planning con GitHub Issues

**Como** desarrollador principal
**Quiero** que el sync con GitHub Issues sea simple, automático y funcione offline-first
**Para** poder acceder a mis tareas desde cualquier dispositivo sin fricción

#### Acceptance Criteria

- [ ] El comando `/sync-planning` está documentado y es intuitivo
- [ ] El sistema funciona completamente offline (sync opcional, no bloqueante)
- [ ] Unified system: un solo package reemplaza `planning-sync` y `tools-todo-linear`
- [ ] Solo GitHub Issues (eliminación de soporte para Linear)
- [ ] Sistema de códigos únicos (PF-XXX, PR-XXX, PB-XXX) sin colisiones
- [ ] Detección automática de tareas completadas
- [ ] TODOs/HACKs del código se sincronizan automáticamente
- [ ] Sincronización al iniciar sesión: chequeo de consistencia automático y alertas
- [ ] Operaciones bulk eficientes (creación, actualización, borrado)
- [ ] Limpieza granular de issues (total, por PDR, por nombre)
- [ ] Los errores son descriptivos y accionables
- [ ] Graceful degradation cuando GitHub API falla
- [ ] Trazabilidad completa (commits registrados en TODOs.md)
- [ ] Documentación completa en P-003

**Relacionado con:** P-003 (GitHub Issues Sync - Sistema Unificado)

**Prioridad:** Alta
**Complejidad:** Alta

**Nota:** Este US se basa en el sistema unificado propuesto en P-003, donde:
- Package simplificado maneja CRUD básico y state tracking
- Agent `issue-enricher` maneja enriquecimiento con AI
- Sistema funciona offline-first
- Sync es "nice to have" no "must have"

---

## 3. Análisis del Estado Actual

### 3.1. Sistema de Agentes (25 agentes)

#### Agentes Existentes por Categoría

**Product & Planning (2):**
- ✅ `product-functional` - Creación de PDRs
- ✅ `product-technical` - Análisis técnico

**Architecture & Leadership (2):**
- ✅ `tech-lead` - Liderazgo técnico
- ⚠️ `architecture-validator` - Validación arquitectónica

**Backend Development (3):**
- ✅ `hono-engineer` - APIs con Hono
- ✅ `db-engineer` - Database & Drizzle
- ⚠️ `backend-reviewer` - Code review backend

**Frontend Development (4):**
- ✅ `astro-engineer` - Astro web app
- ✅ `react-dev` - React components
- ✅ `tanstack-engineer` - TanStack admin panel
- ⚠️ `frontend-reviewer` - Code review frontend

**Design & UX (1):**
- ✅ `ui-ux-designer` - UI/UX design

**Quality Assurance (2):**
- ✅ `qa-engineer` - Testing & QA
- ✅ `debugger` - Bug investigation

**Specialized Engineering (5):**
- ❓ `security-engineer` - Security audits
- ❓ `performance-engineer` - Performance optimization
- ❓ `accessibility-engineer` - WCAG compliance
- ⚠️ `i18n-specialist` - Internacionalización
- ✅ `payments-specialist` - Mercado Pago

**DevOps & Infrastructure (2):**
- ❓ `deployment-engineer` - Deployments
- ❓ `cicd-engineer` - CI/CD pipelines

**Documentation & Maintenance (4):**
- ✅ `tech-writer` - Documentación técnica
- ⚠️ `dependency-mapper` - Tracking dependencias
- ⚠️ `changelog-specialist` - Changelogs
- ❓ `prompt-engineer` - Optimización prompts AI

#### Leyenda
- ✅ **Esencial**: Usado frecuentemente, valor claro
- ⚠️ **Cuestionable**: Podría consolidarse o redefinirse
- ❓ **Evaluar**: Raramente usado, valor incierto

#### Problemas Identificados

1. **Especialización excesiva**: 25 agentes es mucho para un equipo de 1-2 personas
2. **Overlap funcional**:
   - `backend-reviewer` vs `tech-lead` (ambos hacen code review)
   - `architecture-validator` vs `tech-lead` (ambos validan arquitectura)
   - `dependency-mapper` vs `tech-writer` (ambos documentan)
3. **Agentes infrautilizados**:
   - `prompt-engineer` - ¿Cuándo se usa?
   - `accessibility-engineer` - ¿Se usa en cada feature?
   - `performance-engineer` - ¿Se usa en cada feature?
4. **Confusión de responsabilidades**: No siempre está claro cuál agente invocar

---

### 3.2. Sistema de Comandos (15 comandos)

#### Comandos Documentados en README (12)

**Planning (2):**
- ✅ `/start-feature-plan` - Iniciar planning completo
- ✅ `/start-refactor-plan` - Planning para refactors

**Quality Assurance (3):**
- ✅ `/quality-check` - Check completo de calidad
- ✅ `/code-check` - Lint + typecheck
- ✅ `/run-tests` - Ejecutar tests con coverage

**Code Review (4):**
- ✅ `/review-code` - Code review completo
- ⚠️ `/review-security` - Security audit
- ⚠️ `/review-performance` - Performance analysis
- ⚠️ `/pen-test` - Penetration testing

**Development (2):**
- ✅ `/add-new-entity` - Crear entidad full-stack
- ✅ `/update-docs` - Actualizar documentación

**Git (1):**
- ✅ `/commit` - Generar commits convencionales

**Analysis (1):**
- ✅ `/five-why` - Root cause analysis

#### Comandos NO Documentados en README (3)

- ❌ `/format-markdown` - Formatear markdown
- ❌ `/sync-planning` - Sincronizar con Linear
- ❌ `/rule2hook` - ¿Propósito desconocido?

#### Problemas Identificados

1. **README desactualizado**: Dice 12 pero hay 15
2. **Comandos sin documentar**: 3 comandos existen pero no están en README
3. **Overlap con skills**: `format-markdown` (comando) vs `markdown-formatter` (skill)
4. **Comandos especializados subutilizados**:
   - `/pen-test` - ¿Cuándo realmente se usa?
   - `/review-security` vs `/pen-test` - ¿Diferencia?
   - `/review-performance` - ¿Parte de `/quality-check`?
5. **Discoverabilidad**: No hay comando `/help` o lista interactiva

---

### 3.3. Sistema de Skills (5 skills)

#### Skills Documentados en README (4)

- ✅ `web-app-testing` - Estrategia de testing
- ✅ `git-commit-helper` - Commits convencionales
- ✅ `brand-guidelines` - Branding Hospeda
- ✅ `qa-criteria-validator` - Validar acceptance criteria

#### Skills NO Documentados en README (1)

- ❌ `markdown-formatter` - Formateo de markdown

#### Problemas Identificados

1. **README desactualizado**: Dice 4 pero hay 5
2. **Confusión skill vs command**:
   - ¿Cuándo usar `markdown-formatter` skill vs `/format-markdown` command?
   - ¿Cuál es la diferencia conceptual?
3. **Definición poco clara**:
   - README dice "skills son capacidades que agents usan"
   - Pero parece que también se invocan directamente
   - ¿Cuándo es skill vs command vs agent?
4. **Overlap con comandos**:
   - `git-commit-helper` skill vs `/commit` command
   - Ambos generan commits convencionales

---

### 3.4. CLAUDE.md (Archivo Principal)

#### Estructura Actual (~1000 líneas)

```
1. Table of Contents
2. Project Overview
3. Tech Stack
4. Monorepo Structure
5. Team Organization
   - Subagents (25)
   - Commands (12)
   - Skills (4)
   - MCP Servers (15)
6. Development Workflow
7. Core Principles
8. Communication Rules
9. Quick Reference
10. Recent Learnings
```

#### Problemas Identificados

1. **Longitud excesiva**: ~1000 líneas es difícil de mantener
2. **Mix de niveles**: Quick reference + documentación detallada
3. **Repetición**: Mucha info duplicada en otros docs
4. **Recent Learnings al final**: Se pierde, crece sin control
5. **Difícil navegación**: Demasiado scroll para encontrar info
6. **Conteos desactualizados**:
   - Dice "12 commands" pero hay 15
   - Dice "4 skills" pero hay 5
7. **No es modular**: Cambios requieren editar archivo masivo

#### Contenido Que Podría Moverse

- **Detalles de agentes** → Ya está en `.claude/agents/README.md`
- **Detalles de comandos** → Ya está en `.claude/commands/README.md`
- **Detalles de skills** → Ya está en `.claude/skills/README.md`
- **Standards detallados** → Ya está en `.claude/docs/standards/`
- **Workflows detallados** → Ya está en `.claude/docs/workflows/`

---

### 3.5. Organización de Documentación

#### Estructura Actual

```
.claude/
├── agents/
│   ├── README.md
│   └── *.md (25 archivos)
├── commands/
│   ├── README.md
│   └── *.md (15 archivos)
├── skills/
│   ├── README.md
│   └── *.md (5 archivos)
└── docs/
    ├── standards/
    │   ├── code-standards.md
    │   ├── architecture-patterns.md
    │   ├── testing-standards.md
    │   └── documentation-standards.md
    ├── workflows/
    │   ├── phase-1-planning.md
    │   ├── phase-2-implementation.md
    │   ├── phase-3-validation.md
    │   ├── phase-4-finalization.md
    │   ├── task-atomization.md
    │   └── task-completion-protocol.md
    ├── templates/
    │   ├── PDR-template.md
    │   ├── tech-analysis-template.md
    │   └── TODOs-template.md
    └── mcp-servers.md
```

#### Problemas Identificados

1. **Falta index general**: No hay un mapa de toda la documentación
2. **Links rotos**: Cambios en un doc no actualizan referencias
3. **Difícil descubrimiento**: No está claro qué doc leer primero
4. **No hay changelog**: Difícil saber qué cambió
5. **Falta guía rápida**: No hay "quick start" para nuevos colaboradores

---

### 3.6. Workflow de 4 Fases

#### Fases Actuales

**Fase 1: Planning**
- Crear sesión en `.claude/sessions/planning/{feature}/`
- Invocar `product-functional` → PDR.md
- Invocar `product-technical` → tech-analysis.md
- Atomizar tareas
- Crear TODOs.md
- Obtener aprobación usuario

**Fase 2: Implementation**
- Seguir TDD (RED → GREEN → REFACTOR)
- Implementar según plan
- Actualizar TODOs.md
- Ejecutar `/code-check` frecuentemente

**Fase 3: Validation**
- Invocar `qa-engineer` con `qa-criteria-validator`
- Ejecutar `/quality-check`
- Invocar `tech-lead` para review global
- Iterar hasta aprobación

**Fase 4: Finalization**
- Invocar `tech-writer` → Actualizar docs
- Ejecutar `/commit` → Generar commits
- Presentar commits al usuario
- Usuario hace commits manualmente

#### Problemas Identificados

1. **Demasiado rígido**: No se adapta a cambios pequeños
2. **Overhead para quick fixes**: Un typo no necesita PDR completo
3. **Múltiples validations redundantes**:
   - `/code-check` durante implementación
   - `/quality-check` en validación
   - `qa-engineer` validation
   - `tech-lead` review
   - ¿Son todos necesarios siempre?
4. **Proceso manual de commits**: Usuario tiene que copiar/pegar
5. **Falta guía para casos intermedios**: ¿Qué hacer con un bugfix de complejidad media?

---

### 3.7. Diferencia Conceptual: Comando vs Skill vs Agent

Una de las mayores fuentes de confusión en el sistema actual es la falta de claridad sobre cuándo algo debe ser un comando, un skill o un agent. Esta sección establece definiciones claras y criterios de decisión.

#### 🎭 AGENT = Persona/Rol con Responsabilidades

**¿Qué es?**
- Un rol especializado con expertise específica
- Una "persona virtual" con responsabilidades claras
- Puede ejecutar trabajo complejo y tomar decisiones

**¿Cómo se usa?**
- Claude lo invoca con Task tool: `subagent_type="agent-name"`
- Trabaja autónomamente en su área de expertise
- Puede usar skills como referencia durante su trabajo

**¿Qué produce?**
- Archivos (PDR.md, tech-analysis.md, reports)
- Análisis y recomendaciones
- Código generado
- Decisiones técnicas

**Ejemplos actuales:**
- `product-functional` → Crea PDRs completos
- `db-engineer` → Diseña schemas y migrations
- `qa-engineer` → Valida quality y crea tests

**Criterio de creación:**
- ✅ Crear agent si representa un ROL distinto con responsabilidades claras
- ✅ Si requiere análisis profundo y decisiones autónomas
- ✅ Si se usa en múltiples partes del workflow
- ❌ NO crear si solo ejecuta una secuencia simple de comandos

---

#### 🔧 COMMAND = Acción Ejecutable

**¿Qué es?**
- Una acción específica de principio a fin
- Una secuencia automatizada de pasos
- Un "botón" que presionas para hacer algo

**¿Cómo se usa?**
- Se invoca con `/command-name`
- Usuario puede invocarlo directamente: "usa `/quality-check`"
- Claude puede invocarlo cuando detecta la necesidad

**¿Qué hace internamente?**
- Ejecuta comandos bash
- Invoca agents para trabajo especializado
- Genera archivos o reports
- Orquesta un proceso completo

**Ejemplos actuales:**
- `/start-feature-plan` → Crea sesión + invoca agents + genera planning
- `/quality-check` → Ejecuta lint + typecheck + tests + reviews
- `/commit` → Analiza cambios + genera comandos git

**Criterio de creación:**
- ✅ Crear command si el usuario querría invocarlo directamente
- ✅ Si orquesta múltiples pasos en un proceso conocido
- ✅ Si produce output concreto (archivos, reports, comandos)
- ❌ NO crear si solo es conocimiento/metodología sin ejecución

---

#### 📚 SKILL = Conocimiento/Metodología

**¿Qué es?**
- Un "manual de expertise" especializado
- Una metodología o conjunto de best practices
- Conocimiento que un agent consulta durante su trabajo

**¿Cómo se usa?**
- **NO se invoca directamente** (no hay `/skill-name`)
- Un **agent** lo usa internamente mientras trabaja
- Es como un "libro de referencia" que el agent consulta

**¿Qué contiene?**
- Guías paso a paso
- Checklists de validación
- Best practices y patterns
- Criterios de calidad

**Ejemplos actuales:**
- `web-app-testing` → Metodología de testing que `qa-engineer` consulta
- `brand-guidelines` → Guías de marca que `ui-ux-designer` sigue
- `qa-criteria-validator` → Checklist que `qa-engineer` usa

**Criterio de creación:**
- ✅ Crear skill si es conocimiento reutilizable por múltiples agents
- ✅ Si proporciona guías/checklists/metodología
- ✅ Si NO ejecuta acciones, solo informa cómo hacerlas
- ❌ NO crear si solo 1 agent lo usa (incorporarlo al agent directamente)
- ❌ NO crear si ejecuta acciones (es un command, no un skill)

---

#### 🔄 Flujo de Relación

```
NIVEL 1: Usuario
         ↓ (invoca)
NIVEL 2: Comandos (/start-feature-plan, /quality-check)
         ↓ (invocan)
NIVEL 3: Agentes (product-functional, qa-engineer, tech-lead)
         ↓ (consultan)
NIVEL 4: Skills (brand-guidelines, web-app-testing)
```

**Ejemplo completo: Usuario pide quality check**

```
1. Usuario: "haz quality check"
   ↓
2. Claude invoca: /quality-check (COMANDO)
   ↓
3. COMANDO ejecuta:
   a. Bash: pnpm typecheck (acción directa)
   b. Bash: pnpm lint (acción directa)
   c. Bash: pnpm test (acción directa)
   d. Invoca AGENTE: qa-engineer
      ↓
      AGENTE qa-engineer:
      - Consulta SKILL: qa-criteria-validator (checklist)
      - Valida contra acceptance criteria
      - Genera report de validación
      ↓
   e. Invoca AGENTE: tech-lead
      ↓
      AGENTE tech-lead:
      - Revisa código completo
      - Valida arquitectura
      - Genera findings
      ↓
4. COMANDO consolida todo
   ↓
5. OUTPUT: quality-check-report.md
```

---

#### ⚠️ Anti-Patterns Actuales

**Problema 1: `markdown-formatter` skill + `/format-markdown` command**
- ❌ Duplicación: ambos formatean markdown
- ❌ El skill NO es usado por múltiples agents
- ❌ El skill ejecuta acciones en lugar de guiar
- ✅ **Solución**: Eliminar skill, mantener solo comando

**Problema 2: Agentes "on-demand" poco usados**
- ❌ `deployment-engineer` raramente se usa (Vercel es automático)
- ❌ `cicd-engineer` raramente se usa (CI/CD es simple)
- ✅ **Solución**: Eliminar estos agents

**Problema 3: Agentes que son "comandos disfrazados"**
- ❌ `security-engineer` básicamente ejecuta un checklist → debería ser comando
- ❌ `performance-engineer` básicamente ejecuta análisis → debería ser comando
- ✅ **Solución**: Convertir en comandos especializados

---

#### ✅ Matriz de Decisión

| ¿Qué necesitas? | ¿Qué crear? | Ejemplo |
|-----------------|-------------|---------|
| Usuario quiere ejecutar algo directamente | **COMANDO** | `/security-audit` |
| Necesitas orquestar múltiples pasos | **COMANDO** | `/start-feature-plan` |
| Necesitas un rol que analiza y decide | **AGENT** | `product-technical` |
| Necesitas expertise que genera deliverables | **AGENT** | `db-engineer` |
| Necesitas metodología reutilizable | **SKILL** | `web-app-testing` |
| Necesitas guías que múltiples agents usan | **SKILL** | `brand-guidelines` |

---

## 4. User Flows

### Flow 1: Nueva Feature Grande (Actual)

```
1. Usuario: "Quiero implementar autenticación OAuth"
2. Claude: Invoca /start-feature-plan
3. product-functional → Crea PDR.md
4. ui-ux-designer → Mockups
5. product-technical → tech-analysis.md
6. Claude: Atomiza tareas → TODOs.md
7. Usuario: Revisa y aprueba
8. Claude: Comienza Fase 2 (Implementation)
9. Para cada tarea:
   - RED: Escribe test
   - GREEN: Implementa
   - REFACTOR: Mejora
   - /code-check
10. Claude: Ejecuta Fase 3 (Validation)
    - qa-engineer + qa-criteria-validator
    - /quality-check
    - tech-lead review
11. Claude: Ejecuta Fase 4 (Finalization)
    - tech-writer → docs
    - /commit → genera comandos
12. Usuario: Copia/pega commits
```

**Tiempo estimado**: 2-8 horas (dependiendo del feature)
**Pasos**: ~15-20
**Documentos generados**: PDR, tech-analysis, TODOs, docs actualizados

---

### Flow 2: Quick Fix (Actual - Sin Guía Clara)

```
1. Usuario: "Hay un typo en el README"
2. Claude: ¿Debería hacer /start-feature-plan? 🤔
3. Claude: Asume que NO necesita planning completo
4. Claude: Edita archivo
5. Claude: /code-check (probablemente lint de markdown)
6. Claude: ¿Hace /quality-check? ¿O solo /code-check?
7. Claude: /commit
8. Usuario: Copia/pega commit
```

**Tiempo estimado**: 5-15 minutos
**Pasos**: ~4-6
**Problema**: No hay guía oficial, Claude improvisa

---

### Flow 3: Bugfix de Complejidad Media (Actual - Ambiguo)

```
1. Usuario: "El formulario de booking no valida fechas correctamente"
2. Claude: ¿Necesita PDR? ¿O puede ir directo a implementación?
3. Claude: ¿Usa /five-why para analizar causa raíz?
4. Claude: ¿Crea mini-plan o va directo a TDD?
5. Claude: Implementa con TDD
6. Claude: /quality-check
7. Claude: /commit
8. Usuario: Copia/pega commit
```

**Tiempo estimado**: 30-90 minutos
**Pasos**: ~6-10
**Problema**: No está claro cuándo usar qué nivel de rigor

---

### Flow 4: Mantenimiento del Sistema (Actual - Sin Proceso)

```
1. Alguien nota: "Los READMEs están desactualizados"
2. ¿Quién/cómo se actualiza?
3. ¿Hay checklist de qué verificar?
4. ¿Hay proceso de sync entre docs?
5. Usuario: Actualiza manualmente, espera no olvidar nada
```

**Tiempo estimado**: Variable
**Pasos**: Ad-hoc
**Problema**: No hay proceso definido

---

## 5. Propuestas de Mejora

### 5.1. Consolidación de Agentes

#### Propuesta: Reducir de 25 a 12 Agentes Core

**Contexto**: Para un monorepo con equipo de 1-2 personas, 25 agentes es excesivo. La propuesta aplica principio KISS: mantener solo agentes esenciales, eliminar overlap, y convertir auditorías especializadas en comandos invocables.

---

#### Agentes a ELIMINAR (fusionar responsabilidades) - 6 agentes

1. ❌ `architecture-validator` → **Fusionar en `tech-lead`**
   - **Razón**: Overlap total, tech-lead puede validar arquitectura
   - **Impacto**: Zero - tech-lead ya hace esto

2. ❌ `backend-reviewer` → **Fusionar en `tech-lead`**
   - **Razón**: tech-lead hace review general incluyendo backend
   - **Impacto**: Zero - centraliza code review en un solo agent

3. ❌ `frontend-reviewer` → **Fusionar en `tech-lead`**
   - **Razón**: tech-lead hace review general incluyendo frontend
   - **Impacto**: Zero - centraliza code review en un solo agent

4. ❌ `dependency-mapper` → **Fusionar en `tech-writer`**
   - **Razón**: Documentación de dependencias es parte de docs técnicos
   - **Impacto**: Zero - tech-writer maneja toda la documentación

5. ❌ `changelog-specialist` → **Fusionar en `tech-writer`**
   - **Razón**: Changelogs son documentación técnica
   - **Impacto**: Zero - tech-writer genera todos los docs

6. ❌ `prompt-engineer` → **Eliminar completamente**
   - **Razón**: Uso extremadamente raro, no justifica agente dedicado
   - **Impacto**: Mínimo - si se necesita, búsqueda web o docs

---

#### Agentes a ELIMINAR (convertir en comandos) - 3 agentes

Estos agentes ejecutan auditorías/análisis específicos con outputs concretos → Son mejores como comandos invocables.

7. ❌ `security-engineer` → ✨ **COMANDO**: `/security-audit`
   - **Razón**: Ejecuta checklist de seguridad → acción específica, no análisis profundo
   - **Qué hace el comando**:
     - Revisa autenticación/autorización
     - Valida input sanitization
     - Chequea SQL injection risks
     - Verifica dependency vulnerabilities
     - Genera `security-audit-report.md`
   - **Impacto**: Positivo - usuario puede invocar directamente cuando necesite

8. ❌ `performance-engineer` → ✨ **COMANDO**: `/performance-audit`
   - **Razón**: Ejecuta análisis de performance → acción específica, no optimización continua
   - **Qué hace el comando**:
     - Analiza bundle sizes
     - Chequea database query performance
     - Valida Core Web Vitals
     - Identifica bottlenecks
     - Genera `performance-audit-report.md`
   - **Impacto**: Positivo - auditorías bajo demanda cuando se necesiten

9. ❌ `accessibility-engineer` → ✨ **COMANDO**: `/accessibility-audit`
   - **Razón**: Ejecuta validación WCAG → checklist específico, no diseño accesible
   - **Qué hace el comando**:
     - Valida WCAG AA compliance
     - Chequea keyboard navigation
     - Verifica screen reader support
     - Valida color contrast
     - Genera `accessibility-audit-report.md`
   - **Impacto**: Positivo - auditorías cuando se necesite verificar compliance

---

#### Agentes a ELIMINAR (sin reemplazo) - 2 agentes

Estos agentes raramente se usan porque el stack actual es simple y automatizado.

10. ❌ `deployment-engineer` → **Eliminar completamente**
    - **Razón**: Vercel maneja deployment automático, no se necesita expertise especial
    - **Stack actual**: Vercel (push to main → auto deploy)
    - **Impacto**: Zero - deployment es automático
    - **Si se necesita en el futuro**: Crear comando específico o agent temporal

11. ❌ `cicd-engineer` → **Eliminar completamente**
    - **Razón**: CI/CD actual es simple (lint, typecheck, test en GitHub Actions)
    - **Stack actual**: GitHub Actions con workflow básico
    - **Impacto**: Zero - pipeline actual es mantenible sin agent dedicado
    - **Si se necesita en el futuro**: Crear cuando el CI/CD se vuelva complejo

---

#### Agentes CORE que PERMANECEN (13 agentes)

Estos son los agentes esenciales para el workflow diario del monorepo:

✅ **Product & Planning (2):**
- `product-functional` - Crea PDRs con user stories y acceptance criteria
- `product-technical` - Análisis técnico y arquitectura

✅ **Leadership (1):**
- `tech-lead` - Liderazgo técnico + arquitectura + code review completo (consolidado)

✅ **Backend (2):**
- `hono-engineer` - APIs con Hono framework
- `db-drizzle-engineer` - Database design con Drizzle ORM, migrations (más específico)

✅ **Frontend (3):**
- `astro-engineer` - Astro web app (apps/web)
- `react-senior-dev` - React 19 components expert (compartidos)
- `tanstack-start-engineer` - TanStack Start admin panel (apps/admin) (más específico)

✅ **Design (1):**
- `ux-ui-designer` - UX/UI design, mockups, user flows

✅ **Quality (2):**
- `qa-engineer` - Testing strategy, QA validation, acceptance criteria
- `debugger` - Bug investigation y troubleshooting

✅ **Specialized (1):**
- `i18n-specialist` - Internacionalización (crítico para Hospeda)

✅ **Documentation (1):**
- `tech-writer` - Docs técnicos + dependencies + changelogs (consolidado)

**Cambios respecto a propuesta original:**
- ✏️ `db-engineer` → `db-drizzle-engineer` (más específico al ORM)
- ✏️ `react-dev` → `react-senior-dev` (nivel de expertise más claro)
- ✏️ `tanstack-engineer` → `tanstack-start-engineer` (específico a TanStack Start)
- ✏️ `ui-ux-designer` → `ux-ui-designer` (orden UX primero)
- 🗑️ `payments-specialist` → Eliminado (decisión del usuario, Mercado Pago se manejará con docs/web)

---

#### Resultado Final

**Antes:**
- 25 agentes totales
- Overlap y confusión
- Difícil de mantener

**Después:**
- **13 agentes core** (uso diario)
- **3 comandos de auditoría** (uso bajo demanda)
- **12 agentes eliminados** (6 fusionados, 3 eliminados, 3 convertidos a comandos)

**Simplificación**: **48% reducción** (de 25 a 13)

**Beneficios:**
- ✅ Cada agent tiene propósito claro y no-overlapping
- ✅ Nombres más específicos reflejan expertise (drizzle, tanstack-start, senior)
- ✅ Más fácil de mantener y documentar
- ✅ Auditorías especializadas disponibles como comandos
- ✅ Aplicación del principio KISS
- ✅ Más rápido para Claude decidir qué agent invocar

---

### 5.2. Reestructuración de Comandos

#### Propuesta: 18 Comandos Bien Definidos (sin overlap) + Meta-Commands

**Comandos CORE a MANTENER (9):**

1. ✅ `/start-feature-plan` - Planning completo para features grandes
2. ✅ `/start-refactor-plan` - Planning para refactors
3. ✅ `/quality-check` - Validación completa (lint + typecheck + tests + reviews)
4. ✅ `/code-check` - Quick check (solo lint + typecheck)
5. ✅ `/run-tests` - Ejecutar tests con coverage
6. ✅ `/add-new-entity` - Scaffold entidad full-stack
7. ✅ `/update-docs` - Actualizar documentación
8. ✅ `/commit` - Generar commits convencionales
9. ✅ `/five-why` - Root cause analysis (mantener, útil para debugging)

---

**Comandos a CONSOLIDAR/ELIMINAR (4):**

9. ❌ `/review-security` + `/pen-test` → **Ya eliminados**
   - Reemplazados por `/security-audit` (nuevo, ver abajo)

10. ❌ `/review-performance` → **ELIMINAR**
    - Razón: Performance audit disponible como `/performance-audit` (nuevo)
    - Alternativa: Incluir performance básico en `/quality-check`

11. ❌ `/review-code` → **ELIMINAR**
    - Razón: Redundante con `/quality-check` que ya invoca tech-lead

12. ❌ `/rule2hook` → **ELIMINAR**
    - Convierte reglas en hooks automáticos
    - Decisión del usuario: Eliminar por ahora, configurar hooks manualmente

---

**Comandos de AUDITORÍA (3):**

10. ✨ `/security-audit` → **CREAR NUEVO**
    - Reemplaza `security-engineer` agent
    - Auditoría de seguridad completa
    - Genera `security-audit-report.md`

11. ✨ `/performance-audit` → **CREAR NUEVO**
    - Reemplaza `performance-engineer` agent
    - Análisis de performance completo
    - Genera `performance-audit-report.md`

12. ✨ `/accessibility-audit` → **CREAR NUEVO**
    - Reemplaza `accessibility-engineer` agent
    - Validación WCAG AA compliance
    - Genera `accessibility-audit-report.md`

---

**Comandos de UTILIDAD (2):**

13. ✨ `/sync-planning` → **DOCUMENTAR**
    - Ya existe pero no está en README
    - Sincronizar planning session con Linear
    - **Nota**: Será refactorizado según planning workflow nuevo

14. ✨ `/format-md` → **RENOMBRAR**
    - De `/format-markdown` a `/format-md` (más corto)
    - Formatear archivos markdown del proyecto
    - Eliminar skill `markdown-formatter` (duplicación)

---

**META-COMMANDS (Extensibilidad del Sistema) - ⭐ NUEVOS (4):**

15. ✨ `/create-agent` → **CREAR NUEVO**
    - Scaffold de nuevo agent con template correcto
    - Genera archivo `.md` con YAML frontmatter
    - Agrega modelo óptimo según descripción
    - Actualiza `.claude/agents/README.md` automáticamente

16. ✨ `/create-command` → **CREAR NUEVO**
    - Scaffold de nuevo comando con template correcto
    - Genera archivo `.md` con estructura estándar
    - Actualiza `.claude/commands/README.md` automáticamente

17. ✨ `/create-skill` → **CREAR NUEVO**
    - Scaffold de nuevo skill con template correcto
    - Genera archivo `.md` con YAML frontmatter
    - Actualiza `.claude/skills/README.md` automáticamente

18. ✨ `/help` → **CREAR NUEVO**
    - Listar todos los comandos con descripción breve
    - `/help [command-name]` para detalles de comando específico
    - Búsqueda por categoría o nombre

---

#### Resultado Final

**Antes:**
- 15 comandos (12 documentados + 3 sin documentar)
- Overlap entre security/pen-test/review-performance
- Confusión sobre cuál usar cuándo

**Después:**
- **18 comandos** bien definidos y categorizados
- **0 overlap** entre comandos
- **Todos documentados** en README
- **4 Meta-Commands** para extensibilidad del sistema
- Eliminados: review-code, review-security, pen-test, review-performance, rule2hook (5 comandos)

**Categorías:**

📋 **Planning (2):**
- `/start-feature-plan`
- `/start-refactor-plan`

✅ **Quality (3):**
- `/quality-check` (completo)
- `/code-check` (rápido)
- `/run-tests`

🔍 **Auditorías Especializadas (3):**
- `/security-audit` ⭐ NUEVO
- `/performance-audit` ⭐ NUEVO
- `/accessibility-audit` ⭐ NUEVO

🛠️ **Development (2):**
- `/add-new-entity`
- `/update-docs`

📝 **Docs & Git (2):**
- `/format-md`
- `/commit`

🔗 **Integration (1):**
- `/sync-planning`

🐛 **Analysis (1):**
- `/five-why`

🤖 **Meta-Commands (4):** ⭐ NUEVOS
- `/create-agent` - Crear agentes
- `/create-command` - Crear comandos
- `/create-skill` - Crear skills
- `/help` - Ayuda y búsqueda

---

**Beneficios:**
- ✅ Comandos de auditoría especializados (antes eran agents)
- ✅ Usuario puede invocar auditorías cuando necesite
- ✅ **Sistema auto-extensible** (meta-commands)
- ✅ Eliminado overlap y redundancia
- ✅ Todos documentados y descubribles
- ✅ Naming consistente y claro
- ✅ Facilita agregar nuevos agents/commands/skills sin edición manual de READMEs

---

### 5.3. Expansión y Clarificación de Skills

#### Propuesta: 16 Skills Especializados (de 4-6 a 16)

**Principio de Diseño (sin cambios):**

- **Command**: Acción que Claude ejecuta (invoca agents, ejecuta pasos)
- **Skill**: Conocimiento especializado que un agent USA durante su trabajo
- **Agent**: Persona/rol con responsabilidades y usa skills

---

#### Skills EXISTENTES a MANTENER (4):

1. ✅ `web-app-testing` - Metodología de testing para web apps
   - Usado por: qa-engineer, astro-engineer, react-senior-dev

2. ✅ `brand-guidelines` - Guías de marca Hospeda
   - Usado por: ux-ui-designer, astro-engineer, react-senior-dev

3. ✅ `qa-criteria-validator` - Validación de acceptance criteria
   - Usado por: qa-engineer

4. ✅ `git-commit-helper` - Convenciones de commits (interno)
   - Usado por: comando `/commit` internamente
   - No expuesto directamente

---

#### Skills NUEVOS - Testing Especializados (3):

5. ✨ `api-app-testing` - Metodología de testing para APIs
   - **Usado por**: qa-engineer, hono-engineer
   - **Contenido**: Testing de endpoints, validación de schemas, tests de integración
   - **Razón**: Separar testing de web vs API para mayor especificidad

6. ✨ `performance-testing` - Testing de performance
   - **Usado por**: qa-engineer, comando `/performance-audit`
   - **Contenido**: Load testing, benchmarking, profiling, métricas Core Web Vitals
   - **Razón**: Performance es crítico, merece skill dedicado

7. ✨ `security-testing` - Testing de seguridad
   - **Usado por**: qa-engineer, comando `/security-audit`
   - **Contenido**: OWASP Top 10, penetration testing, vulnerability scanning
   - **Razón**: Security es crítico, merece skill dedicado

---

#### Skills NUEVOS - Development Patterns (2):

8. ✨ `tdd-methodology` - Metodología TDD detallada
   - **Usado por**: Todos los engineering agents
   - **Contenido**: RED-GREEN-REFACTOR, test patterns, mocking strategies
   - **Razón**: TDD es core del proyecto, necesita documentación centralizada

9. ✨ `error-handling-patterns` - Patrones de manejo de errores
   - **Usado por**: Todos los engineering agents
   - **Contenido**: Try-catch patterns, error boundaries, logging, user feedback
   - **Razón**: Consistencia en error handling across the stack

---

#### Skills NUEVOS - Technology Specialists (3):

10. ✨ `vercel-specialist` - Expertise en Vercel deployment
    - **Usado por**: tech-lead, astro-engineer, tanstack-start-engineer, hono-engineer
    - **Contenido**: Edge functions, ISR, deployment configs, environment variables, serverless functions
    - **Razón**: Vercel es la plataforma de deployment para todo el stack (frontend + API), necesita expertise

11. ✨ `shadcn-specialist` - Expertise en Shadcn UI
    - **Usado por**: ux-ui-designer, react-senior-dev, astro-engineer
    - **Contenido**: Component customization, theming, accessibility, best practices
    - **Razón**: Shadcn es el sistema de UI core, necesita expertise

12. ✨ `mermaid-diagram-specialist` - Creación de diagramas Mermaid
    - **Usado por**: tech-writer, product-technical, ux-ui-designer
    - **Contenido**: Syntax, diagram types (flowcharts, sequence, ERD, etc.)
    - **Razón**: Diagramas son parte importante de la documentación

---

#### Skills NUEVOS - Utilities & Automation (4):

13. ✨ `add-memory` ⭐ - Auto-learning y actualización de memoria
    - **Usado por**: Todos los agents
    - **Contenido**:
      - Detectar aprendizajes durante chat
      - Actualizar CLAUDE.md o documentación apropiada
      - Evitar repetir errores/búsquedas
    - **Razón**: Sistema debe aprender de errores y éxitos automáticamente
    - **Ejemplo**: Si sync falla 3 veces hasta encontrar solución, documentar la solución

14. ✨ `pdf-creator-editor` - Creación y edición de PDFs
    - **Usado por**: tech-writer
    - **Contenido**: PDF generation libraries, formatting, templates
    - **Razón**: Docs formales pueden necesitar PDF

15. ✨ `json-data-auditor` - Validación de JSON con schemas
    - **Usado por**: All engineer and dev agents (qa-engineer, db-drizzle-engineer, hono-engineer, astro-engineer, react-senior-dev, tanstack-start-engineer, tech-lead)
    - **Contenido**: JSON Schema validation, data correction, Zod schemas, configuration validation
    - **Razón**: Validar configuraciones y data files del proyecto - útil para cualquier engineer que trabaje con JSONs

16. ✨ `create-new-monorepo-app` - Scaffold de nueva app en monorepo
    - **Usado por**: tech-lead, comando `/create-app` (futuro)
    - **Contenido**:
      - TSConfig apropiado
      - Package.json con scripts
      - Dependencias iniciales
      - Estructura de folders
    - **Razón**: Onboarding rápido de nuevas apps en el monorepo

17. ✨ `create-new-monorepo-package` - Scaffold de nuevo package en monorepo
    - **Usado por**: tech-lead, comando `/create-package` (futuro)
    - **Contenido**: Similar a create-new-monorepo-app pero para packages
    - **Razón**: Onboarding rápido de nuevos packages en el monorepo

---

#### Skills a ELIMINAR (1):

❌ `markdown-formatter` → **ELIMINAR**
   - Razón: Duplicación con comando `/format-md`
   - No es conocimiento que agents usan, es acción ejecutable

---

#### Resultado Final:

**Antes:**
- 5 skills (4 documentados + 1 sin documentar)
- Poco coverage de especialidades

**Después:**
- **16 skills** especializados y bien categorizados
- Coverage completo: Testing, Patterns, Tech Specialists, Utilities
- **add-memory skill** para auto-learning del sistema ⭐
- **Monorepo scaffolding** para extensibilidad ⭐

**Categorías:**

🧪 **Testing (4):**
- `web-app-testing`, `api-app-testing`, `performance-testing`, `security-testing`

✅ **QA (2):**
- `qa-criteria-validator`, `git-commit-helper`

🎨 **Design (1):**
- `brand-guidelines`

💻 **Development Patterns (2):**
- `tdd-methodology`, `error-handling-patterns`

🛠️ **Technology Specialists (3):**
- `vercel-specialist`, `shadcn-specialist`, `mermaid-diagram-specialist`

🤖 **Utilities & Automation (4):**
- `add-memory`, `pdf-creator-editor`, `auditor-de-datos-json`, `create-new-monorepo-app`, `create-new-monorepo-package`

**Beneficios:**
- ✅ Coverage completo de especialidades del proyecto
- ✅ **Sistema auto-aprende** con `add-memory` skill
- ✅ Scaffolding automatizado de apps/packages
- ✅ Separación clara entre web testing vs API testing
- ✅ Expertise en tecnologías core (Vercel, Shadcn)
- ✅ Skills reutilizables por múltiples agents

---

### 5.4. Restructuración de CLAUDE.md

#### Propuesta: CLAUDE.md Modular (~300-400 líneas)

**Nueva Estructura:**

```markdown
# CLAUDE.md - Hospeda Project

## 1. Agent Identity & Core Responsibilities
[Quién es Claude en este proyecto]

## 2. Quick Start
- 🚀 For new features: Use `/start-feature-plan`
- 🐛 For bugs: Use `/start-bugfix` (nuevo)
- ⚡ For quick fixes: Follow Quick Fix Protocol (link)
- 📚 For docs: Use `/update-docs`

## 3. Project Essentials
- Tech Stack (breve, link a detalle)
- Monorepo Structure (breve, link a detalle)
- Core Principles (KISS, TDD, YAGNI)

## 4. Workflow Overview
- 4-Phase Workflow (descripción breve)
- Decision Tree: When to use which workflow? (link)
- Link a workflows detallados en .claude/docs/workflows/

## 5. Tools Quick Reference
- 12 Core Agents (link a .claude/agents/README.md)
- 10 Commands (link a .claude/commands/README.md)
- 5 Skills (link a .claude/skills/README.md)

## 6. Development Rules
- Language Policy (code: EN, chat: ES)
- Code Standards (link a standards/)
- Testing Requirements (TDD, 90% coverage)

## 7. Communication Guidelines
- How to present options
- When to consult user
- Response style

## 8. Recent Learnings (Max 10 items)
[Auto-archive to .claude/docs/learnings/YYYY-MM.md when >10]

## 9. Important Links
- Detailed Docs: .claude/docs/
- Standards: .claude/docs/standards/
- Workflows: .claude/docs/workflows/
- Templates: .claude/docs/templates/
```

**Cambios Clave:**

1. ✂️ **Reducir de ~1000 a ~300-400 líneas**
2. 📍 **Foco en links** a docs detalladas en lugar de repetir contenido
3. 🎯 **Quick Start** prominente al inicio
4. 📊 **Decision Trees** visuales para elegir workflow
5. 🗂️ **Recent Learnings limitado** a 10 items, resto archivado automáticamente

---

### 5.5. Mejoras en Documentación

#### Propuesta: Documentación Descubrible y Auto-Sincronizada

**Crear Nuevo Archivo: `.claude/docs/INDEX.md`**

```markdown
# Hospeda Development System - Documentation Index

## 📚 Start Here
1. [CLAUDE.md](../../CLAUDE.md) - Main instructions for Claude Code
2. [Quick Start Guide](./quick-start.md) - Get started in 15 minutes
3. [Glossary](./glossary.md) - Key terms (agent, command, skill, etc.)

## 🛠️ Tools
- [Agents](../agents/README.md) - 12 core agents (eliminados 13)
- [Commands](../commands/README.md) - 13 commands (3 nuevos de auditoría)
- [Skills](../skills/README.md) - 4 specialized knowledge modules

## 📐 Standards
- [Code Standards](./standards/code-standards.md)
- [Architecture Patterns](./standards/architecture-patterns.md)
- [Testing Standards](./standards/testing-standards.md)
- [Documentation Standards](./standards/documentation-standards.md)

## 🔄 Workflows
- [Phase 1: Planning](./workflows/phase-1-planning.md)
- [Phase 2: Implementation](./workflows/phase-2-implementation.md)
- [Phase 3: Validation](./workflows/phase-3-validation.md)
- [Phase 4: Finalization](./workflows/phase-4-finalization.md)
- [Quick Fix Protocol](./workflows/quick-fix-protocol.md) ← NUEVO
- [Bugfix Workflow](./workflows/bugfix-workflow.md) ← NUEVO
- [Task Atomization](./workflows/task-atomization.md)
- [Task Completion Protocol](./workflows/task-completion-protocol.md)

## 📋 Templates
- [PDR Template](./templates/PDR-template.md)
- [Tech Analysis Template](./templates/tech-analysis-template.md)
- [TODOs Template](./templates/TODOs-template.md)

## 🔧 Maintenance
- [System Maintenance Guide](./maintenance/system-maintenance.md) ← NUEVO
- [Documentation Sync Process](./maintenance/doc-sync.md) ← NUEVO
- [Changelog](./CHANGELOG.md) ← NUEVO

## 📖 Archives
- [Learnings Archive](./learnings/) - Historical learnings by month
```

**Nuevos Documentos a Crear:**

1. ✨ `quick-start.md` - Onboarding de 15 minutos
2. ✨ `glossary.md` - Definiciones claras (agent vs command vs skill vs MCP)
3. ✨ `workflows/quick-fix-protocol.md` - Para cambios pequeños
4. ✨ `workflows/bugfix-workflow.md` - Para bugs de complejidad media
5. ✨ `maintenance/system-maintenance.md` - Cómo mantener el sistema
6. ✨ `maintenance/doc-sync.md` - Proceso de sync entre docs
7. ✨ `CHANGELOG.md` - Historial de cambios al sistema

**Script de Auto-Sincronización:**

```bash
# .claude/scripts/sync-docs.sh
# Verifica que conteos en READMEs coincidan con archivos reales
# Actualiza automáticamente o alerta si hay discrepancias
```

---

### 5.6. Planning System con Code Registry

#### Propuesta: Sistema de Tracking de Plannings

**Problema actual**: No hay registro centralizado de todas las plannings, difícil saber qué plannings existen, su estado, o encontrarlas.

**Solución propuesta**: Code Registry JSON + Códigos estructurados

---

#### Code Registry File

**Ubicación**: `.claude/sessions/planning/.code-registry.json`

**Estructura**:

```json
{
  "lastPlanningNumber": 4,
  "plannings": {
    "features": {
      "PF-001": {
        "name": "business-model-system",
        "issueId": "HOSP-123",
        "description": "Sistema de modelo de negocio completo",
        "totalTasks": 35,
        "completedTasks": 35,
        "status": "completed",
        "createdAt": "2025-10-15T10:30:00Z",
        "lastUpdate": "2025-10-20T15:45:00Z"
      },
      "PF-002": {
        "name": "accommodation-schedule",
        "issueId": "HOSP-145",
        "description": "Sistema de horarios de alojamiento",
        "totalTasks": 28,
        "completedTasks": 12,
        "status": "in-progress",
        "createdAt": "2025-10-22T09:00:00Z",
        "lastUpdate": "2025-10-28T14:20:00Z"
      }
    },
    "refactors": {
      "PR-001": {
        "name": "database-optimization",
        "issueId": "HOSP-156",
        "description": "Optimización de queries y índices de database",
        "totalTasks": 15,
        "completedTasks": 8,
        "status": "in-progress",
        "createdAt": "2025-10-25T11:00:00Z",
        "lastUpdate": "2025-10-29T16:30:00Z"
      }
    }
  }
}
```

---

#### Códigos de Planning

**Features**: `PF-XXX` (Planning Feature)
- Ejemplo: `PF-001-business-model-system`
- Formato: `PF-{número}-{feature-name-kebab-case}`

**Refactors**: `PR-XXX` (Planning Refactor)
- Ejemplo: `PR-001-database-optimization`
- Formato: `PR-{número}-{refactor-name-kebab-case}`

**Incremento**: Número secuencial global (no separado por tipo)
- PF-001, PR-002, PF-003, PR-004, etc.

---

#### Códigos de Tasks

**Task Principal**: `{PLANNING-CODE}-T-{número}`
- Ejemplo: `PF-002-T-001` (Task 1 del Feature 2)

**SubTask**: `{PLANNING-CODE}-T-{número}-{sub-número}`
- Ejemplo: `PF-002-T-003-002` (Subtask 2 del Task 3 del Feature 2)

**SubSubTask**: `{PLANNING-CODE}-T-{número}-{sub-número}-{sub-sub-número}`
- Ejemplo: `PF-002-T-003-002-001` (SubSubTask 1 del Subtask 2 del Task 3)

---

#### Workflow de Code Registry

**Al crear nuevo planning:**

1. Leer `.claude/sessions/planning/.code-registry.json`
2. Obtener `lastPlanningNumber`
3. Incrementar en 1
4. Generar código: `PF-{nuevo-número}` o `PR-{nuevo-número}`
5. Crear folder: `.claude/sessions/planning/{tipo}/{código}-{name}/`
6. Agregar entrada al registry
7. Commitear registry actualizado

**Al actualizar planning:**

1. Leer TODOs.md para contar tasks completadas
2. Actualizar `completedTasks` y `lastUpdate`
3. Actualizar `status` si corresponde
4. Commitear registry actualizado

**Estados posibles:**
- `planning` - En planificación (PDR no aprobado)
- `ready` - Planificado y aprobado, listo para implementar
- `in-progress` - En implementación
- `completed` - Todas las tasks completadas
- `paused` - Pausado temporalmente
- `cancelled` - Cancelado

---

#### Beneficios

- ✅ Tracking centralizado de todas las plannings
- ✅ Códigos únicos y rastreables
- ✅ Fácil encontrar planning por código o nombre
- ✅ Progress tracking automático
- ✅ Integración con GitHub Issues vía `issueId`
- ✅ Histórico completo de plannings

---

#### Comandos Relacionados

- `/list-plannings` (futuro) - Listar todas las plannings con filtros
- `/planning-status {code}` (futuro) - Ver estado de planning específico
- `/sync-planning` - Sincronizar con GitHub Issues (actualizado para usar registry)

---

### 5.7. Workflows Separados por Tipo

#### Propuesta: 3 Workflows + Decision Tree Inicial

**Nivel 1: Quick Fix (< 30 min)**

```
Criterios:
- Cambio trivial (typo, ajuste de estilo, actualización de docs)
- No afecta lógica de negocio
- Sin riesgo de regresión

Workflow:
1. Identificar como quick fix
2. Hacer cambio directo
3. /code-check
4. /run-tests (si aplica)
5. /commit
6. Usuario aprueba y commitea

Tiempo: 5-15 minutos
Docs generados: Ninguno (código directo)
```

**Nivel 2: Bugfix / Small Feature (30 min - 3 horas)**

```
Criterios:
- Cambio moderado (bugfix, small feature, refactor pequeño, small improvement, trivial new functionality, style changes)
- Afecta lógica pero scope limitado
- Puede tener casos edge

Workflow:
1. Generar código único: PB-XXX (Planning Bugfix/Small Feature)
2. Crear folder: .claude/sessions/planning/bugfix-small/PB-XXX-{nombre-descriptivo}/
3. Mini-análisis: /five-why si es bug
4. Crear tech-analysis.md simplificado (arquitectura, approach, risks)
5. Crear TODOs.md con tasks atomizadas
6. Sincronizar con GitHub Issues (/sync-planning)
7. TDD: implementar con tests
8. /quality-check
9. Actualizar CHANGELOG.md con cambio
10. /commit
11. Usuario aprueba y commitea

Tiempo: 30-180 minutos
Docs generados: tech-analysis.md, TODOs.md, issues en GitHub, CHANGELOG entry
Código: PB-XXX

Nota: Incluye bug fixes, small improvements (performance, security, small refactors),
trivial new features, style changes, etc.
```

**Nivel 3: Large Feature (> 3 horas)**

```
Criterios:
- Feature completa o refactor grande
- Múltiples componentes afectados
- Requiere planning detallado

Workflow:
1. /start-feature-plan o /start-refactor-plan (workflow completo actual)
2. product-functional → PDR.md (features) o refactor-plan.md
3. product-technical → tech-analysis.md
4. Atomizar tareas → TODOs.md
5. Sincronizar con GitHub Issues (/sync-planning)
6. Usuario aprueba
7. Implementación (Fase 2) con TDD
8. Agregar items al CHANGELOG.md cuando se termina cada PDR/refactor/quick fix
9. Validación (Fase 3) con /quality-check
10. Finalización (Fase 4) - docs y commits

Tiempo: 3-40+ horas
Docs generados: PDR/refactor-plan, tech-analysis, TODOs, CHANGELOG entries, docs actualizados, issues en GitHub
Código: PF-XXX (features) o PR-XXX (refactors)

Notas:
- Pueden agregarse múltiples entries al CHANGELOG durante el desarrollo según convenga
- Los agents o subagents pueden crear folders extras dentro de la planificación con archivos
  adicionales (notas, ejemplos, mockups, diagramas, etc.) para enriquecer la planificación
- Todos los archivos creados deben ser linkeados en los lugares correspondientes dentro de los
  archivos .md de la planificación
```

**Decision Tree Visual:**

```
¿Qué tan grande es el cambio?

├─ Trivial (typo, docs, estilo)
│  └─> NIVEL 1: Quick Fix Protocol
│
├─ Moderado (bug, small feature, <3h)
│  └─> NIVEL 2: Bugfix/Small Feature Workflow
│      ├─ Si es bug: /five-why primero
│      └─ Crear micro-plan (TODOs opcional)
│
└─ Grande (feature completa, refactor, >3h)
   └─> NIVEL 3: Full Planning Workflow
       └─ /start-feature-plan
```

---

## 6. Business Rules

### BR-1: Selección de Workflow

**Regla**: El workflow a usar se determina por complejidad estimada del cambio, no por tipo de cambio

**Criterios de Decisión:**

| Criterio | Quick Fix | Bugfix/Small | Large Feature |
|----------|-----------|--------------|---------------|
| **Tiempo estimado** | < 30 min | 30 min - 3h | > 3h |
| **Componentes afectados** | 1 | 1-3 | 3+ |
| **Archivos modificados** | 1-2 | 2-10 | 10+ |
| **Tests necesarios** | 0-2 | 2-10 | 10+ |
| **Riesgo de regresión** | Muy bajo | Bajo-Medio | Medio-Alto |
| **Requiere PDR** | No | No | Sí |
| **Requiere TODOs** | No | Opcional | Sí |

**Validación**: Si empiezas en nivel bajo y crece la complejidad, Claude debe alertar y sugerir subir de nivel

---

### BR-2: Uso de Agentes

**Regla**: Los agentes core se invocan según fase del workflow. Los agentes on-demand solo cuando hay necesidad específica.

**Agentes Core (siempre disponibles):**

- **Phase 1**: `product-functional`, `product-technical`, `ui-ux-designer`
- **Phase 2**: `hono-engineer`, `db-engineer`, `astro-engineer`, `react-dev`, `tanstack-engineer`, `i18n-specialist`, `payments-specialist`
- **Phase 3**: `qa-engineer`, `tech-lead`
- **Phase 4**: `tech-writer`
- **Ad-hoc**: `debugger` (cuando hay bugs)

**Agentes On-Demand (invocar explícitamente):**

- `security-engineer` - Auditorías de seguridad específicas
- `performance-engineer` - Optimizaciones de performance
- `accessibility-engineer` - Auditorías WCAG
- `deployment-engineer` - Despliegues complejos
- `cicd-engineer` - CI/CD complejos

**Validación**: Claude no debe invocar agentes on-demand sin preguntar primero al usuario

---

### BR-3: Separación Command vs Skill

**Regla**: Commands ejecutan acciones. Skills son conocimiento que agents usan.

**Commands:**
- Son invocables directamente por el usuario o Claude
- Ejecutan una secuencia de pasos
- Pueden invocar agents
- Producen outputs (archivos, reports)
- Ejemplos: `/start-feature-plan`, `/quality-check`, `/commit`

**Skills:**
- Son usadas por agents durante su trabajo
- No se invocan directamente
- Proporcionan metodología/conocimiento
- No tienen outputs directos
- Ejemplos: `web-app-testing`, `brand-guidelines`, `qa-criteria-validator`

**Validación**: Si algo puede ser invocado directamente → es command. Si es conocimiento que agent aplica → es skill.

---

### BR-4: Mantenimiento de Documentación

**Regla**: Cuando se agrega/modifica/elimina un tool, se deben actualizar TODOS los lugares relevantes

**Checklist de Actualización:**

Cuando se agrega/modifica/elimina un **Agent**:
- [ ] Archivo del agent en `.claude/agents/`
- [ ] `.claude/agents/README.md` (lista + conteo)
- [ ] `CLAUDE.md` (si es core agent)
- [ ] Workflows que lo mencionan

Cuando se agrega/modifica/elimina un **Command**:
- [ ] Archivo del command en `.claude/commands/`
- [ ] `.claude/commands/README.md` (lista + conteo)
- [ ] `CLAUDE.md` (quick reference)
- [ ] Workflows que lo usan

Cuando se agrega/modifica/elimina un **Skill**:
- [ ] Archivo del skill en `.claude/skills/`
- [ ] `.claude/skills/README.md` (lista + conteo)
- [ ] Agents que lo usan

**Validación**: Script automatizado `.claude/scripts/validate-docs.sh` verifica consistency

---

### BR-5: Recent Learnings Management

**Regla**: "Recent Learnings" en CLAUDE.md tiene máximo 10 items. Items más antiguos se archivan automáticamente como archivos individuales. CLAUDE.md debe linkear a todos los learnings archivados.

**Proceso:**

1. Cuando se agrega nuevo learning y hay ya 10 items:
   - Crear archivo individual en `.claude/docs/learnings/{descriptive-title-in-kebab-case}.md`
   - Agregar link al archivo en sección "Archived Learnings" de CLAUDE.md
   - Mantener solo los 10 más recientes inline en CLAUDE.md

2. Learnings archivados son archivos individuales con nombres descriptivos (un .md por learning):
   ```
   .claude/docs/learnings/
   ├── fish-shell-for-loop-hangs.md
   ├── monorepo-command-execution-from-root.md
   ├── test-organization-in-test-folder.md
   ├── markdown-formatting-standards.md
   ├── planning-linear-sync-workflow.md
   └── typescript-never-use-any-type.md
   ```

3. Cada learning archivado tiene estructura completa:
   ```markdown
   # {Descriptive Title}

   **Date**: YYYY-MM-DD
   **Category**: [Shell/Testing/Documentation/TypeScript/etc]

   ## Problem

   [Descripción detallada del problema encontrado]

   ## Solution

   [Solución implementada con ejemplos de código si aplica]

   ## Impact

   [Cómo esto mejora el workflow/código]

   ## Related

   - Link a issues/PRs relacionados (si aplica)
   - Link a docs relacionados
   ```

4. CLAUDE.md linkea a TODOS los learnings archivados:
   ```markdown
   ## Recent Learnings

   [Inline: últimos 10 learnings]

   ## Archived Learnings

   Ver learnings históricos en `.claude/docs/learnings/`:
   - [Fish Shell: For Loop Hangs](./.claude/docs/learnings/fish-shell-for-loop-hangs.md) - 2025-01-15
   - [Monorepo: Command Execution](./.claude/docs/learnings/monorepo-command-execution-from-root.md) - 2025-02-03
   - [Test Organization Standards](./.claude/docs/learnings/test-organization-in-test-folder.md) - 2025-02-20
   ...
   ```

**Beneficios:**
- ✅ Cada learning es fácil de encontrar por nombre descriptivo en kebab-case
- ✅ No se pierde contexto histórico
- ✅ CLAUDE.md no crece infinitamente
- ✅ CLAUDE.md linkea a TODOS los learnings archivados para fácil acceso
- ✅ Mejor organización que archivos por mes (un archivo por learning es más específico)

**Validación**: Si CLAUDE.md tiene >10 learnings inline, Claude debe archivar automáticamente el más antiguo

---

## 7. Mockups / UI Requirements

**Nota**: Esta optimización es principalmente de proceso/documentación, no requiere mockups de UI tradicionales.

### Diagramas Necesarios:

1. **Decision Tree: Qué Workflow Usar**
   - Visual flowchart para elegir entre Nivel 1/2/3
   - Formato: Mermaid diagram

2. **Agents Hierarchy**
   - Organigrama de 12 agents core + 5 on-demand
   - Mostrar agrupación por categorías
   - Formato: Mermaid diagram

3. **Tools Relationship**
   - Relación entre Commands, Skills, Agents
   - Quién usa qué
   - Formato: Mermaid diagram

4. **Documentation Map**
   - Mapa visual de toda la documentación
   - Rutas de navegación
   - Formato: Mermaid diagram o simple tree

Estos diagramas se crearán en `.claude/docs/diagrams/` y se referenciarán desde docs relevantes.

---

## 8. Non-Functional Requirements

### Performance

- **Decisión de workflow**: < 30 segundos para elegir nivel correcto
- **Búsqueda de docs**: < 60 segundos para encontrar info relevante
- **Actualización de docs**: Cambio en un lugar se sincroniza automáticamente

### Usability

- **Onboarding**: Nuevo colaborador productivo en < 30 minutos
- **Claridad**: Sin ambigüedad sobre qué tool usar cuándo
- **Discoverabilidad**: Fácil encontrar comandos/agents/docs

### Maintainability

- **Sync automático**: Conteos y listas se actualizan automáticamente
- **Modularidad**: Cambios localizados, no requieren editar 10 archivos
- **Validación**: Scripts detectan inconsistencias automáticamente

### Scalability

- **Growth**: Sistema puede crecer a 20 agents sin volverse caótico
- **Adaptabilidad**: Fácil agregar nuevos workflows sin romper existentes
- **Extensibilidad**: Nuevos colaboradores pueden agregar tools fácilmente

---

## 9. Dependencies

### Internal Dependencies

- Monorepo structure (must remain compatible)
- Existing agents/commands/skills (migration path needed)
- Current workflows (backward compatibility for in-progress features)
- `.claude/sessions/planning/` structure (must not break existing sessions)

### External Dependencies

**Ninguna**: Esta optimización es interna al proyecto, no requiere librerías externas.

**Herramientas Necesarias:**
- Scripts de validación (bash/node)
- Mermaid para diagramas
- Markdownlint para validación de docs

---

## 10. Success Metrics

### Quantitative Metrics

1. **Reducción de complejidad**
   - Actual: 25 agents → Target: 12 agents (52% reducción)
   - Actual: 15 comandos → Target: 13 comandos (eliminando overlap)
   - Actual: 5 skills → Target: 4 skills (eliminando duplicación)
   - Actual: ~1000 líneas CLAUDE.md → Target: ~300-400 líneas (60% reducción)

2. **Tiempo de decisión**
   - Actual: ~2-5 min para elegir tool → Target: <30 seg
   - Métrica: Tiempo desde request hasta acción

3. **Tiempo de onboarding**
   - Actual: No medido → Target: <30 min para ser productivo

4. **Docs sincronizados**
   - Actual: 3 READMEs desactualizados → Target: 0 desactualizados
   - Validación automática en CI

5. **Uso de workflows**
   - Quick fixes usando full workflow: 60% → Target: 0%
   - Large features sin planning: 10% → Target: 0%

### Qualitative Metrics

1. **Claridad del sistema**
   - Survey post-uso: "¿Fue claro qué tool usar?" (1-5)
   - Target: >4.5/5

2. **Satisfacción del usuario**
   - Survey: "¿El sistema es eficiente?" (1-5)
   - Target: >4.5/5

3. **Facilidad de mantenimiento**
   - Survey: "¿Es fácil mantener el sistema actualizado?" (1-5)
   - Target: >4.0/5

4. **Discoverabilidad**
   - Survey: "¿Pudiste encontrar la info que necesitabas?" (1-5)
   - Target: >4.5/5

---

## 11. Out of Scope

**NO se incluye en este proyecto:**

1. ❌ Nuevas features de producto Hospeda (solo optimización del workflow)
2. ❌ Cambios a herramientas de desarrollo (Vitest, Drizzle, etc.)
3. ❌ Automatización de commits (usuarios siguen commitando manualmente)
4. ❌ UI visual para explorar docs (solo markdown + mermaid diagrams)

**SÍ se incluye en este proyecto (aclaración):**

1. ✅ Cambios a la implementación técnica de agents (solo organización y documentación, no funcionalidad)
2. ✅ Migración de planning sessions existentes (compatibilidad backward garantizada)
3. ✅ Cambios al core de Claude Code (solo instrucciones/docs, no código del core)

---

## 12. Open Questions

Preguntas que necesitan input del usuario:

### Prioridad Alta

- [ ] **Q1**: ¿Estás de acuerdo con reducir de 25 a 12 agents?
  - ¿Fusionar reviewers y architecture-validator en tech-lead? → Sí/No
  - ¿Eliminar deployment-engineer y cicd-engineer? → Sí/No
  - ¿Convertir security/performance/accessibility en comandos? → Sí/No
  - ¿Hay algún agent que consideras imprescindible que marqué para eliminar?

- [ ] **Q2**: ¿Los 3 niveles de workflow tienen sentido?
  - Nivel 1: Quick Fix (<30 min, sin planning)
  - Nivel 2: Bugfix/Small (30 min-3h, micro-plan)
  - Nivel 3: Large Feature (>3h, planning completo)
  - Alternativa: Solo 2 niveles (Quick vs Full)

- [ ] **Q3**: ¿CLAUDE.md en ~300-400 líneas es suficiente?
  - Con links a documentación detallada en `.claude/docs/`
  - Alternativa: Mantener más contenido directo en CLAUDE.md

### Prioridad Media

- [x] **Q4**: ¿Quieres script automatizado de sync de docs o prefieres manual?
  - **Respuesta**: Automatizado - CI falla si hay inconsistencia

- [x] **Q5**: ¿Los "learnings" archivados deben estar en git o en otro lugar?
  - **Respuesta**: Git - Parte del repo, versionados

- [ ] **Q6**: ¿Qué tan seguido planeas agregar nuevos collaboradores?
  - **Respuesta**: Poco - No es prioridad alta pero el onboarding debe estar

### Prioridad Baja

- [x] **Q7**: ¿Quieres mantener `/five-why` command o es poco usado?
  - **Respuesta**: Sí, mantener por ahora

- [x] **Q8**: ¿El naming `/format-md` es mejor que `/format-markdown`?
  - **Respuesta**: Sí, `/format-md` es más corto

- [x] **Q9**: ¿Prefieres mermaid diagrams o imágenes estáticas para los flowcharts?
  - **Respuesta**: Mermaid diagrams

---

## 13. Risks & Mitigation

### Risk 1: Breaking Existing Workflows

**Probabilidad**: Media
**Impacto**: Alto

**Descripción**: Los cambios podrían romper planning sessions en progreso o confundir sobre cómo trabajar

**Mitigación**:
1. Implementar en branch separado
2. Mantener backward compatibility con workflows antiguos
3. Documentar cambios claramente en CHANGELOG
4. Período de transición con ambos sistemas disponibles
5. Migración gradual, no big-bang

---

### Risk 2: Resistencia al Cambio

**Probabilidad**: Baja
**Impacto**: Medio

**Descripción**: Puede ser difícil ajustarse a nuevos nombres/estructura después de usar sistema actual

**Mitigación**:
1. Los cambios simplifican, no complican
2. Involucrar al usuario en cada decisión (no imponer)
3. Crear guía de migración clara
4. Aliases/redirects para comandos renombrados
5. Quick reference card con cambios principales

---

### Risk 3: Over-Engineering la Solución

**Probabilidad**: Media
**Impacto**: Medio

**Descripción**: Podríamos crear un sistema más complejo tratando de simplificar

**Mitigación**:
1. Seguir principio KISS estrictamente
2. Validar cada propuesta: "¿Esto realmente simplifica?"
3. Priorizar remover sobre agregar
4. Prototipar cambios antes de implementar todos
5. Iterar en base a uso real, no teórico

---

### Risk 4: Documentación se Desincronizan Nuevamente

**Probabilidad**: Alta
**Impacto**: Medio

**Descripción**: Sin proceso, los docs volverán a desactualizarse con el tiempo

**Mitigación**:
1. Scripts de validación automática en CI
2. Checklist obligatorio en BR-4
3. Recent Learnings limitado a 10 (auto-archive)
4. Reviews periódicas (mensual) del estado de docs
5. Principio: "Si no está en CLAUDE.md, no existe"

---

## 14. Implementation Phases (High-Level)

### Phase 1: Planning & Approval (Esta Fase - Ahora)

**Duración estimada**: 2-4 horas

**Deliverables**:
- [x] PDR.md (este documento)
- [ ] tech-analysis.md (siguiente)
- [ ] TODOs.md atomizados (siguiente)
- [ ] User approval

---

### Phase 2: Quick Wins (1-2 días)

**Objetivo**: Arreglar problemas obvios sin romper nada

**Tareas**:
1. Actualizar READMEs con conteos correctos
2. Documentar comandos faltantes (format-markdown, sync-planning, rule2hook)
3. Crear `.claude/docs/INDEX.md`
4. Crear `quick-start.md` y `glossary.md`
5. Archivar learnings actuales a `.claude/docs/learnings/`

**Risk**: Bajo - Son solo updates de docs

---

### Phase 3: Consolidation (2-3 días)

**Objetivo**: Consolidar agents y commands

**Tareas**:
1. Fusionar agents (architecture-validator, reviewers → tech-lead)
2. Fusionar commands (review-security + pen-test → security-audit)
3. Actualizar referencias en todos los docs
4. Crear nueva estructura de CLAUDE.md (~300 líneas)
5. Mover contenido detallado a sub-docs

**Risk**: Medio - Requiere cambios en múltiples lugares

---

### Phase 4: New Workflows (3-5 días)

**Objetivo**: Implementar niveles de workflow flexibles

**Tareas**:
1. Crear `quick-fix-protocol.md`
2. Crear `bugfix-workflow.md`
3. Crear decision tree (mermaid diagrams)
4. Crear comando `/help`
5. Actualizar agents para seguir nuevos workflows

**Risk**: Medio - Cambios significativos en proceso

---

### Phase 5: Automation & Validation (1-2 días)

**Objetivo**: Scripts para mantener consistencia

**Tareas**:
1. Script de validación de docs (`validate-docs.sh`)
2. Script de sync automático
3. CI integration para validación
4. Tests de los scripts
5. Documentación de maintenance

**Risk**: Bajo - Opcional, agrega validación

---

### Phase 6: Documentation & Training (1 día)

**Objetivo**: Docs finales y onboarding

**Tareas**:
1. Finalizar todos los READMEs
2. Crear diagramas finales
3. Crear CHANGELOG completo
4. Testing de onboarding con usuario
5. Iteración basada en feedback

**Risk**: Bajo - Solo documentación

---

**Total Estimado**: 8-14 días de trabajo

---

## 15. Approval Checklist

Antes de proceder a tech-analysis.md, verificar:

### Product Owner Sign-Off

- [ ] ¿Estás de acuerdo con la visión general del proyecto?
- [ ] ¿Las user stories cubren tus necesidades?
- [ ] ¿Las propuestas de consolidación tienen sentido?
- [ ] ¿Los 3 niveles de workflow son adecuados?
- [ ] ¿La reducción de 25 a 12 agents core es aceptable?

### Scope Validation

- [ ] ¿El scope es manejable? ¿O es demasiado ambicioso?
- [ ] ¿Hay algo crítico que falta en el PDR?
- [ ] ¿Hay algo en scope que debería estar out of scope?
- [ ] ¿Las fases de implementación tienen sentido?

### Open Questions Resolution

- [ ] ¿Todas las preguntas de alta prioridad están respondidas?
- [ ] ¿Hay preguntas adicionales antes de continuar?

### Ready for Technical Analysis

- [ ] ¿Este PDR es suficientemente claro para análisis técnico?
- [ ] ¿Hay ambigüedades que resolver primero?

---

## Next Steps

1. **Usuario revisa este PDR** y proporciona feedback
2. **Iteramos** hasta que estés 100% satisfecho
3. **Creamos tech-analysis.md** con implementación detallada
4. **Atomizamos en TODOs.md** con tareas de 1-2 horas
5. **Comenzamos implementación** fase por fase

---

**Versión**: 1.0
**Fecha**: 2025-10-30
**Estado**: 🟡 Pending Review
**Próxima Acción**: User review & feedback
