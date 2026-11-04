import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";

export const OWNER_EMAIL = "kaykedeveliz@gmail.com";

export function isVerifiedGoogleOwner(decoded: DecodedIdToken, account: UserRecord) {
  return !account.disabled && decoded.email?.toLowerCase() === OWNER_EMAIL && decoded.email_verified === true && decoded.firebase.sign_in_provider === "google.com" && account.email?.toLowerCase() === OWNER_EMAIL && account.emailVerified && account.providerData.some((provider) => provider.providerId === "google.com");
}