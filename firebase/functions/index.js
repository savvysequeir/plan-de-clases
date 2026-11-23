'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');
admin.initializeApp();
const db=admin.firestore();
const zone='America/Managua';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time=()=>new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
const required=(v,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new HttpsError('invalid-argument','Dato obligatorio o demasiado largo');return v.trim()};
function mustAuth(r){if(!r.auth)throw new HttpsError('unauthenticated','Inicia sesión');return r.auth.uid}
function mustTeacher(r){const uid=mustAuth(r);if(r.auth.token.teacher!==true)throw new HttpsError('permission-denied','Se requiere acceso docente');return uid}
const fn=handler=>onCall({region:'us-central1',enforceAppCheck:false},handler);
exports.createSession=fn(async r=>{const uid=mustTeacher(r),v=r.data||{};const scope=required(v.scope),title=required(v.title),date=required(v.date,10),start=required(v.start,5),duration=Number(v.duration),tolerance=Number(v.tolerance);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d\d:\d\d$/.test(start)||duration<1||duration>480||tolerance<0||tolerance>120||!Number.isInteger(duration)||!Number.isInteger(tolerance))throw new HttpsError('invalid-argument','Datos de sesión incorrectos');if(date!==today())throw new HttpsError('failed-precondition','Solo se permite iniciar sesiones para la fecha actual');const ref=db.collection('sessions').doc();await ref.set({scope,title,date,start,duration,tolerance,status:'open',teacherUid:uid,createdAt:admin.firestore.FieldValue.serverTimestamp()});return {id:ref.id}});
exports.enrollStudent=fn(async r=>{mustTeacher(r);const {uid,carnet,name,scope}=r.data||{};const id=required(uid,128),c=required(carnet,40),n=required(name),s=required(scope);await admin.auth().getUser(id);const duplicates=await db.collection('students').where('carnet','==',c).limit(2).get();if(duplicates.docs.some(x=>x.id!==id))throw new HttpsError('already-exists','Carnet ya vinculado');await db.collection('students').doc(id).set({carnet:c,name:n,scope:s,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});return {ok:true}});
exports.registerAttendance=fn(async r=>{
 const uid=mustAuth(r),sessionId=required(r.data?.sessionId,128);
 const sref=db.collection('sessions').doc(sessionId),studentRef=db.collection('students').doc(uid);
 const ref=db.collection('attendance').doc(sessionId+'_'+uid);
 return db.runTransaction(async tx=>{
  const [ss,st,existing]=await Promise.all([tx.get(sref),tx.get(studentRef),tx.get(ref)]);
  if(!ss.exists||!st.exists)throw new HttpsError('not-found','Sesión o estudiante inexistente');
  const s=ss.data(),student=st.data();
  if(s.scope!==student.scope)throw new HttpsError('permission-denied','El grupo no corresponde');
  if(s.status!=='open'||s.date!==today())throw new HttpsError('failed-precondition','La sesión no está abierta hoy');
  const now=time(),toMin=x=>{const [h,m]=x.split(':').map(Number);return h*60+m};
  const mins=toMin(now)-toMin(s.start);
  if(mins<0||mins>Number(s.duration))throw new HttpsError('failed-precondition','Fuera del horario de registro');
  if(existing.exists)throw new HttpsError('already-exists','Ya registraste asistencia');
  const status=mins>Number(s.tolerance)?'Tarde':'Presente';
  tx.create(ref,{sessionId,studentUid:uid,carnet:student.carnet,studentName:student.name,scope:s.scope,date:s.date,title:s.title,status,time:now,createdAt:admin.firestore.FieldValue.serverTimestamp()});
  return {status,time:now};
 });
});
exports.submitJustification=fn(async r=>{const uid=mustAuth(r),v=r.data||{},attendanceId=required(v.attendanceId,250),cause=required(v.cause,30),reason=required(v.reason,1000),path=required(v.path,300);if(!['estudiante','institucion','docente'].includes(cause)||!path.startsWith('evidence/'+uid+'/'))throw new HttpsError('invalid-argument','Causa o archivo incorrecto');const a=await db.collection('attendance').doc(attendanceId).get();if(!a.exists||a.data().studentUid!==uid||a.data().status!=='Ausente')throw new HttpsError('failed-precondition','No existe una ausencia justificable');const [file]=await admin.storage().bucket().file(path).getMetadata().catch(()=>[null]);if(!file||!file.contentType?.startsWith('image/'))throw new HttpsError('failed-precondition','No se encontró evidencia válida');const previous=await db.collection('justifications').where('attendanceId','==',attendanceId).where('studentUid','==',uid).limit(5).get();if(previous.docs.some(d=>d.data().status==='pending'))throw new HttpsError('already-exists','Ya existe una solicitud pendiente');const ref=db.collection('justifications').doc();await ref.set({studentUid:uid,attendanceId,cause,reason,path,status:'pending',studentName:a.data().studentName,carnet:a.data().carnet,date:a.data().date,createdAt:admin.firestore.FieldValue.serverTimestamp()});return {id:ref.id}});
exports.listJustifications=fn(async r=>{mustTeacher(r);const docs=await db.collection('justifications').where('status','==','pending').limit(100).get();return {items:docs.docs.map(x=>({id:x.id,...x.data(),createdAt:null}))}});
exports.getEvidenceUrl=fn(async r=>{const uid=mustTeacher(r),id=required(r.data?.requestId,128),docSnap=await db.collection('justifications').doc(id).get();if(!docSnap.exists)throw new HttpsError('not-found','Solicitud inexistente');const [url]=await admin.storage().bucket().file(docSnap.data().path).getSignedUrl({action:'read',expires:Date.now()+5*60*1000});return {url}});
exports.reviewJustification=fn(async r=>{const uid=mustTeacher(r),v=r.data||{},id=required(v.requestId,128),reason=required(v.reason,1000),approve=v.approve===true,ref=db.collection('justifications').doc(id),audit=db.collection('audit').doc();await db.runTransaction(async tx=>{const j=await tx.get(ref);if(!j.exists||j.data().status!=='pending')throw new HttpsError('failed-precondition','Solicitud ya procesada');const aRef=db.collection('attendance').doc(j.data().attendanceId),a=await tx.get(aRef);if(!a.exists)throw new HttpsError('not-found','Registro no encontrado');tx.update(ref,{status:approve?'approved':'rejected',reviewedBy:uid,reviewReason:reason,reviewedAt:admin.firestore.FieldValue.serverTimestamp()});if(approve)tx.update(aRef,{status:'Justificado',previousStatus:a.data().status,justificationId:id,correctedBy:uid});tx.create(audit,{type:'justification_review',requestId:id,attendanceId:aRef.id,approve,reason,teacherUid:uid,previousStatus:a.data().status,at:admin.firestore.FieldValue.serverTimestamp()})});return {ok:true}});
// Cierra la admisión antes de materializar ausencias. Procesa grupos grandes en lotes
// de hasta 400 escrituras y permite reintentar si falla un lote intermedio.
exports.finalizeSession=fn(async r=>{
 const uid=mustTeacher(r),id=required(r.data?.sessionId,128),ref=db.collection('sessions').doc(id);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists||snap.data().teacherUid!==uid)throw new HttpsError('permission-denied','Sesión no autorizada');
  if(snap.data().status==='closed')return;
  if(!['open','closing'].includes(snap.data().status))throw new HttpsError('failed-precondition','Estado de sesión no válido');
  if(snap.data().status==='open')tx.update(ref,{status:'closing',closingAt:admin.firestore.FieldValue.serverTimestamp()});
 });
 const session=await ref.get();
 if(session.data().status==='closed')return {ok:true,alreadyClosed:true};
 const s=session.data();
 const students=await db.collection('students').where('scope','==',s.scope).get();
 // Las escrituras create() son intencionales: no sobreescriben asistencias registradas.
 // Al reintentar se omiten documentos existentes. Se cierra solamente al completar todo.
 let created=0;
 for(let i=0;i<students.docs.length;i+=200){
  const chunk=students.docs.slice(i,i+200);
  const refs=chunk.map(d=>db.collection('attendance').doc(id+'_'+d.id));
  const existing=await db.getAll(...refs);
  const batch=db.batch();let pending=0;
  for(let j=0;j<chunk.length;j++){
   if(existing[j].exists)continue;
   const d=chunk[j];
   batch.create(refs[j],{sessionId:id,studentUid:d.id,carnet:d.data().carnet,studentName:d.data().name,scope:s.scope,date:s.date,title:s.title,status:'Ausente',time:null,createdAt:admin.firestore.FieldValue.serverTimestamp()});
   pending++;
  }
  if(pending){await batch.commit();created+=pending;}
 }
 await ref.update({status:'closed',closedAt:admin.firestore.FieldValue.serverTimestamp()});
 return {ok:true,created,totalStudents:students.size};
});

