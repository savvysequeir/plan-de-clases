# UNIJJAR — Activación de asistencia QR con Firebase

**Estado:** código preparado, **NO desplegado**. Sin tu proyecto Firebase y sus credenciales públicas no se puede poner en producción ni sincronizar móviles. La antigua asistencia local sigue existiendo; el sistema nuevo es independiente. **No hay sincronización automática entre las tablas antiguas y Firestore**.

## 1. Crear y configurar Firebase

1. En https://console.firebase.google.com/ crea un proyecto y registra una **aplicación Web**.
2. Activa **Authentication → Email/Password**, **Cloud Firestore**, **Cloud Storage** y **Cloud Functions**. Cloud Functions y, según el proyecto, Storage pueden requerir activar facturación (plan Blaze). Configura las alertas y presupuestos.
3. Copia la configuración Web pública (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) en `portal-estudiante/firebase-config.js`. **No coloques claves de cuentas de servicio en este archivo.**
4. En **Authentication → Settings → Authorized domains** añade los dominios desde los que se abrirá el portal, incluido GitHub Pages si se utiliza.
5. Instala Node.js compatible y Firebase CLI (`npm install -g firebase-tools`), inicia sesión con `firebase login`.
6. Desde la carpeta `firebase/`: `firebase use --add` para seleccionar el proyecto, `cd functions && npm install && cd ..`, y luego `firebase deploy --only firestore:rules,storage,functions`. Para alojar el portal independiente en Firebase Hosting, desde `firebase/` ejecuta `firebase deploy --only hosting`.
7. Si se aloja el portal en GitHub Pages en vez de Firebase Hosting, conserva las rutas relativas `portal-estudiante/index.html` y `portal-estudiante/docente.html`; los QR deben apuntar a la dirección pública real del portal docente.

## 2. Alta inicial del docente

1. Crea manualmente la cuenta docente con correo y contraseña en Firebase Authentication. Si deseas, usa **Estoico** como contraseña inicial, **cámbiala antes de usar datos reales**. No se incorpora como contraseña fija en JavaScript ni en reglas.
2. Obtén el UID de la cuenta docente.
3. Asigna el rol `teacher` con Admin SDK desde un equipo administrativo de confianza, usando `firebase/functions/grant-teacher.js` y credenciales de servicio administradas de forma segura: `node grant-teacher.js unijjar-portal-academico UID`. **Nunca subas credenciales privadas al repositorio**.
4. Cierra y vuelve a iniciar sesión para actualizar los permisos.

## 3. Estudiantes

1. Crea una cuenta Authentication Email/Password por estudiante; entrega sus credenciales de forma privada.
2. En `portal-estudiante/docente.html`, inicia sesión como docente y vincula UID, carnet, nombre y grupo (`scope`). El `scope` debe coincidir exactamente con el de las sesiones; formato recomendado `Carrera|Grupo|Año|Período|Número|Asignatura`.
3. El estudiante inicia sesión en `portal-estudiante/index.html` y consulta **únicamente su historial**. Introducir un carnet ajeno no concede acceso.

## 4. Sesiones y QR

1. Desde el panel docente, crea la sesión con fecha **de hoy en Managua**, hora, duración, tolerancia y grupo.
2. Comparte el QR generado; abre la URL `portal-estudiante/index.html?session=ID`. La cuenta autenticada determina el carnet.
3. El servidor valida fecha local de Managua, horario, pertenencia al grupo y duplicados. Una vez vencida la duración, rechaza nuevos registros aunque el QR siga visible.
4. Al concluir, usa **Finalizar sesión y registrar ausencias**: crea los registros de ausentes y cierra la sesión. Hasta entonces, las ausencias no aparecerán en el historial.

## 5. Justificaciones y restricciones

- **Estudiante:** puede solicitar justificación de una ausencia y subir una imagen JPG/PNG/WebP de hasta 5 MB. La solicitud queda pendiente y su evidencia es privada. Solo el docente autorizado puede aprobar o rechazar; cada decisión queda auditada.
- **Institución / docente:** el docente puede justificar una ausencia con motivo obligatorio. El sistema guarda auditoría con usuario, fecha y causa. El panel no permite que un estudiante borre o edite asistencias.
- **Contraseña Estoico:** es una **contraseña inicial de la cuenta docente**, no una llave que pueda validarse de forma segura en HTML estático. Las reglas del servidor dependen del rol `teacher` asignado administrativamente.

