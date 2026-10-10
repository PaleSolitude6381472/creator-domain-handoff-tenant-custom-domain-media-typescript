import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";
import { initialRelease, onboardingSchema } from "./media_catalog.js";

const addedDomainSchema = z.object({ zone_id: z.string().min(1) }).passthrough();

export async function onboardCreatorDomain(client: InfraiClient, body: unknown) {
  const input = onboardingSchema.parse(body);
  const requestId = randomUUID();

  const added = await client.request<unknown>({
    method: "POST",
    path: "/v1/dns/domain/add",
    body: {
      domain: input.domain,
      metadata: { creator_id: input.creatorId, client_request_id: requestId }
    }
  });
  const { zone_id } = addedDomainSchema.parse(added);

  await client.request({
    method: "PUT",
    path: "/v1/dns/record/upsert",
    body: {
      zone_id,
      record_type: "CNAME",
      name: input.domain,
      content: input.deliveryTarget,
      ttl: 300,
      proxied: true,
      metadata: { creator_id: input.creatorId, client_request_id: requestId }
    }
  });

  await client.request({
    method: "POST",
    path: "/v1/account/webhooks/register",
    body: {
      url: input.webhookUrl,
      events: ["dns.domain.verified"],
      description: `Publish ${input.creatorId} when the domain is verified`,
      secret: input.webhookSecret
    }
  });

  await client.request({
    method: "POST",
    path: "/v1/dns/domain/verify",
    body: { domain: input.domain }
  });

  return { zone_id, release: initialRelease(input) };
}
