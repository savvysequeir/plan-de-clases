'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const crypto=require('node:crypto');
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
exports.submitJustification=fn(async r=>{const uid=mustAuth(r),v=r.data||{},attendanceId=required(v.attendanceId,250),cause=required(v.cause,30),reason=required(v.reason,1000),path=required(v.path,300);if(cause!=='estudiante'||!/^evidence\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(path)||!path.startsWith('evidence/'+uid+'/'))throw new HttpsError('invalid-argument','Causa o archivo incorrecto');const a=await db.collection('attendance').doc(attendanceId).get();if(!a.exists||a.data().studentUid!==uid||a.data().status!=='Ausente')throw new HttpsError('failed-precondition','No existe una ausencia justificable');const [file]=await admin.storage().bucket().file(path).getMetadata().catch(()=>[null]);if(!file||!['image/jpeg','image/png','image/webp'].includes(file.contentType)||Number(file.size)>5*1024*1024)throw new HttpsError('failed-precondition','No se encontró evidencia válida');const previous=await db.collection('justifications').where('attendanceId','==',attendanceId).where('studentUid','==',uid).limit(5).get();if(previous.docs.some(d=>d.data().status==='pending'))throw new HttpsError('already-exists','Ya existe una solicitud pendiente');const ref=db.collection('justifications').doc();await ref.set({studentUid:uid,attendanceId,cause,reason,path,status:'pending',studentName:a.data().studentName,carnet:a.data().carnet,date:a.data().date,createdAt:admin.firestore.FieldValue.serverTimestamp()});return {id:ref.id}});
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

// Puente aditivo: importa sesiones de la matriz local sin sobrescribir registros remotos.
// Los estudiantes deben estar previamente vinculados con un UID de Authentication.
const legacyId=(scope,localId)=>'legacy_'+crypto.createHash('sha256').update(scope+'\0'+localId).digest('hex').slice(0,40);
exports.syncLegacyAttendance=fn(async r=>{
 const uid=mustTeacher(r),v=r.data||{},scope=required(v.scope,200);
 if(!Array.isArray(v.sessions)||v.sessions.length>35)throw new HttpsError('invalid-argument','Máximo 35 sesiones por sincronización');
 const students=await db.collection('students').where('scope','==',scope).get();
 const byCarnet=new Map(students.docs.map(d=>[d.data().carnet,d]));
 let createdSessions=0,createdRecords=0,skipped=0;
 const mapping=[];
 for(const raw of v.sessions){
  const localId=required(raw.id,100),date=required(raw.date,10),title=required(raw.title,200);
  const start=required(raw.start,5),duration=Number(raw.duration),tolerance=Number(raw.tolerance);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!Number.isInteger(duration)||duration<1||duration>480||!Number.isInteger(tolerance)||tolerance<0||tolerance>120)
   throw new HttpsError('invalid-argument','Fecha u horario incorrecto');
  const id=legacyId(scope,localId),sref=db.collection('sessions').doc(id);
  const active=raw.active===true && date===today();
  const session=await sref.get();
  if(!session.exists){
   await sref.create({scope,title,date,start,duration,tolerance,status:active?'open':'closed',teacherUid:uid,legacyKey:localId,createdAt:admin.firestore.FieldValue.serverTimestamp()});createdSessions++;
  }else if(session.data().teacherUid!==uid||session.data().scope!==scope){throw new HttpsError('permission-denied','Sesión perteneciente a otro docente o grupo')}
  else if(session.data().status==='open'&&!active){
   // Cierre definitivo, con ausencias para alumnos ya vinculados.
   await sref.update({status:'closing'});
  }
  const current=(await sref.get()).data();
  const records=raw.records&&typeof raw.records==='object'?raw.records:{};
  const batch=db.batch();let pending=0;
  for(const student of students.docs){
   const carnet=student.data().carnet,record=records[carnet],status=record?.status||'Ausente';
   if(!['Presente','Tarde','Justificado','Ausente'].includes(status))continue;
   if(current.status==='open'&&!record)continue;
   const ref=db.collection('attendance').doc(id+'_'+student.id),existing=await ref.get();
   if(existing.exists){skipped++;continue}
   batch.create(ref,{sessionId:id,studentUid:student.id,carnet,studentName:student.data().name,scope,date,title,status,time:typeof record?.time==='string'?record.time:null,createdAt:admin.firestore.FieldValue.serverTimestamp(),source:'legacy-import'});
   pending++;
  }
  if(pending){await batch.commit();createdRecords+=pending}
  if(current.status==='closing')await sref.update({status:'closed',closedAt:admin.firestore.FieldValue.serverTimestamp()});
  mapping.push({localId,cloudId:id});
 }
 return {createdSessions,createdRecords,skipped,linkedStudents:students.size,localStudents:Number(v.localStudentCount)||0,mapping};
});
exports.getLegacyAttendance=fn(async r=>{
 const uid=mustTeacher(r),scope=required(r.data?.scope,200);
 const sessions=await db.collection('sessions').where('scope','==',scope).get();
 const mine=sessions.docs.filter(x=>x.data().teacherUid===uid&&x.data().legacyKey);
 const result=[];
 for(const s of mine.slice(0,150)){
  const docs=await db.collection('attendance').where('sessionId','==',s.id).get();
  result.push({localId:s.data().legacyKey,cloudId:s.id,status:s.data().status,date:s.data().date,records:docs.docs.map(d=>({carnet:d.data().carnet,status:d.data().status,time:d.data().time}))});
 }
 return {sessions:result};
});

