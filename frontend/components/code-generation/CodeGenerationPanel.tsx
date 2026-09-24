'use client';

import React, { useState } from 'react';
import { Download, Code, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { aiAPI, codeGenAPI } from '@/lib/api';
import { useI18n } from '@/components/i18n/I18nProvider';
import { refinementFiles, toggleRefinementFeature } from '@/lib/backend-refinement-selection';

interface CodeGenerationPanelProps {
  diagramId: string;
  diagramName: string;
  onClose: () => void;
}

export default function CodeGenerationPanel({ diagramId, diagramName, onClose }: CodeGenerationPanelProps) {
  const [isGeneratingBackend, setIsGeneratingBackend] = useState(false);
  const [isGeneratingFrontend, setIsGeneratingFrontend] = useState(false);
  const [backendResult, setBackendResult] = useState<any>(null);
  const [frontendResult, setFrontendResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [refinementInstruction, setRefinementInstruction] = useState('');
  const [refinementProposal, setRefinementProposal] = useState<any>(null);
  const [selectedRefinements, setSelectedRefinements] = useState<string[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const { t } = useI18n();

  const handleGenerateSpringBoot = async () => {
    setIsGeneratingBackend(true);
    setError(null);
    setBackendResult(null);

    try {
      const result = await codeGenAPI.generateSpringBoot(diagramId);

      if (result.success) {
        setBackendResult(result);
      } else {
        setError(result.error || t('generation.spring.error'));
      }
    } catch (error: any) {
      console.error('Code generation error:', error);
      setError(error.response?.data?.error || t('generation.spring.error'));
    } finally {
      setIsGeneratingBackend(false);
    }
  };

  const handleGenerateFlutter = async () => {
    setIsGeneratingFrontend(true);
    setError(null);
    setFrontendResult(null);

    try {
      const result = await codeGenAPI.generateFlutter(diagramId);

      if (result.success) {
        setFrontendResult(result);
      } else {
        setError(result.error || t('generation.flutter.error'));
      }
    } catch (error: any) {
      console.error('Flutter generation error:', error);
      setError(error.response?.data?.error || t('generation.flutter.error'));
    } finally {
      setIsGeneratingFrontend(false);
    }
  };

  const handleDownloadBackend = async () => {
    if (!backendResult?.generatedCodeId) return;

    try {
      const blob = await codeGenAPI.downloadProject(backendResult.generatedCodeId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${diagramName.toLowerCase().replace(/\s+/g, '-')}-springboot.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError(t('generation.spring.downloadError'));
    }
  };

  const handleDownloadFrontend = async () => {
    if (!frontendResult?.generatedCodeId) return;

    try {
      const blob = await codeGenAPI.downloadProject(frontendResult.generatedCodeId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${diagramName.toLowerCase().replace(/\s+/g, '-')}-flutter.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError(t('generation.flutter.downloadError'));
    }
  };

  const handleProposeRefinement = async () => {
    if (!refinementInstruction.trim()) return;
    setIsRefining(true);
    setError(null);
    try {
      const proposal = await aiAPI.proposeBackendRefinement(diagramId, refinementInstruction.trim());
      setRefinementProposal(proposal);
      setSelectedRefinements(proposal.changes.map((change: { feature: string }) => change.feature));
    } catch (error: any) {
      setError(error.response?.data?.message || t('generation.refinement.proposalError'));
    } finally {
      setIsRefining(false);
    }
  };

  const handleConfirmRefinement = async () => {
    if (!refinementProposal?.token || selectedRefinements.length === 0) return;
    setIsRefining(true);
    setError(null);
    try {
      const result = await aiAPI.confirmBackendRefinement(refinementProposal.token, selectedRefinements);
      setBackendResult(result);
      setRefinementProposal(null);
      setRefinementInstruction('');
    } catch (error: any) {
      setError(error.response?.data?.message || t('generation.refinement.confirmError'));
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-lg border border-border p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Code size={20} className="shrink-0 text-blue-600" />
          <h3 className="truncate text-lg font-semibold text-card-foreground">{t('generation.title')}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('diagramEditor.actions.closeCode')}
          title={t('diagramEditor.actions.closeCode')}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-6">
        {/* Backend Section - Spring Boot */}
        <div className="rounded-lg border border-border p-4">
          <h4 className="text-md mb-3 font-semibold text-card-foreground">{t('generation.spring.title')}</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('generation.spring.description')}
          </p>

          <button
            onClick={handleGenerateSpringBoot}
            disabled={isGeneratingBackend}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-md font-medium transition-colors ${
              isGeneratingBackend
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isGeneratingBackend ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('generation.spring.generating')}</span>
              </>
            ) : (
              <>
                <Code size={16} />
                <span>{t('generation.spring.generate')}</span>
              </>
            )}
          </button>

          {backendResult && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-3">
              <div className="flex items-start space-x-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-green-800 mb-1">
                    {t('generation.spring.success')}
                  </h5>
                  <p className="text-xs text-green-700 mb-3">{backendResult.message}</p>
                  <button
                    onClick={handleDownloadBackend}
                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download size={14} />
                    <span>{t('generation.spring.download')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 rounded-md bg-muted p-3">
            <p className="mb-1 text-xs font-medium text-foreground">{t('generation.includes')}</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              <li>• {t('generation.spring.featureData')}</li>
              <li>• {t('generation.spring.featureRest')}</li>
              <li>• {t('generation.spring.featureDatabase')}</li>
              <li>• {t('generation.spring.featureArtifacts')}</li>
            </ul>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <h5 className="mb-1 text-sm font-semibold text-card-foreground">
              {t('generation.refinement.title')}
            </h5>
            <p className="mb-2 text-xs text-muted-foreground">
              {t('generation.refinement.description')}
            </p>
            <textarea
              value={refinementInstruction}
              onChange={(event) => setRefinementInstruction(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={t('generation.refinement.placeholder')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleProposeRefinement}
              disabled={isRefining || !refinementInstruction.trim()}
              className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefining ? t('generation.refinement.processing') : t('generation.refinement.propose')}
            </button>

            {refinementProposal && (
              <div className="mt-3 rounded-md border border-primary/30 bg-primary/10 p-3">
                <p className="text-sm font-medium text-foreground">{refinementProposal.summary}</p>
                <fieldset className="mt-2 space-y-2 text-xs text-foreground">
                  <legend className="mb-1 font-semibold">{t('generation.refinement.selectChanges')}</legend>
                  {refinementProposal.changes.map((change: any) => (
                    <label key={change.feature} className="flex cursor-pointer gap-2 rounded border border-border bg-card p-2">
                      <input
                        type="checkbox"
                        checked={selectedRefinements.includes(change.feature)}
                        onChange={() => setSelectedRefinements((current) => toggleRefinementFeature(current, change.feature))}
                      />
                      <span>
                        <strong>{change.feature}</strong>: {change.rationale}
                        <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                          {refinementFiles(change.feature).join(', ')}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <ul className="mt-2 space-y-1 text-xs text-foreground">
                  {refinementProposal.warnings.map((warning: string) => (
                    <li key={warning} className="text-amber-700 dark:text-amber-300">• {warning}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('generation.refinement.confirmHint')}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleConfirmRefinement}
                    disabled={isRefining || selectedRefinements.length === 0}
                    className="flex-1 rounded-md bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {t('generation.refinement.apply')}
                  </button>
                  <button
                    onClick={() => setRefinementProposal(null)}
                    disabled={isRefining}
                    className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {t('generation.refinement.discard')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Frontend Section - Flutter */}
        <div className="rounded-lg border border-border p-4">
          <h4 className="text-md mb-3 font-semibold text-card-foreground">{t('generation.flutter.title')}</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('generation.flutter.description')}
          </p>

          <button
            onClick={handleGenerateFlutter}
            disabled={isGeneratingFrontend}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-md font-medium transition-colors ${
              isGeneratingFrontend
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {isGeneratingFrontend ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('generation.flutter.generating')}</span>
              </>
            ) : (
              <>
                <Code size={16} />
                <span>{t('generation.flutter.generate')}</span>
              </>
            )}
          </button>

          {frontendResult && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-3">
              <div className="flex items-start space-x-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-green-800 mb-1">
                    {t('generation.flutter.success')}
                  </h5>
                  <p className="text-xs text-green-700 mb-3">{frontendResult.message}</p>
                  <button
                    onClick={handleDownloadFrontend}
                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download size={14} />
                    <span>{t('generation.flutter.download')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 rounded-md bg-muted p-3">
            <p className="mb-1 text-xs font-medium text-foreground">{t('generation.includes')}</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              <li>• {t('generation.flutter.featureCrud')}</li>
              <li>• {t('generation.flutter.featureMaterial')}</li>
              <li>• {t('generation.flutter.featureApi')}</li>
            </ul>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800 mb-1">
                  {t('generation.error')}
                </h4>
                <p className="text-xs text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
