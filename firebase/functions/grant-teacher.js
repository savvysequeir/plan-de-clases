// Ejecutar SOLO en entorno administrativo confiable, nunca desde el navegador.
// GOOGLE_APPLICATION_CREDENTIALS=/ruta/servicio.json node grant-teacher.js UID
const admin=require('firebase-admin');admin.initializeApp();
const uid=process.argv[2];if(!uid)throw Error('Indica el UID del docente');
admin.auth().setCustomUserClaims(uid,{teacher:true}).then(()=>{console.log('Rol docente asignado a',uid);process.exit(0)}).catch(e=>{console.error(e);process.exit(1)});
