import { db } from './database';
import { v4 as uuid } from 'uuid';
import bcryptjs from 'bcryptjs';

export async function seedDatabase() {
  const userCount = await db.users.count();
  if (userCount > 0) return;

  console.log('🌱 Seeding database...');

  // ============ Create Admin User ============
  const adminPassword = await bcryptjs.hash('admin123', 10);
  await db.users.add({
    id: uuid(),
    email: 'admin@patente.com',
    password: adminPassword,
    name: 'مدير النظام',
    role: 'admin',
    banned: false,
    streak: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // ============ Seed Categories ============
  const catSigns = uuid();
  const catRules = uuid();
  const catSafety = uuid();

  const categories = [
    {
      id: catSigns,
      nameAr: 'إشارات المرور',
      nameIt: 'Segnali Stradali',
      descriptionAr: 'تعلم جميع إشارات المرور الإيطالية',
      icon: 'signpost',
      color: '#ef4444',
      imageUrl: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=250&fit=crop',
      order: 1,
      isPublished: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: catRules,
      nameAr: 'قواعد المرور',
      nameIt: 'Regole della Strada',
      descriptionAr: 'قواعد القيادة والأولوية والسرعة',
      icon: 'gavel',
      color: '#2563eb',
      imageUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=250&fit=crop',
      order: 2,
      isPublished: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: catSafety,
      nameAr: 'السلامة والأمان',
      nameIt: 'Sicurezza Stradale',
      descriptionAr: 'الكحول والمخدرات وأحزمة الأمان',
      icon: 'health_and_safety',
      color: '#16a34a',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=250&fit=crop',
      order: 3,
      isPublished: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await db.categories.bulkAdd(categories);

  // ============ Seed Lessons ============
  const lesson1 = uuid(), lesson2 = uuid(), lesson3 = uuid();
  const lesson4 = uuid(), lesson5 = uuid(), lesson6 = uuid();
  const lesson7 = uuid(), lesson8 = uuid();

  const lessons = [
    {
      id: lesson1, categoryId: catSigns,
      titleAr: 'إشارات الخطر', titleIt: 'Segnali di Pericolo',
      descriptionAr: 'تعلم جميع إشارات التحذير والخطر على الطرق الإيطالية',
      descriptionIt: 'Impara tutti i segnali di pericolo sulle strade italiane',
      contentAr: `إشارات الخطر هي إشارات مثلثة الشكل بحافة حمراء وخلفية بيضاء. توضع عادة على بُعد 150 متراً من مكان الخطر.\n\nأهم إشارات الخطر:\n• منعطف خطير - Curva pericolosa\n• تقاطع طرق - Intersezione\n• مرور مشاة - Attraversamento pedonale\n• أشغال طريق - Lavori in corso\n• طريق زلق - Strada sdrucciolevole\n\nالقواعد الأساسية:\n1. عند رؤية إشارة خطر، يجب تخفيف السرعة\n2. زيادة الانتباه والحذر\n3. الاستعداد للتوقف إذا لزم الأمر`,
      contentIt: 'I segnali di pericolo sono triangolari con bordo rosso e sfondo bianco. Vengono posti a 150m dal pericolo.',
      imageUrl: 'https://images.unsplash.com/photo-1611348586804-61bf6c080437?w=600&h=300&fit=crop',
      order: 1, icon: 'warning', color: '#ef4444', isPublished: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: lesson2, categoryId: catSigns,
      titleAr: 'إشارات المنع', titleIt: 'Segnali di Divieto',
      descriptionAr: 'تعرف على إشارات المنع والتقييد في إيطاليا',
      descriptionIt: 'Scopri i segnali di divieto e limitazione in Italia',
      contentAr: `إشارات المنع هي إشارات دائرية بحافة حمراء وخلفية بيضاء. تفرض قيوداً أو محظورات.\n\nأهم إشارات المنع:\n• ممنوع الدخول - Divieto di accesso\n• ممنوع التجاوز - Divieto di sorpasso\n• ممنوع الوقوف - Divieto di sosta\n• ممنوع التوقف - Divieto di fermata\n• حد السرعة - Limite di velocità\n\nملاحظات مهمة:\n- إشارة نهاية المنع تكون بخطوط سوداء مائلة\n- مخالفة إشارات المنع تؤدي لغرامات كبيرة`,
      contentIt: 'I segnali di divieto sono circolari con bordo rosso e sfondo bianco.',
      imageUrl: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=600&h=300&fit=crop',
      order: 2, icon: 'block', color: '#dc2626', isPublished: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: lesson3, categoryId: catSigns,
      titleAr: 'إشارات الإلزام', titleIt: 'Segnali di Obbligo',
      descriptionAr: 'إشارات الإلزام التي يجب اتباعها أثناء القيادة',
      descriptionIt: 'Segnali di obbligo da seguire durante la guida',
      contentAr: `إشارات الإلزام هي إشارات دائرية زرقاء اللون. تفرض سلوكاً معيناً يجب اتباعه.\n\nأهم إشارات الإلزام:\n• اتجاه إجباري - Direzione obbligatoria\n• دوار - Rotatoria\n• مسار دراجات - Pista ciclabile\n• سرعة دنيا - Velocità minima\n• سلاسل ثلجية - Catene da neve`,
      contentIt: 'I segnali di obbligo sono circolari di colore blu.',
      imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&h=300&fit=crop',
      order: 3, icon: 'arrow_circle_right', color: '#2563eb', isPublished: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: lesson4, categoryId: catRules,
      titleAr: 'قواعد الأولوية', titleIt: 'Regole di Precedenza',
      descriptionAr: 'من له الأولوية في المرور؟ تعلم القواعد الأساسية',
      descriptionIt: 'Chi ha la precedenza? Impara le regole fondamentali',
      contentAr: `قواعد الأولوية من أهم المواضيع في امتحان Patente B:\n\nالقاعدة الأساسية:\n• في التقاطعات بدون إشارات، الأولوية لمن يأتي من اليمين\n• إشارة أعط الأولوية (مثلث مقلوب) تعني أنت تنتظر\n• إشارة قف (STOP) تعني توقف تماماً ثم تقدم\n\nحالات خاصة:\n- سيارات الطوارئ لها الأولوية دائماً\n- عند الخروج من موقف أو ممر خاص، أنت تنتظر الجميع\n- الترام له أولوية خاصة`,
      contentIt: 'Le regole di precedenza sono fondamentali per la patente B.',
      imageUrl: 'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?w=600&h=300&fit=crop',
      order: 1, icon: 'swap_vert', color: '#f59e0b', isPublished: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: lesson5, categoryId: catRules,
      titleAr: 'السرعة والمسافات', titleIt: 'Velocità e Distanze',
      descriptionAr: 'حدود السرعة ومسافات الأمان في إيطاليا',
      descriptionIt: 'Limiti di velocità e distanze di sicurezza in Italia',
      contentAr: `حدود السرعة في إيطاليا:\n\n🏙️ داخل المدينة (Centro abitato): 50 كم/ساعة\n🛣️ خارج المدينة (Extraurbano): 90 كم/ساعة\n🛤️ طريق سريع مزدوج (Superstrada): 110 كم/ساعة\n🏎️ أوتوستراد (Autostrada): 130 كم/ساعة\n\nمسافة الأمان:\n- يجب أن تكون كافية للتوقف بأمان\n- تزداد مع زيادة السرعة\n- في المطر تتضاعف مسافة الفرملة`,
      contentIt: 'I limiti di velocità in Italia variano in base al tipo di strada.',
      imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&h=300&fit=crop',
      order: 2, icon: 'speed', color: '#8b5cf6', isPublished: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: lesson6, categoryId: catRules,
      titleAr: 'التجاوز والمناورات', titleIt: 'Sorpasso e Manovre',
      descriptionAr: 'قواعد التجاوز الآمن والمناورات على الطريق',
      descriptionIt: 'Regole per il sorpasso sicuro e le manovre stradali',
      contentAr: `قواعد التجاوز:\n\n✅ التجاوز يكون من اليسار دائماً\n❌ ممنوع التجاوز عند:\n- المنعطفات بدون رؤية\n- التقاطعات\n- معابر المشاة\n- معابر السكك الحديدية\n- عندما يكون الخط متصلاً\n\nخطوات التجاوز الآمن:\n1. تأكد من خلو الطريق\n2. انظر في المرآة\n3. أشر بالمؤشر\n4. تجاوز بسرعة كافية\n5. عد إلى المسار الأيمن`,
      contentIt: 'Il sorpasso si effettua sempre a sinistra.',
      imageUrl: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&h=300&fit=crop',
      order: 3, icon: 'compare_arrows', color: '#06b6d4', isPublished: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: lesson7, categoryId: catRules,
      titleAr: 'الوقوف والتوقف', titleIt: 'Sosta e Fermata',
      descriptionAr: 'أين يمكنك الوقوف؟ وأين يُمنع التوقف؟',
      descriptionIt: 'Dove puoi sostare? Dove è vietata la fermata?',
      contentAr: `الفرق بين Sosta و Fermata:\n\n🅿️ Fermata (التوقف المؤقت):\n- توقف قصير لإنزال أو إركاب شخص\n- السائق يبقى في السيارة أو بجانبها\n\n🅿️ Sosta (الوقوف/الركن):\n- ترك السيارة لفترة طويلة\n- السائق يبتعد عن السيارة\n\nممنوع الوقوف والتوقف:\n- على الأرصفة\n- في المنعطفات\n- فوق معابر المشاة\n- في الأنفاق\n- على الجسور`,
      contentIt: 'La differenza tra sosta e fermata è fondamentale.',
      imageUrl: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=600&h=300&fit=crop',
      order: 4, icon: 'local_parking', color: '#10b981', isPublished: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: lesson8, categoryId: catSafety,
      titleAr: 'الكحول والمخدرات', titleIt: 'Alcol e Droghe',
      descriptionAr: 'تأثير الكحول والمواد المخدرة على القيادة',
      descriptionIt: 'Effetti di alcol e droghe sulla guida',
      contentAr: `⚠️ القيادة تحت تأثير الكحول:\n\nالحد الأقصى المسموح:\n- السائقون العاديون: 0.5 جرام/لتر\n- السائقون الجدد (أقل من 3 سنوات): 0.0 جرام/لتر\n- السائقون المحترفون: 0.0 جرام/لتر\n\nتأثيرات الكحول:\n- بطء ردة الفعل\n- تشوش الرؤية\n- ثقة زائفة بالنفس\n- صعوبة تقدير المسافات\n\nالعقوبات:\n- غرامة مالية كبيرة\n- سحب رخصة القيادة\n- السجن في الحالات الخطيرة`,
      contentIt: 'La guida sotto effetto di alcol e droghe è severamente punita.',
      imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=300&fit=crop',
      order: 1, icon: 'no_drinks', color: '#ef4444', isPublished: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  ];

  await db.lessons.bulkAdd(lessons);

  // ============ Seed Signs ============
  const signs = [
    { id: uuid(), nameAr: 'منعطف خطير لليمين', nameIt: 'Curva pericolosa a destra', descriptionAr: 'تحذير من منعطف خطير إلى اليمين، خفف السرعة', descriptionIt: 'Preavviso di curva pericolosa a destra', category: 'warning' as const, imageEmoji: '⚠️', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'تقاطع مع أولوية من اليمين', nameIt: 'Intersezione con precedenza a destra', descriptionAr: 'تقاطع قادم، الأولوية للقادم من اليمين', descriptionIt: 'Intersezione con diritto di precedenza a destra', category: 'warning' as const, imageEmoji: '⚠️', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'أشغال على الطريق', nameIt: 'Lavori in corso', descriptionAr: 'تحذير من وجود أشغال على الطريق', descriptionIt: 'Preavviso di lavori in corso sulla strada', category: 'warning' as const, imageEmoji: '🚧', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'طريق زلق', nameIt: 'Strada sdrucciolevole', descriptionAr: 'الطريق قد يكون زلقاً بسبب المطر أو الجليد', descriptionIt: 'Strada che può essere sdrucciolevole', category: 'warning' as const, imageEmoji: '⚠️', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'معبر مشاة', nameIt: 'Attraversamento pedonale', descriptionAr: 'تحذير من وجود معبر مشاة قريب', descriptionIt: 'Preavviso di attraversamento pedonale', category: 'warning' as const, imageEmoji: '🚶', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'ممنوع الدخول', nameIt: 'Divieto di accesso', descriptionAr: 'ممنوع دخول جميع المركبات من هذا الاتجاه', descriptionIt: "Vietato l'accesso a tutti i veicoli", category: 'prohibition' as const, imageEmoji: '⛔', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'ممنوع التجاوز', nameIt: 'Divieto di sorpasso', descriptionAr: 'ممنوع تجاوز المركبات الأخرى', descriptionIt: 'Vietato il sorpasso', category: 'prohibition' as const, imageEmoji: '🚫', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'حد السرعة 50', nameIt: 'Limite di velocità 50 km/h', descriptionAr: 'الحد الأقصى للسرعة 50 كم في الساعة', descriptionIt: 'Velocità massima consentita 50 km/h', category: 'prohibition' as const, imageEmoji: '5️⃣0️⃣', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'ممنوع الوقوف', nameIt: 'Divieto di sosta', descriptionAr: 'ممنوع وقوف المركبات في هذا المكان', descriptionIt: 'Vietata la sosta', category: 'prohibition' as const, imageEmoji: '🚫', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'اتجاه إجباري مستقيم', nameIt: 'Direzione obbligatoria dritto', descriptionAr: 'يجب السير مباشرة إلى الأمام', descriptionIt: 'Obbligo di proseguire dritto', category: 'obligation' as const, imageEmoji: '⬆️', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'دوار', nameIt: 'Rotatoria', descriptionAr: 'يجب الدوران في اتجاه الدوار', descriptionIt: 'Obbligo di svolta a rotatoria', category: 'obligation' as const, imageEmoji: '🔄', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'قف', nameIt: 'STOP', descriptionAr: 'توقف تماماً ثم أعط الأولوية قبل المتابعة', descriptionIt: 'Fermarsi e dare la precedenza', category: 'priority' as const, imageEmoji: '🛑', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'أعط الأولوية', nameIt: 'Dare precedenza', descriptionAr: 'أعط الأولوية للمركبات الأخرى', descriptionIt: 'Dare la precedenza ai veicoli', category: 'priority' as const, imageEmoji: '🔺', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'طريق ذو أولوية', nameIt: 'Strada con diritto di precedenza', descriptionAr: 'أنت على الطريق الرئيسي ولك الأولوية', descriptionIt: 'Strada con diritto di precedenza', category: 'priority' as const, imageEmoji: '◆', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'موقف سيارات', nameIt: 'Parcheggio', descriptionAr: 'منطقة مخصصة لوقوف السيارات', descriptionIt: 'Area di parcheggio', category: 'information' as const, imageEmoji: '🅿️', createdAt: new Date().toISOString() },
    { id: uuid(), nameAr: 'مستشفى', nameIt: 'Ospedale', descriptionAr: 'مستشفى أو نقطة إسعافات أولية قريبة', descriptionIt: 'Ospedale o pronto soccorso nelle vicinanze', category: 'information' as const, imageEmoji: '🏥', createdAt: new Date().toISOString() },
  ];

  await db.signs.bulkAdd(signs);

  // ============ Seed Questions (with lessonId) ============
  const questions = [
    { id: uuid(), textIt: "Il segnale di pericolo ha forma triangolare con il vertice verso l'alto.", textAr: 'إشارة الخطر لها شكل مثلث مع الرأس إلى الأعلى.', correctAnswer: true, explanationAr: 'صحيح! إشارات الخطر تكون مثلثة الشكل والرأس يشير إلى الأعلى.', explanationIt: "Corretto! I segnali di pericolo sono triangolari con vertice verso l'alto.", category: 'signs', difficulty: 'easy' as const, lessonId: lesson1, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'I segnali di divieto sono generalmente di forma circolare.', textAr: 'إشارات المنع تكون عادة دائرية الشكل.', correctAnswer: true, explanationAr: 'صحيح! إشارات المنع دائرية مع حافة حمراء وخلفية بيضاء.', explanationIt: 'Corretto! I segnali di divieto sono circolari.', category: 'signs', difficulty: 'easy' as const, lessonId: lesson2, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'Il segnale di obbligo ha forma circolare e sfondo blu.', textAr: 'إشارة الإلزام لها شكل دائري وخلفية زرقاء.', correctAnswer: true, explanationAr: 'صحيح! إشارات الإلزام تكون دائرية بخلفية زرقاء ورموز بيضاء.', explanationIt: 'Corretto! I segnali di obbligo sono circolari con sfondo blu.', category: 'signs', difficulty: 'easy' as const, lessonId: lesson3, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'Il limite di velocità in centro abitato è di 70 km/h.', textAr: 'حد السرعة داخل المدينة هو 70 كم/ساعة.', correctAnswer: false, explanationAr: 'خطأ! حد السرعة داخل المدينة (centro abitato) هو 50 كم/ساعة وليس 70.', explanationIt: 'Falso! Il limite in centro abitato è 50 km/h.', category: 'speed', difficulty: 'easy' as const, lessonId: lesson5, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'In autostrada il limite massimo di velocità è di 130 km/h.', textAr: 'في الأوتوستراد الحد الأقصى للسرعة هو 130 كم/ساعة.', correctAnswer: true, explanationAr: 'صحيح! الحد الأقصى للسرعة على الأوتوستراد هو 130 كم/ساعة.', explanationIt: 'Corretto! Il limite in autostrada è 130 km/h.', category: 'speed', difficulty: 'easy' as const, lessonId: lesson5, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'Il sorpasso è vietato in curva su strade a due corsie a doppio senso.', textAr: 'التجاوز ممنوع في المنعطفات على طرق ذات مسارين باتجاهين.', correctAnswer: true, explanationAr: 'صحيح! التجاوز ممنوع في المنعطفات على الطرق ذات الاتجاهين.', explanationIt: 'Corretto! Il sorpasso è vietato in curva.', category: 'rules', difficulty: 'medium' as const, lessonId: lesson6, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'Il conducente che ha assunto alcol può avere una percezione distorta della velocità.', textAr: 'السائق الذي شرب الكحول قد يكون لديه إحساس مشوه بالسرعة.', correctAnswer: true, explanationAr: 'صحيح! الكحول يؤثر على تقدير السرعة والمسافات.', explanationIt: "Corretto! L'alcol distorce la percezione della velocità.", category: 'safety', difficulty: 'easy' as const, lessonId: lesson8, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'Il tasso alcolemico massimo per i neopatentati è di 0,5 g/l.', textAr: 'نسبة الكحول القصوى المسموحة للسائقين الجدد هي 0.5 جرام/لتر.', correctAnswer: false, explanationAr: 'خطأ! السائقون الجدد يجب أن تكون نسبة الكحول 0.0.', explanationIt: 'Falso! Per i neopatentati il limite è 0,0 g/l.', category: 'safety', difficulty: 'medium' as const, lessonId: lesson8, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'La distanza di sicurezza dipende dalla velocità del veicolo.', textAr: 'مسافة الأمان تعتمد على سرعة المركبة.', correctAnswer: true, explanationAr: 'صحيح! كلما زادت السرعة، يجب زيادة مسافة الأمان.', explanationIt: 'Corretto! Maggiore è la velocità, maggiore deve essere la distanza.', category: 'speed', difficulty: 'easy' as const, lessonId: lesson5, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'Il segnale di STOP obbliga a fermarsi e dare la precedenza.', textAr: 'إشارة STOP تُلزمك بالتوقف التام وإعطاء الأولوية.', correctAnswer: true, explanationAr: 'صحيح! عند إشارة STOP يجب التوقف تماماً ثم إعطاء الأولوية.', explanationIt: 'Corretto! Lo STOP obbliga a fermarsi e dare la precedenza.', category: 'priority', difficulty: 'easy' as const, lessonId: lesson4, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: "Il segnale di dare la precedenza ha forma triangolare con il vertice verso il basso.", textAr: 'إشارة أعط الأولوية لها شكل مثلث مع الرأس إلى الأسفل.', correctAnswer: true, explanationAr: 'صحيح! إشارة أعط الأولوية هي المثلث المقلوب.', explanationIt: 'Corretto! Il segnale di dare la precedenza è un triangolo rovesciato.', category: 'priority', difficulty: 'easy' as const, lessonId: lesson4, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'È consentito il sorpasso sulle strisce pedonali.', textAr: 'يُسمح بالتجاوز فوق خطوط المشاة.', correctAnswer: false, explanationAr: 'خطأ! التجاوز ممنوع تماماً فوق معابر المشاة.', explanationIt: 'Falso! Il sorpasso è vietato sulle strisce pedonali.', category: 'rules', difficulty: 'medium' as const, lessonId: lesson6, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'La fermata è la temporanea sospensione della marcia per breve tempo.', textAr: 'التوقف المؤقت (Fermata) هو إيقاف مؤقت للسير لفترة قصيرة.', correctAnswer: true, explanationAr: 'صحيح! Fermata هو التوقف القصير.', explanationIt: 'Corretto! La fermata è una breve sospensione della marcia.', category: 'rules', difficulty: 'easy' as const, lessonId: lesson7, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'La sosta è vietata sui marciapiedi.', textAr: 'الوقوف ممنوع على الأرصفة.', correctAnswer: true, explanationAr: 'صحيح! الوقوف على الأرصفة ممنوع لأنها مخصصة للمشاة.', explanationIt: 'Corretto! La sosta è vietata sui marciapiedi.', category: 'rules', difficulty: 'easy' as const, lessonId: lesson7, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: "I veicoli di soccorso hanno sempre la precedenza quando usano sirena e lampeggianti.", textAr: 'مركبات الطوارئ لها الأولوية دائماً عند استخدام الصفارة والأضواء.', correctAnswer: true, explanationAr: 'صحيح! يجب إفساح المجال لمركبات الطوارئ.', explanationIt: 'Corretto! I veicoli di soccorso hanno sempre la precedenza.', category: 'priority', difficulty: 'easy' as const, lessonId: lesson4, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'In caso di pioggia il tempo di frenata si riduce.', textAr: 'في حالة المطر يقل وقت الفرملة.', correctAnswer: false, explanationAr: 'خطأ! في المطر يزداد وقت الفرملة لأن الطريق يصبح زلقاً.', explanationIt: 'Falso! In caso di pioggia il tempo di frenata aumenta.', category: 'safety', difficulty: 'medium' as const, lessonId: lesson8, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'Il casco è obbligatorio per tutti i conducenti e passeggeri di ciclomotori e motocicli.', textAr: 'الخوذة إلزامية لجميع سائقي وركاب الدراجات النارية.', correctAnswer: true, explanationAr: 'صحيح! الخوذة إلزامية لجميع سائقي وركاب الدراجات النارية.', explanationIt: 'Corretto! Il casco è obbligatorio per tutti.', category: 'safety', difficulty: 'easy' as const, lessonId: lesson8, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: "La patente di categoria B consente di guidare autoveicoli di massa non superiore a 3,5 t.", textAr: 'رخصة الفئة B تسمح بقيادة مركبات لا يتجاوز وزنها 3.5 طن.', correctAnswer: true, explanationAr: 'صحيح! رخصة Patente B تتيح قيادة السيارات حتى 3500 كغ.', explanationIt: 'Corretto! La patente B è valida per veicoli fino a 3,5 t.', category: 'rules', difficulty: 'easy' as const, lessonId: lesson4, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: "È consentito usare il telefono cellulare durante la guida se si utilizza l'auricolare.", textAr: 'يُسمح باستخدام الهاتف أثناء القيادة إذا استخدمت سماعة الأذن.', correctAnswer: true, explanationAr: 'صحيح! يمكن استخدام الهاتف مع سماعة الأذن أو بلوتوث فقط.', explanationIt: 'Corretto! È consentito con auricolare o vivavoce.', category: 'rules', difficulty: 'medium' as const, lessonId: lesson6, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: 'La cintura di sicurezza deve essere allacciata solo dal conducente.', textAr: 'حزام الأمان يجب ربطه فقط من قبل السائق.', correctAnswer: false, explanationAr: 'خطأ! حزام الأمان إلزامي لجميع الركاب.', explanationIt: 'Falso! La cintura è obbligatoria per tutti gli occupanti.', category: 'safety', difficulty: 'easy' as const, lessonId: lesson8, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: "Sulla autostrada è possibile circolare con velocità inferiore a 60 km/h.", textAr: 'على الأوتوستراد يمكن السير بسرعة أقل من 60 كم/ساعة.', correctAnswer: false, explanationAr: 'خطأ! على الأوتوستراد الحد الأدنى للسرعة هو 60 كم/ساعة.', explanationIt: 'Falso! In autostrada la velocità minima è 60 km/h.', category: 'speed', difficulty: 'medium' as const, lessonId: lesson5, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: "Nell'intersezione senza segnali la precedenza spetta a chi viene da destra.", textAr: 'في التقاطع بدون إشارات الأولوية لمن يأتي من اليمين.', correctAnswer: true, explanationAr: 'صحيح! هذه هي القاعدة الأساسية: الأولوية لمن يأتي من اليمين.', explanationIt: 'Corretto! Senza segnali, la precedenza è a destra.', category: 'priority', difficulty: 'easy' as const, lessonId: lesson4, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: "Le luci anabbaglianti devono essere accese anche di giorno nelle gallerie.", textAr: 'يجب تشغيل الأنوار المنخفضة حتى في النهار داخل الأنفاق.', correctAnswer: true, explanationAr: 'صحيح! يجب تشغيل الأنوار المنخفضة دائماً داخل الأنفاق.', explanationIt: 'Corretto! Le anabbaglianti vanno accese nelle gallerie.', category: 'rules', difficulty: 'medium' as const, lessonId: lesson7, createdAt: new Date().toISOString() },
    { id: uuid(), textIt: "Il conducente deve regolare la velocità in base alle condizioni del traffico.", textAr: 'يجب على السائق تعديل السرعة حسب ظروف المرور.', correctAnswer: true, explanationAr: 'صحيح! يجب دائماً تعديل السرعة حسب ظروف المرور والطقس.', explanationIt: 'Corretto! La velocità deve essere regolata in base al traffico.', category: 'speed', difficulty: 'easy' as const, lessonId: lesson5, createdAt: new Date().toISOString() },
  ];

  await db.questions.bulkAdd(questions);

  // ============ Seed Glossary ============
  const glossary = [
    { id: uuid(), termIt: 'Patente', termAr: 'رخصة القيادة', definitionIt: 'Documento che abilita alla guida di veicoli', definitionAr: 'وثيقة تؤهل لقيادة المركبات', category: 'general', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Autostrada', termAr: 'طريق سريع (أوتوستراد)', definitionIt: 'Strada a carreggiate separate con almeno due corsie per senso di marcia', definitionAr: 'طريق بمسارات منفصلة مع مسارين على الأقل لكل اتجاه', category: 'roads', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Incrocio', termAr: 'تقاطع', definitionIt: 'Intersezione tra due o più strade', definitionAr: 'نقطة التقاء طريقين أو أكثر', category: 'roads', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Sorpasso', termAr: 'تجاوز', definitionIt: 'Manovra per superare un veicolo più lento', definitionAr: 'مناورة لتجاوز مركبة أبطأ', category: 'maneuvers', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Precedenza', termAr: 'أولوية المرور', definitionIt: 'Diritto di passare prima di altri veicoli', definitionAr: 'حق المرور قبل المركبات الأخرى', category: 'rules', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Sosta', termAr: 'وقوف / ركن', definitionIt: 'Sospensione prolungata della marcia del veicolo', definitionAr: 'إيقاف المركبة لفترة طويلة', category: 'rules', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Fermata', termAr: 'توقف مؤقت', definitionIt: 'Breve sospensione della marcia', definitionAr: 'إيقاف مؤقت قصير للمركبة', category: 'rules', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Semaforo', termAr: 'إشارة ضوئية', definitionIt: 'Dispositivo semaforico per regolare il traffico', definitionAr: 'جهاز ضوئي لتنظيم حركة المرور', category: 'signals', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Cintura di sicurezza', termAr: 'حزام الأمان', definitionIt: 'Dispositivo di ritenuta per la sicurezza degli occupanti', definitionAr: 'جهاز لحماية الركاب داخل المركبة', category: 'safety', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Freno', termAr: 'فرامل', definitionIt: 'Dispositivo per rallentare o fermare il veicolo', definitionAr: 'جهاز لإبطاء أو إيقاف المركبة', category: 'vehicle', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Corsia', termAr: 'مسار / حارة', definitionIt: 'Parte della carreggiata destinata allo scorrimento di una fila di veicoli', definitionAr: 'جزء من الطريق مخصص لصف واحد من المركبات', category: 'roads', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Marciapiede', termAr: 'رصيف', definitionIt: 'Parte della strada riservata ai pedoni', definitionAr: 'جزء من الطريق مخصص للمشاة', category: 'roads', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Pedone', termAr: 'ماشي / مشاة', definitionIt: 'Persona che cammina a piedi sulla strada', definitionAr: 'شخص يمشي على الطريق', category: 'general', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Pneumatico', termAr: 'إطار', definitionIt: 'Elemento in gomma che riveste la ruota', definitionAr: 'الغطاء المطاطي الذي يغلف العجلة', category: 'vehicle', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Velocità', termAr: 'سرعة', definitionIt: 'Rapidità di spostamento del veicolo', definitionAr: 'مقدار سرعة حركة المركبة', category: 'general', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Multa', termAr: 'غرامة / مخالفة', definitionIt: 'Sanzione pecuniaria per violazione del codice della strada', definitionAr: 'عقوبة مالية لمخالفة قانون المرور', category: 'rules', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Assicurazione', termAr: 'تأمين', definitionIt: 'Copertura assicurativa obbligatoria per i veicoli', definitionAr: 'تغطية تأمينية إلزامية للمركبات', category: 'general', createdAt: new Date().toISOString() },
    { id: uuid(), termIt: 'Revisione', termAr: 'فحص فني', definitionIt: 'Controllo periodico obbligatorio del veicolo', definitionAr: 'فحص دوري إلزامي للمركبة', category: 'vehicle', createdAt: new Date().toISOString() },
  ];

  await db.glossaryTerms.bulkAdd(glossary);

  console.log('✅ Database seeded successfully!');
}
