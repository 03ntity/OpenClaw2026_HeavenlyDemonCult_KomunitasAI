/**
 * Plugin entry — delegates all implementation to src/plugins/ for modularity.
 *
 * Modules:
 *   types.ts            Domain types & config schema
 *   helpers.ts          Utility functions & row mappers
 *   doku-mcp-client.ts  DOKU MCP client (JSON-RPC, 35+ tools)
 *   komunitas-service.ts Business logic service
 *   actions.ts          Agent actions (16)
 *   provider.ts         Agent provider
 *   routes.ts           REST route handlers
 *
 * This file only re-exports for backward compatibility with:
 *   src/index.ts                   → default export (Plugin)
 *   src/scheduler/autonomous-loop.ts → KomunitasService
 */
import plugin, {
  KomunitasService,
  getKomunitasService,
} from "./plugins/index.ts";

export { KomunitasService, getKomunitasService };
export default plugin;
