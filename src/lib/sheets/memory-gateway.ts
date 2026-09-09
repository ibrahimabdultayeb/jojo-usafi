import type { CellUpdate, SheetGateway } from "./google";
import { GoogleUnavailable } from "./google";

/**
 * A spreadsheet in memory, behaving the way Google's does.
 *
 * This is how the whole sync engine is exercised without touching Ibrahim's
 * real Product Master — the brief's requirement that conflict behaviour be
 * proved on a safe fixture rather than on the live catalogue. It is also how
 * "Google is down" is tested, which cannot be arranged on demand with the real
 * thing.
 *
 * It is deliberately as literal-minded as the real gateway: cells are addressed
 * by 1-based row and 0-based column, writes land one cell at a time, and a row
 * that does not exist yet is grown rather than rejected.
 */
export class MemorySheet implements SheetGateway {
  readonly describe = "in-memory sheet";
  private grid: (string | number | boolean | null)[][];

  /** Set to make every call fail, the way an outage does. */
  failWith: string | null = null;

  /** Every batch write this sheet received, for asserting call counts. */
  readonly writes: CellUpdate[][] = [];
  reads = 0;

  constructor(grid: (string | number | boolean | null)[][]) {
    this.grid = grid.map((row) => [...row]);
  }

  private guard(): void {
    if (this.failWith) throw new GoogleUnavailable(this.failWith);
  }

  async readGrid(): Promise<(string | number | boolean | null)[][]> {
    this.guard();
    this.reads += 1;
    return this.grid.map((row) => [...row]);
  }

  async writeCells(updates: readonly CellUpdate[]): Promise<void> {
    this.guard();
    if (updates.length === 0) return;
    this.writes.push([...updates]);

    for (const update of updates) {
      const rowIndex = update.row - 1;
      while (this.grid.length <= rowIndex) this.grid.push([]);
      const row = this.grid[rowIndex];
      while (row.length <= update.column) row.push("");
      row[update.column] = update.value;
    }
  }

  async appendHeaders(headers: readonly string[], afterColumnCount: number): Promise<void> {
    await this.writeCells(
      headers.map((header, index) => ({ row: 1, column: afterColumnCount + index, value: header })),
    );
  }

  /** The current contents, for asserting what the database wrote back. */
  snapshot(): (string | number | boolean | null)[][] {
    return this.grid.map((row) => [...row]);
  }

  /** One cell by header name and row number, the way a person would look. */
  cell(header: string, row: number): string | number | boolean | null {
    const column = (this.grid[0] ?? []).findIndex(
      (h) => String(h ?? "").trim().toUpperCase() === header.trim().toUpperCase(),
    );
    if (column < 0) return null;
    return this.grid[row - 1]?.[column] ?? null;
  }

  /** Set one cell, the way an operator editing the sheet would. */
  edit(header: string, row: number, value: string | number): void {
    const column = (this.grid[0] ?? []).findIndex(
      (h) => String(h ?? "").trim().toUpperCase() === header.trim().toUpperCase(),
    );
    if (column < 0) throw new Error(`No column named ${header}`);
    while (this.grid.length < row) this.grid.push([]);
    const target = this.grid[row - 1];
    while (target.length <= column) target.push("");
    target[column] = value;
  }

  /** Remove a row entirely, the way deleting a row in the sheet does. */
  removeRow(row: number): void {
    this.grid.splice(row - 1, 1);
  }

  /** The number of cells written across every batch. */
  get cellsWritten(): number {
    return this.writes.reduce((total, batch) => total + batch.length, 0);
  }
}
