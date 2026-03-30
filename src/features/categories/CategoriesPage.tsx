// ============================================
// Casa Clara — Categories Page
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { Card, Button, InputField, Modal, EmptyState, AlertBanner, UpgradePromptCard } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Category } from '../../types/database';
import { Plus, Edit2, Tags } from 'lucide-react';

export function CategoriesPage() {
  const { household } = useHousehold();
  const { canWrite, hasFeature, getUpgradeCopy } = useSubscription();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState('#6B7280');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'danger'>('success');
  const canManageCustomCategories = canWrite && hasFeature('categories_custom');
  const categoriesUpgrade = getUpgradeCopy('categories_custom');

  const loadCategories = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase.from('categories').select('*')
      .eq('household_id', household.id).is('deleted_at', null).order('sort_order');
    setCategories((data || []) as Category[]);
  }, [household]);

  useEffect(() => { void loadCategories(); }, [loadCategories]);

  const closeForm = useCallback(() => {
    setShowForm(false);
  }, []);

  function openCreate() { setEditing(null); setName(''); setIcon('📦'); setColor('#6B7280'); setShowForm(true); }
  function openEdit(c: Category) { setEditing(c); setName(c.name); setIcon(c.icon); setColor(c.color); setShowForm(true); }

  async function handleSave() {
    if (!household) return;
    setSaving(true);
    setMsg('');
    try {
      const { error } = await supabase.functions.invoke('manage-category', {
        body: editing
          ? { action: 'update', categoryId: editing.id, name, icon, color }
          : { action: 'create', householdId: household.id, name, icon, color },
      });
      if (error) throw error;
      setMsgType('success');
      setMsg(editing ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.');
      closeForm();
      await loadCategories();
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos guardar la categoría.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Categorías</h1>
        {canManageCustomCategories && <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate} size="sm">+</Button>}
      </div>

      {msg && (
        <div className="mb-6">
          <AlertBanner type={msgType} message={msg} onClose={() => setMsg('')} />
        </div>
      )}

      {!canManageCustomCategories && (
        <div className="mb-6">
          <UpgradePromptCard
            badge={categoriesUpgrade.badge}
            title={categoriesUpgrade.title}
            description={categoriesUpgrade.description}
            highlights={categoriesUpgrade.highlights}
            actionLabel={categoriesUpgrade.actionLabel || 'Ver planes'}
            onAction={() => navigate(categoriesUpgrade.route)}
            compact
          />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map(c => (
          <Card key={c.id} className="flex items-center justify-between hover:bg-black/[0.02] transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-xl opacity-80">{c.icon}</span>
              <div>
                <p className="font-semibold text-text text-sm tracking-tight">{c.name}</p>
              </div>
            </div>
            {canManageCustomCategories && !c.is_default && (
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

      <Modal open={showForm} onClose={closeForm} title={editing ? 'Editar categoría' : 'Nueva categoría'} size="sm">
        <div className="space-y-4">
          <InputField label="Nombre" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Mascota" />
          <InputField label="Ícono (emoji)" value={icon} onChange={e => setIcon(e.target.value)} placeholder="🐾" />
          <InputField label="Color" type="color" value={color} onChange={e => setColor(e.target.value)} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
