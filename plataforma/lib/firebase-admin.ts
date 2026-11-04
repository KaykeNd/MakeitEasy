import "server-only";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { isVerifiedGoogleOwner } from "@/lib/admin-owner";
export { OWNER_EMAIL } from "@/lib/admin-owner";

const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

export async function authorizeAdmin(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return { error: Response.json({ error: "Faça login para continuar." }, { status: 401 }) };
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return { error: Response.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 }) };
  }
  try {
    await adminAuth.verifyIdToken(token, true);
    const account = await adminAuth.getUser(decoded.uid);
    const ownerWithGoogle = isVerifiedGoogleOwner(decoded, account);
    if (account.disabled || (account.customClaims?.admin !== true && !ownerWithGoogle)) {
      return { error: Response.json({ error: "Acesso restrito a administradores." }, { status: 403 }) };
    }
    if (ownerWithGoogle && account.customClaims?.admin !== true) await adminAuth.setCustomUserClaims(decoded.uid, { ...account.customClaims, admin: true });
    return { uid: decoded.uid };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === "auth/id-token-revoked" || code === "auth/user-disabled" || code === "auth/user-not-found") return { error: Response.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 }) };
    console.error("Falha na verificação administrativa:", error instanceof Error ? error.message : "erro desconhecido");
    return { error: Response.json({ error: "Não foi possível verificar o acesso. Confira as credenciais do Firebase Admin." }, { status: 503 }) };
  }
}