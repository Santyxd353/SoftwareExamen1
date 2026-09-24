import assert from 'node:assert/strict';
import test from 'node:test';

const collaboration = await import('../lib/durable-collaboration.ts').catch(
  () => ({}),
);

test('uses server-confirmed data after an automatic collaboration merge', () => {
  const submitted = { classes: [{ id: 'local' }], relations: [] };
  const merged = { classes: [{ id: 'local' }, { id: 'remote' }], relations: [] };

  const confirmed = collaboration.confirmedDiagramData?.(submitted, {
    autoMerged: true,
    data: merged,
  });

  assert.deepEqual(confirmed, merged);
});

test('uses the submitted snapshot after an ordinary acknowledgement', () => {
  const submitted = { classes: [{ id: 'local' }], relations: [] };

  const confirmed = collaboration.confirmedDiagramData?.(submitted, {
    autoMerged: false,
  });

  assert.deepEqual(confirmed, submitted);
});