exports.correctAttendance=fn(async r=>{const uid=mustTeacher(r),v=r.data||{},id=required(v.attendanceId,250),reason=required(v.reason,1000),cause=required(v.cause,30);if(!['institucion','docente','estudiante'].includes(cause))throw new HttpsError('invalid-argument','Causa incorrecta');if(cause==='estudiante')throw new HttpsError('failed-precondition','Las causas del estudiante requieren evidencia y solicitud aprobada');const ref=db.collection('attendance').doc(id),audit=db.collection('audit').doc();await db.runTransaction(async tx=>{const d=await tx.get(ref);if(!d.exists||d.data().status!=='Ausente')throw new HttpsError('failed-precondition','No existe ausencia para corregir');tx.update(ref,{status:'Justificado',previousStatus:'Ausente',correctedBy:uid,correctionCause:cause,correctionReason:reason});tx.create(audit,{type:'manual_correction',attendanceId:id,teacherUid:uid,cause,reason,previousStatus:'Ausente',newStatus:'Justificado',at:admin.firestore.FieldValue.serverTimestamp()})});return {ok:true}});
exports.listMyJustifications=fn(async r=>{const uid=mustAuth(r);const docs=await db.collection('justifications').where('studentUid','==',uid).limit(100).get();return {items:docs.docs.map(x=>({id:x.id,date:x.data().date,cause:x.data().cause,reason:x.data().reason,status:x.data().status,attendanceId:x.data().attendanceId}))}});
exports.myEvidenceUrl=fn(async r=>{const uid=mustAuth(r),id=required(r.data?.requestId,128),snap=await db.collection('justifications').doc(id).get();if(!snap.exists||snap.data().studentUid!==uid)throw new HttpsError('permission-denied','Evidencia no autorizada');const [url]=await admin.storage().bucket().file(snap.data().path).getSignedUrl({action:'read',expires:Date.now()+5*60*1000});return {url}});

