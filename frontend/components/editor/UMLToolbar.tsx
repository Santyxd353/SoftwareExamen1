'use client';

import React from 'react';
import {
  Plus,
  Save,
  Edit3,
  Download,
  Zap,
  Users,
  MessageCircle,
  Undo,
  Redo,
  Grid,
  ZoomIn,
  ZoomOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';
import type { ManualDiagramSaveStatus } from '@/lib/manual-diagram-save';

interface UMLToolbarProps {
  onAddClass: () => void;
  onSave: () => void;
  onEditClass: () => void;
  hasSelectedNode: boolean;
  isConnected: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onGenerateCode?: () => void;
  onOpenChat?: () => void;
  saveStatus: ManualDiagramSaveStatus;
}

export default function UMLToolbar({
  onAddClass,
  onSave,
  onEditClass,
  hasSelectedNode,
  isConnected,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onGenerateCode,
  onOpenChat,
  saveStatus,
}: UMLToolbarProps) {
  const { t } = useI18n();
  const saveLabel = saveStatus === 'saving'
    ? t('diagramEditor.actions.saving')
    : saveStatus === 'saved'
      ? t('diagramEditor.actions.saved')
      : saveStatus === 'error'
        ? t('diagramEditor.actions.saveFailed')
        : t('diagramEditor.actions.save');
  return (
    <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      {/* Sección Izquierda - Estado de Colaboración */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Users size={16} className={isConnected ? 'text-primary' : 'text-gray-400'} />
          <span className="text-sm text-gray-600">
            {isConnected ? t('diagramEditor.status.collaborating') : t('diagramEditor.status.disconnected')}
          </span>
        </div>
      </div>

      {/* Sección Central - Título */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-700">{t('diagramEditor.title')}</h1>
      </div>

      {/* Sección Derecha - Solo Guardar */}
      <div className="flex items-center space-x-1">
        <button
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          aria-busy={saveStatus === 'saving'}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:cursor-wait disabled:opacity-70"
          title={t('diagramEditor.actions.saveTitle')}
        >
          {saveStatus === 'saving' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : saveStatus === 'saved' ? (
            <CheckCircle2 size={16} />
          ) : saveStatus === 'error' ? (
            <AlertCircle size={16} />
          ) : (
            <Save size={16} />
          )}
          <span aria-live="polite">{saveLabel}</span>
        </button>
      </div>
    </div>
  );
}
