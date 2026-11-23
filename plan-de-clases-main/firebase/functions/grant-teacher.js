// Ejecutar solamente desde una computadora administrativa confiable con ADC.
// Requiere: gcloud auth application-default login (sin exportar llaves JSON).
// Uso: node grant-teacher.js PROJECT_ID UID
'use strict';
const admin=require('firebase-admin');
const [projectId,uid]=process.argv.slice(2);
if(!projectId||!uid||!/^[A-Za-z0-9_-]{10,128}$/.test(uid)){
 console.error('Uso: node grant-teacher.js PROJECT_ID UID');process.exit(1);
}
admin.initializeApp({credential:admin.credential.applicationDefault(),projectId});
(async()=>{
 const user=await admin.auth().getUser(uid);
 const claims={...(user.customClaims||{}),teacher:true};
 await admin.auth().setCustomUserClaims(uid,claims);
 console.log('Rol docente asignado al UID:',uid,'en proyecto:',projectId);
})().catch(e=>{console.error('Error al asignar rol:',e.message);process.exitCode=1;});
