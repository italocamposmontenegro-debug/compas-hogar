// Casa Clara — CSV Import Page (Plus)
import { useState } from 'react';
import { Card, Button, FeatureGate } from '../../components/ui';
import { FileSpreadsheet, Upload, Check, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../../hooks/useHousehold';
import { useAuth } from '../../hooks/useAuth';
import { formatCLP } from '../../utils/format-clp';

interface PreviewRow {
  date: string;
  description: string;
  amount: number;
}

export function CsvImportPage() {
  const { household, currentMember } = useHousehold();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError('');
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        const rows: PreviewRow[] = [];

        // Simple CSV parser (assuming comma or semicolon)
        // Header detection logic could be improved, but for now we skip first line
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(/[;,]/);
          if (cells.length < 3) continue;

          // Expecting Date, Description, Amount
          const row: PreviewRow = {
            date: cells[0]?.trim() || new Date().toISOString().split('T')[0],
            description: cells[1]?.trim() || 'Sin descripción',
            amount: Math.abs(parseFloat(cells[2]?.replace(/[^0-9.-]+/g, '')) || 0),
          };
          rows.push(row);
        }
        setPreview(rows.slice(0, 50)); // Preview first 50
      } catch {
        setError('Error al leer el archivo. Asegúrate que sea un CSV válido.');
      }
    };
    reader.readAsText(selected);
  };

  const handleImport = async () => {
    if (!household || !user || !currentMember || preview.length === 0) return;
    setLoading(true);
    setError('');

    try {
      const inserts = preview.map(row => ({
        household_id: household.id,
        created_by: user.id,
        paid_by_member_id: currentMember.id,
        type: 'expense' as const,
        scope: 'shared' as const,
        assigned_to_member_id: null,
        amount_clp: row.amount,
        category_id: null,
        description: row.description,
        occurred_on: row.date,
        expense_type: 'variable' as const,
        is_recurring_instance: false,
        recurring_source_id: null,
        notes: null,
      }));

      const { error: dbError } = await supabase.from('transactions').insert(inserts);
      if (dbError) throw dbError;

      setSuccess(true);
      setPreview([]);
      setFile(null);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Error al importar movimientos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureGate feature="csv_import">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text">Importar CSV</h1>
          {preview.length > 0 && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setFile(null); setPreview([]); }}>
                <Trash2 className="h-4 w-4" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleImport} loading={loading}>
                <Check className="h-4 w-4" /> Importar {preview.length} filas
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-danger-bg text-danger border border-danger/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-success-bg text-success border border-success/30 rounded-xl flex items-center gap-3">
            <Check className="h-5 w-5" />
            <p className="text-sm font-medium">¡Importación exitosa! Revisa tus movimientos en el Dashboard.</p>
          </div>
        )}

        {!file ? (
          <Card>
            <div className="text-center py-16">
              <div className="h-20 w-20 bg-primary-bg rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileSpreadsheet className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-text mb-2">Carga tus movimientos</h3>
              <p className="text-text-muted mb-8 max-w-sm mx-auto">
                Sube el extracto bancario de tu cuenta compartida. Casa Clara procesará los movimientos automáticamente.
              </p>
              
              <div className="space-y-4">
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 cursor-pointer hover:bg-primary-light transition-all hover:-translate-y-0.5 active:translate-y-0">
                  <Upload className="h-5 w-5" />
                  Seleccionar archivo .csv
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                </label>
                <p className="text-xs text-text-light">
                  Formato esperado: Fecha, Descripción, Monto
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-hover border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-text">Fecha</th>
                    <th className="px-6 py-4 font-semibold text-text">Descripción</th>
                    <th className="px-6 py-4 font-semibold text-text">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.map((row, idx) => (
                    <tr key={idx} className="hover:bg-bg/50 transition-colors">
                      <td className="px-6 py-4 text-text-muted">{row.date}</td>
                      <td className="px-6 py-4 text-text font-medium">{row.description}</td>
                      <td className="px-6 py-4 text-danger font-bold">{formatCLP(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </FeatureGate>
  );
}
