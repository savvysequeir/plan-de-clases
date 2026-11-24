# Activación de asistencia
1. Publicar el contenido del ZIP en GitHub Pages (HTTPS).
2. En Firebase Authentication habilitar correo/contraseña y comprobar que el UID docente coincide con el autorizado en firestore.rules o tiene claim teacher=true.
3. En Cloud Shell, desde la carpeta firebase del ZIP, ejecutar `npx firebase-tools deploy --only firestore:rules --project unijjar-portal-academico` (requiere acceso autorizado). Revisar reglas existentes antes de sustituirlas.
4. Crear cuentas estudiantiles en Authentication y vincular UID, carnet y scope exacto desde Docente · QR en línea.
5. En Asistencia seleccionar grupo, crear fecha, iniciar sesión, escanear carnet o introducirlo manualmente. Para QR en línea conectar docente y sincronizar grupo; abrir enlace QR. El estudiante abre el enlace con la cámara del teléfono e inicia sesión.
6. Finalizar en portal docente para registrar ausencias; actualizar matriz desde Firebase.
No se necesita Blaze para registros escritos. Las fotografías siguen deshabilitadas. El lector QR requiere Internet para cargar la biblioteca CDN. No se han desplegado reglas ni probado cámara o cuentas reales.
