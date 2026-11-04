import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  void request.url;
  try {
    const snapshot = await adminDb.collection("courses").where("published", "==", true).limit(200).get();
    return Response.json({ courses: snapshot.docs.map((doc) => { const data = doc.data(); return { id: doc.id, title: data.title, description: data.description, level: data.level, imageUrl: data.imageUrl, videoUrl: data.videoUrl, materialUrl: data.materialUrl }; }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar cursos:", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não foi possível carregar os cursos." }, { status: 503 });
  }
}