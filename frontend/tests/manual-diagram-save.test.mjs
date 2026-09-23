import assert from 'node:assert/strict';
import test from 'node:test';

const manualSave = await import('../lib/manual-diagram-save.ts').catch(
  () => ({}),
);

test('manual save awaits persistence and reports visible progress', async () => {
  const statuses = [];
  const data = { classes: [{ id: 'class-1' }], relations: [] };

  const result = await manualSave.runManualDiagramSave?.({
    data,
    persist: async (snapshot) => ({
      id: 'diagram-1',
      version: snapshot.classes.length + 4,
    }),
    onStatus: (status) => statuses.push(status),
  });

  assert.deepEqual(result, {
    id: 'diagram-1',
    version: 5,
  });
  assert.deepEqual(statuses, ['saving', 'saved']);
});

test('manual save reports an error and preserves the rejection', async () => {
  const statuses = [];
  const failure = new Error('network unavailable');

  await assert.rejects(
    () => manualSave.runManualDiagramSave?.({
      data: { classes: [], relations: [] },
      persist: async () => { throw failure; },
      onStatus: (status) => statuses.push(status),
    }),
    failure,
  );

  assert.deepEqual(statuses, ['saving', 'error']);
});
