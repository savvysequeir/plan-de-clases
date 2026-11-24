# Control de Notas · UNIJJAR

Nueva página: `control-notas/index.html`. El resto de módulos se mantiene.

## Uso
1. Abre `asistencia/index.html` y `control-notas/index.html` desde el mismo dominio y navegador. Selecciona idénticos datos generales.
2. En Notas, pulsa **Importar estudiantes desde Asistencia**. Solo añade carnets nuevos, no borra notas existentes.
3. Introduce calificaciones (P1–P4: 10; P5–P6: 5; examen: 50), fechas y guarda. Cada parcial suma 100 puntos.
4. Puedes buscar por carnet, exportar/importar respaldos JSON e imprimir en PDF mediante el diálogo del navegador.
5. Para publicar en Firebase, entra como docente autorizado en el apartado V y pulsa **Publicar notas**. Los alumnos deben estar vinculados en Firestore a su UID y carnet.
6. Despliega los archivos de GitHub Pages y, desde la carpeta `firebase`, las funciones y reglas de Firestore. Firebase Hosting sirve el portal estudiantil.

## Importante
- Los registros de notas son locales hasta pulsar **Publicar notas**; no se actualizan automáticamente entre equipos.
- La importación directa desde Asistencia usa `localStorage` y requiere **el mismo origen web**; si los módulos están en dominios distintos, usa un respaldo de Asistencia en su origen.
- El portal estudiantil solo muestra notas a usuarios autenticados vinculados por carnet, conforme a las reglas de Firestore.
- Las funciones de Firebase y las reglas actualizadas necesitan desplegarse; la inclusión en el ZIP no las publica.
- La foto de asistencia es una ilustración fotográfica generada, no una fotografía documental de la universidad.
