export type SpeechInputError =
  | 'unsupported'
  | 'permission-denied'
  | 'no-speech'
  | 'network'
  | 'unknown';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly [index: number]: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionResultListLike {
  readonly [index: number]: SpeechRecognitionResultLike;
  length: number;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

export interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export interface BrowserSpeechRecognitionScope {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
}

interface BrowserSpeechInputOptions {
  scope: BrowserSpeechRecognitionScope;
  onTranscript: (transcript: string) => void;
  onListeningChange: (listening: boolean) => void;
  onError: (error: SpeechInputError) => void;
}

export interface BrowserSpeechInputController {
  readonly supported: boolean;
  start(locale: string): boolean;
  stop(): void;
  cancel(): void;
  dispose(): void;
}

export const normalizeSpeechRecognitionError = (error: string): SpeechInputError => {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'permission-denied';
  }
  if (error === 'no-speech') return 'no-speech';
  if (error === 'network') return 'network';
  return 'unknown';
};

const languageForLocale = (locale: string): string => (
  locale.toLowerCase().startsWith('es') ? 'es-BO' : 'en-US'
);

export const createBrowserSpeechInputController = ({
  scope,
  onTranscript,
  onListeningChange,
  onError,
}: BrowserSpeechInputOptions): BrowserSpeechInputController => {
  const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  let recognition: BrowserSpeechRecognition | null = null;
  let listening = false;

  const setListening = (next: boolean) => {
    if (listening === next) return;
    listening = next;
    onListeningChange(next);
  };

  const detach = (session: BrowserSpeechRecognition) => {
    session.onresult = null;
    session.onerror = null;
    session.onend = null;
    if (recognition === session) recognition = null;
  };

  const cancelSession = (notify: boolean) => {
    const session = recognition;
    if (!session) return;
    detach(session);
    session.abort();
    if (notify) setListening(false);
    else listening = false;
  };

  return {
    supported: Boolean(Recognition),
    start(locale: string) {
      if (!Recognition) {
        onError('unsupported');
        return false;
      }
      if (listening) return true;

      const session = new Recognition();
      recognition = session;
      session.lang = languageForLocale(locale);
      session.continuous = false;
      session.interimResults = true;
      session.onresult = (event) => {
        if (recognition !== session) return;
        let transcript = '';
        for (let index = 0; index < event.results.length; index += 1) {
          transcript += event.results[index]?.[0]?.transcript ?? '';
        }
        const normalized = transcript.trim();
        onTranscript(normalized);
      };
      session.onerror = (event) => {
        if (recognition !== session) return;
        const error = normalizeSpeechRecognitionError(event.error);
        detach(session);
        setListening(false);
        onError(error);
      };
      session.onend = () => {
        if (recognition !== session) return;
        detach(session);
        setListening(false);
      };

      try {
        session.start();
        setListening(true);
        return true;
      } catch {
        detach(session);
        setListening(false);
        onError('unknown');
        return false;
      }
    },
    stop() {
      if (recognition && listening) recognition.stop();
    },
    cancel() {
      cancelSession(true);
    },
    dispose() {
      cancelSession(false);
    },
  };
};
