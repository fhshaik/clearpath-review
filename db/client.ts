import { neon } from "@neondatabase/serverless";
import { DomainError } from "../lib/domain";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new DomainError(
      "The workspace database is not connected. Please try again shortly.",
      503,
    );
  return neon(url);
}
export async function query<T = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await sql().query(text, values)) as T[];
}
export async function transaction(statements: Array<{ text: string; values: unknown[] }>) {
  const client = sql();
  return client.transaction(statements.map((s) => client.query(s.text, s.values)));
}
