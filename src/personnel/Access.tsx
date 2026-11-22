import { useState } from 'react';
import { personnel } from './api';
export default function Access({ employeeId }: { employeeId: string }) {
  const [pin, setPin] = useState(''),
    [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function reset() {
    setBusy(true);
    setError('');
    try {
      const r = await personnel('access_reset', { employeeId, pin });
      setUrl(location.origin + '/equipe#invitation=' + r.link);
      setPin('');
      setNotice(
        'Nouveau lien créé. Les anciens liens et sessions sont révoqués. Transmettez le PIN séparément.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="hr-card">
      <h2>Accès personnel du salarié</h2>
      <p>
        Le salarié peut consulter et proposer ses propres horaires. Il ne peut pas valider les
        heures ni consulter les autres dossiers.
      </p>
      <label>
        Nouveau PIN de six chiffres
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="new-password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <button
        type="button"
        className="hr-primary"
        disabled={busy || pin.length !== 6}
        onClick={() => {
          if (confirm('Créer un nouveau lien et révoquer les accès précédents ?')) void reset();
        }}
      >
        Créer / remplacer le lien personnel
      </button>
      {url && (
        <div className="hr-access-link">
          <label>
            Lien à transmettre
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard
                .writeText(url)
                .then(() => setNotice('Lien copié.'))
                .catch(() => setNotice('Sélectionnez le lien pour le copier.'))
            }
          >
            Copier le lien
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirm('Révoquer le lien et toutes les sessions de ce salarié ?')) return;
          setBusy(true);
          try {
            await personnel('access_revoke', { employeeId });
            setUrl('');
            setNotice('Accès révoqué.');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Révoquer l’accès
      </button>
      {error && (
        <p role="alert" className="hr-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="hr-notice">
          {notice}
        </p>
      )}
      <p className="hr-muted">
        En cas de perte du lien ou du PIN, le salarié contacte la direction. Aucun envoi automatique
        de message n’est effectué.
      </p>
    </section>
  );
}
