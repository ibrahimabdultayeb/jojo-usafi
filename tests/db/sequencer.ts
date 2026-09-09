/**
 * Run the database test files in the order their names give.
 *
 * Vitest's default sequencer sorts by file size, largest first, which is the
 * right choice when files are independent — it keeps workers busy. These are
 * not independent: there is one development database, `fileParallelism` is off,
 * and 02 proves the first-Owner bootstrap, which can only be proved in a shop
 * that does not yet have an Owner.
 *
 * With the default sequencer the largest file (03, the RLS suite) ran first,
 * created an Owner so it had one to sign in as, and 02 then found the seat
 * already taken. The failure was real and the test was right; the order was
 * wrong.
 *
 * So the numbers in the filenames mean what they look like they mean:
 *
 *   01  the schema enforces itself
 *   02  Auth, the roles, and the one-time bootstrap
 *   03  Row Level Security, as four callers
 *   04  Storage
 */

interface Sortable {
  moduleId: string;
}

export default class NamedOrderSequencer {
  async shard<T extends Sortable>(files: T[]): Promise<T[]> {
    return files;
  }

  async sort<T extends Sortable>(files: T[]): Promise<T[]> {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
}
