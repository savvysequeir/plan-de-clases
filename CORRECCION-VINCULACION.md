# Actualización de vinculación
Subir el contenido completo a GitHub Pages. Las reglas Firestore incluidas no se modificaron: corresponden a las reglas enviadas por el docente. No abrir permisos públicos.
Probar en el navegador donde existe la matrícula local. El estudiante debe usar otra sesión/perfil. Si ya existe una solicitud, se muestra su estado sin sobrescribirla. Si fue rechazada o contiene un carnet incorrecto, el docente puede revisar y eliminar exclusivamente esa solicitud en Firestore antes de un nuevo intento.
El acceso docente por Google requiere que el UID coincida con el autorizado o tenga el atributo teacher. No elimina bloqueos de Firebase ni garantiza que una cuenta Google distinta tenga permisos.
Si falla la vinculación, anotar si el mensaje indica verificar cuenta, consultar solicitud o crear solicitud. No repetir solicitudes de verificación durante una restricción temporal.
Pruebas realizadas: sintaxis JavaScript y ZIP; no se probó contra Firebase real.
