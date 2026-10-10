import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { z } from "zod";
import { publishVerifiedDomain, type CreatorRelease } from "./media_catalog.js";

const eventSchema = z.object({
  type: z.literal("dns.domain.verified"),
  data: z.object({ domain: z.string().min(3) })
});

export function signWebhook(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function acceptDomainWebhook(
  rawBody: string,
  signature: string,
  secret: string,
  release: CreatorRelease
): CreatorRelease {
  const expected = Buffer.from(signWebhook(rawBody, secret), "hex");
  const supplied = Buffer.from(signature, "hex");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error("Invalid webhook signature");
  }
  const event = eventSchema.parse(JSON.parse(rawBody));
  return publishVerifiedDomain(release, event.data.domain);
}

export function startWebhookServer(release: CreatorRelease, secret: string, port = 8787) {
  let current = release;
  return createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/webhooks/infrai") {
      response.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      try {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        current = acceptDomainWebhook(
          rawBody,
          typeof request.headers["x-infrai-signature"] === "string"
            ? request.headers["x-infrai-signature"]
            : "",
          secret,
          current
        );
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(current));
      } catch {
        response.writeHead(401).end();
      }
    });
  }).listen(port);
}
