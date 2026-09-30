const MAX_RPM = parseInt(process.env.LLM_MAX_RPM || "8", 10);
const INTERVAL_MS = 60000 / MAX_RPM;

interface QueuedTask<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queue: QueuedTask<any>[] = [];
let processing = false;
let lastCallTime = 0;

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const task = queue.shift()!;
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall < INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS - timeSinceLastCall));
    }

    lastCallTime = Date.now();

    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (err) {
      task.reject(err);
    }
  }

  processing = false;
}

export function enqueueLLMCall<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    processQueue();
  });
}

export function getQueueLength(): number {
  return queue.length;
}
