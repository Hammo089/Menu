# Blanco TV — pilote Android TV

لوحة الإدارة: https://blanco-menu-one.vercel.app/admin/screens

APK: https://raw.githubusercontent.com/Hammo089/Menu/main/android-tv/dist/blanco-tv-pilot.apk

## الربط والخروج

التطبيق يحتاج Android 8 أو أحدث وAndroid System WebView مفعّل لعرض المنيو وصفحات الويب. ثبّت APK ثم افتحه: يظهر رمز ربط صالح 15 دقيقة. من حساب إدارة Blanco افتح إدارة الشاشات، أدخل الرمز واختر اسم الشاشة وكود خروج خاص من 6 إلى 12 رقماً. لا يوجد كود خروج افتراضي أو كود رئيسي عام.

زر الرجوع أو الضغط المطوّل على Menu أو زاوية الشاشة يفتح إدخال الكود. التحقق محلي ويعمل دون إنترنت. بعد خمس محاولات خاطئة يبدأ تأخير يتزايد إلى 30 دقيقة. من القائمة المحمية يمكنك العودة للعرض أو فتح إعدادات Android أو اختيار تطبيق الشاشة الرئيسية. جلسة الإدارة المحلية مدتها 15 دقيقة.

يمكن تغيير الكود من لوحة الإدارة؛ يجب أن تتصل الشاشة لتستقبل التغيير. قبل إلغاء ربط شاشة نسيت كودها غيّر الكود واتركها تتزامن أولاً: الشاشة الملغاة لا تستقبل إعدادات جديدة. فقدان الإنترنت وحده لا يفتح القفل.

## المحتوى والمواعيد

اختر المنيو أو رابط HTTPS أو قائمة صور وفيديو وصفحات، ثم الاتجاه والدوران. المنيو المتصل يعرض التعديلات المعتادة؛ عند انقطاع الشبكة تظهر آخر نسخة محفوظة دون مؤثرات المواسم. رابط QR مخصص غير محفوظ لا يُستبدل برابط خاطئ في النسخة المحلية. الصور والفيديو تُحفظ محلياً حتى 25MB للملف و200MB للمجموع؛ استخدم روابط مباشرة وصيغاً يدعمها الجهاز، ويفضّل MP4 H.264 وصور JPEG/PNG. صفحات الويب الخارجية تحتاج اتصالاً ولا يُضمن عملها دون شبكة.

الجدول أسبوعي بتوقيت Europe/Paris، يشمل التوقيت الصيفي وفترات تتجاوز منتصف الليل. خارج ساعات العرض تظهر شاشة سوداء. هذا لا يعني قطع كهرباء التلفزيون. أوامر السكون تحتاج إذن مسؤول الجهاز؛ إعادة التشغيل تحتاج Device Owner. محاولة الإيقاظ تعتمد على العتاد والنظام ولا تضمن تشغيل تلفزيون مفصول أو مستيقظ عبر HDMI. المزامنة عادة كل 15 ثانية عند تشغيل الخدمة؛ أوامر التحكم تنتهي بعد دقيقتين ولا تُعاد بلا نهاية. «تم الطلب» تعني إرسال الطلب للنظام؛ سجل الأوامر يميّز الاستلام والنتيجة.

## تهيئة الجهاز لاحقاً

هذه نسخة تجريبية مبنية ومختبرة برمجياً؛ لم تُختبر على التلفزيون الفعلي بعد. أرسل الموديل وإصدار Android قبل التهيئة. الوضع العادي يخفي أشرطة المتصفح ويحمي قائمة التطبيق بالكود، لكن زر Home قد يغادره. القفل الكامل يتطلب دعماً وتهيئة Device Owner؛ إعداد تطبيق Home والتشغيل عند الإقلاع يختلف حسب الجهاز. تفعيل Developer options وحده لا يكفي.

لم ننفذ إزالة تطبيقات أو تعطيل المشغل الأصلي أو root أو إعادة ضبط مصنع. مرجع التحضير الآمن: https://github.com/Gathin23/cleanyourtv — تؤخذ نسخة من قائمة الحزم قبل أي تغيير، ويبقى المشغل الأصلي حتى اختبار البديل. لا تفتح منفذ ADB على الراوتر؛ أغلق تصحيح الشبكة بعد الإعداد. لا تُنفذ إعادة ضبط مصنع تلقائياً من هذا المشروع.

