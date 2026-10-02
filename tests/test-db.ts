import { PGlite } from "@electric-sql/pglite";
import { SCHEMA, type Db, type Row } from "@/lib/db";

/** A real, in-memory Postgres (PGlite) with the app's schema, behind the app's Db
 * interface. Each call returns a fresh, empty database. */
export async function testDb(): Promise<Db & { pg: PGlite }> {
  const pg = new PGlite();
  for (const statement of SCHEMA) await pg.query(statement);
  const query = async (text: string, params: unknown[] = []) =>
    (await pg.query<Row>(text, params)).rows;
  return {
    pg,
    query,
    sql: (strings, ...values) =>
      query(
        strings.reduce((text, part, i) => `${text}$${i}${part}`),
        values,
      ),
  };
}
