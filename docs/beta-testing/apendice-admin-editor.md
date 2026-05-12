# Apéndice para Admins y Editores

> Este documento es solo para los testers a los que les asignamos rol de **Admin** o **Editor** del sistema. Es un complemento de la [guía principal](https://www.notion.so/cheroga/GUIA-3599fb45673980a4877dd8603f950051) — leela primero.

---

## ¿Qué hago acá?

Te elegimos para probar el **panel de administración** de Hospeda. Es la parte que solo ven los administradores y editores (no los usuarios comunes). Es donde se gestiona todo el contenido y la operación del sitio.

**Tu rol específico (admin o editor)** te lo dijimos por WhatsApp cuando te sumamos. Si no te acordás, preguntanos. La diferencia es:

| Rol | Qué puede hacer |
| --- | --- |
| **Editor** | Solo gestiona **publicaciones (blog)** y **etiquetas (tags)**. No ve usuarios, ni billing, ni configuración. |
| **Admin** | Ve y gestiona casi todo: alojamientos, destinos, eventos, posts, billing, sponsors, conversaciones, etc. |

---

## Tabla de contenidos

1. [Antes de empezar](#1-antes-de-empezar)
2. [Cómo entrar al panel](#2-cómo-entrar-al-panel)
3. [Cómo te damos acceso al panel (registro + promoción)](#3-cómo-te-damos-acceso-al-panel-registro--promoción)
4. [Si sos EDITOR — qué probar](#4-si-sos-editor--qué-probar)
5. [Si sos ADMIN — qué probar](#5-si-sos-admin--qué-probar)
6. [Flujos guiados (paso a paso)](#6-flujos-guiados-paso-a-paso)
7. [Lo que NO tenés que probar](#7-lo-que-no-tenés-que-probar)
8. [Cómo reportar (igual que la guía principal)](#8-cómo-reportar-igual-que-la-guía-principal)
9. [Cierre](#9-cierre)

---

## 1. Antes de empezar

Cosas obvias pero las decimos igual:

- **No es un servidor de producción.** Hacé lo que quieras. No vas a romper datos reales de clientes.
- **Probá en celular y compu** igual que con la guía principal. El panel de admin se usa más en compu, pero también lo abrimos a probar en celular para detectar problemas.
- **No compartas tus credenciales** (ni siquiera con otros testers). Cada uno tiene las suyas.
- **Si encontrás algo crítico** (datos personales expuestos, errores graves de seguridad), avisanos por WhatsApp directo, no por el FAB. Después también ponelo en el FAB.

---

## 2. Cómo entrar al panel

El panel de administración está en una URL distinta:

> **<https://admin-staging.hospeda.com.ar>**

Abrí ese link en tu navegador. Vas a ver una pantalla de login.

⚠️ **Si te aparece un error o pantalla blanca**, sacá foto y avisanos. **No avances.**

---

## 3. Cómo te damos acceso al panel (registro + promoción)

**No te vamos a entregar una cuenta admin pre-creada.** El flujo es distinto: vos te registrás como cualquier usuario normal, después yo te promuevo manualmente a Admin o Editor según corresponda.

### Paso 1 — Registrate en el sitio público como usuario normal

Andá a **<https://staging.hospeda.com.ar>** y registrate como cualquier turista. Si necesitás el paso a paso, mirá la sección A.2 de la [guía principal](https://www.notion.so/cheroga/GUIA-3599fb45673980a4877dd8603f950051). Podés registrarte:

- Con email y contraseña
- Con Google
- Con Facebook

> Anotate (o acordate de) el email que usaste. Lo necesito para promoverte.

### Paso 2 — Avisame por WhatsApp que ya te registraste

Cuando termines de registrarte, escribime por **WhatsApp privado** a Leandro — 3442 453797 — <qazuor@gmail.com>.

Decime:

- El **email** con el que te registraste
- El **rol** que te corresponde (Admin o Editor — te lo dijimos cuando te sumamos al beta)

### Paso 3 — Yo te promuevo el rol

Yo, manualmente, te paso de "usuario normal" a Admin o Editor. Puede tardar **unos minutos o unas horas**, depende del momento del día en que me avises. Te confirmo por WhatsApp cuando esté hecho.

### Paso 4 — Ya podés entrar al panel

Una vez que te confirmé la promoción:

1. Abrí **<https://admin-staging.hospeda.com.ar>**.
2. Logueate con el **mismo email y contraseña** que usaste para registrarte en el sitio público.
3. Entrás al **dashboard principal** del panel admin.
4. Recorrelo. Mirá los KPIs (usuarios, alojamientos, ingresos).

> 📋 **Reportá:**
>
> - Si el login no funciona aun después de que te confirmé la promoción
> - Si después de loguearte aparece pantalla blanca
> - Si los números del dashboard parecen raros
>
> ⚠️ **Si intentás entrar al panel ANTES de que yo te promueva**, vas a ver una pantalla tipo "no tenés permisos" o algo similar. **Eso es esperado**, no es un bug. Esperá la confirmación.

---

## 4. Si sos EDITOR — qué probar

Como editor solo vas a ver y gestionar **Publicaciones (blog)** y **Etiquetas (tags)**.

### 4.1. Publicaciones / Blog

#### Listar

1. En el menú lateral, andá a **"Publicaciones"** o **"Posts"**.
2. Vas a ver una tabla con todos los artículos.
3. Probá:
   - Buscar por título
   - Filtrar por estado (borrador / publicado)
   - Filtrar por autor
   - Cambiar el orden (más recientes / más antiguos)
   - Ir a página 2, 3

#### Crear un post nuevo

1. Apretá **"Nuevo post"** o **"Crear publicación"**.
2. Te abre un editor:
   - Título
   - Contenido (acá tenés un editor con formato — probá negrita, itálica, listas, links, agregar imagen)
   - Imagen de portada
   - Excerpt / descripción corta
   - Estado: borrador / publicado
   - Categoría
   - Tags
3. Guardalo como **borrador** primero.
4. Recargá la página. ¿Quedó guardado?
5. Volvé a abrir el post, completá el SEO (tab "SEO" si está):
   - Meta title
   - Meta description
   - Slug (la URL)
6. Cambiá el estado a **publicado**.
7. Andá al sitio público (en otra pestaña) y buscá tu post en `/publicaciones/`. ¿Apareció?

> 📋 **Reportá:**
>
> - Si el editor de contenido se trabó / no anduvo alguna opción de formato
> - Si no se subió una imagen
> - Si guardaste y al recargar perdiste todo
> - Si el post publicado no aparece en el sitio público

#### Editar y borrar

- Editá un post existente. Cambiá el contenido. Guardá. ¿Se actualizó en el sitio público?
- Probá borrarlo (¿soft delete? ¿borrado real? ¿se puede recuperar?).

### 4.2. Etiquetas (Tags)

Andá a la sección **"Etiquetas"** o **"Tags"** del menú. Vas a ver varias categorías:

- **Tags de blog** (que se usan en posts)
- **Tags internas** (uso interno, no visibles al público)

Para los tags de blog:

1. Crear un tag nuevo (nombre, color, descripción).
2. Editar uno existente.
3. Eliminar uno (probá uno que esté en uso — debería avisarte).
4. Asignar un tag a un post desde el editor del post.
5. En el sitio público, andá a `/publicaciones/etiqueta/[el-tag-que-creaste]/`. ¿Aparecen los posts con ese tag?

> 📋 **Reportá:** lo de siempre — cosas que se ven mal, no funcionan, mensajes confusos.

### 4.3. Tu perfil de editor

- Andá a **"Mi perfil"** o tu avatar arriba a la derecha.
- Cambiá tu foto, nombre, idioma del panel.
- Cambiá tu contraseña.
- Probá **cerrar sesión** y volver a entrar.

---

## 5. Si sos ADMIN — qué probar

Como admin tenés acceso a **mucho más** que un editor. Te recomendamos hacer todo lo del editor (sección 4) y además todo esto.

> Para no abrumarte, te organizamos las áreas por importancia. Probá todo lo que puedas en las 2-3 semanas.

### 5.1. Dashboard principal (prioridad alta)

- Mirá los KPIs (usuarios, alojamientos, ingresos, etc.).
- Mirá los gráficos / tendencias.
- ¿Los números cuadran? ¿Te parecen razonables?

### 5.2. Alojamientos (prioridad alta)

Tenés CRUD completo:

- **Listar** alojamientos: usá filtros por estado, tipo, propietario, búsqueda.
- **Ver detalle** de un alojamiento: mirá las tabs (General, Amenidades, Galería, Precios, Reseñas).
- **Editar** un alojamiento: cambiá un campo, guardá, fijate si se actualizó en el sitio público.
- **Crear** alojamiento desde admin: completá el wizard. ¿Funcionó?
- **Borrar** uno: ¿soft delete? ¿se puede recuperar?

#### Casos especiales

- Probá editar la **galería** de un alojamiento: subir, reordenar, eliminar fotos.
- Probá editar las **amenidades** y **características**.
- Probá modificar los **precios** (por noche, por temporada).
- Mirá las **reseñas** del alojamiento. ¿Podés moderarlas? ¿Marcar spam?

> 📋 **Reportá:** todo lo que no haya guardado, dado error o no se haya reflejado en el sitio público.

### 5.3. Destinos (prioridad alta)

Mismo flujo que con alojamientos:

- Listar, filtrar, buscar.
- Ver detalle (tabs: General, Alojamientos, Atracciones, Eventos).
- Editar: cambiá descripción, foto cover.
- Crear un destino nuevo (ciudad, región).
- Asignar atracciones (puntos de interés) al destino.

### 5.4. Eventos (prioridad media)

- Listar y filtrar eventos.
- Crear un evento (nombre, descripción, fecha, ubicación, organizador, categoría).
- Editar un evento existente.
- Andá al sub-menú de **Ubicaciones de eventos** (venues): crear / editar / eliminar.
- Andá a **Organizadores de eventos**: crear / editar / eliminar.

> ⚠️ **Importante:** la gestión de **tickets / asistentes** todavía no está completa. **No la reportes** si no la encontrás.

### 5.5. Publicaciones / Blog (mismo que editor)

Mirá la sección 4.1 — todo eso aplica también.

Adicional como admin:

- En la pestaña **SEO** del post, tenés más opciones que editor.
- En la pestaña **Sponsorship** del post, podés asignar marcas patrocinadoras / enlaces promocionales.

### 5.6. Contenido transversal (prioridad media)

Hay un sub-menú **Contenido** con:

- **Amenidades de alojamientos** (la lista maestra: WiFi, Pool, Estacionamiento, etc.). Probá agregar una nueva, editar una, eliminar.
- **Características de alojamientos** (habitaciones, baños, etc.).
- **Atracciones turísticas** (puntos de interés que después se asignan a destinos).

> 📋 **Reportá:** si una amenidad / característica que creaste no aparece después en el formulario del host.

### 5.7. Etiquetas / Tags (mismo que editor + más)

Como admin tenés acceso a más tipos:

- Tags de blog (visibles para usuarios)
- Tags internas (de organización interna)
- Tags de sistema (predefinidas, modificables con cuidado)
- Tags de moderación de usuario (marcar spam, abuso, etc.)

### 5.8. Billing / Monetización (prioridad alta)

Esta sección es **clave** y muy grande. Tomate tu tiempo.

#### Planes

Andá a **Billing → Planes**. Vas a ver los 3 planes (Basic, Pro, Premium).

- Mirá los datos de cada uno (precio, límites, qué incluye).
- Probá editar el precio de un plan.
- Probá crear un plan nuevo de prueba.
- Probá cambiar la visibilidad (público / oculto).
- Volvé al sitio público y mirá si los planes se actualizaron en `/suscriptores/planes/`.

#### Suscripciones

Andá a **Billing → Suscripciones**.

- Vas a ver la tabla con todas las suscripciones.
- Filtrá por plan, por estado (activa / cancelada / vencida), por cliente.
- Abrí una al azar. ¿Se ven los datos? ¿Historial de pagos?

#### Add-ons

Andá a **Billing → Add-ons**.

- ¿Hay add-ons cargados? Si no, probá crear uno (featured listing, soporte prioritario, etc.).

#### Códigos promocionales

Andá a **Billing → Códigos promo**.

- Crear un código nuevo:
  - Código: "BETATEST50"
  - Tipo: porcentaje
  - Valor: 50%
  - Vence: en 30 días
  - Usos máximos: 100
- Crear otro al **100%** (debería dejar el total en $0).
- Listar los códigos creados.
- Editar uno.
- Probá usarlo desde otra cuenta de host en checkout: ¿aplica el descuento?

#### Promociones para propietarios (Owner Promotions)

> ⚠️ Esto es **distinto** a los códigos promo. Las owner promotions son promos específicas de un alojamiento (ej. descuento del 20% en una cabaña por temporada baja). Los promo codes son cupones globales para suscripciones.

Andá a **Billing → Promociones para propietarios** y probá crear una.

#### Sponsorships

Andá a **Billing → Patrocinios** o **Sponsorships**.

- Crear un sponsorship asociando una marca a un post.
- Asignar duración, monto, etc.

#### Pagos

Andá a **Billing → Pagos**. Vas a ver la lista de transacciones.

- Filtrá por estado (aprobado, rechazado, pendiente).
- Buscá por cliente, fecha.
- Abrí un pago. ¿Tenés opción de **reembolso**? Si sí, probala con un pago de prueba.

#### Facturas

Andá a **Billing → Facturas**.

- Listar facturas existentes.
- Generar una factura nueva.
- Descargarla en PDF.
- Cambiar el estado (borrador → emitida → pagada).

#### Notas de crédito

Andá a **Billing → Notas de crédito**.

- ¿Hay alguna? Crear una de prueba (devolución parcial, ajuste).

#### Tasas de cambio

Andá a **Billing → Tasas de cambio**.

- Mirá la tasa actual ARS/USD.
- Probá actualizar manualmente.
- ¿Hay sincronización automática con alguna API?

#### Métricas

Andá a **Billing → Métricas**.

- Mirá los KPIs: MRR, ARR, churn, ARPU.
- ¿Tienen sentido?

#### Logs y eventos (importante)

- **Notification logs** → Logs de notificaciones de billing enviadas
- **Webhook events** → Eventos recibidos desde MercadoPago

Estos son útiles para debuggear cuando un pago no se procesa bien. Mirá si tienen datos.

> 📋 **Reportá:** todo lo que no haya guardado bien, números que no cuadran, secciones que no cargan, errores en pantalla.

### 5.9. Acceso (Usuarios / Roles / Permisos) (prioridad media)

> ⚠️ **Cuidado:** esta sección modifica permisos del sistema. **No le saques permisos a tu propia cuenta** o te quedás afuera.

Andá a **Acceso → Usuarios**.

- Listar usuarios. Filtrar por rol, estado.
- Buscar por email.
- Abrir un usuario al azar. Mirar las tabs (General, Actividad, Permisos).
- Editar un usuario (cambiar nombre, agregar permisos extra).
- Crear un usuario admin nuevo de prueba.

> ⚠️ **NO toques las secciones "Roles" ni "Permisos"** (las listas maestras). Solo miralas. No las edites.

### 5.10. Sponsors (prioridad baja)

Andá a **Sponsors**.

- Listar sponsors (marcas).
- Crear uno nuevo.
- Asignarle sponsorships activos.

### 5.11. Conversaciones (prioridad baja)

Andá a **Conversaciones**.

- Listar todas las conversaciones de la plataforma (entre turistas y hosts).
- Filtrar por fecha, estado, participantes.
- Abrir una conversación. ¿Podés moderar? ¿Cerrar? ¿Marcar resuelta?

### 5.12. Notificaciones (prioridad baja)

Andá a **Notificaciones**.

- Mirá tu inbox de notificaciones del sistema.
- Marcá como leído / sin leer.

### 5.13. Configuración SEO (prioridad baja)

Andá a **Configuración → SEO**.

- Mirá la configuración de robots.txt, sitemap, structured data.
- ⚠️ **No la modifiques sin avisar.** Si algo no se entiende, reportalo.

### 5.14. Revalidación de cache

Andá a **Revalidación**.

- Probá forzar la revalidación de páginas estáticas (ej. después de editar un alojamiento, forzar revalidación para que el sitio público se actualice).

---

## 6. Flujos guiados (paso a paso)

Estos son flujos completos de uso real. Hacelos completos al menos una vez:

### 6.1. Flujo: crear destino con todo

1. **Acceso → Usuarios** → crear un usuario "host de prueba" con tu email + 1.
2. **Destinos** → crear un destino nuevo "Ciudad de Prueba".
3. **Contenido → Atracciones** → crear 3 atracciones turísticas y asignalas al destino.
4. **Alojamientos** → crear un alojamiento en ese destino.
5. Andá al **sitio público** (otra pestaña) y verificá:
   - ¿El destino aparece en el catálogo?
   - ¿Las atracciones aparecen en el detalle del destino?
   - ¿El alojamiento aparece en "alojamientos en ese destino"?

### 6.2. Flujo: gestionar una suscripción de host

1. Crear un host nuevo (con otro email tuyo).
2. Desde la web pública, suscribirlo a un plan con tarjeta test de MP.
3. Volver al admin → **Billing → Suscripciones** → buscar esa suscripción.
4. Mirar el detalle. ¿Está activa? ¿Próxima renovación correcta?
5. Ir a **Billing → Pagos** → buscar el pago asociado.
6. Si hay opción de reembolso, probarla.
7. Ir a **Billing → Facturas** → ver si se generó factura para ese pago.

### 6.3. Flujo: moderar contenido

1. Desde otra cuenta (turista), dejá una reseña en un alojamiento.
2. Volvé al admin → **Alojamientos → [el alojamiento]** → tab Reseñas.
3. Encontrá la reseña.
4. Probá moderarla (aprobar / rechazar / marcar spam).
5. Verificá en el sitio público si la reseña apareció / desapareció.

### 6.4. Flujo: publicar un post de blog completo

1. **Publicaciones → Nuevo post**.
2. Escribir título, contenido (con formato), imagen de portada.
3. Asignarle 3 tags y 1 categoría.
4. Configurar el SEO (meta title, description, slug).
5. Guardar como borrador.
6. Editarlo, asignarle un sponsorship.
7. Cambiar a estado **publicado**.
8. Ir al sitio público y verificar:
   - El post aparece en `/publicaciones/`
   - Aparece bajo su categoría y bajo cada tag
   - El SEO se aplica (mirá el title de la pestaña del navegador)
   - El sponsorship se ve

---

## 7. Lo que NO tenés que probar

Estas secciones existen pero **NO** las pruebes:

- ❌ **`/dev/icon-comparison`** (herramienta de desarrollo, no es para usuarios)
- ❌ **Analytics → Debug** (sección de debug interno)
- ❌ **Configuración → Crítico** (settings sensibles del sistema, podés romper algo)
- ❌ **Billing → Cron** (tareas automatizadas internas, no tocar)
- ❌ **Acceso → Permisos** (lista maestra de permisos, podés romper roles)
- ❌ **Acceso → Roles** (lista maestra de roles, no editar)

Si entrás por curiosidad y ves algo raro, mirá pero **no toques nada**.

---

## 8. Cómo reportar (igual que la guía principal)

Mismo sistema:

- **Bugs / errores / cosas que no funcionan** → botón azul (FAB) abajo a la derecha
- **Dudas / preguntas / feedback general** → grupo de WhatsApp <https://chat.whatsapp.com/BDvBuU0rAfNJYh3RDaMgvL>

Cuando reportes desde el panel de admin, **agregá en el reporte que es del panel admin** (no del sitio público). Algo tipo:

> "Encontrado en el panel de admin, sección Billing → Suscripciones."

Esto nos ayuda a ubicar más rápido.

### Casos críticos

Si encontrás algo que parece **crítico de seguridad** (datos personales que se ven sin permiso, errores que muestran información del sistema, posibilidad de acceder a cosas que no deberías), avisanos **directamente por WhatsApp privado**, no por el grupo. Te pasamos el contacto.

---

## 9. Cierre

Te tocó la parte más compleja del beta. Probar el panel de admin requiere **paciencia y atención al detalle**. Gracias por bancar.

Recordá:

- Probá **al menos una vez cada sección** que te corresponda según tu rol
- Hacé los **flujos guiados** completos (sección 6)
- **No toques** las secciones de la sección 7
- Reportá todo, aunque parezca menor

Si te trabás en algo, escribí al grupo o directo a Leandro — 3442 453797 — <qazuor@gmail.com>.

Gracias de nuevo. Tu mirada técnica y atenta en esta parte vale el doble.
