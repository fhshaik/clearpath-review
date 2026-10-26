import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  if (process.argv.includes("--if-configured") && !process.env.VERCEL) {
    console.log("Database migration skipped: DATABASE_URL is not configured locally.");
    process.exit(0);
  }
  throw new Error("Set DATABASE_URL to the Neon Postgres connection string before deployment.");
}
const sql = neon(process.env.DATABASE_URL);
const source = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = source.split(";").map(s => s.trim()).filter(Boolean);
try {
  await sql.transaction(statements.map(statement => sql.query(statement)));
  console.log("Database schema is ready.");
} catch {
  // Provider errors can contain connection details. Never print them.
  throw new Error("Database migration failed. Check DATABASE_URL and database access.");
}
