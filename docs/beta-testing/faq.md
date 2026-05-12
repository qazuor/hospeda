# Preguntas frecuentes (FAQ)

> Si te trabaste con algo, mirá acá primero. Si tu pregunta no está, escribí al grupo de WhatsApp <https://chat.whatsapp.com/BDvBuU0rAfNJYh3RDaMgvL> y te ayudamos.

---

## Sobre el beta en general

### ¿Qué es esto del "beta"?

Es una fase de prueba. El sitio todavía no está abierto al público. Te invitamos a probarlo antes y darnos tu opinión para arreglar lo que esté mal.

### ¿Cuánto dura?

**Depende de cuántas cosas vayamos encontrando.** Puede durar entre **2 semanas y 1 mes**. Si encontramos pocas cosas, cerramos rápido. Si aparecen muchas, lo extendemos. Te avisamos por WhatsApp cuando arranca y cuando lo damos por terminado.

### ¿Cuánto tiempo le tengo que dedicar?

**Lo que más puedas.** Como mínimo te pedimos **3 horas por semana**. Pueden ser de un saque o repartidas en distintos momentos. Mejor repartido (un rato de día, otro de noche, otro en distinto dispositivo).

### ¿Cobro algo por hacer esto?

**No.** Es voluntario. Pero si descubrís algo importante o reportás varias cosas útiles, vamos a tener algún detalle de agradecimiento al final.

### ¿Tengo que ser experto en computación?

**No, todo lo contrario.** Justamente queremos personas que NO sean expertas, porque la gran mayoría de los usuarios reales no lo van a ser.

### ¿Y si rompo algo?

**No vas a romper nada.** El sitio que estás usando es una copia de prueba aislada del sitio real. Hacé lo que quieras.

### ¿Tengo que probar todo todo?

**Lo ideal sí, pero si no te da el tiempo, no.** Probá las features que más te interesen / te llamen la atención. Mejor 5 cosas probadas con detalle que 50 a las apuradas. Cualquier reporte ayuda, aunque sea poco.

---

## Sobre cómo entrar al sitio

### ¿Cuál es el link?

> **<https://staging.hospeda.com.ar>**

### Me dice "el sitio no es seguro" / "certificado inválido"

Sacale captura y reportanos por WhatsApp. **No avances.**

### Entré pero está en blanco / no carga

Probá:

1. Refrescar la página (F5 en compu, deslizar para abajo en celular).
2. Cerrar y abrir el navegador.
3. Probar con otro navegador (si usás Chrome, probá con Firefox o Safari).
4. Si nada anda, avisanos por WhatsApp.

### ¿Puedo usar el sitio desde mi tablet / iPad?

Sí, sumate. Cuanto más variado el dispositivo, mejor. Pero la regla principal es que **probás celular y compu sí o sí**. Tablet es bonus.

### ¿Qué navegador uso?

El que ya uses. Chrome, Firefox, Safari, Edge — todos están soportados. **Versiones muy viejas (Internet Explorer) NO** las soportamos.

**Si tenés más de un navegador instalado en tu compu, probá en todos los que puedas.** Cosas que andan en Chrome a veces se rompen en Safari, y viceversa. Cada navegador que pruebes es un par de ojos extra.

### En el celular, ¿lo uso parado o acostado?

**Las dos.** Probalo vertical (como siempre) y horizontal (girado 90°). Idealmente, girá el celular **mientras** estás navegando una página, no antes. La idea es ver si el sitio se acomoda solo o queda raro.

---

## Sobre crear cuenta y loguearse

### Me registré pero no me llega el email de confirmación

Probá:

1. **Revisá la carpeta de Spam / Correo no deseado** (esto es lo más común).
2. Esperá 5 minutos. A veces tarda.
3. Pedí que reenvíen el email (debería haber un botón en la pantalla post-registro).
4. Si después de 30 minutos no llega, reportalo. Es un bug que queremos saber.

### ¿Puedo registrarme con email "falso"?

Necesitás un email real porque te mandamos el link de confirmación ahí. Si querés usar uno secundario tuyo, perfecto. Si tenés Gmail, te recomendamos algo tipo `tuemail+beta@gmail.com` (Gmail entiende el `+` y lo manda igual a tu casilla normal).

