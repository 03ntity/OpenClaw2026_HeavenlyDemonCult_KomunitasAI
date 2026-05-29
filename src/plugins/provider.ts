import type {
  IAgentRuntime,
  Memory,
  Provider,
  ProviderResult,
  State,
} from "@elizaos/core";
import { getKomunitasService } from "./komunitas-service.ts";
import { rupiah, toMonth } from "./helpers.ts";

export const komunitasProvider: Provider = {
  name: "KOMUNITAS_FINANCE_CONTEXT",
  description:
    "Current community, kas, invoice, and DOKU sandbox readiness context.",
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = getKomunitasService(runtime);

    const communities = await service.listCommunities();
    if (communities.length === 0) {
      return {
        text: [
          "Belum ada komunitas.",
          "Arahkan user: ketik 'buat komunitas baru'.",
        ].join("\n"),
        values: {
          onboardingRequired: true,
          communityCount: 0,
          dokuConfigured: service.isDokuConfigured(),
        },
        data: { communities: [] },
      };
    }

    const community = communities[0];
    const summary = await service.getKasSummary(community.id);
    const pendingInvoices = await service.listInvoices(community.id, {
      status: "pending",
      month: toMonth(),
    });
    const paidInvoices = await service.listInvoices(community.id, {
      status: "paid",
      month: toMonth(),
    });
    return {
      text: [
        `Komunitas: ${community.name} (${community.type})`,
        `Iuran: ${rupiah(community.monthlyFee)} | Kas: ${rupiah(summary.currentBalance)}`,
        `Invoice bulan ini: ${paidInvoices.length} paid, ${pendingInvoices.length} pending | DOKU: ${service.isDokuConfigured() ? "yes" : "no"}`,
        communities.length > 1
          ? `Komunitas lain: ${communities
              .slice(1)
              .map((c) => c.name)
              .join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      values: {
        onboardingRequired: false,
        communityName: community.name,
        communityId: community.id,
        communityType: community.type,
        kasBalance: summary.currentBalance,
        pendingInvoiceCount: pendingInvoices.length,
        dokuConfigured: service.isDokuConfigured(),
        totalCommunities: communities.length,
      },
      data: { community, summary, pendingInvoices, paidInvoices, communities },
    };
  },
};
