import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (process.env.RUN_FIREBASE_INTEGRATION !== "1") throw new Error("Defina RUN_FIREBASE_INTEGRATION=1 para executar este teste no Firebase configurado.");
const serviceAccount = JSON.parse(await readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
initializeApp({ credential: cert(serviceAccount), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const adminAuth = getAuth();
const db = getFirestore();
const suffix = randomUUID();
const title = `Teste temporario ${suffix}`;
const studentUid = `learning-test-${suffix}`;
let studentCreated = false;
let courseId = "";

async function tokenFor(uid) {
  const token = await adminAuth.createCustomToken(uid);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, returnSecureToken: true }) });
  if (!response.ok) throw new Error(`Não foi possível autenticar o teste: ${response.status}`);
  return (await response.json()).idToken;
}

async function call(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`http://127.0.0.1:3000${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}

try {
  const owner = await adminAuth.getUserByEmail("kaykedeveliz@gmail.com");
  const teacherToken = await tokenFor(owner.uid);
  await adminAuth.createUser({ uid: studentUid });
  studentCreated = true;
  const studentToken = await tokenFor(studentUid);
  assert.equal((await call("/api/teacher?courseId=invalid")).status, 401);
  assert.equal((await call("/api/teacher?courseId=invalid", { token: studentToken })).status, 403);

  const course = { title, description: "Curso temporário para validação", level: "A1", imageUrl: "", videoUrl: "", materialUrl: "", published: false };
  assert.equal((await call("/api/admin?resource=courses", { method: "POST", token: teacherToken, body: { course } })).status, 200);
  const courseSnapshot = await db.collection("courses").where("title", "==", title).get();
  assert.equal(courseSnapshot.size, 1);
  courseId = courseSnapshot.docs[0].id;
  const lessonModule = { courseId, title: "Primeiro módulo", content: "Introdução", videoUrl: "", materialUrl: "", position: 1, questions: [{ prompt: "I ___ happy.", options: ["am", "is"], correctIndex: 0, explanation: "Use am com I." }] };
  const created = await call("/api/teacher", { method: "POST", token: teacherToken, body: { module: lessonModule } });
  assert.equal(created.status, 200);
  const moduleId = created.data.id;
  assert.equal((await call(`/api/learning?courseId=${courseId}`)).status, 404);
  assert.equal((await call("/api/admin?resource=courses", { method: "POST", token: teacherToken, body: { id: courseId, course: { ...course, published: true } } })).status, 200);
  const published = await call(`/api/learning?courseId=${courseId}`);
  assert.equal(published.status, 200);
  assert.equal(published.data.modules.length, 1);
  assert.deepEqual(published.data.modules[0].blocks.map((block) => block.type), ["text", "question"]);
  assert.equal("correctIndex" in published.data.modules[0].questions[0], false);
  assert.equal("explanation" in published.data.modules[0].questions[0], false);
  const revision = published.data.modules[0].revision;
  assert.equal((await call("/api/learning", { method: "POST", body: { courseId, moduleId, revision, answers: [0] } })).status, 401);
  assert.equal((await call("/api/learning", { method: "POST", token: studentToken, body: { courseId, moduleId, revision, answers: [] } })).status, 400);
  const result = await call("/api/learning", { method: "POST", token: studentToken, body: { courseId, moduleId, revision, answers: [1] } });
  assert.equal(result.status, 200);
  assert.equal(result.data.result.score, 0);
  assert.equal(result.data.result.feedback[0].correctIndex, 0);
  assert.equal(result.data.result.feedback[0].explanation, "Use am com I.");
  const history = await call(`/api/learning?courseId=${courseId}&history=1`, { token: studentToken });
  assert.equal(history.status, 200);
  assert.equal(history.data.attempts.length, 1);
  assert.equal(history.data.attempts[0].score, 0);
  const ownerHistory = await call(`/api/learning?courseId=${courseId}&history=1`, { token: teacherToken });
  assert.equal(ownerHistory.data.attempts.length, 0);
  const results = await call("/api/admin?resource=results", { token: teacherToken });
  assert.equal(results.status, 200);
  assert.ok(results.data.results.some((item) => item.courseTitle === title));
  assert.equal((await call("/api/teacher", { method: "POST", token: teacherToken, body: { id: moduleId, module: { ...lessonModule, title: "Módulo atualizado" } } })).status, 200);
  assert.equal((await call("/api/learning", { method: "POST", token: studentToken, body: { courseId, moduleId, revision, answers: [0] } })).status, 409);
  const blocks = [
    { id: "image1", type: "image", url: "https://example.com/image.jpg", alt: "Uma imagem" },
    { id: "question1", type: "question", question: lessonModule.questions[0] },
    { id: "video1", type: "video", url: "https://www.youtube.com/watch?v=abcdefghijk" },
    { id: "question2", type: "question", question: { prompt: "She ___ happy.", options: ["is", "am"], correctIndex: 0, explanation: "Use is com she." } },
  ];
  assert.equal((await call("/api/teacher", { method: "POST", token: teacherToken, body: { id: moduleId, module: { ...lessonModule, blocks } } })).status, 200);
  const ordered = await call(`/api/learning?courseId=${courseId}`);
  assert.deepEqual(ordered.data.modules[0].blocks.map((block) => block.type), ["image", "question", "video", "question"]);
  assert.equal("correctIndex" in ordered.data.modules[0].blocks[1].question, false);
  const reorderedBlocks = [blocks[2], blocks[3], blocks[0], blocks[1]];
  assert.equal((await call("/api/teacher", { method: "POST", token: teacherToken, body: { id: moduleId, module: { ...lessonModule, blocks: reorderedBlocks } } })).status, 200);
  const saved = await call(`/api/teacher?courseId=${courseId}`, { token: teacherToken });
  assert.deepEqual(saved.data.modules[0].blocks.map((block) => block.id), ["video1", "question2", "image1", "question1"]);
  assert.equal(saved.data.modules[0].blocks[3].question.explanation, "Use am com I.");
  const reordered = await call(`/api/learning?courseId=${courseId}`);
  assert.deepEqual(reordered.data.modules[0].blocks.map((block) => block.type), ["video", "question", "image", "question"]);
  const orderedResult = await call("/api/learning", { method: "POST", token: studentToken, body: { courseId, moduleId, revision: reordered.data.modules[0].revision, answers: [1, 0] } });
  assert.equal(orderedResult.status, 200);
  assert.equal(orderedResult.data.result.score, 50);
  assert.equal(orderedResult.data.result.feedback[1].correct, true);
  assert.equal((await call("/api/teacher", { method: "DELETE", token: teacherToken, body: { id: moduleId, courseId } })).status, 200);
  const second = await call("/api/teacher", { method: "POST", token: teacherToken, body: { module: { ...lessonModule, title: "Módulo para exclusão", questions: [] } } });
  assert.equal(second.status, 200);
  assert.equal((await call("/api/admin?resource=courses", { method: "DELETE", token: teacherToken, body: { id: courseId } })).status, 200);
  assert.equal((await db.collection("courseModules").doc(second.data.id).get()).exists, false);
  assert.equal((await db.collection("quizAttempts").where("uid", "==", studentUid).get()).size, 2);
  console.log("Rascunhos, blocos ordenados, correção, histórico, resultados e permissões: OK");
} finally {
  const courses = await db.collection("courses").where("title", "==", title).get();
  const modules = courseId ? await db.collection("courseModules").where("courseId", "==", courseId).get() : null;
  const attempts = await db.collection("quizAttempts").where("uid", "==", studentUid).get();
  const batch = db.batch();
  modules?.docs.forEach((doc) => batch.delete(doc.ref));
  attempts.docs.forEach((doc) => batch.delete(doc.ref));
  courses.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  if (studentCreated) await adminAuth.deleteUser(studentUid);
}