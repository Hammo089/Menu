import { useState } from 'react';
import { personnel } from './api';
import type { Employee } from './core';
const fields = [
  ['birthDate', 'Date de naissance', 'date'],
  ['address', 'Adresse complète', 'text'],
  ['phone', 'Téléphone principal', 'tel'],
  ['alternatePhone', 'Téléphone alternatif', 'tel'],
  ['email', 'E-mail', 'email'],
  ['emergencyName', 'Contact d’urgence — nom', 'text'],
  ['emergencyRelation', 'Lien avec le contact d’urgence', 'text'],
  ['emergencyPhone', 'Téléphone d’urgence', 'tel'],
  ['contractStart', 'Début du contrat', 'date'],
  ['contractEnd', 'Fin du contrat', 'date'],
] as const;
export default function Profile({
  employee,
  onSaved,
}: {
  employee: Employee;
  onSaved: (employee: Employee) => void;
}) {
  const [form, setForm] = useState<Employee>(() => ({
      ...employee,
      profile: { ...employee.profile },
    })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const profile = (key: string, value: string) =>
    setForm((old) => ({ ...old, profile: { ...old.profile, [key]: value } }));
  return (
    <form
      className="hr-profile"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          employee.active &&
          !form.active &&
          !confirm(
            'Archiver cet employé ? Ses heures seront conservées, mais son accès personnel sera révoqué.',
          )
        )
          return;
        setBusy(true);
        setError('');
        try {
          const result = await personnel('profile_save', {
            employeeId: form.id || undefined,
            employee: form,
          });
          onSaved(result.employee);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{employee.id ? 'Fiche du salarié' : 'Nouvel employé'}</h2>
      <p className="hr-muted">
        Seul le prénom est obligatoire. Les données personnelles et notes restent réservées à la
        direction.
      </p>
      <div className="hr-profile-grid">
        <label>
          Prénom
          <input
            required
            maxLength={100}
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          />
        </label>
        <label>
          Nom
          <input
            maxLength={100}
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          />
        </label>
        {fields.map(([key, label, type]) => (
          <label key={key}>
            {label}
            <input
              type={type}
              maxLength={key === 'address' ? 500 : 150}
              value={form.profile[key] || ''}
              onChange={(e) => profile(key, e.target.value)}
            />
          </label>
        ))}
        <label>
          Type de contrat
          <select
            value={form.profile.contractType || ''}
            onChange={(e) => profile('contractType', e.target.value)}
          >
            {['', 'CDI', 'CDD', 'Apprentissage', 'Stage', 'Autre'].map((v) => (
              <option key={v} value={v}>
                {v || 'Non renseigné'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Heures contractuelles / semaine
          <input
            type="number"
            min={0}
            max={84}
            step="0.01"
            value={form.weekly_hours}
            onChange={(e) => setForm({ ...form, weekly_hours: Number(e.target.value) })}
          />
          <small>0 = non renseigné ; aucune majoration automatique.</small>
        </label>
      </div>
      <label>
        Notes administratives privées
        <textarea
          maxLength={2000}
          value={form.profile.notes || ''}
          onChange={(e) => profile('notes', e.target.value)}
        />
      </label>
      <label className="hr-check">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        Employé actif
      </label>
      {error && (
        <p role="alert" className="hr-error">
          {error}
        </p>
      )}
      <button className="hr-primary" disabled={busy}>
        {busy ? 'Enregistrement…' : 'Enregistrer la fiche'}
      </button>
    </form>
  );
}
