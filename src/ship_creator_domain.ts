import { InfraiClient } from "./infrai_client.js";
import { onboardCreatorDomain } from "./creator_domain_onboarding.js";
import { startWebhookServer } from "./domain_webhook.js";

const apiKey = process.env.INFRAI_API_KEY;
const webhookUrl = process.env.PUBLIC_WEBHOOK_URL;
const webhookSecret = process.env.WEBHOOK_SECRET;

if (!apiKey || !webhookUrl || !webhookSecret) {
  throw new Error("Set INFRAI_API_KEY, PUBLIC_WEBHOOK_URL, and WEBHOOK_SECRET");
}

const client = new InfraiClient(apiKey);
const result = await onboardCreatorDomain(client, {
  creatorId: "studio-42",
  domain: "example.com",
  deliveryTarget: "edge.example.net",
  webhookUrl,
  webhookSecret,
  asset: {
    id: "launch-film",
    source: "https://uploads.example.com/launch-film.mov"
  }
});

console.log(JSON.stringify(result, null, 2));
startWebhookServer(result.release, webhookSecret);
console.log("Listening for verified-domain delivery on http://localhost:8787/webhooks/infrai");
