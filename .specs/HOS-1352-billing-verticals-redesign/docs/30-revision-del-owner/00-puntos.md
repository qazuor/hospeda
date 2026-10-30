# Los puntos del owner (2026-09-28)

## Comentarios en el artifact (ya aplicados al artifact, NO al repo)

- **C1** ¿El código es el mismo para todas las verticales y sólo cambia la configuración? (respondido: motor único; algunas de las 8 diferencias tienen código por opción). Sin cambio de texto.
- **C2** No hay convivencia entre sistema viejo y nuevo, ni código para sostenerla, ni interruptores: se despliega todo el nuevo de una vez. Pregunta abierta: la herramienta que cancela autorizaciones el día del corte, ¿script suelto fuera de los dos sistemas?
- **C3** «commerce» desaparece por completo, ni como histórico (datos se reescriben o borran; el guard falla en todo el repo). Pregunta abierta: ¿sacar la palabra también del documento?
- **C4** La cuota mensual de una capacidad se renueva por fecha del ciclo de la persona (día 15 → siempre 15), también en anual. Precisiones propuestas: altas del 29–31 renuevan el último día del mes; si la fuente no es suscripción, cuenta el día que arrancó la fuente.
- **C5** Pidió explicación de «quien paga sin publicar y le vuelve la ficha sola». Reescrito, sin cambio de regla.
- **C6** Pidió explicación de «ningún rol da capacidades». Reescrito, sin cambio de regla.
- **C7** «Entrar como» el cliente (un admin le maneja la ficha a quien no sabe) no está en esta versión pero SE VA A AGREGAR; condición: queda registrado como hecho por el admin en nombre del cliente.
- **C8** Las verticales no se discontinúan: se saca todo lo de discontinuar (acción 16 y acortar cola, sección de discontinuación, pregunta `finDeServicio`, `admiteAltas`, hecho 4 de retención, `vertical_discontinuation`, motivos y avisos asociados). Retirar planes sigue.
- **C9** Todo plazo en días/meses es configurable desde el panel por el súper admin; el panel rechaza valores contradictorios; un cambio no adelanta fechas ya anunciadas; cada cambio se registra. Quedan fuera los técnicos y los de Mercado Pago o la ley. Pregunta abierta: ¿algún técnico también?
- **C10** Moderación en dos niveles, a elección del admin y cambiable: pedir arreglo sin bajar la ficha (marca al costado, no estado nuevo) o bajarla hasta que se arregle. Listado de arreglos pendientes en el panel. Pregunta abierta: al levantar la baja, ¿vuelve publicada si está cubierto, o a borrador?
- **C11** 90 y 180 días marcados como iniciales configurables (repite C9).
- **C12** El día del corte, las fichas que estaban a la vista nacen como recién creadas y PUBLICADAS; la prueba gratis del dueño arranca ese día. Pregunta abierta: la prueba permite 1 ficha; ¿un dueño con varias a la vista las mantiene todas publicadas durante la prueba?
- **C13** El Mercado Pago falso: tabla cerrada explícita de dónde miente y por qué (13 mentiras, cada una con su medición y la defensa); y una batería que corre sola cada semana contra la cuenta de pruebas comparando la forma de las respuestas, más una mensual en producción, que avisa y no ajusta nada sola. Pregunta abierta: ¿producción mensual o semanal?
- **C14** La pausa pedida por el dueño detiene el reloj de retención de sus fichas (no se archivan ni borran mientras está pausada); al volver se reinicia. Se sacó la validación pausa contra borrado.
- **C15** Migración de los clientes de un plan retirado a un plan vivo de la misma vertical: acto aparte del súper admin, aviso de 60 días (configurable), se aplica en la renovación; si el destino no ofrece su ciclo, queda listado para resolver con él; excedente con fecha; pausados y en gracia esperan.

## Notas nuevas del owner

- **N1** El archivo de configuración de planes que tenemos hoy debe desaparecer: toda la configuración de planes vive 100 % en la base.
- **N2** ¿Mantenemos qzpay, o se hace todo el código en Hospeda directo? (PREGUNTA)
- **N3** Pruebas de punta a punta (e2e) para reducir el costo del smoke manual.
- **N4** Siempre volver a consultar a Mercado Pago ante cualquier aviso suyo o antes de tomar una decisión.
- **N5** Tenemos Codex y OpenCode con modelos GLM o DeepSeek: en la repartida del trabajo hay que usarlos; Claude queda sólo de coordinador.
- **N6** La comunicación entre verticales y billing debe pasar por un único lugar (un servicio o un package compartido, a evaluar), con una interfaz clara, de modo que se pueda probar todo verticales sin billing (simulando ese comunicador) y todo billing sin verticales.
- **N7** ¿Qué hacemos con los ítems «Sin resolver, declarado» del punto 12 de la parte 1 del artifact? (PREGUNTA)
- **N8** ¿Qué pasa si el cliente cancela o pausa la suscripción desde Mercado Pago y no desde Hospeda? ¿Lo detectamos? (PREGUNTA)
- **N9** qzpay agregaba un query string a la URL de notificaciones de Mercado Pago para filtrar eventos de IPN. Quizás algunas notificaciones que no llegaban se debían a ese filtro. ¿Estaba en las mediciones? Si se filtraban en las mediciones que hicimos, ¿hay que medir de nuevo? (PREGUNTA)
