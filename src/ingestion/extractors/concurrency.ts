/**
 * Lightweight concurrency pool — runs at most `limit` async tasks at a time.
 * No external dependencies.
 */
export class ConcurrencyPool {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.running--;
    }
  }
}

/**
 * Run all tasks with at most `concurrency` running simultaneously.
 * Returns results in the same order as the input tasks array.
 */
export async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const pool = new ConcurrencyPool(concurrency);
  return Promise.allSettled(tasks.map((task) => pool.run(task)));
}
