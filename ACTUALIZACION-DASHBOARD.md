# Actualización de portal académico
Base: portal-carnet-sin-correo.zip. Conserva las credenciales existentes.
1. Exportar respaldos locales y guardar reglas actuales. Comparar y publicar firebase/firestore.rules (añade studentProfiles y learningEvidence).
2. Subir el contenido descomprimido conservando carpetas. No cambiar el proyecto Firebase.
3. Control de notas: publicar nuevamente para incluir instrumentos, máximos y fechas. No se inventan notas faltantes.
4. Estudiante: ingresar con carnet y clave, guardar perfil declarado. La matrícula autorizada no cambia. Evidencias mediante enlaces HTTPS, no archivos alojados.
5. Asistencia: conectar docente, seleccionar grupo y fecha, iniciar y publicar QR. Actualizar registros permite retomar una sesión. Finalizar en nube registra ausencias de cuentas vinculadas; actualizar matriz desde Firebase después. El CSV se abre en Excel; PDF mediante impresión existente. El QR usa el servicio externo ya presente. El temporizador no finaliza automáticamente la sesión.
6. Revisar evidencias del grupo desde Administración QR. No se publican actividades, avisos ni calendario estudiantil nuevos en esta versión. No se verificó conexión real Firebase ni despliegue.
