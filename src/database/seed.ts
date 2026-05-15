import { closePool, getPool, initSchema, seedDemoData } from "./db.ts";

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error(
      "POSTGRES_URL environment variable is required.\n" +
        "Set it in .env or export POSTGRES_URL=postgresql://user:pass@host:port/db",
    );
    process.exit(1);
  }

  console.log("Initializing schema...");
  await initSchema();

  console.log("Seeding demo data...");
  const { community, members } = await seedDemoData();

  console.log("\nDemo data seeded successfully:");
  console.log(`  Community: ${community.name} (${community.type})`);
  console.log(
    `  Monthly fee: Rp ${community.monthly_fee.toLocaleString("id-ID")}`,
  );
  console.log(`  Members: ${members.length}`);
  for (const m of members) {
    console.log(`    - ${m.name} (${m.phone ?? "no phone"})`);
  }

  await closePool();
  console.log("\nDone. Database is ready for demo.");
}

main().catch((e) => {
  console.error("Seed failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
