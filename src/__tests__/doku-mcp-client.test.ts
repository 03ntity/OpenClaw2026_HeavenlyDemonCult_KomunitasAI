import { afterEach, describe, expect, it, mock } from "bun:test";
import { DokuMcpClient } from "../plugins/doku-mcp-client.ts";

const originalFetch = globalThis.fetch;

describe("DokuMcpClient", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("initializes MCP, lists tools, and calls the documented checkout tool", async () => {
    const calls: Array<{ headers: Record<string, string>; body: any }> = [];
    globalThis.fetch = mock(
      async (_url: string | URL | Request, init?: RequestInit) => {
        calls.push({
          headers: init?.headers as Record<string, string>,
          body: JSON.parse(String(init?.body)),
        });

        const method = calls.at(-1)?.body.method;
        if (method === "initialize") {
          return Response.json({
            jsonrpc: "2.0",
            id: 0,
            result: {
              protocolVersion: "2025-06-18",
              serverInfo: { name: "doku-mcp-server", version: "1.0.0" },
            },
          });
        }

        if (method === "tools/list") {
          return Response.json({
            jsonrpc: "2.0",
            id: 1,
            result: {
              tools: [
                {
                  name: "create_checkout_link",
                  description: "Create checkout",
                },
                {
                  name: "get_merchant_payment_methods",
                  description: "Get merchant payment methods",
                },
              ],
            },
          });
        }

        if (
          calls.at(-1)?.body.params?.name === "get_merchant_payment_methods"
        ) {
          return Response.json({
            jsonrpc: "2.0",
            id: 3,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    totalChannels: 2,
                    totalCategories: 1,
                    categories: { QRIS: ["QRIS"] },
                  }),
                },
              ],
            },
          });
        }

        return Response.json({
          jsonrpc: "2.0",
          id: 2,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  response: {
                    order: { invoice_number: "INV-1" },
                    payment: {
                      url: "https://checkout.example/INV-1",
                      token_id: "token-1",
                      expired_datetime: "2026-01-01T00:00:00Z",
                    },
                  },
                }),
              },
            ],
          },
        });
      },
    ) as unknown as typeof fetch;

    const client = new DokuMcpClient({
      DOKU_CLIENT_ID: "BRN-TEST",
      DOKU_MCP_API_KEY: "api_key_test",
      DOKU_BASE_URL: "https://api-sandbox.doku.com",
    });

    const result = await client.createPaymentLink({
      invoiceNumber: "INV-1",
      amount: 20000,
      description: "Iuran",
      customerName: "Budi",
      customerPhone: "08123456789",
      dueMinutes: 60,
    });

    expect(result.paymentUrl).toBe("https://checkout.example/INV-1");
    expect(calls.map((call) => call.body.method)).toEqual([
      "initialize",
      "tools/list",
      "tools/call",
    ]);
    expect(calls[0].headers["mcp-protocol-version"]).toBeUndefined();
    expect(calls[1].headers["mcp-protocol-version"]).toBe("2025-06-18");
    expect(calls[2].body.params.name).toBe("create_checkout_link");
    expect(calls[2].headers.authorization).toBe("Basic YXBpX2tleV90ZXN0Og==");

    const tools = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain(
      "get_merchant_payment_methods",
    );

    const methods = await client.callRawTool("get_merchant_payment_methods");
    expect(methods).toEqual({
      totalChannels: 2,
      totalCategories: 1,
      categories: { QRIS: ["QRIS"] },
    });
    expect(calls.map((call) => call.body.method)).toEqual([
      "initialize",
      "tools/list",
      "tools/call",
      "tools/call",
    ]);
  });
});
