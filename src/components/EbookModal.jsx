import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

// Multi-language Strategy eBook translations
const TRANSLATIONS = {
  en: {
    lblStrategy: "🚀 AIPCORE STRATEGY",
    lblGuide: "STRATEGY GUIDE",
    title: "AIPCore Pre-Launch Blueprint",
    subtitle: "How to Build a $100,000+/Month Passive Revenue Stream Starting with 100% Free Joining",
    intro: "Welcome to the official AIPCore strategy guide. This blueprint details how you can leverage the pre-launch phase to build a permanent, compounding on-chain matrix community with $0 out-of-pocket costs, scaling your telemetry rewards to over $100,000.",
    h1: "1. The Core Philosophy: Community First, Revenue Second",
    p1: "In Web3, network effects are everything. Typical decentralized protocols launch with upfront activation fees, creating friction. AIPCore breaks this barrier by launching a Live Pre-Launch Phase where Tier 0 node registrations are completely FREE (0.000 BNB). By removing the cost barrier, operators can build viral downlines, secure permanent on-chain matrix slots, and establish community structures prior to paid upgrades.",
    h2: "2. How the Viral 10-Referral Loop Works",
    p2: "The system is engineered for viral distribution using a simple target: Every free user invites at least 10 other free users.",
    figA: "FIGURE A: 10-USER DUPLICATION MATRIX",
    h3: "3. The Compounding Math: Reaching $100,000+/Month",
    p3: "Because matrix slots are locked permanently once registered, as users upgrade their tiers to capture deeper spillover rewards, the volume compounds exponentially.",
    figB: "FIGURE B: 10-LEVEL MATRIX DEPTH COMPOUNDING",
    tableTitle: "COMPOUNDING REVENUE MODEL (10x10)",
    thLevel: "LEVEL",
    thSize: "TEAM SIZE",
    thConv: "CONV %",
    thRev: "MONTHLY REVENUE",
    tableFootnote: "*Calculations based on sequential $5-$40 upgrades at a $650 BNB benchmark.",
    h4: "4. The Upgrade Sequence: Maximizing Spillover",
    p4: "When the main launch commences, users unlock higher tiers (T1-T18) to capture deeper spillover from the global matrix. Important: You only earn rewards from downline members who upgrade at or below your own tier. If a user in your level 4 downline upgrades to Tier 5 while you are still at Tier 3, that reward bypasses your node and rolls up to the next qualified operator. Upgrading sequentially is essential to protect your matrix income.",
    checklistTitle: "🏁 GET STARTED CHECKLIST",
    item1: "✅ Secure your free Tier 0 slot on connection.",
    item2: "✅ Share invite link via social templates.",
    item3: "✅ Invite at least 10 free members directly.",
    item4: "✅ Track compounding downlines inside the Pre-Launch tab.",
    btnDownload: "📥 Download Guide (.pdf)",
    btnClose: "Close Guide",
    langName: "English"
  },
  es: {
    lblStrategy: "🚀 ESTRATEGIA AIPCORE",
    lblGuide: "GUÍA DE ESTRATEGIA",
    title: "Plan de Pre-Lanzamiento de AIPCore",
    subtitle: "Cómo construir un flujo de ingresos pasivos de más de $100,000 al mes comenzando con unirse 100% gratis",
    intro: "Bienvenido a la guía de estrategia oficial de AIPCore. Este plan detalla cómo puede aprovechar la fase de pre-lanzamiento para construir una comunidad de matriz en cadena permanente y compuesta con costos iniciales de $0, escalando sus recompensas de telemetría a más de $100,000.",
    h1: "1. La filosofía central: La comunidad primero, los ingresos después",
    p1: "En Web3, los efectos de red lo son todo. Los protocolos descentralizados típicos se lanzan con tarifas de activación iniciales, lo que crea fricción. AIPCore rompe esta barrera al lanzar una fase de pre-lanzamiento en vivo donde los registros de nodos de Nivel 0 son completamente GRATUITOS (0.000 BNB). Al eliminar la barrera de costos, los operadores pueden construir líneas descendentes virales, asegurar espacios de matriz permanentes en la cadena y establecer estructuras comunitarias antes de las actualizaciones pagas.",
    h2: "2. Cómo funciona el ciclo viral de 10 referidos",
    p2: "El sistema está diseñado para la distribución viral utilizando un objetivo simple: cada usuario gratuito invita al menos a otros 10 usuarios gratuitos.",
    figA: "FIGURA A: MATRIZ DE DUPLICACIÓN DE 10 OPERADORES",
    h3: "3. Las matemáticas compuestas: Alcanzar más de $100,000 al mes",
    p3: "Debido a que los espacios de la matriz se bloquean permanentemente una vez registrados, a medida que los usuarios actualizan sus niveles para capturar recompensas de desbordamiento más profundas, el volumen se compone exponencialmente.",
    figB: "FIGURA B: COMPOSICIÓN DE PROFUNDIDAD DE MATRIZ DE 10 NIVES",
    tableTitle: "MODELO DE INGRESOS COMPUESTOS (10x10)",
    thLevel: "NIVEL",
    thSize: "TAMAÑO EQUIPO",
    thConv: "CONV %",
    thRev: "INGRESOS MENSUALES",
    tableFootnote: "*Cálculos basados en actualizaciones secuenciales de $5 a $40 a una referencia de BNB de $650.",
    h4: "4. La secuencia de actualización: Maximizar el desbordamiento",
    p4: "Cuando comienza el lanzamiento principal, los usuarios desbloquean niveles más altos (T1-T18) para capturar un desbordamiento más profundo de la matriz global. Importante: solo gana recompensas de los miembros de la línea descendente que se actualizan en su propio nivel o por debajo de él. Si un usuario en su línea descendente de nivel 4 se actualiza al Nivel 5 mientras usted todavía está en el Nivel 3, esa recompensa omite su nodo y pasa al siguiente operador calificado. Actualizar secuencialmente es esencial para proteger sus ingresos de la matriz.",
    checklistTitle: "🏁 LISTA DE INICIO",
    item1: "✅ Asegure su espacio gratuito de Nivel 0 al conectarse.",
    item2: "✅ Comparta el enlace de invitación a través de plantillas sociales.",
    item3: "✅ Invite a al menos 10 miembros gratuitos directamente.",
    item4: "✅ Realice un seguimiento de las líneas descendentes compuestas dentro de la pestaña Pre-Lanzamiento.",
    btnDownload: "📥 Descargar Guía (.pdf)",
    btnClose: "Cerrar Guía",
    langName: "Español"
  },
  ru: {
    lblStrategy: "🚀 СТРАТЕГИЯ AIPCORE",
    lblGuide: "РУКОВОДСТВО",
    title: "План предзапуска AIPCore",
    subtitle: "Как создать источник пассивного дохода более $100 000 в месяц, начав со 100% бесплатного участия",
    intro: "Добро пожаловать в официальное стратегическое руководство AIPCore. Этот план подробно описывает, как вы можете использовать фазу предзапуска для создания постоянного, сложного блокчейн-сообщества матрицы с нулевыми затратами из своего кармана, масштабируя ваши награды за телеметрию до более чем $100 000.",
    h1: "1. Основная философия: сначала сообщество, потом доход",
    p1: "В Web3 сетевые эффекты — это все. Типичные децентрализованные протоколы запускаются с авансовыми платами за активацию, что создает трение. AIPCore преодолевает этот барьер, запуская фазу предзапуска в реальном времени, где регистрация узлов Уровня 0 абсолютно БЕСПЛАТНА (0.000 BNB). Устраняя стоимостной барьер, операторы могут создавать вирусные структуры нижестоящих, резервировать постоянные слоты матрицы в сети и создавать структуры сообщества до платных обновлений.",
    h2: "2. Как работает вирусный цикл из 10 рефералов",
    p2: "Система спроектирована для вирусного распространения с простой целью: каждый бесплатный пользователь приглашает как минимум 10 других бесплатных пользователей.",
    figA: "РИСУНОК А: МАТРИЦА ДУБЛИРОВАНИЯ ИЗ 10 ПОЛЬЗОВАТЕЛЕЙ",
    h3: "3. Сложные проценты: достижение $100 000+ в месяц",
    p3: "Поскольку слоты матрицы блокируются навсегда после регистрации, по мере того как пользователи повышают свои уровни для получения более глубоких наград от перелива, объем увеличивается экспоненциально.",
    figB: "РИСУНОК Б: УВЕЛИЧЕНИЕ МАТРИЦЫ НА 10 УРОВНЕЙ",
    tableTitle: "МОДЕЛЬ СЛОЖНОГО ДОХОДА (10x10)",
    thLevel: "УРОВЕНЬ",
    thSize: "РАЗМЕР КОМАНДЫ",
    thConv: "КОНВ %",
    thRev: "ЕЖЕМЕСЯЧНЫЙ ДОХОД",
    tableFootnote: "*Расчеты основаны на последовательных обновлениях от $5 до $40 при цене BNB $650.",
    h4: "4. Последовательность обновлений: максимизация перелива",
    p4: "Когда начинается основной запуск, пользователи разблокируют более высокие уровни (T1-T18), чтобы улавливать более глубокий перелив из глобальной матрицы. Важно: вы получаете вознаграждение только от тех участников структуры, уровень которых не превышает ваш собственный. Если пользователь в вашей структуре 4-го уровня обновляется до Уровня 5, пока вы все еще на Уровне 3, эта награда обходит ваш узел и переходит к следующему подходящему оператору. Последовательное обновление имеет важное значение для защиты вашего дохода от матрицы.",
    checklistTitle: "🏁 СПИСОК ПЕРВЫХ ШАГОВ",
    item1: "✅ Получите свой бесплатный слот Уровня 0 при подключении.",
    item2: "✅ Поделитесь ссылкой-приглашением с помощью социальных шаблонов.",
    item3: "✅ Пригласите как минимум 10 бесплатных участников напрямую.",
    item4: "✅ Отслеживайте развитие структуры во вкладке Предзапуск.",
    btnDownload: "📥 Скачать руководство (.pdf)",
    btnClose: "Закрыть",
    langName: "Русский"
  },
  vi: {
    lblStrategy: "🚀 CHIẾN LƯỢC AIPCORE",
    lblGuide: "HƯỚNG DẪN CHIẾN LƯỢC",
    title: "Bản Thiết Kế Tiền Ra Mắt AIPCore",
    subtitle: "Cách xây dựng nguồn doanh thu thụ động $100.000+/tháng bắt đầu từ việc tham gia 100% miễn phí",
    intro: "Chào mừng bạn đến với hướng dẫn chiến lược chính thức của AIPCore. Bản thiết kế này chi tiết cách bạn có thể tận dụng giai đoạn tiền ra mắt để xây dựng một cộng đồng ma trận on-chain vĩnh viễn, tích lũy với chi phí tự trả là $0, nâng cấp phần thưởng đo lường của bạn lên hơn $100.000.",
    h1: "1. Triết Lý Cốt Lõi: Cộng Đồng Trước, Doanh Thu Sau",
    p1: "Trong Web3, hiệu ứng mạng lưới là tất cả. Các giao thức phi tập trung thông thường ra mắt với phí kích hoạt trả trước, tạo ra rào cản. AIPCore phá vỡ rào cản này bằng cách ra mắt Giai Đoạn Tiền Ra Mắt Trực Tiếp, nơi đăng ký nút Cấp 0 hoàn toàn MIỄN PHÍ (0.000 BNB). Bằng cách loại bỏ rào cản chi phí, các nhà vận hành có thể xây dựng tuyến dưới lan truyền, bảo đảm các vị trí ma trận on-chain vĩnh viễn và thiết lập cấu trúc cộng đồng trước khi nâng cấp trả phí.",
    h2: "2. Chu Kỳ Lan Truyền 10 Người Giới Thiệu Hoạt Động Như Thế Nào",
    p2: "Hệ thống được thiết kế để phân phối lan truyền bằng một mục tiêu đơn giản: Mỗi người dùng miễn phí mời ít nhất 10 người dùng miễn phí khác.",
    figA: "HÌNH A: MA TRẬN NHÂN BẢN 10 NGƯỜI DÙNG",
    h3: "3. Toán Học Tích Lũy: Đạt Trên $100.000/Tháng",
    p3: "Vì các vị trí ma trận được khóa vĩnh viễn sau khi đăng ký, khi người dùng nâng cấp cấp độ của họ để nhận phần thưởng tràn tầng sâu hơn, khối lượng doanh thu sẽ tăng theo cấp số nhân.",
    figB: "HÌNH B: TÍCH LŨY ĐỘ SÂU MA TRẬN 10 CẤP",
    tableTitle: "MÔ HÌNH DOANH THU TÍCH LŨY (10x10)",
    thLevel: "CẤP ĐỘ",
    thSize: "QUY MÔ NHÓM",
    thConv: "TỶ LỆ CHUYỂN ĐỔI",
    thRev: "DOANH THU HÀNG THÁNG",
    tableFootnote: "*Tính toán dựa trên các nâng cấp liên tục từ $5-$40 tại mốc BNB $650.",
    h4: "4. Trình Tự Nâng Cấp: Tối Đa Hóa Tràn Tầng",
    p4: "Khi đợt ra mắt chính thức bắt đầu, người dùng mở khóa các cấp cao hơn (T1-T18) to để nhận tràn tầng sâu hơn từ ma trận toàn cầu. Quan trọng: Bạn chỉ nhận được phần thưởng từ các thành viên tuyến dưới nâng cấp bằng hoặc dưới cấp độ của chính bạn. Nếu một người dùng ở tuyến dưới cấp 4 của bạn nâng cấp lên Cấp 5 trong khi bạn vẫn ở Cấp 3, phần thưởng đó sẽ bỏ qua nút của bạn và chuyển lên nhà vận hành đủ điều kiện tiếp theo. Nâng cấp tuần tự là điều cần thiết để bảo vệ thu nhập ma trận của bạn.",
    checklistTitle: "🏁 DANH SÁCH BẮT ĐẦU",
    item1: "✅ Đảm bảo vị trí Cấp 0 miễn phí khi kết nối.",
    item2: "✅ Chia sẻ liên kết mời thông qua các mẫu mạng xã hội.",
    item3: "✅ Mới trực tiếp ít nhất 10 thành viên miễn phí.",
    item4: "✅ Theo dõi tuyến dưới tích lũy trong tab Tiền Ra Mắt.",
    btnDownload: "📥 Tải Hướng dẫn (.pdf)",
    btnClose: "Đóng Hướng Dẫn",
    langName: "Tiếng Việt"
  },
  tr: {
    lblStrategy: "🚀 AIPCORE STRATEJİSİ",
    lblGuide: "STRATEJİ REHBERİ",
    title: "AIPCore Ön Lansman Yol Haritası",
    subtitle: "%100 Ücretsiz Katılımla Başlayarak Aylık $100.000+ Pasif Gelir Akışı Nasıl İnşa Edilir",
    intro: "Resmi AIPCore strateji rehberine hoş geldiniz. Bu yol haritası, ön lansman aşamasını kullanarak $0 maliyetle kalıcı, katlanan bir zincir içi matris topluluğu oluşturmanın ve telemetri ödüllerinizi $100.000'ın üzerine çıkarmanın yollarını detaylandırmaktadır.",
    h1: "1. Temel Felsefe: Önce Topluluk, Sonra Gelir",
    p1: "Web3'te ağ etkileri her şeydir. Tipik merkeziyetsiz protokoller, başlangıçta aktivasyon ücretleri talep ederek katılım engeli yaratır. AIPCore, Seviye 0 düğüm kayıtlarının tamamen ÜCRETSİZ (0.000 BNB) olduğu Canlı Ön Lansman Aşaması ile bu engeli aşar. Maliyet sınırını kaldırarak, operatörler viral alt ekipler kurabilir, kalıcı zincir içi matris konumları alabilir и ücretli yükseltmelerden önce topluluk yapılarını kurabilirler.",
    h2: "2. Viral 10 Referans Döngüsü Nasıl Çalışır?",
    p2: "Sistem, basit bir hedef kullanarak viral dağıtım için tasarlanmıştır: Her ücretsiz kullanıcı, en az 10 diğer ücretsiz kullanıcıyı davet edin.",
    figA: "ŞEKİL A: 10 KULLANICI KOPYALAMA MATRİSİ",
    h3: "3. Katlanan Matematik: Aylık $100.000+ Seviyesine Ulaşmak",
    p3: "Kayıt olunduktan sonra matris yuvaları kalıcı olarak kilitlendiğinden, kullanıcılar daha derin taşma ödüllerini almak için seviyelerini yükselttikçe, hacim katlanarak büyür.",
    figB: "ŞEKİL B: 10 SEVİYELİ MATRİS DERİNLİK BİLEŞİMİ",
    tableTitle: "KATLANAN GELİR MODELİ (10x10)",
    thLevel: "SEVİYE",
    thSize: "EKİP BOYUTU",
    thConv: "DÖNÜŞÜM %",
    thRev: "AYLIK GELİR",
    tableFootnote: "*Hesaplamalar, $650 BNB baz alınarak ardışık $5-$40 yükseltmelerine göre yapılmıştır.",
    h4: "4. Yükseltme Sıralaması: Taşmayı En Üst Düzeye Çıkarma",
    p4: "Ana lansman başladığında, kullanıcılar küresel matristen daha derin taşmalar yakalamak için daha yüksek seviyelerin (T1-T18) kilidini açarlar. Önemli: Yalnızca sizinle aynı seviyede veya altındaki alt ekip üyelerinden ödül kazanırsınız. Eğer 4. seviye alt ekibinizdeki bir kullanıcı Seviye 5'e yükselirken siz hala Seviye 3'teyseniz, o ödül sizin düğümünüzü atlar ve bir sonraki nitelikli operatöre gider. Sıralı yükseltme yapmak, matris gelirinizi korumak için şarttır.",
    checklistTitle: "🏁 BAŞLANGIÇ KONTROL LİSTESİ",
    item1: "✅ Bağlandığınızda ücretsiz Seviye 0 matris yerinizi alın.",
    item2: "✅ Davet bağlantınızı sosyal medya şablonları aracılığıyla paylaşın.",
    item3: "✅ Doğrudan en az 10 ücretsiz üyeyi davet edin.",
    item4: "✅ Ön Lansman sekmesinden katlanan alt ekiplerinizi takip edin.",
    btnDownload: "📥 Rehberi İndir (.pdf)",
    btnClose: "Rehberi Kapat",
    langName: "Türkçe"
  },
  id: {
    lblStrategy: "🚀 STRATEGI AIPCORE",
    lblGuide: "PANDUAN STRATEGI",
    title: "Cetak Biru Pra-Peluncuran AIPCore",
    subtitle: "Cara Membangun Aliran Pendapatan Pasif $100.000+/Bulan Dimulai dengan Bergabung 100% Gratis",
    intro: "Selamat datang di panduan strategi resmi AIPCore. Cetak biru ini merinci bagaimana Anda dapat memanfaatkan fase pra-peluncuran untuk membangun komunitas matriks on-chain yang permanen dan berlipat ganda dengan biaya mandiri $0, meningkatkan hadiah telemetri Anda hingga lebih dari $100.000.",
    h1: "1. Filosofi Inti: Utamakan Komunitas, Pendapatan Kemudian",
    p1: "Di Web3, efek jaringan adalah segalanya. Protokol terdesentralisasi biasa diluncurkan dengan biaya aktivasi di muka, menciptakan hambatan. AIPCore memecah hambatan ini dengan meluncurkan Fase Pra-Peluncuran Langsung di mana pendaftaran node Tingkat 0 sepenuhnya GRATIS (0.000 BNB). Dengan menghilangkan hambatan biaya, operator dapat membangun jaringan downline viral, mengamankan slot matriks on-chain permanen, dan membangun struktur komunitas sebelum peningkatan berbayar.",
    h2: "2. Bagaimana Loop Referensi Viral 10 Berjalan",
    p2: "Sistem ini dirancang untuk distribusi viral menggunakan target sederhana: Setiap pengguna gratis mengundang setidaknya 10 pengguna gratis lainnya.",
    figA: "GAMBAR A: MATRIKS DUPLIKASI 10 PENGGUNA",
    h3: "3. Matematika Melipatgandakan Hasil: Mencapai $100.000+/Bulan",
    p3: "Karena slot matriks dikunci secara permanen setelah terdaftar, saat pengguna meningkatkan tingkatan mereka untuk menangkap hadiah spillover yang lebih dalam, volume pendapatan berlipat ganda secara eksponensial.",
    figB: "GAMBAR B: DUPLIKASI KEDALAMAN MATRIKS 10 TINGKAT",
    tableTitle: "MODEL PENDAPATAN BERLIPAT GANDA (10x10)",
    thLevel: "TINGKAT",
    thSize: "UKURAN TIM",
    thConv: "KONV %",
    thRev: "PENDAPATAN BULANAN",
    tableFootnote: "*Perhitungan didasarkan pada peningkatan berurutan $5-$40 pada patokan BNB $650.",
    h4: "4. Urutan Peningkatan: Memaksimalkan Spillover",
    p4: "Saat peluncuran utama dimulai, pengguna membuka tingkatan yang lebih tinggi (T1-T18) to menangkap spillover yang lebih dalam dari matriks global. Penting: Anda hanya mendapatkan hadiah dari anggota downline yang meningkatkan pada atau di bawah tingkatan Anda sendiri. Jika pengguna di downline tingkat 4 Anda meningkatkan ke Tingkat 5 sementara Anda masih di Tingkat 3, hadiah tersebut akan melewati node Anda dan naik ke operator berikutnya yang memenuhi syarat. Meningkatkan secara berurutan sangat penting untuk melindungi pendapatan matriks Anda.",
    checklistTitle: "🏁 DAFTAR MEMULAI",
    item1: "✅ Amankan slot Tingkat 0 gratis Anda saat terhubung.",
    item2: "✅ Bagikan tautan undangan melalui templat sosial.",
    item3: "✅ Undang setidaknya 10 anggota gratis secara langsung.",
    item4: "✅ Lacak downline yang berlipat ganda di dalam tab Pra-Peluncuran.",
    btnDownload: "📥 Unduh Panduan (.pdf)",
    btnClose: "Tutup Panduan",
    langName: "Bahasa Indonesia"
  },
  pt: {
    lblStrategy: "🚀 ESTRATÉGIA AIPCORE",
    lblGuide: "GUIA ESTRATÉGICO",
    title: "Plano de Pré-Lançamento AIPCore",
    subtitle: "Como Criar um Fluxo de Receita Passiva de Mais de $100.000/Mês Começando com Adesão 100% Gratuita",
    intro: "Bem-vindo ao guia de estratégia oficial da AIPCore. Este plano detalha como você pode aproveitar a fase de pré-lançamento para construir uma comunidade de matriz on-chain permanente e composta com custos iniciais de $0, escalando suas recompensas de telemetria para mais de $100.000.",
    h1: "1. A Filosofi Central: Comunidade Primeiro, Receita Depois",
    p1: "Na Web3, os efeitos de rede são tudo. Os produtos descentralizados típicos são lançados com taxas de ativação iniciais, criando atrito. A AIPCore quebra essa barreira ao lançar uma Fase de Pré-Lançamento ao Vivo onde os registros de nós do Nível 0 são totalmente GRATUITOS (0.000 BNB). Ao remover a barreira de custos, os operadores podem construir linhas descendentes virais, garantir slots de matriz on-chain permanentes e estabelecer estruturas comunitárias antes de atualizações pagas.",
    h2: "2. Como Funciona o Ciclo Viral de 10 Indicações",
    p2: "O sistema é projetado para distribuição viral usando uma meta simples: cada usuário gratuito convida pelo menos 10 outros usuários gratuitos.",
    figA: "FIGURA A: MATRIZ DE DUPLICAÇÃO DE 10 USUÁRIOS",
    h3: "3. A Matemática dos Juros Compostos: Atingindo Mais de $100.000/Mês",
    p3: "Como os slots de matriz são bloqueados permanentemente uma vez registrados, conforme os usuários atualizam seus níveis para capturar recompensas de transbordamento mais profundas, o volume se compõe exponencialmente.",
    figB: "FIGURA B: COMPOSIÇÃO DE MATRIZ DE 10 NÍVEIS DE PROFUNDIDADE",
    tableTitle: "MODELO DE RECEITA COMPOSTA (10x10)",
    thLevel: "NÍVEL",
    thSize: "TAMANHO DA EQUIPE",
    thConv: "CONV %",
    thRev: "RECEITA MENSAL",
    tableFootnote: "*Cálculos baseados em atualizações sequenciais de $5-$40 em um benchmark BNB de $650.",
    h4: "4. A Sequência de Atualização: Maximizando o Transbordamento",
    p4: "Quando o lançamento principal começa, os usuários desbloqueiam níveis mais altos (T1-T18) para capturar transbordamento mais profundo da matriz global. Importante: Você só ganha recompensas de membros da linha descendente que atualizam no seu próprio nível ou abaixo dele. Se um usuário na sua linha descendente de nível 4 atualizar para o Nível 5 enquanto você estiver no Nível 3, essa recompensa ignora o seu nó e sobe para o próximo operador qualificado. Atualizar sequencialmente é essencial para proteger sua renda da matriz.",
    checklistTitle: "🏁 LISTA DE TAREFAS INICIAIS",
    item1: "✅ Garanta seu slot do Nível 0 gratuito ao conectar.",
    item2: "✅ Compartilhe o link de convite através dos modelos sociais.",
    item3: "✅ Convide pelo menos 10 membros gratuitos diretamente.",
    item4: "✅ Acompanhe as linhas descendentes compostas na aba de Pré-Lançamento.",
    btnDownload: "📥 Baixar Guia (.pdf)",
    btnClose: "Fechar Guia",
    langName: "Português"
  },
  hi: {
    lblStrategy: "🚀 AIPCORE रणनीति",
    lblGuide: "रणनीति गाइड",
    title: "AIPCore प्री-लॉन्च खाका",
    subtitle: "100% मुफ़्त जुड़ने से शुरू करके प्रति माह $100,000+ निष्क्रिय राजस्व धारा कैसे बनाएं",
    intro: "AIPCore के आधिकारिक रणनीति गाइड में आपका स्वागत है। यह खाका विस्तार से बताता है कि कैसे आप प्री-लॉन्च चरण का लाभ उठाकर $0 लागत के साथ एक स्थायी, चक्रवृद्धि ऑन-चेन मैट्रिक्स समुदाय का निर्माण कर सकते हैं, और अपने टेलीमेट्री पुरस्कारों को $100,000 से अधिक तक बढ़ा सकते हैं।",
    h1: "1. मुख्य सिद्धांत: पहले समुदाय, फिर राजस्व",
    p1: "Web3 में, नेटवर्क प्रभाव ही सब कुछ है। विशिष्ट विकेन्द्रीकृत प्रोटोकॉल अग्रिम सक्रियण शुल्क के साथ लॉन्च होते हैं, जिससे बाधा उत्पन्न होती है। AIPCore लाइव प्री-लॉन्च चरण शुरू करके इस बाधा को तोड़ता है जहां टियर 0 नोड पंजीकरण पूरी तरह से मुफ़्त (0.000 BNB) हैं। लागत बाधा को हटाकर, ऑपरेटर वायरल डाउनलाइन बना सकते हैं, स्थायी ऑन-चेन मैट्रिक्स स्लॉट सुरक्षित कर सकते हैं और भुगतान अपग्रेड से पहले समुदाय संरचनाएं स्थापित कर सकते हैं।",
    h2: "2. वायरल 10-रेफरल लूप कैसे काम करता है",
    p2: "यह प्रणाली एक सरल लक्ष्य का उपयोग करके वायरल वितरण के लिए बनाई गई है: प्रत्येक मुफ़्त उपयोगकर्ता कम से कम 10 अन्य मुफ़्त उपयोगकर्ताओं को आमंत्रित करता है।",
    figA: "चित्र ए: 10-उपयोगकर्ता डुप्लीकेशन मैट्रिक्स",
    h3: "3. चक्रवृद्धि गणित: प्रति माह $100,000+ तक पहुँचना",
    p3: "चूंकि पंजीकरण के बाद मैट्रिक्स स्लॉट स्थायी रूप से लॉक हो जाते हैं, जैसे-जैसे उपयोगकर्ता गहरी स्पिलओवर पुरस्कारों को का विस्तार करने के लिए अपने टियर को अपग्रेड करते हैं, मात्रा तेजी से बढ़ती है।",
    figB: "चित्र बी: 10-स्तरीय मैट्रिक्स गहराई चक्रवृद्धि",
    tableTitle: "चक्रवृद्धि राजस्व मॉडल (10x10)",
    thLevel: "स्तर",
    thSize: "टीम का आकार",
    thConv: "परिवर्तन %",
    thRev: "मासिक राजस्व",
    tableFootnote: "*गणना $650 BNB बेंचमार्क पर क्रमिक $5-$40 अपग्रेड पर आधारित है।",
    h4: "4. अपग्रेड अनुक्रम: स्पिलओवर को अधिकतम करना",
    p4: "जब मुख्य लॉन्च शुरू होता है, तो उपयोगकर्ता वैश्विक मैट्रिक्स से अधिक स्पिलओवर प्राप्त करने के लिए उच्च टियर (T1-T18) को अनलॉक करते हैं। महत्वपूर्ण: आप केवल उन डाउनलाइन सदस्यों से पुरस्कार अर्जित करते हैं जो आपके अपने टियर पर या उससे नीचे अपग्रेड करते हैं। यदि आपके स्तर 4 डाउनलाइन में कोई उपयोगकर्ता टियर 5 पर अपग्रेड करता है जबकि आप अभी भी टियर 3 पर हैं, तो वह पुरस्कार आपके नोड को छोड़ देता है और अगले योग्य ऑपरेटर के पास चला जाता है। मैट्रिक्स आय की रक्षा के लिए क्रमिक अपग्रेड आवश्यक है।",
    checklistTitle: "🏁 शुरुआत चेकलिस्ट",
    item1: "✅ कनेक्शन पर अपना मुफ़्त टियर 0 स्लॉट सुरक्षित करें।",
    item2: "✅ सोशल टेम्प्लेट के माध्यम से आमंत्रण लिंक साझा करें।",
    item3: "✅ कम से कम 10 मुफ़्त सदस्यों को सीधे आमंत्रित करें।",
    item4: "✅ प्री-लॉन्च टैब के अंदर चक्रवृद्धि डाउनलाइन को ट्रैक करें।",
    btnDownload: "📥 गाइड डाउनलोड करें (.pdf)",
    btnClose: "गाइड बंद करें",
    langName: "हिन्दी"
  }
};