// Publicación de notas por docente. El cliente nunca escribe directamente a Firestore.
exports.publishGrades=fn(async r=>{
 const uid=mustTeacher(r),v=r.data||{},scope=required(v.scope,200),students=v.students;
 if(!Array.isArray(students)||students.length<1||students.length>40)throw new HttpsError('invalid-argument','Lote inválido (1 a 40 estudiantes)');
 const general=v.general||{},dates=v.dates||{};
 if(['carrera','grupo','anio','periodo','numeroPeriodo','asignatura'].some(k=>typeof general[k]!=='string')||[general.carrera,general.grupo,general.anio,general.periodo,general.numeroPeriodo,general.asignatura].join('|')!==scope)throw new HttpsError('invalid-argument','El grupo no coincide con los datos generales');
 const maxima={P1:10,P2:10,P3:10,P4:10,P5:5,P6:5,Ex:50};
 const normalized=[];const seen=new Set();
 for(const st of students){const carnet=required(st.carnet,40);if(seen.has(carnet))throw new HttpsError('invalid-argument','Carnet duplicado');seen.add(carnet);const grades=st.grades||{},clean={};for(const [k,x] of Object.entries(grades)){const match=/^p([123])_(P[1-6]|Ex)$/.exec(k);if(!match)throw new HttpsError('invalid-argument','Actividad desconocida');if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>maxima[match[2]])throw new HttpsError('invalid-argument','Nota fuera de rango');clean[k]=x}normalized.push({carnet,grades:clean})}
 const cleanDates={};for(const [k,value] of Object.entries(dates)){if(!/^p[123]_(P[1-6]|Ex)$/.test(k)||typeof value!=='string'||(value!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(value)))throw new HttpsError('invalid-argument','Fecha incorrecta');cleanDates[k]=value}
 let published=0,unlinked=0;const batch=db.batch();
 for(const st of normalized){const match=await db.collection('students').where('carnet','==',st.carnet).limit(2).get();const eligible=match.docs.filter(d=>d.data().scope===scope);if(eligible.length!==1){unlinked++;continue}const student=eligible[0];const ref=db.collection('grades').doc(student.id+'_'+crypto.createHash('sha256').update(scope).digest('hex').slice(0,20));batch.set(ref,{studentUid:student.id,carnet:st.carnet,scope,general:{carrera:general.carrera,grupo:general.grupo,anio:general.anio,periodo:general.periodo,numeroPeriodo:general.numeroPeriodo,asignatura:general.asignatura,modalidad:String(general.modalidad||'')},grades:st.grades,dates:cleanDates,publishedBy:uid,publishedAt:admin.firestore.FieldValue.serverTimestamp()});published++}
 if(published)await batch.commit();return {published,unlinked}
});
