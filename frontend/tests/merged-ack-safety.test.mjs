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

test('keeps the previous baseline after an automatic merge until the editor is synchronized', () => {
  const previous = {
    version: 4,
    data: { classes: [{ id: 'base' }], relations: [] },
  };
  const submitted = { classes: [{ id: 'base' }, { id: 'local' }], relations: [] };
  const merged = {
    classes: [{ id: 'base' }, { id: 'local' }, { id: 'remote' }],
    relations: [],
  };

  const baseline = collaboration.nextCollaborationBaseline?.(
    previous,
    submitted,
    { version: 5, autoMerged: true, data: merged },
  );

  assert.deepEqual(baseline, previous);
});

test('advances the baseline after an ordinary acknowledgement', () => {
  const previous = {
    version: 4,
    data: { classes: [{ id: 'base' }], relations: [] },
  };
  const submitted = { classes: [{ id: 'base' }, { id: 'local' }], relations: [] };

  const baseline = collaboration.nextCollaborationBaseline?.(
    previous,
    submitted,
    { version: 5, autoMerged: false },
  );

  assert.deepEqual(baseline, { version: 5, data: submitted });
});
