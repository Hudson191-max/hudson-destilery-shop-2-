// Seed the local SQLite database with demo inventory, settings and accounts.
// Mirrors supabase-setup.sql so dev matches a fresh production database.
// Idempotent — safe to run repeatedly.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const DEFAULT_INVENTORY = [
  { name: "Moonshine", price: 500, stock: 0, cat: "Other" },
  { name: "Vodka", price: 250, stock: 16, cat: "Other" },
  { name: "Wine", price: 400, stock: 44, cat: "Other" },
  { name: "Berry Wine", price: 500, stock: 0, cat: "Other" },
  { name: "Rum", price: 250, stock: 17, cat: "Other" },
  { name: "Mead", price: 250, stock: 8, cat: "Other" },
  { name: "Ale", price: 250, stock: 68, cat: "Other" },
  { name: "Sake", price: 250, stock: 6, cat: "Other" },
  { name: "Beer", price: 250, stock: 10, cat: "Other" },
  { name: "Cider", price: 250, stock: 9, cat: "Other" },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  site_closed: "false",
  maintenance_mode: "false",
  site_closed_message: "Orders are temporarily paused. Please check back soon.",
  discord_link: "https://discord.gg/anAmr5MQF",
  auth_whitelist:
    '{"employee":["hudson","maria","sam","jordan"],"owner":["hudson","owner"]}',
};

const DEFAULT_ACCOUNTS = [
  { username: "hudson", role: "owner", password: "hudson123" },
  { username: "maria", role: "employee", password: "staff123" },
];

async function main() {
  for (const item of DEFAULT_INVENTORY) {
    const existing = await prisma.inventory.findFirst({
      where: { name: item.name },
    });
    if (!existing) await prisma.inventory.create({ data: item });
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  for (const acc of DEFAULT_ACCOUNTS) {
    const existing = await prisma.auth.findUnique({
      where: { username: acc.username },
    });
    if (!existing) {
      const { password_hash, salt } = hashPassword(acc.password);
      await prisma.auth.create({
        data: {
          username: acc.username,
          role: acc.role,
          password_hash,
          salt,
        },
      });
    }
  }

  console.log(
    `Seeded: ${await prisma.inventory.count()} inventory items, ${await prisma.setting.count()} settings, ${await prisma.auth.count()} accounts.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