### Me olvidé la contraseña

En la pantalla de login hay un link **"Olvidé mi contraseña"**. Apretalo, ingresá tu email, y te llega un link para resetear. Si no te llega, mirá Spam.

### ¿Puedo entrar con Google / Facebook?

Sí, son las 2 opciones disponibles. Apretá el botón "Continuar con Google" o "Continuar con Facebook" en la pantalla de login / registro.

### Me logueé pero me cierra la sesión sola

Reportalo. Eso es un bug. Decinos cuánto tiempo después se cerró.

### ¿Puedo tener varias cuentas?

Para el beta, sí. Si querés probar como turista y como host, podés crear 2 cuentas con emails distintos.

---

## Sobre los pagos

### ¿Tengo que pagar de verdad?

**NO.** Vas a usar tarjetas de prueba que no son reales. El sistema está en modo "sandbox", no se cobra plata.

> Excepción: si te avisamos **por privado** que sos uno de los 2 testers de prueba con dinero real, mirá el [anexo de pago real](https://www.notion.so/cheroga/ANEXO-3599fb45673980b89310d5c69cf21703). Ese caso te lo dijimos personalmente.

### ¿Dónde están las tarjetas de prueba?

Te las pasamos por WhatsApp y también están en la sección B.4 de la [guía principal](https://www.notion.so/cheroga/GUIA-3599fb45673980a4877dd8603f950051). Si no las encontrás, pedilas en el grupo.

### Usé la tarjeta de prueba y me dice "rechazada"

En MercadoPago test, **el nombre del titular** que pongas controla si el pago se aprueba, rechaza o queda pendiente:

- Para que **apruebe**: poné `APRO` como nombre del titular.
- Para que **rechace**: poné `OTHE` (rechazo genérico), `FUND` (fondos), `SECU` (CVV), etc.
- Para que quede **pendiente**: poné `CONT`.

La tabla completa está en la sección B.4 de la [guía principal](https://www.notion.so/cheroga/GUIA-3599fb45673980a4877dd8603f950051). Si querés probar el flujo de pago fallido, usá los nombres de titular que rechazan. Si querés que apruebe, usá `APRO`.

### Pagué pero no me activaron la suscripción

Es un bug. Reportalo con:

- Hora del pago
- Plan que querías
- Captura de la pantalla de éxito (si la viste)
- Email con el que estás registrado

### ¿Me van a llegar emails de pago?

**No por ahora.** Los emails de confirmación de pago / factura todavía no se mandan. Solo recibís email al registrarte y al pedir reset de contraseña.

---

## Sobre cómo reportar

### ¿Dónde está el botón azul para reportar?

**Abajo a la derecha en todas las páginas.** Si no lo ves:

- Refrescá la página.
- Esperá unos segundos a que cargue.
- Si después de 30 segundos no aparece, reportalo por WhatsApp.

### ¿Cómo saco una captura de pantalla?

| Dispositivo | Cómo |
| --- | --- |
| Celular Android | Apretá **Volumen abajo + Encendido** al mismo tiempo |
| iPhone con botón Home | **Home + Encendido** al mismo tiempo |
| iPhone sin Home | **Subir volumen + Encendido** al mismo tiempo |
| Windows | Tecla **PrtSc** (imprimir pantalla) o `Win + Shift + S` (selección) |
| Mac | `Cmd + Shift + 4` (selección) o `Cmd + Shift + 3` (pantalla completa) |
| Linux | `PrtSc` o usá la app "Captura de pantalla" |

### ¿Tengo que escribir mucho en el reporte?

**No es obligatorio**, pero sí es lo ideal. Una frase clara + una captura es el mínimo aceptable. Lo ideal es agregarle:

- Qué estabas haciendo
- Qué pasó
- Qué esperabas que pasara
- Datos de tu dispositivo (marca / modelo / OS / navegador)

Cuanto más detalle, más rápido lo arreglamos. Si dudás dónde poner algún dato, ponelo en **descripción** sin pensarla demasiado.

### El FAB me carga datos automáticamente, ¿los borro o los dejo?

**Dejalos.** El botón azul (FAB) llena automáticamente varios campos con info útil (URL, navegador, etc.). **No los borres ni los modifiques.** Solo agregá tu info encima — título, descripción, captura, lo que tengas.

### ¿Reporto cosas obvias?

**Sí, igual reportá.** A veces lo "obvio" lo tenemos tan adentro nuestro que no lo vemos. Vos sí.

### ¿Reporto si algo NO me gusta estéticamente?

**Sí.** Diseño, colores, tamaños de letras, todo eso lo queremos saber. Es parte del beta.

### Reporté algo y no me responden

No te preocupes. **No respondemos a cada reporte uno por uno** — son demasiados. Lo leímos, lo anotamos, lo arreglamos. Si necesitamos más info te contactamos.

### ¿Dónde puedo ver lo que reporté?

Por ahora no hay un lugar para que veas tus reportes anteriores. Si querés, anotalos en una libreta o documento aparte.

### Reporté algo pero ahora veo que se arregló

¡Bárbaro! Si querés, escribí al grupo "se arregló X, gracias". Nos motiva un montón.

---

## Sobre el sitio

### ¿En qué idioma está?

En **español** principal. También está disponible en **inglés** y **portugués**. Hay un selector de idioma arriba (puede tener una banderita o decir "ES / EN / PT").

### El sitio se ve oscuro / claro y yo no quiero

Hay un botón para cambiar el **tema** (claro / oscuro). Buscá un sol o una luna en el header.

### Una imagen no carga

Captura + reporte. Es un bug.

### Una página no existe (error 404)

Captura + reporte. Decinos qué link estabas siguiendo.

### El sitio anda lento

Reportalo igual. Decinos:

- Qué página
- Cuánto tarda más o menos
- Si tu internet en general está lento o no
- Si te pasa solo en este sitio o en todos

---

## Sobre privacidad y datos

### ¿Los datos que pongo en el beta son seguros?

El sistema está en un servidor separado del público. Tus datos de prueba **no se mezclan con datos reales** de clientes.

### ¿Puedo borrar mi cuenta de prueba al final?

**Sí.** Avisanos al final del beta y te la borramos completamente.

### ¿Mis reportes son anónimos?

Lo que reportes desde el botón azul queda asociado a tu cuenta logueada (si estás logueado). Lo que escribas en el grupo de WhatsApp lo ve todo el grupo. **No reportes información personal sensible** (números de tarjeta, claves, etc.) en el grupo.

### ¿Pueden ver lo que escribo en formularios?

Como sos beta tester, sí, podemos ver lo que pongas en formularios para entender cómo lo usás. **No pongas datos reales sensibles tuyos** (DNI real, datos bancarios, etc.) excepto que el doc te lo pida específicamente (ej. el [anexo de pago real](https://www.notion.so/cheroga/ANEXO-3599fb45673980b89310d5c69cf21703)).

---

## Otras preguntas

### Tengo un familiar que también quiere probar, ¿puedo sumarlo?

Mejor consultanos primero. El beta tiene un cupo de 40 personas seleccionadas. Si tu familiar encaja en algún perfil que nos falta cubrir, lo sumamos.

### ¿Puedo compartir capturas o cosas del sitio en redes sociales?

**No por ahora.** El sitio todavía no es público y queremos lanzarlo nosotros cuando esté listo. Las capturas son solo para los reportes y para el grupo. Cuando el beta termine y lancemos, ahí sí compartilo.

### ¿Hay video tutorial?

Sí. Te lo dejamos al principio de la [Guía del beta tester](https://www.notion.so/cheroga/GUIA-3599fb45673980a4877dd8603f950051), en la sección **"Antes de arrancar: el video"**. Son 2 minutos. **Velo.**

### Llegué tarde al beta, ¿puedo entrar?

Hablá con Leandro por privado y vemos.

### ¿Cuándo lanza Hospeda al público?

Después de procesar todo lo que reporten en el beta. Estimamos algunas semanas / meses, depende de cuántas cosas haya que arreglar.

### Algo más

Si tenés una duda que no está acá, **preguntanos en el grupo de WhatsApp** <https://chat.whatsapp.com/BDvBuU0rAfNJYh3RDaMgvL>. Vamos agregando preguntas a este documento a medida que aparecen.

---

**Gracias de nuevo por bancar este beta.** Tu paciencia para leer este documento ya es un montón.

— Leandro y el equipo de Hospeda
