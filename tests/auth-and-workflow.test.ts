import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_COOKIE,
  createSessionValue,
  isAppRequestAuthorized,
} from "../lib/auth.ts";
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
  getReviewWorkflowActions,
} from "../lib/validation.ts";

const TEST_ENV = {
  AUTH_SECRET: "test-auth-secret-1234567890",
  APP_PASSWORD: "test-app-password-1234567890",
  EXTENSION_ACCESS_TOKEN: "test-extension-token-abcdef",
};

test("isAppRequestAuthorized accepts valid session cookie and rejects invalid cookie", () => {
  const validToken = createSessionValue(TEST_ENV);
  const authedReq = new Request("http://localhost:3000/api/applications", {
    headers: { cookie: `${SESSION_COOKIE}=${validToken}` },
  });
  assert.equal(isAppRequestAuthorized(authedReq, false, TEST_ENV), true);

  const tamperedReq = new Request("http://localhost:3000/api/applications", {
    headers: { cookie: `${SESSION_COOKIE}=invalid-cookie-value` },
  });
  assert.equal(isAppRequestAuthorized(tamperedReq, false, TEST_ENV), false);

  const anonymousReq = new Request("http://localhost:3000/api/applications");
  assert.equal(isAppRequestAuthorized(anonymousReq, false, TEST_ENV), false);
});

test("isAppRequestAuthorized enforces allowExtension flag for x-extension-token", () => {
  const extReq = new Request("http://localhost:3000/api/applications/create", {
    method: "POST",
    headers: { "x-extension-token": TEST_ENV.EXTENSION_ACCESS_TOKEN },
  });

  // Allowed when allowExtension is true
  assert.equal(isAppRequestAuthorized(extReq, true, TEST_ENV), true);
  // Rejected on session-only endpoints where allowExtension is false
  assert.equal(isAppRequestAuthorized(extReq, false, TEST_ENV), false);

  const wrongExtReq = new Request("http://localhost:3000/api/applications/create", {
    method: "POST",
    headers: { "x-extension-token": "wrong-token" },
  });
  assert.equal(isAppRequestAuthorized(wrongExtReq, true, TEST_ENV), false);
});

test("createApplicationSchema accepts valid http/https URLs and rejects unsafe URLs", () => {
  const valid = createApplicationSchema.safeParse({
    company_name: "Acme Sdn Bhd",
    job_title: "Junior TypeScript Developer",
    job_url: "https://my.jobstreet.com/job/12345",
  });
  assert.equal(valid.success, true);

  const emptyUrl = createApplicationSchema.safeParse({
    company_name: "Acme Sdn Bhd",
    job_title: "Junior TypeScript Developer",
    job_url: "",
  });
  assert.equal(emptyUrl.success, true);

  const unsafeUrl = createApplicationSchema.safeParse({
    company_name: "Acme Sdn Bhd",
    job_title: "Junior TypeScript Developer",
    job_url: "javascript:alert(1)",
  });
  assert.equal(unsafeUrl.success, false);

  const malformedUrl = createApplicationSchema.safeParse({
    company_name: "Acme Sdn Bhd",
    job_title: "Junior TypeScript Developer",
    job_url: "not-a-valid-url",
  });
  assert.equal(malformedUrl.success, false);
});

test("updateApplicationStatusSchema validates UUID and review statuses", () => {
  const ok = updateApplicationStatusSchema.safeParse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    status: "reviewing",
  });
  assert.equal(ok.success, true);

  const badStatus = updateApplicationStatusSchema.safeParse({
    id: "550e8400-e29b-41d4-a716-446655440000",
    status: "auto_submitted",
  });
  assert.equal(badStatus.success, false);
});

test("getReviewWorkflowActions provides sequential review steps and reject/archive actions", () => {
  const discoveredActions = getReviewWorkflowActions("discovered");
  assert.equal(discoveredActions[0]?.status, "reviewing");
  assert.equal(
    discoveredActions.some((a) => a.status === "rejected"),
    true
  );
  assert.equal(
    discoveredActions.some((a) => a.status === "closed"),
    true
  );

  const reviewingActions = getReviewWorkflowActions("reviewing");
  assert.equal(reviewingActions[0]?.status, "shortlisted");

  const shortlistedActions = getReviewWorkflowActions("shortlisted");
  assert.equal(shortlistedActions[0]?.status, "applied");
});
