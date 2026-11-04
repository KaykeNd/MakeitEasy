import { FieldValue } from "firebase-admin/firestore";
import { adminDb, authorizeAdmin } from "@/lib/firebase-admin";
import { parseModule, validDocumentId } from "@/lib/learning";

export async function GET(request: Request) {
  const access = await authorizeAdmin(request);
  if (access.error) return access.error;
  const courseId = new URL(request.url).searchParams.get("courseId");
  if (!validDocumentId(courseId)) return Response.json({ error: "Curso inválido." }, { status: 400 });
  try {
    const snapshot = await adminDb.collection("courseModules").where("courseId", "==", courseId).get();
    const modules = snapshot.docs.flatMap((doc) => { const data = parseModule(doc.data()); return data ? [{ id: doc.id, ...data }] : []; }).sort((left, right) => left.position - right.position);
    return Response.json({ modules }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar módulos:", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não foi possível carregar os módulos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await authorizeAdmin(request);
  if (access.error) return access.error;
  try {
    const body = await request.json();
    const data = parseModule(body.module);
    if (!data || (body.id !== undefined && !validDocumentId(body.id))) return Response.json({ error: "Confira o módulo, as alternativas e os links HTTPS." }, { status: 400 });
    const course = adminDb.collection("courses").doc(data.courseId);
    const moduleRef = body.id ? adminDb.collection("courseModules").doc(body.id) : adminDb.collection("courseModules").doc();
    await adminDb.runTransaction(async (transaction) => {
      const courseSnapshot = await transaction.get(course);
      if (!courseSnapshot.exists) throw new Error("course-not-found");
      if (body.id) {
        const existing = await transaction.get(moduleRef);
        if (!existing.exists || existing.get("courseId") !== data.courseId) throw new Error("module-not-found");
        transaction.update(moduleRef, { ...data, updatedAt: FieldValue.serverTimestamp() });
      } else {
        const existing = await transaction.get(adminDb.collection("courseModules").where("courseId", "==", data.courseId).limit(200));
        if (existing.size >= 200) throw new Error("module-limit");
        transaction.create(moduleRef, { ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      }
    });
    return Response.json({ ok: true, id: moduleRef.id });
  } catch (error) {
    if (error instanceof Error && ["course-not-found", "module-not-found", "module-limit"].includes(error.message)) return Response.json({ error: error.message === "module-limit" ? "O curso atingiu o limite de 200 módulos." : "Curso ou módulo não encontrado." }, { status: 400 });
    console.error("Falha ao salvar módulo:", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não foi possível salvar o módulo." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await authorizeAdmin(request);
  if (access.error) return access.error;
  try {
    const body = await request.json();
    if (!validDocumentId(body.id) || !validDocumentId(body.courseId)) return Response.json({ error: "Módulo inválido." }, { status: 400 });
    const moduleRef = adminDb.collection("courseModules").doc(body.id);
    const removed = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(moduleRef);
      if (!snapshot.exists || snapshot.get("courseId") !== body.courseId) return false;
      transaction.delete(moduleRef);
      return true;
    });
    if (!removed) return Response.json({ error: "Módulo não encontrado." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Falha ao excluir módulo:", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não foi possível excluir o módulo." }, { status: 500 });
  }
}