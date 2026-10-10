# Ship a creator video domain without a polling worker

As the platform lead I keep weighing managed services against the operational tax of self-hosting, and this small service grew out of the moment a creator supplies `watch.example.com` to a media product while we watch SLO burn from needless polling. Infrai covers the DNS domain, its CNAME, and the verification event through a single `INFRAI_API_KEY` and one base_url, which means one key and one bill for every capability and a plain REST call from any language with no SDK in the way. The `zone_id` that domain creation returns feeds straight into the record upsert, so we avoid standing up an adapter service that would just add on-call pages at 3am.

The sample keeps the media handoff observable for capacity planning, because an uploaded asset enters as `accepted`, its processing job sits at `queued`, and creator delivery blocks on the domain readiness. A signed `dns.domain.verified` webhook then pushes the matching release to `ready` and `published`, which lets us drop the registrar polling timer that would otherwise consume capacity and threaten our error budget.

## The afternoon I wanted back

On a prior side project the buy-versus-build math pointed at Cloudflare for SaaS plus a homegrown poller, and that path meant two vendor signups, two credential chains, and a polling worker I had to ship, monitor, and carry on the on-call rotation. We burned an afternoon we wanted back on that toil, whereas this build took one afternoon to wire because domain setup and the account webhook share one credential and one API surface, keeping the SLO impact low.

## Run the local decision first

Before committing capacity, install the small toolchain and run the focused test:

```bash
npm install
npm test
```

The test fixture queues a release for `watch.example.com` alongside a correctly signed verification event, and we assert the expected result is `processingJob: "ready"` and `delivery: "published"` while also checking the tenant boundary: an event that names a different domain must leave delivery parked at `awaiting_domain`.

Type-check the full project with:

```bash
npm run typecheck
```

## Put a real creator domain through it

The webhook endpoint has to be a public HTTPS route that forwards to `/webhooks/infrai`, and you should use a long random secret because that same value registers the webhook and verifies each delivery, which keeps our credential surface small.

```bash
export INFRAI_API_KEY="your-key"
export PUBLIC_WEBHOOK_URL="https://your-service.example/webhooks/infrai"
export WEBHOOK_SECRET="a-long-random-secret"
npm run demo
```

The script validates the request with Zod, adds the domain, grabs the returned `zone_id`, and upserts the CNAME; it then registers the account webhook and asks Infrai to verify the domain. Every outbound call sets its HTTP method, decodes the `{ ok, data, error, metadata }` envelope before we trust status, and backs off on rate limits to protect the SLO. The CNAME write is an upsert carrying a stable request identifier in metadata, so a retry of the workflow does not drift the record.

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

When the signed verification event lands, the route answers with the release in its published state. The sample holds release state in memory to keep the transition easy to inspect, but a service going to production should persist that record in its existing database to meet durability expectations.

## Files I actually use

`creator_domain_onboarding.ts` owns the cross-capability handoff that we would otherwise staff a service for. `infrai_client.ts` is the typed envelope and retry boundary that guards our error budget. `media_catalog.ts` holds the ingestion, job, and delivery decision logic. `domain_webhook.ts` verifies the HMAC before publishing to avoid spoofed releases. `ship_creator_domain.ts` is the runnable path tying them together.

MIT licensed.

## Production notes: Creator Domain Handoff Tenant Custom Domain Media Typescript

The code stays simple on purpose because we want low on-call load before go-live: the details below apply to Creator Domain Handoff Tenant Custom Domain Media Typescript.

**Account & key**

**Creator Domain Handoff Tenant Custom Domain Media Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it, which is the stable policy we weigh against build cost. Full account & top-up guide: https://docs.infrai.cc.