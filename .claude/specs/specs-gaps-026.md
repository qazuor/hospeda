# SPEC-026: Security Testing Gaps - Audit de Gaps

> **Spec**: SPEC-026 - Security Testing Gaps
> **Estado de la spec**: Todas las 16 tareas marcadas como `completed` en state.json (metadata.json aun dice `draft`)
> **Fecha de creacion**: 2026-03-10
> **Auditorias realizadas**: 6 (ultima: 2026-03-10, auditoria #6 con 4 agentes especializados + 2 agentes de verificacion)

---

## Resumen Ejecutivo

La SPEC-026 aborda 4 areas de seguridad: webhooks, lockout por fuerza bruta, audit logging y session invalidation. Las 16 tareas estan marcadas como completadas. Esta sexta auditoria exhaustiva confirma **33 gaps** (1 nuevo vs auditoria #5), con conteo de rutas refinado y verificacion cruzada de todos los hallazgos criticos.

### Estadisticas Consolidadas (Auditoria #6)

| Severidad | Cantidad | Cambio vs Auditoria #5 |
|-----------|----------|------------------------|
| CRITICA   | 2        | = (GAP-028, GAP-029 re-confirmados con lineas exactas) |
| ALTA      | 6        | = (todos re-confirmados) |
| MEDIA     | 14       | +1 (GAP-033 nuevo: change-password sin audit) |
| BAJA      | 11       | = |
| **Total** | **33**   | +1 nuevo, 0 cerrados |

### Resumen por Fase de la Spec

| Fase | Estado | Gaps |
|------|--------|------|
| Phase 1: Webhook Tests (T-001..T-003) | **100% completa** | GAP-005, GAP-006, GAP-026 |
| Phase 2: Brute-Force Lockout (T-004..T-008) | **~85% completa** | GAP-002, GAP-003, GAP-011, GAP-015, GAP-031 |
| Phase 3: Audit Logging (T-009..T-012) | **~65% completa** | GAP-007, GAP-008, GAP-009, GAP-017, GAP-018, GAP-020, GAP-025, GAP-027, GAP-030, GAP-033 |
| Phase 4: Session Tests (T-013..T-014) | **~90% completa** | GAP-022 |
| Phase 5: Verification (T-015..T-016) | **~50% completa** | GAP-012, GAP-016, GAP-021 |

### Conteo Preciso de Rutas de Mutacion (Auditoria #6 - refinado)

| Tier | Rutas totales | Con auditLog | Sin auditLog | Cobertura |
|------|--------------|-------------|-------------|-----------|
| Admin Mutations | 101 | 2 | 99 | 2.0% |
| Protected Mutations | 49 | 0 | 49 | 0% |
| Billing | 9 | 3 | 6 | 33.3% |
| Auth | 7 | 2 | 5 | 28.6% |
| **TOTAL** | **166** | **7** | **159** | **4.2%** |

*Nota Auditoria #6: Numeros refinados vs #5 (177->166) por reconteo exacto con glob+grep. Los 7 archivos con auditLog son los mismos en ambas auditorias. La diferencia es por conteo mas preciso de archivos de mutacion (excluyendo index.ts y archivos de solo lectura).*

### Test Coverage por Fase (verificado en Auditoria #6)

| Archivo de test | Tests implementados | Tests requeridos por spec | Cobertura |
|----------------|--------------------|--------------------------:|-----------|
| `webhook-signature.test.ts` | 5 | 5 | 100% |
| `webhook-idempotency-full.test.ts` | 3 | 3 | 100% |
| `auth-lockout.test.ts` (unit) | 10 | 10 | 100% |
| `login-lockout.test.ts` (integration) | 4 | 7 | **57%** |
| `audit-logger.test.ts` (unit) | 13 | 13 | 100% |
| `audit-log-production.test.ts` (integration) | 4 | 4 | 100% |
| `signout-session.test.ts` | 6 | 4 | 150% (extras) |
| `multi-session-signout.test.ts` | 3 | 3 | 100% |

---

## Gaps Encontrados

### GAP-026-001: IDOR en rutas protegidas - CONFIRMADO EN #4 y #5

- **Auditoria**: #1, #2, #3, #4, #5, #6, **#6** (2026-03-10)
- **Severidad**: **CRITICA** (elevada en auditoria #4 - IDOR confirmado)
- **Prioridad**: **P0**
- **Complejidad**: Media (requiere ownership middleware + service changes)
- **Dentro del alcance de SPEC-026**: No
- **Archivos afectados**: Ver GAP-028 y GAP-029 para detalles con codigo fuente

**Descripcion**: IDOR REAL confirmado en sponsorship y owner-promotion. Ver GAP-028 y GAP-029.

**Revision (Auditoria #6)**: Re-confirmado con verificacion de lineas exactas. Ver GAP-028 y GAP-029 para codigo fuente verificado.

**Recomendacion**: Fix urgente. Agregar ownership middleware a ambas entidades.

**Decision (2026-03-10)**: HACER. Fix directo con ownership verification en _can* methods de SponsorshipService y OwnerPromotionService, siguiendo patron existente de Accommodation/Post. Incluye GAP-028 y GAP-029.

---

### GAP-026-002: Lockout solo protege `/sign-in/email` - otros endpoints sin proteccion

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: ALTA
- **Prioridad**: P1
- **Complejidad**: Baja (1-2 dias)
- **Dentro del alcance de SPEC-026**: Si (T-006)
- **Archivos afectados**: `apps/api/src/routes/auth/handler.ts`

**Descripcion**:
El handler de lockout solo intercepta `POST /sign-in/email`. Endpoints vulnerables:
- `/api/auth/forget-password`: Rate limit solo IP-based. Email bombing posible
- `/api/auth/sign-up/email`: No protegido por email. Probing via timing posible
- Email verification resend: No protegido. Email bombing posible

**Revision (Auditoria #6)**: Sin cambios vs #5. Agente de lockout confirmo que rate-limit.ts usa composite key `${endpointType}:${ip}` .. solo IP-based. El handler esta correctamente registrado ANTES del catch-all (linea 32 vs linea 142), pero solo intercepta `/sign-in/email`.

**Recomendacion**: Fix directo. Rate-limit forgot-password por email como minimo.

**Decision (2026-03-10)**: HACER. Extender rate-limit a forgot-password (composite key email+IP), signup y resend.

---

### GAP-026-003: Race condition en lockout store - operaciones no atomicas

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Baja (1 dia)
- **Dentro del alcance de SPEC-026**: Si (T-005)
- **Archivos afectados**: `apps/api/src/middlewares/auth-lockout.ts` (lineas 237-255)

**Descripcion (confirmada en 5 auditorias)**:
`recordFailedAttempt()` usa read-then-write (lineas 237-255):
```typescript
const existing = await store.get(normalizedEmail);  // READ (line 237)
let newEntry = { count: existing.count + 1, ... };   // COMPUTE
await store.set(normalizedEmail, newEntry, windowMs);  // WRITE (line 255)
```

**Revision (Auditoria #6)**: Agente de lockout confirmo nuevamente. NO usa Redis INCR. Redis store tiene try-catch correcto (lineas 90-157) para fallback a in-memory, pero las operaciones de lockout NO son atomicas. En multi-instancia, dos requests simultaneos pueden leer count=4, ambos escribir count=5, y ninguno bloquea. La ventana de race es microsegundos y falla en "direccion segura" (podria permitir 1-2 intentos extra por race).

**Recomendacion**: Fix directo con Redis INCR si se usa Redis. Para in-memory, aceptable dado que es single-instance.

**Decision (2026-03-10)**: HACER. Reemplazar read-then-write con Redis INCR para store Redis. In-memory se mantiene como está.

---

### GAP-026-004: `HOSPEDA_AUTH_LOCKOUT_COOLDOWN_MS` en spec pero no implementado

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: BAJA
- **Prioridad**: P3
- **Complejidad**: Trivial
- **Dentro del alcance de SPEC-026**: Si (T-004)
- **Archivos afectados**: Documentacion

**Revision (Auditoria #6)**: Sin cambios vs #5. Variable correctamente eliminada del diseno final. WINDOW_MS sirve para ambos propositos.

**Recomendacion**: Actualizar spec para reflejar decision de diseno.

**Decision (2026-03-10)**: HACER. Actualizar spec doc para reflejar que COOLDOWN_MS fue descartada intencionalmente.

---

### GAP-026-005: Webhook idempotency - archivos legacy con tests sin DB assertions

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: BAJA
- **Prioridad**: P3
- **Complejidad**: Trivial
- **Dentro del alcance de SPEC-026**: Si (T-003)
- **Archivos afectados**: `apps/api/test/integration/webhooks/webhook-idempotency.test.ts`, `webhook-persistence.test.ts`

**Revision (Auditoria #6)**: Agente de webhook confirmo: directorio tiene 6 archivos. Tests REALES:
- `webhook-signature.test.ts` (5 tests, DB real) .. 100%
- `webhook-idempotency-full.test.ts` (3 tests, DB real) .. 100%

Archivos legacy (mock-based):
- `webhook-idempotency.test.ts` (513 lineas, 6 describe blocks con mocks)
- `webhook-persistence.test.ts` (444 lineas, 3 describe blocks con mocks)

**Recomendacion**: Eliminar archivos legacy o renombrar a `*-mocked.test.ts`.

**Decision (2026-03-10)**: HACER. Eliminar archivos legacy (tests reales con DB ya cubren 100%).

---

### GAP-026-006: Dead Letter Queue sin cobertura de testing real

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Baja (1 dia)
- **Dentro del alcance de SPEC-026**: Si (T-003)
- **Archivos afectados**: `apps/api/test/integration/webhooks/webhook-idempotency-full.test.ts`

**Revision (Auditoria #6)**: Agente de webhook confirmo. Solo 3 tests: persistencia, idempotencia, reprocessing. DLQ solo se testea en archivos legacy mock-based (webhook-idempotency.test.ts lineas 281-363).

**Recomendacion**: Agregar test de DLQ con DB real si es funcionalidad activa.

**Decision (2026-03-10)**: HACER. Agregar test de DLQ con DB real (antes/junto con eliminar archivos legacy de GAP-005).

---

### GAP-026-007: AuditEventType definido en ubicacion incorrecta

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: BAJA
- **Prioridad**: P3
- **Complejidad**: Baja (0.5 dias)
- **Dentro del alcance de SPEC-026**: Si (T-009)
- **Archivos afectados**: `apps/api/src/utils/audit-logger.ts`

**Revision (Auditoria #6)**: Agente de audit confirmo. 7 tipos definidos inline (lineas 19-27): AUTH_LOGIN_FAILED, AUTH_LOGIN_SUCCESS, AUTH_LOCKOUT, ACCESS_DENIED, BILLING_MUTATION, PERMISSION_CHANGE, SESSION_SIGNOUT. Todas las interfaces (lineas 37-92) estan en audit-logger.ts en vez de `@repo/logger`. Unit tests cubren todos los tipos (13 test cases).

**Recomendacion**: Fix menor. Mover a `@repo/logger`.

**Decision (2026-03-10)**: HACER. Mover AuditEventType e interfaces a `@repo/logger`.

---

### GAP-026-008: Audit logging no integra con Sentry

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Baja (1 dia)
- **Dentro del alcance de SPEC-026**: Parcial
- **Archivos afectados**: `apps/api/src/utils/audit-logger.ts`, `apps/api/src/lib/sentry.ts`

**Revision (Auditoria #6)**: Sin cambios vs #5. `auditLog()` solo llama a `auditLogger.info()`. Sin integracion con Sentry para breadcrumbs o alertas.

**Recomendacion**: Agregar Sentry breadcrumbs como fix de bajo riesgo.

**Decision (2026-03-10)**: HACER. Agregar Sentry breadcrumbs en auditLog() para eventos de seguridad.

---

### GAP-026-009: User delete/hardDelete sin audit logging - ALCANCE AMPLIADO

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: **ALTA**
- **Prioridad**: P1
- **Complejidad**: Media (1-2 dias)
- **Dentro del alcance de SPEC-026**: Si (T-010c)
- **Archivos afectados**: `apps/api/src/routes/user/admin/delete.ts`, `hardDelete.ts`, `create.ts`, `restore.ts`, `batch.ts`

**Revision (Auditoria #6)**: Agente de audit confirmo con grep exhaustivo. `auditLog` solo existe en 7 archivos de rutas. User admin tiene audit en update.ts y patch.ts (PERMISSION_CHANGE), pero NO en create.ts, delete.ts, hardDelete.ts, restore.ts, ni batch.ts. Operaciones de PII (delete/hardDelete de usuarios) sin trail de auditoria.

**Recomendacion**: Fix directo urgente para user delete/hardDelete (PII). Luego sweep sistematico.

**Decision (2026-03-10)**: HACER. Fix directo urgente en las 5 rutas de usuario (delete, hardDelete, create, restore, batch). Prioridad PII.

---

### GAP-026-010: Evento de signout usa SESSION_SIGNOUT en vez de AUTH_LOGOUT_SUCCESS

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: Trivial
- **Dentro del alcance de SPEC-026**: Si
- **Archivos afectados**: `apps/api/src/utils/audit-logger.ts`, `apps/api/src/routes/auth/signout.ts`

**Revision (Auditoria #6)**: Sin cambios vs #5. SESSION_SIGNOUT se usa consistentemente (linea 42 de signout.ts) y es mas descriptivo.

**Recomendacion**: Actualizar spec para reflejar `SESSION_SIGNOUT`. No es un bug.

**Decision (2026-03-10)**: HACER. Actualizar spec doc con nombre SESSION_SIGNOUT.

---

### GAP-026-011: Tests de lockout no cubren concurrencia

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Baja (0.5 dias)
- **Dentro del alcance de SPEC-026**: Si (T-007, T-008)
- **Archivos afectados**: `apps/api/test/middlewares/auth-lockout.test.ts`, `apps/api/test/integration/auth/login-lockout.test.ts`

**Revision (Auditoria #6)**: Agente de lockout confirmo. Ningun test de concurrencia en todo el directorio de tests de auth. Todos los tests son secuenciales.

**Recomendacion**: Agregar test con `Promise.all()`.

**Decision (2026-03-10)**: HACER. Agregar test de concurrencia con Promise.all() (complementa fix de GAP-003).

---

### GAP-026-012: metadata.json de la spec no actualizado a completed

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: BAJA (administrativa)
- **Prioridad**: P4
- **Complejidad**: Trivial
- **Dentro del alcance de SPEC-026**: Si (T-016)
- **Archivos afectados**: `.claude/specs/SPEC-026-security-testing-gaps/metadata.json`

**Revision (Auditoria #6)**: Agente de infra confirmo. metadata.json: `"status": "draft"`, `"completed": null`. state.json: `"status": "completed"`. TODOs.md: dice `Status: pending | Progress: 0/18` (completamente desactualizado).

**Recomendacion**: Fix trivial directo. Actualizar metadata.json y TODOs.md.

**Decision (2026-03-10)**: HACER. Actualizar metadata.json y TODOs.md.

---

### GAP-026-013: CSP sin soporte de nonce para scripts dinamicos

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Media (2-3 dias)
- **Dentro del alcance de SPEC-026**: No
- **Archivos afectados**: `apps/api/src/middlewares/security.ts`

**Revision (Auditoria #6)**: Sin cambios vs #5. Cubierto por SPEC-040.

**Recomendacion**: Dejar para SPEC-040.

**Decision (2026-03-10)**: POSTERGAR. Ya cubierto por SPEC-040 (CSP Nonce Integration).

---

### GAP-026-014: Password complexity policy no visible/configurable

- **Auditoria**: #1, #2, #3, #4, #5, #6
- **Severidad**: ALTA
- **Prioridad**: P1
- **Complejidad**: Baja (1 dia)
- **Dentro del alcance de SPEC-026**: No
- **Archivos afectados**: `apps/api/src/lib/auth.ts`, `packages/schemas/src/api/auth.schema.ts`, `packages/schemas/src/entities/user/user.crud.schema.ts`

**Revision (Auditoria #6)**: Agente de seguridad confirmo con grep directo:
- `auth.schema.ts:51` - `ChangePasswordInputSchema`: `z.string().min(8).max(128)` **SIN regex**. Acepta "12345678"
- `user.crud.schema.ts:165-181` - `UserPasswordChangeInputSchema`: **CON regex** `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/`
- `auth.ts`: Grep para `passwordPolicy/minLength` devolvio **0 resultados**. Better Auth no tiene config de password

**Recomendacion**: SPEC nueva o SPEC-037. Unificar schemas + configurar Better Auth.

**Decision (2026-03-10)**: HACER. Crear schema base de password con regex unificado y reutilizarlo en TODOS los schemas que trabajen con passwords (ChangePasswordInputSchema, UserPasswordChangeInputSchema, UserPasswordResetInputSchema, signup, etc.).

---

### GAP-026-015: Integration tests de lockout incompletos (4/7 requeridos)

- **Auditoria**: #2, #3, #4, #5, #6
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Baja (1 dia)
- **Dentro del alcance de SPEC-026**: Si (T-008)
- **Archivos afectados**: `apps/api/test/integration/auth/login-lockout.test.ts`

**Revision (Auditoria #6)**: Agente de lockout confirmo exactamente 4 test cases implementados:

| # | Test name | Linea | Estado |
|---|-----------|-------|--------|
| 1 | `should allow login attempts before reaching lockout threshold` | 122 | IMPLEMENTADO |
| 2 | `should return 429 after exceeding lockout threshold` | 140 | IMPLEMENTADO |
| 3 | `should include Retry-After header in lockout response` | 164 | IMPLEMENTADO |
| 4 | `should unlock after window expires` | - | **FALTANTE** |
| 5 | `should reset lockout counter after successful login` | 195 | IMPLEMENTADO |
| 6 | `should not count Better Auth rate limit 429 as failed attempt` | - | **FALTANTE** |
| 7 | `should not affect other auth routes (signup, forgot-password)` | - | **FALTANTE** |

**Recomendacion**: Fix directo. Agregar 3 tests faltantes.

**Decision (2026-03-10)**: HACER. Agregar los 3 tests de integracion faltantes (unlock after window, BA 429 handling, route isolation).

---

### GAP-026-016: Build failure en @repo/config bloquea ejecucion de tests

- **Auditoria**: #2, #3, #4, #5, #6
- **Severidad**: ALTA (blocker)
- **Prioridad**: P0
- **Complejidad**: Baja (investigar y fix)
- **Dentro del alcance de SPEC-026**: No (infraestructura)
- **Archivos afectados**: `packages/config/src/env.ts:207-208`

**Revision (Auditoria #6)**: Agente de infra confirmo. Errores exactos:
```
src/env.ts(207,53): error TS2339: Property 'errors' does not exist on type 'ZodError<unknown>'.
src/env.ts(208,35): error TS7006: Parameter 'err' implicitly has an 'any' type.
```
**Nota**: En linea 25 del MISMO archivo, `errors.issues` se usa correctamente. La linea 207 usa `.errors` en vez de `.issues`.

**Recomendacion**: Fix urgente. Cambiar `error.errors` a `error.issues` en linea 207.

**Decision (2026-03-10)**: HACER. Fix trivial: cambiar `.errors` a `.issues` y tipar `err` correctamente.

---

### GAP-026-017: Hard delete sin audit logging en TODAS las entidades admin - AMPLIADO EN #5

- **Auditoria**: #3, #4, **AMPLIADO en #5**
- **Severidad**: ALTA
- **Prioridad**: P1
- **Complejidad**: Alta (3-5 dias - 170 rutas)
- **Dentro del alcance de SPEC-026**: Parcial
- **Archivos afectados**: Ver tabla completa abajo

**Revision (Auditoria #5)**: El agente de audit matrix hizo un scan COMPLETO de TODAS las rutas de mutacion incluyendo protected tier (no auditado en #4):

**Resultado del scan exhaustivo (verificado con glob + grep)**:
- **177 rutas de mutacion total** (admin + protected + billing + auth)
- **Solo 7 archivos tienen auditLog** (4.0% de cobertura):
  1. `billing/trial.ts`
  2. `billing/promo-codes.ts`
  3. `billing/settings.ts`
  4. `user/admin/update.ts` - PERMISSION_CHANGE
  5. `user/admin/patch.ts` - PERMISSION_CHANGE
  6. `auth/signout.ts`
  7. `auth/handler.ts`
- **170 rutas SIN auditLog** (96.0%)

**Desglose por tipo de operacion (todas sin audit):**

| Tipo | Admin | Reviews Admin | Protected | Total |
|------|-------|--------------|-----------|-------|
| create.ts | 15 | 0 | 11 | 26 |
| update.ts | 13* | 2 | 11 | 26 |
| patch.ts | 12* | 0 | 11 | 23 |
| delete.ts | 15 | 2 | 2 | 19 |
| hardDelete.ts | 13 | 2 | 0 | 15 |
| softDelete.ts | 0 | 0 | 10 | 10 |
| restore.ts | 14 | 2 | 0 | 16 |
| batch.ts | 9 | 0 | 0 | 9 |
| Special (FAQ, SEO, like) | 4 | 0 | 5 | 9 |
| Billing (sin audit) | 3 | 0 | 0 | 3 |
| **Total** | **98** | **8** | **50** | **156**+7+7=170 |

*Nota: user/admin/update.ts y patch.ts SI tienen auditLog (solo para PERMISSION_CHANGE)

**Cambio vs Auditoria #4**: De "91 admin routes" a "177 rutas totales" (antes no se contaban protected + reviews + special + billing sin audit). Cobertura real: 4.0% (no 7.7% como se reporto en #4).

**Recomendacion**: Implementar middleware generico de audit para todas las mutaciones admin/protected. Priorizar: hardDelete (PII) > delete > create > update > restore > batch.

**Decision (2026-03-10)**: HACER con Opcion A. Middleware generico de audit en Hono que cubra todas las mutaciones (POST/PUT/PATCH/DELETE) para admin + protected. Absorbe GAP-025.

---

### GAP-026-018: auditLog() sin try-catch - puede crashear requests

- **Auditoria**: #3, #4, #5, #6
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Trivial (10 minutos)
- **Dentro del alcance de SPEC-026**: Si (T-009)
- **Archivos afectados**: `apps/api/src/utils/audit-logger.ts:126-133`

**Revision (Auditoria #6)**: Agente de audit confirmo. `auditLog()` (lineas 126-133) NO tiene try-catch:
```typescript
export function auditLog(entry: AuditEntry): void {
    const fullEntry = { ...entry, timestamp: entry.timestamp ?? new Date().toISOString() };
    const scrubbed = scrubSensitiveData(fullEntry as unknown as Record<string, unknown>);
    auditLogger.info(scrubbed, `AUDIT:${entry.auditEvent}`);  // Sin try-catch
}
```

**Ademas**: NINGUNO de los call sites (authorization.ts 6 puntos, user/admin/update.ts, user/admin/patch.ts, billing routes) tiene try-catch alrededor de auditLog(). Solo auth/handler.ts y auth/signout.ts tienen try-catch en el handler completo.

**Contraste**: El lockout handler en `auth/handler.ts` SI tiene try-catch completo (lineas 73-78, 130-132).

**Recomendacion**: Fix trivial directo. Agregar try-catch con apiLogger.error() como fallback.

**Decision (2026-03-10)**: HACER. Agregar try-catch a auditLog() con apiLogger.error() como fallback.

---

### GAP-026-019: Inconsistencia en schemas de password entre endpoints

- **Auditoria**: #3, #4, #5, #6
- **Severidad**: ALTA
- **Prioridad**: P1
- **Complejidad**: Baja (0.5 dias)
- **Dentro del alcance de SPEC-026**: No (schema design)
- **Archivos afectados**:
  - `packages/schemas/src/api/auth.schema.ts:49-52` (ChangePasswordInputSchema)
  - `packages/schemas/src/entities/user/user.crud.schema.ts:165-181` (UserPasswordChangeInputSchema)

**Revision (Auditoria #6)**: Agente de seguridad confirmo con grep directo:

| Schema | Archivo:Linea | Min | Max | Regex |
|--------|---------------|-----|-----|-------|
| `ChangePasswordInputSchema` | auth.schema.ts:51 | 8 | 128 | **NINGUNO** |
| `UserPasswordChangeInputSchema` | user.crud.schema.ts:165 | 8 | 128 | `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/` |
| `UserPasswordResetInputSchema` | user.crud.schema.ts:187 | 8 | 128 | Mismo regex |

**Vector**: Usuario cambia password via auth API a "12345678" .. permitido.

**Recomendacion**: SPEC nueva. Unificar schemas + configurar Better Auth.

**Decision (2026-03-10)**: HACER. Ver GAP-014. Unificar schema base de password en todos los endpoints.

---

### GAP-026-020: Session tests no verifican escritura de audit log

- **Auditoria**: #3, #4, #5, #6
- **Severidad**: BAJA
- **Prioridad**: P3
- **Complejidad**: Baja (0.5 dias)
- **Dentro del alcance de SPEC-026**: Si (T-013, T-010c)
- **Archivos afectados**: `apps/api/test/integration/auth/signout-session.test.ts`

**Revision (Auditoria #6)**: Agente de webhook/session confirmo. Los 6 test cases verifican funcionalidad (DB deletion, cookie clearing, token rejection) pero NO verifican que auditLog() es llamado. Grep para `auditLog|audit` en signout-session.test.ts devolvio **0 resultados**.

**Mitigacion**: `audit-log-production.test.ts` cubre SESSION_SIGNOUT (lineas 188-219 de ese archivo).

**Recomendacion**: Fix de baja prioridad.

**Decision (2026-03-10)**: HACER. Agregar audit verification (spy/mock de auditLog) a session tests.

---

### GAP-026-021: SPEC-019 TODOs no actualizado con cross-reference a SPEC-026

- **Auditoria**: #3, #4, #5, #6
- **Severidad**: BAJA (administrativa)
- **Prioridad**: P4
- **Complejidad**: Trivial
- **Dentro del alcance de SPEC-026**: Si (T-016)
- **Archivos afectados**: `.claude/tasks/SPEC-019-security-permissions-hardening/TODOs.md`

**Revision (Auditoria #6)**: Agente de infra confirmo. SPEC-019 TODOs solo referencia SPEC-024 y SPEC-025, no SPEC-026.

**Recomendacion**: Fix trivial directo.

**Decision (2026-03-10)**: HACER. Agregar cross-reference a SPEC-026 en TODOs.md de SPEC-019.

---

### GAP-026-022: No hay test de signout concurrente (T-014 parcial)

- **Auditoria**: #3, #4, #5, #6
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Baja (0.5 dias)
- **Dentro del alcance de SPEC-026**: Si (T-014)
- **Archivos afectados**: `apps/api/test/integration/auth/multi-session-signout.test.ts`

**Revision (Auditoria #6)**: Agente de webhook/session confirmo. Los 3 test cases son secuenciales:
1. `should only invalidate the signed-out session, not other active sessions` (linea 158)
2. `should allow re-login after signout while other sessions remain active` (linea 189)
3. `should handle signing out all sessions sequentially` (linea 214)

Sin `Promise.all()` en ningun test de auth.

**Recomendacion**: Agregar test con `Promise.all()`.

**Decision (2026-03-10)**: HACER. Agregar test de signout concurrente con Promise.all().

---

### ~~GAP-026-023: Variables de lockout no documentadas en .env.example~~ - CERRADO

- **Auditoria**: #3 (encontrado), **CERRADO en #4** (2026-03-10)
- **Severidad**: ~~BAJA~~ N/A
- **Estado**: **CERRADO - FALSO POSITIVO**

---

### GAP-026-024: No hay limite de sesiones concurrentes por usuario

- **Auditoria**: #3, #4, #5, #6
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Media (1-2 dias)
- **Dentro del alcance de SPEC-026**: No (session management)
- **Archivos afectados**: `apps/api/src/lib/auth.ts`

**Revision (Auditoria #6)**: Agente de seguridad confirmo. auth.ts configura:
- `BCRYPT_SALT_ROUNDS = 12` (correcto)
- `SESSION_EXPIRES_IN = 60*60*24*7` (7 dias)
- `SESSION_UPDATE_AGE = 60*60*24` (1 dia)
- `cookieCache maxAge = 5 minutos`
- **NO** `maxSessions` limit configurado

Grep para `maxSession|session.*limit|MAX_SESSION` devolvio 0 resultados.

**Recomendacion**: Evaluar si Better Auth soporta limites de sesion. Planificar como SPEC nueva.

**Decision (2026-03-10)**: HACER. Investigar soporte de maxSessions en Better Auth e implementar limite razonable (5-10).

---

### GAP-026-025: Admin CREATE routes sin audit logging

- **Auditoria**: #4, #5, #6
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Media (2 dias - 15+ archivos)
- **Dentro del alcance de SPEC-026**: Parcial
- **Archivos afectados**: `apps/api/src/routes/*/admin/create.ts` (15 archivos)

**Revision (Auditoria #5)**: Confirmado. 15 admin create routes sin auditLog. Absorbido por GAP-017 (conteo completo de 170 rutas).

**Recomendacion**: Combinar con GAP-017 en sweep unico.

**Decision (2026-03-10)**: HACER. Absorbido por GAP-017 (middleware generico de audit).

---

### GAP-026-026: Webhook legacy test files contienen tests que podrian confundir CI

- **Auditoria**: #4, #5, #6
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: Trivial
- **Dentro del alcance de SPEC-026**: No
- **Archivos afectados**: 4 archivos legacy en `apps/api/test/integration/webhooks/`

**Revision (Auditoria #6)**: Agente de webhook confirmo. Archivos legacy detallados:
- `webhook-idempotency.test.ts` (513 lineas, 6 describe blocks, 100% mock-based)
- `webhook-persistence.test.ts` (444 lineas, 3 describe blocks, 100% mock-based)
- `mercadopago.test.ts` (si existe)
- `subscription-webhook.test.ts` (si existe)

**Recomendacion**: Evaluar valor. Si no, mover a `__legacy__/` o eliminar.

**Decision (2026-03-10)**: HACER. Evaluar y limpiar todos los legacy tests del directorio (junto con GAP-005).

---

### GAP-026-027: scrubSensitiveData() solo limpia campos top-level

- **Auditoria**: #4, #5, #6
- **Severidad**: BAJA
- **Prioridad**: P3
- **Complejidad**: Baja (0.5 dias)
- **Dentro del alcance de SPEC-026**: Si (T-009 - Known Limitation documentada)
- **Archivos afectados**: `apps/api/src/utils/audit-logger.ts:111-119`

**Revision (Auditoria #6)**: Agente de audit confirmo. `scrubSensitiveData()` (lineas 111-119) solo verifica campos de primer nivel. Campos anidados como `metadata.token` o `config.secret` NO serian redactados. Aceptable porque audit entries actuales tienen schemas planos. Unit test cubre el scrubbing (lineas 331-376 de audit-logger.test.ts).

**Recomendacion**: Documentar TODO en el codigo. Fix cuando se necesiten eventos con schemas anidados.

**Decision (2026-03-10)**: HACER. Documentar TODO + implementar scrubbing recursivo de campos sensibles.

---

### GAP-026-028: IDOR CONFIRMADO en Sponsorship protected routes

- **Auditoria**: #4, #5, #6
- **Severidad**: **CRITICA**
- **Prioridad**: **P0**
- **Complejidad**: Media (1-2 dias)
- **Dentro del alcance de SPEC-026**: No (IDOR protection)
- **Archivos afectados**:
  - `apps/api/src/routes/sponsorship/protected/update.ts`
  - `packages/service-core/src/services/sponsorship/sponsorship.service.ts` (lineas 45-76)

**Revision (Auditoria #6)**: Agente de seguridad confirmo IDOR. TODOS los metodos _can* solo verifican permisos:
- `_canCreate()`: Solo checks `PermissionEnum.SPONSORSHIP_CREATE`
- `_canUpdate()`: Solo checks `PermissionEnum.SPONSORSHIP_UPDATE`
- `_canSoftDelete()`: Solo checks `PermissionEnum.SPONSORSHIP_DELETE`
- `_canHardDelete()`: Solo checks `PermissionEnum.SPONSORSHIP_DELETE`
- `_canRestore()`: Solo checks `PermissionEnum.SPONSORSHIP_DELETE`
- `_canView()`: Solo checks `PermissionEnum.SPONSORSHIP_VIEW`

NINGUNO verifica `entity.createdById === actor.id`.

**Recomendacion**: Fix urgente P0. Agregar ownership middleware + verificacion en _can* methods.

**Decision (2026-03-10)**: HACER. Ver GAP-001.

---

### GAP-026-029: IDOR CONFIRMADO en Owner-Promotion protected routes

- **Auditoria**: #4, #5, #6
- **Severidad**: **CRITICA**
- **Prioridad**: **P0**
- **Complejidad**: Media (1-2 dias)
- **Dentro del alcance de SPEC-026**: No (IDOR protection)
- **Archivos afectados**:
  - `apps/api/src/routes/owner-promotion/protected/update.ts`, `patch.ts`, `softDelete.ts`
  - `packages/service-core/src/services/owner-promotion/ownerPromotion.service.ts` (lineas 46-109)

**Revision (Auditoria #6)**: Agente de seguridad confirmo. Identico a GAP-028. TODOS los metodos _can* verifican solo permisos:
- `_canCreate()`, `_canUpdate()`, `_canSoftDelete()`, `_canHardDelete()`, `_canRestore()`, `_canView()`, `_canUpdateVisibility()` .. solo checks permisos

**Recomendacion**: Fix urgente P0. Agregar ownership middleware. 3+ rutas vulnerables (update, patch, softDelete).

**Decision (2026-03-10)**: HACER. Ver GAP-001.

---

### GAP-026-030: Protected tier mutations con ZERO audit logging [NUEVO en #5]

- **Auditoria**: #5, #6 (2026-03-10)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Media (2-3 dias - 52 archivos)
- **Dentro del alcance de SPEC-026**: No (fuera del alcance original que solo cubria admin billing + user + auth)
- **Archivos afectados**: 52 archivos en `apps/api/src/routes/*/protected/`

**Descripcion**:
Las auditorias anteriores (#1-#4) solo contaron rutas admin. Esta es la primera auditoria que incluye el tier protected. Se encontraron **52 rutas protected de mutacion con 0% de cobertura de audit logging**:

| Entidad | create | update | patch | softDelete | Otras | Total |
|---------|--------|--------|-------|------------|-------|-------|
| accommodation | 1 | 1 | 1 | 1 | 3 (FAQ) | 7 |
| amenity | 1 | 1 | 1 | 1 | 0 | 4 |
| attraction | 1 | 1 | 1 | 1 | 0 | 4 |
| destination | 1 | 1 | 1 | 1 | 0 | 4 |
| event | 1 | 1 | 1 | 1 | 0 | 4 |
| event-location | 1 | 1 | 1 | 1 | 0 | 4 |
| event-organizer | 1 | 1 | 1 | 1 | 0 | 4 |
| feature | 1 | 1 | 1 | 1 | 0 | 4 |
| owner-promotion | 1 | 1 | 1 | 1 | 0 | 4 |
| post | 1 | 1 | 1 | 1 | 2 (like) | 6 |
| sponsorship | 1 | 1 | 0 | 1 | 0 | 3 |
| user | 0 | 1 | 1 | 0 | 0 | 2 |
| user-bookmark | 1 | 0 | 0 | 0 | 1 (delete) | 2 |
| **Total** | **12** | **12** | **11** | **11** | **6** | **52** |

**Impacto**: Usuarios autenticados pueden crear, modificar y eliminar contenido sin registro de auditoria. Menor riesgo que admin (los usuarios gestionan sus propios datos), pero para compliance y debugging deberia registrarse.

**Soluciones propuestas**:
1. **Middleware generico de audit** a nivel de ruta que capture automáticamente todas las mutaciones (RECOMENDADO)
2. **Agregar auditLog() individualmente** en cada archivo (viable pero tedioso, 52 archivos)
3. **Priorizar**: User mutations > Accommodation > Post > Sponsorship > resto

**Recomendacion**: Combinar con GAP-017. Si se implementa middleware generico, cubre admin + protected de una vez. Considerar nueva SPEC de "Comprehensive Audit Logging".

**Decision (2026-03-10)**: HACER. Absorbido por GAP-017 (middleware generico de audit cubre admin + protected).

---

### GAP-026-031: Email normalization inconsistente entre handler y lockout store [NUEVO en #5]

- **Auditoria**: #5, #6 (2026-03-10)
- **Severidad**: BAJA
- **Prioridad**: P3
- **Complejidad**: Trivial (5 minutos)
- **Dentro del alcance de SPEC-026**: Si (T-005, T-006)
- **Archivos afectados**:
  - `apps/api/src/routes/auth/handler.ts:39` (handler)
  - `apps/api/src/middlewares/auth-lockout.ts:196,233` (lockout store)

**Descripcion**:
El agente de lockout detecto inconsistencia en la normalizacion de emails:
- **Handler** (linea 39): `body.email.toLowerCase().trim()` .. aplica trim Y toLowerCase
- **Lockout store** (lineas 196, 233): `email.toLowerCase()` .. solo toLowerCase, **sin trim**

Si un email con espacios pasa la validacion de Better Auth, el handler normalizaria a `user@example.com` pero si se pasara directamente al lockout store seria ` user@example.com ` (con espacios).

**Impacto**: MUY BAJO en la practica. El handler ya hace trim antes de pasar al lockout, asi que el path normal esta protegido. Pero es programacion defensiva incompleta.

**Grep confirmatorio**: `\.trim\(\)` en auth-lockout.ts devolvio 0 resultados.

**Recomendacion**: Fix trivial. Agregar `.trim()` en lockout store functions.

**Decision (2026-03-10)**: HACER. Agregar .trim() en checkLockout() y recordFailedAttempt().

---

### GAP-026-032: Billing user-facing mutations sin audit logging [NUEVO en #5]

- **Auditoria**: #5, #6 (2026-03-10)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Baja (1 dia - 3 archivos)
- **Dentro del alcance de SPEC-026**: No (spec excluye explicitamente non-admin billing mutations en Out of Scope seccion 4)
- **Archivos afectados**:
  - `apps/api/src/routes/billing/addons.ts` (compra de addons)
  - `apps/api/src/routes/billing/notifications.ts` (config de notificaciones)
  - `apps/api/src/routes/billing/plan-change.ts` (cambio de plan)

**Descripcion**:
3 rutas de billing que realizan mutaciones para usuarios finales (no admin) sin audit logging:
1. **Addon purchase**: Un usuario compra un addon .. sin registro
2. **Notification settings**: Un usuario cambia sus notificaciones de billing .. sin registro
3. **Plan change**: Un usuario cambia de plan .. sin registro

**Nota**: La spec de SPEC-026 (seccion 4 Out of Scope) explicitamente declara: "Audit logging for non-admin billing mutations: User self-service routes (addon purchase, plan change) are lower security risk and deferred". Esto fue una decision de diseno consciente.

**Impacto**: Para disputas de pago o investigacion de fraude, no hay trail de auditoria de acciones de usuario.

**Recomendacion**: Considerar agregar al sweep general de audit (GAP-017). No es urgente pero si importante para compliance.

**Decision (2026-03-10)**: HACER. Absorbido por GAP-017 (middleware generico de audit cubre billing user-facing tambien).

---

### GAP-026-033: change-password endpoint sin audit logging [NUEVO en #6]

- **Auditoria**: #6 (2026-03-10)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: Baja (0.5 dias)
- **Dentro del alcance de SPEC-026**: No (pero operacion security-sensitive que deberia tener audit)
- **Archivos afectados**: `apps/api/src/routes/auth/change-password.ts`

**Descripcion**:
El endpoint de cambio de password (`POST /api/v1/auth/change-password`) es una operacion security-sensitive que no tiene audit logging. Un cambio de password es un evento critico que deberia registrarse para:
- Deteccion de account takeover (password changed sin conocimiento del usuario)
- Compliance (trail de cambios en credenciales)
- Debugging (correlacionar con login failures posteriores)

**Hallazgo**: Grep de `auditLog` en `apps/api/src/routes/auth/` muestra que solo `handler.ts` y `signout.ts` tienen audit logging. `change-password.ts`, `status.ts`, `cache-stats.ts`, `me.ts` no tienen.

De estos, `change-password.ts` es el unico security-sensitive que requiere audit (los demas son lecturas).

**Soluciones propuestas**:
1. **Agregar auditLog() con nuevo evento AUTH_PASSWORD_CHANGED** (actor, IP, timestamp). NO incluir passwords en el log
2. **Combinar con GAP-017** en sweep general

**Recomendacion**: Fix directo prioritario. Es una operacion security-sensitive con impacto bajo de implementacion.

**Decision (2026-03-10)**: HACER. Fix directo con nuevo evento AUTH_PASSWORD_CHANGED (actor, IP, timestamp). Sin passwords en log.

---

## Matriz de Decision (Actualizada Auditoria #6)

| Gap | Severidad | Cambio vs #5 | Accion Recomendada | Requiere SPEC? |
|-----|-----------|-------------|-------------------|----------------|
| GAP-001 IDOR | **CRITICA** | Sin cambio | Fix urgente (ownership middleware) | NO |
| GAP-002 Lockout bypass | ALTA | Sin cambio | Fix directo (rate limit forgot-password) | NO |
| GAP-003 Race condition | MEDIA | Sin cambio | Fix directo (Redis INCR) | NO |
| GAP-004 COOLDOWN_MS | BAJA | Sin cambio | Doc update | NO |
| GAP-005 Legacy test files | BAJA | Sin cambio | Limpiar archivos legacy | NO |
| GAP-006 DLQ tests | MEDIA | Sin cambio | Agregar tests reales | NO |
| GAP-007 AuditEventType loc | BAJA | Sin cambio | Fix directo | NO |
| GAP-008 Sentry integration | MEDIA | Sin cambio | Fix directo (breadcrumbs) | NO |
| GAP-009 User delete audit | ALTA | Sin cambio | Fix directo urgente (user primero) | NO |
| GAP-010 Event naming | BAJA | Sin cambio | Doc update | NO |
| GAP-011 Concurrency tests | MEDIA | Sin cambio | Fix directo | NO |
| GAP-012 Metadata update | BAJA | Sin cambio | Fix trivial | NO |
| GAP-013 CSP nonce | MEDIA | Sin cambio | Ya planificado | SI - SPEC-040 |
| GAP-014 Password policy | ALTA | Sin cambio | SPEC nueva o SPEC-037 | SI |
| GAP-015 Tests incompletos | MEDIA | Sin cambio | Agregar 3 tests | NO |
| GAP-016 Build failure | ALTA | Sin cambio | Fix urgente | NO |
| GAP-017 All mutations no audit | ALTA | Numeros refinados (166 vs 177) | Middleware generico de audit | Posiblemente SI |
| GAP-018 auditLog no try-catch | MEDIA | Sin cambio | Fix trivial | NO |
| GAP-019 Password schema inconsist | ALTA | Sin cambio | Unificar schemas | SI (con GAP-014) |
| GAP-020 Session tests no audit | BAJA | Sin cambio | Agregar spy | NO |
| GAP-021 SPEC-019 no cross-ref | BAJA | Sin cambio | Fix trivial | NO |
| GAP-022 No concurrent signout | MEDIA | Sin cambio | Agregar test | NO |
| ~~GAP-023~~ | ~~BAJA~~ | CERRADO | N/A | NO |
| GAP-024 No session limit | MEDIA | Sin cambio | Evaluar Better Auth | Posiblemente SI |
| GAP-025 Creates no audit | MEDIA | Sin cambio | Absorbido por GAP-017 | NO |
| GAP-026 Legacy webhook tests | BAJA | Sin cambio | Evaluar/limpiar | NO |
| GAP-027 scrubSensitiveData | BAJA | Sin cambio | Documentar TODO | NO |
| GAP-028 IDOR Sponsorship | **CRITICA** | Lineas exactas verificadas | Fix urgente ownership | NO |
| GAP-029 IDOR Owner-Promotion | **CRITICA** | Lineas exactas verificadas | Fix urgente ownership | NO |
| GAP-030 Protected tier audit | MEDIA | Sin cambio | Middleware generico | Posiblemente SI |
| GAP-031 Email trim inconsist | BAJA | Sin cambio | Fix trivial | NO |
| GAP-032 Billing user audit | MEDIA | Sin cambio | Combinar con GAP-017 | NO |
| **GAP-033 change-password no audit** | **MEDIA** | **NUEVO** | **Fix directo** | **NO** |

### Prioridad de Ejecucion Sugerida (Actualizada Auditoria #6)

**Fase 0 - Blockers y CRITICOS (P0)**:
1. **GAP-028 + GAP-029**: Fix IDOR en sponsorship y owner-promotion (CRITICO - datos de otros usuarios expuestos)
2. **GAP-016**: Fix build failure en @repo/config (`error.errors` -> `error.issues`)

**Fase 1 - Fixes directos urgentes (P1)**:
3. **GAP-018**: Agregar try-catch a auditLog() (trivial, 10 min, alto impacto preventivo)
4. **GAP-033**: Agregar audit log a change-password (security-sensitive, 30 min)
5. **GAP-009 + GAP-017**: Sweep de audit log en rutas admin de delete/hardDelete primero, luego create/update
6. **GAP-002**: Rate-limit forgot-password por email
7. **GAP-012 + GAP-021**: Actualizar metadata.json, TODOs.md y SPEC-019 cross-reference

**Fase 2 - Fixes directos importantes (P2)**:
8. **GAP-015**: Agregar 3 tests de integracion faltantes en lockout
9. **GAP-022 + GAP-011**: Tests de concurrencia (signout + lockout con Promise.all)
10. **GAP-003**: Atomizar lockout store con Redis INCR
11. **GAP-006**: Agregar DLQ test assertions reales
12. **GAP-008**: Agregar Sentry breadcrumbs a audit
13. **GAP-024**: Evaluar limite de sesiones concurrentes
14. **GAP-030 + GAP-032**: Protected tier + billing user mutations audit (combinar con GAP-017)

**Fase 3 - SPECs nuevas (P1)**:
15. **GAP-014 + GAP-019**: SPEC nueva para password policy unificada
16. **GAP-013**: Ya cubierto por SPEC-040
17. **GAP-017 (completo)**: Considerar SPEC nueva "Comprehensive Audit Logging" si el scope es demasiado grande para fix directo

**Fase 4 - Limpieza y docs (P3-P4)**:
18. **GAP-005 + GAP-026**: Limpiar archivos de test legacy de webhooks
19. **GAP-007**: Mover AuditEventType al logger package
20. **GAP-027**: Documentar TODO en scrubSensitiveData
21. **GAP-031**: Agregar .trim() en lockout store
22. **GAP-004**: Documentar decision sobre COOLDOWN_MS
23. **GAP-010**: Actualizar spec con nombre SESSION_SIGNOUT
24. **GAP-020**: Agregar audit log verification a session tests

---

## Notas del Auditor

### Metodologia Auditoria #6
Esta auditoria se realizo mediante **4 agentes de exploracion exhaustiva en paralelo** + **2 agentes de verificacion cruzada**:

**Fase 1 - Exploracion exhaustiva (4 agentes en paralelo)**:
1. **Agente Spec Reader**: Leyo spec.md completa (400+ lineas), state.json, TODOs.md, specs-gaps-026.md. Confirmo 16/16 tareas completed, spec v9, 4 user stories, 32 gaps previos
2. **Agente Security Tests**: Escaneo exhaustivo de TODOS los archivos de test y middleware de seguridad. Encontro 8 middlewares de seguridad (auth, authorization, lockout, rate-limit, security headers, sanitization, cors, ownership), 17 entity permission tests, 70+ test cases de rate limiting, 20+ test cases de authorization
3. **Agente Auth/Permission**: Analizo los 3 tiers de autorizacion, verifico 0 role checks directos, confirmo bcrypt 12 rounds, session 7 dias, CORS seguro, input sanitization completa, 0 SQL injection vectors, 0 hardcoded credentials
4. **Agente Security Infrastructure**: Verifico rate limiting (dual-store Redis/memory), security headers (CSP, HSTS, X-Frame-Options), CSRF (origin verification), file upload (body limits pero sin MIME validation), audit logging (7 event types), webhook signatures (HMAC-SHA256), env var validation (Zod), middleware chain ordering

**Fase 2 - Verificacion cruzada (2 agentes)**:
5. **Agente Verificacion IDOR/Password/Build**: Verifico con lineas exactas:
   - IDOR Sponsorship: lineas 45-172, 7 metodos _can* solo verifican permisos
   - IDOR Owner-Promotion: lineas 46-178, 7 metodos _can* solo verifican permisos
   - Password schema: auth.schema.ts:51 SIN regex, user.crud.schema.ts:165 CON regex
   - Build failure: env.ts:207 `.errors` vs linea 25 `.issues`
   - auditLog: lineas 126-133 SIN try-catch
   - Email trim: 3 funciones con `.toLowerCase()` pero SIN `.trim()`
6. **Agente Conteo Audit**: Conteo preciso de TODAS las rutas de mutacion:
   - Admin mutations: 101 archivos, 2 con audit (update.ts + patch.ts user)
   - Protected mutations: 49 archivos, 0 con audit
   - Billing: 9 archivos, 3 con audit (promo-codes, settings, trial)
   - Auth: 7 archivos, 2 con audit (handler, signout)
   - **Total: 166 rutas, 7 con audit (4.2%)**
   - Verifico 4/4 tests en login-lockout.test.ts
   - Verifico 0 referencias a auditLog en signout-session.test.ts

### Diferencias entre Auditorias #5 y #6

| Aspecto | Auditoria #5 | Auditoria #6 | Cambio |
|---------|-------------|-------------|--------|
| Total rutas mutacion | 177 | 166 | -11 (conteo refinado) |
| Cobertura audit | 4.0% | 4.2% | Refinado |
| Total gaps | 32 | 33 | +1 (GAP-033) |
| Gaps nuevos | 3 (030, 031, 032) | 1 (033) | |
| Gaps cerrados | 0 | 0 | |
| IDOR confirmado | Si (service level) | Si (lineas exactas) | Verificacion mas precisa |
| Password gap | Confirmado | Confirmado con grep directo | |
| Build failure | Confirmado | Confirmado con linea exacta | |

### Hallazgo Nuevo en Auditoria #6

**GAP-033**: `change-password.ts` identificado como operacion security-sensitive sin audit logging. Diferente a GAP-017 (sweep general) porque es un endpoint de auth critico que deberia tener audit independientemente del sweep general.

### Fortalezas Confirmadas (Auditoria #6 - re-confirmadas)
- **Infraestructura de seguridad SOLIDA**: 8 middlewares especializados, well-ordered chain
- **Webhook tests**: 100% completos (8/8 tests con DB real)
- **Session tests**: 90%+ completos (9/9 tests funcionales)
- **Lockout handler**: Implementacion robusta (dual-store, BA 429 handling, request cloning)
- **Authorization**: Permission-based (PermissionEnum), 0 role checks directos
- **Input sanitization**: Comprehensive (6 sanitizers, 3 levels, field-aware)
- **SQL injection**: 0% riesgo (Drizzle ORM exclusively)
- **CORS**: Seguro con sibling domain prevention
- **XSS**: 1 dangerouslySetInnerHTML (display-only, datos de DB, riesgo aceptable)
- **Env vars**: Zod-validated, no secrets in code, .env in .gitignore

### Debilidades Principales (Auditoria #6 - priorizadas)
1. **IDOR CRITICO (P0)**: 2 servicios con IDOR real (sponsorship + owner-promotion). 14 metodos _can* verifican solo permisos
2. **Build blocker (P0)**: @repo/config no compila (ZodError.errors vs .issues en linea 207)
3. **Audit coverage (P1)**: 7/166 rutas = 4.2%. 159 mutaciones sin registro de auditoria
4. **Password policy (P1)**: ChangePasswordInputSchema acepta "12345678" (sin regex)
5. **auditLog fragil (P2)**: Sin try-catch, puede crashear requests si logging falla
6. **Tests incompletos (P2)**: Lockout 4/7, 0 tests de concurrencia, session tests sin audit assertions
7. **Lockout parcial (P2)**: Solo protege /sign-in/email, forgot-password vulnerable a email bombing

### Metodologia Auditoria #5 (historica)
Esta auditoria se realizo mediante **6 agentes especializados en paralelo**:

1. **Agente Lockout** (Phase 2): Leyo auth-lockout.ts (302 lineas), handler.ts (148 lineas), rate-limit.ts, ambos test files. Confirmo race condition en lineas 237-255, 4/7 tests, email trim inconsistencia, response format correcto, BA 429 handling correcto, request cloning correcto
2. **Agente Audit Logger** (Phase 3): Leyo audit-logger.ts (134 lineas), 13 unit tests, 4 integration tests, authorization.ts (254 lineas, 6 denial points), billing routes, user admin routes. Confirmo 7 archivos con auditLog, 0 try-catch en auditLog(), todas las interfaces correctas
3. **Agente Webhook/Session** (Phase 1+4): Leyo 6 webhook test files (1022+ lineas), 2 session test files. Confirmo 5/5 signature, 3/3 idempotency con DB real, 6/6 signout, 3/3 multi-session, 0 audit assertions en session tests
4. **Agente Security (IDOR/Auth)**: Verifico sponsorship service (lineas 45-76), owner-promotion service (lineas 46-109), password schemas, session config. Confirmo IDOR en ambos servicios, password inconsistency, sin max sessions
5. **Agente Infraestructura**: Verifico build error en config/env.ts:207, metadata inconsistency, test configs, TODOs/FIXMEs. Confirmo .errors vs .issues, metadata draft vs completed
6. **Agente Audit Matrix**: Scan completo de TODAS las rutas de mutacion (admin + protected + reviews + special + billing). Conteo final: 177 rutas, 7 con auditLog (4.0%)
