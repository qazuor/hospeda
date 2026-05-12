---
title: Editor — publicaciones y tags
description: Gestión completa de posts del blog y etiquetas — solo para el rol de Editor.
order: 2
role: admin-editor
section: Si sos Editor
---

# Editor — publicaciones, tags y eventos

Como editor vas a ver y gestionar **Publicaciones (blog)**, **Etiquetas (tags)** y **Eventos** (creación, edición, publicación, ubicaciones y organizadores). No tenés acceso a usuarios, billing ni configuración.

Esta página cubre publicaciones y tags. Para eventos, los flujos coinciden con los descriptos en [Admin — alojamientos, destinos y eventos](/beta/admin-editor/admin-alojamientos/) (sección Eventos).

## Publicaciones / Blog

### Listar

1. En el menú lateral, andá a **"Publicaciones"**.
2. Vas a ver una tabla con todos los artículos.
3. Probá:
   - Buscar por título
   - Filtrar por estado (los posts usan estados internos: **Draft / Active / Inactive / Archived**, no la dicotomía "borrador/publicado")
   - Cambiar el orden (más recientes / más antiguos)
   - Ir a página 2, 3

> Si ves un filtro "por autor" en algún lugar, anotalo y reportá dónde — no estamos seguros si está expuesto en el listing actual.

### Crear un post nuevo

1. Apretá el botón **"Agregar"** en la cabecera de Publicaciones.
2. Te abre un editor con los siguientes campos:
   - **Título**
   - **URL Amigable** (slug — lo que va después de `/publicaciones/`)
   - **Resumen** (excerpt corto)
   - **Categoría**
   - **Destacado** / **Destacado en Web** / **Es Noticia** (flags)
   - **Contenido** (editor — probá negrita, itálica, listas, links, agregar imagen)
   - **Tiempo de Lectura**
   - **Imagen Destacada**
   - **Galería**
3. Guardalo y verificá que quedó como **borrador (Draft)**.
4. Recargá la página. ¿Quedó guardado?
5. Volvé a abrir el post. En la cabecera vas a ver una pestaña **"SEO"** (es una ruta dedicada `/posts/{id}/seo`). Completá:
   - **Meta title**
   - **Meta description**
   - **Slug**
6. Cambiá el estado del post a **Active** (publicado).
7. Andá al sitio público (en otra pestaña) y buscá tu post en `/publicaciones/`. ¿Apareció?

> Los **tags** del post se asignan desde otra parte (no hay un campo "Tags" dentro del editor básico). Si no encontrás dónde, reportalo describiendo qué buscaste.
>
> 📋 **Reportá:**
>
> - Si el editor de contenido se trabó / no anduvo alguna opción de formato
> - Si no se subió una imagen
> - Si guardaste y al recargar perdiste todo
> - Si el post publicado no aparece en el sitio público

### Editar y borrar

- **Editá** un post existente. Cambiá el contenido. Guardá. ¿Se actualizó en el sitio público?
- Probá **borrarlo** (¿soft delete? ¿borrado real? ¿se puede recuperar?).

## Etiquetas (Tags)

Andá a la sección **"Etiquetas"** del menú lateral. Como Editor vas a ver al menos:

- **Tags de blog (post-tags)** — los que se usan en posts
- **Tags de sistema** — predefinidas (mirá pero no edites)

(Los tipos "Tags internas" y "Tags de moderación de usuario" existen en el panel pero **el Editor no tiene permisos para verlas** — si las ves, reportalo, es un bug.)

Para los tags de blog:

1. **Crear** un tag nuevo. Los campos son **nombre**, **color** y **estado** (no hay campo "descripción").
2. **Editar** uno existente.
3. **Eliminar** uno. Probá eliminar **uno que esté en uso por algún post** y anotá qué pasa: ¿el sistema te avisa antes? ¿lo elimina silenciosamente? ¿los posts pierden el tag o quedan sin él? Reportá el comportamiento exacto.
4. **Asignar** un tag a un post desde el editor del post.
5. En el sitio público, andá a `/publicaciones/etiqueta/[el-tag-que-creaste]/`. ¿Aparecen los posts con ese tag?

> 📋 **Reportá:** lo de siempre — cosas que se ven mal, no funcionan, mensajes confusos.

## Tu perfil de editor

- Andá a **"Mi perfil"** o tu avatar arriba a la derecha.
- Cambiá tu foto, nombre, idioma del panel.
- Cambiá tu contraseña.
- Probá **cerrar sesión** y volver a entrar.
