declare module 'bun:sqlite' {
  export class Database {
    constructor(filename: string);
    exec(sql: string): void;
    run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    query<T = unknown>(sql: string): Statement<T>;
    prepare<T = unknown>(sql: string): Statement<T>;
    close(): void;
  }

  export class Statement<T = unknown> {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: unknown[]): T | undefined;
    all(...params: unknown[]): T[];
  }
}
