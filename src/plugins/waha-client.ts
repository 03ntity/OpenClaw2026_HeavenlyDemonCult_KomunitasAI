export class WahaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly session: string;

  constructor(config: { baseUrl: string; apiKey: string; session: string }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.session = config.session;
  }

  get isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.session);
  }

  async sendText(phone: string, text: string): Promise<void> {
    await this.post("/api/sendText", {
      session: this.session,
      chatId: toWahaChatId(phone),
      text,
    });
  }

  async sendImage(params: {
    phone: string;
    imageUrl: string;
    caption?: string;
    filename?: string;
  }): Promise<void> {
    await this.post("/api/sendImage", {
      session: this.session,
      chatId: toWahaChatId(params.phone),
      file: {
        mimetype: "image/jpeg",
        url: params.imageUrl,
        filename: params.filename ?? "qris.jpeg",
      },
      caption: params.caption ?? "",
    });
  }

  async sendSeen(phone: string): Promise<void> {
    await this.post("/api/sendSeen", {
      session: this.session,
      chatId: toWahaChatId(phone),
    });
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    if (!this.isConfigured) throw new Error("WAHA client is not configured");

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `WAHA request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`,
      );
    }
  }
}

export function loadWahaConfig() {
  return {
    baseUrl: process.env.WAHA_BASE_URL ?? "",
    apiKey: process.env.WAHA_API_KEY ?? "",
    session: process.env.WAHA_SESSION ?? "default",
  };
}

export function normalizeWahaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export function toWahaChatId(phone: string): string {
  return `${normalizeWahaPhone(phone)}@c.us`;
}
