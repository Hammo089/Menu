import { createContext, useContext, useState, type ReactNode } from 'react';
import { storageGet, storageSet } from './lib';
export const arabic: Record<string, string> = {
  'Blanco — Gestion fidélité': 'Blanco — إدارة الولاء',
  'Le service fidélité n’est pas configuré.': 'خدمة الولاء غير مهيأة.',
  'Connexion impossible. Vérifiez votre adresse et votre mot de passe.':
    'تعذّر الدخول. تأكد من البريد وكلمة المرور.',
  'Une opération est en attente de confirmation. Confirmez-la avec le bouton « Vérifier et réessayer » avant de continuer.':
    'هناك عملية بانتظار التأكيد. اضغط «التحقق وإعادة المحاولة» قبل المتابعة.',
  'Tampons ajoutés. La carte du client se met à jour automatiquement.':
    'تمت إضافة الأختام. تتحدث بطاقة الزبون تلقائيًا.',
  'Cadeau enregistré comme utilisé.': 'تم تسجيل استخدام الهدية.',
  'Opération annulée.': 'تم التراجع عن العملية.',
  'ESPACE FIDÉLITÉ': 'إدارة برنامج الولاء',
  'Gestion du menu': 'إدارة المنيو',
  Déconnexion: 'تسجيل الخروج',
  'Un instant…': 'لحظة من فضلك…',
  'Accès réservé à l’équipe.': 'الدخول مخصص للفريق.',
  'Bonjour, l’équipe.': 'أهلًا بفريق Blanco.',
  'Ce compte n’a pas accès à la fidélité. Demandez au responsable de l’autoriser.':
    'هذا الحساب غير مخوّل لإدارة الولاء. اطلب من المسؤول منحه الصلاحية.',
  'Changer de compte': 'تغيير الحساب',
  'Connectez-vous avec votre compte de gestion Blanco.': 'ادخل بحساب إدارة Blanco الخاص بك.',
  'Adresse e-mail': 'البريد الإلكتروني',
  'Mot de passe': 'كلمة المرور',
  'Connexion…': 'جارٍ الدخول…',
  'Se connecter': 'تسجيل الدخول',
  'BLANCO CLUB · GRENOBLE': 'BLANCO CLUB · غرونوبل',
  'Chaque visite compte.': 'كل زيارة إلها قيمة.',
  'Un scan, un sourire, une petite attention.': 'مسحة QR، ابتسامة، وهدية لطيفة.',
  'Voir la carte client': 'عرض صفحة الزبائن',
  'Gestion fidélité': 'إدارة الولاء',
  'Clients & caisse': 'الزبائن والكاشير',
  Programme: 'إعدادات البرنامج',
  'QR d’inscription': 'QR التسجيل',
  Équipe: 'الفريق',
  'Opération en attente sur la carte': 'عملية معلّقة على البطاقة',
  '. Réessayez avec le même identifiant : elle ne sera pas comptée deux fois.':
    ' . أعد المحاولة بنفس رقم العملية حتى لا تُحتسب مرتين.',
  'Vérifier et réessayer': 'التحقق وإعادة المحاولة',
  'À POSER PRÈS DE LA CAISSE': 'توضع قرب الكاشير',
  'Un café aujourd’hui.': 'قهوة اليوم.',
  'Une attention demain.': 'وهدية بكرا.',
  'Scannez. Inscrivez-vous. Cumulez vos petits bonheurs.': 'امسح الرمز، سجّل، واجمع أختامك.',
  'QR pour s’inscrire au programme fidélité': 'رمز QR للتسجيل في برنامج الولاء',
  'Imprimer l’affiche': 'طباعة اللوحة',
  'Une équipe de confiance.': 'فريق بتوثق فيه.',
  'Les équipiers peuvent chercher une carte, ajouter des tampons, utiliser un cadeau et annuler leur dernière opération pendant 15 minutes. Le responsable garde les réglages, la récupération et la suppression des comptes.':
    'يمكن للفريق البحث عن بطاقة وإضافة أختام وتسليم هدية والتراجع عن آخر عملية خلال ١٥ دقيقة. تبقى الإعدادات واسترجاع الحسابات وحذفها للمسؤول فقط.',
  'Créez d’abord le compte confirmé dans Supabase → Authentication → Users, puis autorisez son e-mail ici. Les identifiants ne se partagent pas.':
    'أنشئ أولًا حسابًا مؤكدًا في Supabase ← Authentication ← Users، ثم امنح بريده الصلاحية هنا. لا تشاركوا حسابًا واحدًا.',
  'Accès accordé.': 'تم منح الصلاحية.',
  'E-mail de l’équipier': 'بريد الموظف',
  Autoriser: 'منح الصلاحية',
  Autorisé: 'مخوّل',
  'Accès suspendu': 'الصلاحية معلّقة',
  Suspendre: 'تعليق الصلاحية',
  Réactiver: 'إعادة التفعيل',
  'Tous les clients': 'كل الزبائن',
  'CARTE CLIENT': 'بطاقة الزبون',
  'Inscrit le': 'تاريخ التسجيل',
  'APRÈS LE PAIEMENT': 'بعد الدفع',
  'Une pause de plus.': 'زيارة جديدة، ختم جديد.',
  'Nombre de boissons payées': 'عدد المشروبات المدفوعة',
  'J’ai vérifié les boissons payées et éligibles. Les boissons offertes ne comptent pas.':
    'تأكدت من المشروبات المدفوعة والمشمولة بالبرنامج. المشروبات المجانية لا تُحتسب.',
  'Enregistrement…': 'جارٍ الحفظ…',
  'Le programme est en pause. Les cadeaux déjà gagnés restent utilisables.':
    'البرنامج متوقف مؤقتًا. يمكن استخدام الهدايا المكتسبة سابقًا.',
  'Carte à compléter avant le': 'أكمل البطاقة قبل',
  'LE PLAISIR D’OFFRIR': 'فرحة الهدية',
  'Ses cadeaux.': 'هداياه.',
  'Encore quelques pauses avant le premier cadeau.': 'باقي زيارات قليلة قبل الهدية الأولى.',
  'Déjà utilisé': 'مستخدمة سابقًا',
  Expiré: 'منتهية الصلاحية',
  'Confirmer la remise du cadeau au client ? Aucun tampon ne sera ajouté.':
    'تأكيد تسليم الهدية للزبون؟ لن يُضاف ختم مقابلها.',
  'Confirmer l’utilisation': 'تأكيد استخدام الهدية',
  Annuler: 'إلغاء',
  'Utiliser ce cadeau': 'تسليم هذه الهدية',
  'Annuler la dernière opération sur cette carte ?': 'التراجع عن آخر عملية على هذه البطاقة؟',
  'Annuler la dernière opération (15 min)': 'التراجع عن آخر عملية (١٥ دقيقة)',
  'Assistance & données du client': 'المساعدة وبيانات الزبون',
  'Vérifiez toujours l’identité du client au comptoir avant de renouveler son accès.':
    'تأكد دائمًا من هوية الزبون عند الكاشير قبل تجديد رابط بطاقته.',
  'Retrouver son accès': 'استرجاع رابط بطاقته',
  'Supprimer ses données': 'حذف بياناته',
  Clients: 'الزبائن',
  'Boissons fidélisées': 'المشروبات المحتسبة',
  'Cadeaux à utiliser': 'هدايا بانتظار الاستخدام',
  'Cadeaux savourés': 'هدايا تم تسليمها',
  'LE GESTE SIMPLE EN CAISSE': 'خطوة سهلة عند الكاشير',
  'Bonjour, les habitués.': 'أهلًا بأصحاب الزيارات الحلوة.',
  'Préparation de la caméra…': 'جارٍ تجهيز الكاميرا…',
  'Vérifiez le code (BL-12345-ABCDE).': 'تأكد من الكود (BL-12345-ABCDE).',
  'Ou saisir le code de la carte': 'أو أدخل كود البطاقة',
  Ouvrir: 'فتح البطاقة',
  'UNE CARTE ÉGARÉE ?': 'البطاقة ضاعت؟',
  'Retrouver un client.': 'البحث عن زبون.',
  'Rechercher un client': 'البحث عن زبون',
  'Nom, téléphone ou code…': 'الاسم، الهاتف أو الكود…',
  'Recherche par nom ou par au moins 4 chiffres du téléphone. Vérifiez les homonymes avec le numéro.':
    'ابحث بالاسم أو بأربعة أرقام على الأقل من الهاتف. تأكد من الرقم عند تشابه الأسماء.',
  tampons: 'أختام',
  'Recherche…': 'جارٍ البحث…',
  'Aucun client trouvé.': 'لم يتم العثور على زبائن.',
  Précédents: 'السابق',
  Page: 'الصفحة',
  Suivants: 'التالي',
  'Sa carte est retrouvée.': 'بطاقته رجعت.',
  'Redonner accès à sa carte.': 'استرجاع رابط البطاقة.',
  'Le solde et les cadeaux sont conservés. L’ancien lien ne fonctionne plus. Demandez au client de scanner ce QR et d’enregistrer sa nouvelle carte.':
    'الأختام والهدايا محفوظة. توقف الرابط القديم. اطلب من الزبون مسح هذا الرمز وحفظ بطاقته بالرابط الجديد.',
  'Nouveau lien privé à remettre uniquement au client': 'رابط خاص جديد يُسلّم لصاحب البطاقة فقط',
  'Ouvrir son nouveau lien': 'فتح رابطه الجديد',
  'Lien copié. Remettez-le uniquement à ce client.': 'تم نسخ الرابط. سلّمه لهذا الزبون فقط.',
  'Copie impossible. Utilisez le QR.': 'تعذّر النسخ. استخدم رمز QR.',
  'Copier son lien privé': 'نسخ رابطه الخاص',
  Pour: 'للزبون',
  '. Faites dire son numéro au client, sans le lui souffler, pour distinguer les homonymes.':
    ' . اطلب من الزبون ذكر رقمه بنفسه للتأكد عند تشابه الأسماء.',
  'Les 4 derniers chiffres de son téléphone': 'آخر ٤ أرقام من هاتفه',
  'Le client est présent et j’ai vérifié son identité et son numéro.':
    'الزبون موجود وتأكدت من هويته ورقم هاتفه.',
  'L’ancien lien personnel sera désactivé. Les tampons, les cadeaux et le code de caisse sont conservés.':
    'سيتم إيقاف الرابط القديم وجلسات الأجهزة السابقة. تبقى الأختام والهدايا وكود الكاشير محفوظة.',
  'Créer son nouveau lien': 'إنشاء رابطه الجديد',
  'Supprimer définitivement sa carte ?': 'حذف بطاقته نهائيًا؟',
  'À la demande du client, cette action efface son nom, son téléphone, ses tampons, ses cadeaux et son historique. Elle ne peut pas être annulée.':
    'بناءً على طلب الزبون، سيتم حذف اسمه ورقمه وأختامه وهداياه وسجلّه. لا يمكن التراجع عن هذا الحذف.',
  'Les données de ce client ont été supprimées.': 'تم حذف بيانات هذا الزبون.',
  Recopiez: 'اكتب الكود',
  'pour confirmer': 'للتأكيد',
  'Effacer définitivement': 'الحذف النهائي',
  'VOTRE PROGRAMME, VOS RÈGLES': 'برنامجك، وشروطك',
  'Les petites attentions.': 'تفاصيل الهدية الحلوة.',
  'Les nouveaux réglages s’appliquent aux prochaines cartes. Les cartes en cours et les cadeaux déjà gagnés conservent leurs conditions.':
    'تُطبّق الإعدادات الجديدة على البطاقات القادمة. تحتفظ البطاقات الحالية والهدايا المكتسبة بشروطها السابقة.',
  'Programme actif (inscriptions et nouveaux tampons)': 'البرنامج فعّال (التسجيل وإضافة الأختام)',
  'Phrase d’accueil': 'عبارة الترحيب بالفرنسي',
  'Boissons pour obtenir un cadeau': 'عدد المشروبات للحصول على هدية',
  'Délai pour compléter une carte (jours)': 'مهلة إكمال البطاقة (بالأيام)',
  'Type de cadeau': 'نوع الهدية',
  'Boisson offerte': 'مشروب مجاني',
  'Réduction en %': 'خصم بالنسبة المئوية',
  'Réduction en €': 'خصم باليورو',
  'Nom du cadeau': 'اسم الهدية بالفرنسي',
  'Pourcentage de réduction': 'نسبة الخصم',
  'Montant de réduction (€)': 'قيمة الخصم (€)',
  'Prix maximum offert (€ ; 0 = sans plafond)': 'السعر الأقصى للمشروب المجاني (€؛ صفر = بلا حد)',
  'Validité du cadeau (jours depuis obtention)': 'صلاحية الهدية (أيام من الحصول عليها)',
  'Maximum de tampons par carte et par jour': 'الحد الأقصى للأختام لكل بطاقة في اليوم',
  'Cadeau utilisable dès le lendemain, à minuit à Grenoble (sinon immédiatement)':
    'استخدام الهدية من اليوم التالي، منتصف الليل بتوقيت غرونوبل (وإلا فورًا)',
  'Boissons éligibles et conditions': 'المشروبات المشمولة والشروط بالفرنسي',
  'Une boisson payée = un tampon. Le contrôle des achats se fait en caisse ; aucune connexion automatique à votre caisse enregistreuse.':
    'كل مشروب مدفوع يساوي ختمًا. يتم التأكد من المشتريات عند الكاشير؛ لا يوجد ربط تلقائي بجهاز المحاسبة.',
  'Les règles ont été enregistrées.': 'تم حفظ شروط البرنامج.',
  'Enregistrer le programme': 'حفظ إعدادات البرنامج',
  'Ce QR n’est pas une carte Blanco.': 'هذا الرمز ليس لبطاقة Blanco.',
  'Caméra indisponible. Autorisez la caméra, importez une photo ou saisissez le code.':
    'الكاميرا غير متاحة. اسمح باستخدامها، أو ارفع صورة للرمز، أو اكتب الكود.',
  'Caméra pour scanner la carte': 'كاميرا لمسح البطاقة',
  'Arrêter la caméra': 'إيقاف الكاميرا',
  'Scanner une carte': 'مسح بطاقة',
  'Photo du QR': 'صورة رمز QR',
  'Choisissez une photo de moins de 12 Mo.': 'اختر صورة أصغر من ١٢ ميغابايت.',
  'QR illisible. Essayez une photo plus nette ou saisissez le code.':
    'الرمز غير مقروء. جرّب صورة أوضح أو اكتب الكود.',
  'La caméra et les photos sont traitées sur cet appareil, jamais envoyées au serveur.':
    'تُعالج الكاميرا والصور على هذا الجهاز فقط، ولا تُرسل إلى الخادم.',
  'Code QR': 'رمز QR',
  'Préparation du QR…': 'جارٍ تجهيز الرمز…',
  'Télécharger le QR': 'تنزيل رمز QR',
  Fermer: 'إغلاق',
  Bonjour: 'أهلًا',
  'Votre prochaine pause se prépare.': 'زيارتك الجاية بتقرّبك من الهدية.',
  pause: 'زيارة',
  'avant votre cadeau': 'قبل هديتك',
  'Une habitude qui fait plaisir.': 'زيارات بتجيب هدايا.',
  'boissons payées en': 'مشروبات مدفوعة خلال',
  'jours à partir du premier tampon =': 'يومًا من أول ختم =',
  '. Cadeau valable': ' . الهدية صالحة لمدة',
  'jours à partir de son obtention, utilisable': 'يومًا من الحصول عليها، ويمكن استخدامها',
  'dès le lendemain (heure de Grenoble)': 'من اليوم التالي (بتوقيت غرونوبل)',
  immédiatement: 'فورًا',
  '. Après le cadeau, une nouvelle carte commence au prochain tampon.':
    ' . بعد الهدية تبدأ بطاقة جديدة عند الختم التالي.',
  'Carte personnelle. Les tampons expirés ne sont pas reportés. Les règles d’une carte commencée restent identiques jusqu’à sa fin.':
    'البطاقة شخصية. لا تُنقل الأختام المنتهية. تبقى شروط البطاقة التي بدأت كما هي حتى نهايتها.',
  'Mes dernières visites': 'الزيارات الأخيرة',
  'boissons au total': 'مشروبات بالمجموع',
  'Cadeau utilisé': 'تم استخدام هدية',
  'Accès à la carte renouvelé': 'تم تجديد رابط البطاقة',
  'Opération annulée': 'تم التراجع عن عملية',
  'La première pause vous attend ☕': 'الزيارة الأولى ناطرتك ☕',
  'Ajouter {0} tampon{1}': 'إضافة {0} أختام',
  'Disponible le {0}': 'متاحة بتاريخ {0}',
  'Valable jusqu’au {0}': 'صالحة حتى {0}',
  ' · {0} cadeau(x)': ' · {0} هدايا',
  '{0} tampons sur {1}': '{0} أختام من {1}',
  '+{0} tampon{1}': '+{0} أختام',
  'Le service fidélité est indisponible. Réessayez dans un instant.':
    'خدمة الولاء غير متاحة. حاول بعد لحظات.',
  'Connexion nécessaire. Aucun changement n’a été envoyé.':
    'الاتصال بالإنترنت مطلوب. لم يُرسل أي تعديل.',
  'La connexion n’a pas abouti. Réessayez : une opération ne sera comptée qu’une fois.':
    'تعذّر الاتصال. أعد المحاولة؛ لن تُحتسب العملية أكثر من مرة.',
  'Accès réservé à l’équipe Blanco.': 'الدخول مخصص لفريق Blanco.',
  'Seul le responsable peut modifier le programme.': 'يمكن للمسؤول فقط تعديل البرنامج.',
  'Vérifiez les règles du programme.': 'تأكد من شروط البرنامج.',
  'Vérifiez la valeur du cadeau.': 'تأكد من قيمة الهدية.',
  'Le programme a changé. Rechargez avant de réessayer.':
    'تغيرت إعدادات البرنامج. حدّث الصفحة قبل إعادة المحاولة.',
  'Carte introuvable. Vérifiez le code ou cherchez le prénom.':
    'البطاقة غير موجودة. تأكد من الكود أو ابحث بالاسم.',
  'Le programme est en pause.': 'البرنامج متوقف مؤقتًا.',
  'Limite quotidienne atteinte pour cette carte.': 'وصلت هذه البطاقة للحد اليومي من الأختام.',
  'Ce cadeau est indisponible, expiré ou déjà utilisé.':
    'هذه الهدية غير متاحة أو منتهية أو مستخدمة سابقًا.',
  'Cette opération ne peut plus être annulée.': 'لم يعد ممكنًا التراجع عن هذه العملية.',
  'Vérifiez avec le client les quatre derniers chiffres de son téléphone.':
    'تأكد مع الزبون من آخر أربعة أرقام من هاتفه.',
  'La récupération est réservée au responsable.': 'استرجاع الحساب مخصص للمسؤول.',
  'Confirmation du responsable requise.': 'تأكيد المسؤول مطلوب.',
  'Confirmez le nombre de boissons payées (1 à 50).': 'أكد عدد المشروبات المدفوعة (من ١ إلى ٥٠).',
  'Accès responsable requis.': 'صلاحية المسؤول مطلوبة.',
  'Créez et confirmez ce compte dans Supabase Authentication avant de lui donner accès.':
    'أنشئ هذا الحساب وأكده في Supabase Authentication قبل منحه الصلاحية.',
  'Identifiant de transaction déjà utilisé.': 'رقم العملية مستخدم لعملية أخرى.',
  'Un cadeau issu de cette opération a déjà été utilisé.':
    'تم استخدام هدية ناتجة عن هذه العملية بالفعل.',
};
export function translate(text: string, lang: 'ar' | 'fr', ...values: (string | number)[]) {
  let result = lang === 'ar' ? arabic[text] || text : text;
  if (lang === 'ar' && !arabic[text]) {
    if (/^\d+ % de réduction$/.test(text)) result = text.replace(' % de réduction', '٪ خصم');
    else if (text.endsWith(' de réduction')) result = text.replace(' de réduction', ' خصم');
    else if (text.startsWith('Une boisson offerte'))
      result = text.replace('Une boisson offerte', 'مشروب مجاني').replace(' jusqu’à ', ' حتى ');
  }
  values.forEach((value, i) => {
    result = result.replaceAll(`{${i}}`, String(value));
  });
  return result;
}
const Language = createContext({
  lang: 'fr' as 'ar' | 'fr',
  setLang: (_lang: 'ar' | 'fr') => {},
  t: (s: string, ...v: (string | number)[]) => translate(s, 'fr', ...v),
});
export function LoyaltyLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLanguage] = useState<'ar' | 'fr'>(() =>
    storageGet('blanco-loyalty-admin-language') === 'ar' ? 'ar' : 'fr',
  );
  const setLang = (value: 'ar' | 'fr') => {
    setLanguage(value);
    storageSet('blanco-loyalty-admin-language', value);
  };
  return (
    <Language.Provider
      value={{ lang, setLang, t: (s, ...values) => translate(s, lang, ...values) }}
    >
      {children}
    </Language.Provider>
  );
}
export const useLoyaltyLanguage = () => useContext(Language);
export function FrenchLoyaltyContent({ children }: { children: ReactNode }) {
  return (
    <Language.Provider
      value={{ lang: 'fr', setLang: () => {}, t: (s, ...v) => translate(s, 'fr', ...v) }}
    >
      <div lang="fr" dir="ltr">
        {children}
      </div>
    </Language.Provider>
  );
}
