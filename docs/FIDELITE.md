# Blanco Club — guide d’utilisation

## Au comptoir

1. Ouvrir `/admin/fidelite` avec le compte de gestion Blanco.
2. Dans **QR d’inscription**, télécharger ou imprimer l’affiche. Le QR public ouvre `/fidelite`.
3. Le client saisit son nom et son téléphone, choisit et confirme un PIN personnel de six chiffres, accepte les conditions, puis conserve sa carte personnelle.
4. Pour un achat, scanner le QR du client, importer une photo de son QR, ou saisir son code `BL-…`. Choisir le nombre de **boissons payées éligibles**, confirmer le paiement, puis ajouter les tampons.
5. Pour un cadeau disponible, le client choisit **Préparer mon cadeau** sur son téléphone, y entre son PIN, puis donne son **code cadeau temporaire** à l’équipe. En gestion, choisir **Utiliser ce cadeau**, saisir ce code et confirmer. Le PIN personnel ne doit jamais être communiqué au personnel. Une boisson offerte ne gagne pas de tampon.

La carte client s’actualise toutes les 30 secondes et au retour dans l’application. Le solde est calculé sur le serveur. Une connexion est indispensable pour inscrire, ajouter des tampons, utiliser un cadeau ou récupérer un accès. Le QR d’une carte déjà enregistrée reste présentable hors ligne ; le personnel vérifie le solde en ligne.

## Langue de gestion et retour sur la carte

La gestion propose **عربي / FR** dès la connexion et mémorise la langue sur l’appareil. Les formulaires, actions et messages passent en arabe avec une disposition RTL. Les pages clients et l’affiche imprimée restent en français.

Dans `/fidelite`, choisir **J’ai déjà une carte**, saisir le téléphone et le **PIN personnel de six chiffres**, puis **Retrouver ma carte**. Les numéros locaux français, +33 et 0033 sont normalisés. Le même compte, les mêmes tampons et cadeaux sont retrouvés. Le compte reste mémorisé sur l’appareil ; se connecter sur un autre ne déconnecte pas les précédents.

Le nom et le téléphone seuls ne permettent plus de se connecter. Les PIN sont hachés avec bcrypt (coût 12), jamais stockés en clair ou affichés au personnel. Les tentatives sont limitées par téléphone et par adresse réseau. Aucun SMS payant n’est utilisé ; le téléphone n’est pas vérifié par SMS. Éviter les suites évidentes et les six chiffres identiques.

**Me déconnecter de cet appareil** retire la copie locale et le cookie d’installation, puis ouvre le formulaire de retour. Le compte existe toujours. Le client revient avec son téléphone et son PIN.

Chaque appareil reçoit une clé aléatoire de consultation, stockée hachée en base, valable 180 jours. Au plus 10 clés d’appareil sont conservées par carte. Un lien de consultation doit rester privé. Une simple photo du QR ou la connaissance du nom et du téléphone ne permet pas d’utiliser une récompense : le code cadeau nécessite une nouvelle saisie du PIN sur le téléphone du client, expire après cinq minutes et ne fonctionne qu’une fois, pour un seul cadeau. Générer un nouveau code annule le précédent. Une annulation en caisse ne réactive pas un code déjà utilisé.

**Comptes créés avant la protection par PIN :** les anciens accès par nom/téléphone et les anciennes clés sont désactivés. Le responsable remet une fois un nouveau lien de récupération au client. Ses tampons, cadeaux, conditions et historique sont conservés.

## Règles initiales, entièrement modifiables

- 8 boissons payées en 30 jours depuis le premier tampon donnent une boisson offerte.
- Cadeau utilisable dès le lendemain à minuit, heure de Grenoble, et valable 14 jours depuis son obtention.
- Les boissons au-delà de l’objectif commencent une nouvelle carte ; plusieurs cadeaux peuvent être gagnés.
- Les tampons d’une carte incomplète expirent à la fin du délai. Les cadeaux gagnés ont leur propre échéance.
- Limite initiale : 50 tampons par carte par jour (heure de Grenoble), 50 maximum par opération.
- **Programme** permet de régler l’objectif, le délai, le type de cadeau (boisson, réduction fixe en euros ou pourcentage), sa valeur, son nom, son plafond, sa validité et ses conditions.
- Les cartes commencées et les cadeaux gagnés gardent leurs règles. Les nouvelles règles commencent avec la prochaine carte. Mettre en pause bloque inscriptions et tampons, mais laisse utiliser les cadeaux déjà obtenus.

Les achats et réductions se vérifient et s’appliquent manuellement dans la caisse habituelle : il n’y a pas de connexion à un logiciel de caisse ou de paiement.

## Un client a perdu sa carte

Chercher son nom dans **Clients & caisse**. Vérifier l’identité de la personne présente et distinguer les homonymes avec son téléphone. Ouvrir sa fiche → **Assistance & données du client** → **Retrouver son accès**. Faire dire les quatre derniers chiffres de son numéro par le client, confirmer la vérification, puis lui remettre le **lien personnel de suivi** affiché en clair et copiable au-dessus du QR. Le QR de récupération ouvre ce même lien, contrairement au QR de caisse qui ouvre uniquement la fiche du personnel.

