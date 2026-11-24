# UNIJJAR · Publicación sin Blaze

Este paquete funciona con GitHub Pages + Firebase Authentication + Firestore (plan Spark), siempre que el proyecto tenga una base de datos Firestore creada. NO se despliegan Cloud Functions ni Storage.

## 1. Publicar las reglas de Firestore (obligatorio)
Desde la carpeta `firebase` en la computadora donde ya instalaste Firebase CLI:

```
firebase deploy --only firestore:rules --project unijjar-portal-academico
```

Esto autoriza como docente al UID `1joQiJlWSDOhNX5bFVYD66b7iF72` directamente en las reglas, sin ejecutar `grant-teacher.js`. **Este UID es una autorización permanente para esa cuenta; si cambia el docente hay que editar y volver a publicar las reglas.** No es una clave privada.

## 2. Publicar la web principal
En el repositorio `savvysequeir/plan-de-clases`, subir el CONTENIDO de la carpeta `plan-de-clases-main` a la raíz (no la carpeta envolvente). Mantener GitHub Pages apuntando a la rama `main` y `/ (root)`.

URL principal: https://savvysequeir.github.io/plan-de-clases/

## 3. Uso
- Iniciar sesión en Asistencia, Control de Notas, Instrumentos o Administración docente con la cuenta de Firebase del propietario.
- En Administración docente, vincular cada cuenta de estudiante (UID de Authentication) con carnet, nombre y scope exacto (Carrera|Grupo|Año|Período|Número|Asignatura).
- En Asistencia, sincronizar grupo actual; se crean sesiones y registros para estudiantes previamente vinculados, sin sobrescribir registros remotos existentes.
- Para QR en tiempo real, abrir sesión en Administración docente con fecha y hora de Managua; el estudiante inicia sesión con su propia cuenta y escanea el QR.
- En Control de Notas, publicar notas de estudiantes vinculados. Instrumentos tiene botones para respaldar/restaurar su biblioteca en Firestore.
- Para importar estudiantes a Notas desde Asistencia, usar el botón existente del mismo navegador o el respaldo JSON.

## Límites y precauciones
- Las fotos de justificación no funcionan sin Storage/Blaze. Se admiten solicitudes de texto, con revisión docente.
- El cálculo del porcentaje estudiantil usa registros de asistencia existentes; una sesión aún sin cerrar puede no reflejar ausencias.
- La sincronización de Asistencia es manual; no es en tiempo real hacia la matriz local.
- El botón de cierre en Administración docente registra ausencias de estudiantes **vinculados** y puede tardar con grupos grandes.
- La zona horaria de las sesiones se fija en America/Managua (UTC-06:00).
- Plan de Clases, Plan Académico y Presentaciones conservan sus datos locales originales. Su sincronización a Firebase no está implementada en esta versión.
- Antes de sustituir archivos, exportar respaldos JSON de los módulos existentes.
- No publicar contraseñas ni claves de cuentas de servicio.
