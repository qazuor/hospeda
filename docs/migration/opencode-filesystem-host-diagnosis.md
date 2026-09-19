# Diagnóstico del host para filesystem read-only

La inspección de esta sesión confirma `/` en `ext4` con opciones `ro,nosuid,nodev,relatime`; `/home` está dentro del mismo mount. Por eso OpenCode no puede crear/abrir archivos aunque los permisos de usuario sean correctos.

No se pudo leer `dmesg` (`Operation not permitted`) y `journalctl -k` no devolvió señales útiles. Por lo tanto no está verificado si el montaje read-only proviene de una protección del host, una sesión administrada/contenedor o una recuperación por errores de disco.

## Próximo diagnóstico fuera de la sesión

En el Ubuntu real, revisar como administrador:

- `findmnt -T /home`
- `journalctl -k -b -p warning..alert`
- `sudo dmesg --level=err,warn`
- estado SMART/NVMe y `/etc/fstab`

No ejecutar remount, fsck o reparación sin entender la causa y tener backup. Si el root del Ubuntu está realmente `ro`, resolverlo a nivel de sistema; si sólo esta sesión está restringida, ejecutar OpenCode desde una sesión con `/home` escribible.

No se hicieron cambios en mounts, permisos, logs ni DBs.