Le lien est valable 30 minutes et ne s’utilise qu’une fois. Le client l’ouvre **sur son propre téléphone**, choisit son nouveau PIN, puis retrouve son suivi : tampons, total des boissons comptabilisées, dernières visites et cadeaux. Le navigateur passe ensuite à un nouveau lien privé, à enregistrer. L’ancien PIN, les anciens accès et codes cadeaux sont révoqués ; le code de caisse et les données du compte sont conservés. Un lien expiré doit être réémis par le responsable. Le personnel ne peut ni lire l’ancien PIN ni connaître le nouveau choisi par le client.

La vérification humaine au comptoir remplace un SMS de récupération ; elle doit porter sur l’identité du client, pas uniquement sur la connaissance de son nom. Si la réponse à la création du PIN se perd sur le réseau, le client peut se reconnecter avec son téléphone et le PIN qu’il vient de choisir.

## Corriger une opération et gérer l’équipe

La dernière opération de tampon ou d’utilisation d’un cadeau est annulable pendant 15 minutes, si aucune opération plus récente n’a eu lieu. Un équipier annule ses propres opérations ; le responsable peut annuler celles de l’équipe. Un cadeau issu d’une opération annulée est invalidé. Chaque correction reste dans l’historique.

Après une coupure réseau, **Vérifier et réessayer** reprend le même identifiant de transaction, y compris après un rechargement de la page dans le même onglet. Ne pas créer une autre opération avant confirmation de la précédente.

Le responsable de `menu_admins` a déjà accès. Pour ajouter un équipier, créer un compte e-mail confirmé dans **Supabase → Authentication → Users**, puis autoriser son e-mail dans **Équipe**. Les équipiers ont accès à la caisse et à la recherche ; les règles, la récupération, la suppression et la gestion d’équipe restent réservées au responsable. Une suspension s’applique dès la prochaine demande serveur.

## Enregistrer la carte sur le téléphone

Le bouton **Votre carte en un geste** explique l’ajout à l’écran d’accueil : Safari → Partager sur iPhone ; menu Chrome ou Samsung Internet sur Android. Un lien privé copiable et téléchargeable sert de sauvegarde. Le QR de caisse ne contient jamais ce lien privé, ni le téléphone.

Il s’agit d’une **application web installable (PWA)**, pas d’un pass Apple Wallet, Google Wallet ou Samsung Wallet. Aucun compte développeur payant, service SMS ou abonnement de fidélité externe n’est utilisé. Les quotas et conditions des comptes Supabase/Vercel restent applicables. L’installation et l’ouverture depuis l’icône doivent également être vérifiées sur les téléphones réels.

## Données et déploiement

La page `/fidelite/confidentialite` décrit le traitement des données. Le responsable peut supprimer définitivement une carte à la demande de son titulaire depuis sa fiche : profil, cadeaux et journal sont supprimés ensemble. **Me déconnecter de cet appareil** enlève uniquement la copie locale et ne supprime pas le compte.

Pour une nouvelle base, appliquer `supabase/schema.sql`, puis `supabase/loyalty.sql`, puis `supabase/loyalty-hardening.sql`, puis `supabase/loyalty-login.sql`, puis `supabase/loyalty-pin.sql`, puis `supabase/loyalty-pin-guard.sql` (requiert pgcrypto dans le schéma `extensions`, déjà installé sur le projet). Ne pas rejouer ces créations sur une base déjà migrée. Les tables fidélité restent dans `blanco_private` (non exposé par PostgREST), sans accès direct pour `anon`/`authenticated`. Les fonctions vérifient l’identité de chaque opérateur. La clé privée de consultation est aléatoire (256 bits), stockée hachée en base et placée uniquement dans le fragment du lien.

Les fonctions `/api/loyalty-session` et `/api/loyalty-manifest` utilisent les deux variables **publiques** Supabase déjà configurées. Elles personnalisent le lien de démarrage de la PWA via un cookie HttpOnly, Secure et SameSite=Strict, après vérification d’une carte authentifiée (les liens de réinitialisation ne sont pas conservés dans le manifeste). Elles ne mettent jamais le secret en query string et leurs réponses ne sont pas mises en cache. Aucun service-role n’est nécessaire.

Le service worker ne met en cache que la coquille publique et ses ressources statiques. Les réponses API et manifestes privés ne sont pas cachés. La carte conservée localement est signalée comme non vérifiée en cas de coupure ; aucune opération financière n’est mise en file hors ligne.

Validation automatisée : tests SQL PGlite (autorisations, capacité privée, double emploi, conditions figées, cadeaux, annulation, récupération, révocation, suppression), fonctions PWA, parcours navigateur mobile, lecture réelle d’un QR et reprise après coupure réseau.
