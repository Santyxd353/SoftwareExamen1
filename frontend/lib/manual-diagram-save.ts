export type ManualDiagramSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ManualDiagramSaveOptions<TData, TResult> {
  data: TData;
  persist: (data: TData) => Promise<TResult>;
  onStatus: (status: ManualDiagramSaveStatus) => void;
}

export async function runManualDiagramSave<TData, TResult>({
  data,
  persist,
  onStatus,
}: ManualDiagramSaveOptions<TData, TResult>): Promise<TResult> {
  onStatus('saving');
  try {
    const result = await persist(data);
    onStatus('saved');
    return result;
  } catch (error) {
    onStatus('error');
    throw error;
  }
}
