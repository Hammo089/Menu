# Gestion du personnel Blanco

Administration : `/admin/personnel`, avec le compte administrateur existant.
Portail salarié : `/equipe#invitation=...`, avec lien personnel + PIN de six chiffres.
Confidentialité : `/equipe/confidentialite`.

## Utilisation

1. Compléter les fiches Joudy et Ophélie ou ajouter un employé. Aucun contrat ni horaire n’est inventé : 0 heure contractuelle signifie « non renseigné ».
2. Dans Accès salarié, créer le lien et choisir le PIN. Copier le lien et transmettre le PIN séparément. Remplacer ou révoquer l’accès coupe les anciennes sessions. Archiver un salarié conserve son dossier mais révoque ses accès.
3. Choisir le mois, toucher une journée et choisir heures/minutes dans les sélecteurs. Les brouillons sont sauvegardés après une courte pause. Les changements de journée attendent la sauvegarde ; une erreur reste visible et permet de recharger explicitement.
4. Le salarié envoie une proposition. La direction peut approuver, renvoyer avec commentaire ou retirer la proposition. La direction peut aussi saisir directement et valider, ou conserver un brouillon.
5. Une correction ne remplace jamais les heures approuvées avant validation. La correction directe d’heures validées exige un motif. Les versions concurrentes sont refusées.
6. Traiter toutes les propositions avant le relevé définitif. Générer un PDF par salarié ou tous les PDF actifs dans un ZIP. Excel complémentaire disponible. Télécharger les documents puis les transmettre manuellement au comptable ; aucun e-mail n’est envoyé automatiquement.

## Calcul

Les entrées comportent une arrivée, une pause facultative et un départ, avec un indicateur explicite de lendemain. Une seule plage avec une pause par date de début. Le formulaire de période peut proposer ou valider une absence sur 1 à 62 jours, y compris des congés futurs. Un conflit annule toute la période au lieu d’écraser une journée. Les heures chevauchant une autre plage approuvée sont refusées.

Le calcul utilise Europe/Paris et le temps réellement écoulé. Les heures inexistantes au changement d’heure sont refusées ; une heure ambiguë d’automne utilise l’occurrence en heure standard. Les heures et les pauses passant minuit sont ventilées dans les dates, semaines ISO et mois réels. Les jours travaillés sont les dates civiles ayant des minutes approuvées. Les mois voisins sont lus pour compléter les semaines et reports de minuit.

Les onze jours fériés métropolitains sont générés, sans jours spécifiques Alsace-Moselle. Le 1er mai est identifié. Un jour férié n’impose aucun statut ni majoration. Les absences ne sont pas du travail effectif. Le chiffre contractuel annuel/12 est une référence moyenne indicative ; aucun écart n’est assimilé automatiquement à des heures supplémentaires. Les règles de paie et la convention collective restent à vérifier par la direction et le comptable.

## Archives, documents et sauvegarde

Les rapports stockent un instantané versionné indépendant des modifications ultérieures. Le PDF est également archivé dans le bucket privé `personnel-documents`, limité à 5 Mo et PDF/JPEG/PNG. Les justificatifs ne sont exposés qu’aux administrateurs. Une génération interrompue conserve son instantané et peut être reprise depuis les archives.

Le bouton Exporter la sauvegarde fournit les fiches, jours, rapports, documents référencés et audit en JSON, sans PIN, liens secrets ou sessions. Télécharger aussi les pièces jointes et PDF si nécessaire. Ce bouton ne configure pas une sauvegarde automatique du fournisseur ; définir une fréquence d’export et une durée de conservation adaptée avec la direction. Les liens et PIN doivent être recréés après restauration.

## Sécurité et déploiement

Migrations : `supabase/migrations/20261122202414_personnel.sql`, puis `supabase/migrations/20261122204701_personnel_absence_ranges.sql`.
Tables `blanco_private.hr_*` : RLS activée, aucun accès direct anon/authenticated.
`public.personnel_api` est un wrapper invoker ; la fonction privée vérifie `public.menu_admins` pour l’administration, ou une session de salarié liée à sa seule fiche. Les PIN sont bcrypt, les liens/sessions aléatoires 256 bits sont hachés et le login est limité par lien et IP. La session salarié reste dans sessionStorage et expire après 30 jours ; aucune donnée personnelle n’est mise dans le cache public du site ou de la TV.

Le propriétaire définit les personnes autorisées et les durées de conservation. La note de confidentialité décrit le fonctionnement ; elle ne remplace pas l’organisation RGPD du responsable de traitement. L’archivage n’efface pas les documents comptables.

## Vérification

`npm test`, `npm run build`, `npx playwright test`.
Tests spécifiques : droits et isolation PostgreSQL/PGlite, approbation et corrections, sessions révoquées, archivage immutable, minute précise, minuit/semaines/mois, DST, années bissextiles et jours fériés. Le test navigateur utilise le vrai RPC sur PGlite pour le parcours salarié → direction → PDF/Excel et une vue mobile.

## Programme hebdomadaire et WhatsApp

Dans chaque fiche, le tab Programme hebdomadaire est réservé à la direction. Choisir le lundi, remplir les sept journées, enregistrer puis sélectionner PDF ou Excel. Les dates sont générées et les chevauchements refusés, y compris avec les semaines voisines. Les modifications concurrentes exigent un rechargement. Le planning est prévisionnel : il n’ajoute aucune ligne aux heures réellement déclarées ni aux relevés comptables. Son total correspond aux postes dont la prise de poste commence dans cette semaine.

Le bouton Partager sur WhatsApp utilise le partage natif de fichiers quand disponible : le responsable choisit WhatsApp. Sinon le fichier est téléchargé et une conversation wa.me s’ouvre avec le programme prérempli ; joindre manuellement le fichier. Le numéro principal de la fiche est utilisé (préfixe France pour un numéro national), sinon choisir le contact dans WhatsApp. Le responsable confirme toujours l’envoi. Aucun PIN, lien d’invitation, contact d’urgence ou donnée de contrat n’est partagé. Aucun envoi automatique, API WhatsApp payante ou service tiers n’est ajouté.

Les plannings sont stockés dans hr_weekly_plans avec RLS et contrôle propriétaire, et inclus dans l’export JSON du site. Migration : 20261123145935_personnel_weekly_planning.sql.
