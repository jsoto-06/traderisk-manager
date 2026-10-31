'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Star,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import type { JournalEntry, EmotionalState } from '@/lib/types';
import { formatDate } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export default function JournalPage() {
  const { locale, t } = useLocale();
  const {
    activeAccount,
    accounts,
    journal,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
  } = useStorage();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('all');

  // Form State
  const [formAccountId, setFormAccountId] = useState(activeAccount?.id || '');
  const [emotionalState, setEmotionalState] = useState<EmotionalState>('calm');
  const [entryReason, setEntryReason] = useState('');
  const [planCompliance, setPlanCompliance] = useState(true);
  const [overtrading, setOvertrading] = useState(false);
  const [errors, setErrors] = useState('');
  const [observations, setObservations] = useState('');
  const [discipline, setDiscipline] = useState<1 | 2 | 3 | 4 | 5>(5);

  const openNewModal = () => {
    setEditingEntry(null);
    setFormAccountId(activeAccount?.id || accounts[0]?.id || '');
    setEmotionalState('calm');
    setEntryReason('');
    setPlanCompliance(true);
    setOvertrading(false);
    setErrors('');
    setObservations('');
    setDiscipline(5);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setFormAccountId(entry.accountId);
    setEmotionalState(entry.emotionalState);
    setEntryReason(entry.entryReason);
    setPlanCompliance(entry.planCompliance);
    setOvertrading(entry.overtrading);
    setErrors(entry.errors);
    setObservations(entry.observations);
    setDiscipline(entry.discipline);
    setIsModalOpen(true);
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryReason.trim()) {
      alert('La razón de entrada o contexto es obligatorio');
      return;
    }

    if (editingEntry) {
      updateJournalEntry({
        ...editingEntry,
        accountId: formAccountId,
        emotionalState,
        entryReason: entryReason.trim(),
        planCompliance,
        overtrading,
        errors: errors.trim(),
        observations: observations.trim(),
        discipline,
      });
    } else {
      addJournalEntry({
        accountId: formAccountId || activeAccount?.id || accounts[0]?.id || '',
        date: new Date().toISOString(),
        emotionalState,
        entryReason: entryReason.trim(),
        planCompliance,
        overtrading,
        errors: errors.trim(),
        observations: observations.trim(),
        discipline,
      });
    }

    setIsModalOpen(false);
  };

  const filteredEntries = journal.filter((entry) => {
    if (selectedAccountId !== 'all' && entry.accountId !== selectedAccountId) {
      return false;
    }
    return true;
  });

  const emotionDetails: Record<
    EmotionalState,
    { label: string; emoji: string; color: 'cyan' | 'green' | 'yellow' | 'red' | 'purple' | 'blue' }
  > = {
    calm: { label: 'Calmado / Enfocado', emoji: '😌', color: 'cyan' },
    confident: { label: 'Seguro / Certero', emoji: '😎', color: 'green' },
    anxious: { label: 'Ansioso / Con Prisa', emoji: '😰', color: 'yellow' },
    fearful: { label: 'Temeroso / Dudoso', emoji: '😨', color: 'red' },
    euphoric: { label: 'Eufórico / Exaltado', emoji: '🚀', color: 'purple' },
    frustrated: { label: 'Frustrado / Molesto', emoji: '😤', color: 'red' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F7FA] flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-[#00F0FF]" />
            {t.journal.title}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Bitácora psicológica, control de impulsos emocionales y auditoría de disciplina
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="py-1 text-xs"
          >
            <option value="all">Todas las cuentas</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </Select>

          <Button
            onClick={openNewModal}
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Nueva Entrada
          </Button>
        </div>
      </div>

      {/* Psychology Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4" noPadding>
          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-[#00F0FF]/15 border border-[#00F0FF]/30 rounded-xl text-[#00F0FF]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-[#94A3B8] block">Total Reflexiones</span>
              <span className="text-xl font-bold text-[#F5F7FA]">
                {filteredEntries.length} entradas
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4" noPadding>
          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-[#10B981]/15 border border-[#10B981]/30 rounded-xl text-[#10B981]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-[#94A3B8] block">Cumplimiento del Plan</span>
              <span className="text-xl font-bold text-[#10B981]">
                {filteredEntries.length > 0
                  ? `${(
                      (filteredEntries.filter((e) => e.planCompliance).length /
                        filteredEntries.length) *
                      100
                    ).toFixed(0)}%`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4" noPadding>
          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-[#EF4444]/15 border border-[#EF4444]/30 rounded-xl text-[#EF4444]">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-[#94A3B8] block">Casos de Sobreoperar</span>
              <span className="text-xl font-bold text-[#EF4444]">
                {filteredEntries.filter((e) => e.overtrading).length} sesión(es)
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Entries List */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <Card className="text-center py-12">
            <BookOpen className="w-10 h-10 text-[#94A3B8] mx-auto mb-3 opacity-40" />
            <h4 className="text-base font-semibold text-[#F5F7FA]">
              No hay entradas en el diario
            </h4>
            <p className="text-xs text-[#94A3B8] mt-1 max-w-md mx-auto">
              Registra tu primera sesión psicológica para mantener el control sobre tus
              decisiones operativas y evitar el autosabotaje.
            </p>
            <Button
              onClick={openNewModal}
              variant="outline"
              size="sm"
              className="mt-4"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Crear Entrada Inicial
            </Button>
          </Card>
        ) : (
          filteredEntries.map((entry) => {
            const emotion = emotionDetails[entry.emotionalState] || emotionDetails.calm;
            return (
              <Card key={entry.id} className="relative overflow-hidden">
                <div className="space-y-4">
                  {/* Top bar of entry */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1E2D4A]/60">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-lg">{emotion.emoji}</span>
                      <Badge variant={emotion.color} size="md">
                        {emotion.label}
                      </Badge>

                      <Badge
                        variant={entry.planCompliance ? 'green' : 'red'}
                        size="sm"
                      >
                        {entry.planCompliance ? 'Siguió el Plan' : 'Plan Roto'}
                      </Badge>

                      {entry.overtrading && (
                        <Badge variant="red" size="sm">
                          Sobreoperó
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Discipline stars */}
                      <div className="flex items-center gap-1 text-[#F59E0B]">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= entry.discipline
                                ? 'fill-[#F59E0B] text-[#F59E0B]'
                                : 'text-[#1E2D4A]'
                            }`}
                          />
                        ))}
                      </div>

                      <span className="text-xs text-[#94A3B8] font-mono">
                        {formatDate(entry.date, locale)}
                      </span>

                      <div className="flex items-center gap-1 pl-2 border-l border-[#1E2D4A]">
                        <button
                          onClick={() => openEditModal(entry)}
                          className="p-1 text-[#94A3B8] hover:text-[#00F0FF] rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(entry.id)}
                          className="p-1 text-[#94A3B8] hover:text-[#EF4444] rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <span className="font-semibold text-[#F5F7FA] block mb-0.5">
                        Motivo / Contexto de la Decisión:
                      </span>
                      <p className="text-[#94A3B8] leading-relaxed bg-[#0A1128]/50 p-2.5 rounded-lg border border-[#1E2D4A]/50">
                        {entry.entryReason}
                      </p>
                    </div>

                    {entry.errors && (
                      <div>
                        <span className="font-semibold text-[#EF4444] block mb-0.5">
                          Errores Detectados:
                        </span>
                        <p className="text-[#EF4444]/90 leading-relaxed bg-[#EF4444]/5 p-2.5 rounded-lg border border-[#EF4444]/20">
                          {entry.errors}
                        </p>
                      </div>
                    )}

                    {entry.observations && (
                      <div>
                        <span className="font-semibold text-[#00F0FF] block mb-0.5">
                          Observaciones & Aprendizajes:
                        </span>
                        <p className="text-[#94A3B8] leading-relaxed bg-[#0A1128]/50 p-2.5 rounded-lg border border-[#1E2D4A]/50">
                          {entry.observations}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal: Formulario Nueva / Editar Entrada */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEntry ? 'Editar Entrada del Diario' : 'Nueva Entrada Psicológica'}
        subtitle="Monitorea tus estados mentales y mantén la disciplina operativa"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveEntry}>
              Guardar en Diario
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveEntry} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Cuenta Asociada"
              value={formAccountId}
              onChange={(e) => setFormAccountId(e.target.value)}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </Select>

            <Select
              label="Estado Emocional"
              value={emotionalState}
              onChange={(e) => setEmotionalState(e.target.value as EmotionalState)}
            >
              <option value="calm">😌 Calmado / Enfocado</option>
              <option value="confident">😎 Seguro / Optimista</option>
              <option value="anxious">😰 Ansioso / Con Prisa</option>
              <option value="fearful">😨 Temeroso / Dudoso</option>
              <option value="euphoric">🚀 Eufórico / Exaltado</option>
              <option value="frustrated">😤 Frustrado / Molesto</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#94A3B8]">
              Nivel de Disciplina (1 = Caótico, 5 = Impecable)
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  type="button"
                  key={level}
                  onClick={() => setDiscipline(level as 1 | 2 | 3 | 4 | 5)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition-all ${
                    discipline === level
                      ? 'bg-[#00F0FF] text-[#0A1128] border-[#00F0FF] shadow-md'
                      : 'bg-[#0A1128] text-[#94A3B8] border-[#1E2D4A] hover:border-[#00F0FF]/40'
                  }`}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      discipline === level ? 'fill-[#0A1128]' : ''
                    }`}
                  />
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-[#0A1128] border border-[#1E2D4A] rounded-xl text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={planCompliance}
                onChange={(e) => setPlanCompliance(e.target.checked)}
                className="rounded border-[#1E2D4A] text-[#00F0FF] focus:ring-0 w-4 h-4"
              />
              <span className="text-[#F5F7FA]">¿Cumpliste tu plan al 100%?</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overtrading}
                onChange={(e) => setOvertrading(e.target.checked)}
                className="rounded border-[#1E2D4A] text-[#EF4444] focus:ring-0 w-4 h-4"
              />
              <span className="text-[#F5F7FA]">¿Detectaste sobreoperación (Overtrading)?</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#94A3B8]">
              Motivo de Entrada / Setup Analizado *
            </label>
            <textarea
              value={entryReason}
              onChange={(e) => setEntryReason(e.target.value)}
              rows={2}
              className="w-full bg-[#0A1128] border border-[#1E2D4A] rounded-lg p-2.5 text-xs text-[#F5F7FA] outline-none focus:border-[#00F0FF]"
              placeholder="¿Qué catalizador o confirmación técnica motivó la entrada?"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#EF4444]">
              Errores Cometidos (si hubo)
            </label>
            <textarea
              value={errors}
              onChange={(e) => setErrors(e.target.value)}
              rows={2}
              className="w-full bg-[#0A1128] border border-[#1E2D4A] rounded-lg p-2.5 text-xs text-[#F5F7FA] outline-none focus:border-[#EF4444]"
              placeholder="¿Moviste el Stop Loss? ¿Entraste por FOMO?..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#00F0FF]">
              Observaciones & Conclusiones
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              className="w-full bg-[#0A1128] border border-[#1E2D4A] rounded-lg p-2.5 text-xs text-[#F5F7FA] outline-none focus:border-[#00F0FF]"
              placeholder="Lecciones aprendidas para sesiones futuras..."
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Confirmar Eliminación */}
      <Modal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        title="Eliminar Entrada"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (deleteConfirmId) {
                  deleteJournalEntry(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
            >
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#F5F7FA]">
          ¿Estás seguro de que deseas eliminar esta entrada del diario?
        </p>
      </Modal>
    </div>
  );
}