## 6. Consideraciones antes de producción

- El módulo antiguo `asistencia/index.html` utiliza `localStorage`; el módulo Firebase **no importa ni replica automáticamente** los registros anteriores. Si se necesita unificación, habrá que diseñar y validar una migración administrativa.
- Revisa privacidad, consentimiento, conservación y eliminación de fotografías justificativas y derechos de acceso. No publiques fotografías ni historiales en GitHub.
- El QR no demuestra presencia física: un enlace puede compartirse. Para reducir suplantación puedes añadir comprobación de presencia supervisada, códigos rotativos o validación presencial.
- Las cuentas estudiantiles deben ser personales; evita usar el carnet como contraseña.
- Revisa la configuración de zona horaria y el horario real de cada clase. La aplicación valida hora del servidor en `America/Managua`.
- Antes de uso institucional, prueba desde al menos dos dispositivos reales y verifica permisos, registros simultáneos, justificaciones y accesos no autorizados.

## 7. Regla académica y enlace con Control de Notas

La función protegida `getExamEligibility({studentUid,scope})` permite que el futuro Control de Notas consulte el porcentaje del estudiante **sin duplicar datos**. Solo cuenta sesiones finalizadas del grupo. `Presente`, `Tarde` y `Justificado` aprobado cuentan como asistencia; `Ausente` y solicitudes pendientes no cuentan. El mínimo es 70 %. Un estudiante solo puede consultar su propio resultado; un docente con rol autorizado puede consultar el de sus estudiantes. La función devuelve `total`, `valid`, `percentage`, `minimum` y `eligible`.

**Importante:** el módulo de notas todavía no se ha creado. Esta función es la interfaz preparada para enlazarlo después. La pantalla del estudiante muestra el derecho a examen como referencia; el cálculo autoritativo para notas debe utilizar `getExamEligibility`.


## Actualización de noviembre de 2026 — puesta en marcha segura

**El ZIP no despliega Firebase automáticamente.** GitHub Pages solo publica HTML/JS.

1. Instala Node.js 22, Firebase CLI (`npm install -g firebase-tools`) y Google Cloud CLI (`gcloud`).
2. En terminal: `firebase login` y `gcloud auth application-default login` (con una cuenta autorizada para administrar Firebase Authentication). **No descargues ni subas archivos JSON de cuentas de servicio al repositorio.**
3. En la carpeta `firebase/functions`: `npm install`. Luego: `node grant-teacher.js unijjar-portal-academico 1joQiJlWSDOhNX5bFVYD66b7iF72`. Esto asigna el rol al usuario existente; requiere los permisos IAM correspondientes. Cierra y vuelve a iniciar sesión en el portal.
4. En la carpeta `firebase`: `firebase use --add` (selecciona `unijjar-portal-academico`), después `firebase deploy --only firestore:rules,storage,functions`. **Cloud Functions y posiblemente Cloud Storage pueden requerir plan Blaze y facturación**. Comprueba costes antes de activar.
5. GitHub Pages sigue en `https://savvysequeir.github.io/plan-de-clases/`. El portal docente se abre en `/portal-estudiante/docente.html` y el del estudiante en `/portal-estudiante/index.html`.
6. Para más de 300 estudiantes, `finalizeSession` ahora bloquea el registro antes de procesar ausencias y las crea en lotes de 200. Si se interrumpe, el docente puede reintentar; los registros existentes no se sobrescriben.
7. **Importante:** la matriz de `asistencia/index.html` sigue siendo local y no se sincroniza automáticamente con Firestore. Usa el portal Firebase para los registros oficiales mientras se diseña la migración.
8. Prueba con cuentas de docente y estudiante de ensayo antes de usar datos reales. Revisa reglas de acceso, evidencia y cuotas.

### Comportamiento de las sesiones
El servidor cierra la admisión antes de crear ausencias, impidiendo registros simultáneos durante el cierre. Una sesión en estado `closing` puede reintentarse desde el mismo panel docente. La elegibilidad para examen se calcula únicamente sobre sesiones `closed`.
