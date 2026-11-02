# Blanco TV 1.4 — وضع عرض اختياري / Affichage facultatif

تنزيل: https://blanco-menu-one.vercel.app/telecharger
إدارة: https://blanco-menu-one.vercel.app/admin/screens

## السلوك الحالي

هذا وضع عرض مستمر بدون استبدال مشغّل Fire TV أو قفل زر Home. يطلب التطبيق الرجوع للواجهة عند استيقاظ الشاشة وأثناء جلسة العرض إذا صار بالخلفية، مع مهلة 30 ثانية بين الطلبات. ما بيشغّل أو بيوقظ التلفزيون من تلقاء نفسه. النظام قد يمنع الفتح أو يقتل الخدمة، لذلك لا نضمن كيوسكاً كاملاً على Fire TV.

للخروج: اضغط زر رجوع 7 مرات خلال 5 ثوانٍ، أو انقر الزاوية العلوية اليسرى 7 مرات، ثم أدخل PIN. الكود الصحيح يرجع مباشرة لواجهة التلفزيون ويحفظ حالة خروج توقف محاولات الاستئناف. فتح Blanco يدوياً يبدأ جلسة جديدة؛ الإقلاع الكامل يبدأ جلسة إذا خيار التشغيل التلقائي مفعّل. للوصول للإعدادات بدل الخروج، حدّد خيار الإدارة داخل نافذة PIN قبل إدخال الكود. الصيانة تمنع إعادة الفتح لمدة 15 دقيقة. الإلغاء أو الكود الخطأ لا يخرجان من وضع العرض.

التشغيل بعد الإقلاع الكامل عبر BOOT_COMPLETED يبقى اختيارياً. SCREEN_ON يستدعي محاولة العودة عند الاستيقاظ إذا لم يخرج المالك بالكود. السكون الفعلي وإلغاء الربط يمنعان الاستئناف. أوامر الطاقة معطلة، والجدول يتحكم بالعرض/السواد داخل التطبيق فقط.

## أداة Windows

فك ZIP كاملاً وشغّل Start-Blanco.cmd. أدخل IP، ووافق على تفويض ADB من التلفزيون. الفحص الأول يقرأ فقط الموديل وإصدار Android والمشغّل الحالي. التثبيت يحتاج اختيار y؛ الخيار الافتراضي N ينهي الفحص بدون تثبيت. الأداة تثبت APK وتفتحه فقط، ولا تغيّر Home أو Device Owner أو إعدادات النظام. لا حذف حسابات أو تطبيقات نظام أو ضبط مصنع. سجلات الفحص في LOCALAPPDATA/BlancoTV/Backups.

بعد تشغيل التطبيق امسح QR لتسجيل دخول إدارة Blanco وتحديد PIN الخروج من 6 إلى 12 رقماً. رمز الربط صالح 15 دقيقة وليس PIN الخروج. PIN يعمل دون إنترنت مع تأخير بعد المحاولات الخاطئة؛ يمكن تغييره من الإدارة عند اتصال الشاشة. غيّره وانتظر المزامنة قبل إلغاء الربط إذا نسيته.

إذا سبق تثبيت النسخة القديمة مع تغيير Home أو Device Owner، هذه الأداة لا تزيل تلك الإعدادات القديمة تلقائياً. يلزم فحصها أولاً. لم يتم اختبار التلفزيون الفعلي أو Windows الفعلي بعد؛ لا نقدم ضماناً لكل جهاز. Fire OS 7 مناسب مبدئياً من حيث Android 9، ويحتاج System WebView. بعد الإعداد افصل ADB وأغلق network debugging؛ إدارة Blanco تستخدم HTTPS.

## Contenu / fonctionnement

Affichage continu sans remplacer Home ni bloquer le bouton système. Retour ×7 en cinq secondes puis PIN rend immédiatement l’accueil TV ; le choix Administration ouvre les réglages protégés. La sortie volontaire reste enregistrée jusqu’à une ouverture manuelle ou au prochain démarrage complet si l’option est active. La reprise au réveil et en arrière-plan est demandée au plus une fois par 30 secondes et reste dépendante de Fire OS. Aucun réveil matériel, autorisation overlay ou changement de Device Owner n’est ajouté. Le premier diagnostic Windows reste en lecture seule.

Menu et médias conservés hors ligne : dernière copie synchronisée, médias directs HTTPS de 25MB maximum, cache privé 200MB. Les pages externes nécessitent Internet. Le planning Europe/Paris, y compris minuit et changement d’heure, agit seulement pendant l’affichage Blanco. Le QR personnalisé non disponible est masqué dans le menu local plutôt que remplacé par un mauvais lien. Les effets saisonniers ne sont pas inclus hors ligne.

## Build et vérification

JDK21, SDK34, build-tools35.0.0, npm ci, android-tv/test.sh puis android-tv/build.sh. Clé pilote locale ignorée par Git ; ne pas publier de clé de signature. Emballer avec node android-tv/installer/package.mjs chemin/platform-tools-windows.zip. Google ADB et ses licences restent intacts. Référence de préparation : https://github.com/Gathin23/cleanyourtv ; aucune suppression de paquets de cette méthode n’est exécutée.

Tests : PIN/planning Java, RPC/RLS PostgreSQL, interface bilingue, QR décodé, installation simulée avec liste autorisée de commandes et inspection en lecture seule. Validation sur matériel encore nécessaire.

Tests 1.4 : sept pressions, expiration du geste, sortie PIN persistée, absence de reprise pendant sommeil/codage/maintenance/révocation, et compilation Android. Le geste et la reprise nécessitent encore une validation physique sur Fire TV.
