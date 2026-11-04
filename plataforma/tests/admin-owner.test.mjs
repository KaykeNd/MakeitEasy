import assert from "node:assert/strict";
import test from "node:test";
import { isVerifiedGoogleOwner } from "../lib/admin-owner.ts";

const token = { email: "kaykedeveliz@gmail.com", email_verified: true, firebase: { sign_in_provider: "google.com" } };
const account = { email: "kaykedeveliz@gmail.com", emailVerified: true, disabled: false, providerData: [{ providerId: "google.com" }] };

test("permite apenas a conta Google verificada e habilitada", () => {
  assert.equal(isVerifiedGoogleOwner(token, account), true);
  assert.equal(isVerifiedGoogleOwner({ ...token, email: "outra@gmail.com" }, account), false);
  assert.equal(isVerifiedGoogleOwner({ ...token, email_verified: false }, account), false);
  assert.equal(isVerifiedGoogleOwner({ ...token, firebase: { sign_in_provider: "password" } }, account), false);
  assert.equal(isVerifiedGoogleOwner(token, { ...account, email: "outra@gmail.com" }), false);
  assert.equal(isVerifiedGoogleOwner(token, { ...account, emailVerified: false }), false);
  assert.equal(isVerifiedGoogleOwner(token, { ...account, disabled: true }), false);
  assert.equal(isVerifiedGoogleOwner(token, { ...account, providerData: [] }), false);
});