// Contrato compartido con el futuro Control de Notas.
// Solo contabiliza sesiones finalizadas, por lo que el resultado no depende de clases en curso.
// Una ausencia justificada aprobada cuenta igual que una presencia; la pendiente no cuenta.
exports.getExamEligibility=fn(async r=>{
 const caller=mustAuth(r),studentUid=required(r.data?.studentUid||caller,128),scope=required(r.data?.scope,200);
 if(studentUid!==caller)mustTeacher(r);
 const st=await db.collection('students').doc(studentUid).get();
 if(!st.exists||st.data().scope!==scope)throw new HttpsError('permission-denied','Estudiante no vinculado a este grupo');
 const sessions=await db.collection('sessions').where('scope','==',scope).where('status','==','closed').get();
 if(sessions.size>400)throw new HttpsError('resource-exhausted','Consulta demasiado extensa; segmenta el período académico');
 const records=await Promise.all(sessions.docs.map(d=>db.collection('attendance').doc(d.id+'_'+studentUid).get()));
 const accepted=['Presente','Tarde','Justificado'];
 const valid=records.filter(d=>d.exists&&accepted.includes(d.data().status)).length;
 const total=sessions.size,percentage=total?Math.round(valid/total*10000)/100:0;
 return {studentUid,scope,total,valid,percentage,minimum:70,eligible:total>0&&percentage>=70,
  policy:'Presente, Tarde y Justificado aprobado cuentan; Ausente y pendiente no cuentan'};
});
