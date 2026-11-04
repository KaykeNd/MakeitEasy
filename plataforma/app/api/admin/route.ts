import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, authorizeAdmin, OWNER_EMAIL } from "@/lib/firebase-admin";

function courseData(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 120 || typeof input.description !== "string" || !input.description.trim() || input.description.length > 1000 || typeof input.level !== "string" || !["A1", "A2", "B1", "B2", "C1", "C2"].includes(input.level) || typeof input.published !== "boolean") return null;
  for (const field of ["imageUrl", "videoUrl", "materialUrl"] as const) {
    if (typeof input[field] !== "string" || input[field].length > 2048) return null;
    if (input[field]) {
      try { if (new URL(input[field]).protocol !== "https:") return null; } catch { return null; }
    }
  }
  return { title: input.title.trim(), description: input.description.trim(), level: input.level, imageUrl: input.imageUrl, videoUrl: input.videoUrl, materialUrl: input.materialUrl, published: input.published, updatedAt: FieldValue.serverTimestamp() };
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

export async function GET(request: Request) {
  const access = await authorizeAdmin(request);
  if (access.error) return access.error;
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("resource") === "access") return Response.json({ ok: true });
    if (url.searchParams.get("resource") === "users") {
      const page = await adminAuth.listUsers(100, url.searchParams.get("pageToken") || undefined);
      return Response.json({ users: page.users.map((user) => ({ uid: user.uid, email: user.email ?? "", name: user.displayName ?? "", disabled: user.disabled, admin: user.customClaims?.admin === true, protected: user.customClaims?.admin === true || (user.emailVerified && user.email?.toLowerCase() === OWNER_EMAIL), createdAt: user.metadata.creationTime })), nextPageToken: page.pageToken ?? null });
    }
    if (url.searchParams.get("resource") === "courses") {
      const snapshot = await adminDb.collection("courses").orderBy("updatedAt", "desc").limit(200).get();
      return Response.json({ courses: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), updatedAt: doc.get("updatedAt")?.toMillis() ?? null })) });
    }
    if (url.searchParams.get("resource") === "results") {
      const snapshot = await adminDb.collection("quizAttempts").orderBy("createdAt", "desc").limit(200).get();
      return Response.json({ results: snapshot.docs.map((doc) => ({ id: doc.id, email: doc.get("email") || "", courseTitle: doc.get("courseTitle"), moduleTitle: doc.get("moduleTitle"), score: doc.get("score"), correct: doc.get("correct"), total: doc.get("total"), createdAt: doc.get("createdAt")?.toMillis() ?? null })) });
    }
    return Response.json({ error: "Recurso inválido." }, { status: 400 });
  } catch (error) {
    console.error("Falha ao carregar dados administrativos:", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não foi possível carregar os dados. Verifique a configuração do Firebase Admin e do Firestore." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await authorizeAdmin(request);
  if (access.error) return access.error;
  try {
    const body = await request.json();
    const data = courseData(body.course);
    if (!data || (body.id !== undefined && !validId(body.id))) return Response.json({ error: "Confira os dados do curso e use links HTTPS válidos." }, { status: 400 });
    if (body.id) await adminDb.collection("courses").doc(body.id).update(data);
    else await adminDb.collection("courses").add({ ...data, createdAt: FieldValue.serverTimestamp() });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Falha ao salvar curso:", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não foi possível salvar o curso." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await authorizeAdmin(request);
  if (access.error) return access.error;
  try {
    const body = await request.json();
    if (typeof body.uid !== "string" || !body.uid || body.uid.length > 128 || typeof body.disabled !== "boolean" || body.uid === access.uid) return Response.json({ error: "Operação inválida." }, { status: 400 });
    const target = await adminAuth.getUser(body.uid);
    if (target.customClaims?.admin === true || (target.emailVerified && target.email?.toLowerCase() === OWNER_EMAIL)) return Response.json({ error: "Contas administradoras não podem ser alteradas pelo painel." }, { status: 403 });
    await adminAuth.updateUser(body.uid, { disabled: body.disabled });
    if (body.disabled) await adminAuth.revokeRefreshTokens(body.uid);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Falha ao atualizar conta:", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não foi possível atualizar a conta." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await authorizeAdmin(request);
  if (access.error) return access.error;
  try {
    const body = await request.json();
    if (!validId(body.id)) return Response.json({ error: "Curso inválido." }, { status: 400 });
    const courseRef = adminDb.collection("courses").doc(body.id);
    await adminDb.runTransaction(async (transaction) => {
      const modules = await transaction.get(adminDb.collection("courseModules").where("courseId", "==", body.id));
      if (modules.size > 200) throw new Error("module-limit");
      modules.docs.forEach((module) => transaction.delete(module.ref));
      transaction.delete(courseRef);
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Falha ao excluir curso:", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não foi possível excluir o curso." }, { status: 500 });
  }
}