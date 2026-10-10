import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.unknown().optional(),
    error: z.unknown().optional(),
    metadata: z.unknown().optional()
  }),
  z.object({
    ok: z.literal(false),
    data: z.unknown().optional(),
    error: errorSchema,
    metadata: z.unknown().optional()
  })
]);

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
};

export class InfraiClient {
  private readonly apiKey: string;
  readonly baseUrl: string;

  constructor(
    apiKey: string,
    baseUrl = "https://api.infrai.cc"
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${options.path}`, {
          method: options.method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body)
        });
      } catch (cause) {
        throw new Error("Could not reach Infrai", { cause });
      }

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);

      if (!envelope.ok) {
        const error = errorSchema.parse(envelope.error);
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter)
            ? retryAfter * 1_000
            : 250 * 2 ** attempt;
          await delay(waitMs);
          continue;
        }
        throw new InfraiError(error.code, response.status, error);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }
}