export default function EbookModal({ isOpen, onClose }) {
  const [selectedLang, setSelectedLang] = useState('en');
  const [isGenerating, setIsGenerating] = useState(false);
  const t = TRANSLATIONS[selectedLang] || TRANSLATIONS.en;

  // Compile and download strategy ebook guide as a high-fidelity PDF client-side
  const handleDownload = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    const loadingToast = toast.loading("Generating high-fidelity eBook PDF...");

    try {
      // Dynamic imports to keep initial React bundle lightweight for Telegram WebViews
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Select hidden printable pages
      const pages = document.querySelectorAll('.pdf-page');
      if (!pages || pages.length === 0) {
        throw new Error("PDF page elements not found in the DOM.");
      }

      // Initialize jsPDF A4 portrait page configuration (width: 794px, height: 1123px at 96 DPI)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [794, 1123],
        compress: true
      });

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];

        // Capture high-definition canvas representation of the page
        const canvas = await html2canvas(pageEl, {
          scale: 2, // 2x scale for print-quality crispness
          useCORS: true, // Handle local and external relative assets safely
          logging: false,
          backgroundColor: '#12131a' // Slate grey background matches grey theme
        });

        const imgData = canvas.toDataURL('image/png');

        // Add page break for subsequent pages
        if (i > 0) {
          pdf.addPage([794, 1123], 'portrait');
        }

        // Draw image onto the active page covering 100% width and height
        pdf.addImage(imgData, 'PNG', 0, 0, 794, 1123);
      }

      // Trigger automatic save & file download
      pdf.save(`AIPCore_Strategy_Blueprint_${selectedLang.toUpperCase()}.pdf`);
      toast.success("eBook PDF downloaded successfully!", { id: loadingToast });
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF eBook. Please try again.", { id: loadingToast });
    } finally {
      setIsGenerating(false);
    }
  };

  // PDF page layout configurations (794px x 1123px at 96 DPI)
  const pdfPageStyle = {
    width: '794px',
    height: '1123px',
    padding: '60px 60px',
    boxSizing: 'border-box',
    background: '#12131a', // Slate grey background matching grey theme
    color: '#ffffff',
    fontFamily: "'Outfit', sans-serif",
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'hidden'
  };

  const pdfHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '15px',
    marginBottom: '20px'
  };

  const pdfTitleStyle = {
    fontSize: '22px',
    fontWeight: '950',
    color: '#ffffff',
    margin: '0 0 4px 0',
    letterSpacing: '-0.02em',
    lineHeight: 1.2
  };

  const pdfSubtitleStyle = {
    fontSize: '11px',
    fontWeight: '800',
    color: '#FFC72C',
    margin: '0',
    lineHeight: 1.4
  };

  const pdfH1Style = {
    fontSize: '14px',
    fontWeight: '900',
    color: '#ffffff',
    margin: '0 0 8px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const pdfPStyle = {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.65)',
    margin: '0 0 16px 0',
    lineHeight: 1.6
  };

  const pdfFooterStyle = {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    paddingTop: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '9px',
    color: 'rgba(255, 255, 255, 0.35)'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 8, 15, 0.95)',
          backdropFilter: 'blur(12px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            style={{
              background: 'linear-gradient(135deg, #1e2025 0%, #101115 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '430px',
              height: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.01)'
            }}>
              {/* Language Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px' }}>
                  🌐
                </span>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  disabled={isGenerating}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 8px',
                    outline: 'none',
                    fontFamily: 'Outfit, sans-serif',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    opacity: isGenerating ? 0.6 : 1
                  }}
                >
                  {Object.keys(TRANSLATIONS).map((lang) => (
                    <option key={lang} value={lang} style={{ background: '#1e2025', color: '#fff' }}>
                      {TRANSLATIONS[lang].langName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                disabled={isGenerating}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  opacity: isGenerating ? 0.5 : 1
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content Scroll Area (UI preview for user) */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 20px 40px',
              textAlign: 'left',
              lineHeight: 1.6
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(163,255,18,0.1)', border: '1px solid rgba(163,255,18,0.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '9px', fontWeight: 900, color: '#A3FF12', letterSpacing: '0.5px' }}>
                  {t.lblStrategy}
                </div>

                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  disabled={isGenerating}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    color: '#FFC72C',
                    fontSize: '9px',
                    fontWeight: 900,
                    padding: '4px 10px',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'Outfit, sans-serif',
                    opacity: isGenerating ? 0.6 : 1
                  }}
                >
                  {isGenerating ? "⌛ Generating PDF..." : t.btnDownload}
                </button>
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 950, color: '#fff', marginBottom: '8px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {t.title}
              </h2>
              <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#FFC72C', marginBottom: '20px', lineHeight: 1.4 }}>
                {t.subtitle}
              </h3>

              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
                {t.intro}
              </p>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '20px 0' }} />

              {/* Section 1 */}
              <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>
                {t.h1}
              </h4>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
                {t.p1}
              </p>

              {/* Section 2 */}
              <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>
                {t.h2}
              </h4>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '14px' }}>
                {t.p2}
              </p>

              {/* Infographic 1 */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '8px',
                marginBottom: '18px',
                textAlign: 'center'
              }}>
                <img 
                  src="/images/viral_loop.png" 
                  alt="Viral Loop Infographic"
                  style={{ width: '100%', borderRadius: '12px', display: 'block' }} 
                />
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', fontWeight: 800, marginTop: '6px', letterSpacing: '0.5px' }}>
                  {t.figA}
                </div>
              </div>

              {/* Section 3 */}
              <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>
                {t.h3}
              </h4>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '14px' }}>
                {t.p3}
              </p>

              {/* Infographic 2 */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '8px',
                marginBottom: '18px',
                textAlign: 'center'
              }}>
                <img 
                  src="/images/matrix_growth.png" 
                  alt="Matrix Compounding Infographic"
                  style={{ width: '100%', borderRadius: '12px', display: 'block' }} 
                />
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', fontWeight: 800, marginTop: '6px', letterSpacing: '0.5px' }}>
                  {t.figB}
                </div>
              </div>

              {/* Stats Table */}
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.04)',
                padding: '12px 14px',
                marginBottom: '18px',
                overflowX: 'auto'
              }}>
                <div style={{ fontSize: '9px', fontWeight: 900, color: '#FFC72C', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  {t.tableTitle}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', textAlign: 'left', color: '#fff' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
                      <th style={{ padding: '6px 4px' }}>{t.thLevel}</th>
                      <th style={{ padding: '6px 4px' }}>{t.thSize}</th>
                      <th style={{ padding: '6px 4px' }}>{t.thConv}</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>{t.thRev}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { lvl: '1 (Direct)', size: '10', conv: '100%', rev: '$325.00' },
                      { lvl: 'L2', size: '100', conv: '80%', rev: '$2,600.00' },
                      { lvl: 'L3', size: '1,000', conv: '50%', rev: '$16,250.00' },
                      { lvl: 'L4', size: '10,000', conv: '30%', rev: '$97,500.00' },
                      { lvl: 'L5', size: '100,000', conv: '15%', rev: '$487,500.00' }
                    ].map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '6px 4px', fontWeight: 800 }}>{r.lvl}</td>
                        <td style={{ padding: '6px 4px', color: 'rgba(255,255,255,0.7)' }}>{r.size}</td>
                        <td style={{ padding: '6px 4px', color: 'rgba(255,255,255,0.7)' }}>{r.conv}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 900, color: '#A3FF12' }}>{r.rev}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', lineHeight: 1.2 }}>
                  {t.tableFootnote}
                </div>
              </div>

              {/* Section 4 */}
              <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>
                {t.h4}
              </h4>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
                {t.p4}
              </p>

              {/* Footer checklist */}
              <div style={{
                background: 'rgba(163,255,18,0.03)',
                border: '1px solid rgba(163,255,18,0.12)',
                borderRadius: '16px',
                padding: '14px',
                marginTop: '10px'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#A3FF12', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  {t.checklistTitle}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.75)' }}>
                  <div>{t.item1}</div>
                  <div>{t.item2}</div>
                  <div>{t.item3}</div>
                  <div>{t.item4}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.01)',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <button
                onClick={onClose}
                disabled={isGenerating}
                style={{
                  width: '100%',
                  background: '#fff',
                  color: '#000',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '12px',
                  fontSize: '12px',
                  fontWeight: 900,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(255,255,255,0.05)',
                  opacity: isGenerating ? 0.5 : 1
                }}
              >
                {t.btnClose}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Hidden layout containers specifically formatted for high-definition A4 PDF compile */}
      <div id="ebook-pdf-container" style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        width: '794px',
        overflow: 'hidden'
      }}>
        {/* PDF PAGE 1: Intro & Core Philosophy */}
        <div className="pdf-page" style={pdfPageStyle}>
          <div>
            <div style={pdfHeaderStyle}>
              <div>
                <h1 style={pdfTitleStyle}>{t.title}</h1>
                <p style={pdfSubtitleStyle}>{t.subtitle}</p>
              </div>
              <div style={{
                background: 'rgba(163,255,18,0.1)',
                border: '1px solid rgba(163,255,18,0.2)',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '9px',
                fontWeight: 900,
                color: '#A3FF12',
                letterSpacing: '0.5px',
                alignSelf: 'flex-start'
              }}>
                {t.lblGuide}
              </div>
            </div>
            
            <p style={{ ...pdfPStyle, fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', marginBottom: '24px' }}>
              {t.intro}
            </p>

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '24px 0' }} />

            <h2 style={pdfH1Style}>{t.h1}</h2>
            <p style={pdfPStyle}>{t.p1}</p>
          </div>

          <div style={pdfFooterStyle}>
            <span>AIPCore Pre-Launch Strategy Blueprint</span>
            <span>Page 1 of 3</span>
          </div>
        </div>

        {/* PDF PAGE 2: Section 2 (Viral Loop) & Infographic A */}
        <div className="pdf-page" style={pdfPageStyle}>
          <div>
            <div style={pdfHeaderStyle}>
              <span style={{ fontSize: '9px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>
                SECTION 2: VIRAL REPRODUCTION ENGINE
              </span>
              <span style={{ fontSize: '9px', fontWeight: 900, color: '#FFC72C', letterSpacing: '0.5px' }}>
                {t.lblStrategy}
              </span>
            </div>

            <h2 style={pdfH1Style}>{t.h2}</h2>
            <p style={pdfPStyle}>{t.p2}</p>

            {/* Infographic A */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '12px',
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              <img 
                src="/images/viral_loop.png" 
                alt="Viral Loop"
                style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '12px', display: 'block', margin: '0 auto' }} 
              />
              <div style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 800, marginTop: '8px', letterSpacing: '0.5px' }}>
                {t.figA}
              </div>
            </div>
          </div>

          <div style={pdfFooterStyle}>
            <span>AIPCore Pre-Launch Strategy Blueprint</span>
            <span>Page 2 of 3</span>
          </div>
        </div>

        {/* PDF PAGE 3: Section 3 & 4: Compounding Math, Revenue Model, Checklist */}
        <div className="pdf-page" style={pdfPageStyle}>
          <div>
            <div style={pdfHeaderStyle}>
              <span style={{ fontSize: '9px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>
                SECTION 3 & 4: REVENUE MODEL & UPGRADE PROTOCOLS
              </span>
              <span style={{ fontSize: '9px', fontWeight: 900, color: '#FFC72C', letterSpacing: '0.5px' }}>
                {t.lblStrategy}
              </span>
            </div>

            <h2 style={pdfH1Style}>{t.h3}</h2>
            <p style={pdfPStyle}>{t.p3}</p>

            {/* Revenue Table */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              padding: '12px 16px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '9px', fontWeight: 900, color: '#FFC72C', letterSpacing: '0.5px', marginBottom: '8px' }}>
                {t.tableTitle}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', textAlign: 'left', color: '#ffffff' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.5)' }}>
                    <th style={{ padding: '6px 4px' }}>{t.thLevel}</th>
                    <th style={{ padding: '6px 4px' }}>{t.thSize}</th>
                    <th style={{ padding: '6px 4px' }}>{t.thConv}</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>{t.thRev}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { lvl: '1 (Direct)', size: '10', conv: '100%', rev: '$325.00' },
                    { lvl: 'L2', size: '100', conv: '80%', rev: '$2,600.00' },
                    { lvl: 'L3', size: '1,000', conv: '50%', rev: '$16,250.00' },
                    { lvl: 'L4', size: '10,000', conv: '30%', rev: '$97,500.00' },
                    { lvl: 'L5', size: '100,000', conv: '15%', rev: '$487,500.00' }
                  ].map((r, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '6px 4px', fontWeight: 800 }}>{r.lvl}</td>
                      <td style={{ padding: '6px 4px', color: 'rgba(255, 255, 255, 0.8)' }}>{r.size}</td>
                      <td style={{ padding: '6px 4px', color: 'rgba(255, 255, 255, 0.8)' }}>{r.conv}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 900, color: '#A3FF12' }}>{r.rev}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: '7px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '8px', lineHeight: 1.2 }}>
                {t.tableFootnote}
              </div>
            </div>

            <h2 style={pdfH1Style}>{t.h4}</h2>
            <p style={{ ...pdfPStyle, marginBottom: '16px' }}>{t.p4}</p>

            {/* Checklist */}
            <div style={{
              background: 'rgba(163,255,18,0.03)',
              border: '1px solid rgba(163,255,18,0.12)',
              borderRadius: '16px',
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: '10px', fontWeight: 900, color: '#A3FF12', letterSpacing: '0.5px', marginBottom: '8px' }}>
                {t.checklistTitle}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '9px', color: 'rgba(255, 255, 255, 0.8)' }}>
                <div>{t.item1}</div>
                <div>{t.item2}</div>
                <div>{t.item3}</div>
                <div>{t.item4}</div>
              </div>
            </div>
          </div>

          <div style={pdfFooterStyle}>
            <span>Powered by Binance Smart Chain • All rights reserved © 2026</span>
            <span>Page 3 of 3</span>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}
