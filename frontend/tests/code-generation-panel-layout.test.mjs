import assert from 'node:assert/strict';
import test from 'node:test';

const panelLayout = await import('../lib/code-generation-panel-layout.ts').catch(
  () => ({}),
);

test('floating code generation panel stays inside the viewport and scrolls vertically', () => {
  const style = panelLayout.codeGenerationPanelViewportStyle?.();

  assert.deepEqual(style, {
    maxHeight: 'calc(100dvh - 6rem)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  });
});