## Installation / exploitation

Android 8+ et WebView système requis pour le menu. Installer le pilote, relever le code de jumelage, puis associer l’écran depuis le compte administrateur. Choisir un PIN de sortie personnel. Retour / appui long Menu / coin de l’écran ouvre la saisie du PIN, disponible hors connexion. Réinitialiser le PIN depuis l’administration et attendre la synchronisation avant toute révocation.

Le planning utilise Europe/Paris. Écran noir, veille matérielle et coupure électrique sont des états différents. Le réveil et le verrouillage intégral dépendent du modèle et de sa configuration. Ne pas considérer ce pilote comme une installation matérielle validée.

## Build

`npm ci`, JDK 21, Android SDK platform 34 et build-tools 35.0.0. Définir ANDROID_SDK_ROOT, puis exécuter `android-tv/test.sh` et `android-tv/build.sh`. Le build génère le menu local et signe un APK pilote avec une clé de développement locale ignorée par Git. Conserver cette clé de manière privée si nécessaire pour mettre à jour le même pilote ; les builds CI produisent leur propre signature. Avant distribution durable, choisir et sauvegarder une clé de signature de production privée. Ne jamais publier cette clé dans Git.

Tests : politiques PIN/planning Java, RPC/RLS PostgreSQL, interface et rendu hors connexion dans Chromium. Les commandes Android de verrouillage, veille, réveil, démarrage et lecture vidéo restent à vérifier sur le téléviseur.

## أداة الكمبيوتر / Installation Windows

تحميل الحزمة المحمولة: https://raw.githubusercontent.com/Hammo089/Menu/main/android-tv/dist/Blanco-TV-Windows.zip

Windows 10/11: فك الضغط كاملاً وشغّل Start-Blanco.cmd. تحتوي الحزمة على APK وADB الرسمي، وتفحص بصمات الملفات قبل الاتصال. أدخل IP التلفزيون ومنفذ الاتصال إن كان مختلفاً عن 5555. إذا الجهاز يستخدم Wireless debugging، أدخل أيضاً منفذ الاقتران والكود الذي يعرضه Android. وافق على رسالة التفويض من التلفزيون. الأداة لا تحتاج صلاحيات Administrator على الكمبيوتر.

تأخذ نسخة من قائمة الحزم والمشغّل السابق، تثبّت التطبيق وتفتحه، وتعيّنه Home حيث يدعم النظام. يمكنها محاولة Device Owner دون حذف حسابات أو إعادة ضبط؛ إذا رفض Android، يظهر بوضوح أن القفل الكامل لم يُفعّل. التطبيق لا يقفل الشاشة إلا بعد الربط وتحديد PIN خروج. امسح QR الظاهر على التلفزيون لفتح الإدارة مع رمز الاقتران جاهزاً؛ QR لا يتضمن PIN أو سر الجهاز. تسجيل دخول المالك مطلوب دائماً. رمز Android اللاسلكي ورمز اقتران Blanco مختلفان عن PIN الخروج.

الحزمة لا تعطّل المشغّل الأصلي. فشل التثبيت يوقف الإعداد قبل تغيير Home أو Device Owner. إذا فشلت محاولة تشغيل التطبيق النهائية تحاول إعادة Home السابق. النسخ تحفظ في LOCALAPPDATA/BlancoTV/Backups. افصل الاتصال من الأداة وأغلق network debugging على التلفزيون بعد التجربة؛ إدارة المحل العادية لا تحتاج ADB. Windows قد يعرض تنبيهاً لأن السكريبت غير موقّع؛ لا تعطل الحماية الأمنية أو سياسات المؤسسة لتشغيله.

تجارب الأداة تغطي قبول الجهاز، رفض Device Owner، فشل التثبيت والتشغيل، رفض التفويض، Android قديم، وإرجاع Home بعد فشل التشغيل النهائي. اختبار QR يفك الرمز الحقيقي ويتحقق من رابط الإدارة. التنفيذ على تلفزيون حقيقي وتجربة Windows الفعلية لم تتم بعد.
