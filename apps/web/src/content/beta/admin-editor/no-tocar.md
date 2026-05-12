---
title: Lo que NO tenés que tocar
description: Secciones del panel admin que no debés probar — pueden romper el sistema.
order: 8
role: admin-editor
section: Si sos Admin
---

# Lo que NO tenés que tocar

Estas secciones existen pero **NO las pruebes**:

- ❌ **`/dev/icon-comparison`** — herramienta de desarrollo, no es para usuarios
- ❌ **Analytics → Debug** — sección de debug interno
- ❌ **Configuración → Crítico** — settings sensibles del sistema, podés romper algo
- ❌ **Billing → Tareas Programadas** — tareas automatizadas internas (cron), no tocar
- ❌ **Acceso → Permisos** — lista maestra de permisos, podés romper roles
- ❌ **Acceso → Roles** — lista maestra de roles, no editar

Si entrás por curiosidad y ves algo raro, **mirá pero no toques nada.**

## Si encontrás algo crítico

Si encontrás algo que parece **crítico de seguridad** (datos personales que se ven sin permiso, errores que muestran información del sistema, posibilidad de acceder a cosas que no deberías), avisanos **directamente por WhatsApp privado**, no por el grupo.

Contacto: Leandro — 3442 453797 — <qazuor@gmail.com>.

## Reportes del panel admin

Cuando reportes desde el panel de admin, **aclará en el reporte que es del panel admin** (no del sitio público). Algo tipo:

> "Encontrado en el panel de admin, sección Billing → Suscripciones."

Esto nos ayuda a ubicar el problema más rápido.
