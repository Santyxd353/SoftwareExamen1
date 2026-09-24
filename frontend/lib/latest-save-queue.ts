interface SaveWaiter<TResult> {
  resolve: (result: TResult) => void;
  reject: (error: unknown) => void;
}

interface PendingSave<TData, TResult> {
  data: TData;
  waiters: Array<SaveWaiter<TResult>>;
}

export function createLatestSaveQueue<TData, TResult>(
  persist: (data: TData) => Promise<TResult>,
) {
  let active = false;
  let queued: PendingSave<TData, TResult> | null = null;

  const run = async (request: PendingSave<TData, TResult>): Promise<void> => {
    active = true;
    try {
      const result = await persist(request.data);
      request.waiters.forEach(({ resolve }) => resolve(result));
    } catch (error) {
      request.waiters.forEach(({ reject }) => reject(error));
    } finally {
      const next = queued;
      queued = null;
      if (next) {
        void run(next);
      } else {
        active = false;
      }
    }
  };

  return {
    enqueue(data: TData): Promise<TResult> {
      return new Promise<TResult>((resolve, reject) => {
        if (!active) {
          void run({ data, waiters: [{ resolve, reject }] });
          return;
        }

        if (queued) {
          queued.data = data;
          queued.waiters.push({ resolve, reject });
          return;
        }

        queued = { data, waiters: [{ resolve, reject }] };
      });
    },
  };
}
