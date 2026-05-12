declare module 'bun:sqlite' {
  export class Database {
    constructor(filename: string);
    exec(sql: string): void;
    prepare<T = unknown>(sql: string): Statement<T>;
  }

  export class Statement<T = unknown> {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): T | undefined;
    all(...params: unknown[]): T[];
  }
}
