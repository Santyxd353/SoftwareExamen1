import type { CSSProperties } from 'react';

export function codeGenerationPanelViewportStyle(): CSSProperties {
  return {
    maxHeight: 'calc(100dvh - 6rem)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  };
}
