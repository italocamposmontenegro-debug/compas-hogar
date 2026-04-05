import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { useSubscription } from '../../hooks/useSubscription';
import { AlertBanner, Button, Card, ConfirmDialog, InputField, Modal, SelectField, UpgradePromptCard } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { MAX_HOUSEHOLD_MEMBERS, SPLIT_RULE_LABELS, type SplitRuleType } from '../../lib/constants';
import { validateEmail, validateHouseholdName, validateRequired } from '../../utils/validators';
import type { HouseholdMember } from '../../types/database';
import {
  Copy,
  Home,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  PencilLine,
  PiggyBank,
  ShieldCheck,
  UserMinus,
  Users,
} from 'lucide-react';

interface PendingInvitationState {
  id: string;
  invited_email: string;
  expires_at: string;
  invitation_url: string;
}

export function SettingsPage() {
  const { profile } = useAuth();
  const { household, members, currentMember, refetch } = useHousehold();
  const { canWrite, hasFeature, getUpgradeCopy } = useSubscription();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'danger'>('success');
  const [householdName, setHouseholdName] = useState(household?.name || '');
  const [splitRule, setSplitRule] = useState<SplitRuleType>(household?.split_rule_type ?? 'fifty_fifty');
  const [income, setIncome] = useState(String(currentMember?.monthly_income || ''));
  const [displayName, setDisplayName] = useState(currentMember?.display_name || '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [pendingInvitation, setPendingInvitation] = useState<PendingInvitationState | null>(null);
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [editingPartner, setEditingPartner] = useState<HouseholdMember | null>(null);
  const [editingPartnerName, setEditingPartnerName] = useState('');
  const [editingPartnerIncome, setEditingPartnerIncome] = useState('');
  const [removePartnerOpen, setRemovePartnerOpen] = useState(false);
  const isOwner = currentMember?.role === 'owner';
  const acceptedMembersCount = useMemo(
    () => members.filter((member) => member.invitation_status === 'accepted').length,
    [members],
  );
  const householdIsFull = acceptedMembersCount >= MAX_HOUSEHOLD_MEMBERS;
  const canManageSplitRule = hasFeature('split_manual');
  const splitUpgrade = getUpgradeCopy('split_manual');
  const canManageHouseholdSettings = isOwner;
  const partnerMember = useMemo(
    () =>
      isOwner
        ? members.find((member) => member.role === 'member' && member.invitation_status === 'accepted') ?? null
        : null,
    [isOwner, members],
  );
  const invitationHelpMessage = useMemo(() => {
    if (!pendingInvitation?.invitation_url) return '';

    return [
      `Te invito a Compás Hogar para llevar ${household?.name || 'nuestro hogar'} en conjunto.`,
      '',
      `Abre este enlace: ${pendingInvitation.invitation_url}`,
      '',
      `Entra con tu propio correo y tu propia contraseña.`,
      `Si aún no tienes cuenta, créala con este mismo correo: ${pendingInvitation.invited_email}.`,
    ].join('\n');
  }, [household?.name, pendingInvitation]);

  async function saveSettings() {
    const displayNameCheck = validateRequired(displayName, 'Tu nombre visible');
    if (!displayNameCheck.valid) {
      setMsgType('danger');
      setMsg(displayNameCheck.error!);
      return;
    }

    if (canManageHouseholdSettings) {
      const householdCheck = validateHouseholdName(householdName);
      if (!householdCheck.valid) {
        setMsgType('danger');
        setMsg(householdCheck.error!);
        return;
      }
    }

    const parsedIncome = income.trim() === '' ? 0 : Number.parseInt(income, 10);
    if (!Number.isFinite(parsedIncome) || parsedIncome < 0) {
      setMsgType('danger');
      setMsg('Tu ingreso mensual debe ser un número igual o mayor a 0.');
      return;
    }

    setSaving(true);
    setMsg('');

    try {
      const { error } = await supabase.functions.invoke('manage-household-settings', {
        body: {
          householdName: householdName.trim(),
          splitRule,
          displayName: displayName.trim(),
          monthlyIncome: parsedIncome,
        },
      });
      if (error) throw error;
      await refetch();
      setMsgType('success');
      setMsg('Cambios guardados correctamente.');
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos guardar la configuración.');
    }

    setSaving(false);
  }

  const loadInvitation = useCallback(async () => {
    if (!isOwner || !household) {
      setPendingInvitation(null);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-invitation', {
        body: { action: 'get', baseUrl: window.location.origin },
      });

      if (error) throw error;
      setPendingInvitation(data?.pending_invitation ?? null);
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos cargar la invitación.');
    }
  }, [household, isOwner]);

  useEffect(() => {
    void loadInvitation();
  }, [loadInvitation]);

  useEffect(() => {
    if (window.location.hash !== '#invite-partner') return;
    const section = document.getElementById('invite-partner');
    if (!section) return;
    window.requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [pendingInvitation, isOwner]);

  async function copyInvitationLink() {
    if (!pendingInvitation?.invitation_url) return;

    try {
      await navigator.clipboard.writeText(pendingInvitation.invitation_url);
      setMsgType('success');
      setMsg('Enlace copiado. Ya puedes compartirlo con el nuevo miembro.');
    } catch {
      window.prompt('Copia este enlace para invitar al nuevo miembro:', pendingInvitation.invitation_url);
    }
  }

  async function copyInvitationMessage() {
    if (!invitationHelpMessage) return;

    try {
      await navigator.clipboard.writeText(invitationHelpMessage);
      setMsgType('success');
      setMsg('Mensaje copiado. Ya puedes pegarlo y enviarlo a tu pareja.');
    } catch {
      window.prompt('Copia este mensaje para compartir la invitación:', invitationHelpMessage);
    }
  }

  function shareInvitationOnWhatsApp() {
    if (!invitationHelpMessage) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(invitationHelpMessage)}`, '_blank', 'noopener,noreferrer');
  }

  async function createInvitation() {
    const emailCheck = validateEmail(inviteEmail);
    if (!emailCheck.valid) {
      setMsgType('danger');
      setMsg(emailCheck.error!);
      return;
    }

    setInviteLoading(true);
    setMsg('');

    try {
      const { data, error } = await supabase.functions.invoke('manage-invitation', {
        body: {
          action: 'create',
          invitedEmail: inviteEmail.trim().toLowerCase(),
          baseUrl: window.location.origin,
        },
      });

      if (error) throw error;
      setPendingInvitation(data.invitation);
      setInviteEmail('');
      setMsgType('success');
      setMsg('La invitación quedó lista. Ya puedes compartir el enlace manualmente.');
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos crear la invitación.');
    } finally {
      setInviteLoading(false);
    }
  }

  async function refreshInvitation() {
    if (!pendingInvitation) return;
    setInviteLoading(true);
    setMsg('');

    try {
      const { data, error } = await supabase.functions.invoke('manage-invitation', {
        body: {
          action: 'refresh',
          invitationId: pendingInvitation.id,
          baseUrl: window.location.origin,
        },
      });

      if (error) throw error;
      setPendingInvitation(data.invitation);
      setMsgType('success');
      setMsg('Generamos un enlace nuevo. Ya puedes compartirlo manualmente.');
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos renovar la invitación.');
    } finally {
      setInviteLoading(false);
    }
  }

  async function revokeInvitation() {
    if (!pendingInvitation) return;
    setInviteLoading(true);
    setMsg('');

    try {
      const { error } = await supabase.functions.invoke('manage-invitation', {
        body: {
          action: 'revoke',
          invitationId: pendingInvitation.id,
          baseUrl: window.location.origin,
        },
      });

      if (error) throw error;
      setPendingInvitation(null);
      setMsgType('success');
      setMsg('La invitación pendiente fue revocada.');
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos revocar la invitación.');
    } finally {
      setInviteLoading(false);
    }
  }

  function openPartnerEditor(member: HouseholdMember) {
    setEditingPartner(member);
    setEditingPartnerName(member.display_name);
    setEditingPartnerIncome(String(member.monthly_income || ''));
  }

  function closePartnerEditor() {
    if (memberActionLoading) return;
    setEditingPartner(null);
    setEditingPartnerName('');
    setEditingPartnerIncome('');
  }

  async function savePartnerChanges() {
    if (!editingPartner) return;

    const normalizedName = editingPartnerName.trim();
    const parsedIncome = editingPartnerIncome.trim() === '' ? 0 : Number.parseInt(editingPartnerIncome, 10);

    if (!normalizedName) {
      setMsgType('danger');
      setMsg('El nombre visible del miembro es obligatorio.');
      return;
    }

    if (!Number.isFinite(parsedIncome) || parsedIncome < 0) {
      setMsgType('danger');
      setMsg('El ingreso mensual debe ser un número igual o mayor a 0.');
      return;
    }

    setMemberActionLoading(true);
    setMsg('');

    try {
      const { error } = await supabase.functions.invoke('manage-household-member', {
        body: {
          action: 'update',
          memberId: editingPartner.id,
          displayName: normalizedName,
          monthlyIncome: parsedIncome,
        },
      });

      if (error) throw error;
      await refetch();
      closePartnerEditor();
      setMsgType('success');
      setMsg('Actualizamos los datos del miembro.');
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos actualizar los datos del miembro.');
    } finally {
      setMemberActionLoading(false);
    }
  }

  async function removePartnerFromHousehold() {
    if (!partnerMember) return;

    setMemberActionLoading(true);
    setMsg('');

    try {
      const { error } = await supabase.functions.invoke('manage-household-member', {
        body: {
          action: 'remove',
          memberId: partnerMember.id,
        },
      });

      if (error) throw error;
      await refetch();
      await loadInvitation();
      closePartnerEditor();
      setRemovePartnerOpen(false);
      setMsgType('success');
      setMsg('El miembro salió del hogar. Sus movimientos históricos siguen guardados.');
    } catch (error) {
      setMsgType('danger');
      setMsg(error instanceof Error ? error.message : 'No pudimos quitar a este miembro del hogar.');
    } finally {
      setMemberActionLoading(false);
    }
  }

  return (
    <div className="app-page max-w-6xl">
      <section className="ui-panel overflow-hidden p-6 lg:p-7" aria-labelledby="settings-title">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-light">Configuración del hogar</p>
          <h1 id="settings-title" className="mt-3 text-[clamp(1.85rem,2.4vw,2.35rem)] font-semibold tracking-[-0.04em] text-text">
            Ajustes del hogar
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">
            Mantén ordenados los datos del hogar, su reparto y quién participa de la cuenta compartida.
          </p>
        </div>
      </section>

      {msg ? <AlertBanner type={msgType} message={msg} onClose={() => setMsg('')} /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsCard
          icon={<Home className="h-5 w-5" />}
          eyebrow="Base del hogar"
          title="Hogar"
          description="Nombre y criterio general del reparto."
        >
          <InputField
            label="Nombre del hogar"
            value={householdName}
            onChange={(event) => setHouseholdName(event.target.value)}
            disabled={!canManageHouseholdSettings}
          />

          {canManageSplitRule ? (
            <SelectField
              label="Regla de reparto"
              value={splitRule}
              onChange={(value) => setSplitRule(value as SplitRuleType)}
              options={Object.entries(SPLIT_RULE_LABELS).map(([value, label]) => ({ value, label }))}
            />
          ) : (
            <div className="space-y-4">
              <InputField label="Regla de reparto" value={SPLIT_RULE_LABELS.fifty_fifty} onChange={() => {}} readOnly />
              <UpgradePromptCard
                badge={splitUpgrade.badge}
                title={splitUpgrade.title}
                description={splitUpgrade.description}
                highlights={splitUpgrade.highlights}
                actionLabel={splitUpgrade.actionLabel || 'Ver planes'}
                onAction={() => navigate(splitUpgrade.route)}
                compact
              />
            </div>
          )}

          {!canManageHouseholdSettings ? (
            <AlertBanner
              type="info"
              message="Solo el owner puede cambiar el nombre del hogar y la regla de reparto."
            />
          ) : null}
        </SettingsCard>

        <SettingsCard
          icon={<PiggyBank className="h-5 w-5" />}
          eyebrow="Tu referencia"
          title="Tu perfil"
          description="Datos visibles para reparto y lectura del hogar."
        >
          <InputField label="Nombre visible" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <InputField label="Ingreso mensual (CLP)" type="number" value={income} onChange={(event) => setIncome(event.target.value)} />
          <InputField label="Email" value={profile?.email || ''} onChange={() => {}} disabled />
        </SettingsCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <SettingsCard
          icon={<Users className="h-5 w-5" />}
          eyebrow="Personas"
          title="Miembros"
          description="Quién forma parte del hogar y cómo se muestra en la cuenta."
        >
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="rounded-2xl border border-border bg-bg/70 px-4 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">{member.display_name}</p>
                    <p className="mt-1 text-sm text-text-muted">
                      {member.email} · {member.role}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text-light">
                      {member.invitation_status === 'accepted' ? 'Acceso activo' : 'Pendiente'}
                    </p>
                  </div>
                  {isOwner && member.role === 'member' && member.invitation_status === 'accepted' ? (
                    <Button size="sm" variant="secondary" icon={<PencilLine className="h-3.5 w-3.5" />} onClick={() => openPartnerEditor(member)}>
                      Editar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {isOwner && !partnerMember ? (
            <div className="rounded-2xl border border-border bg-bg/70 px-4 py-4">
              <p className="text-sm font-semibold text-text">Aún no hay otra persona en este hogar.</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Invita a tu pareja para compartir gastos, metas y pagos con cuentas separadas.
              </p>
              <div className="mt-4">
                <Button size="sm" variant="secondary" onClick={() => navigate('/app/configuracion#invite-partner')}>
                  Ir a invitación
                </Button>
              </div>
            </div>
          ) : null}
        </SettingsCard>

        {isOwner ? (
          <SettingsCard
            id="invite-partner"
            icon={<Mail className="h-5 w-5" />}
            eyebrow="Invitación"
            title="Invitar a tu pareja"
            description="Suma a otra persona para llevar el hogar en conjunto."
          >
            {pendingInvitation ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-bg/70 px-4 py-4">
                  <p className="text-sm font-semibold text-text">{pendingInvitation.invited_email}</p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    Invitación pendiente hasta {new Date(pendingInvitation.expires_at).toLocaleDateString('es-CL')}. El siguiente paso es compartir este enlace.
                  </p>
                </div>

                <InputField label="Enlace de invitación" value={pendingInvitation.invitation_url} onChange={() => {}} readOnly />

                <div className="rounded-2xl border border-border bg-bg/70 px-4 py-4">
                  <p className="text-sm font-semibold text-text">Qué hacer ahora</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-text-muted">
                    <li>Envía este enlace a tu pareja por el medio que prefieras.</li>
                    <li>Tu pareja debe entrar con su propio correo y su propia contraseña.</li>
                    <li>Si aún no tiene cuenta, puede crearla con ese mismo correo.</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button icon={<LinkIcon className="h-3.5 w-3.5" />} onClick={copyInvitationLink}>
                    Copiar enlace
                  </Button>
                  <Button variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={copyInvitationMessage}>
                    Copiar mensaje
                  </Button>
                  <Button variant="secondary" icon={<MessageCircle className="h-3.5 w-3.5" />} onClick={shareInvitationOnWhatsApp}>
                    Compartir por WhatsApp
                  </Button>
                  <Button variant="secondary" onClick={refreshInvitation} loading={inviteLoading}>
                    Renovar enlace
                  </Button>
                  <Button variant="ghost" onClick={revokeInvitation} loading={inviteLoading}>
                    Revocar
                  </Button>
                </div>
              </div>
            ) : householdIsFull ? (
              <div className="rounded-2xl border border-border bg-bg/70 px-4 py-4">
                <p className="text-sm leading-7 text-text-muted">
                  Tu hogar ya tiene los {MAX_HOUSEHOLD_MEMBERS} miembros permitidos. Si más adelante quieres hacer un cambio, puedes gestionarlo desde la sección de miembros.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-bg/70 px-4 py-4">
                  <p className="text-sm font-semibold text-text">Cómo funciona</p>
                  <ol className="mt-3 space-y-2 text-sm leading-6 text-text-muted">
                    <li>1. Ingresa su correo.</li>
                    <li>2. Genera el enlace.</li>
                    <li>3. Compártelo con tu pareja.</li>
                  </ol>
                </div>
                <InputField
                  label="Email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="ej@email.com"
                  hint="Tu pareja debe entrar o crear su cuenta con este mismo correo."
                />
                <Button onClick={createInvitation} loading={inviteLoading}>
                  Crear invitación
                </Button>
              </div>
            )}
          </SettingsCard>
        ) : null}
      </div>

      {canWrite ? (
        <section className="ui-panel overflow-hidden p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">Guardar</p>
              <p className="mt-2 text-sm leading-7 text-text-muted">
                Aplica tus cambios cuando termines de revisar esta pantalla.
              </p>
            </div>
            <Button onClick={saveSettings} loading={saving}>
              Guardar cambios
            </Button>
          </div>
        </section>
      ) : null}

      <Modal open={!!editingPartner} onClose={closePartnerEditor} title="Editar miembro" size="sm">
        <div className="space-y-5">
          <p className="text-sm leading-7 text-text-muted">
            Ajusta el nombre visible o el ingreso mensual para mantener el reparto y los reportes al día.
          </p>

          <InputField
            label="Nombre visible"
            value={editingPartnerName}
            onChange={(event) => setEditingPartnerName(event.target.value)}
          />
          <InputField
            label="Ingreso mensual (CLP)"
            type="number"
            min="0"
            value={editingPartnerIncome}
            onChange={(event) => setEditingPartnerIncome(event.target.value)}
          />

          <div className="rounded-2xl border border-border bg-bg/70 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-danger-bg text-danger">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">Acceso al hogar</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Si esta persona ya no debe seguir usando el hogar, puedes quitar su acceso desde aquí. El historial compartido se mantendrá intacto.
                </p>
                <Button
                  variant="ghost"
                  className="mt-4 text-danger hover:border-danger/10 hover:bg-danger-bg hover:text-danger"
                  icon={<UserMinus className="h-3.5 w-3.5" />}
                  onClick={() => setRemovePartnerOpen(true)}
                  disabled={memberActionLoading}
                >
                  Quitar acceso
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={closePartnerEditor}>
              Cancelar
            </Button>
            <Button onClick={savePartnerChanges} loading={memberActionLoading}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={removePartnerOpen}
        onClose={() => !memberActionLoading && setRemovePartnerOpen(false)}
        onConfirm={removePartnerFromHousehold}
        title="Quitar acceso a este miembro"
        message="Esta persona dejará de ver el hogar desde su cuenta. El historial que ya existe seguirá guardado para mantener tu lectura del mes intacta."
        confirmLabel="Quitar acceso"
        loading={memberActionLoading}
      />
    </div>
  );
}

function SettingsCard({
  id,
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  id?: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card padding="lg" className="h-full">
      <div id={id} className="scroll-mt-24 space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-bg text-text-muted">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-light">{eyebrow}</p>
            <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-text">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-text-muted">{description}</p>
          </div>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </Card>
  );
}
