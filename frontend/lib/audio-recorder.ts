export type AudioRecorderError = 'unsupported' | 'permission-denied' | 'unknown';

interface AudioTrackLike { stop(): void }
interface AudioStreamLike { getTracks(): AudioTrackLike[] }
interface AudioDataEventLike { data: Blob }

interface MediaRecorderLike {
  readonly mimeType: string;
  readonly state: string;
  ondataavailable: ((event: AudioDataEventLike) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  start(): void;
  stop(): void;
}

interface MediaRecorderConstructorLike {
  new(stream: AudioStreamLike, options?: { mimeType?: string }): MediaRecorderLike;
  isTypeSupported?(mimeType: string): boolean;
}

export interface AudioRecorderScope {
  navigator?: {
    mediaDevices?: {
      getUserMedia(constraints: { audio: boolean }): Promise<AudioStreamLike>;
    };
  };
  MediaRecorder?: MediaRecorderConstructorLike;
}

interface AudioRecorderOptions {
  scope: AudioRecorderScope;
  onAudio: (audio: Blob, signal: AbortSignal) => void;
  onRecordingChange: (recording: boolean) => void;
  onError: (error: AudioRecorderError) => void;
}

export interface AudioRecorderController {
  readonly supported: boolean;
  start(): Promise<boolean>;
  stop(): void;
  cancel(): void;
  dispose(): void;
}

const selectMimeType = (Recorder: MediaRecorderConstructorLike): string | undefined => {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => Recorder.isTypeSupported?.(type));
};

export const createAudioRecorderController = ({
  scope,
  onAudio,
  onRecordingChange,
  onError,
}: AudioRecorderOptions): AudioRecorderController => {
  const Recorder = scope.MediaRecorder;
  const getUserMedia = scope.navigator?.mediaDevices?.getUserMedia?.bind(scope.navigator.mediaDevices);
  let recorder: MediaRecorderLike | null = null;
  let stream: AudioStreamLike | null = null;
  let chunks: Blob[] = [];
  let discard = false;
  let recording = false;
  let generation = 0;
  let startPromise: Promise<boolean> | null = null;
  let transcriptionAbort: AbortController | null = null;
  let stopping = false;

  const setRecording = (next: boolean) => {
    if (recording === next) return;
    recording = next;
    onRecordingChange(next);
  };

  const release = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    recorder = null;
    chunks = [];
    stopping = false;
    setRecording(false);
  };

  const stopSession = (shouldDiscard: boolean) => {
    if (!recorder) return;
    if (shouldDiscard) discard = true;
    if (stopping) return;
    if (recorder.state !== 'inactive') {
      stopping = true;
      recorder.stop();
    } else {
      release();
    }
  };

  return {
    supported: Boolean(Recorder && getUserMedia),
    start() {
      if (!Recorder || !getUserMedia) {
        onError('unsupported');
        return Promise.resolve(false);
      }
      if (recording) return Promise.resolve(true);
      if (startPromise) return startPromise;

      const startGeneration = generation;
      startPromise = (async () => {
        try {
          const acquiredStream = await getUserMedia({ audio: true });
          if (generation !== startGeneration) {
            acquiredStream.getTracks().forEach((track) => track.stop());
            return false;
          }

          stream = acquiredStream;
          chunks = [];
          discard = false;
          const mimeType = selectMimeType(Recorder);
          const session = mimeType
            ? new Recorder(stream, { mimeType })
            : new Recorder(stream);
          recorder = session;
          session.ondataavailable = ({ data }) => {
            if (data.size > 0) chunks.push(data);
          };
          session.onstop = () => {
            if (recorder !== session) return;
            const audio = new Blob(chunks, { type: session.mimeType || 'audio/webm' });
            const shouldEmit = !discard && audio.size > 0;
            release();
            if (shouldEmit) {
              transcriptionAbort?.abort();
              transcriptionAbort = new AbortController();
              onAudio(audio, transcriptionAbort.signal);
            }
          };
          session.onerror = () => {
            if (recorder !== session) return;
            discard = true;
            release();
            onError('unknown');
          };
          session.start();
          setRecording(true);
          return true;
        } catch (error) {
          release();
          const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
          onError(name === 'NotAllowedError' || name === 'SecurityError' ? 'permission-denied' : 'unknown');
          return false;
        } finally {
          if (generation === startGeneration) startPromise = null;
        }
      })();
      return startPromise;
    },
    stop() { stopSession(false); },
    cancel() {
      generation += 1;
      startPromise = null;
      transcriptionAbort?.abort();
      transcriptionAbort = null;
      stopSession(true);
    },
    dispose() {
      generation += 1;
      startPromise = null;
      transcriptionAbort?.abort();
      transcriptionAbort = null;
      stopSession(true);
    },
  };
};
