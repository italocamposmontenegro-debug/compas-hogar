// ============================================
// Casa Clara — Categories Page
// ============================================

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, InputField, Modal, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Category } from '../../types/database';
import { Plus, Edit2, Tags } from 'lucide-react';

export function CategoriesPage() {
  const { household } = useHousehold();
  const { canWrite } = useSubscription();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState('#6B7280');
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase.from('categories').select('*')
      .eq('household_id', household.id).is('deleted_at', null).order('sort_order');
    setCategories((data || []) as Category[]);
  }, [household]);

  useEffect(() => { void loadCategories(); }, [loadCategories]);

  function openCreate() { setEditing(null); setName(''); setIcon('📦'); setColor('#6B7280'); setShowForm(true); }
  function openEdit(c: Category) { setEditing(c); setName(c.name); setIcon(c.icon); setColor(c.color); setShowForm(true); }

  async function handleSave() {
    if (!household) return;
    setSaving(true);
    const data = { household_id: household.id, name, icon, color, is_default: false, sort_order: categories.length };
    if (editing) { await supabase.from('categories').update({ name, icon, color }).eq('id', editing.id); }
    else { await supabase.from('categories').insert(data); }
    setSaving(false); setShowForm(false); loadCategories();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Categorías</h1>
        {canWrite && <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate} size="sm">Nueva</Button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map(c => (
          <Card key={c.id} padding="sm" className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{c.icon}</span>
              <div>
                <p className="font-medium text-text text-sm">{c.name}</p>
              </div>
            </div>
            {canWrite && !c.is_default && (
              <button onClick={() => openEdit(c)} className="p-1.5 text-text-muted hover:text-primary cursor-pointer">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <EmptyState icon={<Tags className="h-8 w-8" />} title="Sin categorías" description="Las categorías se crearán automáticamente durante el onboarding." />
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar categoría' : 'Nueva categoría'} size="sm">
        <div className="space-y-4">
          <InputField label="Nombre" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Mascota" />
          <InputField label="Ícono (emoji)" value={icon} onChange={e => setIcon(e.target.value)} placeholder="🐾" />
          <InputField label="Color" type="color" value={color} onChange={e => setColor(e.target.value)} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
