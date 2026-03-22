// Casa Clara — Settings Page
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, InputField, SelectField, AlertBanner } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { SPLIT_RULE_LABELS } from '../../lib/constants';
import { Users, Home } from 'lucide-react';

export function SettingsPage() {
  const { profile } = useAuth();
  const { household, members, currentMember, refetch } = useHousehold();
  const { canWrite } = useSubscription();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [householdName, setHouseholdName] = useState(household?.name || '');
  const [splitRule, setSplitRule] = useState<string>(household?.split_rule_type || 'fifty_fifty');
  const [income, setIncome] = useState(String(currentMember?.monthly_income || ''));
  const [displayName, setDisplayName] = useState(currentMember?.display_name || '');

  async function saveSettings() {
    setSaving(true); setMsg('');
    try {
      if (household) {
        await supabase.from('households').update({ name: householdName, split_rule_type: splitRule }).eq('id', household.id);
      }
      if (currentMember) {
        await supabase.from('household_members').update({ display_name: displayName, monthly_income: parseInt(income) || 0 }).eq('id', currentMember.id);
      }
      await refetch();
      setMsg('Cambios guardados correctamente.');
    } catch { setMsg('Error al guardar.'); }
    setSaving(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-6">Configuración</h1>

      <div className="space-y-6 max-w-2xl">
        {msg && <AlertBanner type="success" message={msg} onClose={() => setMsg('')} />}

        <Card>
          <div className="flex items-center gap-2 mb-4"><Home className="h-5 w-5 text-primary" /><h3 className="font-semibold text-text">Hogar</h3></div>
          <div className="space-y-4">
            <InputField label="Nombre del hogar" value={householdName} onChange={e => setHouseholdName(e.target.value)} />
            <SelectField label="Regla de reparto" value={splitRule} onChange={setSplitRule}
              options={Object.entries(SPLIT_RULE_LABELS).map(([k, v]) => ({ value: k === '50_50' ? 'fifty_fifty' : k, label: v }))} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4"><Users className="h-5 w-5 text-primary" /><h3 className="font-semibold text-text">Mi perfil</h3></div>
          <div className="space-y-4">
            <InputField label="Nombre visible" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            <InputField label="Ingreso mensual (CLP)" type="number" value={income} onChange={e => setIncome(e.target.value)} />
            <InputField label="Email" value={profile?.email || ''} onChange={() => {}} disabled />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4"><Users className="h-5 w-5 text-primary" /><h3 className="font-semibold text-text">Miembros</h3></div>
          <ul className="space-y-2">
            {members.map(m => (
              <li key={m.id} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                <div><p className="text-sm font-medium text-text">{m.display_name}</p><p className="text-xs text-text-muted">{m.email} · {m.role}</p></div>
              </li>
            ))}
          </ul>
        </Card>

        {canWrite && <Button onClick={saveSettings} loading={saving}>Guardar cambios</Button>}
      </div>
    </div>
  );
}
