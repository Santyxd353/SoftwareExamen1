import assert from 'node:assert/strict';
import test from 'node:test';

const speech = await import('../lib/speech-input.ts').catch(() => ({}));

class FakeRecognition {
  static instances = [];

  constructor() {
    this.lang = '';
    this.continuous = true;
    this.interimResults = false;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.started = false;
    this.stopped = false;
    this.aborted = false;
    FakeRecognition.instances.push(this);
  }

  start() {
    this.started = true;
  }

  stop() {
    this.stopped = true;
    this.onend?.();
  }

  abort() {
    this.aborted = true;
  }

  emitTranscript(transcript) {
    this.onresult?.({
      resultIndex: 0,
      results: [{ 0: { transcript }, isFinal: true }],
    });
  }

  emitResults(transcripts, resultIndex) {
    this.onresult?.({
      resultIndex,
      results: transcripts.map((transcript) => ({
        0: { transcript },
        isFinal: true,
      })),
    });
  }

  emitError(error) {
    this.onerror?.({ error });
  }
}

test('reports unsupported browsers without attempting to listen', () => {
  const errors = [];
  const controller = speech.createBrowserSpeechInputController?.({
    scope: {},
    onTranscript: () => {},
    onListeningChange: () => {},
    onError: (error) => errors.push(error),
  });

  assert.equal(controller?.supported, false);
  assert.equal(controller?.start('es'), false);
  assert.deepEqual(errors, ['unsupported']);
});

test('transcribes Spanish speech and reports the listening lifecycle', () => {
  FakeRecognition.instances = [];
  const transcripts = [];
  const states = [];
  const controller = speech.createBrowserSpeechInputController?.({
    scope: { webkitSpeechRecognition: FakeRecognition },
    onTranscript: (transcript) => transcripts.push(transcript),
    onListeningChange: (listening) => states.push(listening),
    onError: () => {},
  });

  assert.equal(controller?.supported, true);
  assert.equal(controller?.start('es'), true);

  const recognition = FakeRecognition.instances[0];
  assert.equal(recognition.lang, 'es-BO');
  assert.equal(recognition.continuous, false);
  assert.equal(recognition.interimResults, true);
  assert.equal(recognition.started, true);

  recognition.emitTranscript('crea una clase producto');
  assert.deepEqual(transcripts, ['crea una clase producto']);

  controller.stop();
  assert.equal(recognition.stopped, true);
  assert.deepEqual(states, [true, false]);
});

test('normalizes permission, silence and network recognition errors', () => {
  assert.equal(speech.normalizeSpeechRecognitionError?.('not-allowed'), 'permission-denied');
  assert.equal(speech.normalizeSpeechRecognitionError?.('service-not-allowed'), 'permission-denied');
  assert.equal(speech.normalizeSpeechRecognitionError?.('no-speech'), 'no-speech');
  assert.equal(speech.normalizeSpeechRecognitionError?.('network'), 'network');
  assert.equal(speech.normalizeSpeechRecognitionError?.('audio-capture'), 'unknown');
});

test('preserves earlier final words when a later recognition result changes', () => {
  FakeRecognition.instances = [];
  const transcripts = [];
  const controller = speech.createBrowserSpeechInputController?.({
    scope: { SpeechRecognition: FakeRecognition },
    onTranscript: (transcript) => transcripts.push(transcript),
    onListeningChange: () => {},
    onError: () => {},
  });

  controller.start('es');
  FakeRecognition.instances[0].emitResults(
    ['crea una clase', ' producto con precio'],
    1,
  );

  assert.deepEqual(transcripts, ['crea una clase producto con precio']);
});

test('removes a provisional transcript when recognition retracts all results', () => {
  FakeRecognition.instances = [];
  const transcripts = [];
  const controller = speech.createBrowserSpeechInputController?.({
    scope: { SpeechRecognition: FakeRecognition },
    onTranscript: (transcript) => transcripts.push(transcript),
    onListeningChange: () => {},
    onError: () => {},
  });

  controller.start('es');
  const recognition = FakeRecognition.instances[0];
  recognition.emitResults(['texto provisional'], 0);
  recognition.emitResults([], 0);

  assert.deepEqual(transcripts, ['texto provisional', '']);
});

test('uses English recognition and aborts active resources on disposal', () => {
  FakeRecognition.instances = [];
  const controller = speech.createBrowserSpeechInputController?.({
    scope: { SpeechRecognition: FakeRecognition },
    onTranscript: () => {},
    onListeningChange: () => {},
    onError: () => {},
  });

  controller.start('en');
  const recognition = FakeRecognition.instances[0];
  assert.equal(recognition.lang, 'en-US');

  controller.dispose();
  assert.equal(recognition.aborted, true);
  assert.equal(recognition.onresult, null);
  assert.equal(recognition.onerror, null);
  assert.equal(recognition.onend, null);
});

test('cancels an active session without accepting a late transcript', () => {
  FakeRecognition.instances = [];
  const transcripts = [];
  const states = [];
  const controller = speech.createBrowserSpeechInputController?.({
    scope: { SpeechRecognition: FakeRecognition },
    onTranscript: (transcript) => transcripts.push(transcript),
    onListeningChange: (listening) => states.push(listening),
    onError: () => {},
  });

  controller.start('es');
  const recognition = FakeRecognition.instances[0];
  const lateResult = recognition.onresult;
  controller.cancel();
  lateResult?.({
    resultIndex: 0,
    results: [{ 0: { transcript: 'texto tardío' }, isFinal: true }],
  });

  assert.equal(recognition.aborted, true);
  assert.deepEqual(transcripts, []);
  assert.deepEqual(states, [true, false]);
});

test('ignores callbacks from a failed session after listening restarts', () => {
  FakeRecognition.instances = [];
  const transcripts = [];
  const states = [];
  const errors = [];
  const controller = speech.createBrowserSpeechInputController?.({
    scope: { SpeechRecognition: FakeRecognition },
    onTranscript: (transcript) => transcripts.push(transcript),
    onListeningChange: (listening) => states.push(listening),
    onError: (error) => errors.push(error),
  });

  controller.start('es');
  const failedRecognition = FakeRecognition.instances[0];
  const staleResult = failedRecognition.onresult;
  const staleEnd = failedRecognition.onend;
  failedRecognition.emitError('network');
  controller.start('es');

  staleResult?.({
    resultIndex: 0,
    results: [{ 0: { transcript: 'sesión anterior' }, isFinal: true }],
  });
  staleEnd?.();

  assert.deepEqual(errors, ['network']);
  assert.deepEqual(transcripts, []);
  assert.deepEqual(states, [true, false, true]);
});
