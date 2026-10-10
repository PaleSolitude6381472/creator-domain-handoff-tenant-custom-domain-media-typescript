import assert from "node:assert/strict";
import test from "node:test";
import { acceptDomainWebhook, signWebhook } from "../src/domain_webhook.js";
import type { CreatorRelease } from "../src/media_catalog.js";

test("a signed event publishes the matching creator release", () => {
  const secret = "local-test-secret-123";
  const raw = JSON.stringify({
    type: "dns.domain.verified",
    data: { domain: "watch.example.com" }
  });
  const release: CreatorRelease = {
    creatorId: "studio-42",
    domain: "watch.example.com",
    assetId: "launch-film",
    ingestion: "accepted",
    processingJob: "queued",
    delivery: "awaiting_domain"
  };

  const published = acceptDomainWebhook(raw, signWebhook(raw, secret), secret, release);

  assert.equal(published.processingJob, "ready");
  assert.equal(published.delivery, "published");
});

test("an event for another tenant cannot publish this release", () => {
  const secret = "local-test-secret-123";
  const raw = JSON.stringify({
    type: "dns.domain.verified",
    data: { domain: "other.example.com" }
  });
  const release: CreatorRelease = {
    creatorId: "studio-42",
    domain: "watch.example.com",
    assetId: "launch-film",
    ingestion: "accepted",
    processingJob: "queued",
    delivery: "awaiting_domain"
  };

  const unchanged = acceptDomainWebhook(raw, signWebhook(raw, secret), secret, release);

  assert.equal(unchanged.delivery, "awaiting_domain");
});
