import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const uid = process.argv[2];
if (!uid) {
  console.error("Informe o UID do usuário: node scripts/set-admin.mjs UID");
  process.exitCode = 1;
} else {
  try {
    initializeApp({ credential: applicationDefault() });
    const auth = getAuth();
    const user = await auth.getUser(uid);
    await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true });
    await auth.revokeRefreshTokens(uid);
    console.log("Acesso administrativo concedido. O usuário deve entrar novamente.");
  } catch (error) {
    console.error("Não foi possível conceder acesso:", error.message);
    process.exitCode = 1;
  }
}