import assert from 'node:assert/strict';
import test from 'node:test';

const recorder = await import('../lib/audio-recorder.ts').catch(() => ({}));

class FakeMediaRecorder {
  static instances = [];

  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = options?.mimeType || 'audio/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
    FakeMediaRecorder.instances.push(this);
  }

  start() { this.state = 'recording'; }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) });
    this.onstop?.();
  }

  emitError() { this.onerror?.({}); }
}

test('records audio, stops microphone tracks, and emits one blob', async () => {
  FakeMediaRecorder.instances = [];
  let trackStopped = false;
  const stream = { getTracks: () => [{ stop: () => { trackStopped = true; } }] };
  const blobs = [];
  const states = [];
  const controller = recorder.createAudioRecorderController?.({
    scope: {
      navigator: { mediaDevices: { getUserMedia: async () => stream } },
      MediaRecorder: FakeMediaRecorder,
    },
    onAudio: (blob) => blobs.push(blob),
    onRecordingChange: (value) => states.push(value),
    onError: () => {},
  });

  assert.equal(await controller.start(), true);
  controller.stop();

  assert.equal(trackStopped, true);
  assert.equal(blobs.length, 1);
  assert.equal(blobs[0].type, 'audio/webm');
  assert.deepEqual(states, [true, false]);
});

test('reports denied microphone permission without entering recording state', async () => {
  const errors = [];
  const controller = recorder.createAudioRecorderController?.({
    scope: {
      navigator: { mediaDevices: { getUserMedia: async () => { throw { name: 'NotAllowedError' }; } } },
      MediaRecorder: FakeMediaRecorder,
    },
    onAudio: () => {},
    onRecordingChange: () => {},
    onError: (error) => errors.push(error),
  });

  assert.equal(await controller.start(), false);
  assert.deepEqual(errors, ['permission-denied']);
});

test('cancel stops resources without submitting captured audio', async () => {
  FakeMediaRecorder.instances = [];
  let trackStopped = false;
  const blobs = [];
  const controller = recorder.createAudioRecorderController?.({
    scope: {
      navigator: {
        mediaDevices: {
          getUserMedia: async () => ({ getTracks: () => [{ stop: () => { trackStopped = true; } }] }),
        },
      },
      MediaRecorder: FakeMediaRecorder,
    },
    onAudio: (blob) => blobs.push(blob),
    onRecordingChange: () => {},
    onError: () => {},
  });

  await controller.start();
  controller.cancel();

  assert.equal(trackStopped, true);
  assert.deepEqual(blobs, []);
});

test('cancel during permission request releases the late stream without recording', async () => {
  FakeMediaRecorder.instances = [];
  let resolvePermission;
  let trackStopped = false;
  const permission = new Promise((resolve) => { resolvePermission = resolve; });
  const controller = recorder.createAudioRecorderController?.({
    scope: {
      navigator: { mediaDevices: { getUserMedia: () => permission } },
      MediaRecorder: FakeMediaRecorder,
    },
    onAudio: () => {},
    onRecordingChange: () => {},
    onError: () => {},
  });

  const started = controller.start();
  controller.cancel();
  resolvePermission({ getTracks: () => [{ stop: () => { trackStopped = true; } }] });

  assert.equal(await started, false);
  assert.equal(trackStopped, true);
  assert.equal(FakeMediaRecorder.instances.length, 0);
});

test('parallel starts share one permission request and create one recorder', async () => {
  FakeMediaRecorder.instances = [];
  let resolvePermission;
  let permissionRequests = 0;
  const permission = new Promise((resolve) => { resolvePermission = resolve; });
  const controller = recorder.createAudioRecorderController?.({
    scope: {
      navigator: {
        mediaDevices: {
          getUserMedia: () => {
            permissionRequests += 1;
            return permission;
          },
        },
      },
      MediaRecorder: FakeMediaRecorder,
    },
    onAudio: () => {},
    onRecordingChange: () => {},
    onError: () => {},
  });

  const first = controller.start();
  const second = controller.start();
  resolvePermission({ getTracks: () => [{ stop: () => {} }] });

  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(permissionRequests, 1);
  assert.equal(FakeMediaRecorder.instances.length, 1);
  controller.cancel();
});

test('lets the browser choose MP4 when WebM and Ogg are unsupported', async () => {
  const blobs = [];
  let receivedOptions = 'unset';
  class Mp4Recorder extends FakeMediaRecorder {
    static isTypeSupported() { return false; }
    constructor(stream, options) {
      super(stream, options);
      receivedOptions = options;
      this.mimeType = 'audio/mp4';
    }
  }
  const controller = recorder.createAudioRecorderController?.({
    scope: {
      navigator: {
        mediaDevices: {
          getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }),
        },
      },
      MediaRecorder: Mp4Recorder,
    },
    onAudio: (blob) => blobs.push(blob),
    onRecordingChange: () => {},
    onError: () => {},
  });

  await controller.start();
  controller.stop();

  assert.equal(receivedOptions, undefined);
  assert.equal(blobs[0].type, 'audio/mp4');
});

test('capture errors release the microphone and report failure without audio', async () => {
  FakeMediaRecorder.instances = [];
  let trackStopped = false;
  const errors = [];
  const blobs = [];
  const states = [];
  const controller = recorder.createAudioRecorderController?.({
    scope: {
      navigator: {
        mediaDevices: {
          getUserMedia: async () => ({ getTracks: () => [{ stop: () => { trackStopped = true; } }] }),
        },
      },
      MediaRecorder: FakeMediaRecorder,
    },
    onAudio: (blob) => blobs.push(blob),
    onRecordingChange: (value) => states.push(value),
    onError: (error) => errors.push(error),
  });

  await controller.start();
  FakeMediaRecorder.instances[0].emitError();

  assert.equal(trackStopped, true);
  assert.deepEqual(blobs, []);
  assert.deepEqual(errors, ['unknown']);
  assert.deepEqual(states, [true, false]);
});

test('dispose aborts transcription started from recorded audio', async () => {
  FakeMediaRecorder.instances = [];
  let transcriptionSignal;
  const controller = recorder.createAudioRecorderController?.({
    scope: {
      navigator: {
        mediaDevices: {
          getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }),
        },
      },
      MediaRecorder: FakeMediaRecorder,
    },
    onAudio: (_blob, signal) => { transcriptionSignal = signal; },
    onRecordingChange: () => {},
    onError: () => {},
  });

  await controller.start();
  controller.stop();
  assert.equal(transcriptionSignal.aborted, false);

  controller.dispose();
  assert.equal(transcriptionSignal.aborted, true);
});

test('repeated stop stays idempotent while recorder awaits its stop event', async () => {
  const blobs = [];
  class AsyncStopRecorder extends FakeMediaRecorder {
    stop() { this.state = 'inactive'; }
    flushStop() {
      this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  const controller = recorder.createAudioRecorderController?.({
    scope: {
      navigator: {
        mediaDevices: {
          getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }),
        },
      },
      MediaRecorder: AsyncStopRecorder,
    },
    onAudio: (blob) => blobs.push(blob),
    onRecordingChange: () => {},
    onError: () => {},
  });

  await controller.start();
  controller.stop();
  controller.stop();
  assert.equal(blobs.length, 0);

  FakeMediaRecorder.instances.at(-1).flushStop();
  assert.equal(blobs.length, 1);
});
