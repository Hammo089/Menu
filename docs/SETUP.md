# ربط Blanco / Configuration de Blanco

## 1. Supabase

استخدم مشروع Supabase مستقل باسم Blanco. لا تشغّل الملفات على قاعدة بيانات مشروع آخر.

1. Dans un **projet Supabase dédié à Blanco**, ouvrez SQL Editor.
2. Exécutez `supabase/schema.sql` **une seule fois**, puis `supabase/seed.sql`.
3. Dans Authentication → Users, créez votre compte administrateur (adresse e-mail et mot de passe). Aucun formulaire d’inscription publique n’est fourni.
4. Copiez son UUID et exécutez cette requête dans SQL Editor :

```sql
insert into public.menu_admins(user_id) values ('UUID-DE-VOTRE-COMPTE');
```

5. Désactivez les inscriptions publiques dans les réglages Auth. Seul l’utilisateur inscrit dans `menu_admins` peut publier ou importer des photos, même si d’autres comptes existent.
6. Dans Project Settings → API, récupérez l’URL du projet et la **publishable key**. Ne placez jamais de clé `service_role` ou de clé secrète dans l’application.

رفع الصور مسموح للمدير فقط، حتى ٥ ميغا للصورة. الصور نفسها عامة لأنها جزء من المنيو.

## 2. Développement local

```sh
npm ci
cp .env.example .env.local
```

Renseignez dans `.env.local` :

```dotenv
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=VOTRE-PUBLISHABLE-KEY
```

```sh
npm run dev
```

Sans ces deux variables, la carte d’origine est visible et `/admin` propose un **aperçu de brouillons sans publication**. Ce mode n’enregistre aucune modification. Avec les variables, l’accès à l’administration exige une connexion et une appartenance à `menu_admins`.

## 3. Vercel

1. Importez le dépôt GitHub `Hammo089/Menu` dans Vercel, framework **Vite**.
2. Ajoutez les deux variables ci-dessus pour Production et Preview.
3. Déployez. `vercel.json` gère `/admin`, `/menu` et `/tv`.
4. Vérifiez la connexion, la publication, et les images avant d’utiliser le lien sur le téléviseur.

ما في حاجة لمفتاح سري على Vercel. الحماية الفعلية موجودة بسياسات RLS في قاعدة البيانات.

## 4. TV Google TV

- Ouvrez `https://VOTRE-DOMAINE/tv`. Configuration initiale : **verticale, rotation 0°, carte originale**.
- Avec la télécommande, sélectionnez le bouton de réglages en bas à droite. Choisissez **Vertical / Horizontal** et **0° / 90° / 180° / 270°** selon le sens réel du navigateur.
- Les réglages de cette page sont enregistrés sur **ce téléviseur seulement**. « Réglages par défaut » rétablit les valeurs publiées dans l’administration.
- Le mode horizontal conserve la carte entière, avec des marges latérales. Il ne transforme pas le document en un nouveau design horizontal.
- Le bouton plein écran dépend de la prise en charge du navigateur. Il faut une action de la télécommande pour l’activer.
- La page tente de garder l’écran éveillé si le navigateur le permet. Réglez aussi l’économiseur d’écran de Google TV.
- Les modifications sont reçues par Supabase Realtime, avec une vérification toutes les 30 secondes en secours.
- Les dernières données reçues sont conservées localement. Une coupure momentanée laisse la page déjà ouverte fonctionner. **Un rechargement complet hors ligne n’est pas garanti** : aucun service worker n’est installé.

## 5. Contenu et publicités

- Les 52 produits, noms, astérisques et prix viennent du PDF original. Aucun ingrédient ni allergène n’a été inventé.
- Les photos sont des illustrations provisoires d’Unsplash, stockées dans `public/images`. Plusieurs produits partagent une image de leur catégorie. Remplacez-les dans Produits & prix → Modifier.
- Enregistrez un produit dans le **brouillon**, puis cliquez sur **Publier** pour mettre à jour tous les écrans.
- Les publicités et effets saisonniers sont désactivés au départ. Le rythme par défaut est **5 secondes toutes les 60 secondes**. L’intervalle est mesuré entre les débuts des publicités.
- Choisissez un ou plusieurs produits dans Publicités. Les produits masqués ne sont pas annoncés.
- Les changements de prix et de nom conservent les positions du PDF. Ajouter, masquer ou déplacer un produit redistribue les lignes dans la zone de sa catégorie. Vérifiez toujours la lisibilité après avoir ajouté beaucoup de lignes.
- Les huit zones TV suivent le PDF. Les noms des catégories sont éditables et leur ordre mobile est réglable. Créer de nouvelles zones TV, déplacer le logo et changer la typographie de la carte originale nécessitent une évolution du modèle.

## Vérification après connexion

1. Ouvrez `/tv` et la carte sur deux appareils.
2. Connectez-vous sur `/admin`, changez un prix, publiez et vérifiez les deux appareils.
3. Importez une photo et vérifiez qu’elle remplace l’illustration.
4. Activez une publicité, attendez un intervalle complet et vérifiez sa disparition.
5. Vérifiez qu’un visiteur non connecté ne peut pas publier et qu’un compte non autorisé n’accède pas à l’administration.
6. Testez l’orientation sur le téléviseur physique : l’émulation navigateur ne remplace pas cette vérification.

## Fêtes et calendriers

Dans Identité & style, les fêtes peuvent être automatiques, désactivées, ou sélectionnées manuellement. Les calendriers occidental et orthodoxe julien sont activés ensemble par défaut. Noël oriental est fixé au 7 janvier, l’Épiphanie au 19 janvier et la Dormition au 28 août ; certaines Églises orientales utilisent d’autres dates, modifiables dans le calendrier. Pâques, les Rameaux, l’Ascension et la Pentecôte sont calculés séparément pour chaque tradition. Les dates communes ne produisent pas de doublon.

Les occasions musulmanes suivent le calendrier prévisionnel Umm al-Qura : Ramadan, Aïd el-Fitr, Aïd el-Adha, nouvel an hégirien, Mawlid, Al-Isra wal-Miraj et Achoura. Un ajustement de −2 à +2 jours et des dates individuelles permettent de suivre l’annonce locale du croissant. Une date individuelle remplace l’ajustement global pour cette occurrence.

Ramadan dure le mois calculé ; l’Aïd el-Fitr trois jours, l’Aïd el-Adha quatre jours. Noël commence cinq jours avant et finit le lendemain ; Pâques couvre la veille, le jour et le lendemain. Les autres fêtes sont affichées le jour indiqué (Pentecôte et nouvel an incluent le lendemain ; le nouvel an inclut aussi le 31 décembre). Les dates sont évaluées selon Europe/Paris et revérifiées chaque minute. La décoration festive remplace temporairement l’effet saisonnier. Les publicités restent disponibles.

Ce calendrier regroupe les principales occasions sélectionnées pour Blanco ; il ne prétend pas couvrir chaque fête de toutes les confessions. Les décorations ne nécessitent aucun service externe. Les réglages et corrections ne sont publiés qu’après « Publier les modifications ».
