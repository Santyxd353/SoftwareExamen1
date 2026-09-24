import assert from 'node:assert/strict';
import test from 'node:test';

const saveQueue = await import('../lib/latest-save-queue.ts').catch(
  () => ({}),
);

test('serializes persistence and coalesces queued snapshots to the newest state', async () => {
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const persisted = [];
  const queue = saveQueue.createLatestSaveQueue?.(async (data) => {
    persisted.push(data);
    if (data.revision === 1) await firstGate;
    return { version: data.revision };
  });

  const first = queue.enqueue({ revision: 1 });
  await Promise.resolve();
  const second = queue.enqueue({ revision: 2 });
  const third = queue.enqueue({ revision: 3 });

  assert.deepEqual(persisted, [{ revision: 1 }]);
  releaseFirst();

  assert.deepEqual(await first, { version: 1 });
  assert.deepEqual(await second, { version: 3 });
  assert.deepEqual(await third, { version: 3 });
  assert.deepEqual(persisted, [{ revision: 1 }, { revision: 3 }]);
});

test('continues with the newest queued snapshot after a failed save', async () => {
  const persisted = [];
  const queue = saveQueue.createLatestSaveQueue?.(async (data) => {
    persisted.push(data);
    if (data.revision === 1) throw new Error('first failed');
    return { version: data.revision };
  });

  const first = queue.enqueue({ revision: 1 });
  const second = queue.enqueue({ revision: 2 });

  await assert.rejects(first, /first failed/);
  assert.deepEqual(await second, { version: 2 });
  assert.deepEqual(persisted, [{ revision: 1 }, { revision: 2 }]);
});
