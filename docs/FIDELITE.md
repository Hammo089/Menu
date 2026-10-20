# Blanco Club — guide d’utilisation

## Au comptoir

1. Ouvrir `/admin/fidelite` avec le compte de gestion Blanco.
2. Dans **QR d’inscription**, télécharger ou imprimer l’affiche. Le QR public ouvre `/fidelite`.
3. Le client saisit son nom et son téléphone, accepte les conditions, puis conserve sa carte personnelle.
4. Pour un achat, scanner le QR du client, importer une photo de son QR, ou saisir son code `BL-…`. Choisir le nombre de **boissons payées éligibles**, confirmer le paiement, puis ajouter les tampons.
5. Pour un cadeau disponible, choisir **Utiliser ce cadeau**, puis confirmer sa remise. Une boisson offerte ne gagne pas de tampon.

La carte client s’actualise toutes les 30 secondes et au retour dans l’application. Le solde est calculé sur le serveur. Une connexion est indispensable pour inscrire, ajouter des tampons, utiliser un cadeau ou récupérer un accès. Le QR d’une carte déjà enregistrée reste présentable hors ligne ; le personnel vérifie le solde en ligne.

## Langue de gestion et retour sur la carte

La gestion propose **عربي / FR** dès la connexion et mémorise la langue sur l’appareil. Les formulaires, actions et messages passent en arabe avec une disposition RTL. Les pages clients et l’affiche imprimée restent en français.

Dans `/fidelite`, choisir **J’ai déjà une carte**, saisir le nom exact enregistré et le téléphone, puis **Retrouver ma carte**. Les majuscules et espaces superflus sont ignorés ; les numéros locaux français, +33 et 0033 sont normalisés. Le même compte, les mêmes tampons et cadeaux sont retrouvés. La carte reste mémorisée sur l’appareil ; se connecter sur un autre ne déconnecte pas les précédents.

**Me déconnecter de cet appareil** retire uniquement la copie locale et ouvre le formulaire de retour. Le compte existe toujours. En cas de changement de numéro ou d’oubli du nom enregistré, le comptoir peut renouveler le lien.

Ce choix privilégie la simplicité : le nom et le téléphone ne sont pas un secret ni une preuve de possession du numéro. Aucun mot de passe client ou SMS n’est utilisé. La connexion permet seulement la consultation de la carte ; l’équipe garde le contrôle des tampons et des cadeaux. Les échecs sont limités par numéro et par adresse réseau, sans révéler si un téléphone est inscrit.

Chaque appareil reçoit une clé aléatoire de consultation, stockée hachée en base, valable 180 jours. Au plus 10 clés d’appareil sont conservées par carte. Le renouvellement du lien par le responsable révoque ces clés ; le client peut toujours se reconnecter avec son nom et son numéro.

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

Chercher son nom dans **Clients & caisse**. Vérifier les homonymes avec son numéro de téléphone. Ouvrir sa fiche → **Assistance & données du client** → **Retrouver son accès**. Faire dire les quatre derniers chiffres de son numéro par le client présent, confirmer la vérification, puis lui faire scanner le nouveau QR privé. Il conserve ses tampons et cadeaux ; l’ancien lien privé est désactivé. Le code de caisse reste le même.

La vérification au comptoir remplace un SMS : le programme n’envoie pas de SMS et ne prétend pas vérifier automatiquement la possession du numéro.

## Corriger une opération et gérer l’équipe

La dernière opération de tampon ou d’utilisation d’un cadeau est annulable pendant 15 minutes, si aucune opération plus récente n’a eu lieu. Un équipier annule ses propres opérations ; le responsable peut annuler celles de l’équipe. Un cadeau issu d’une opération annulée est invalidé. Chaque correction reste dans l’historique.

Après une coupure réseau, **Vérifier et réessayer** reprend le même identifiant de transaction, y compris après un rechargement de la page dans le même onglet. Ne pas créer une autre opération avant confirmation de la précédente.

Le responsable de `menu_admins` a déjà accès. Pour ajouter un équipier, créer un compte e-mail confirmé dans **Supabase → Authentication → Users**, puis autoriser son e-mail dans **Équipe**. Les équipiers ont accès à la caisse et à la recherche ; les règles, la récupération, la suppression et la gestion d’équipe restent réservées au responsable. Une suspension s’applique dès la prochaine demande serveur.

## Enregistrer la carte sur le téléphone

Le bouton **Votre carte en un geste** explique l’ajout à l’écran d’accueil : Safari → Partager sur iPhone ; menu Chrome ou Samsung Internet sur Android. Un lien privé copiable et téléchargeable sert de sauvegarde. Le QR de caisse ne contient jamais ce lien privé, ni le téléphone.

Il s’agit d’une **application web installable (PWA)**, pas d’un pass Apple Wallet, Google Wallet ou Samsung Wallet. Aucun compte développeur payant, service SMS ou abonnement de fidélité externe n’est utilisé. Les quotas et conditions des comptes Supabase/Vercel restent applicables. L’installation et l’ouverture depuis l’icône doivent également être vérifiées sur les téléphones réels.

## Données et déploiement

La page `/fidelite/confidentialite` décrit le traitement des données. Le responsable peut supprimer définitivement une carte à la demande de son titulaire depuis sa fiche : profil, cadeaux et journal sont supprimés ensemble. **Me déconnecter de cet appareil** enlève uniquement la copie locale et ne supprime pas le compte.

Pour une nouvelle base, appliquer `supabase/schema.sql`, puis `supabase/loyalty.sql`, puis `supabase/loyalty-hardening.sql`, puis `supabase/loyalty-login.sql`. Ne pas rejouer ces créations sur une base déjà migrée. Les tables fidélité restent dans `blanco_private` (non exposé par PostgREST), sans accès direct pour `anon`/`authenticated`. Les fonctions vérifient l’identité de chaque opérateur. La clé privée de consultation est aléatoire (256 bits), stockée hachée en base et placée uniquement dans le fragment du lien.

Les fonctions `/api/loyalty-session` et `/api/loyalty-manifest` utilisent les deux variables **publiques** Supabase déjà configurées. Elles personnalisent le lien de démarrage de la PWA via un cookie HttpOnly, Secure et SameSite=Strict, après vérification de la carte. Elles ne mettent jamais le secret en query string et leurs réponses ne sont pas mises en cache. Aucun service-role n’est nécessaire.

Le service worker ne met en cache que la coquille publique et ses ressources statiques. Les réponses API et manifestes privés ne sont pas cachés. La carte conservée localement est signalée comme non vérifiée en cas de coupure ; aucune opération financière n’est mise en file hors ligne.

Validation automatisée : tests SQL PGlite (autorisations, capacité privée, double emploi, conditions figées, cadeaux, annulation, récupération, révocation, suppression), fonctions PWA, parcours navigateur mobile, lecture réelle d’un QR et reprise après coupure réseau.
