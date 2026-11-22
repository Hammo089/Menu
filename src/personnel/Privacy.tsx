import './personnel.css';
export default function Privacy() {
  return (
    <main className="hr-app">
      <section className="hr-card hr-privacy">
        <a href="/equipe">← Espace salarié</a>
        <h1>Confidentialité de l’espace salarié</h1>
        <p>
          Blanco Coffee & More utilise cet espace interne pour suivre le temps de travail, examiner
          les déclarations et préparer les relevés destinés au cabinet comptable.
        </p>
        <h2>Accès aux informations</h2>
        <p>
          Vous accédez uniquement à vos horaires avec votre lien personnel et votre PIN. Les fiches
          complètes, contacts d’urgence, notes de direction, justificatifs et historiques sont
          réservés aux administrateurs autorisés. Les heures proposées sont soumises à validation.
        </p>
        <h2>Sécurité et sessions</h2>
        <p>
          Les données sont hébergées sur l’infrastructure Supabase du projet Blanco. Les PIN sont
          hachés. La session est conservée dans cet onglet et expire au plus tard après 30 jours.
          Déconnectez-vous sur un appareil partagé. Un nouveau lien remis par la direction révoque
          les accès précédents.
        </p>
        <h2>Conservation et demandes</h2>
        <p>
          Les relevés et corrections sont conservés pour assurer le suivi administratif et
          comptable. La direction définit les durées de conservation selon ses obligations
          applicables. Contactez directement la direction de Blanco pour consulter, corriger ou
          obtenir une copie de vos informations, demander la suppression lorsque les obligations de
          conservation le permettent, ou signaler un lien perdu.
        </p>
        <p>
          Les documents sensibles ne doivent contenir que les informations strictement nécessaires
          au suivi de l’absence. Cet espace n’utilise pas les données du personnel pour le marketing
          ou le programme fidélité.
        </p>
      </section>
    </main>
  );
}
