import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { gradeQuestions, parseModule, publicModule, validDocumentId } from "@/lib/learning";

async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  try { return await adminAuth.verifyIdToken(token, true); } catch { return null; }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  if (!validDocumentId(courseId)) return Response.json({ error: "Curso inválido." }, { status: 400 });
  try {
    const course = await adminDb.collection("courses").doc(courseId).get();
    if (!course.exists || course.get("published") !== true) return Response.json({ error: "Curso não encontrado." }, { status: 404 });
    if (url.searchParams.get("history") === "1") {
      const user = await authenticatedUser(request);
      if (!user) return Response.json({ error: "Entre para ver suas avaliações." }, { status: 401 });
      const attempts = await adminDb.collection("quizAttempts").where("uid", "==", user.uid).limit(200).get();
      return Response.json({ attempts: attempts.docs.filter((doc) => doc.get("courseId") === courseId).map((doc) => ({ id: doc.id, moduleId: doc.get("moduleId"), moduleTitle: doc.get("moduleTitle"), score: doc.get("score"), correct: doc.get("correct"), total: doc.get("total"), createdAt: doc.get("createdAt")?.toMillis() ?? null })).sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0)) }, { headers: { "Cache-Control": "no-store" } });
    }
    const snapshot = await adminDb.collection("courseModules").where("courseId", "==", courseId).get();
    const modules = snapshot.docs.flatMap((doc) => { const data = parseModule(doc.data()); const updated = doc.get("updatedAt"); return data && updated ? [{ id: doc.id, revision: `${updated.seconds}.${updated.nanoseconds}`, ...publicModule(data) }] : []; }).sort((left, right) => left.position - right.position);
    return Response.json({ course: { id: course.id, title: course.get("title"), description: course.get("description"), level: course.get("level"), videoUrl: course.get("videoUrl") || "", materialUrl: course.get("materialUrl") || "" }, modules }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar curso:", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não foi possível carregar o curso." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return Response.json({ error: "Entre para enviar sua avaliação." }, { status: 401 });
  try {
    const body = await request.json();
    if (!validDocumentId(body.courseId) || !validDocumentId(body.moduleId)) return Response.json({ error: "Avaliação inválida." }, { status: 400 });
    const course = await adminDb.collection("courses").doc(body.courseId).get();
    if (!course.exists || course.get("published") !== true) return Response.json({ error: "Curso não encontrado." }, { status: 404 });
    const snapshot = await adminDb.collection("courseModules").doc(body.moduleId).get();
    const lessonModule = snapshot.exists ? parseModule(snapshot.data()) : null;
    if (!lessonModule || lessonModule.courseId !== body.courseId) return Response.json({ error: "Módulo não encontrado." }, { status: 404 });
    const updated = snapshot.get("updatedAt");
    if (!updated || body.revision !== `${updated.seconds}.${updated.nanoseconds}`) return Response.json({ error: "Esta avaliação foi atualizada. Recarregue a página para responder à versão atual." }, { status: 409 });
    const result = gradeQuestions(lessonModule.questions, body.answers);
    if (!result) return Response.json({ error: "Responda a todas as perguntas antes de enviar." }, { status: 400 });
    await adminDb.collection("quizAttempts").add({ uid: user.uid, email: user.email ?? "", courseId: body.courseId, courseTitle: course.get("title"), moduleId: body.moduleId, moduleTitle: lessonModule.title, score: result.score, correct: result.correct, total: result.total, createdAt: FieldValue.serverTimestamp() });
    return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao corrigir avaliação:", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não foi possível corrigir a avaliação." }, { status: 500 });
  }
}