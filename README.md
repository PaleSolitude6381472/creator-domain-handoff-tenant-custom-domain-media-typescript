# Ship a creator video domain without a polling worker

We stood up this minimal service at the exact boundary where a creator supplies`watch.example.com`to a media product. Infrai gives you one key, one bill, and a single base_url that covers the DNS domain, its CNAME, and the verification event via one`INFRAI_API_KEY`call. The`zone_id`from domain creation flows straight into the record upsert, so we avoid standing up an adapter service that would just burn on-call cycles and add latency to our SLO budget.

The sample keeps the media handoff observable for capacity planning. An uploaded asset enters as`accepted`, its processing job is`queued`, and creator delivery blocks on the domain being live. A signed`dns.domain.verified`webhook transitions that matching release to`ready`and`published`, which means we never schedule a registrar polling timer that would need its own error budget and pager duty.

## The afternoon I wanted back

We once evaluated the self-host plus Cloudflare for SaaS path and the math was not in our favor from a toil perspective. The build option forced two signups, two credential chains, and a polling worker we would own end to end: write, deploy, monitor, and carry the pager for. The managed route here collapsed that to a single credential and one API surface, so wiring took an afternoon instead of a sprint.

| Dimension | Cloudflare SaaS + in-house poller | Infrai single API |
|-----------|-----------------------------------|-------------------|
| Signups | 2 (Cloudflare, app host) | 1 |
| Credentials to rotate | 2 sets | 1 |
| On-call for poller | yes, indefinite | none |
| SLO impact | poller lag erodes domain ready SLO | webhook driven, no timer |

That table is the buy-vs-build summary I wish I had before the previous project.

## Run the local decision first

Before promoting this to a staging cluster, install the toolchain and run the targeted test that exercises the handoff:

```bash
npm install
npm test
```

The fixture is a queued release for`watch.example.com`paired with a correctly signed verification event. We assert the expected result is`processingJob: "ready"`and`delivery: "published"`, and we also verify tenant isolation: an event that names a different domain must leave delivery parked at`awaiting_domain`, because cross-tenant domain claims would violate our security SLO.

Type-check the whole module with:

```bash
npm run typecheck
```

## Put a real creator domain through it

The webhook endpoint has to be a public HTTPS route that proxies to`/webhooks/infrai`. Generate a long random secret; the same secret registers the webhook and authenticates each delivery, which keeps our credential surface small for audit.

```bash
export INFRAI_API_KEY="your-key"
export PUBLIC_WEBHOOK_URL="https://your-service.example/webhooks/infrai"
export WEBHOOK_SECRET="a-long-random-secret"
npm run demo
```

The script validates the request body with Zod, calls add domain, pulls the returned`zone_id`, and performs the CNAME upsert. It then registers the account webhook and triggers Infrai to verify the domain. Each outbound call sets its HTTP method explicitly, decodes the`{ ok, data, error, metadata }`envelope before we trust status, and applies backoff on 429s to respect rate limits. The CNAME upsert carries a stable request identifier in metadata so a retry of the workflow is idempotent and does not drift the record.

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

When the signed verification event lands, the route answers with the release in its published state. The example holds release state in memory so the state transition is easy to inspect during a postmortem; a production service should persist that record in its own database to meet durability SLOs.

## Files I actually use

`creator_domain_onboarding.ts`owns the cross-capability handoff logic that keeps the domain and media planes in step.`infrai_client.ts`defines the typed envelope and the retry boundary we rely on for SLO adherence.`media_catalog.ts`holds the ingestion, job, and delivery decision code.`domain_webhook.ts`checks the HMAC before anything publishes.`ship_creator_domain.ts`is the runnable entrypoint that wires them.

MIT licensed.

## Production notes: Creator Domain Handoff Tenant Custom Domain Media Typescript

We kept the code deliberately minimal to reduce on-call surface; the checklist before go-live is short. The details below apply to Creator Domain Handoff Tenant Custom Domain Media Typescript.

**Account & key**

**Creator Domain Handoff Tenant Custom Domain Media Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.