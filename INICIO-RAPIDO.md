# UNIJJAR — Paquete de despliegue corregido

## Cambios de esta entrega
- Incorporado `asistencia/firebase-bridge.js` y panel de sincronización sin cambiar la lógica de las otras páginas.
- Funciones `syncLegacyAttendance` y `getLegacyAttendance` para vincular la matriz antigua con Firestore sin sobrescribir registros existentes.
- QR web por sesión sincronizada, acceso a historial estudiantil y actualización de estados aprobados.
- Eliminada la carpeta duplicada `plan-de-clases-main/plan-de-clases-main/`.
- Añadido `firebase/.firebaserc` con el proyecto correcto, sin cambiar su cuenta ni permisos.
- Endurecida la validación de archivos de evidencia y solicitudes estudiantiles.
- La etiqueta de habilitación a examen en el portal estudiantil consulta ahora la función del servidor, que cuenta solo sesiones finalizadas.
- Conservados los módulos académicos y el módulo antiguo de asistencia.

## Lo que NO está terminado automáticamente
- **No se ha desplegado** a tu cuenta de Firebase.
- El módulo de asistencia mantiene `localStorage` como respaldo local y ahora incluye una **sincronización explícita y no destructiva** con Firestore. Requiere inicio de sesión docente y alumnos vinculados a UID. La importación nunca sobreescribe registros remotos; la descarga de cambios remotos solicita confirmación y genera respaldo antes de modificar el almacenamiento local.
- Las funciones requieren plan Blaze y API de facturación habilitada; revisa los costos antes de activar.
- Para entrar como docente, tu cuenta de Firebase Authentication necesita el claim `teacher:true`; iniciar sesión en Firebase CLI no asigna ese rol.
- Cada estudiante requiere cuenta Email/Password y vinculación de UID y carnet desde el panel docente.

## Publicación (una vez habilitados los servicios y el rol docente)
Desde la carpeta `firebase` del paquete:

```cmd
cd /d "%USERPROFILE%\Downloads\plan-de-clases-main\firebase"
cd functions
npm install
cd ..
firebase deploy --project unijjar-portal-academico --only firestore:rules,storage,functions,hosting
```

Si extraes el ZIP en otra ruta, entra a la carpeta `firebase` real; no copies literalmente la ruta de ejemplo.

**No uses `--force` ni publiques credenciales de cuenta de servicio.** Para Functions, el código requiere Node.js 22. La versión Node.js 26 que figura en tus capturas puede generar avisos; instala Node.js 22 LTS si el despliegue lo exige.

Una vez publicado, la dirección prevista del portal estudiantil es:
https://unijjar-portal-academico.web.app/

Y el acceso docente:
https://unijjar-portal-academico.web.app/docente.html

Estas direcciones **no están verificadas como publicadas**.

## Configuración de rol docente
El archivo `firebase/functions/grant-teacher.js` usa Google Application Default Credentials. Requiere permisos administrativos y `gcloud auth application-default login`; no es suficiente `firebase login`. El UID ya conocido se debe comprobar antes de asignar el rol. No compartas credenciales privadas.

## Prueba obligatoria antes de datos reales
1. Verificar que el docente pueda iniciar sesión y crear una sesión.
2. Registrar una cuenta de estudiante de prueba y vincular su carnet.
3. Escanear el QR, registrar asistencia y confirmar historial desde otro dispositivo.
4. Finalizar sesión y confirmar ausencias; subir y revisar una fotografía.
5. Comprobar que un estudiante no pueda ver o modificar los registros de otro.


## Uso del puente con el módulo de Asistencia
1. Publica el portal web habitual en GitHub Pages **con** `asistencia/firebase-bridge.js` y `portal-estudiante/firebase-config.js` en las rutas que aparecen en el ZIP. El módulo antiguo sigue guardando datos locales sin iniciar sesión.
2. Publica Firebase Functions, Firestore Rules, Storage Rules y Hosting desde `firebase/` (requiere servicios habilitados y permisos administrativos).
3. Abre `asistencia/index.html` desde tu sitio, entra al apartado IX e inicia sesión con la cuenta docente de **Firebase Authentication** con `teacher:true`.
4. Desde `portal-estudiante/docente.html`, vincula cada estudiante con su UID de Firebase Authentication, carnet y el **mismo grupo** que muestra la matriz. Sin vinculación, los estudiantes no pueden registrarse ni ver sus datos y sus registros locales no se importan.
5. Pulsa **Sincronizar grupo actual**. Se importan sesiones de hoy y anteriores; si una sesión está abierta hoy, aparecerá un QR web en el apartado IX. El QR antiguo del apartado III sigue siendo una referencia local, no el enlace del portal web.
6. Los estudiantes inician sesión con sus cuentas de Firebase Authentication para registrar su asistencia y ver su historial. El carnet por sí solo no da acceso a datos personales.
7. Para incorporar cambios aprobados en Firebase a la matriz local, pulsa **Actualizar matriz desde Firebase**: se genera un respaldo JSON, solicita confirmación y actualiza únicamente los registros de los estudiantes vinculados. Recarga la página para mostrar los cambios.
8. Las correcciones docentes de ausencias en la nube se hacen desde el panel docente y quedan auditadas. Los cambios manuales en la matriz local no sobrescriben registros que ya existan en Firebase.

**Limitación deliberada:** la sincronización es explícita (mediante botones), no automática ni bidireccional en tiempo real. Esta decisión evita que la matriz local sobrescriba una justificación aprobada en la nube. Para el registro inmediato en clase, el QR del apartado IX escribe directamente en Firebase. Se necesita una cuenta Firebase por estudiante.
