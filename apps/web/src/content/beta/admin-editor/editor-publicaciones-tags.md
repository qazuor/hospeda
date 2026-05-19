---
title: Editor — publicaciones y etiquetas (tags)
description: Gestión completa de posts del blog y etiquetas — rol Editor.
order: 2
role: admin-editor
section: Solo editor
audience: ['admin', 'editor']
---

# Editor — publicaciones, etiquetas y eventos

<aside class="beta-callout beta-callout--info beta-callout--compact">
  <span class="beta-callout__icon" aria-hidden="true">ℹ️</span>
  <div class="beta-callout__body">Sección solo para testers preseleccionados de admin / editor. Si no es tu caso, podés ignorarla. <a href="/beta/admin-editor/acceso-y-roles/">Más info</a>.</div>
</aside>

Como editor gestionás **Publicaciones (blog)**, **Etiquetas (tags)** y **Eventos**. No tenés acceso a usuarios, facturación (billing) ni configuración.

Esta página cubre publicaciones y etiquetas. Para eventos, mirá [Admin — alojamientos, destinos y eventos](/beta/admin-editor/admin-alojamientos/) (sección Eventos).

## Publicaciones / Blog

### Listar

1. Menú lateral → **"Publicaciones"**.
2. Probá:
   - Buscar por título
   - Filtrar por estado (**Borrador / Active / Inactive / Archived** — no la dicotomía "borrador/publicado")
   - Cambiar el orden, ir a página 2, 3

> Si ves un filtro "por autor", anotá dónde — no estamos seguros si está expuesto en la lista actual.

### Crear un post nuevo

1. Botón **"Agregar"** en la cabecera.
2. Campos: **Título**, **URL Amigable** (slug), **Resumen**, **Categoría**, flags **Destacado / Destacado en Web / Es Noticia**, **Contenido** (probá negrita, itálica, listas, enlaces, imágenes), **Tiempo de Lectura**, **Imagen Destacada**, **Galería**.
3. Guardalo y verificá que quedó como borrador. Recargá. ¿Persistió?
4. Reabrí el post. En la cabecera hay pestaña **"SEO"** (`/posts/{id}/seo`): Meta title, Meta description, Slug.
5. Cambiá estado a **Active** y andá al sitio público en `/publicaciones/`. ¿Apareció?

> Las **etiquetas** se asignan desde otra parte (no hay campo "Etiquetas" en el editor básico). Si no encontrás dónde, reportalo.
>
> 📋 **Reportá:** editor trabado, opción de formato rota, imagen que no subió, perdiste todo al recargar, post publicado que no aparece en el sitio.

### Editar y borrar

- **Editá** un post existente, guardá y verificá que se actualizó en el sitio público.
- Probá **borrarlo** (¿soft delete? ¿borrado real? ¿se recupera?).

## Etiquetas (tags)

Menú lateral → **"Etiquetas"**. Vas a ver al menos:

- **Etiquetas de blog (post-tags)** — usadas en posts
- **Etiquetas de sistema** — predefinidas (mirá, no edites)

(Los tipos "Internas" y "Moderación de usuario" existen en el panel pero el Editor no tiene permisos. Si las ves, reportalo: es error (bug).)

Para las etiquetas de blog:

1. **Crear**: campos **nombre**, **color**, **estado** (no hay "descripción").
2. **Editar** una existente.
3. **Eliminar** una **en uso por algún post**: ¿el sistema avisa antes? ¿la elimina silenciosamente? ¿los posts pierden la etiqueta? Reportá el comportamiento exacto.
4. **Asignar** una etiqueta a un post desde el editor.
5. Sitio público → `/publicaciones/etiqueta/[la-etiqueta]/`. ¿Aparecen los posts?

> 📋 **Reportá:** cosas mal, que no funcionan, mensajes confusos.

## Tu perfil de editor

- **"Mi perfil"** o avatar arriba a la derecha.
- Cambiá foto, nombre, idioma del panel, contraseña.
- Probá cerrar sesión y volver a entrar.

## Próximo paso

Si tu rol es **admin**, seguí con **[Admin — alojamientos, destinos y eventos](/beta/admin-editor/admin-alojamientos/)**. Si sos solo editor, ya está — pasá a **[Cómo reportar errores](/beta/reportar-bugs/como-reportar/)**.
