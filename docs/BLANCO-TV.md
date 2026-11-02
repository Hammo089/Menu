# Blanco TV 1.2 — وضع عرض اختياري / Affichage facultatif

تنزيل: https://blanco-menu-one.vercel.app/telecharger
إدارة: https://blanco-menu-one.vercel.app/admin/screens

## السلوك الحالي

هذا تطبيق ملء الشاشة تفتحه يدوياً من تطبيقات التلفزيون. لا يحل مكان Fire TV ولا يشتغل تلقائياً عند الإقلاع. زر Home يبقى متاحاً، لذلك هذه النسخة ليست قفل كيوسك كامل. للخروج من داخل التطبيق: رجوع ثم PIN ثم «الرجوع للتلفزيون». إعادة تحميل من الإدارة لا تعيد فتح التطبيق بعد مغادرته. أوامر الطاقة معطلة في هذه النسخة، والجدول يحدد عرض المحتوى/الشاشة السوداء داخل التطبيق فقط.

## أداة Windows

فك ZIP كاملاً وشغّل Start-Blanco.cmd. أدخل IP، ووافق على تفويض ADB من التلفزيون. الفحص الأول يقرأ فقط الموديل وإصدار Android والمشغّل الحالي. التثبيت يحتاج اختيار y؛ الخيار الافتراضي N ينهي الفحص بدون تثبيت. الأداة تثبت APK وتفتحه فقط، ولا تغيّر Home أو Device Owner أو إعدادات النظام. لا حذف حسابات أو تطبيقات نظام أو ضبط مصنع. سجلات الفحص في LOCALAPPDATA/BlancoTV/Backups.

بعد تشغيل التطبيق امسح QR لتسجيل دخول إدارة Blanco وتحديد PIN الخروج من 6 إلى 12 رقماً. رمز الربط صالح 15 دقيقة وليس PIN الخروج. PIN يعمل دون إنترنت مع تأخير بعد المحاولات الخاطئة؛ يمكن تغييره من الإدارة عند اتصال الشاشة. غيّره وانتظر المزامنة قبل إلغاء الربط إذا نسيته.

إذا سبق تثبيت النسخة القديمة مع تغيير Home أو Device Owner، هذه الأداة لا تزيل تلك الإعدادات القديمة تلقائياً. يلزم فحصها أولاً. لم يتم اختبار التلفزيون الفعلي أو Windows الفعلي بعد؛ لا نقدم ضماناً لكل جهاز. Fire OS 7 مناسب مبدئياً من حيث Android 9، ويحتاج System WebView. بعد الإعداد افصل ADB وأغلق network debugging؛ إدارة Blanco تستخدم HTTPS.

## Contenu / fonctionnement

Ouvrir Blanco manuellement depuis les applications TV. Home reste utilisable. Retour + PIN ouvre «Retour à Fire TV». Pas de changement de lanceur, Device Owner, verrouillage système ou démarrage automatique. Le premier diagnostic Windows est en lecture seule ; l’installation est désactivée par défaut. Une installation existante de l’ancienne version administrée ne sera pas reconfigurée silencieusement.

Menu et médias conservés hors ligne : dernière copie synchronisée, médias directs HTTPS de 25MB maximum, cache privé 200MB. Les pages externes nécessitent Internet. Le planning Europe/Paris, y compris minuit et changement d’heure, agit seulement pendant l’affichage Blanco. Le QR personnalisé non disponible est masqué dans le menu local plutôt que remplacé par un mauvais lien. Les effets saisonniers ne sont pas inclus hors ligne.

## Build et vérification

JDK21, SDK34, build-tools35.0.0, npm ci, android-tv/test.sh puis android-tv/build.sh. Clé pilote locale ignorée par Git ; ne pas publier de clé de signature. Emballer avec node android-tv/installer/package.mjs chemin/platform-tools-windows.zip. Google ADB et ses licences restent intacts. Référence de préparation : https://github.com/Gathin23/cleanyourtv ; aucune suppression de paquets de cette méthode n’est exécutée.

Tests : PIN/planning Java, RPC/RLS PostgreSQL, interface bilingue, QR décodé, installation simulée avec liste autorisée de commandes et inspection en lecture seule. Validation sur matériel encore nécessaire.
