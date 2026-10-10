import { z } from "zod";

export const onboardingSchema = z.object({
  creatorId: z.string().min(1),
  domain: z.string().min(3),
  deliveryTarget: z.string().min(3),
  webhookUrl: z.string().url(),
  webhookSecret: z.string().min(16),
  asset: z.object({
    id: z.string().min(1),
    source: z.string().url()
  })
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export type CreatorRelease = {
  creatorId: string;
  domain: string;
  assetId: string;
  ingestion: "accepted";
  processingJob: "queued" | "ready";
  delivery: "awaiting_domain" | "published";
};

export function initialRelease(input: OnboardingInput): CreatorRelease {
  return {
    creatorId: input.creatorId,
    domain: input.domain,
    assetId: input.asset.id,
    ingestion: "accepted",
    processingJob: "queued",
    delivery: "awaiting_domain"
  };
}

export function publishVerifiedDomain(
  release: CreatorRelease,
  verifiedDomain: string
): CreatorRelease {
  if (release.domain !== verifiedDomain) return release;
  return { ...release, processingJob: "ready", delivery: "published" };
}
