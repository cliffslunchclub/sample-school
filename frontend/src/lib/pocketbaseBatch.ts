import pb from "./pocketbase";

export type BatchRequest = {
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  body?: Record<string, unknown>;
};

export type BatchProgress = { count: number; records?: number };
type BatchResponse<T> = { status: number; body: T };

export const MAX_BATCH_REQUESTS = 40;
const BATCH_INTERVAL_MS = 400;
let lastBatchRequestAt = 0;

export class BatchWriteError extends Error {
  constructor(message: string, readonly stage: string, readonly batchesCommitted: number, readonly recordsCommitted: number) {
    super(message);
    this.name = "BatchWriteError";
  }
}

/** Send record writes in small PocketBase transactions, paced for hosted limits. */
export async function sendBatchRequests<T>(
  requests: BatchRequest[],
  stage: string,
  progress: BatchProgress,
): Promise<T[]> {
  const results: T[] = [];
  for (let offset = 0; offset < requests.length; offset += MAX_BATCH_REQUESTS) {
    const chunk = requests.slice(offset, offset + MAX_BATCH_REQUESTS);
    try {
      let response: BatchResponse<T>[] | undefined;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const wait = BATCH_INTERVAL_MS - (Date.now() - lastBatchRequestAt);
          if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
          lastBatchRequestAt = Date.now();
          response = await pb.send<BatchResponse<T>[]>("/api/batch", {
            method: "POST",
            body: { requests: chunk },
            requestKey: null,
          });
          break;
        } catch (error) {
          const candidate = error as { status?: number; response?: { status?: number } };
          const status = candidate.status || candidate.response?.status;
          if (status !== 429 || attempt === 3) throw error;
          await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
        }
      }
      if (!Array.isArray(response) || response.length !== chunk.length || response.some((item) => item.status < 200 || item.status >= 300)) {
        throw new Error("PocketBase returned an incomplete batch response.");
      }
      results.push(...response.map((item) => item.body));
      progress.count++;
      progress.records = (progress.records || 0) + chunk.length;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown PocketBase error.";
      throw new BatchWriteError(`${stage} could not be saved. ${detail}`, stage, progress.count, progress.records || 0);
    }
  }
  return results;
}
