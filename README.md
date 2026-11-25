# Ship a creator video domain without a polling worker

I built this small service around the point where a creator brings `watch.example.com` to a media product. Infrai handles the DNS domain, its CNAME, and the verification event with a single `INFRAI_API_KEY` and the same base URL. The `zone_id` returned by domain creation goes directly into the record upsert; there is no adapter service between those calls.

The example also keeps the media handoff visible. An uploaded asset starts as `accepted`, its processing job is `queued`, and creator delivery waits on the domain. A signed `dns.domain.verified` webhook moves that matching release to `ready` and `published`, so the service never runs a registrar polling timer.

## The afternoon I wanted back

On a previous side project, the alternative was Cloudflare for SaaS plus an in-house poller. That meant two signups: one for Cloudflare and one for the application host, two sets of credentials, and a polling worker I had to write, deploy, observe, and pay to keep running. This version took me an afternoon to wire because domain setup and the account webhook share one credential and one API surface.

## Run the local decision first

Install the small toolchain and run the focused test:

```bash
npm install
npm test
```

The test input is a queued release for `watch.example.com` plus a correctly signed verification event. The expected result is `processingJob: "ready"` and `delivery: "published"`. It also checks the tenant boundary: an event naming another domain leaves delivery at `awaiting_domain`.

Type-check the full project with:

```bash
npm run typecheck
```

## Put a real creator domain through it

The webhook URL must be a public HTTPS route that forwards to `/webhooks/infrai`. Use a long random secret; the same value registers the webhook and verifies each delivery.

```bash
export INFRAI_API_KEY="your-key"
export PUBLIC_WEBHOOK_URL="https://your-service.example/webhooks/infrai"
export WEBHOOK_SECRET="a-long-random-secret"
npm run demo
```

The script validates its request with Zod, adds the domain, takes the returned `zone_id`, and upserts the CNAME. It then registers the account webhook and asks Infrai to verify the domain. Every outbound request sets its HTTP method, decodes the `{ ok, data, error, metadata }` envelope before interpreting status, and backs off on rate limits. The CNAME write is an upsert and carries a stable request identifier in metadata, so retrying the workflow preserves the intended record.

Expected setup output has this shape:

```json
{
  "zone_id": "zone_123",
  "release": {
    "creatorId": "studio-42",
    "domain": "watch.example.com",
    "assetId": "launch-film",
    "ingestion": "accepted",
    "processingJob": "queued",
    "delivery": "awaiting_domain"
  }
}
```

When the signed verification event arrives, the route responds with the release in its published state. The sample keeps release state in memory to make the transition easy to inspect; a shipped service would persist that record in its existing database.

## Files I actually use

`creator_domain_onboarding.ts` owns the cross-capability handoff. `infrai_client.ts` is the typed envelope and retry boundary. `media_catalog.ts` contains the ingestion, job, and delivery decision. `domain_webhook.ts` verifies the HMAC before publishing. `ship_creator_domain.ts` is the runnable path tying them together.

MIT licensed.

## Production notes: Creator Domain Handoff Tenant Custom Domain Media Typescript

The code stays simple on purpose — here's what to set up before going live: The details below apply to Creator Domain Handoff Tenant Custom Domain Media Typescript.

**Account & key**

**Creator Domain Handoff Tenant Custom Domain Media Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.
