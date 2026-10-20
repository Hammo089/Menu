import { useLoyaltyLanguage } from './i18n';
import { useState, type FormEvent } from 'react';
import { rpc, type Program } from './lib';

export default function LoyaltySettings({
  program,
  onSave,
}: {
  program: Program;
  onSave: (p: Program) => void;
}) {
  const { t } = useLoyaltyLanguage();

  const [draft, setDraft] = useState(program),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  const change = <K extends keyof Program>(k: K, v: Program[K]) => {
    setDraft((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await rpc('save_program', { program: draft });
      setDraft(r.program);
      onSave(r.program);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="loy-settings loy-panel">
      <span className="loy-eyebrow">{t('VOTRE PROGRAMME, VOS RÈGLES')}</span>
      <h2>{t('Les petites attentions.')}</h2>
      <p>
        {t(
          'Les nouveaux réglages s’appliquent aux prochaines cartes. Les cartes en cours et les cadeaux déjà gagnés conservent leurs conditions.',
        )}{' '}
      </p>
      <label className="loy-checkbox">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => change('enabled', e.target.checked)}
        />
        <span>{t('Programme actif (inscriptions et nouveaux tampons)')}</span>
      </label>
      <label>
        {t('Phrase d’accueil')}{' '}
        <input
          value={draft.title}
          required
          maxLength={100}
          onChange={(e) => change('title', e.target.value)}
        />
      </label>
      <div className="loy-form-grid">
        <label>
          {t('Boissons pour obtenir un cadeau')}{' '}
          <input
            type="number"
            required
            min={2}
            max={30}
            value={draft.goal}
            onChange={(e) => change('goal', +e.target.value)}
          />
        </label>
        <label>
          {t('Délai pour compléter une carte (jours)')}{' '}
          <input
            type="number"
            required
            min={1}
            max={365}
            value={draft.window_days}
            onChange={(e) => change('window_days', +e.target.value)}
          />
        </label>
        <label>
          {t('Type de cadeau')}{' '}
          <select
            value={draft.reward_kind}
            onChange={(e) => change('reward_kind', e.target.value as Program['reward_kind'])}
          >
            <option value="drink">{t('Boisson offerte')}</option>
            <option value="percent">{t('Réduction en %')}</option>
            <option value="fixed">{t('Réduction en €')}</option>
          </select>
        </label>
        <label>
          {t('Nom du cadeau')}{' '}
          <input
            value={draft.reward_label}
            maxLength={120}
            required
            onChange={(e) => change('reward_label', e.target.value)}
          />
        </label>
        {draft.reward_kind !== 'drink' && (
          <label>
            {draft.reward_kind === 'percent'
              ? t('Pourcentage de réduction')
              : t('Montant de réduction (€)')}
            <input
              type="number"
              required
              min={draft.reward_kind === 'percent' ? 1 : 0.01}
              max={draft.reward_kind === 'percent' ? 100 : 1000}
              step={draft.reward_kind === 'percent' ? 1 : 0.01}
              value={draft.reward_kind === 'fixed' ? draft.reward_value / 100 : draft.reward_value}
              onChange={(e) =>
                change(
                  'reward_value',
                  Math.round(+e.target.value * (draft.reward_kind === 'fixed' ? 100 : 1)),
                )
              }
            />
          </label>
        )}
        {draft.reward_kind === 'drink' && (
          <label>
            {t('Prix maximum offert (€ ; 0 = sans plafond)')}{' '}
            <input
              type="number"
              required
              min={0}
              max={1000}
              step="0.01"
              value={draft.max_price_cents / 100}
              onChange={(e) => change('max_price_cents', Math.round(+e.target.value * 100))}
            />
          </label>
        )}
        <label>
          {t('Validité du cadeau (jours depuis obtention)')}{' '}
          <input
            type="number"
            min={1}
            max={365}
            required
            value={draft.reward_days}
            onChange={(e) => change('reward_days', +e.target.value)}
          />
        </label>
        <label>
          {t('Maximum de tampons par carte et par jour')}{' '}
          <input
            type="number"
            min={1}
            max={200}
            required
            value={draft.daily_limit}
            onChange={(e) => change('daily_limit', +e.target.value)}
          />
        </label>
      </div>
      <label className="loy-checkbox">
        <input
          type="checkbox"
          checked={draft.next_day}
          onChange={(e) => change('next_day', e.target.checked)}
        />
        <span>
          {t('Cadeau utilisable dès le lendemain, à minuit à Grenoble (sinon immédiatement)')}
        </span>
      </label>
      <label>
        {t('Boissons éligibles et conditions')}{' '}
        <textarea
          maxLength={500}
          required
          rows={4}
          value={draft.eligible_text}
          onChange={(e) => change('eligible_text', e.target.value)}
        />
      </label>
      <p className="loy-field-help">
        {t(
          'Une boisson payée = un tampon. Le contrôle des achats se fait en caisse ; aucune connexion automatique à votre caisse enregistreuse.',
        )}{' '}
      </p>
      {error && (
        <p role="alert" className="loy-alert">
          {t(error)}
        </p>
      )}
      {saved && (
        <p role="status" className="loy-notice">
          {t('Les règles ont été enregistrées.')}{' '}
        </p>
      )}
      <button className="loy-button" disabled={busy}>
        {busy ? t('Enregistrement…') : t('Enregistrer le programme')}
      </button>
    </form>
  );
}
