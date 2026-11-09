/**
 * App database schema (PostgreSQL via Drizzle).
 *
 * Add your tables below, then run:
 *   npm run db:generate   # emits SQL migration into ./drizzle
 *   npm run db:migrate    # applies it to the app database
 *
 * Rules:
 * - Every user-owned table gets `owner_user_id: ownerUserId()` plus an index
 *   on it, and is accessed through `scopedRepo` (see lyzr-architect-pg docs).
 * - Never edit generated SQL in ./drizzle by hand.
 */
export { users } from "lyzr-architect-pg/schema";

// Example table (remove when adding real ones):
//
// import { pgTable, text, boolean, index, timestamps, ownerUserId, generateId } from "lyzr-architect-pg/schema";
//
// export const todos = pgTable(
//   "todos",
//   {
//     id: text("id").primaryKey().$defaultFn(() => generateId()),
//     title: text("title").notNull(),
//     done: boolean("done").notNull().default(false),
//     owner_user_id: ownerUserId(),
//     ...timestamps,
//   },
//   (t) => [index("todos_owner_idx").on(t.owner_user_id)]
// );
