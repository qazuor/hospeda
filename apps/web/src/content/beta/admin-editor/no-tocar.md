---
title: Lo que NO tenés que tocar
description: Secciones del panel admin que no debés probar — pueden romper el sistema.
order: 8
role: admin-editor
section: Solo admin
audience: ['admin']
---

# Lo que NO tenés que tocar

<aside class="beta-callout beta-callout--info beta-callout--compact">
  <span class="beta-callout__icon" aria-hidden="true">ℹ️</span>
  <div class="beta-callout__body">Sección solo para testers preseleccionados de admin / editor. Si no es tu caso, podés ignorarla. <a href="/beta/admin-editor/acceso-y-roles/">Más info</a>.</div>
</aside>

Estas secciones existen pero **NO las pruebes**:

- ❌ **`/dev/icon-comparison`** — herramienta de dev
- ❌ **Analytics → Debug** — debug interno
- ❌ **Configuración → Crítico** — settings sensibles, podés romper algo
- ❌ **Billing → Tareas Programadas** — cron interno, no tocar
- ❌ **Acceso → Permisos** — lista maestra, podés romper roles
- ❌ **Acceso → Roles** — lista maestra, no editar

Si entrás por curiosidad, **mirá pero no toques.**

## Si encontrás algo crítico

Algo crítico de seguridad (datos personales visibles sin permiso, errores con info del sistema, acceso a lo que no deberías): **WhatsApp privado**, no el grupo.

Leandro — 3442 453797 — <qazuor@gmail.com>.

## Reportes del panel admin

Cuando reportes desde el admin, **aclará que es del panel admin** (no del sitio público):

> "Encontrado en el panel admin, sección Billing → Suscripciones."

Nos ayuda a ubicar el problema más rápido.
