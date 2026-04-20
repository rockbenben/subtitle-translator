/**
 * HowTo step definitions per tool.
 * Provides zh and en steps; falls back to en for other locales.
 * Steps are a high-value GEO signal for "how to" queries.
 */

type HowToStep = { name: string; text: string };
type ToolHowTo = { [locale: string]: HowToStep[] };

export const TOOL_HOWTO: Record<string, ToolHowTo> = {
  "json-translate": {
    en: [
      { name: "Paste or upload JSON", text: "Click the input area and paste your JSON content, or upload a .json file via drag-and-drop." },
      { name: "Select target language(s)", text: "Choose one or more target languages from the dropdown. Enable Multi-Language Mode for batch translation." },
      { name: "Translate and export", text: "Click Translate. Once complete, download the translated JSON files or copy individual results." },
    ],
    zh: [
      { name: "粘贴或上传 JSON", text: "点击输入区粘贴 JSON 内容，或拖拽 .json 文件上传。" },
      { name: "选择目标语言", text: "从下拉菜单选择一个或多个目标语言。启用多语言模式可一次翻译为多种语言。" },
      { name: "翻译并导出", text: "点击翻译按钮。完成后下载翻译好的 JSON 文件或复制单个结果。" },
    ],
      ja: [
      { name: "JSON を貼り付けまたはアップロード", text: "入力エリアをクリックして JSON をペーストするか、.json ファイルをドラッグ＆ドロップでアップロード。" },
      { name: "対象言語を選択", text: "ドロップダウンから1つまたは複数の対象言語を選択。多言語モードで一括翻訳も可能。" },
      { name: "翻訳してエクスポート", text: "「翻訳」をクリック。完了後、翻訳された JSON ファイルをダウンロードまたは結果をコピー。" },
    ],
    ko: [
      { name: "JSON 붙여넣기 또는 업로드", text: "입력 영역을 클릭하여 JSON을 붙여넣거나 .json 파일을 드래그 앤 드롭으로 업로드합니다." },
      { name: "대상 언어 선택", text: "드롭다운에서 하나 이상의 대상 언어를 선택합니다. 다국어 모드로 일괄 번역 가능." },
      { name: "번역 및 내보내기", text: "번역 버튼을 클릭. 완료되면 번역된 JSON 파일을 다운로드하거나 결과를 복사합니다." },
    ],
    fr: [
      { name: "Coller ou importer le JSON", text: "Cliquez sur la zone de saisie et collez votre JSON, ou importez un fichier .json par glisser-déposer." },
      { name: "Sélectionner les langues cibles", text: "Choisissez une ou plusieurs langues cibles. Activez le mode multilingue pour une traduction groupée." },
      { name: "Traduire et exporter", text: "Cliquez sur Traduire. Téléchargez les fichiers JSON traduits ou copiez les résultats." },
    ],
    de: [
      { name: "JSON einfügen oder hochladen", text: "Klicken Sie in den Eingabebereich und fügen Sie JSON ein oder laden Sie eine .json-Datei per Drag-and-Drop hoch." },
      { name: "Zielsprache(n) wählen", text: "Wählen Sie eine oder mehrere Zielsprachen. Aktivieren Sie den Mehrsprachenmodus für Stapelübersetzung." },
      { name: "Übersetzen und exportieren", text: "Klicken Sie auf Übersetzen. Laden Sie die übersetzten JSON-Dateien herunter oder kopieren Sie Ergebnisse." },
    ],
    es: [
      { name: "Pegar o subir JSON", text: "Haga clic en el área de entrada y pegue su JSON, o suba un archivo .json arrastrando y soltando." },
      { name: "Seleccionar idiomas de destino", text: "Elija uno o más idiomas. Active el modo multilingüe para traducción por lotes." },
      { name: "Traducir y exportar", text: "Haga clic en Traducir. Descargue los archivos JSON traducidos o copie los resultados." },
    ],
    pt: [
      { name: "Colar ou carregar JSON", text: "Clique na área de entrada e cole seu JSON ou carregue um arquivo .json arrastando e soltando." },
      { name: "Selecionar idiomas de destino", text: "Escolha um ou mais idiomas. Ative o modo multilíngue para tradução em lote." },
      { name: "Traduzir e exportar", text: "Clique em Traduzir. Baixe os arquivos JSON traduzidos ou copie os resultados." },
    ],
      ru: [
      { name: "Вставить или загрузить JSON", text: "Кликните в поле ввода и вставьте JSON или загрузите .json-файл перетаскиванием." },
      { name: "Выбрать целевые языки", text: "Выберите один или несколько языков. Активируйте многоязычный режим для пакетного перевода." },
      { name: "Перевести и экспортировать", text: "Нажмите Перевести. Скачайте переведённые JSON-файлы или скопируйте результаты." },
    ],
    ar: [
      { name: "لصق أو تحميل JSON", text: "انقر في منطقة الإدخال والصق JSON أو قم بتحميل ملف .json بالسحب." },
      { name: "اختر اللغات المستهدفة", text: "اختر لغة أو أكثر. فعّل الوضع متعدد اللغات للترجمة الدفعية." },
      { name: "ترجمة وتصدير", text: "انقر ترجمة. حمّل ملفات JSON المترجمة أو انسخ النتائج." },
    ],
    hi: [
      { name: "JSON पेस्ट करें या अपलोड करें", text: "इनपुट क्षेत्र पर क्लिक करें और JSON पेस्ट करें या .json फ़ाइल ड्रैग एंड ड्रॉप करें।" },
      { name: "लक्ष्य भाषा चुनें", text: "एक या अधिक लक्ष्य भाषाएँ चुनें। बैच अनुवाद के लिए बहुभाषी मोड सक्रिय करें।" },
      { name: "अनुवाद करें और निर्यात करें", text: "अनुवाद पर क्लिक करें। अनुवादित JSON डाउनलोड करें या परिणाम कॉपी करें।" },
    ],
    vi: [
      { name: "Dán hoặc tải JSON lên", text: "Nhấp vào khu vực nhập và dán JSON, hoặc tải tệp .json lên bằng kéo thả." },
      { name: "Chọn ngôn ngữ đích", text: "Chọn một hoặc nhiều ngôn ngữ. Bật chế độ đa ngôn ngữ cho dịch hàng loạt." },
      { name: "Dịch và xuất", text: "Nhấp Dịch. Tải xuống các tệp JSON đã dịch hoặc sao chép kết quả." },
    ],
    th: [
      { name: "วางหรืออัปโหลด JSON", text: "คลิกที่พื้นที่ป้อนข้อมูลและวาง JSON หรืออัปโหลดไฟล์ .json" },
      { name: "เลือกภาษาเป้าหมาย", text: "เลือกภาษาเป้าหมายหนึ่งภาษาหรือมากกว่า เปิดใช้งานโหมดหลายภาษาสำหรับการแปลเป็นชุด" },
      { name: "แปลและส่งออก", text: "คลิกแปล ดาวน์โหลดไฟล์ JSON ที่แปลแล้วหรือคัดลอกผลลัพธ์" },
    ],
    tr: [
      { name: "JSON yapıştır veya yükle", text: "Giriş alanına tıklayıp JSON yapıştırın veya .json dosyasını sürükleyip bırakın." },
      { name: "Hedef dil(ler)i seç", text: "Bir veya daha fazla hedef dil seçin. Toplu çeviri için çok dilli modu etkinleştirin." },
      { name: "Çevir ve dışa aktar", text: "Çevir'e tıklayın. Çevrilen JSON dosyalarını indirin veya sonuçları kopyalayın." },
    ],
    bn: [
      { name: "JSON পেস্ট বা আপলোড করুন", text: "ইনপুট এলাকায় ক্লিক করে JSON পেস্ট করুন বা .json ফাইল টেনে আনুন।" },
      { name: "লক্ষ্য ভাষা নির্বাচন করুন", text: "এক বা একাধিক ভাষা নির্বাচন করুন।" },
      { name: "অনুবাদ ও রপ্তানি করুন", text: "অনুবাদ ক্লিক করুন।" },
    ],
    id: [
      { name: "Tempel atau unggah JSON", text: "Klik area input dan tempel JSON, atau unggah file .json dengan drag-and-drop." },
      { name: "Pilih bahasa target", text: "Pilih satu atau beberapa bahasa. Aktifkan mode multibahasa untuk terjemahan batch." },
      { name: "Terjemahkan dan ekspor", text: "Klik Terjemahkan. Unduh file JSON terjemahan atau salin hasil." },
    ],
    it: [
      { name: "Incolla o carica JSON", text: "Clicca sull'area di input e incolla JSON, o carica un file .json con drag-and-drop." },
      { name: "Seleziona lingue target", text: "Scegli una o più lingue. Attiva la modalità multilingue per traduzione batch." },
      { name: "Traduci ed esporta", text: "Clicca Traduci. Scarica i file JSON tradotti o copia i risultati." },
    ],
  },
  "subtitle-translator": {
    zh: [
      { name: "从视频或字幕文件开始", text: "上传 SRT/ASS/VTT/LRC 字幕文件。YouTube 视频字幕用 yt-dlp 导出，B 站视频可在创作中心下载自己的字幕，其他平台字幕从合法来源获取。工具通过 jschardet 自动识别 UTF-8/UTF-16/GBK/Shift-JIS 等编码。" },
      { name: "选择引擎并配置输出", text: "免费测试用 Google，追求质量用 DeepSeek 或 DeepL API。选「仅译文」用于发布，选「双语」用于语言学习。双语时可设置译文在原文上方（学习模式）或下方（观看模式）。" },
      { name: "翻译并导出到目标平台", text: "点击翻译预览时间轴对齐。下载 SRT 上传到 B 站、YouTube 社区字幕；下载 ASS 保留特效和颜色用于 Premiere/DaVinci Resolve；VTT 用于网页播放器；LRC 用于歌词。" },
    ],
    en: [
      { name: "Start from video or subtitle file", text: "Upload SRT/ASS/VTT/LRC subtitle file. Export YouTube subtitles via yt-dlp, Bilibili subtitles via creator dashboard, other platform subtitles from legitimate sources. Tool auto-detects format and UTF-8/UTF-16/GBK/Shift-JIS encoding via jschardet." },
      { name: "Choose engine and output mode", text: "Use Google for free quick tests, or DeepSeek/DeepL API for quality. Select 'Translated only' for publishing, 'Bilingual' for language learning. For bilingual, position translation above (learning mode) or below (viewing mode) the original." },
      { name: "Translate and export to your platform", text: "Click Translate and verify timing alignment in preview. Download SRT for YouTube/Bilibili community subtitles, ASS for styled subtitles in Premiere/DaVinci Resolve, VTT for web players, LRC for lyrics." },
    ],
    ja: [
      { name: "動画または字幕ファイルから開始", text: "SRT/ASS/VTT/LRC 字幕をアップロード。YouTube は yt-dlp で抽出、ニコ動は配信者ダッシュボードから、他プラットフォームは正規ルートから取得。jschardet で UTF-8/UTF-16/Shift-JIS/GBK エンコーディングを自動検出。" },
      { name: "エンジンと出力モードを選択", text: "無料テストは Google、品質重視は DeepSeek/DeepL API。公開用は「翻訳のみ」、語学学習用は「バイリンガル」。バイリンガルでは訳文を原文の上（学習）または下（視聴）に配置可能。" },
      { name: "翻訳してプラットフォームへエクスポート", text: "翻訳をクリックし、プレビューで時間軸を確認。YouTube コミュニティ字幕用 SRT、Premiere/DaVinci Resolve 用スタイル付き ASS、Web プレーヤー用 VTT、歌詞用 LRC をダウンロード。" },
    ],
    ko: [
      { name: "비디오 또는 자막 파일에서 시작", text: "SRT/ASS/VTT/LRC 자막 업로드. YouTube는 yt-dlp로 추출, 네이버TV 등은 크리에이터 대시보드에서, 기타 플랫폼은 공식 경로에서 자막을 얻으세요. jschardet로 UTF-8/UTF-16/EUC-KR/GBK 인코딩 자동 감지." },
      { name: "엔진과 출력 모드 선택", text: "무료 테스트는 Google, 품질은 DeepSeek/DeepL API. 공개용은 '번역만', 언어 학습용은 '이중 언어'. 이중 언어 시 번역문을 원문 위(학습) 또는 아래(시청)에 배치." },
      { name: "번역 후 플랫폼으로 내보내기", text: "번역 클릭 후 미리보기에서 타이밍 확인. YouTube 커뮤니티 자막용 SRT, Premiere/DaVinci Resolve용 스타일 ASS, 웹 플레이어용 VTT, 가사용 LRC 다운로드." },
    ],
    fr: [
      { name: "Partir d'une vidéo ou d'un fichier sous-titre", text: "Importez SRT/ASS/VTT/LRC. Extraction : YouTube via yt-dlp, autres plateformes via outils dédiés. Format et encodage UTF-8/UTF-16/GBK détectés automatiquement." },
      { name: "Choisir le moteur et le mode de sortie", text: "Google gratuit pour tests rapides, DeepSeek/DeepL API pour qualité. 'Traduction seule' pour publication, 'Bilingue' pour apprentissage. En bilingue, position au-dessus (apprentissage) ou en-dessous (visionnage)." },
      { name: "Traduire et exporter vers votre plateforme", text: "Cliquez Traduire et vérifiez le timing dans l'aperçu. Téléchargez SRT pour sous-titres communautaires YouTube, ASS stylisé pour Premiere/DaVinci Resolve, VTT pour lecteurs web, LRC pour paroles." },
    ],
    de: [
      { name: "Mit Video- oder Untertiteldatei beginnen", text: "SRT/ASS/VTT/LRC hochladen. Extraktion: YouTube über yt-dlp, andere Plattformen über spezielle Tools. Format und UTF-8/UTF-16/GBK-Kodierung automatisch erkannt." },
      { name: "Engine und Ausgabemodus wählen", text: "Google kostenlos für Schnelltests, DeepSeek/DeepL API für Qualität. 'Nur Übersetzung' zum Veröffentlichen, 'Zweisprachig' zum Sprachenlernen. Bei zweisprachig: Übersetzung oben (Lernen) oder unten (Anschauen)." },
      { name: "Übersetzen und auf Ihrer Plattform exportieren", text: "Auf Übersetzen klicken und Timing in der Vorschau prüfen. SRT für YouTube Community-Untertitel, ASS mit Stilen für Premiere/DaVinci Resolve, VTT für Web-Player, LRC für Songtexte." },
    ],
    es: [
      { name: "Comenzar desde video o archivo de subtítulos", text: "Suba SRT/ASS/VTT/LRC. Extracción: YouTube con yt-dlp, otras plataformas con herramientas dedicadas. Formato y codificación UTF-8/UTF-16/GBK detectados automáticamente." },
      { name: "Elegir motor y modo de salida", text: "Google gratis para pruebas rápidas, DeepSeek/DeepL API para calidad. 'Solo traducción' para publicar, 'Bilingüe' para aprender idiomas. En bilingüe, posición arriba (aprender) o abajo (ver)." },
      { name: "Traducir y exportar a su plataforma", text: "Haga clic en Traducir y verifique el timing en la vista previa. Descargue SRT para subtítulos comunitarios de YouTube, ASS estilizado para Premiere/DaVinci Resolve, VTT para reproductores web, LRC para letras." },
    ],
    pt: [
      { name: "Começar a partir de vídeo ou arquivo de legenda", text: "Carregue SRT/ASS/VTT/LRC. Extração: YouTube via yt-dlp, outras plataformas com ferramentas dedicadas. Formato e codificação UTF-8/UTF-16/GBK detectados automaticamente." },
      { name: "Escolher motor e modo de saída", text: "Google grátis para testes rápidos, DeepSeek/DeepL API para qualidade. 'Apenas tradução' para publicar, 'Bilíngue' para aprender idiomas. No bilíngue, posição acima (aprender) ou abaixo (assistir)." },
      { name: "Traduzir e exportar para sua plataforma", text: "Clique em Traduzir e verifique o timing na pré-visualização. Baixe SRT para legendas comunitárias do YouTube, ASS estilizado para Premiere/DaVinci Resolve, VTT para players web, LRC para letras." },
    ],
    ru: [
      { name: "Начните с видео или файла субтитров", text: "Загрузите SRT/ASS/VTT/LRC. Извлечение: YouTube через yt-dlp, другие платформы через специальные инструменты. Формат и кодировка UTF-8/UTF-16/GBK определяются автоматически." },
      { name: "Выбрать движок и режим вывода", text: "Google бесплатно для быстрых тестов, DeepSeek/DeepL API для качества. «Только перевод» для публикации, «Двуязычный» для изучения языков. В двуязычном — перевод сверху (изучение) или снизу (просмотр)." },
      { name: "Перевести и экспортировать на платформу", text: "Нажмите Перевести и проверьте тайминг в предпросмотре. Скачайте SRT для сообщества YouTube, стилизованный ASS для Premiere/DaVinci Resolve, VTT для веб-плееров, LRC для текстов песен." },
    ],
    ar: [
      { name: "ابدأ من ملف الفيديو أو الترجمة", text: "حمّل SRT/ASS/VTT/LRC. الاستخراج: YouTube عبر yt-dlp، المنصات الأخرى عبر أدوات مخصصة. الصيغة والترميز UTF-8/UTF-16/GBK يُكتشفان تلقائياً." },
      { name: "اختر المحرك ووضع الإخراج", text: "Google مجاني للاختبارات السريعة، DeepSeek/DeepL API للجودة. 'ترجمة فقط' للنشر، 'ثنائي اللغة' لتعلم اللغات. في الثنائي، الموقع فوق (التعلم) أو تحت (المشاهدة)." },
      { name: "ترجم وصدّر إلى منصتك", text: "انقر ترجمة وتحقق من التوقيت في المعاينة. حمّل SRT لترجمات مجتمع YouTube، ASS بالأنماط لـ Premiere/DaVinci Resolve، VTT لمشغلات الويب، LRC للكلمات." },
    ],
    hi: [
      { name: "वीडियो या सबटाइटल फ़ाइल से शुरू करें", text: "SRT/ASS/VTT/LRC अपलोड करें। YouTube से yt-dlp के साथ, अन्य प्लेटफॉर्म से समर्पित टूल्स से निकालें। प्रारूप और UTF-8/UTF-16/GBK एन्कोडिंग स्वचालित पहचाने जाते हैं।" },
      { name: "इंजन और आउटपुट मोड चुनें", text: "त्वरित परीक्षण के लिए Google मुफ्त, गुणवत्ता के लिए DeepSeek/DeepL API। प्रकाशन के लिए 'केवल अनुवाद', भाषा सीखने के लिए 'द्विभाषी'। द्विभाषी में अनुवाद ऊपर (सीखना) या नीचे (देखना)।" },
      { name: "अनुवाद करें और अपने प्लेटफॉर्म पर निर्यात करें", text: "अनुवाद क्लिक करें और पूर्वावलोकन में समय जांचें। YouTube समुदाय सबटाइटल के लिए SRT, Premiere/DaVinci Resolve के लिए शैलीबद्ध ASS, वेब प्लेयर के लिए VTT, गीत के लिए LRC डाउनलोड करें।" },
    ],
    vi: [
      { name: "Bắt đầu từ video hoặc tệp phụ đề", text: "Tải lên SRT/ASS/VTT/LRC. Trích xuất: YouTube qua yt-dlp, nền tảng khác qua công cụ chuyên dụng. Định dạng và mã hóa UTF-8/UTF-16/GBK được phát hiện tự động." },
      { name: "Chọn engine và chế độ xuất", text: "Google miễn phí cho thử nghiệm nhanh, DeepSeek/DeepL API cho chất lượng. 'Chỉ bản dịch' để xuất bản, 'Song ngữ' để học ngôn ngữ. Trong song ngữ, vị trí trên (học) hoặc dưới (xem)." },
      { name: "Dịch và xuất lên nền tảng", text: "Nhấp Dịch và kiểm tra timing trong xem trước. Tải SRT cho phụ đề cộng đồng YouTube, ASS có kiểu cho Premiere/DaVinci Resolve, VTT cho trình phát web, LRC cho lời nhạc." },
    ],
    th: [
      { name: "เริ่มจากวิดีโอหรือไฟล์ซับ", text: "อัปโหลด SRT/ASS/VTT/LRC แยก: YouTube ด้วย yt-dlp, แพลตฟอร์มอื่นด้วยเครื่องมือเฉพาะ รูปแบบและการเข้ารหัส UTF-8/UTF-16/GBK ตรวจจับอัตโนมัติ" },
      { name: "เลือกเอนจินและโหมดเอาต์พุต", text: "Google ฟรีสำหรับทดสอบเร็ว, DeepSeek/DeepL API เพื่อคุณภาพ 'เฉพาะคำแปล' สำหรับเผยแพร่, 'สองภาษา' สำหรับเรียนภาษา ในสองภาษา วางคำแปลด้านบน (เรียน) หรือด้านล่าง (ดู)" },
      { name: "แปลและส่งออกไปยังแพลตฟอร์ม", text: "คลิกแปลและตรวจสอบจังหวะในตัวอย่าง ดาวน์โหลด SRT สำหรับซับชุมชน YouTube, ASS มีสไตล์สำหรับ Premiere/DaVinci Resolve, VTT สำหรับเว็บเพลเยอร์, LRC สำหรับเนื้อเพลง" },
    ],
    tr: [
      { name: "Video veya altyazı dosyasından başlayın", text: "SRT/ASS/VTT/LRC yükleyin. Çıkarma: YouTube yt-dlp ile, diğer platformlar özel araçlarla. Format ve UTF-8/UTF-16/GBK kodlaması otomatik algılanır." },
      { name: "Motor ve çıktı modunu seçin", text: "Hızlı testler için Google ücretsiz, kalite için DeepSeek/DeepL API. Yayınlamak için 'Yalnızca Çeviri', dil öğrenmek için 'İki Dilli'. İki dillide çeviri üstte (öğrenme) veya altta (izleme)." },
      { name: "Çevirin ve platformunuza aktarın", text: "Çevir'e tıklayın ve önizlemede zamanlamayı kontrol edin. YouTube topluluk altyazıları için SRT, Premiere/DaVinci Resolve için stilli ASS, web oynatıcılar için VTT, şarkı sözleri için LRC indirin." },
    ],
    bn: [
      { name: "ভিডিও বা সাবটাইটেল ফাইল থেকে শুরু করুন", text: "SRT/ASS/VTT/LRC আপলোড করুন। নিষ্কাশন: YouTube থেকে yt-dlp দিয়ে, অন্য প্ল্যাটফর্ম থেকে ডেডিকেটেড টুল দিয়ে। ফরম্যাট এবং UTF-8/UTF-16 এনকোডিং স্বয়ংক্রিয় শনাক্ত।" },
      { name: "ইঞ্জিন এবং আউটপুট মোড নির্বাচন করুন", text: "দ্রুত পরীক্ষার জন্য Google ফ্রি, মানের জন্য DeepSeek/DeepL API। প্রকাশের জন্য 'শুধু অনুবাদ', ভাষা শেখার জন্য 'দ্বিভাষিক'। দ্বিভাষিকে অনুবাদ উপরে (শেখা) বা নীচে (দেখা)।" },
      { name: "অনুবাদ করুন এবং আপনার প্ল্যাটফর্মে রপ্তানি করুন", text: "অনুবাদে ক্লিক করুন এবং প্রিভিউতে টাইমিং পরীক্ষা করুন। YouTube কমিউনিটি সাবটাইটেলের জন্য SRT, Premiere/DaVinci Resolve-এর জন্য স্টাইলযুক্ত ASS, ওয়েব প্লেয়ারের জন্য VTT, গানের জন্য LRC ডাউনলোড করুন।" },
    ],
    id: [
      { name: "Mulai dari video atau file subtitle", text: "Unggah SRT/ASS/VTT/LRC. Ekstraksi: YouTube via yt-dlp, platform lain via alat khusus. Format dan pengkodean UTF-8/UTF-16/GBK terdeteksi otomatis." },
      { name: "Pilih mesin dan mode output", text: "Google gratis untuk tes cepat, DeepSeek/DeepL API untuk kualitas. 'Hanya terjemahan' untuk publikasi, 'Dwibahasa' untuk pembelajaran bahasa. Di dwibahasa, posisi atas (belajar) atau bawah (menonton)." },
      { name: "Terjemahkan dan ekspor ke platform Anda", text: "Klik Terjemahkan dan verifikasi timing di pratinjau. Unduh SRT untuk subtitle komunitas YouTube, ASS bergaya untuk Premiere/DaVinci Resolve, VTT untuk pemutar web, LRC untuk lirik." },
    ],
    it: [
      { name: "Iniziare da video o file di sottotitoli", text: "Carica SRT/ASS/VTT/LRC. Estrazione: YouTube via yt-dlp, altre piattaforme via strumenti dedicati. Formato e codifica UTF-8/UTF-16/GBK rilevati automaticamente." },
      { name: "Scegliere motore e modalità di output", text: "Google gratuito per test rapidi, DeepSeek/DeepL API per qualità. 'Solo traduzione' per pubblicazione, 'Bilingue' per apprendimento linguistico. In bilingue, posizione sopra (apprendimento) o sotto (visione)." },
      { name: "Tradurre ed esportare sulla piattaforma", text: "Clicca Traduci e verifica il timing nell'anteprima. Scarica SRT per sottotitoli comunitari YouTube, ASS stilizzato per Premiere/DaVinci Resolve, VTT per lettori web, LRC per testi." },
    ],
  },
  "md-translator": {
    en: [
      { name: "Upload Markdown", text: "Upload one or more .md files, or paste Markdown content into the input area." },
      { name: "Configure options", text: "Choose whether to translate Front Matter, code blocks, and LaTeX formulas based on your needs." },
      { name: "Translate and export", text: "Select target language and click Translate. Download translated .md files with formatting preserved." },
    ],
    zh: [
      { name: "上传 Markdown 文件", text: "上传一个或多个 .md 文件，或将 Markdown 内容粘贴到输入区。" },
      { name: "配置选项", text: "根据需要选择是否翻译 Front Matter、代码块和 LaTeX 公式。" },
      { name: "翻译并导出", text: "选择目标语言并点击翻译。下载翻译后的 .md 文件，格式完整保留。" },
    ],
      ja: [
      { name: "Markdown をアップロード", text: "1つまたは複数の .md ファイルをアップロード、または入力エリアに Markdown をペースト。" },
      { name: "オプションを設定", text: "Front Matter、コードブロック、LaTeX 数式を翻訳するかどうかを必要に応じて選択。" },
      { name: "翻訳してエクスポート", text: "対象言語を選択して「翻訳」をクリック。書式を保持した翻訳済み .md ファイルをダウンロード。" },
    ],
    ko: [
      { name: "Markdown 업로드", text: "하나 이상의 .md 파일을 업로드하거나 입력 영역에 Markdown 콘텐츠를 붙여넣습니다." },
      { name: "옵션 구성", text: "필요에 따라 Front Matter, 코드 블록 및 LaTeX 수식 번역 여부를 선택합니다." },
      { name: "번역 및 내보내기", text: "대상 언어를 선택하고 번역을 클릭. 서식이 보존된 번역된 .md 파일을 다운로드." },
    ],
    fr: [
      { name: "Importer le Markdown", text: "Importez un ou plusieurs fichiers .md, ou collez le contenu Markdown dans la zone de saisie." },
      { name: "Configurer les options", text: "Choisissez de traduire le Front Matter, les blocs de code et les formules LaTeX selon vos besoins." },
      { name: "Traduire et exporter", text: "Sélectionnez la langue cible et cliquez sur Traduire. Téléchargez les fichiers .md traduits avec formatage préservé." },
    ],
    de: [
      { name: "Markdown hochladen", text: "Laden Sie eine oder mehrere .md-Dateien hoch oder fügen Sie Markdown-Inhalte ein." },
      { name: "Optionen konfigurieren", text: "Wählen Sie, ob Front Matter, Codeblöcke und LaTeX-Formeln übersetzt werden sollen." },
      { name: "Übersetzen und exportieren", text: "Zielsprache wählen und auf Übersetzen klicken. Download mit erhaltener Formatierung." },
    ],
    es: [
      { name: "Subir Markdown", text: "Suba uno o más archivos .md, o pegue contenido Markdown en el área de entrada." },
      { name: "Configurar opciones", text: "Elija si traducir Front Matter, bloques de código y fórmulas LaTeX según sus necesidades." },
      { name: "Traducir y exportar", text: "Seleccione idioma de destino y haga clic en Traducir. Descargue con formato preservado." },
    ],
    pt: [
      { name: "Carregar Markdown", text: "Carregue um ou mais arquivos .md ou cole conteúdo Markdown na área de entrada." },
      { name: "Configurar opções", text: "Escolha se traduzir Front Matter, blocos de código e fórmulas LaTeX conforme necessidade." },
      { name: "Traduzir e exportar", text: "Selecione idioma e clique em Traduzir. Baixe com formatação preservada." },
    ],
      ru: [
      { name: "Загрузить Markdown", text: "Загрузите один или несколько .md-файлов или вставьте Markdown." },
      { name: "Настроить параметры", text: "Выберите перевод Front Matter, блоков кода и формул LaTeX по необходимости." },
      { name: "Перевести и экспортировать", text: "Выберите язык и нажмите Перевести. Скачайте с сохранённым форматированием." },
    ],
    ar: [
      { name: "تحميل Markdown", text: "حمّل ملف أو أكثر من .md أو الصق محتوى Markdown." },
      { name: "ضبط الخيارات", text: "اختر ترجمة Front Matter وكتل الكود وصيغ LaTeX حسب الحاجة." },
      { name: "ترجمة وتصدير", text: "اختر اللغة وانقر ترجمة. حمّل مع الحفاظ على التنسيق." },
    ],
    hi: [
      { name: "Markdown अपलोड करें", text: "एक या अधिक .md फ़ाइलें अपलोड करें या Markdown कंटेंट पेस्ट करें।" },
      { name: "विकल्प कॉन्फ़िगर करें", text: "आवश्यकतानुसार Front Matter, कोड ब्लॉक और LaTeX सूत्र अनुवाद चुनें।" },
      { name: "अनुवाद करें और निर्यात करें", text: "लक्ष्य भाषा चुनें। फ़ॉर्मेट संरक्षित .md डाउनलोड करें।" },
    ],
    vi: [
      { name: "Tải Markdown lên", text: "Tải một hoặc nhiều tệp .md hoặc dán nội dung Markdown." },
      { name: "Cấu hình tùy chọn", text: "Chọn dịch Front Matter, khối mã và công thức LaTeX theo nhu cầu." },
      { name: "Dịch và xuất", text: "Chọn ngôn ngữ. Tải xuống tệp .md đã dịch với định dạng được giữ nguyên." },
    ],
    th: [
      { name: "อัปโหลด Markdown", text: "อัปโหลดไฟล์ .md หนึ่งไฟล์หรือมากกว่า หรือวางเนื้อหา Markdown" },
      { name: "กำหนดตัวเลือก", text: "เลือกแปล Front Matter บล็อกโค้ด และสูตร LaTeX ตามต้องการ" },
      { name: "แปลและส่งออก", text: "เลือกภาษา ดาวน์โหลดไฟล์ .md พร้อมรูปแบบที่เก็บไว้" },
    ],
    tr: [
      { name: "Markdown yükle", text: "Bir veya daha fazla .md dosyası yükleyin veya Markdown içeriği yapıştırın." },
      { name: "Seçenekleri yapılandır", text: "İhtiyaca göre Front Matter, kod blokları ve LaTeX formülü çevirisini seçin." },
      { name: "Çevir ve dışa aktar", text: "Hedef dili seçin. Biçim korunarak .md dosyalarını indirin." },
    ],
    bn: [
      { name: "Markdown আপলোড করুন", text: "এক বা একাধিক .md ফাইল আপলোড করুন।" },
      { name: "অপশন কনফিগার করুন", text: "Front Matter, কোড ব্লক এবং LaTeX সূত্রের অনুবাদ নির্বাচন করুন।" },
      { name: "অনুবাদ ও রপ্তানি করুন", text: "ফরম্যাট সংরক্ষিত .md ডাউনলোড করুন।" },
    ],
    id: [
      { name: "Unggah Markdown", text: "Unggah satu atau lebih file .md atau tempel konten Markdown." },
      { name: "Konfigurasi opsi", text: "Pilih untuk menerjemahkan Front Matter, blok kode dan rumus LaTeX." },
      { name: "Terjemahkan dan ekspor", text: "Pilih bahasa. Unduh file .md dengan format terjaga." },
    ],
    it: [
      { name: "Carica Markdown", text: "Carica uno o più file .md o incolla contenuto Markdown." },
      { name: "Configura opzioni", text: "Scegli di tradurre Front Matter, blocchi di codice e formule LaTeX." },
      { name: "Traduci ed esporta", text: "Seleziona lingua. Scarica file .md con formattazione preservata." },
    ],
  },
  "text-splitter": {
    zh: [
      { name: "输入长文本到工具", text: "粘贴超长文本（小说章节、演讲稿、论文）或上传 TXT 文件。法语 GBK、日语 Shift-JIS 等非 UTF-8 文件请直接上传以自动识别编码。" },
      { name: "根据 AI 模型或平台设置字符数", text: "ChatGPT 免费版 4000、Plus 32000、Claude 200K、Gemini 1M；微博 140、Twitter 280、小红书 1000；翻译工具 5000。工具在段落边界分割不切断句子。" },
      { name: "导出为 AI 输入或社交发布", text: "复制单段内容直接粘贴到 ChatGPT/Claude/Gemini。批量导出为独立文件按 1/N、2/N 编号，方便按顺序发布到 Twitter/微博/小红书。合并导出用于保存为整理后的长文。" },
    ],
    en: [
      { name: "Input long text into the tool", text: "Paste very long text (novel chapters, speeches, research papers) or upload TXT file. For non-UTF-8 files (French GBK, Japanese Shift-JIS, Korean EUC-KR), upload the file directly for auto encoding detection." },
      { name: "Set character count by AI model or platform", text: "ChatGPT free 4000, Plus 32K, Claude 200K, Gemini 1M; Weibo 140, Twitter 280, Xiaohongshu 1000; translation tools 5000. Tool splits at paragraph boundaries without cutting sentences." },
      { name: "Export for AI input or social posting", text: "Copy single segments directly into ChatGPT/Claude/Gemini. Batch-export as separate files numbered 1/N, 2/N for sequential posting on Twitter/Weibo/Xiaohongshu. Merged export for saving organized long-form text." },
    ],
    ja: [
      { name: "長いテキストをツールに入力", text: "長大なテキスト（小説章、演説原稿、論文）を貼り付けまたは TXT ファイルをアップロード。フランス語 GBK、日本語 Shift-JIS などの非 UTF-8 ファイルは直接アップロードでエンコーディング自動検出。" },
      { name: "AI モデルやプラットフォームに応じた文字数を設定", text: "ChatGPT 無料版 4000、Plus 32K、Claude 20 万、Gemini 100 万；X 280、Threads 500、微博 140；翻訳ツール 5000。ツールは段落境界で分割し文を途中で切りません。" },
      { name: "AI 入力や SNS 投稿用にエクスポート", text: "個別セグメントをコピーして ChatGPT/Claude/Gemini に直接貼り付け。1/N、2/N の番号付き個別ファイルとしてバッチ出力し、X/Threads/微博で順次投稿に便利。マージ出力は整理済み長文の保存用。" },
    ],
    ko: [
      { name: "긴 텍스트를 도구에 입력", text: "매우 긴 텍스트(소설 챕터, 연설문, 논문)를 붙여넣거나 TXT 파일을 업로드. 프랑스어 GBK, 일본어 Shift-JIS, 한국어 EUC-KR 등 비 UTF-8 파일은 파일로 직접 업로드해 인코딩 자동 감지." },
      { name: "AI 모델 또는 플랫폼에 따라 글자 수 설정", text: "ChatGPT 무료 4000, Plus 32K, Claude 20만, Gemini 100만; X 280, Threads 500, 네이버 블로그 100만; 번역 도구 5000. 도구는 문장 중간이 아닌 단락 경계에서 분할." },
      { name: "AI 입력 또는 소셜 게시용으로 내보내기", text: "개별 세그먼트를 복사해 ChatGPT/Claude/Gemini에 바로 붙여넣기. 1/N, 2/N 번호로 개별 파일 일괄 내보내기 X/Threads/네이버 순차 게시 편리. 병합 내보내기는 정리된 장문 저장용." },
    ],
    fr: [
      { name: "Saisir le texte long dans l'outil", text: "Collez un texte très long (chapitres de roman, discours, articles de recherche) ou importez un fichier TXT. Pour les fichiers non-UTF-8 (français GBK, japonais Shift-JIS), importez directement pour détection auto d'encodage." },
      { name: "Régler le nombre de caractères selon l'IA ou la plateforme", text: "ChatGPT gratuit 4000, Plus 32K, Claude 200K, Gemini 1M ; Twitter 280, Threads 500, Mastodon 500 ; outils de traduction 5000. Découpe aux limites de paragraphe sans couper les phrases." },
      { name: "Exporter pour entrée IA ou publication sociale", text: "Copiez des segments individuels directement dans ChatGPT/Claude/Gemini. Export batch en fichiers numérotés 1/N, 2/N pour publication séquentielle Twitter/Threads. Export fusionné pour sauvegarde de texte long organisé." },
    ],
    de: [
      { name: "Langen Text in das Tool eingeben", text: "Sehr langen Text (Romankapitel, Reden, Forschungsarbeiten) einfügen oder TXT-Datei hochladen. Für Nicht-UTF-8-Dateien (Französisch GBK, Japanisch Shift-JIS) Datei direkt hochladen für Auto-Encoding-Erkennung." },
      { name: "Zeichenanzahl nach KI-Modell oder Plattform einstellen", text: "ChatGPT kostenlos 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, Mastodon 500; Übersetzungstools 5000. Tool teilt an Absatzgrenzen ohne Satzunterbrechung." },
      { name: "Für KI-Eingabe oder Social Posting exportieren", text: "Einzelsegmente direkt in ChatGPT/Claude/Gemini kopieren. Batch-Export als nummerierte 1/N, 2/N-Dateien für sequenzielle Twitter/Threads-Beiträge. Zusammengeführter Export für organisiertes Langform-Text-Speichern." },
    ],
    es: [
      { name: "Introducir texto largo en la herramienta", text: "Pegue texto muy largo (capítulos de novela, discursos, artículos) o suba archivo TXT. Para archivos no-UTF-8 (francés GBK, japonés Shift-JIS), suba el archivo directamente para detección auto de codificación." },
      { name: "Establecer número de caracteres según IA o plataforma", text: "ChatGPT gratis 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, Mastodon 500; herramientas traducción 5000. Divide en límites de párrafo sin cortar frases." },
      { name: "Exportar para entrada IA o publicación social", text: "Copie segmentos individuales directamente a ChatGPT/Claude/Gemini. Exporte por lotes como archivos numerados 1/N, 2/N para publicación secuencial Twitter/Threads. Exportación fusionada para guardar texto largo organizado." },
    ],
    pt: [
      { name: "Inserir texto longo na ferramenta", text: "Cole texto muito longo (capítulos de romance, discursos, artigos) ou carregue arquivo TXT. Para arquivos não-UTF-8 (francês GBK, japonês Shift-JIS), carregue o arquivo diretamente para detecção auto de codificação." },
      { name: "Definir número de caracteres por IA ou plataforma", text: "ChatGPT grátis 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, Mastodon 500; ferramentas tradução 5000. Divide em limites de parágrafo sem cortar frases." },
      { name: "Exportar para entrada IA ou postagem social", text: "Copie segmentos individuais diretamente em ChatGPT/Claude/Gemini. Exporte em lote como arquivos numerados 1/N, 2/N para postagem sequencial Twitter/Threads. Exportação mesclada para salvar texto longo organizado." },
    ],
    ru: [
      { name: "Введите длинный текст в инструмент", text: "Вставьте очень длинный текст (главы романа, речи, научные статьи) или загрузите TXT файл. Для не-UTF-8 файлов (французский GBK, японский Shift-JIS) загружайте файл напрямую для автоопределения кодировки." },
      { name: "Установите количество символов по модели ИИ или платформе", text: "ChatGPT бесплатный 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, VK 4000; инструменты перевода 5000. Инструмент разбивает на границах абзацев без разрыва предложений." },
      { name: "Экспорт для ввода ИИ или публикации", text: "Копируйте отдельные сегменты прямо в ChatGPT/Claude/Gemini. Пакетный экспорт как пронумерованные файлы 1/N, 2/N для последовательной публикации Twitter/Threads/VK. Объединённый экспорт для сохранения организованного длинного текста." },
    ],
    ar: [
      { name: "أدخل النص الطويل في الأداة", text: "الصق نصاً طويلاً جداً (فصول رواية، خطابات، أوراق بحثية) أو حمّل ملف TXT. للملفات غير UTF-8 (فرنسي GBK، ياباني Shift-JIS)، حمّل الملف مباشرة للكشف التلقائي عن الترميز." },
      { name: "اضبط عدد الأحرف حسب نموذج AI أو المنصة", text: "ChatGPT مجاني 4000، Plus 32K، Claude 200K، Gemini 1M؛ Twitter 280، Threads 500، Mastodon 500؛ أدوات الترجمة 5000. تقسم الأداة عند حدود الفقرات دون قطع الجمل." },
      { name: "التصدير للإدخال في AI أو النشر الاجتماعي", text: "انسخ المقاطع الفردية مباشرة إلى ChatGPT/Claude/Gemini. تصدير دفعي كملفات مرقمة 1/N، 2/N للنشر المتسلسل على Twitter/Threads. تصدير مدمج لحفظ نص طويل منظم." },
    ],
    hi: [
      { name: "टूल में लंबा पाठ दर्ज करें", text: "बहुत लंबा पाठ (उपन्यास अध्याय, भाषण, शोध पत्र) पेस्ट करें या TXT फ़ाइल अपलोड करें। गैर-UTF-8 फ़ाइलों (फ्रेंच GBK, जापानी Shift-JIS) के लिए एन्कोडिंग स्वतः पहचानने हेतु फ़ाइल सीधे अपलोड करें।" },
      { name: "AI मॉडल या प्लेटफॉर्म के अनुसार अक्षर संख्या सेट करें", text: "ChatGPT फ्री 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, WhatsApp Status 700; अनुवाद टूल 5000। टूल अनुच्छेद सीमाओं पर बाँटता है, वाक्य नहीं काटता।" },
      { name: "AI इनपुट या सोशल पोस्टिंग के लिए निर्यात करें", text: "व्यक्तिगत खंडों को सीधे ChatGPT/Claude/Gemini में कॉपी करें। Twitter/Threads पर क्रमिक पोस्टिंग के लिए 1/N, 2/N नंबर वाली अलग फ़ाइलों के रूप में बैच निर्यात। व्यवस्थित लंबे पाठ सहेजने के लिए मर्ज निर्यात।" },
    ],
    vi: [
      { name: "Nhập văn bản dài vào công cụ", text: "Dán văn bản rất dài (chương tiểu thuyết, bài phát biểu, bài nghiên cứu) hoặc tải lên tệp TXT. Với tệp không phải UTF-8 (tiếng Pháp GBK, tiếng Nhật Shift-JIS), tải tệp trực tiếp để tự phát hiện mã hóa." },
      { name: "Đặt số ký tự theo mô hình AI hoặc nền tảng", text: "ChatGPT miễn phí 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, Mastodon 500; công cụ dịch 5000. Công cụ chia tại biên đoạn văn không cắt câu." },
      { name: "Xuất cho nhập AI hoặc đăng mạng xã hội", text: "Sao chép từng đoạn riêng trực tiếp vào ChatGPT/Claude/Gemini. Xuất hàng loạt thành tệp đánh số 1/N, 2/N cho đăng tuần tự Twitter/Threads. Xuất gộp để lưu văn bản dài có tổ chức." },
    ],
    th: [
      { name: "ป้อนข้อความยาวลงในเครื่องมือ", text: "วางข้อความยาวมาก (บทนวนิยาย, คำปราศรัย, งานวิจัย) หรืออัปโหลดไฟล์ TXT สำหรับไฟล์ไม่ใช่ UTF-8 (ฝรั่งเศส GBK, ญี่ปุ่น Shift-JIS) อัปโหลดไฟล์โดยตรงเพื่อตรวจจับการเข้ารหัสอัตโนมัติ" },
      { name: "ตั้งค่าจำนวนตัวอักษรตามโมเดล AI หรือแพลตฟอร์ม", text: "ChatGPT ฟรี 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, Mastodon 500; เครื่องมือแปล 5000 เครื่องมือแบ่งที่ขอบย่อหน้าไม่ตัดประโยค" },
      { name: "ส่งออกสำหรับอินพุต AI หรือโพสต์โซเชียล", text: "คัดลอกแต่ละส่วนไปใส่ ChatGPT/Claude/Gemini โดยตรง ส่งออกเป็นชุดไฟล์เลขที่ 1/N, 2/N เพื่อโพสต์ต่อเนื่องบน Twitter/Threads ส่งออกแบบรวมเพื่อบันทึกข้อความยาวที่จัดระเบียบ" },
    ],
    tr: [
      { name: "Uzun metni araca girin", text: "Çok uzun metni (roman bölümleri, konuşmalar, araştırma makaleleri) yapıştırın veya TXT dosyası yükleyin. UTF-8 olmayan dosyalar için (Fransızca GBK, Japonca Shift-JIS) dosyayı doğrudan yükleyin." },
      { name: "AI modeli veya platforma göre karakter sayısı ayarlayın", text: "ChatGPT ücretsiz 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, Mastodon 500; çeviri araçları 5000. Araç cümleleri kesmeden paragraf sınırlarında böler." },
      { name: "AI girişi veya sosyal paylaşım için dışa aktarın", text: "Tek tek segmentleri doğrudan ChatGPT/Claude/Gemini'ye kopyalayın. Twitter/Threads'te sıralı paylaşım için 1/N, 2/N numaralı ayrı dosyalar olarak toplu dışa aktarın. Organize uzun metin kaydetmek için birleştirilmiş dışa aktarım." },
    ],
    bn: [
      { name: "টুলে লম্বা টেক্সট ইনপুট করুন", text: "খুব লম্বা টেক্সট (উপন্যাসের অধ্যায়, বক্তৃতা, গবেষণা পত্র) পেস্ট করুন বা TXT ফাইল আপলোড করুন। নন-UTF-8 ফাইলের জন্য (ফরাসি GBK, জাপানি Shift-JIS) ফাইল সরাসরি আপলোড করুন।" },
      { name: "AI মডেল বা প্ল্যাটফর্ম অনুসারে অক্ষর সংখ্যা সেট করুন", text: "ChatGPT ফ্রি 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, WhatsApp Status 700; অনুবাদ টুল 5000। টুল অনুচ্ছেদ সীমায় ভাঙে বাক্য কাটে না।" },
      { name: "AI ইনপুট বা সোশ্যাল পোস্টিংয়ের জন্য রপ্তানি করুন", text: "পৃথক অংশগুলি সরাসরি ChatGPT/Claude/Gemini-এ কপি করুন। Twitter/Threads-এ ক্রমিক পোস্টিংয়ের জন্য 1/N, 2/N নম্বর সহ আলাদা ফাইলে ব্যাচ রপ্তানি। সংগঠিত লম্বা টেক্সট সংরক্ষণের জন্য একত্রিত রপ্তানি।" },
    ],
    id: [
      { name: "Masukkan teks panjang ke alat", text: "Tempel teks sangat panjang (bab novel, pidato, makalah penelitian) atau unggah file TXT. Untuk file non-UTF-8 (Prancis GBK, Jepang Shift-JIS, Korea EUC-KR), unggah file langsung untuk deteksi pengkodean otomatis." },
      { name: "Atur jumlah karakter sesuai model AI atau platform", text: "ChatGPT gratis 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, Mastodon 500; alat terjemahan 5000. Alat membagi pada batas paragraf tanpa memotong kalimat." },
      { name: "Ekspor untuk input AI atau posting media sosial", text: "Salin segmen individu langsung ke ChatGPT/Claude/Gemini. Ekspor batch sebagai file bernomor 1/N, 2/N untuk posting berurutan di Twitter/Threads. Ekspor gabungan untuk menyimpan teks panjang yang terorganisir." },
    ],
    it: [
      { name: "Immettere testo lungo nello strumento", text: "Incollare testo molto lungo (capitoli di romanzo, discorsi, articoli di ricerca) o caricare file TXT. Per file non UTF-8 (francese GBK, giapponese Shift-JIS, coreano EUC-KR), caricare il file direttamente per rilevamento automatico codifica." },
      { name: "Impostare numero di caratteri in base a modello IA o piattaforma", text: "ChatGPT gratuito 4000, Plus 32K, Claude 200K, Gemini 1M; Twitter 280, Threads 500, Mastodon 500; strumenti traduzione 5000. Lo strumento divide ai confini di paragrafo senza tagliare le frasi." },
      { name: "Esportare per input IA o pubblicazione social", text: "Copiare singoli segmenti direttamente in ChatGPT/Claude/Gemini. Esportazione batch come file numerati 1/N, 2/N per pubblicazione sequenziale Twitter/Threads. Esportazione unita per salvare testo lungo organizzato." },
    ],
  },
  "json-value-extractor": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content you want to extract values from into the input area." },
      { name: "Add extraction rules", text: "Enter field names (supports nested keys like 'user.name' via dot notation). Add custom prefix/suffix for formatted output." },
      { name: "Extract and copy", text: "Click Extract. The tool returns deduplicated values — copy or export as needed." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要提取值的 JSON 内容粘贴到输入区。" },
      { name: "添加提取规则", text: "输入字段名（支持嵌套键如 'user.name' 的点路径）。可添加自定义前后缀用于格式化输出。" },
      { name: "提取并复制", text: "点击提取。工具返回去重后的值，按需复制或导出。" },
    ],
      ja: [
      { name: "JSON データを貼り付け", text: "値を抽出したい JSON コンテンツを入力エリアにペースト。" },
      { name: "抽出ルールを追加", text: "フィールド名（ネストキー 'user.name' など点記法）を入力。カスタム接頭辞/接尾辞で整形出力も可能。" },
      { name: "抽出してコピー", text: "「抽出」をクリック。重複排除された値が返されるので、必要に応じてコピーまたはエクスポート。" },
    ],
    ko: [
      { name: "JSON 데이터 붙여넣기", text: "값을 추출할 JSON 콘텐츠를 입력 영역에 붙여넣습니다." },
      { name: "추출 규칙 추가", text: "필드 이름 입력(중첩 키 'user.name' 등 점 표기법 지원). 사용자 정의 접두사/접미사로 형식 출력 가능." },
      { name: "추출 및 복사", text: "추출을 클릭. 도구가 중복 제거된 값을 반환 — 필요에 따라 복사 또는 내보내기." },
    ],
    fr: [
      { name: "Coller les données JSON", text: "Collez le contenu JSON dont vous souhaitez extraire les valeurs." },
      { name: "Ajouter des règles d'extraction", text: "Saisissez les noms de champs (support des clés imbriquées comme 'user.name' en notation point). Ajoutez préfixe/suffixe personnalisés." },
      { name: "Extraire et copier", text: "Cliquez sur Extraire. L'outil renvoie des valeurs dédupliquées à copier ou exporter." },
    ],
    de: [
      { name: "JSON-Daten einfügen", text: "Fügen Sie den JSON-Inhalt ein, aus dem Sie Werte extrahieren möchten." },
      { name: "Extraktionsregeln hinzufügen", text: "Geben Sie Feldnamen ein (unterstützt verschachtelte Schlüssel wie 'user.name' in Punktnotation). Mit benutzerdefinierten Präfixen/Suffixen." },
      { name: "Extrahieren und kopieren", text: "Klicken Sie auf Extrahieren. Das Tool liefert deduplizierte Werte zum Kopieren/Export." },
    ],
    es: [
      { name: "Pegar datos JSON", text: "Pegue el contenido JSON del que desea extraer valores." },
      { name: "Añadir reglas de extracción", text: "Introduzca nombres de campos (admite claves anidadas como 'user.name' en notación de punto). Con prefijos/sufijos personalizados." },
      { name: "Extraer y copiar", text: "Haga clic en Extraer. La herramienta devuelve valores deduplicados para copiar o exportar." },
    ],
    pt: [
      { name: "Colar dados JSON", text: "Cole o conteúdo JSON do qual deseja extrair valores." },
      { name: "Adicionar regras de extração", text: "Insira nomes de campos (suporta chaves aninhadas como 'user.name' em notação de ponto). Com prefixos/sufixos personalizados." },
      { name: "Extrair e copiar", text: "Clique em Extrair. A ferramenta retorna valores deduplicados para copiar ou exportar." },
    ],
      ru: [
      { name: "Вставить данные JSON", text: "Вставьте содержимое JSON для извлечения значений." },
      { name: "Добавить правила извлечения", text: "Введите имена полей (поддерживает вложенные ключи типа 'user.name' в точечной нотации). Добавьте префиксы/суффиксы." },
      { name: "Извлечь и скопировать", text: "Нажмите Извлечь. Инструмент вернёт уникальные значения для копирования/экспорта." },
    ],
    ar: [
      { name: "لصق بيانات JSON", text: "الصق محتوى JSON لاستخراج القيم." },
      { name: "إضافة قواعد الاستخراج", text: "أدخل أسماء الحقول (يدعم المفاتيح المتداخلة مثل 'user.name' بتدوين النقطة). أضف بادئات/لاحقات." },
      { name: "استخراج ونسخ", text: "انقر استخراج. تعيد الأداة قيماً بدون تكرار." },
    ],
    hi: [
      { name: "JSON डेटा पेस्ट करें", text: "मान निकालने के लिए JSON कंटेंट पेस्ट करें।" },
      { name: "निष्कर्षण नियम जोड़ें", text: "फ़ील्ड नाम दर्ज करें (बिंदु नोटेशन में 'user.name' जैसी नेस्टेड कुंजियाँ समर्थित)। कस्टम प्रीफिक्स/सफिक्स के साथ।" },
      { name: "निकालें और कॉपी करें", text: "निकालें पर क्लिक करें। डुप्लिकेट हटाए गए मान मिलते हैं।" },
    ],
    vi: [
      { name: "Dán dữ liệu JSON", text: "Dán nội dung JSON để trích xuất giá trị." },
      { name: "Thêm quy tắc trích xuất", text: "Nhập tên trường (hỗ trợ khóa lồng như 'user.name' với ký pháp dấu chấm). Với tiền tố/hậu tố tùy chỉnh." },
      { name: "Trích xuất và sao chép", text: "Nhấp Trích xuất. Công cụ trả về giá trị đã loại trùng." },
    ],
    th: [
      { name: "วางข้อมูล JSON", text: "วางเนื้อหา JSON เพื่อแยกค่า" },
      { name: "เพิ่มกฎการแยก", text: "ใส่ชื่อฟิลด์ (รองรับคีย์ซ้อนเช่น 'user.name' ด้วยสัญกรณ์จุด) พร้อมคำนำหน้า/ต่อท้ายกำหนดเอง" },
      { name: "แยกและคัดลอก", text: "คลิกแยก เครื่องมือคืนค่าที่ไม่ซ้ำ" },
    ],
    tr: [
      { name: "JSON verisini yapıştır", text: "Değer çıkarmak için JSON içeriğini yapıştırın." },
      { name: "Çıkarma kuralları ekle", text: "Alan adları girin (nokta gösterimiyle 'user.name' gibi iç içe anahtarlar desteklenir). Özel önek/sonek ile." },
      { name: "Çıkar ve kopyala", text: "Çıkar'a tıklayın. Araç yinelenmeyen değerleri döndürür." },
    ],
    bn: [
      { name: "JSON ডেটা পেস্ট করুন", text: "মান বের করার জন্য JSON পেস্ট করুন।" },
      { name: "নিষ্কাশন নিয়ম যোগ করুন", text: "ফিল্ড নাম দিন (ডট নোটেশনে 'user.name' এর মতো নেস্টেড কী সমর্থিত)।" },
      { name: "নিষ্কাশন ও কপি করুন", text: "নিষ্কাশন ক্লিক করুন।" },
    ],
    id: [
      { name: "Tempel data JSON", text: "Tempel konten JSON untuk mengekstrak nilai." },
      { name: "Tambahkan aturan ekstraksi", text: "Masukkan nama field (mendukung kunci bersarang seperti 'user.name' dengan notasi titik). Dengan prefiks/sufiks kustom." },
      { name: "Ekstrak dan salin", text: "Klik Ekstrak. Alat mengembalikan nilai unik." },
    ],
    it: [
      { name: "Incolla dati JSON", text: "Incolla il contenuto JSON per estrarre valori." },
      { name: "Aggiungi regole di estrazione", text: "Inserisci nomi di campi (supporta chiavi annidate come 'user.name' con notazione a punti). Con prefissi/suffissi personalizzati." },
      { name: "Estrai e copia", text: "Clicca Estrai. Lo strumento restituisce valori deduplicati." },
    ],
  },
  "json-node-edit": {
    en: [
      { name: "Paste JSON", text: "Paste the JSON to edit into the input area." },
      { name: "Specify target nodes", text: "Enter node names (comma-separated) or JSONPath to target. Supports nested keys like 'zh.title'." },
      { name: "Choose operation and apply", text: "Select add prefix/suffix, find-replace, or full value replacement. Preview changes and apply." },
    ],
    zh: [
      { name: "粘贴 JSON", text: "将需要编辑的 JSON 粘贴到输入区。" },
      { name: "指定目标节点", text: "输入节点名称（逗号分隔）或 JSONPath。支持嵌套键如 'zh.title'。" },
      { name: "选择操作并应用", text: "选择添加前后缀、查找替换或整值覆盖。预览变更后应用。" },
    ],
      ja: [
      { name: "JSON を貼り付け", text: "編集する JSON を入力エリアにペースト。" },
      { name: "対象ノードを指定", text: "ノード名（カンマ区切り）または JSONPath で対象を指定。'zh.title' のようなネストキーにも対応。" },
      { name: "操作を選択して適用", text: "接頭辞/接尾辞追加、検索置換、または値の完全置換を選択。プレビューして適用。" },
    ],
    ko: [
      { name: "JSON 붙여넣기", text: "편집할 JSON을 입력 영역에 붙여넣습니다." },
      { name: "대상 노드 지정", text: "노드 이름(쉼표 구분) 또는 JSONPath로 대상 지정. 'zh.title' 같은 중첩 키 지원." },
      { name: "작업 선택 및 적용", text: "접두사/접미사 추가, 찾기-바꾸기 또는 전체 값 바꾸기 선택. 변경사항 미리보기 후 적용." },
    ],
    fr: [
      { name: "Coller le JSON", text: "Collez le JSON à modifier dans la zone de saisie." },
      { name: "Spécifier les nœuds cibles", text: "Saisissez les noms de nœuds (séparés par virgules) ou JSONPath. Support des clés imbriquées comme 'zh.title'." },
      { name: "Choisir l'opération et appliquer", text: "Sélectionnez ajout de préfixe/suffixe, rechercher-remplacer ou remplacement complet. Prévisualisez et appliquez." },
    ],
    de: [
      { name: "JSON einfügen", text: "Fügen Sie das zu bearbeitende JSON in den Eingabebereich ein." },
      { name: "Zielknoten angeben", text: "Knotennamen (kommagetrennt) oder JSONPath eingeben. Unterstützt verschachtelte Schlüssel." },
      { name: "Operation wählen und anwenden", text: "Präfix/Suffix, Suchen-Ersetzen oder Wertersetzung auswählen. Vorschau und Anwendung." },
    ],
    es: [
      { name: "Pegar JSON", text: "Pegue el JSON a editar en el área de entrada." },
      { name: "Especificar nodos objetivo", text: "Introduzca nombres de nodos (separados por comas) o JSONPath. Admite claves anidadas." },
      { name: "Elegir operación y aplicar", text: "Seleccione añadir prefijo/sufijo, buscar-reemplazar o reemplazo completo. Vista previa y aplicar." },
    ],
    pt: [
      { name: "Colar JSON", text: "Cole o JSON a editar na área de entrada." },
      { name: "Especificar nós alvo", text: "Insira nomes de nós (separados por vírgulas) ou JSONPath. Suporta chaves aninhadas." },
      { name: "Escolher operação e aplicar", text: "Selecione adicionar prefixo/sufixo, buscar-substituir ou substituição completa. Visualize e aplique." },
    ],
      ru: [
      { name: "Вставить JSON", text: "Вставьте JSON для редактирования." },
      { name: "Указать целевые узлы", text: "Введите имена узлов (через запятую) или JSONPath." },
      { name: "Выбрать операцию и применить", text: "Выберите префикс/суффикс, поиск-замену или полную замену. Предпросмотр и применение." },
    ],
    ar: [
      { name: "لصق JSON", text: "الصق JSON للتحرير." },
      { name: "حدد العقد المستهدفة", text: "أدخل أسماء العقد (مفصولة بفواصل) أو JSONPath." },
      { name: "اختر عملية وطبّق", text: "اختر بادئة/لاحقة، بحث-استبدال أو استبدال كامل. عاين وطبّق." },
    ],
    hi: [
      { name: "JSON पेस्ट करें", text: "संपादित करने के लिए JSON पेस्ट करें।" },
      { name: "लक्ष्य नोड निर्दिष्ट करें", text: "नोड नाम (अल्पविराम से अलग) या JSONPath दर्ज करें।" },
      { name: "संचालन चुनें और लागू करें", text: "प्रीफिक्स/सफिक्स, खोज-बदलें या पूर्ण प्रतिस्थापन चुनें।" },
    ],
    vi: [
      { name: "Dán JSON", text: "Dán JSON để chỉnh sửa." },
      { name: "Chỉ định node mục tiêu", text: "Nhập tên node (phân tách bằng dấu phẩy) hoặc JSONPath." },
      { name: "Chọn thao tác và áp dụng", text: "Chọn tiền tố/hậu tố, tìm-thay thế hoặc thay thế hoàn toàn." },
    ],
    th: [
      { name: "วาง JSON", text: "วาง JSON ที่จะแก้ไข" },
      { name: "ระบุโหนดเป้าหมาย", text: "ใส่ชื่อโหนด (คั่นด้วยจุลภาค) หรือ JSONPath" },
      { name: "เลือกการดำเนินการและใช้", text: "เลือกเพิ่มคำนำหน้า/ต่อท้าย ค้นหา-แทนที่ หรือแทนที่ค่าทั้งหมด" },
    ],
    tr: [
      { name: "JSON yapıştır", text: "Düzenlenecek JSON'u yapıştırın." },
      { name: "Hedef düğümleri belirle", text: "Düğüm adlarını (virgülle ayrılmış) veya JSONPath girin." },
      { name: "İşlem seç ve uygula", text: "Önek/sonek, bul-değiştir veya tam değiştirme seçin." },
    ],
    bn: [
      { name: "JSON পেস্ট করুন", text: "সম্পাদনার জন্য JSON পেস্ট করুন।" },
      { name: "লক্ষ্য নোড নির্দিষ্ট করুন", text: "নোড নাম বা JSONPath দিন।" },
      { name: "অপারেশন নির্বাচন করে প্রয়োগ করুন", text: "প্রিফিক্স/সাফিক্স, খুঁজুন-প্রতিস্থাপন নির্বাচন করুন।" },
    ],
    id: [
      { name: "Tempel JSON", text: "Tempel JSON untuk diedit." },
      { name: "Tentukan node target", text: "Masukkan nama node (dipisahkan koma) atau JSONPath." },
      { name: "Pilih operasi dan terapkan", text: "Pilih tambah prefiks/sufiks, cari-ganti atau ganti nilai penuh." },
    ],
    it: [
      { name: "Incolla JSON", text: "Incolla il JSON da modificare." },
      { name: "Specifica nodi target", text: "Inserisci nomi di nodi (separati da virgole) o JSONPath." },
      { name: "Scegli operazione e applica", text: "Seleziona aggiungi prefisso/suffisso, trova-sostituisci o sostituzione completa." },
    ],
  },
  "json-value-transformer": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content for transformation." },
      { name: "Configure mapping rules", text: "Define key-value mapping rules or choose a preset template. Targets field names with recursive search (nested keys via dot notation)." },
      { name: "Transform and export", text: "Click Transform. Export the transformed JSON with original structure preserved." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要转换的 JSON 内容粘贴进来。" },
      { name: "配置映射规则", text: "定义键值映射规则或选择预设模板。通过字段名递归匹配定位（支持嵌套键的点路径）。" },
      { name: "转换并导出", text: "点击转换。导出转换后的 JSON，原始结构完整保留。" },
    ],
      ja: [
      { name: "JSON データを貼り付け", text: "変換対象の JSON コンテンツをペースト。" },
      { name: "マッピングルールを設定", text: "キー値マッピングルールを定義またはプリセットテンプレートを選択。フィールド名の再帰検索で位置特定（ネストキーは点記法）。" },
      { name: "変換してエクスポート", text: "「変換」をクリック。元の構造を保持したまま変換後の JSON をエクスポート。" },
    ],
    ko: [
      { name: "JSON 데이터 붙여넣기", text: "변환할 JSON 콘텐츠를 붙여넣습니다." },
      { name: "매핑 규칙 구성", text: "키-값 매핑 규칙을 정의하거나 프리셋 템플릿 선택. 필드 이름 재귀 검색으로 위치 지정(중첩 키는 점 표기법)." },
      { name: "변환 및 내보내기", text: "변환을 클릭. 원래 구조가 보존된 변환된 JSON 내보내기." },
    ],
    fr: [
      { name: "Coller les données JSON", text: "Collez le contenu JSON à transformer." },
      { name: "Configurer les règles de mapping", text: "Définissez des règles clé-valeur ou choisissez un modèle prédéfini. Cible les noms de champs par recherche récursive (clés imbriquées en notation point)." },
      { name: "Transformer et exporter", text: "Cliquez sur Transformer. Exportez le JSON transformé avec la structure d'origine préservée." },
    ],
    de: [
      { name: "JSON-Daten einfügen", text: "Fügen Sie den zu transformierenden JSON-Inhalt ein." },
      { name: "Mapping-Regeln konfigurieren", text: "Definieren Sie Schlüssel-Wert-Regeln oder wählen Sie eine Vorlage. Zielt auf Feldnamen mit rekursiver Suche (verschachtelte Schlüssel in Punktnotation)." },
      { name: "Transformieren und exportieren", text: "Klicken Sie auf Transformieren. Export mit erhaltener Ursprungsstruktur." },
    ],
    es: [
      { name: "Pegar datos JSON", text: "Pegue el contenido JSON a transformar." },
      { name: "Configurar reglas de mapeo", text: "Defina reglas clave-valor o elija una plantilla predefinida. Localiza nombres de campos con búsqueda recursiva (claves anidadas en notación de punto)." },
      { name: "Transformar y exportar", text: "Haga clic en Transformar. Exporte el JSON con la estructura original preservada." },
    ],
    pt: [
      { name: "Colar dados JSON", text: "Cole o conteúdo JSON a transformar." },
      { name: "Configurar regras de mapeamento", text: "Defina regras chave-valor ou escolha um modelo predefinido. Localiza nomes de campos com busca recursiva (chaves aninhadas em notação de ponto)." },
      { name: "Transformar e exportar", text: "Clique em Transformar. Exporte o JSON com a estrutura original preservada." },
    ],
      ru: [
      { name: "Вставить данные JSON", text: "Вставьте JSON для преобразования." },
      { name: "Настроить правила сопоставления", text: "Определите правила ключ-значение или выберите шаблон. Цели — имена полей с рекурсивным поиском (вложенные ключи в точечной нотации)." },
      { name: "Преобразовать и экспортировать", text: "Нажмите Преобразовать. Экспорт с сохранённой структурой." },
    ],
    ar: [
      { name: "لصق بيانات JSON", text: "الصق محتوى JSON للتحويل." },
      { name: "ضبط قواعد التعيين", text: "عرّف قواعد مفتاح-قيمة أو اختر قالباً. استهداف أسماء الحقول بالبحث التكراري (المفاتيح المتداخلة بتدوين النقطة)." },
      { name: "تحويل وتصدير", text: "انقر تحويل. صدّر مع الحفاظ على البنية." },
    ],
    hi: [
      { name: "JSON डेटा पेस्ट करें", text: "रूपांतरित करने के लिए JSON कंटेंट पेस्ट करें।" },
      { name: "मैपिंग नियम कॉन्फ़िगर करें", text: "कुंजी-मान नियम परिभाषित करें या प्रीसेट चुनें।" },
      { name: "रूपांतरित करें और निर्यात करें", text: "रूपांतरित पर क्लिक करें। मूल संरचना संरक्षित।" },
    ],
    vi: [
      { name: "Dán dữ liệu JSON", text: "Dán nội dung JSON để chuyển đổi." },
      { name: "Cấu hình quy tắc ánh xạ", text: "Định nghĩa quy tắc khóa-giá trị hoặc chọn mẫu. Nhắm tên trường với tìm kiếm đệ quy (khóa lồng với ký pháp dấu chấm)." },
      { name: "Chuyển đổi và xuất", text: "Nhấp Chuyển đổi. Xuất với cấu trúc gốc được bảo toàn." },
    ],
    th: [
      { name: "วางข้อมูล JSON", text: "วางเนื้อหา JSON สำหรับการแปลง" },
      { name: "กำหนดกฎการแมป", text: "กำหนดกฎคีย์-ค่าหรือเลือกเทมเพลต เป้าหมายชื่อฟิลด์ด้วยการค้นหาแบบเรียกซ้ำ (คีย์ซ้อนด้วยสัญกรณ์จุด)" },
      { name: "แปลงและส่งออก", text: "คลิกแปลง ส่งออกพร้อมโครงสร้างเดิม" },
    ],
    tr: [
      { name: "JSON verisini yapıştır", text: "Dönüştürülecek JSON içeriğini yapıştırın." },
      { name: "Eşleme kurallarını yapılandır", text: "Anahtar-değer kuralları tanımlayın veya şablon seçin. Alan adlarını özyinelemeli aramayla hedefler (nokta gösteriminde iç içe anahtarlar)." },
      { name: "Dönüştür ve dışa aktar", text: "Dönüştür'e tıklayın. Yapı korunarak dışa aktarın." },
    ],
    bn: [
      { name: "JSON ডেটা পেস্ট করুন", text: "রূপান্তরের জন্য JSON পেস্ট করুন।" },
      { name: "ম্যাপিং নিয়ম কনফিগার করুন", text: "কী-মান নিয়ম বা প্রিসেট টেমপ্লেট। ফিল্ড নামগুলিকে পুনরাবৃত্ত অনুসন্ধানের মাধ্যমে লক্ষ্য করে (ডট নোটেশনে নেস্টেড কী)।" },
      { name: "রূপান্তর ও রপ্তানি করুন", text: "রূপান্তর ক্লিক করুন।" },
    ],
    id: [
      { name: "Tempel data JSON", text: "Tempel konten JSON untuk ditransformasi." },
      { name: "Konfigurasi aturan pemetaan", text: "Tentukan aturan kunci-nilai atau pilih template. Menargetkan nama field dengan pencarian rekursif (kunci bersarang dengan notasi titik)." },
      { name: "Transformasi dan ekspor", text: "Klik Transformasi." },
    ],
    it: [
      { name: "Incolla dati JSON", text: "Incolla il contenuto JSON da trasformare." },
      { name: "Configura regole di mapping", text: "Definisci regole chiave-valore o scegli un modello. Mira ai nomi dei campi con ricerca ricorsiva (chiavi annidate in notazione a punti)." },
      { name: "Trasforma ed esporta", text: "Clicca Trasforma." },
    ],
  },
  "json-value-swapper": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array containing items whose values need swapping." },
      { name: "Specify fields to swap", text: "Enter the two field names whose values should be exchanged across all array items." },
      { name: "Swap and export", text: "Click Swap. Review missing-field alerts and export the corrected JSON." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要交换字段值的 JSON 数组。" },
      { name: "指定要交换的字段", text: "输入要互换值的两个字段名，工具会处理数组中所有项。" },
      { name: "交换并导出", text: "点击交换。查看缺失字段提示并导出修正后的 JSON。" },
    ],
      ja: [
      { name: "JSON 配列を貼り付け", text: "値を交換したい項目を含む JSON 配列をペースト。" },
      { name: "交換するフィールドを指定", text: "配列のすべての項目で値を交換する2つのフィールド名を入力。" },
      { name: "交換してエクスポート", text: "「交換」をクリック。欠落フィールドの警告を確認してから修正済み JSON をエクスポート。" },
    ],
    ko: [
      { name: "JSON 배열 붙여넣기", text: "값을 교환해야 할 항목을 포함한 JSON 배열을 붙여넣습니다." },
      { name: "교환할 필드 지정", text: "모든 배열 항목에서 값을 교환해야 할 두 필드 이름을 입력합니다." },
      { name: "교환 및 내보내기", text: "교환을 클릭. 누락 필드 경고를 검토하고 수정된 JSON을 내보냅니다." },
    ],
    fr: [
      { name: "Coller le tableau JSON", text: "Collez le tableau JSON contenant les éléments dont les valeurs doivent être échangées." },
      { name: "Spécifier les champs à échanger", text: "Saisissez les deux noms de champs dont les valeurs seront échangées dans tous les éléments." },
      { name: "Échanger et exporter", text: "Cliquez sur Échanger. Consultez les alertes de champs manquants et exportez le JSON corrigé." },
    ],
    de: [
      { name: "JSON-Array einfügen", text: "Fügen Sie das JSON-Array ein, dessen Werte getauscht werden sollen." },
      { name: "Zu tauschende Felder angeben", text: "Zwei Feldnamen eingeben, deren Werte über alle Array-Elemente getauscht werden." },
      { name: "Tauschen und exportieren", text: "Klicken Sie auf Tauschen. Fehlende-Feld-Warnungen prüfen und korrigiertes JSON exportieren." },
    ],
    es: [
      { name: "Pegar array JSON", text: "Pegue el array JSON con los elementos cuyos valores se intercambiarán." },
      { name: "Especificar campos a intercambiar", text: "Introduzca dos nombres de campos cuyos valores se intercambiarán en todos los elementos." },
      { name: "Intercambiar y exportar", text: "Haga clic en Intercambiar. Revise las alertas de campos faltantes y exporte el JSON corregido." },
    ],
    pt: [
      { name: "Colar array JSON", text: "Cole o array JSON contendo itens cujos valores serão trocados." },
      { name: "Especificar campos para trocar", text: "Insira dois nomes de campos cujos valores serão trocados em todos os itens." },
      { name: "Trocar e exportar", text: "Clique em Trocar. Revise alertas de campos ausentes e exporte o JSON corrigido." },
    ],
      ru: [
      { name: "Вставить JSON-массив", text: "Вставьте массив JSON для обмена значениями." },
      { name: "Указать поля для обмена", text: "Введите два имени полей для обмена во всех элементах массива." },
      { name: "Обменять и экспортировать", text: "Нажмите Обмен. Проверьте предупреждения о пропусках и экспортируйте исправленный JSON." },
    ],
    ar: [
      { name: "لصق مصفوفة JSON", text: "الصق مصفوفة JSON لتبادل القيم." },
      { name: "حدد الحقول للتبادل", text: "أدخل اسمي الحقلين لتبادل القيم عبر جميع العناصر." },
      { name: "تبادل وتصدير", text: "انقر تبادل. راجع تحذيرات الحقول المفقودة." },
    ],
    hi: [
      { name: "JSON ऐरे पेस्ट करें", text: "मान बदलने के लिए JSON ऐरे पेस्ट करें।" },
      { name: "स्वैप करने वाले फ़ील्ड निर्दिष्ट करें", text: "दो फ़ील्ड नाम दर्ज करें जिनके मान सभी आइटम्स में स्वैप होंगे।" },
      { name: "स्वैप करें और निर्यात करें", text: "स्वैप पर क्लिक करें। गायब फ़ील्ड अलर्ट देखें।" },
    ],
    vi: [
      { name: "Dán mảng JSON", text: "Dán mảng JSON để hoán đổi giá trị." },
      { name: "Chỉ định trường để hoán đổi", text: "Nhập hai tên trường để hoán đổi qua tất cả các mục." },
      { name: "Hoán đổi và xuất", text: "Nhấp Hoán đổi. Xem cảnh báo trường thiếu." },
    ],
    th: [
      { name: "วางอาร์เรย์ JSON", text: "วางอาร์เรย์ JSON เพื่อสลับค่า" },
      { name: "ระบุฟิลด์ที่จะสลับ", text: "ใส่ชื่อสองฟิลด์ที่จะสลับค่าในทุกรายการ" },
      { name: "สลับและส่งออก", text: "คลิกสลับ ตรวจสอบคำเตือนฟิลด์ที่หายไป" },
    ],
    tr: [
      { name: "JSON dizisini yapıştır", text: "Değerleri değiştirmek için JSON dizisini yapıştırın." },
      { name: "Değiştirilecek alanları belirle", text: "Tüm öğelerde değerleri değiştirmek için iki alan adı girin." },
      { name: "Değiştir ve dışa aktar", text: "Değiştir'e tıklayın. Eksik alan uyarılarını kontrol edin." },
    ],
    bn: [
      { name: "JSON অ্যারে পেস্ট করুন", text: "মান বিনিময়ের জন্য অ্যারে পেস্ট করুন।" },
      { name: "বিনিময়যোগ্য ক্ষেত্র নির্দিষ্ট করুন", text: "দুটি ফিল্ড নাম দিন।" },
      { name: "বিনিময় ও রপ্তানি করুন", text: "বিনিময় ক্লিক করুন।" },
    ],
    id: [
      { name: "Tempel array JSON", text: "Tempel array JSON untuk menukar nilai." },
      { name: "Tentukan field untuk ditukar", text: "Masukkan dua nama field untuk ditukar di semua item." },
      { name: "Tukar dan ekspor", text: "Klik Tukar." },
    ],
    it: [
      { name: "Incolla array JSON", text: "Incolla l'array JSON per scambiare valori." },
      { name: "Specifica campi da scambiare", text: "Inserisci due nomi di campi da scambiare in tutti gli elementi." },
      { name: "Scambia ed esporta", text: "Clicca Scambia." },
    ],
  },
  "json-node-inserter": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON data where new fields should be inserted." },
      { name: "Set reference position", text: "Enter the reference node name (new fields will be inserted after it) and the names of new nodes to add." },
      { name: "Insert and export", text: "Click Insert. The tool adds new fields to every object while preserving original order and structure." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "粘贴需要插入新字段的 JSON 数据。" },
      { name: "设置参考位置", text: "输入参考节点名称（新字段将插入其后）和要添加的新节点名称。" },
      { name: "插入并导出", text: "点击插入。工具为每个对象添加新字段，保持原有顺序和结构。" },
    ],
      ja: [
      { name: "JSON データを貼り付け", text: "新しいフィールドを挿入する JSON データをペースト。" },
      { name: "参照位置を設定", text: "参照ノード名（新フィールドはその後に挿入）と追加する新ノード名を入力。" },
      { name: "挿入してエクスポート", text: "「挿入」をクリック。元の順序と構造を保持したままフィールドが追加されます。" },
    ],
    ko: [
      { name: "JSON 데이터 붙여넣기", text: "새 필드를 삽입할 JSON 데이터를 붙여넣습니다." },
      { name: "참조 위치 설정", text: "참조 노드 이름(새 필드는 그 뒤에 삽입됨)과 추가할 새 노드 이름을 입력합니다." },
      { name: "삽입 및 내보내기", text: "삽입을 클릭. 도구가 원래 순서와 구조를 보존하면서 모든 객체에 새 필드를 추가합니다." },
    ],
    fr: [
      { name: "Coller les données JSON", text: "Collez les données JSON où les nouveaux champs doivent être insérés." },
      { name: "Définir la position de référence", text: "Saisissez le nœud de référence (les nouveaux champs sont insérés après) et les noms des nouveaux nœuds." },
      { name: "Insérer et exporter", text: "Cliquez sur Insérer. L'outil ajoute les nouveaux champs à chaque objet en préservant l'ordre." },
    ],
    de: [
      { name: "JSON-Daten einfügen", text: "Fügen Sie die JSON-Daten ein, in die neue Felder eingefügt werden sollen." },
      { name: "Referenzposition setzen", text: "Referenzknoten und neue Knotennamen angeben (neue Felder werden danach eingefügt)." },
      { name: "Einfügen und exportieren", text: "Klicken Sie auf Einfügen. Das Tool fügt neue Felder unter Beibehaltung von Reihenfolge hinzu." },
    ],
    es: [
      { name: "Pegar datos JSON", text: "Pegue los datos JSON donde se insertarán nuevos campos." },
      { name: "Establecer posición de referencia", text: "Introduzca el nodo de referencia y los nombres de los nuevos nodos a añadir." },
      { name: "Insertar y exportar", text: "Haga clic en Insertar. La herramienta añade campos manteniendo el orden original." },
    ],
    pt: [
      { name: "Colar dados JSON", text: "Cole os dados JSON onde novos campos serão inseridos." },
      { name: "Definir posição de referência", text: "Insira o nó de referência e os nomes dos novos nós a adicionar." },
      { name: "Inserir e exportar", text: "Clique em Inserir. A ferramenta adiciona campos mantendo a ordem original." },
    ],
      ru: [
      { name: "Вставить данные JSON", text: "Вставьте данные JSON для добавления полей." },
      { name: "Задать референсную позицию", text: "Введите референсный узел и имена новых узлов (через запятую)." },
      { name: "Вставить и экспортировать", text: "Нажмите Вставить. Инструмент добавит поля с сохранением порядка." },
    ],
    ar: [
      { name: "لصق بيانات JSON", text: "الصق بيانات JSON لإدراج حقول." },
      { name: "تعيين موضع مرجعي", text: "أدخل العقدة المرجعية وأسماء العقد الجديدة." },
      { name: "إدراج وتصدير", text: "انقر إدراج. تضيف الأداة الحقول مع الحفاظ على الترتيب." },
    ],
    hi: [
      { name: "JSON डेटा पेस्ट करें", text: "नए फ़ील्ड डालने के लिए JSON डेटा पेस्ट करें।" },
      { name: "संदर्भ स्थिति सेट करें", text: "संदर्भ नोड और नए नोड नाम (कॉमा-अलग) दर्ज करें।" },
      { name: "डालें और निर्यात करें", text: "डालें पर क्लिक करें। मूल क्रम बना रहता है।" },
    ],
    vi: [
      { name: "Dán dữ liệu JSON", text: "Dán dữ liệu JSON để chèn trường mới." },
      { name: "Đặt vị trí tham chiếu", text: "Nhập node tham chiếu và tên node mới." },
      { name: "Chèn và xuất", text: "Nhấp Chèn. Thứ tự gốc được giữ nguyên." },
    ],
    th: [
      { name: "วางข้อมูล JSON", text: "วางข้อมูล JSON เพื่อแทรกฟิลด์ใหม่" },
      { name: "ตั้งค่าตำแหน่งอ้างอิง", text: "ใส่โหนดอ้างอิงและชื่อโหนดใหม่" },
      { name: "แทรกและส่งออก", text: "คลิกแทรก ลำดับเดิมยังคงอยู่" },
    ],
    tr: [
      { name: "JSON verisini yapıştır", text: "Yeni alanlar eklemek için JSON verisini yapıştırın." },
      { name: "Referans konumu ayarla", text: "Referans düğümü ve yeni düğüm adlarını girin." },
      { name: "Ekle ve dışa aktar", text: "Ekle'ye tıklayın. Orijinal sıra korunur." },
    ],
    bn: [
      { name: "JSON ডেটা পেস্ট করুন", text: "নতুন ক্ষেত্র যোগ করতে JSON পেস্ট করুন।" },
      { name: "রেফারেন্স অবস্থান সেট করুন", text: "রেফারেন্স নোড এবং নতুন নোড নাম দিন।" },
      { name: "সন্নিবেশ ও রপ্তানি করুন", text: "সন্নিবেশ ক্লিক করুন।" },
    ],
    id: [
      { name: "Tempel data JSON", text: "Tempel data JSON untuk menyisipkan field baru." },
      { name: "Atur posisi referensi", text: "Masukkan node referensi dan nama node baru." },
      { name: "Sisipkan dan ekspor", text: "Klik Sisipkan." },
    ],
    it: [
      { name: "Incolla dati JSON", text: "Incolla dati JSON per inserire nuovi campi." },
      { name: "Imposta posizione di riferimento", text: "Inserisci nodo di riferimento e nomi dei nuovi nodi." },
      { name: "Inserisci ed esporta", text: "Clicca Inserisci." },
    ],
  },
  "json-sort-classify": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array data for sorting or classification." },
      { name: "Configure sort or group", text: "For sorting, specify field name and method. For grouping, specify main key and sub key fields." },
      { name: "Process and export", text: "Click Sort or Classify. Export the result as structured hierarchical data." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要排序或分类的 JSON 数组数据。" },
      { name: "配置排序或分组", text: "排序需指定字段名和方式；分组需指定主键和子键字段。" },
      { name: "处理并导出", text: "点击排序或分类。导出结构化的分层数据结果。" },
    ],
      ja: [
      { name: "JSON 配列を貼り付け", text: "ソートまたは分類する JSON 配列データをペースト。" },
      { name: "ソートまたはグループを設定", text: "ソートはフィールド名と方法を指定。グループ化は主キーと副キーフィールドを指定。" },
      { name: "処理してエクスポート", text: "「ソート」または「分類」をクリック。結果を階層構造データとしてエクスポート。" },
    ],
    ko: [
      { name: "JSON 배열 붙여넣기", text: "정렬 또는 분류할 JSON 배열 데이터를 붙여넣습니다." },
      { name: "정렬 또는 그룹 구성", text: "정렬은 필드 이름과 방법 지정. 그룹화는 주 키와 부 키 필드 지정." },
      { name: "처리 및 내보내기", text: "정렬 또는 분류를 클릭. 결과를 구조화된 계층 데이터로 내보냅니다." },
    ],
    fr: [
      { name: "Coller le tableau JSON", text: "Collez les données du tableau JSON pour tri ou classification." },
      { name: "Configurer le tri ou groupement", text: "Pour le tri, spécifiez nom de champ et méthode. Pour le groupement, clé principale et sous-clé." },
      { name: "Traiter et exporter", text: "Cliquez sur Trier ou Classifier. Exportez le résultat sous forme de données hiérarchiques structurées." },
    ],
    de: [
      { name: "JSON-Array einfügen", text: "Fügen Sie die JSON-Array-Daten für Sortierung oder Klassifikation ein." },
      { name: "Sortierung oder Gruppierung konfigurieren", text: "Feldname/Methode für Sortierung, Hauptschlüssel/Unterschlüssel für Gruppierung." },
      { name: "Verarbeiten und exportieren", text: "Klicken Sie auf Sortieren/Klassifizieren. Export als strukturierte hierarchische Daten." },
    ],
    es: [
      { name: "Pegar array JSON", text: "Pegue los datos del array JSON para ordenación o clasificación." },
      { name: "Configurar ordenación o agrupación", text: "Para ordenar, especifique nombre de campo y método. Para agrupar, clave principal y subclave." },
      { name: "Procesar y exportar", text: "Haga clic en Ordenar o Clasificar. Exporte como datos jerárquicos estructurados." },
    ],
    pt: [
      { name: "Colar array JSON", text: "Cole os dados do array JSON para ordenação ou classificação." },
      { name: "Configurar ordenação ou agrupamento", text: "Para ordenar, especifique nome do campo e método. Para agrupar, chave principal e subchave." },
      { name: "Processar e exportar", text: "Clique em Ordenar ou Classificar. Exporte como dados hierárquicos estruturados." },
    ],
      ru: [
      { name: "Вставить JSON-массив", text: "Вставьте данные JSON-массива для сортировки или классификации." },
      { name: "Настроить сортировку/группировку", text: "Для сортировки — имя поля и метод. Для группировки — главный и подключ." },
      { name: "Обработать и экспортировать", text: "Нажмите Сортировать или Классифицировать. Экспорт структурированных данных." },
    ],
    ar: [
      { name: "لصق مصفوفة JSON", text: "الصق بيانات مصفوفة JSON للفرز أو التصنيف." },
      { name: "ضبط الفرز أو التجميع", text: "للفرز: اسم الحقل والطريقة. للتجميع: المفتاح الرئيسي والفرعي." },
      { name: "معالجة وتصدير", text: "انقر فرز أو تصنيف. صدّر كبيانات هرمية." },
    ],
    hi: [
      { name: "JSON ऐरे पेस्ट करें", text: "सॉर्ट या वर्गीकरण के लिए JSON ऐरे डेटा पेस्ट करें।" },
      { name: "सॉर्ट या ग्रुप कॉन्फ़िगर करें", text: "सॉर्ट के लिए फ़ील्ड नाम और विधि। ग्रुपिंग के लिए मुख्य और उप-कुंजी।" },
      { name: "प्रक्रिया करें और निर्यात करें", text: "सॉर्ट या वर्गीकरण पर क्लिक करें।" },
    ],
    vi: [
      { name: "Dán mảng JSON", text: "Dán dữ liệu mảng JSON để sắp xếp hoặc phân loại." },
      { name: "Cấu hình sắp xếp hoặc nhóm", text: "Cho sắp xếp: tên trường và phương pháp. Cho nhóm: khóa chính và phụ." },
      { name: "Xử lý và xuất", text: "Nhấp Sắp xếp hoặc Phân loại." },
    ],
    th: [
      { name: "วางอาร์เรย์ JSON", text: "วางข้อมูลอาร์เรย์ JSON สำหรับจัดเรียงหรือจำแนก" },
      { name: "กำหนดการจัดเรียงหรือกลุ่ม", text: "สำหรับจัดเรียง: ชื่อฟิลด์และวิธีการ สำหรับกลุ่ม: คีย์หลักและรอง" },
      { name: "ประมวลผลและส่งออก", text: "คลิกจัดเรียงหรือจำแนก" },
    ],
    tr: [
      { name: "JSON dizisini yapıştır", text: "Sıralama veya sınıflandırma için JSON dizi verisini yapıştırın." },
      { name: "Sıralama veya gruplamayı yapılandır", text: "Sıralama: alan adı ve yöntem. Gruplama: ana ve alt anahtar." },
      { name: "İşle ve dışa aktar", text: "Sırala veya Sınıflandır'a tıklayın." },
    ],
    bn: [
      { name: "JSON অ্যারে পেস্ট করুন", text: "সাজানো বা শ্রেণীকরণের জন্য অ্যারে পেস্ট করুন।" },
      { name: "সাজানো বা গ্রুপিং কনফিগার করুন", text: "সাজানো: ফিল্ড ও পদ্ধতি। গ্রুপিং: প্রধান ও উপ-কী।" },
      { name: "প্রক্রিয়া ও রপ্তানি করুন", text: "সাজান বা শ্রেণীবিভাগ ক্লিক করুন।" },
    ],
    id: [
      { name: "Tempel array JSON", text: "Tempel data array JSON untuk pengurutan atau klasifikasi." },
      { name: "Konfigurasi urutan atau grup", text: "Untuk urutan: nama field dan metode. Untuk grup: kunci utama dan sub." },
      { name: "Proses dan ekspor", text: "Klik Urutkan atau Klasifikasikan." },
    ],
    it: [
      { name: "Incolla array JSON", text: "Incolla dati array JSON per ordinamento o classificazione." },
      { name: "Configura ordinamento o raggruppamento", text: "Per ordinare: nome campo e metodo. Per raggruppare: chiave principale e sottochiave." },
      { name: "Elabora ed esporta", text: "Clicca Ordina o Classifica." },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
      ja: [
      { name: "ソースと対象 JSON を入力", text: "ソース JSON（コピー元）と対象 JSON（更新対象）をペースト。" },
      { name: "マッチと更新フィールドを設定", text: "行マッチング用の ID フィールドと更新対象フィールドを指定。" },
      { name: "マッチしてエクスポート", text: "「更新」をクリック。ツールがレコードをマッチしてバッチ更新、未マッチ項目も通知。" },
    ],
    ko: [
      { name: "소스 및 대상 JSON 입력", text: "소스 JSON(복사할 데이터)과 대상 JSON(업데이트할 데이터)을 붙여넣습니다." },
      { name: "매치 및 업데이트 필드 설정", text: "행 매칭용 ID 필드와 업데이트할 필드를 지정합니다." },
      { name: "매치 및 내보내기", text: "업데이트를 클릭. 도구가 레코드를 매칭하고 값을 일괄 업데이트하며 미매칭 항목을 플래그합니다." },
    ],
    fr: [
      { name: "Saisir JSON source et cible", text: "Collez le JSON source (données à copier) et le JSON cible (données à mettre à jour)." },
      { name: "Définir les champs de correspondance et mise à jour", text: "Spécifiez le champ ID pour la correspondance et les champs à mettre à jour." },
      { name: "Faire correspondre et exporter", text: "Cliquez sur Mettre à jour. L'outil effectue la correspondance et signale les éléments non appariés." },
    ],
    de: [
      { name: "Quell- und Ziel-JSON eingeben", text: "Fügen Sie Quell-JSON (Datenquelle) und Ziel-JSON (Aktualisierungsziel) ein." },
      { name: "Match- und Update-Felder setzen", text: "ID-Feld für Zeilenmatching und zu aktualisierende Felder angeben." },
      { name: "Matchen und exportieren", text: "Klicken Sie auf Aktualisieren. Tool matcht Datensätze und flaggt nicht gefundene Elemente." },
    ],
    es: [
      { name: "Introducir JSON fuente y destino", text: "Pegue el JSON fuente (datos a copiar) y el JSON destino (datos a actualizar)." },
      { name: "Configurar campos de coincidencia y actualización", text: "Especifique el campo ID para emparejar filas y los campos a actualizar." },
      { name: "Coincidir y exportar", text: "Haga clic en Actualizar. La herramienta empareja registros y marca elementos sin coincidencia." },
    ],
    pt: [
      { name: "Inserir JSON fonte e destino", text: "Cole o JSON fonte (dados a copiar) e o JSON destino (dados a atualizar)." },
      { name: "Configurar campos de correspondência e atualização", text: "Especifique o campo ID para correspondência e os campos a atualizar." },
      { name: "Corresponder e exportar", text: "Clique em Atualizar. A ferramenta corresponde registros e sinaliza itens sem correspondência." },
    ],
      ru: [
      { name: "Ввести исходный и целевой JSON", text: "Вставьте исходный JSON (данные-источник) и целевой JSON (для обновления)." },
      { name: "Задать поля матча и обновления", text: "Укажите ID-поле для сопоставления и поля для обновления." },
      { name: "Сопоставить и экспортировать", text: "Нажмите Обновить. Инструмент сопоставит записи и отметит несовпадения." },
    ],
    ar: [
      { name: "أدخل JSON المصدر والهدف", text: "الصق JSON المصدر (بيانات للنسخ) والهدف (للتحديث)." },
      { name: "ضبط حقول المطابقة والتحديث", text: "حدد حقل ID للمطابقة والحقول للتحديث." },
      { name: "مطابقة وتصدير", text: "انقر تحديث. تطابق الأداة السجلات وتعلّم غير المتطابقة." },
    ],
    hi: [
      { name: "स्रोत और लक्ष्य JSON दर्ज करें", text: "स्रोत JSON (कॉपी डेटा) और लक्ष्य JSON (अपडेट डेटा) पेस्ट करें।" },
      { name: "मिलान और अपडेट फ़ील्ड सेट करें", text: "पंक्ति मिलान के लिए ID फ़ील्ड और अपडेट फ़ील्ड निर्दिष्ट करें।" },
      { name: "मिलान करें और निर्यात करें", text: "अपडेट पर क्लिक करें।" },
    ],
    vi: [
      { name: "Nhập JSON nguồn và đích", text: "Dán JSON nguồn (dữ liệu sao chép) và JSON đích (dữ liệu cập nhật)." },
      { name: "Đặt trường khớp và cập nhật", text: "Chỉ định trường ID để khớp và trường cập nhật." },
      { name: "Khớp và xuất", text: "Nhấp Cập nhật." },
    ],
    th: [
      { name: "ป้อน JSON ต้นทางและปลายทาง", text: "วาง JSON ต้นทาง (ข้อมูลคัดลอก) และ JSON ปลายทาง (ข้อมูลอัปเดต)" },
      { name: "ตั้งค่าฟิลด์จับคู่และอัปเดต", text: "ระบุฟิลด์ ID สำหรับจับคู่และฟิลด์อัปเดต" },
      { name: "จับคู่และส่งออก", text: "คลิกอัปเดต" },
    ],
    tr: [
      { name: "Kaynak ve hedef JSON gir", text: "Kaynak JSON (kopyalanacak veri) ve hedef JSON (güncellenecek) yapıştırın." },
      { name: "Eşleme ve güncelleme alanlarını ayarla", text: "ID alanı ve güncellenecek alanları belirleyin." },
      { name: "Eşleştir ve dışa aktar", text: "Güncelle'ye tıklayın." },
    ],
    bn: [
      { name: "উৎস ও লক্ষ্য JSON ইনপুট করুন", text: "উৎস ও লক্ষ্য JSON পেস্ট করুন।" },
      { name: "মিল ও আপডেট ক্ষেত্র সেট করুন", text: "ID ফিল্ড এবং আপডেট ক্ষেত্র নির্দিষ্ট করুন।" },
      { name: "মিল ও রপ্তানি করুন", text: "আপডেট ক্লিক করুন।" },
    ],
    id: [
      { name: "Masukkan JSON sumber dan target", text: "Tempel JSON sumber dan target." },
      { name: "Atur field pencocokan dan pembaruan", text: "Tentukan field ID dan field pembaruan." },
      { name: "Cocokkan dan ekspor", text: "Klik Perbarui." },
    ],
    it: [
      { name: "Inserisci JSON sorgente e destinazione", text: "Incolla JSON sorgente (dati da copiare) e destinazione (da aggiornare)." },
      { name: "Imposta campi di corrispondenza e aggiornamento", text: "Specifica campo ID e campi da aggiornare." },
      { name: "Abbina ed esporta", text: "Clicca Aggiorna." },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
      ja: [
      { name: "ブックマークデータを貼り付け", text: "ブラウザからエクスポートしたブックマーク HTML または Flare JSON データを入力エリアにペースト。" },
      { name: "変換方向を選択", text: "対象形式を選択：Flare App モード、Flare Bookmark モード、または標準ブラウザ形式。" },
      { name: "変換して保存", text: "「変換」をクリック。結果をコピーまたはダウンロードして対象アプリケーションにインポート。" },
    ],
    ko: [
      { name: "북마크 데이터 붙여넣기", text: "브라우저에서 내보낸 북마크 HTML 또는 Flare JSON 데이터를 입력 영역에 붙여넣습니다." },
      { name: "변환 방향 선택", text: "대상 형식 선택: Flare App 모드, Flare Bookmark 모드 또는 표준 브라우저 형식." },
      { name: "변환 및 저장", text: "변환을 클릭. 결과를 복사하거나 대상 애플리케이션으로 가져올 수 있도록 다운로드합니다." },
    ],
    fr: [
      { name: "Coller les données de favoris", text: "Collez le HTML des favoris exportés du navigateur ou les données JSON Flare dans la zone de saisie." },
      { name: "Choisir la direction de conversion", text: "Sélectionnez le format cible : mode Flare App, mode Flare Bookmark ou format navigateur standard." },
      { name: "Convertir et sauvegarder", text: "Cliquez sur Convertir. Copiez le résultat ou téléchargez pour importer dans l'application cible." },
    ],
    de: [
      { name: "Lesezeichen-Daten einfügen", text: "Fügen Sie Browser-Lesezeichen-HTML oder Flare-JSON in den Eingabebereich ein." },
      { name: "Konvertierungsrichtung wählen", text: "Zielformat wählen: Flare App-Modus, Flare Bookmark-Modus oder Standard-Browser." },
      { name: "Konvertieren und speichern", text: "Klicken Sie auf Konvertieren. Ergebnis kopieren oder für Import herunterladen." },
    ],
    es: [
      { name: "Pegar datos de marcadores", text: "Pegue el HTML de marcadores exportados del navegador o datos JSON de Flare." },
      { name: "Elegir dirección de conversión", text: "Seleccione formato objetivo: modo Flare App, modo Flare Bookmark o formato estándar." },
      { name: "Convertir y guardar", text: "Haga clic en Convertir. Copie el resultado o descargue para importar en la aplicación." },
    ],
    pt: [
      { name: "Colar dados de favoritos", text: "Cole o HTML de favoritos exportados do navegador ou dados JSON do Flare." },
      { name: "Escolher direção de conversão", text: "Selecione formato alvo: modo Flare App, modo Flare Bookmark ou formato padrão." },
      { name: "Converter e salvar", text: "Clique em Converter. Copie o resultado ou baixe para importar na aplicação." },
    ],
      ru: [
      { name: "Вставить данные закладок", text: "Вставьте HTML экспортированных закладок браузера или JSON-данные Flare." },
      { name: "Выбрать направление конвертации", text: "Выберите целевой формат: Flare App, Flare Bookmark или стандарт браузера." },
      { name: "Конвертировать и сохранить", text: "Нажмите Конвертировать. Скопируйте или скачайте результат." },
    ],
    ar: [
      { name: "لصق بيانات الإشارات", text: "الصق HTML للإشارات المصدّرة أو بيانات JSON لـ Flare." },
      { name: "اختر اتجاه التحويل", text: "اختر الصيغة: وضع Flare App، Flare Bookmark أو متصفح قياسي." },
      { name: "تحويل وحفظ", text: "انقر تحويل. انسخ النتيجة أو حمّلها للاستيراد." },
    ],
    hi: [
      { name: "बुकमार्क डेटा पेस्ट करें", text: "ब्राउज़र-निर्यात बुकमार्क HTML या Flare JSON डेटा पेस्ट करें।" },
      { name: "रूपांतरण दिशा चुनें", text: "लक्ष्य प्रारूप चुनें: Flare App, Flare Bookmark या मानक ब्राउज़र।" },
      { name: "रूपांतरित करें और सहेजें", text: "रूपांतरित पर क्लिक करें।" },
    ],
    vi: [
      { name: "Dán dữ liệu bookmark", text: "Dán HTML bookmark xuất từ trình duyệt hoặc dữ liệu JSON Flare." },
      { name: "Chọn hướng chuyển đổi", text: "Chọn định dạng mục tiêu: Flare App, Flare Bookmark hoặc trình duyệt chuẩn." },
      { name: "Chuyển đổi và lưu", text: "Nhấp Chuyển đổi." },
    ],
    th: [
      { name: "วางข้อมูลบุ๊กมาร์ก", text: "วาง HTML บุ๊กมาร์กที่ส่งออกจากเบราว์เซอร์หรือข้อมูล JSON Flare" },
      { name: "เลือกทิศทางการแปลง", text: "เลือกรูปแบบเป้าหมาย: โหมด Flare App, Flare Bookmark หรือเบราว์เซอร์มาตรฐาน" },
      { name: "แปลงและบันทึก", text: "คลิกแปลง" },
    ],
    tr: [
      { name: "Yer imi verisini yapıştır", text: "Tarayıcıdan dışa aktarılan yer imi HTML veya Flare JSON verisini yapıştırın." },
      { name: "Dönüşüm yönünü seç", text: "Hedef formatı seçin: Flare App, Flare Bookmark veya standart tarayıcı." },
      { name: "Dönüştür ve kaydet", text: "Dönüştür'e tıklayın." },
    ],
    bn: [
      { name: "বুকমার্ক ডেটা পেস্ট করুন", text: "ব্রাউজার বুকমার্ক HTML বা Flare JSON পেস্ট করুন।" },
      { name: "রূপান্তর দিক নির্বাচন করুন", text: "Flare App, Bookmark বা স্ট্যান্ডার্ড ব্রাউজার নির্বাচন করুন।" },
      { name: "রূপান্তর ও সংরক্ষণ করুন", text: "রূপান্তর ক্লিক করুন।" },
    ],
    id: [
      { name: "Tempel data bookmark", text: "Tempel HTML bookmark yang diekspor atau data JSON Flare." },
      { name: "Pilih arah konversi", text: "Pilih format target: Flare App, Flare Bookmark atau browser standar." },
      { name: "Konversi dan simpan", text: "Klik Konversi." },
    ],
    it: [
      { name: "Incolla dati segnalibri", text: "Incolla HTML segnalibri esportati dal browser o dati JSON Flare." },
      { name: "Scegli direzione conversione", text: "Seleziona formato: Flare App, Flare Bookmark o browser standard." },
      { name: "Converti e salva", text: "Clicca Converti." },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
      ja: [
      { name: "名前ペアを入力", text: "名前ペアを1行ずつ入力（例：'Illustration: 插图'）、コロンまたはタブで区切り。" },
      { name: "フィールドをカスタマイズ", text: "データスキーマに合わせて object と attribute のキー名を設定。" },
      { name: "JSON を生成", text: "「生成」をクリック。IMGPrompt 用の重複排除された標準 JSON データセットが出力されます。" },
    ],
    ko: [
      { name: "이름 쌍 입력", text: "한 줄에 한 쌍씩 이름을 입력(예: 'Illustration: 插图'), 콜론 또는 탭으로 구분." },
      { name: "필드 사용자 정의", text: "데이터 스키마에 맞게 object 및 attribute 키 이름을 설정합니다." },
      { name: "JSON 생성", text: "생성을 클릭. 도구가 IMGPrompt용 중복 제거된 표준 JSON 데이터셋을 출력합니다." },
    ],
    fr: [
      { name: "Saisir les paires de noms", text: "Saisissez une paire de noms par ligne (ex : 'Illustration: 插图'), séparées par deux-points ou tabulation." },
      { name: "Personnaliser les champs", text: "Définissez les noms de clés object et attribute selon votre schéma de données." },
      { name: "Générer JSON", text: "Cliquez sur Générer. L'outil produit un jeu de données JSON standard dédupliqué prêt pour IMGPrompt." },
    ],
    de: [
      { name: "Namenspaare eingeben", text: "Ein Paar pro Zeile eingeben (z.B. 'Illustration: 插图'), getrennt durch Doppelpunkt oder Tab." },
      { name: "Felder anpassen", text: "object- und attribute-Schlüsselnamen an Ihr Datenschema anpassen." },
      { name: "JSON generieren", text: "Klicken Sie auf Generieren. Deduplizierter Standard-JSON-Datensatz für IMGPrompt." },
    ],
    es: [
      { name: "Introducir pares de nombres", text: "Introduzca un par por línea (ej: 'Illustration: 插图'), separados por dos puntos o tabulación." },
      { name: "Personalizar campos", text: "Configure nombres de claves de objeto y atributo según su esquema de datos." },
      { name: "Generar JSON", text: "Haga clic en Generar. Conjunto JSON estándar deduplicado listo para IMGPrompt." },
    ],
    pt: [
      { name: "Inserir pares de nomes", text: "Insira um par por linha (ex: 'Illustration: 插图'), separados por dois pontos ou tabulação." },
      { name: "Personalizar campos", text: "Configure nomes de chaves de objeto e atributo conforme seu esquema de dados." },
      { name: "Gerar JSON", text: "Clique em Gerar. Conjunto JSON padrão deduplicado pronto para IMGPrompt." },
    ],
      ru: [
      { name: "Ввести пары имён", text: "По одной паре на строку (напр. 'Illustration: 插图'), разделитель двоеточие или таб." },
      { name: "Настроить поля", text: "Задайте имена ключей object и attribute под вашу схему." },
      { name: "Сгенерировать JSON", text: "Нажмите Сгенерировать. Получите уникальный JSON-датасет для IMGPrompt." },
    ],
    ar: [
      { name: "أدخل أزواج الأسماء", text: "زوج واحد لكل سطر (مثل 'Illustration: 插图')، مفصول بنقطتين أو tab." },
      { name: "تخصيص الحقول", text: "عيّن أسماء مفاتيح object و attribute لمخططك." },
      { name: "توليد JSON", text: "انقر توليد. احصل على مجموعة JSON معيارية بدون تكرار." },
    ],
    hi: [
      { name: "नाम जोड़े दर्ज करें", text: "प्रति पंक्ति एक जोड़ी, कोलन या टैब से अलग।" },
      { name: "फ़ील्ड कस्टमाइज़ करें", text: "object और attribute की नाम सेट करें।" },
      { name: "JSON उत्पन्न करें", text: "उत्पन्न पर क्लिक करें।" },
    ],
    vi: [
      { name: "Nhập cặp tên", text: "Một cặp mỗi dòng, phân tách bằng dấu hai chấm hoặc tab." },
      { name: "Tùy chỉnh trường", text: "Đặt tên khóa object và attribute." },
      { name: "Tạo JSON", text: "Nhấp Tạo." },
    ],
    th: [
      { name: "ป้อนคู่ชื่อ", text: "หนึ่งคู่ต่อบรรทัด คั่นด้วยจุดคู่หรือแท็บ" },
      { name: "ปรับแต่งฟิลด์", text: "ตั้งชื่อคีย์ object และ attribute" },
      { name: "สร้าง JSON", text: "คลิกสร้าง" },
    ],
    tr: [
      { name: "Ad çiftlerini gir", text: "Satır başına bir çift, iki nokta veya tab ile ayırarak." },
      { name: "Alanları özelleştir", text: "object ve attribute anahtar adlarını belirleyin." },
      { name: "JSON oluştur", text: "Oluştur'a tıklayın." },
    ],
    bn: [
      { name: "নাম জোড়া ইনপুট করুন", text: "প্রতি লাইনে একটি জোড়া, কোলন বা ট্যাব দিয়ে পৃথক।" },
      { name: "ক্ষেত্র কাস্টমাইজ করুন", text: "object এবং attribute কী নাম সেট করুন।" },
      { name: "JSON তৈরি করুন", text: "তৈরি ক্লিক করুন।" },
    ],
    id: [
      { name: "Masukkan pasangan nama", text: "Satu pasangan per baris, dipisahkan titik dua atau tab." },
      { name: "Sesuaikan field", text: "Atur nama kunci object dan attribute." },
      { name: "Hasilkan JSON", text: "Klik Hasilkan." },
    ],
    it: [
      { name: "Inserisci coppie di nomi", text: "Una coppia per riga, separate da due punti o tab." },
      { name: "Personalizza campi", text: "Imposta nomi chiavi object e attribute." },
      { name: "Genera JSON", text: "Clicca Genera." },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "导入网文或小说文本", text: "支持粘贴文本或上传 TXT 文件（无大小限制，可处理 300 万字以上超长小说）。适用于笔趣阁等网站下载的 TXT、浏览器网页复制的文本、Word 导出 TXT、同人文/自写作品等各种场景。" },
      { name: "配置修复规则组合", text: "勾选需要的规则：智能换行（修复段落被误切）、章节分割（每章前加空行）、段首缩进（两字符）、去重复行（删广告）、繁简转换、垃圾内容过滤。规则可叠加，也可单独启用。" },
      { name: "导出适配阅读器的 TXT", text: "导出后可直接通过推送邮箱发送到 Kindle，或本地导入微信读书、掌阅、静读天下。启用章节分割后 Kindle 可自动生成目录。微信读书建议先用 Calibre 转 EPUB 以获得最佳目录体验。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "JSON を貼り付けまたはアップロード", text: "入力エリアをクリックして JSON をペーストするか、.json ファイルをドラッグ＆ドロップでアップロード。" },
      { name: "対象言語を選択", text: "ドロップダウンから1つまたは複数の対象言語を選択。多言語モードで一括翻訳も可能。" },
      { name: "翻訳してエクスポート", text: "「翻訳」をクリック。完了後、翻訳された JSON ファイルをダウンロードまたは結果をコピー。" },
    ],
    ko: [
      { name: "JSON 붙여넣기 또는 업로드", text: "입력 영역을 클릭하여 JSON을 붙여넣거나 .json 파일을 드래그 앤 드롭으로 업로드합니다." },
      { name: "대상 언어 선택", text: "드롭다운에서 하나 이상의 대상 언어를 선택합니다. 다국어 모드로 일괄 번역 가능." },
      { name: "번역 및 내보내기", text: "번역 버튼을 클릭. 완료되면 번역된 JSON 파일을 다운로드하거나 결과를 복사합니다." },
    ],
    fr: [
      { name: "Coller ou importer le JSON", text: "Cliquez sur la zone de saisie et collez votre JSON, ou importez un fichier .json par glisser-déposer." },
      { name: "Sélectionner les langues cibles", text: "Choisissez une ou plusieurs langues cibles. Activez le mode multilingue pour une traduction groupée." },
      { name: "Traduire et exporter", text: "Cliquez sur Traduire. Téléchargez les fichiers JSON traduits ou copiez les résultats." },
    ],
    de: [
      { name: "JSON einfügen oder hochladen", text: "Klicken Sie in den Eingabebereich und fügen Sie JSON ein oder laden Sie eine .json-Datei per Drag-and-Drop hoch." },
      { name: "Zielsprache(n) wählen", text: "Wählen Sie eine oder mehrere Zielsprachen. Aktivieren Sie den Mehrsprachenmodus für Stapelübersetzung." },
      { name: "Übersetzen und exportieren", text: "Klicken Sie auf Übersetzen. Laden Sie die übersetzten JSON-Dateien herunter oder kopieren Sie Ergebnisse." },
    ],
    es: [
      { name: "Pegar o subir JSON", text: "Haga clic en el área de entrada y pegue su JSON, o suba un archivo .json arrastrando y soltando." },
      { name: "Seleccionar idiomas de destino", text: "Elija uno o más idiomas. Active el modo multilingüe para traducción por lotes." },
      { name: "Traducir y exportar", text: "Haga clic en Traducir. Descargue los archivos JSON traducidos o copie los resultados." },
    ],
    pt: [
      { name: "Colar ou carregar JSON", text: "Clique na área de entrada e cole seu JSON ou carregue um arquivo .json arrastando e soltando." },
      { name: "Selecionar idiomas de destino", text: "Escolha um ou mais idiomas. Ative o modo multilíngue para tradução em lote." },
      { name: "Traduzir e exportar", text: "Clique em Traduzir. Baixe os arquivos JSON traduzidos ou copie os resultados." },
    ],
  },
  "subtitle-translator": {
    en: [
      { name: "Upload subtitle file", text: "Upload your SRT, ASS, VTT, or LRC subtitle file. The tool auto-detects the format." },
      { name: "Configure output mode", text: "Choose translated-only, bilingual, or both. For bilingual, select whether translation appears above or below." },
      { name: "Translate and download", text: "Select target language and click Translate. Download the translated subtitle file with timecodes preserved." },
    ],
    zh: [
      { name: "上传字幕文件", text: "上传 SRT、ASS、VTT 或 LRC 格式的字幕文件，工具自动识别格式。" },
      { name: "配置输出模式", text: "选择仅译文、双语或两者都要。双语模式可选择译文在原文上方或下方。" },
      { name: "翻译并下载", text: "选择目标语言并点击翻译。下载翻译后的字幕文件，时间轴完整保留。" },
    ],
  },
  "md-translator": {
    en: [
      { name: "Upload Markdown", text: "Upload one or more .md files, or paste Markdown content into the input area." },
      { name: "Configure options", text: "Choose whether to translate Front Matter, code blocks, and LaTeX formulas based on your needs." },
      { name: "Translate and export", text: "Select target language and click Translate. Download translated .md files with formatting preserved." },
    ],
    zh: [
      { name: "上传 Markdown 文件", text: "上传一个或多个 .md 文件，或将 Markdown 内容粘贴到输入区。" },
      { name: "配置选项", text: "根据需要选择是否翻译 Front Matter、代码块和 LaTeX 公式。" },
      { name: "翻译并导出", text: "选择目标语言并点击翻译。下载翻译后的 .md 文件，格式完整保留。" },
    ],
  },
  "text-splitter": {
    en: [
      { name: "Input your text", text: "Paste long text into the input area or upload a text file (UTF-8 or auto-detected encoding)." },
      { name: "Choose split method", text: "Select splitting by character count, Chinese/English paragraphs, or custom delimiter." },
      { name: "Split and export", text: "Click Split. Export all segments as one merged file or batch-download as separate files." },
    ],
    zh: [
      { name: "输入文本", text: "将长文本粘贴到输入区，或上传文本文件（UTF-8 或自动识别编码）。" },
      { name: "选择分割方式", text: "选择按字符数、中英文段落或自定义分隔符分割。" },
      { name: "分割并导出", text: "点击分割。可导出为合并文件或批量下载为独立文件。" },
    ],
  },
  "json-value-extractor": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content you want to extract values from into the input area." },
      { name: "Add extraction rules", text: "Enter field names (supports nested keys like 'user.name' via dot notation). Add custom prefix/suffix for formatted output." },
      { name: "Extract and copy", text: "Click Extract. The tool returns deduplicated values — copy or export as needed." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要提取值的 JSON 内容粘贴到输入区。" },
      { name: "添加提取规则", text: "输入字段名（支持嵌套键如 'user.name' 的点路径）。可添加自定义前后缀用于格式化输出。" },
      { name: "提取并复制", text: "点击提取。工具返回去重后的值，按需复制或导出。" },
    ],
  },
  "json-node-edit": {
    en: [
      { name: "Paste JSON", text: "Paste the JSON to edit into the input area." },
      { name: "Specify target nodes", text: "Enter node names (comma-separated) or JSONPath to target. Supports nested keys like 'zh.title'." },
      { name: "Choose operation and apply", text: "Select add prefix/suffix, find-replace, or full value replacement. Preview changes and apply." },
    ],
    zh: [
      { name: "粘贴 JSON", text: "将需要编辑的 JSON 粘贴到输入区。" },
      { name: "指定目标节点", text: "输入节点名称（逗号分隔）或 JSONPath。支持嵌套键如 'zh.title'。" },
      { name: "选择操作并应用", text: "选择添加前后缀、查找替换或整值覆盖。预览变更后应用。" },
    ],
  },
  "json-value-transformer": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content for transformation." },
      { name: "Configure mapping rules", text: "Define key-value mapping rules or choose a preset template. Targets field names with recursive search (nested keys via dot notation)." },
      { name: "Transform and export", text: "Click Transform. Export the transformed JSON with original structure preserved." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要转换的 JSON 内容粘贴进来。" },
      { name: "配置映射规则", text: "定义键值映射规则或选择预设模板。通过字段名递归匹配定位（支持嵌套键的点路径）。" },
      { name: "转换并导出", text: "点击转换。导出转换后的 JSON，原始结构完整保留。" },
    ],
  },
  "json-value-swapper": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array containing items whose values need swapping." },
      { name: "Specify fields to swap", text: "Enter the two field names whose values should be exchanged across all array items." },
      { name: "Swap and export", text: "Click Swap. Review missing-field alerts and export the corrected JSON." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要交换字段值的 JSON 数组。" },
      { name: "指定要交换的字段", text: "输入要互换值的两个字段名，工具会处理数组中所有项。" },
      { name: "交换并导出", text: "点击交换。查看缺失字段提示并导出修正后的 JSON。" },
    ],
  },
  "json-node-inserter": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON data where new fields should be inserted." },
      { name: "Set reference position", text: "Enter the reference node name (new fields will be inserted after it) and the names of new nodes to add." },
      { name: "Insert and export", text: "Click Insert. The tool adds new fields to every object while preserving original order and structure." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "粘贴需要插入新字段的 JSON 数据。" },
      { name: "设置参考位置", text: "输入参考节点名称（新字段将插入其后）和要添加的新节点名称。" },
      { name: "插入并导出", text: "点击插入。工具为每个对象添加新字段，保持原有顺序和结构。" },
    ],
  },
  "json-sort-classify": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array data for sorting or classification." },
      { name: "Configure sort or group", text: "For sorting, specify field name and method. For grouping, specify main key and sub key fields." },
      { name: "Process and export", text: "Click Sort or Classify. Export the result as structured hierarchical data." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要排序或分类的 JSON 数组数据。" },
      { name: "配置排序或分组", text: "排序需指定字段名和方式；分组需指定主键和子键字段。" },
      { name: "处理并导出", text: "点击排序或分类。导出结构化的分层数据结果。" },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "字幕ファイルをアップロード", text: "SRT、ASS、VTT、LRC 字幕ファイルをアップロード。形式は自動検出されます。" },
      { name: "出力モードを設定", text: "訳文のみ、バイリンガル、または両方を選択。バイリンガルでは訳文の位置も選択可能。" },
      { name: "翻訳してダウンロード", text: "対象言語を選択して「翻訳」をクリック。タイムコードを保持したまま翻訳字幕をダウンロード。" },
    ],
    ko: [
      { name: "자막 파일 업로드", text: "SRT, ASS, VTT 또는 LRC 자막 파일을 업로드합니다. 도구가 형식을 자동 감지합니다." },
      { name: "출력 모드 구성", text: "번역만, 이중 언어 또는 둘 다 선택. 이중 언어의 경우 번역 위치 선택 가능." },
      { name: "번역 및 다운로드", text: "대상 언어를 선택하고 번역을 클릭. 타임코드가 보존된 번역 자막 파일을 다운로드." },
    ],
    fr: [
      { name: "Importer le fichier de sous-titres", text: "Importez votre fichier SRT, ASS, VTT ou LRC. Le format est détecté automatiquement." },
      { name: "Configurer le mode de sortie", text: "Choisissez traduction seule, bilingue ou les deux. En bilingue, la position de la traduction est configurable." },
      { name: "Traduire et télécharger", text: "Sélectionnez la langue cible et cliquez sur Traduire. Téléchargez le fichier traduit avec timecodes préservés." },
    ],
    de: [
      { name: "Untertiteldatei hochladen", text: "Laden Sie Ihre SRT-, ASS-, VTT- oder LRC-Datei hoch. Das Format wird automatisch erkannt." },
      { name: "Ausgabemodus konfigurieren", text: "Wählen Sie nur übersetzt, zweisprachig oder beides. Bei zweisprachig auch Position wählbar." },
      { name: "Übersetzen und herunterladen", text: "Zielsprache auswählen und auf Übersetzen klicken. Download mit erhaltenen Timecodes." },
    ],
    es: [
      { name: "Subir archivo de subtítulos", text: "Suba su archivo SRT, ASS, VTT o LRC. El formato se detecta automáticamente." },
      { name: "Configurar modo de salida", text: "Elija solo traducción, bilingüe o ambos. En bilingüe, seleccione posición de la traducción." },
      { name: "Traducir y descargar", text: "Seleccione idioma de destino y haga clic en Traducir. Descargue con códigos de tiempo preservados." },
    ],
    pt: [
      { name: "Carregar arquivo de legenda", text: "Carregue seu arquivo SRT, ASS, VTT ou LRC. O formato é detectado automaticamente." },
      { name: "Configurar modo de saída", text: "Escolha apenas tradução, bilíngue ou ambos. No bilíngue, selecione posição da tradução." },
      { name: "Traduzir e baixar", text: "Selecione idioma de destino e clique em Traduzir. Baixe com códigos de tempo preservados." },
    ],
  },
  "md-translator": {
    en: [
      { name: "Upload Markdown", text: "Upload one or more .md files, or paste Markdown content into the input area." },
      { name: "Configure options", text: "Choose whether to translate Front Matter, code blocks, and LaTeX formulas based on your needs." },
      { name: "Translate and export", text: "Select target language and click Translate. Download translated .md files with formatting preserved." },
    ],
    zh: [
      { name: "上传 Markdown 文件", text: "上传一个或多个 .md 文件，或将 Markdown 内容粘贴到输入区。" },
      { name: "配置选项", text: "根据需要选择是否翻译 Front Matter、代码块和 LaTeX 公式。" },
      { name: "翻译并导出", text: "选择目标语言并点击翻译。下载翻译后的 .md 文件，格式完整保留。" },
    ],
  },
  "text-splitter": {
    en: [
      { name: "Input your text", text: "Paste long text into the input area or upload a text file (UTF-8 or auto-detected encoding)." },
      { name: "Choose split method", text: "Select splitting by character count, Chinese/English paragraphs, or custom delimiter." },
      { name: "Split and export", text: "Click Split. Export all segments as one merged file or batch-download as separate files." },
    ],
    zh: [
      { name: "输入文本", text: "将长文本粘贴到输入区，或上传文本文件（UTF-8 或自动识别编码）。" },
      { name: "选择分割方式", text: "选择按字符数、中英文段落或自定义分隔符分割。" },
      { name: "分割并导出", text: "点击分割。可导出为合并文件或批量下载为独立文件。" },
    ],
  },
  "json-value-extractor": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content you want to extract values from into the input area." },
      { name: "Add extraction rules", text: "Enter field names (supports nested keys like 'user.name' via dot notation). Add custom prefix/suffix for formatted output." },
      { name: "Extract and copy", text: "Click Extract. The tool returns deduplicated values — copy or export as needed." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要提取值的 JSON 内容粘贴到输入区。" },
      { name: "添加提取规则", text: "输入字段名（支持嵌套键如 'user.name' 的点路径）。可添加自定义前后缀用于格式化输出。" },
      { name: "提取并复制", text: "点击提取。工具返回去重后的值，按需复制或导出。" },
    ],
  },
  "json-node-edit": {
    en: [
      { name: "Paste JSON", text: "Paste the JSON to edit into the input area." },
      { name: "Specify target nodes", text: "Enter node names (comma-separated) or JSONPath to target. Supports nested keys like 'zh.title'." },
      { name: "Choose operation and apply", text: "Select add prefix/suffix, find-replace, or full value replacement. Preview changes and apply." },
    ],
    zh: [
      { name: "粘贴 JSON", text: "将需要编辑的 JSON 粘贴到输入区。" },
      { name: "指定目标节点", text: "输入节点名称（逗号分隔）或 JSONPath。支持嵌套键如 'zh.title'。" },
      { name: "选择操作并应用", text: "选择添加前后缀、查找替换或整值覆盖。预览变更后应用。" },
    ],
  },
  "json-value-transformer": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content for transformation." },
      { name: "Configure mapping rules", text: "Define key-value mapping rules or choose a preset template. Targets field names with recursive search (nested keys via dot notation)." },
      { name: "Transform and export", text: "Click Transform. Export the transformed JSON with original structure preserved." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要转换的 JSON 内容粘贴进来。" },
      { name: "配置映射规则", text: "定义键值映射规则或选择预设模板。通过字段名递归匹配定位（支持嵌套键的点路径）。" },
      { name: "转换并导出", text: "点击转换。导出转换后的 JSON，原始结构完整保留。" },
    ],
  },
  "json-value-swapper": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array containing items whose values need swapping." },
      { name: "Specify fields to swap", text: "Enter the two field names whose values should be exchanged across all array items." },
      { name: "Swap and export", text: "Click Swap. Review missing-field alerts and export the corrected JSON." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要交换字段值的 JSON 数组。" },
      { name: "指定要交换的字段", text: "输入要互换值的两个字段名，工具会处理数组中所有项。" },
      { name: "交换并导出", text: "点击交换。查看缺失字段提示并导出修正后的 JSON。" },
    ],
  },
  "json-node-inserter": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON data where new fields should be inserted." },
      { name: "Set reference position", text: "Enter the reference node name (new fields will be inserted after it) and the names of new nodes to add." },
      { name: "Insert and export", text: "Click Insert. The tool adds new fields to every object while preserving original order and structure." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "粘贴需要插入新字段的 JSON 数据。" },
      { name: "设置参考位置", text: "输入参考节点名称（新字段将插入其后）和要添加的新节点名称。" },
      { name: "插入并导出", text: "点击插入。工具为每个对象添加新字段，保持原有顺序和结构。" },
    ],
  },
  "json-sort-classify": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array data for sorting or classification." },
      { name: "Configure sort or group", text: "For sorting, specify field name and method. For grouping, specify main key and sub key fields." },
      { name: "Process and export", text: "Click Sort or Classify. Export the result as structured hierarchical data." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要排序或分类的 JSON 数组数据。" },
      { name: "配置排序或分组", text: "排序需指定字段名和方式；分组需指定主键和子键字段。" },
      { name: "处理并导出", text: "点击排序或分类。导出结构化的分层数据结果。" },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "Markdown をアップロード", text: "1つまたは複数の .md ファイルをアップロード、または入力エリアに Markdown をペースト。" },
      { name: "オプションを設定", text: "Front Matter、コードブロック、LaTeX 数式を翻訳するかどうかを必要に応じて選択。" },
      { name: "翻訳してエクスポート", text: "対象言語を選択して「翻訳」をクリック。書式を保持した翻訳済み .md ファイルをダウンロード。" },
    ],
    ko: [
      { name: "Markdown 업로드", text: "하나 이상의 .md 파일을 업로드하거나 입력 영역에 Markdown 콘텐츠를 붙여넣습니다." },
      { name: "옵션 구성", text: "필요에 따라 Front Matter, 코드 블록 및 LaTeX 수식 번역 여부를 선택합니다." },
      { name: "번역 및 내보내기", text: "대상 언어를 선택하고 번역을 클릭. 서식이 보존된 번역된 .md 파일을 다운로드." },
    ],
    fr: [
      { name: "Importer le Markdown", text: "Importez un ou plusieurs fichiers .md, ou collez le contenu Markdown dans la zone de saisie." },
      { name: "Configurer les options", text: "Choisissez de traduire le Front Matter, les blocs de code et les formules LaTeX selon vos besoins." },
      { name: "Traduire et exporter", text: "Sélectionnez la langue cible et cliquez sur Traduire. Téléchargez les fichiers .md traduits avec formatage préservé." },
    ],
    de: [
      { name: "Markdown hochladen", text: "Laden Sie eine oder mehrere .md-Dateien hoch oder fügen Sie Markdown-Inhalte ein." },
      { name: "Optionen konfigurieren", text: "Wählen Sie, ob Front Matter, Codeblöcke und LaTeX-Formeln übersetzt werden sollen." },
      { name: "Übersetzen und exportieren", text: "Zielsprache wählen und auf Übersetzen klicken. Download mit erhaltener Formatierung." },
    ],
    es: [
      { name: "Subir Markdown", text: "Suba uno o más archivos .md, o pegue contenido Markdown en el área de entrada." },
      { name: "Configurar opciones", text: "Elija si traducir Front Matter, bloques de código y fórmulas LaTeX según sus necesidades." },
      { name: "Traducir y exportar", text: "Seleccione idioma de destino y haga clic en Traducir. Descargue con formato preservado." },
    ],
    pt: [
      { name: "Carregar Markdown", text: "Carregue um ou mais arquivos .md ou cole conteúdo Markdown na área de entrada." },
      { name: "Configurar opções", text: "Escolha se traduzir Front Matter, blocos de código e fórmulas LaTeX conforme necessidade." },
      { name: "Traduzir e exportar", text: "Selecione idioma e clique em Traduzir. Baixe com formatação preservada." },
    ],
  },
  "text-splitter": {
    en: [
      { name: "Input your text", text: "Paste long text into the input area or upload a text file (UTF-8 or auto-detected encoding)." },
      { name: "Choose split method", text: "Select splitting by character count, Chinese/English paragraphs, or custom delimiter." },
      { name: "Split and export", text: "Click Split. Export all segments as one merged file or batch-download as separate files." },
    ],
    zh: [
      { name: "输入文本", text: "将长文本粘贴到输入区，或上传文本文件（UTF-8 或自动识别编码）。" },
      { name: "选择分割方式", text: "选择按字符数、中英文段落或自定义分隔符分割。" },
      { name: "分割并导出", text: "点击分割。可导出为合并文件或批量下载为独立文件。" },
    ],
  },
  "json-value-extractor": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content you want to extract values from into the input area." },
      { name: "Add extraction rules", text: "Enter field names (supports nested keys like 'user.name' via dot notation). Add custom prefix/suffix for formatted output." },
      { name: "Extract and copy", text: "Click Extract. The tool returns deduplicated values — copy or export as needed." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要提取值的 JSON 内容粘贴到输入区。" },
      { name: "添加提取规则", text: "输入字段名（支持嵌套键如 'user.name' 的点路径）。可添加自定义前后缀用于格式化输出。" },
      { name: "提取并复制", text: "点击提取。工具返回去重后的值，按需复制或导出。" },
    ],
  },
  "json-node-edit": {
    en: [
      { name: "Paste JSON", text: "Paste the JSON to edit into the input area." },
      { name: "Specify target nodes", text: "Enter node names (comma-separated) or JSONPath to target. Supports nested keys like 'zh.title'." },
      { name: "Choose operation and apply", text: "Select add prefix/suffix, find-replace, or full value replacement. Preview changes and apply." },
    ],
    zh: [
      { name: "粘贴 JSON", text: "将需要编辑的 JSON 粘贴到输入区。" },
      { name: "指定目标节点", text: "输入节点名称（逗号分隔）或 JSONPath。支持嵌套键如 'zh.title'。" },
      { name: "选择操作并应用", text: "选择添加前后缀、查找替换或整值覆盖。预览变更后应用。" },
    ],
  },
  "json-value-transformer": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content for transformation." },
      { name: "Configure mapping rules", text: "Define key-value mapping rules or choose a preset template. Targets field names with recursive search (nested keys via dot notation)." },
      { name: "Transform and export", text: "Click Transform. Export the transformed JSON with original structure preserved." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要转换的 JSON 内容粘贴进来。" },
      { name: "配置映射规则", text: "定义键值映射规则或选择预设模板。通过字段名递归匹配定位（支持嵌套键的点路径）。" },
      { name: "转换并导出", text: "点击转换。导出转换后的 JSON，原始结构完整保留。" },
    ],
  },
  "json-value-swapper": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array containing items whose values need swapping." },
      { name: "Specify fields to swap", text: "Enter the two field names whose values should be exchanged across all array items." },
      { name: "Swap and export", text: "Click Swap. Review missing-field alerts and export the corrected JSON." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要交换字段值的 JSON 数组。" },
      { name: "指定要交换的字段", text: "输入要互换值的两个字段名，工具会处理数组中所有项。" },
      { name: "交换并导出", text: "点击交换。查看缺失字段提示并导出修正后的 JSON。" },
    ],
  },
  "json-node-inserter": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON data where new fields should be inserted." },
      { name: "Set reference position", text: "Enter the reference node name (new fields will be inserted after it) and the names of new nodes to add." },
      { name: "Insert and export", text: "Click Insert. The tool adds new fields to every object while preserving original order and structure." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "粘贴需要插入新字段的 JSON 数据。" },
      { name: "设置参考位置", text: "输入参考节点名称（新字段将插入其后）和要添加的新节点名称。" },
      { name: "插入并导出", text: "点击插入。工具为每个对象添加新字段，保持原有顺序和结构。" },
    ],
  },
  "json-sort-classify": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array data for sorting or classification." },
      { name: "Configure sort or group", text: "For sorting, specify field name and method. For grouping, specify main key and sub key fields." },
      { name: "Process and export", text: "Click Sort or Classify. Export the result as structured hierarchical data." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要排序或分类的 JSON 数组数据。" },
      { name: "配置排序或分组", text: "排序需指定字段名和方式；分组需指定主键和子键字段。" },
      { name: "处理并导出", text: "点击排序或分类。导出结构化的分层数据结果。" },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "テキストを入力", text: "長いテキストを入力エリアにペーストまたはテキストファイルをアップロード（UTF-8 または自動検出）。" },
      { name: "分割方法を選択", text: "文字数、中国語/英語の段落、またはカスタム区切り文字で分割方法を選択。" },
      { name: "分割してエクスポート", text: "「分割」をクリック。すべてのセグメントを1つのマージファイルまたは個別ファイルとしてエクスポート。" },
    ],
    ko: [
      { name: "텍스트 입력", text: "긴 텍스트를 입력 영역에 붙여넣거나 텍스트 파일을 업로드 (UTF-8 또는 자동 감지 인코딩)." },
      { name: "분할 방법 선택", text: "글자 수, 중국어/영어 단락 또는 사용자 정의 구분자로 분할을 선택합니다." },
      { name: "분할 및 내보내기", text: "분할을 클릭. 모든 세그먼트를 하나의 파일로 병합하거나 별도 파일로 일괄 다운로드." },
    ],
    fr: [
      { name: "Saisir le texte", text: "Collez le texte long ou importez un fichier (UTF-8 ou encodage auto-détecté)." },
      { name: "Choisir la méthode de découpage", text: "Sélectionnez par nombre de caractères, paragraphes chinois/anglais ou séparateur personnalisé." },
      { name: "Découper et exporter", text: "Cliquez sur Découper. Exportez tous les segments en un fichier ou en fichiers séparés." },
    ],
    de: [
      { name: "Text eingeben", text: "Fügen Sie langen Text ein oder laden Sie eine Textdatei hoch (UTF-8 oder Auto-Erkennung)." },
      { name: "Aufteilungsmethode wählen", text: "Wählen Sie Zeichenzahl, chinesische/englische Absätze oder benutzerdefinierte Trenner." },
      { name: "Aufteilen und exportieren", text: "Klicken Sie auf Aufteilen. Exportieren Sie alle Segmente als eine Datei oder einzeln." },
    ],
    es: [
      { name: "Introducir texto", text: "Pegue texto largo o suba un archivo (UTF-8 o codificación auto-detectada)." },
      { name: "Elegir método de división", text: "Seleccione por número de caracteres, párrafos chino/inglés o delimitador personalizado." },
      { name: "Dividir y exportar", text: "Haga clic en Dividir. Exporte todos los segmentos como un archivo o archivos individuales." },
    ],
    pt: [
      { name: "Inserir texto", text: "Cole texto longo ou carregue um arquivo (UTF-8 ou codificação auto-detectada)." },
      { name: "Escolher método de divisão", text: "Selecione por número de caracteres, parágrafos chinês/inglês ou delimitador personalizado." },
      { name: "Dividir e exportar", text: "Clique em Dividir. Exporte todos os segmentos como um arquivo ou individuais." },
    ],
  },
  "json-value-extractor": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content you want to extract values from into the input area." },
      { name: "Add extraction rules", text: "Enter field names (supports nested keys like 'user.name' via dot notation). Add custom prefix/suffix for formatted output." },
      { name: "Extract and copy", text: "Click Extract. The tool returns deduplicated values — copy or export as needed." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要提取值的 JSON 内容粘贴到输入区。" },
      { name: "添加提取规则", text: "输入字段名（支持嵌套键如 'user.name' 的点路径）。可添加自定义前后缀用于格式化输出。" },
      { name: "提取并复制", text: "点击提取。工具返回去重后的值，按需复制或导出。" },
    ],
  },
  "json-node-edit": {
    en: [
      { name: "Paste JSON", text: "Paste the JSON to edit into the input area." },
      { name: "Specify target nodes", text: "Enter node names (comma-separated) or JSONPath to target. Supports nested keys like 'zh.title'." },
      { name: "Choose operation and apply", text: "Select add prefix/suffix, find-replace, or full value replacement. Preview changes and apply." },
    ],
    zh: [
      { name: "粘贴 JSON", text: "将需要编辑的 JSON 粘贴到输入区。" },
      { name: "指定目标节点", text: "输入节点名称（逗号分隔）或 JSONPath。支持嵌套键如 'zh.title'。" },
      { name: "选择操作并应用", text: "选择添加前后缀、查找替换或整值覆盖。预览变更后应用。" },
    ],
  },
  "json-value-transformer": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content for transformation." },
      { name: "Configure mapping rules", text: "Define key-value mapping rules or choose a preset template. Targets field names with recursive search (nested keys via dot notation)." },
      { name: "Transform and export", text: "Click Transform. Export the transformed JSON with original structure preserved." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要转换的 JSON 内容粘贴进来。" },
      { name: "配置映射规则", text: "定义键值映射规则或选择预设模板。通过字段名递归匹配定位（支持嵌套键的点路径）。" },
      { name: "转换并导出", text: "点击转换。导出转换后的 JSON，原始结构完整保留。" },
    ],
  },
  "json-value-swapper": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array containing items whose values need swapping." },
      { name: "Specify fields to swap", text: "Enter the two field names whose values should be exchanged across all array items." },
      { name: "Swap and export", text: "Click Swap. Review missing-field alerts and export the corrected JSON." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要交换字段值的 JSON 数组。" },
      { name: "指定要交换的字段", text: "输入要互换值的两个字段名，工具会处理数组中所有项。" },
      { name: "交换并导出", text: "点击交换。查看缺失字段提示并导出修正后的 JSON。" },
    ],
  },
  "json-node-inserter": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON data where new fields should be inserted." },
      { name: "Set reference position", text: "Enter the reference node name (new fields will be inserted after it) and the names of new nodes to add." },
      { name: "Insert and export", text: "Click Insert. The tool adds new fields to every object while preserving original order and structure." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "粘贴需要插入新字段的 JSON 数据。" },
      { name: "设置参考位置", text: "输入参考节点名称（新字段将插入其后）和要添加的新节点名称。" },
      { name: "插入并导出", text: "点击插入。工具为每个对象添加新字段，保持原有顺序和结构。" },
    ],
  },
  "json-sort-classify": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array data for sorting or classification." },
      { name: "Configure sort or group", text: "For sorting, specify field name and method. For grouping, specify main key and sub key fields." },
      { name: "Process and export", text: "Click Sort or Classify. Export the result as structured hierarchical data." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要排序或分类的 JSON 数组数据。" },
      { name: "配置排序或分组", text: "排序需指定字段名和方式；分组需指定主键和子键字段。" },
      { name: "处理并导出", text: "点击排序或分类。导出结构化的分层数据结果。" },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "JSON データを貼り付け", text: "値を抽出したい JSON コンテンツを入力エリアにペースト。" },
      { name: "抽出ルールを追加", text: "フィールド名（ネストキー 'user.name' など点記法）を入力。カスタム接頭辞/接尾辞で整形出力も可能。" },
      { name: "抽出してコピー", text: "「抽出」をクリック。重複排除された値が返されるので、必要に応じてコピーまたはエクスポート。" },
    ],
    ko: [
      { name: "JSON 데이터 붙여넣기", text: "값을 추출할 JSON 콘텐츠를 입력 영역에 붙여넣습니다." },
      { name: "추출 규칙 추가", text: "필드 이름 입력(중첩 키 'user.name' 등 점 표기법 지원). 사용자 정의 접두사/접미사로 형식 출력 가능." },
      { name: "추출 및 복사", text: "추출을 클릭. 도구가 중복 제거된 값을 반환 — 필요에 따라 복사 또는 내보내기." },
    ],
    fr: [
      { name: "Coller les données JSON", text: "Collez le contenu JSON dont vous souhaitez extraire les valeurs." },
      { name: "Ajouter des règles d'extraction", text: "Saisissez les noms de champs (support des clés imbriquées comme 'user.name' en notation point). Ajoutez préfixe/suffixe personnalisés." },
      { name: "Extraire et copier", text: "Cliquez sur Extraire. L'outil renvoie des valeurs dédupliquées à copier ou exporter." },
    ],
    de: [
      { name: "JSON-Daten einfügen", text: "Fügen Sie den JSON-Inhalt ein, aus dem Sie Werte extrahieren möchten." },
      { name: "Extraktionsregeln hinzufügen", text: "Geben Sie Feldnamen ein (unterstützt verschachtelte Schlüssel wie 'user.name' in Punktnotation). Mit benutzerdefinierten Präfixen/Suffixen." },
      { name: "Extrahieren und kopieren", text: "Klicken Sie auf Extrahieren. Das Tool liefert deduplizierte Werte zum Kopieren/Export." },
    ],
    es: [
      { name: "Pegar datos JSON", text: "Pegue el contenido JSON del que desea extraer valores." },
      { name: "Añadir reglas de extracción", text: "Introduzca nombres de campos (admite claves anidadas como 'user.name' en notación de punto). Con prefijos/sufijos personalizados." },
      { name: "Extraer y copiar", text: "Haga clic en Extraer. La herramienta devuelve valores deduplicados para copiar o exportar." },
    ],
    pt: [
      { name: "Colar dados JSON", text: "Cole o conteúdo JSON do qual deseja extrair valores." },
      { name: "Adicionar regras de extração", text: "Insira nomes de campos (suporta chaves aninhadas como 'user.name' em notação de ponto). Com prefixos/sufixos personalizados." },
      { name: "Extrair e copiar", text: "Clique em Extrair. A ferramenta retorna valores deduplicados para copiar ou exportar." },
    ],
  },
  "json-node-edit": {
    en: [
      { name: "Paste JSON", text: "Paste the JSON to edit into the input area." },
      { name: "Specify target nodes", text: "Enter node names (comma-separated) or JSONPath to target. Supports nested keys like 'zh.title'." },
      { name: "Choose operation and apply", text: "Select add prefix/suffix, find-replace, or full value replacement. Preview changes and apply." },
    ],
    zh: [
      { name: "粘贴 JSON", text: "将需要编辑的 JSON 粘贴到输入区。" },
      { name: "指定目标节点", text: "输入节点名称（逗号分隔）或 JSONPath。支持嵌套键如 'zh.title'。" },
      { name: "选择操作并应用", text: "选择添加前后缀、查找替换或整值覆盖。预览变更后应用。" },
    ],
  },
  "json-value-transformer": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content for transformation." },
      { name: "Configure mapping rules", text: "Define key-value mapping rules or choose a preset template. Targets field names with recursive search (nested keys via dot notation)." },
      { name: "Transform and export", text: "Click Transform. Export the transformed JSON with original structure preserved." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要转换的 JSON 内容粘贴进来。" },
      { name: "配置映射规则", text: "定义键值映射规则或选择预设模板。通过字段名递归匹配定位（支持嵌套键的点路径）。" },
      { name: "转换并导出", text: "点击转换。导出转换后的 JSON，原始结构完整保留。" },
    ],
  },
  "json-value-swapper": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array containing items whose values need swapping." },
      { name: "Specify fields to swap", text: "Enter the two field names whose values should be exchanged across all array items." },
      { name: "Swap and export", text: "Click Swap. Review missing-field alerts and export the corrected JSON." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要交换字段值的 JSON 数组。" },
      { name: "指定要交换的字段", text: "输入要互换值的两个字段名，工具会处理数组中所有项。" },
      { name: "交换并导出", text: "点击交换。查看缺失字段提示并导出修正后的 JSON。" },
    ],
  },
  "json-node-inserter": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON data where new fields should be inserted." },
      { name: "Set reference position", text: "Enter the reference node name (new fields will be inserted after it) and the names of new nodes to add." },
      { name: "Insert and export", text: "Click Insert. The tool adds new fields to every object while preserving original order and structure." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "粘贴需要插入新字段的 JSON 数据。" },
      { name: "设置参考位置", text: "输入参考节点名称（新字段将插入其后）和要添加的新节点名称。" },
      { name: "插入并导出", text: "点击插入。工具为每个对象添加新字段，保持原有顺序和结构。" },
    ],
  },
  "json-sort-classify": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array data for sorting or classification." },
      { name: "Configure sort or group", text: "For sorting, specify field name and method. For grouping, specify main key and sub key fields." },
      { name: "Process and export", text: "Click Sort or Classify. Export the result as structured hierarchical data." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要排序或分类的 JSON 数组数据。" },
      { name: "配置排序或分组", text: "排序需指定字段名和方式；分组需指定主键和子键字段。" },
      { name: "处理并导出", text: "点击排序或分类。导出结构化的分层数据结果。" },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "JSON を貼り付け", text: "編集する JSON を入力エリアにペースト。" },
      { name: "対象ノードを指定", text: "ノード名（カンマ区切り）または JSONPath で対象を指定。'zh.title' のようなネストキーにも対応。" },
      { name: "操作を選択して適用", text: "接頭辞/接尾辞追加、検索置換、または値の完全置換を選択。プレビューして適用。" },
    ],
    ko: [
      { name: "JSON 붙여넣기", text: "편집할 JSON을 입력 영역에 붙여넣습니다." },
      { name: "대상 노드 지정", text: "노드 이름(쉼표 구분) 또는 JSONPath로 대상 지정. 'zh.title' 같은 중첩 키 지원." },
      { name: "작업 선택 및 적용", text: "접두사/접미사 추가, 찾기-바꾸기 또는 전체 값 바꾸기 선택. 변경사항 미리보기 후 적용." },
    ],
    fr: [
      { name: "Coller le JSON", text: "Collez le JSON à modifier dans la zone de saisie." },
      { name: "Spécifier les nœuds cibles", text: "Saisissez les noms de nœuds (séparés par virgules) ou JSONPath. Support des clés imbriquées comme 'zh.title'." },
      { name: "Choisir l'opération et appliquer", text: "Sélectionnez ajout de préfixe/suffixe, rechercher-remplacer ou remplacement complet. Prévisualisez et appliquez." },
    ],
    de: [
      { name: "JSON einfügen", text: "Fügen Sie das zu bearbeitende JSON in den Eingabebereich ein." },
      { name: "Zielknoten angeben", text: "Knotennamen (kommagetrennt) oder JSONPath eingeben. Unterstützt verschachtelte Schlüssel." },
      { name: "Operation wählen und anwenden", text: "Präfix/Suffix, Suchen-Ersetzen oder Wertersetzung auswählen. Vorschau und Anwendung." },
    ],
    es: [
      { name: "Pegar JSON", text: "Pegue el JSON a editar en el área de entrada." },
      { name: "Especificar nodos objetivo", text: "Introduzca nombres de nodos (separados por comas) o JSONPath. Admite claves anidadas." },
      { name: "Elegir operación y aplicar", text: "Seleccione añadir prefijo/sufijo, buscar-reemplazar o reemplazo completo. Vista previa y aplicar." },
    ],
    pt: [
      { name: "Colar JSON", text: "Cole o JSON a editar na área de entrada." },
      { name: "Especificar nós alvo", text: "Insira nomes de nós (separados por vírgulas) ou JSONPath. Suporta chaves aninhadas." },
      { name: "Escolher operação e aplicar", text: "Selecione adicionar prefixo/sufixo, buscar-substituir ou substituição completa. Visualize e aplique." },
    ],
  },
  "json-value-transformer": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON content for transformation." },
      { name: "Configure mapping rules", text: "Define key-value mapping rules or choose a preset template. Targets field names with recursive search (nested keys via dot notation)." },
      { name: "Transform and export", text: "Click Transform. Export the transformed JSON with original structure preserved." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "将需要转换的 JSON 内容粘贴进来。" },
      { name: "配置映射规则", text: "定义键值映射规则或选择预设模板。通过字段名递归匹配定位（支持嵌套键的点路径）。" },
      { name: "转换并导出", text: "点击转换。导出转换后的 JSON，原始结构完整保留。" },
    ],
  },
  "json-value-swapper": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array containing items whose values need swapping." },
      { name: "Specify fields to swap", text: "Enter the two field names whose values should be exchanged across all array items." },
      { name: "Swap and export", text: "Click Swap. Review missing-field alerts and export the corrected JSON." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要交换字段值的 JSON 数组。" },
      { name: "指定要交换的字段", text: "输入要互换值的两个字段名，工具会处理数组中所有项。" },
      { name: "交换并导出", text: "点击交换。查看缺失字段提示并导出修正后的 JSON。" },
    ],
  },
  "json-node-inserter": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON data where new fields should be inserted." },
      { name: "Set reference position", text: "Enter the reference node name (new fields will be inserted after it) and the names of new nodes to add." },
      { name: "Insert and export", text: "Click Insert. The tool adds new fields to every object while preserving original order and structure." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "粘贴需要插入新字段的 JSON 数据。" },
      { name: "设置参考位置", text: "输入参考节点名称（新字段将插入其后）和要添加的新节点名称。" },
      { name: "插入并导出", text: "点击插入。工具为每个对象添加新字段，保持原有顺序和结构。" },
    ],
  },
  "json-sort-classify": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array data for sorting or classification." },
      { name: "Configure sort or group", text: "For sorting, specify field name and method. For grouping, specify main key and sub key fields." },
      { name: "Process and export", text: "Click Sort or Classify. Export the result as structured hierarchical data." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要排序或分类的 JSON 数组数据。" },
      { name: "配置排序或分组", text: "排序需指定字段名和方式；分组需指定主键和子键字段。" },
      { name: "处理并导出", text: "点击排序或分类。导出结构化的分层数据结果。" },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "JSON データを貼り付け", text: "変換対象の JSON コンテンツをペースト。" },
      { name: "マッピングルールを設定", text: "キー値マッピングルールを定義またはプリセットテンプレートを選択。フィールド名の再帰検索で位置特定（ネストキーは点記法）。" },
      { name: "変換してエクスポート", text: "「変換」をクリック。元の構造を保持したまま変換後の JSON をエクスポート。" },
    ],
    ko: [
      { name: "JSON 데이터 붙여넣기", text: "변환할 JSON 콘텐츠를 붙여넣습니다." },
      { name: "매핑 규칙 구성", text: "키-값 매핑 규칙을 정의하거나 프리셋 템플릿 선택. 필드 이름 재귀 검색으로 위치 지정(중첩 키는 점 표기법)." },
      { name: "변환 및 내보내기", text: "변환을 클릭. 원래 구조가 보존된 변환된 JSON 내보내기." },
    ],
    fr: [
      { name: "Coller les données JSON", text: "Collez le contenu JSON à transformer." },
      { name: "Configurer les règles de mapping", text: "Définissez des règles clé-valeur ou choisissez un modèle prédéfini. Cible les noms de champs par recherche récursive (clés imbriquées en notation point)." },
      { name: "Transformer et exporter", text: "Cliquez sur Transformer. Exportez le JSON transformé avec la structure d'origine préservée." },
    ],
    de: [
      { name: "JSON-Daten einfügen", text: "Fügen Sie den zu transformierenden JSON-Inhalt ein." },
      { name: "Mapping-Regeln konfigurieren", text: "Definieren Sie Schlüssel-Wert-Regeln oder wählen Sie eine Vorlage. Zielt auf Feldnamen mit rekursiver Suche (verschachtelte Schlüssel in Punktnotation)." },
      { name: "Transformieren und exportieren", text: "Klicken Sie auf Transformieren. Export mit erhaltener Ursprungsstruktur." },
    ],
    es: [
      { name: "Pegar datos JSON", text: "Pegue el contenido JSON a transformar." },
      { name: "Configurar reglas de mapeo", text: "Defina reglas clave-valor o elija una plantilla predefinida. Localiza nombres de campos con búsqueda recursiva (claves anidadas en notación de punto)." },
      { name: "Transformar y exportar", text: "Haga clic en Transformar. Exporte el JSON con la estructura original preservada." },
    ],
    pt: [
      { name: "Colar dados JSON", text: "Cole o conteúdo JSON a transformar." },
      { name: "Configurar regras de mapeamento", text: "Defina regras chave-valor ou escolha um modelo predefinido. Localiza nomes de campos com busca recursiva (chaves aninhadas em notação de ponto)." },
      { name: "Transformar e exportar", text: "Clique em Transformar. Exporte o JSON com a estrutura original preservada." },
    ],
  },
  "json-value-swapper": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array containing items whose values need swapping." },
      { name: "Specify fields to swap", text: "Enter the two field names whose values should be exchanged across all array items." },
      { name: "Swap and export", text: "Click Swap. Review missing-field alerts and export the corrected JSON." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要交换字段值的 JSON 数组。" },
      { name: "指定要交换的字段", text: "输入要互换值的两个字段名，工具会处理数组中所有项。" },
      { name: "交换并导出", text: "点击交换。查看缺失字段提示并导出修正后的 JSON。" },
    ],
  },
  "json-node-inserter": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON data where new fields should be inserted." },
      { name: "Set reference position", text: "Enter the reference node name (new fields will be inserted after it) and the names of new nodes to add." },
      { name: "Insert and export", text: "Click Insert. The tool adds new fields to every object while preserving original order and structure." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "粘贴需要插入新字段的 JSON 数据。" },
      { name: "设置参考位置", text: "输入参考节点名称（新字段将插入其后）和要添加的新节点名称。" },
      { name: "插入并导出", text: "点击插入。工具为每个对象添加新字段，保持原有顺序和结构。" },
    ],
  },
  "json-sort-classify": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array data for sorting or classification." },
      { name: "Configure sort or group", text: "For sorting, specify field name and method. For grouping, specify main key and sub key fields." },
      { name: "Process and export", text: "Click Sort or Classify. Export the result as structured hierarchical data." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要排序或分类的 JSON 数组数据。" },
      { name: "配置排序或分组", text: "排序需指定字段名和方式；分组需指定主键和子键字段。" },
      { name: "处理并导出", text: "点击排序或分类。导出结构化的分层数据结果。" },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "JSON 配列を貼り付け", text: "値を交換したい項目を含む JSON 配列をペースト。" },
      { name: "交換するフィールドを指定", text: "配列のすべての項目で値を交換する2つのフィールド名を入力。" },
      { name: "交換してエクスポート", text: "「交換」をクリック。欠落フィールドの警告を確認してから修正済み JSON をエクスポート。" },
    ],
    ko: [
      { name: "JSON 배열 붙여넣기", text: "값을 교환해야 할 항목을 포함한 JSON 배열을 붙여넣습니다." },
      { name: "교환할 필드 지정", text: "모든 배열 항목에서 값을 교환해야 할 두 필드 이름을 입력합니다." },
      { name: "교환 및 내보내기", text: "교환을 클릭. 누락 필드 경고를 검토하고 수정된 JSON을 내보냅니다." },
    ],
    fr: [
      { name: "Coller le tableau JSON", text: "Collez le tableau JSON contenant les éléments dont les valeurs doivent être échangées." },
      { name: "Spécifier les champs à échanger", text: "Saisissez les deux noms de champs dont les valeurs seront échangées dans tous les éléments." },
      { name: "Échanger et exporter", text: "Cliquez sur Échanger. Consultez les alertes de champs manquants et exportez le JSON corrigé." },
    ],
    de: [
      { name: "JSON-Array einfügen", text: "Fügen Sie das JSON-Array ein, dessen Werte getauscht werden sollen." },
      { name: "Zu tauschende Felder angeben", text: "Zwei Feldnamen eingeben, deren Werte über alle Array-Elemente getauscht werden." },
      { name: "Tauschen und exportieren", text: "Klicken Sie auf Tauschen. Fehlende-Feld-Warnungen prüfen und korrigiertes JSON exportieren." },
    ],
    es: [
      { name: "Pegar array JSON", text: "Pegue el array JSON con los elementos cuyos valores se intercambiarán." },
      { name: "Especificar campos a intercambiar", text: "Introduzca dos nombres de campos cuyos valores se intercambiarán en todos los elementos." },
      { name: "Intercambiar y exportar", text: "Haga clic en Intercambiar. Revise las alertas de campos faltantes y exporte el JSON corregido." },
    ],
    pt: [
      { name: "Colar array JSON", text: "Cole o array JSON contendo itens cujos valores serão trocados." },
      { name: "Especificar campos para trocar", text: "Insira dois nomes de campos cujos valores serão trocados em todos os itens." },
      { name: "Trocar e exportar", text: "Clique em Trocar. Revise alertas de campos ausentes e exporte o JSON corrigido." },
    ],
  },
  "json-node-inserter": {
    en: [
      { name: "Paste JSON data", text: "Paste the JSON data where new fields should be inserted." },
      { name: "Set reference position", text: "Enter the reference node name (new fields will be inserted after it) and the names of new nodes to add." },
      { name: "Insert and export", text: "Click Insert. The tool adds new fields to every object while preserving original order and structure." },
    ],
    zh: [
      { name: "粘贴 JSON 数据", text: "粘贴需要插入新字段的 JSON 数据。" },
      { name: "设置参考位置", text: "输入参考节点名称（新字段将插入其后）和要添加的新节点名称。" },
      { name: "插入并导出", text: "点击插入。工具为每个对象添加新字段，保持原有顺序和结构。" },
    ],
  },
  "json-sort-classify": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array data for sorting or classification." },
      { name: "Configure sort or group", text: "For sorting, specify field name and method. For grouping, specify main key and sub key fields." },
      { name: "Process and export", text: "Click Sort or Classify. Export the result as structured hierarchical data." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要排序或分类的 JSON 数组数据。" },
      { name: "配置排序或分组", text: "排序需指定字段名和方式；分组需指定主键和子键字段。" },
      { name: "处理并导出", text: "点击排序或分类。导出结构化的分层数据结果。" },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "JSON データを貼り付け", text: "新しいフィールドを挿入する JSON データをペースト。" },
      { name: "参照位置を設定", text: "参照ノード名（新フィールドはその後に挿入）と追加する新ノード名を入力。" },
      { name: "挿入してエクスポート", text: "「挿入」をクリック。元の順序と構造を保持したままフィールドが追加されます。" },
    ],
    ko: [
      { name: "JSON 데이터 붙여넣기", text: "새 필드를 삽입할 JSON 데이터를 붙여넣습니다." },
      { name: "참조 위치 설정", text: "참조 노드 이름(새 필드는 그 뒤에 삽입됨)과 추가할 새 노드 이름을 입력합니다." },
      { name: "삽입 및 내보내기", text: "삽입을 클릭. 도구가 원래 순서와 구조를 보존하면서 모든 객체에 새 필드를 추가합니다." },
    ],
    fr: [
      { name: "Coller les données JSON", text: "Collez les données JSON où les nouveaux champs doivent être insérés." },
      { name: "Définir la position de référence", text: "Saisissez le nœud de référence (les nouveaux champs sont insérés après) et les noms des nouveaux nœuds." },
      { name: "Insérer et exporter", text: "Cliquez sur Insérer. L'outil ajoute les nouveaux champs à chaque objet en préservant l'ordre." },
    ],
    de: [
      { name: "JSON-Daten einfügen", text: "Fügen Sie die JSON-Daten ein, in die neue Felder eingefügt werden sollen." },
      { name: "Referenzposition setzen", text: "Referenzknoten und neue Knotennamen angeben (neue Felder werden danach eingefügt)." },
      { name: "Einfügen und exportieren", text: "Klicken Sie auf Einfügen. Das Tool fügt neue Felder unter Beibehaltung von Reihenfolge hinzu." },
    ],
    es: [
      { name: "Pegar datos JSON", text: "Pegue los datos JSON donde se insertarán nuevos campos." },
      { name: "Establecer posición de referencia", text: "Introduzca el nodo de referencia y los nombres de los nuevos nodos a añadir." },
      { name: "Insertar y exportar", text: "Haga clic en Insertar. La herramienta añade campos manteniendo el orden original." },
    ],
    pt: [
      { name: "Colar dados JSON", text: "Cole os dados JSON onde novos campos serão inseridos." },
      { name: "Definir posição de referência", text: "Insira o nó de referência e os nomes dos novos nós a adicionar." },
      { name: "Inserir e exportar", text: "Clique em Inserir. A ferramenta adiciona campos mantendo a ordem original." },
    ],
  },
  "json-sort-classify": {
    en: [
      { name: "Paste JSON array", text: "Paste the JSON array data for sorting or classification." },
      { name: "Configure sort or group", text: "For sorting, specify field name and method. For grouping, specify main key and sub key fields." },
      { name: "Process and export", text: "Click Sort or Classify. Export the result as structured hierarchical data." },
    ],
    zh: [
      { name: "粘贴 JSON 数组", text: "粘贴需要排序或分类的 JSON 数组数据。" },
      { name: "配置排序或分组", text: "排序需指定字段名和方式；分组需指定主键和子键字段。" },
      { name: "处理并导出", text: "点击排序或分类。导出结构化的分层数据结果。" },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "JSON 配列を貼り付け", text: "ソートまたは分類する JSON 配列データをペースト。" },
      { name: "ソートまたはグループを設定", text: "ソートはフィールド名と方法を指定。グループ化は主キーと副キーフィールドを指定。" },
      { name: "処理してエクスポート", text: "「ソート」または「分類」をクリック。結果を階層構造データとしてエクスポート。" },
    ],
    ko: [
      { name: "JSON 배열 붙여넣기", text: "정렬 또는 분류할 JSON 배열 데이터를 붙여넣습니다." },
      { name: "정렬 또는 그룹 구성", text: "정렬은 필드 이름과 방법 지정. 그룹화는 주 키와 부 키 필드 지정." },
      { name: "처리 및 내보내기", text: "정렬 또는 분류를 클릭. 결과를 구조화된 계층 데이터로 내보냅니다." },
    ],
    fr: [
      { name: "Coller le tableau JSON", text: "Collez les données du tableau JSON pour tri ou classification." },
      { name: "Configurer le tri ou groupement", text: "Pour le tri, spécifiez nom de champ et méthode. Pour le groupement, clé principale et sous-clé." },
      { name: "Traiter et exporter", text: "Cliquez sur Trier ou Classifier. Exportez le résultat sous forme de données hiérarchiques structurées." },
    ],
    de: [
      { name: "JSON-Array einfügen", text: "Fügen Sie die JSON-Array-Daten für Sortierung oder Klassifikation ein." },
      { name: "Sortierung oder Gruppierung konfigurieren", text: "Feldname/Methode für Sortierung, Hauptschlüssel/Unterschlüssel für Gruppierung." },
      { name: "Verarbeiten und exportieren", text: "Klicken Sie auf Sortieren/Klassifizieren. Export als strukturierte hierarchische Daten." },
    ],
    es: [
      { name: "Pegar array JSON", text: "Pegue los datos del array JSON para ordenación o clasificación." },
      { name: "Configurar ordenación o agrupación", text: "Para ordenar, especifique nombre de campo y método. Para agrupar, clave principal y subclave." },
      { name: "Procesar y exportar", text: "Haga clic en Ordenar o Clasificar. Exporte como datos jerárquicos estructurados." },
    ],
    pt: [
      { name: "Colar array JSON", text: "Cole os dados do array JSON para ordenação ou classificação." },
      { name: "Configurar ordenação ou agrupamento", text: "Para ordenar, especifique nome do campo e método. Para agrupar, chave principal e subchave." },
      { name: "Processar e exportar", text: "Clique em Ordenar ou Classificar. Exporte como dados hierárquicos estruturados." },
    ],
  },
  "json-match-update": {
    en: [
      { name: "Input source and target JSON", text: "Paste the source JSON (data to copy from) and target JSON (data to update)." },
      { name: "Set match and update fields", text: "Specify the ID field for matching rows and the fields whose values should be updated." },
      { name: "Match and export", text: "Click Update. The tool matches records and batch-updates values, flagging any unmatched items." },
    ],
    zh: [
      { name: "输入源和目标 JSON", text: "粘贴源 JSON（数据来源）和目标 JSON（待更新数据）。" },
      { name: "设置匹配和更新字段", text: "指定用于匹配数据项的 ID 字段，以及需要更新的字段。" },
      { name: "匹配并导出", text: "点击更新。工具匹配数据并批量更新值，同时标记未匹配项。" },
    ],
  },
  flare: {
    en: [
      { name: "Paste bookmark data", text: "Paste browser-exported bookmark HTML or Flare JSON data into the input area." },
      { name: "Choose conversion direction", text: "Select target format: Flare App mode, Flare Bookmark mode, or standard browser format." },
      { name: "Convert and save", text: "Click Convert. Copy the result or download to import into your target application." },
    ],
    zh: [
      { name: "粘贴书签数据", text: "将浏览器导出的书签 HTML 或 Flare JSON 数据粘贴到输入区。" },
      { name: "选择转换方向", text: "选择目标格式：Flare App 模式、Flare Bookmark 模式或标准浏览器格式。" },
      { name: "转换并保存", text: "点击转换。复制结果或下载导入目标应用。" },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "ソースと対象 JSON を入力", text: "ソース JSON（コピー元）と対象 JSON（更新対象）をペースト。" },
      { name: "マッチと更新フィールドを設定", text: "行マッチング用の ID フィールドと更新対象フィールドを指定。" },
      { name: "マッチしてエクスポート", text: "「更新」をクリック。ツールがレコードをマッチしてバッチ更新、未マッチ項目も通知。" },
    ],
    ko: [
      { name: "소스 및 대상 JSON 입력", text: "소스 JSON(복사할 데이터)과 대상 JSON(업데이트할 데이터)을 붙여넣습니다." },
      { name: "매치 및 업데이트 필드 설정", text: "행 매칭용 ID 필드와 업데이트할 필드를 지정합니다." },
      { name: "매치 및 내보내기", text: "업데이트를 클릭. 도구가 레코드를 매칭하고 값을 일괄 업데이트하며 미매칭 항목을 플래그합니다." },
    ],
    fr: [
      { name: "Saisir JSON source et cible", text: "Collez le JSON source (données à copier) et le JSON cible (données à mettre à jour)." },
      { name: "Définir les champs de correspondance et mise à jour", text: "Spécifiez le champ ID pour la correspondance et les champs à mettre à jour." },
      { name: "Faire correspondre et exporter", text: "Cliquez sur Mettre à jour. L'outil effectue la correspondance et signale les éléments non appariés." },
    ],
    de: [
      { name: "Quell- und Ziel-JSON eingeben", text: "Fügen Sie Quell-JSON (Datenquelle) und Ziel-JSON (Aktualisierungsziel) ein." },
      { name: "Match- und Update-Felder setzen", text: "ID-Feld für Zeilenmatching und zu aktualisierende Felder angeben." },
      { name: "Matchen und exportieren", text: "Klicken Sie auf Aktualisieren. Tool matcht Datensätze und flaggt nicht gefundene Elemente." },
    ],
    es: [
      { name: "Introducir JSON fuente y destino", text: "Pegue el JSON fuente (datos a copiar) y el JSON destino (datos a actualizar)." },
      { name: "Configurar campos de coincidencia y actualización", text: "Especifique el campo ID para emparejar filas y los campos a actualizar." },
      { name: "Coincidir y exportar", text: "Haga clic en Actualizar. La herramienta empareja registros y marca elementos sin coincidencia." },
    ],
    pt: [
      { name: "Inserir JSON fonte e destino", text: "Cole o JSON fonte (dados a copiar) e o JSON destino (dados a atualizar)." },
      { name: "Configurar campos de correspondência e atualização", text: "Especifique o campo ID para correspondência e os campos a atualizar." },
      { name: "Corresponder e exportar", text: "Clique em Atualizar. A ferramenta corresponde registros e sinaliza itens sem correspondência." },
    ],
  },
  "img-prompt": {
    en: [
      { name: "Enter name pairs", text: "Input name pairs one per line (e.g., 'Illustration: 插图'), separated by colon or tab." },
      { name: "Customize fields", text: "Set custom object and attribute key names to match your data schema." },
      { name: "Generate JSON", text: "Click Generate. The tool outputs a deduplicated standard JSON dataset ready for IMGPrompt." },
    ],
    zh: [
      { name: "输入名称对", text: "每行输入一对名称（如：'Illustration: 插图'），用冒号或制表符分隔。" },
      { name: "自定义字段", text: "设置对象和属性键名以匹配你的数据结构。" },
      { name: "生成 JSON", text: "点击生成。工具输出去重后的标准 JSON 数据集，可直接用于 IMGPrompt。" },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,    ja: [
      { name: "名前ペアを入力", text: "名前ペアを1行ずつ入力（例：'Illustration: 插图'）、コロンまたはタブで区切り。" },
      { name: "フィールドをカスタマイズ", text: "データスキーマに合わせて object と attribute のキー名を設定。" },
      { name: "JSON を生成", text: "「生成」をクリック。IMGPrompt 用の重複排除された標準 JSON データセットが出力されます。" },
    ],
    ko: [
      { name: "이름 쌍 입력", text: "한 줄에 한 쌍씩 이름을 입력(예: 'Illustration: 插图'), 콜론 또는 탭으로 구분." },
      { name: "필드 사용자 정의", text: "데이터 스키마에 맞게 object 및 attribute 키 이름을 설정합니다." },
      { name: "JSON 생성", text: "생성을 클릭. 도구가 IMGPrompt용 중복 제거된 표준 JSON 데이터셋을 출력합니다." },
    ],
    fr: [
      { name: "Saisir les paires de noms", text: "Saisissez une paire de noms par ligne (ex : 'Illustration: 插图'), séparées par deux-points ou tabulation." },
      { name: "Personnaliser les champs", text: "Définissez les noms de clés object et attribute selon votre schéma de données." },
      { name: "Générer JSON", text: "Cliquez sur Générer. L'outil produit un jeu de données JSON standard dédupliqué prêt pour IMGPrompt." },
    ],
    de: [
      { name: "Namenspaare eingeben", text: "Ein Paar pro Zeile eingeben (z.B. 'Illustration: 插图'), getrennt durch Doppelpunkt oder Tab." },
      { name: "Felder anpassen", text: "object- und attribute-Schlüsselnamen an Ihr Datenschema anpassen." },
      { name: "JSON generieren", text: "Klicken Sie auf Generieren. Deduplizierter Standard-JSON-Datensatz für IMGPrompt." },
    ],
    es: [
      { name: "Introducir pares de nombres", text: "Introduzca un par por línea (ej: 'Illustration: 插图'), separados por dos puntos o tabulación." },
      { name: "Personalizar campos", text: "Configure nombres de claves de objeto y atributo según su esquema de datos." },
      { name: "Generar JSON", text: "Haga clic en Generar. Conjunto JSON estándar deduplicado listo para IMGPrompt." },
    ],
    pt: [
      { name: "Inserir pares de nomes", text: "Insira um par por linha (ex: 'Illustration: 插图'), separados por dois pontos ou tabulação." },
      { name: "Personalizar campos", text: "Configure nomes de chaves de objeto e atributo conforme seu esquema de dados." },
      { name: "Gerar JSON", text: "Clique em Gerar. Conjunto JSON padrão deduplicado pronto para IMGPrompt." },
    ],
  },
  "chinese-conversion": {
    zh: [
      { name: "粘贴或输入文本", text: "将需要转换的简体或繁体中文文本粘贴到输入区。" },
      { name: "选择转换方向", text: "选择转换方向：简体↔台湾繁体↔香港繁体↔日本新字体。" },
      { name: "转换并复制", text: "工具本地实时转换。复制结果即可使用，文本不会上传服务器。" },
    ],
  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,  },
  "novel-processor": {
    zh: [
      { name: "粘贴小说文本", text: "将下载的小说文本粘贴到输入区，或上传 TXT 文件。" },
      { name: "选择整理规则", text: "选择需要的处理规则：智能换行、章节分割、段落缩进、去重复行、繁简转换等。" },
      { name: "处理并导出", text: "点击处理。导出整理后的 TXT 文件，阅读体验立即提升。" },
    ],
  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,  },
  "regex-matcher": {
    zh: [
      { name: "输入文本", text: "将需要处理的文本粘贴到输入区。" },
      { name: "选择处理操作", text: "选择正则匹配、排序、过滤、去重、前后缀添加或 URL 提取等操作。" },
      { name: "应用并导出", text: "叠加使用多个规则后点击应用。复制或导出处理结果。" },
    ],
  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,  },
  "text-processor": {
    zh: [
      { name: "粘贴文本或表格数据", text: "将 Excel 数据或文本粘贴到输入区。" },
      { name: "配置处理规则", text: "选择去重、指定列提取、文本合并、添加前缀等规则，可叠加多条。" },
      { name: "处理并导出", text: "点击处理。按配置顺序执行所有规则，一次性完成复杂的文本处理。" },
    ],
  },
};

/** Get HowTo steps for a tool,  },
};

/** Get HowTo steps for a tool, with locale fallback (zh → en → first available) */
export function getHowToSteps(toolKey: string, locale: string): HowToStep[] | null {
  const tool = TOOL_HOWTO[toolKey];
  if (!tool) return null;
  if (locale === "zh-hant") return tool["zh-hant"] ?? tool.zh ?? tool.en ?? null;
  return tool[locale] ?? tool.en ?? tool.zh ?? null;
}

const TOOL_FEATURES: Record<string, Record<string, string[]>> = {
  "json-translate": {
    en: [
    "Supports 15+ translation engines (Google, DeepSeek, DeepL, Azure, OpenAI, Qwen-MT)",
    "JSONPath matching for precise key targeting",
    "Multi-language batch generation (en.json, ja.json, ko.json, etc.)",
    "Key mapping mode for renaming during translation",
    "Translation cache for incremental updates",
    "i18n merge mode combines all languages into one file",
  ],
    ja: [
      "15+ 翻訳エンジン対応（Google、DeepSeek、DeepL、Azure、OpenAI、Qwen-MT）",
      "JSONPath マッチングによる精密なキー指定",
      "多言語一括生成（en.json、ja.json、ko.json など）",
      "翻訳時のキー名変更（キーマッピングモード）",
      "増分更新のための翻訳キャッシュ",
      "i18n マージモードで全言語を1ファイルに統合",
    ],
    ko: [
      "15개 이상의 번역 엔진 지원 (Google, DeepSeek, DeepL, Azure, OpenAI, Qwen-MT)",
      "JSONPath 매칭을 통한 정확한 키 타겟팅",
      "다국어 일괄 생성 (en.json, ja.json, ko.json 등)",
      "번역 중 키 이름 변경 (키 매핑 모드)",
      "증분 업데이트를 위한 번역 캐시",
      "i18n 병합 모드로 모든 언어를 하나의 파일로",
    ],
    fr: [
      "Compatible avec 15+ moteurs de traduction (Google, DeepSeek, DeepL, Azure, OpenAI, Qwen-MT)",
      "Ciblage précis via JSONPath",
      "Génération multilingue en lot (en.json, ja.json, ko.json, etc.)",
      "Renommage de clés pendant la traduction (mode mapping)",
      "Cache de traduction pour mises à jour incrémentales",
      "Mode fusion i18n combine toutes les langues en un fichier",
    ],
    de: [
      "Unterstützt 15+ Übersetzungs-Engines (Google, DeepSeek, DeepL, Azure, OpenAI, Qwen-MT)",
      "Präzises JSONPath-Matching",
      "Mehrsprachige Stapelerzeugung (en.json, ja.json, ko.json)",
      "Schlüsselumbenennung beim Übersetzen (Mapping-Modus)",
      "Übersetzungs-Cache für inkrementelle Updates",
      "i18n-Merge-Modus vereint alle Sprachen in einer Datei",
    ],
    es: [
      "Compatible con 15+ motores de traducción (Google, DeepSeek, DeepL, Azure, OpenAI, Qwen-MT)",
      "Coincidencia precisa con JSONPath",
      "Generación multilingüe por lotes (en.json, ja.json, ko.json)",
      "Renombrado de claves durante traducción",
      "Caché de traducción para actualizaciones incrementales",
      "Modo fusión i18n combina todos los idiomas en un archivo",
    ],
    pt: [
      "Compatível com 15+ motores de tradução (Google, DeepSeek, DeepL, Azure, OpenAI, Qwen-MT)",
      "Correspondência precisa com JSONPath",
      "Geração multilíngue em lote (en.json, ja.json, ko.json)",
      "Renomeação de chaves durante tradução",
      "Cache de tradução para atualizações incrementais",
      "Modo mesclagem i18n combina todos os idiomas em um arquivo",
    ],
    ru: [
      "15+ движков перевода (Google, DeepSeek, DeepL, Azure, OpenAI)",
      "Точный JSONPath-матчинг",
      "Пакетная генерация для нескольких языков",
      "Переименование ключей при переводе",
      "Кеш перевода для инкрементных обновлений",
    ],
    ar: [
      "أكثر من 15 محرك ترجمة (Google، DeepSeek، DeepL، Azure، OpenAI)",
      "مطابقة JSONPath دقيقة",
      "توليد دفعي متعدد اللغات",
      "إعادة تسمية المفاتيح أثناء الترجمة",
      "ذاكرة تخزين للتحديثات التراكمية",
    ],
    hi: [
      "15+ अनुवाद इंजन (Google, DeepSeek, DeepL, Azure, OpenAI)",
      "JSONPath मिलान",
      "बहुभाषी बैच जनरेशन",
      "अनुवाद के दौरान कुंजी नामकरण",
      "वृद्धिशील अपडेट के लिए कैश",
    ],
    vi: [
      "Hỗ trợ 15+ engine dịch (Google, DeepSeek, DeepL, Azure, OpenAI)",
      "Khớp JSONPath chính xác",
      "Tạo hàng loạt đa ngôn ngữ",
      "Đổi tên khóa khi dịch",
      "Bộ nhớ đệm cho cập nhật gia tăng",
    ],
    th: [
      "รองรับเอนจินมากกว่า 15 รายการ (Google, DeepSeek, DeepL, Azure, OpenAI)",
      "การจับคู่ JSONPath ที่แม่นยำ",
      "การสร้างหลายภาษาเป็นชุด",
      "เปลี่ยนชื่อคีย์ขณะแปล",
      "แคชการแปลสำหรับอัปเดต",
    ],
    tr: [
      "15+ çeviri motoru desteği (Google, DeepSeek, DeepL, Azure, OpenAI)",
      "Hassas JSONPath eşleştirme",
      "Çoklu dil toplu üretim",
      "Çeviri sırasında anahtar yeniden adlandırma",
      "Artımlı güncellemeler için önbellek",
    ],
    bn: [
      "15+ অনুবাদ ইঞ্জিন সমর্থন (Google, DeepSeek, DeepL, Azure, OpenAI)",
      "সঠিক JSONPath মিল",
      "বহুভাষিক ব্যাচ তৈরি",
      "অনুবাদের সময় কী নামকরণ",
      "ইনক্রিমেন্টাল আপডেটের জন্য ক্যাশ",
    ],
    id: [
      "Mendukung 15+ mesin terjemahan (Google, DeepSeek, DeepL, Azure, OpenAI)",
      "Pencocokan JSONPath yang tepat",
      "Generasi batch multi-bahasa",
      "Penggantian nama kunci saat terjemahan",
      "Cache terjemahan untuk pembaruan inkremental",
    ],
    it: [
      "Supporta 15+ motori di traduzione (Google, DeepSeek, DeepL, Azure, OpenAI)",
      "Corrispondenza JSONPath precisa",
      "Generazione multilingue in batch",
      "Rinomina chiavi durante traduzione",
      "Cache traduzione per aggiornamenti incrementali",
    ],
      zh: [
      "支持 15+ 翻译引擎（Google、DeepSeek、DeepL、Azure、OpenAI、Qwen-MT）",
      "JSONPath 精准键名匹配",
      "多语言一次生成（en.json、ja.json、ko.json 等）",
      "翻译时键名重命名（映射模式）",
      "增量更新的翻译缓存",
      "i18n 合并模式将所有语言合并为一个文件",
    ],
  },
  "subtitle-translator": {
    zh: [
      "支持 SRT、ASS、VTT、LRC 四种字幕格式，ASS 位置标签（\\\\an8 等）翻译后保留",
      "时间轴零修改（仅翻译文本，时间码原样保留）",
      "UTF-8/UTF-16/GBK 编码自动检测",
      "双语字幕译文位置可选（上方学习 / 下方观看）",
      "15+ 翻译引擎：Google 免费、DeepSeek、DeepL、OpenAI",
      "兼容 B 站、YouTube、Premiere、DaVinci Resolve、Aegisub",
    ],
    en: [
      "Supports SRT, ASS, VTT, LRC subtitle formats, preserving ASS position tags (\\\\an8 etc.) after translation",
      "Timecodes untouched — tool only translates text, original timing preserved",
      "UTF-8/UTF-16/GBK encoding auto-detection",
      "Bilingual subtitle position: above (learning) or below (viewing)",
      "15+ translation engines: Google free, DeepSeek, DeepL, OpenAI",
      "Compatible with Bilibili, YouTube, Premiere, DaVinci Resolve, Aegisub",
    ],
    ja: [
      "SRT、ASS、VTT、LRC 4 形式対応、ASS 位置タグ（\\\\an8 等）を翻訳後も保持",
      "タイムコード無変更 — テキストのみ翻訳、元の時間情報を完全保持",
      "UTF-8/UTF-16/Shift-JIS 自動エンコード検出",
      "バイリンガル訳文位置：上（学習）または下（視聴）",
      "15+ 翻訳エンジン：Google 無料、DeepSeek、DeepL、OpenAI",
      "ニコニコ、YouTube、Premiere、DaVinci Resolve、Aegisub 互換",
    ],
    ko: [
      "SRT, ASS, VTT, LRC 자막 형식 지원, ASS 위치 태그(\\\\an8 등) 번역 후 유지",
      "타임코드 보존 — 텍스트만 번역, 원본 타이밍 유지",
      "UTF-8/UTF-16/EUC-KR 인코딩 자동 감지",
      "이중 언어 번역 위치: 위(학습) 또는 아래(시청)",
      "15+ 번역 엔진: Google 무료, DeepSeek, DeepL, OpenAI",
      "YouTube, Premiere, DaVinci Resolve, Aegisub 호환",
    ],
    fr: [
      "Supporte SRT, ASS, VTT, LRC, balises de position ASS (\\\\an8, etc.) préservées",
      "Timecodes intouchés — seul le texte est traduit, timing original préservé",
      "Détection automatique d'encodage UTF-8/UTF-16/GBK",
      "Position des sous-titres bilingues : au-dessus (apprentissage) ou en-dessous (visionnage)",
      "15+ moteurs de traduction : Google gratuit, DeepSeek, DeepL, OpenAI",
      "Compatible avec YouTube, Premiere, DaVinci Resolve, Aegisub",
    ],
    de: [
      "Unterstützt SRT, ASS, VTT, LRC, ASS-Positions-Tags (\\\\an8 etc.) werden beibehalten",
      "Timecodes unverändert — nur Text wird übersetzt, Original-Timing erhalten",
      "Automatische UTF-8/UTF-16/GBK-Kodierungserkennung",
      "Zweisprachige Untertitelposition: oben (Lernen) oder unten (Anschauen)",
      "15+ Übersetzungs-Engines: Google kostenlos, DeepSeek, DeepL, OpenAI",
      "Kompatibel mit YouTube, Premiere, DaVinci Resolve, Aegisub",
    ],
    es: [
      "Compatible con SRT, ASS, VTT, LRC, etiquetas de posición ASS (\\\\an8 etc.) preservadas",
      "Timecodes intactos — solo se traduce el texto, timing original preservado",
      "Detección automática de codificación UTF-8/UTF-16/GBK",
      "Posición subtítulos bilingües: arriba (aprendizaje) o abajo (visualización)",
      "15+ motores de traducción: Google gratis, DeepSeek, DeepL, OpenAI",
      "Compatible con YouTube, Premiere, DaVinci Resolve, Aegisub",
    ],
    pt: [
      "Compatível com SRT, ASS, VTT, LRC, tags de posição ASS (\\\\an8 etc.) preservadas",
      "Timecodes intactos — apenas o texto é traduzido, timing original preservado",
      "Detecção automática de codificação UTF-8/UTF-16/GBK",
      "Posição de legenda bilíngue: acima (aprendizado) ou abaixo (visualização)",
      "15+ motores de tradução: Google grátis, DeepSeek, DeepL, OpenAI",
      "Compatível com YouTube, Premiere, DaVinci Resolve, Aegisub",
    ],
    ru: [
      "Поддерживает SRT, ASS, VTT, LRC, теги позиции ASS (\\\\an8 и др.) сохраняются",
      "Тайм-коды не изменяются — переводится только текст, оригинальный тайминг сохраняется",
      "Автоопределение кодировки UTF-8/UTF-16/GBK",
      "Положение двуязычных субтитров: сверху (изучение) или снизу (просмотр)",
      "15+ движков перевода: Google бесплатный, DeepSeek, DeepL, OpenAI",
      "Совместимо с YouTube, Premiere, DaVinci Resolve, Aegisub",
    ],
    ar: [
      "يدعم SRT و ASS و VTT و LRC، علامات موقع ASS (\\\\an8 إلخ) محفوظة",
      "رموز الوقت لا تتغير — يُترجم النص فقط، مع الحفاظ على التوقيت الأصلي",
      "كشف الترميز التلقائي UTF-8/UTF-16/GBK",
      "موضع الترجمة الثنائية: فوق (التعلم) أو تحت (المشاهدة)",
      "أكثر من 15 محرك ترجمة: Google مجاني، DeepSeek، DeepL، OpenAI",
      "متوافق مع YouTube، Premiere، DaVinci Resolve، Aegisub",
    ],
    hi: [
      "SRT, ASS, VTT, LRC का समर्थन, ASS स्थिति टैग (\\\\an8 आदि) संरक्षित",
      "टाइमकोड अछूते — केवल टेक्स्ट का अनुवाद, मूल समय संरक्षित",
      "UTF-8/UTF-16/GBK एन्कोडिंग स्वतः पहचान",
      "द्विभाषी सबटाइटल स्थिति: ऊपर (सीखना) या नीचे (देखना)",
      "15+ अनुवाद इंजन: Google मुफ्त, DeepSeek, DeepL, OpenAI",
      "YouTube, Premiere, DaVinci Resolve, Aegisub के साथ संगत",
    ],
    vi: [
      "Hỗ trợ SRT, ASS, VTT, LRC, thẻ vị trí ASS (\\\\an8 v.v.) được bảo toàn",
      "Timecode không đổi — chỉ dịch văn bản, thời gian gốc được bảo toàn",
      "Tự phát hiện mã hóa UTF-8/UTF-16/GBK",
      "Vị trí phụ đề song ngữ: trên (học) hoặc dưới (xem)",
      "15+ engine dịch: Google miễn phí, DeepSeek, DeepL, OpenAI",
      "Tương thích với YouTube, Premiere, DaVinci Resolve, Aegisub",
    ],
    th: [
      "รองรับ SRT, ASS, VTT, LRC แท็กตำแหน่ง ASS (\\\\an8 ฯลฯ) คงไว้",
      "ไทม์โค้ดไม่เปลี่ยน — แปลเฉพาะข้อความ เวลาเดิมคงอยู่",
      "ตรวจจับการเข้ารหัส UTF-8/UTF-16/GBK อัตโนมัติ",
      "ตำแหน่งซับสองภาษา: ด้านบน (เรียน) หรือด้านล่าง (ดู)",
      "15+ เอนจินแปล: Google ฟรี, DeepSeek, DeepL, OpenAI",
      "ใช้งานร่วมกับ YouTube, Premiere, DaVinci Resolve, Aegisub",
    ],
    tr: [
      "SRT, ASS, VTT, LRC desteği, ASS konum etiketleri (\\\\an8 vb.) korunur",
      "Zaman kodları değiştirilmez — sadece metin çevrilir, orijinal zamanlama korunur",
      "UTF-8/UTF-16/GBK kodlama otomatik algılama",
      "İki dilli altyazı konumu: üst (öğrenme) veya alt (izleme)",
      "15+ çeviri motoru: Google ücretsiz, DeepSeek, DeepL, OpenAI",
      "YouTube, Premiere, DaVinci Resolve, Aegisub ile uyumlu",
    ],
    bn: [
      "SRT, ASS, VTT, LRC সমর্থন, ASS অবস্থান ট্যাগ (\\\\an8 ইত্যাদি) সংরক্ষিত",
      "টাইমকোড অপরিবর্তিত — শুধু টেক্সট অনুবাদ, মূল সময় সংরক্ষিত",
      "UTF-8/UTF-16/GBK এনকোডিং স্বয়ংক্রিয় শনাক্তকরণ",
      "দ্বিভাষিক সাবটাইটেল অবস্থান: উপরে (শেখা) বা নীচে (দেখা)",
      "15+ অনুবাদ ইঞ্জিন: Google ফ্রি, DeepSeek, DeepL, OpenAI",
      "YouTube, Premiere, DaVinci Resolve, Aegisub-এর সাথে সামঞ্জস্যপূর্ণ",
    ],
    id: [
      "Mendukung SRT, ASS, VTT, LRC, tag posisi ASS (\\\\an8 dll.) dipertahankan",
      "Timecode tidak diubah — hanya teks diterjemahkan, waktu asli dipertahankan",
      "Deteksi pengkodean otomatis UTF-8/UTF-16/GBK",
      "Posisi subtitle dwibahasa: atas (belajar) atau bawah (menonton)",
      "15+ mesin terjemahan: Google gratis, DeepSeek, DeepL, OpenAI",
      "Kompatibel dengan YouTube, Premiere, DaVinci Resolve, Aegisub",
    ],
    it: [
      "Supporta SRT, ASS, VTT, LRC, tag di posizione ASS (\\\\an8 ecc.) preservati",
      "Timecode intatti — solo il testo viene tradotto, timing originale preservato",
      "Rilevamento automatico codifica UTF-8/UTF-16/GBK",
      "Posizione sottotitoli bilingue: sopra (apprendimento) o sotto (visualizzazione)",
      "15+ motori di traduzione: Google gratuito, DeepSeek, DeepL, OpenAI",
      "Compatibile con YouTube, Premiere, DaVinci Resolve, Aegisub",
    ],
  },
  "md-translator": {
    en: [
    "Preserves code blocks, LaTeX formulas, and links during translation",
    "Optional Front Matter metadata translation",
    "Batch Markdown file upload and translation",
    "Compatible with Hugo, Jekyll, Hexo blog frameworks",
    "Raw mode ignores Markdown formatting for plain translation",
  ],
    ja: [
      "コードブロック、LaTeX 数式、リンクを翻訳時に保持",
      "Front Matter メタデータ翻訳オプション",
      "複数 Markdown ファイル一括アップロード",
      "Hugo、Jekyll、Hexo ブログフレームワーク対応",
      "Markdown 書式を無視する Raw モード",
    ],
    ko: [
      "번역 시 코드 블록, LaTeX 수식, 링크 보존",
      "선택적 Front Matter 메타데이터 번역",
      "여러 Markdown 파일 일괄 업로드",
      "Hugo, Jekyll, Hexo 블로그 프레임워크 호환",
      "Markdown 서식을 무시하는 Raw 모드",
    ],
    fr: [
      "Préservation des blocs de code, formules LaTeX et liens",
      "Traduction optionnelle du Front Matter",
      "Téléversement groupé de fichiers Markdown",
      "Compatible avec Hugo, Jekyll, Hexo",
      "Mode brut pour traduction sans format",
    ],
    de: [
      "Erhalt von Codeblöcken, LaTeX-Formeln, Links",
      "Optionale Front-Matter-Übersetzung",
      "Stapel-Upload mehrerer Markdown-Dateien",
      "Kompatibel mit Hugo, Jekyll, Hexo",
      "Raw-Modus für Übersetzung ohne Formatierung",
    ],
    es: [
      "Preservación de bloques de código, fórmulas LaTeX, enlaces",
      "Traducción opcional de Front Matter",
      "Carga por lotes de archivos Markdown",
      "Compatible con Hugo, Jekyll, Hexo",
      "Modo sin formato para traducción directa",
    ],
    pt: [
      "Preservação de blocos de código, fórmulas LaTeX, links",
      "Tradução opcional de Front Matter",
      "Upload em lote de arquivos Markdown",
      "Compatível com Hugo, Jekyll, Hexo",
      "Modo bruto para tradução sem formato",
    ],
    ru: [
      "Сохранение кода, LaTeX, ссылок",
      "Опциональный перевод Front Matter",
      "Пакетная загрузка Markdown",
      "Совместимость с Hugo, Jekyll, Hexo",
      "Режим без форматирования",
    ],
    ar: [
      "حفظ كتل الكود وصيغ LaTeX والروابط",
      "ترجمة اختيارية لـ Front Matter",
      "رفع دفعي لملفات Markdown",
      "متوافق مع Hugo، Jekyll، Hexo",
      "وضع بدون تنسيق",
    ],
    hi: [
      "कोड ब्लॉक, LaTeX, लिंक संरक्षण",
      "वैकल्पिक Front Matter अनुवाद",
      "बैच Markdown अपलोड",
      "Hugo, Jekyll, Hexo संगत",
      "प्रारूप रहित मोड",
    ],
    vi: [
      "Bảo toàn khối mã, LaTeX, liên kết",
      "Dịch Front Matter tùy chọn",
      "Tải lên hàng loạt Markdown",
      "Tương thích Hugo, Jekyll, Hexo",
      "Chế độ không định dạng",
    ],
    th: [
      "รักษาบล็อกโค้ด LaTeX ลิงก์",
      "แปล Front Matter ตัวเลือก",
      "อัปโหลด Markdown เป็นชุด",
      "เข้ากับ Hugo, Jekyll, Hexo",
      "โหมดไม่มีรูปแบบ",
    ],
    tr: [
      "Kod bloğu, LaTeX, link koruması",
      "İsteğe bağlı Front Matter çevirisi",
      "Toplu Markdown yükleme",
      "Hugo, Jekyll, Hexo uyumlu",
      "Biçimsiz mod",
    ],
    bn: [
      "কোড ব্লক, LaTeX, লিঙ্ক সংরক্ষণ",
      "ঐচ্ছিক Front Matter অনুবাদ",
      "ব্যাচ Markdown আপলোড",
      "Hugo, Jekyll, Hexo সামঞ্জস্যপূর্ণ",
      "ফরম্যাট ছাড়া মোড",
    ],
    id: [
      "Preservasi blok kode, LaTeX, link",
      "Terjemahan Front Matter opsional",
      "Unggah batch Markdown",
      "Kompatibel Hugo, Jekyll, Hexo",
      "Mode tanpa format",
    ],
    it: [
      "Conservazione blocchi codice, LaTeX, link",
      "Traduzione Front Matter opzionale",
      "Caricamento batch Markdown",
      "Compatibile Hugo, Jekyll, Hexo",
      "Modalità senza formato",
    ],
      zh: [
      "翻译时保留代码块、LaTeX 公式和链接",
      "可选翻译 Front Matter 元数据",
      "批量上传 Markdown 文件翻译",
      "兼容 Hugo、Jekyll、Hexo 博客框架",
      "Raw 模式忽略 Markdown 格式",
    ],
  },
  "text-splitter": {
    zh: [
      "AI 模型上下文限制：ChatGPT GPT-4o 128K tokens、Claude 3.5/3.7 Sonnet 200K、Gemini 1.5/2.0 Pro 100 万、DeepSeek V3 128K",
      "社交平台字数模板：Twitter 280、微博 140、小红书 1000、Threads 500",
      "中英混排智能识别中文（。！？）和英文（. ! ?）句末标点",
      "非 UTF-8 文件自动识别（GBK、Shift-JIS、EUC-KR）避免乱码",
      "自定义分隔符支持 \\\\n\\\\n、\\\\t 等转义字符",
      "批量导出带 1/N、2/N 编号，方便顺序发布",
    ],
    en: [
      "AI model context limits: ChatGPT GPT-4o 128K tokens, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "Social platform templates: Twitter 280, Weibo 140, Xiaohongshu 1000, Threads 500",
      "Smart punctuation detection for mixed CJK (。！？) and Latin (. ! ?) text",
      "Non-UTF-8 auto-detection (GBK, Shift-JIS, EUC-KR) prevents garbled output",
      "Custom delimiter with \\\\n\\\\n, \\\\t escape character support",
      "Batch export numbered 1/N, 2/N for sequential posting",
    ],
    ja: [
      "AI モデルコンテキスト制限：ChatGPT GPT-4o 128K tokens、Claude 3.5/3.7 Sonnet 20 万、Gemini 1.5/2.0 Pro 100 万、DeepSeek V3 128K",
      "SNS プラットフォーム文字数テンプレート：X 280、Threads 500、微博 140、Bluesky 300",
      "中英混在文の中国語（。！？）と英語（. ! ?）句読点自動認識",
      "非 UTF-8 ファイル自動検出（GBK、Shift-JIS、EUC-KR）で文字化け防止",
      "カスタム区切り文字：\\\\n\\\\n、\\\\t などエスケープ対応",
      "1/N、2/N 番号付きバッチ出力で順次投稿に便利",
    ],
    ko: [
      "AI 모델 컨텍스트 제한: ChatGPT GPT-4o 128K 토큰, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 100만, DeepSeek V3 128K",
      "소셜 플랫폼 글자 템플릿: X 280, Threads 500, 네이버 블로그 100만, 카카오스토리 3000",
      "한중영 혼합 문장 부호 자동 인식 (。！？ 및 . ! ?)",
      "비 UTF-8 파일 자동 감지 (GBK, Shift-JIS, EUC-KR)로 깨짐 방지",
      "사용자 정의 구분자: \\\\n\\\\n, \\\\t 이스케이프 문자 지원",
      "1/N, 2/N 번호 일괄 내보내기로 순차 게시 편리",
    ],
    fr: [
      "Limites de contexte des modèles IA : ChatGPT GPT-4o 128K tokens, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "Modèles de plateformes sociales : Twitter 280, Threads 500, Mastodon 500, LinkedIn 3000",
      "Détection intelligente de la ponctuation mixte CJK (。！？) et latine (. ! ?)",
      "Détection auto non-UTF-8 (GBK, Shift-JIS, EUC-KR) évite les caractères illisibles",
      "Séparateurs personnalisés avec échappement \\\\n\\\\n, \\\\t",
      "Export batch numéroté 1/N, 2/N pour publication séquentielle",
    ],
    de: [
      "KI-Modell-Kontextlimits: ChatGPT GPT-4o 128K Tokens, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "Social-Media-Vorlagen: Twitter 280, Threads 500, Mastodon 500, LinkedIn 3000",
      "Intelligente Satzzeichenerkennung für gemischten CJK- (。！？) und Latin-Text (. ! ?)",
      "Nicht-UTF-8-Auto-Erkennung (GBK, Shift-JIS, EUC-KR) verhindert Zeichensalat",
      "Benutzerdefinierte Trenner mit \\\\n\\\\n, \\\\t Escape-Zeichen",
      "Batch-Export nummeriert 1/N, 2/N für sequenzielles Posten",
    ],
    es: [
      "Límites de contexto de modelos IA: ChatGPT GPT-4o 128K tokens, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "Plantillas de plataformas sociales: Twitter 280, Threads 500, Mastodon 500, LinkedIn 3000",
      "Detección inteligente de puntuación mixta CJK (。！？) y latina (. ! ?)",
      "Auto-detección no-UTF-8 (GBK, Shift-JIS, EUC-KR) evita caracteres ilegibles",
      "Delimitadores personalizados con caracteres de escape \\\\n\\\\n, \\\\t",
      "Exportación por lotes numerada 1/N, 2/N para publicación secuencial",
    ],
    pt: [
      "Limites de contexto de modelos IA: ChatGPT GPT-4o 128K tokens, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "Templates de plataformas sociais: Twitter 280, Threads 500, Mastodon 500, LinkedIn 3000",
      "Detecção inteligente de pontuação mista CJK (。！？) e latina (. ! ?)",
      "Detecção automática não-UTF-8 (GBK, Shift-JIS, EUC-KR) previne caracteres ilegíveis",
      "Delimitadores personalizados com caracteres de escape \\\\n\\\\n, \\\\t",
      "Exportação em lote numerada 1/N, 2/N para postagem sequencial",
    ],
    ru: [
      "Лимиты контекста моделей ИИ: ChatGPT GPT-4o 128K токенов, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "Шаблоны соцсетей: Twitter 280, Threads 500, VK 4000, LinkedIn 3000",
      "Умное определение знаков препинания для смешанного CJK (。！？) и латинского (. ! ?) текста",
      "Автоопределение не-UTF-8 (GBK, Shift-JIS, EUC-KR) предотвращает нечитаемые символы",
      "Кастомные разделители с \\\\n\\\\n, \\\\t escape-символами",
      "Пакетный экспорт с нумерацией 1/N, 2/N для последовательной публикации",
    ],
    ar: [
      "حدود سياق نماذج AI: ChatGPT GPT-4o 128K رمز، Claude 3.5/3.7 Sonnet 200K، Gemini 1.5/2.0 Pro مليون، DeepSeek V3 128K",
      "قوالب المنصات الاجتماعية: Twitter 280، Threads 500، Mastodon 500، LinkedIn 3000",
      "كشف ذكي لعلامات الترقيم المختلطة CJK (。！？) واللاتينية (. ! ?)",
      "كشف تلقائي غير UTF-8 (GBK، Shift-JIS، EUC-KR) يمنع الأحرف غير المقروءة",
      "فواصل مخصصة مع دعم أحرف الهروب \\\\n\\\\n، \\\\t",
      "تصدير دفعي مرقم 1/N، 2/N للنشر المتسلسل",
    ],
    hi: [
      "AI मॉडल संदर्भ सीमा: ChatGPT GPT-4o 128K टोकन, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "सोशल प्लेटफॉर्म टेम्पलेट: Twitter 280, Threads 500, WhatsApp Status 700, LinkedIn 3000",
      "मिश्रित CJK (。！？) और लैटिन (. ! ?) पाठ के लिए स्मार्ट विराम चिह्न पहचान",
      "गैर-UTF-8 स्वतः पहचान (GBK, Shift-JIS, EUC-KR) अजीब अक्षरों को रोकती है",
      "\\\\n\\\\n, \\\\t एस्केप कैरेक्टर समर्थन के साथ कस्टम विभाजक",
      "क्रमिक पोस्टिंग के लिए 1/N, 2/N नंबर बैच निर्यात",
    ],
    vi: [
      "Giới hạn ngữ cảnh mô hình AI: ChatGPT GPT-4o 128K token, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "Mẫu nền tảng xã hội: Twitter 280, Threads 500, Mastodon 500, LinkedIn 3000",
      "Phát hiện dấu câu thông minh cho văn bản CJK hỗn hợp (。！？) và Latin (. ! ?)",
      "Tự phát hiện không phải UTF-8 (GBK, Shift-JIS, EUC-KR) ngăn ký tự lỗi",
      "Dấu phân cách tùy chỉnh với hỗ trợ ký tự thoát \\\\n\\\\n, \\\\t",
      "Xuất hàng loạt đánh số 1/N, 2/N cho đăng tuần tự",
    ],
    th: [
      "ขีดจำกัดบริบท AI: ChatGPT GPT-4o 128K โทเคน, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "เทมเพลตแพลตฟอร์มโซเชียล: Twitter 280, Threads 500, Mastodon 500, LinkedIn 3000",
      "ตรวจจับเครื่องหมายวรรคตอนอัจฉริยะสำหรับข้อความผสม CJK (。！？) และละติน (. ! ?)",
      "ตรวจจับไม่ใช่ UTF-8 อัตโนมัติ (GBK, Shift-JIS, EUC-KR) ป้องกันอักษรเพี้ยน",
      "ตัวคั่นกำหนดเองรองรับ \\\\n\\\\n, \\\\t escape character",
      "ส่งออกเป็นชุดเลขที่ 1/N, 2/N สำหรับโพสต์ต่อเนื่อง",
    ],
    tr: [
      "AI model bağlam limitleri: ChatGPT GPT-4o 128K token, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "Sosyal platform şablonları: Twitter 280, Threads 500, Mastodon 500, LinkedIn 3000",
      "Karışık CJK (。！？) ve Latin (. ! ?) metinler için akıllı noktalama algılama",
      "UTF-8 olmayan otomatik algılama (GBK, Shift-JIS, EUC-KR) bozuk karakterleri önler",
      "\\\\n\\\\n, \\\\t kaçış karakter desteği ile özel ayırıcılar",
      "Sıralı paylaşım için 1/N, 2/N numaralı toplu dışa aktarım",
    ],
    bn: [
      "AI মডেল কনটেক্সট সীমা: ChatGPT GPT-4o 128K টোকেন, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "সোশ্যাল প্ল্যাটফর্ম টেমপ্লেট: Twitter 280, Threads 500, WhatsApp Status 700, LinkedIn 3000",
      "মিশ্র CJK (。！？) এবং ল্যাটিন (. ! ?) টেক্সটের জন্য স্মার্ট বিরাম চিহ্ন শনাক্তকরণ",
      "নন-UTF-8 স্বয়ংক্রিয় শনাক্তকরণ (GBK, Shift-JIS, EUC-KR) অক্ষর বিকৃতি প্রতিরোধ করে",
      "\\\\n\\\\n, \\\\t এস্কেপ ক্যারেক্টার সমর্থন সহ কাস্টম বিভাজক",
      "ক্রমিক পোস্টিংয়ের জন্য 1/N, 2/N নম্বর ব্যাচ রপ্তানি",
    ],
    id: [
      "Batas konteks model AI: ChatGPT GPT-4o 128K token, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "Template platform sosial: Twitter 280, Threads 500, Mastodon 500, LinkedIn 3000",
      "Deteksi tanda baca cerdas untuk teks CJK campuran (。！？) dan Latin (. ! ?)",
      "Deteksi otomatis non-UTF-8 (GBK, Shift-JIS, EUC-KR) mencegah karakter rusak",
      "Pemisah khusus dengan dukungan karakter escape \\\\n\\\\n, \\\\t",
      "Ekspor batch bernomor 1/N, 2/N untuk posting berurutan",
    ],
    it: [
      "Limiti di contesto modelli IA: ChatGPT GPT-4o 128K token, Claude 3.5/3.7 Sonnet 200K, Gemini 1.5/2.0 Pro 1M, DeepSeek V3 128K",
      "Modelli piattaforme social: Twitter 280, Threads 500, Mastodon 500, LinkedIn 3000",
      "Rilevamento punteggiatura intelligente per testo CJK misto (。！？) e Latino (. ! ?)",
      "Rilevamento automatico non UTF-8 (GBK, Shift-JIS, EUC-KR) previene caratteri illeggibili",
      "Delimitatori personalizzati con supporto caratteri di escape \\\\n\\\\n, \\\\t",
      "Esportazione batch numerata 1/N, 2/N per pubblicazione sequenziale",
    ],
  },
  "json-value-extractor": {
    en: [
    "Recursive field name search (supports nested keys via dot notation like 'user.name')",
    "Multi-field extraction in one pass",
    "Custom prefix and suffix formatting",
    "Dot-path notation (user.name) for nested fields",
    "Automatic deduplication of extracted values",
  ],
    ja: [
      "フィールド名の再帰検索、ネストキーの点記法サポート（'user.name' など）",
      "一回の操作で複数フィールド抽出",
      "カスタム接頭辞と接尾辞フォーマット",
      "ネストフィールド用のドットパス記法",
      "抽出値の自動重複排除",
    ],
    ko: [
      "필드 이름 재귀 검색, 중첩 키의 점 표기법 지원('user.name' 등)",
      "한 번에 여러 필드 추출",
      "사용자 정의 접두사 및 접미사 형식화",
      "중첩 필드용 점 경로 표기법",
      "추출 값의 자동 중복 제거",
    ],
    fr: [
      "Recherche récursive par nom de champ, support de la notation point pour clés imbriquées ('user.name')",
      "Extraction multi-champs en une passe",
      "Formatage préfixe/suffixe personnalisé",
      "Notation point (user.name) pour champs imbriqués",
      "Déduplication automatique des valeurs extraites",
    ],
    de: [
      "Rekursive Feldnamen-Suche, Punktnotation für verschachtelte Schlüssel ('user.name')",
      "Multi-Feld-Extraktion in einem Durchlauf",
      "Benutzerdefinierte Präfix/Suffix-Formatierung",
      "Punktnotation für verschachtelte Felder",
      "Automatische Deduplizierung",
    ],
    es: [
      "Búsqueda recursiva por nombre de campo, notación de punto para claves anidadas ('user.name')",
      "Extracción multi-campo en una pasada",
      "Formato prefijo/sufijo personalizado",
      "Notación de punto para campos anidados",
      "Deduplicación automática",
    ],
    pt: [
      "Busca recursiva por nome de campo, notação de ponto para chaves aninhadas ('user.name')",
      "Extração multi-campo em uma passagem",
      "Formato prefixo/sufixo personalizado",
      "Notação de ponto para campos aninhados",
      "Deduplicação automática",
    ],
    ru: [
      "Рекурсивный поиск по именам полей, точечная нотация для вложенных ключей ('user.name')",
      "Многопольное извлечение",
      "Префикс/суффикс",
      "Точечная нотация",
      "Автодедупликация",
    ],
    ar: [
      "بحث تكراري بأسماء الحقول، تدوين النقطة للمفاتيح المتداخلة ('user.name')",
      "استخراج متعدد الحقول",
      "بادئة/لاحقة مخصصة",
      "تدوين النقطة",
      "إزالة تكرار تلقائية",
    ],
    hi: [
      "फ़ील्ड नाम पुनरावर्ती खोज, नेस्टेड कुंजियों के लिए बिंदु नोटेशन ('user.name')",
      "बहु-फील्ड निष्कर्षण",
      "प्रीफिक्स/सफिक्स",
      "डॉट संकेतन",
      "स्वचालित डिडुप्लिकेशन",
    ],
    vi: [
      "Tìm kiếm đệ quy theo tên trường, ký pháp dấu chấm cho khóa lồng ('user.name')",
      "Trích xuất đa trường",
      "Tiền tố/hậu tố tùy chỉnh",
      "Ký pháp dấu chấm",
      "Tự loại trùng",
    ],
    th: [
      "ค้นหาชื่อฟิลด์แบบเรียกซ้ำ สัญกรณ์จุดสำหรับคีย์ซ้อน ('user.name')",
      "สกัดหลายฟิลด์",
      "คำนำหน้า/ต่อท้าย",
      "สัญกรณ์จุด",
      "ลบซ้ำอัตโนมัติ",
    ],
    tr: [
      "Alan adı özyinelemeli arama, iç içe anahtarlar için nokta gösterimi ('user.name')",
      "Çoklu alan çıkarma",
      "Özel önek/sonek",
      "Nokta gösterimi",
      "Otomatik tekilleştirme",
    ],
    bn: [
      "ফিল্ড নাম পুনরাবৃত্ত অনুসন্ধান, নেস্টেড কীগুলির জন্য ডট নোটেশন ('user.name')",
      "বহু-ক্ষেত্র নিষ্কাশন",
      "কাস্টম প্রিফিক্স/সাফিক্স",
      "ডট নোটেশন",
      "স্বয়ংক্রিয় ডিডুপ্লিকেশন",
    ],
    id: [
      "Pencarian rekursif nama field, notasi titik untuk kunci bersarang ('user.name')",
      "Ekstraksi multi-bidang",
      "Awalan/akhiran kustom",
      "Notasi titik",
      "Deduplikasi otomatis",
    ],
    it: [
      "Ricerca ricorsiva per nome di campo, notazione a punti per chiavi annidate ('user.name')",
      "Estrazione multi-campo",
      "Prefissi/suffissi personalizzati",
      "Notazione punto",
      "Deduplicazione automatica",
    ],
      zh: [
      "字段名递归匹配，支持嵌套键的点路径表示法（如 'user.name'）",
      "一次操作提取多字段",
      "自定义前缀后缀格式化",
      "嵌套字段的点路径表示法",
      "自动去重提取值",
    ],
  },
  "json-node-edit": {
    en: [
    "Batch prefix and suffix addition",
    "Find and replace on node values",
    "Full value replacement",
    "Capitalize first letter",
    "Multi-language variable replacement (zh → Chinese)",
    "Multi-field targeting via comma-separated names (supports nested dot paths)",
  ],
    ja: [
      "接頭辞と接尾辞の一括追加",
      "ノード値の検索置換",
      "値の完全置換",
      "先頭文字の大文字化",
      "多言語変数置換（zh → 中国語）",
      "カンマ区切りフィールド名による複数ターゲティング（ネスト点記法対応）",
    ],
    ko: [
      "접두사 및 접미사 일괄 추가",
      "노드 값에 대한 찾기 및 바꾸기",
      "전체 값 바꾸기",
      "첫 글자 대문자화",
      "다국어 변수 바꾸기 (zh → 한국어)",
      "쉼표로 구분된 필드 이름을 통한 다중 타겟팅(중첩 점 표기법 지원)",
    ],
    fr: [
      "Ajout groupé de préfixes et suffixes",
      "Rechercher-remplacer sur valeurs de nœuds",
      "Remplacement complet de valeur",
      "Mise en majuscule",
      "Remplacement de variables multilingues (zh → Français)",
      "Ciblage multi-champs via noms séparés par virgules (support notation point imbriquée)",
    ],
    de: [
      "Stapel-Präfix und Suffix hinzufügen",
      "Suchen-Ersetzen auf Knotenwerten",
      "Vollständige Wertersetzung",
      "Großschreibung des ersten Buchstabens",
      "Mehrsprachen-Variablen-Ersetzung",
      "Multi-Feld-Targeting via kommagetrennten Namen (unterstützt verschachtelte Punktnotation)",
    ],
    es: [
      "Adición por lotes de prefijos y sufijos",
      "Buscar-reemplazar en valores de nodos",
      "Reemplazo completo de valor",
      "Capitalización primera letra",
      "Reemplazo de variables multiidioma",
      "Multi-campo con nombres separados por comas (soporta notación de punto anidada)",
    ],
    pt: [
      "Adição em lote de prefixos e sufixos",
      "Buscar-substituir em valores",
      "Substituição completa",
      "Capitalização primeira letra",
      "Substituição de variáveis multilíngues",
      "Multi-campo via nomes separados por vírgulas (suporta notação de ponto aninhada)",
    ],
    ru: [
      "Пакетный префикс/суффикс",
      "Поиск-замена",
      "Полная замена",
      "Капитализация",
      "Многоязычная замена",
      "Мульти-поле через имена через запятую (поддержка вложенной точечной нотации)",
    ],
    ar: [
      "بادئة/لاحقة دفعية",
      "بحث واستبدال",
      "استبدال كامل",
      "حرف كبير",
      "استبدال متعدد اللغات",
      "تعدد الحقول عبر أسماء مفصولة بفواصل (يدعم تدوين النقطة المتداخل)",
    ],
    hi: [
      "बैच प्रीफिक्स/सफिक्स",
      "खोज-बदलें",
      "पूर्ण प्रतिस्थापन",
      "कैपिटलाइज़ेशन",
      "बहुभाषी प्रतिस्थापन",
      "कॉमा से अलग नामों के माध्यम से बहु-फ़ील्ड (नेस्टेड बिंदु नोटेशन समर्थित)",
    ],
    vi: [
      "Tiền tố/hậu tố hàng loạt",
      "Tìm-thay thế",
      "Thay thế hoàn toàn",
      "Viết hoa",
      "Thay thế đa ngôn ngữ",
      "Đa trường qua tên phân tách bằng dấu phẩy (hỗ trợ ký pháp dấu chấm lồng)",
    ],
    th: [
      "คำนำหน้า/ต่อท้ายเป็นชุด",
      "ค้นหา-แทนที่",
      "แทนที่ทั้งหมด",
      "ตัวพิมพ์ใหญ่",
      "แทนที่หลายภาษา",
      "หลายฟิลด์ผ่านชื่อคั่นด้วยจุลภาค (รองรับสัญกรณ์จุดซ้อน)",
    ],
    tr: [
      "Toplu önek/sonek",
      "Bul-değiştir",
      "Tam değiştirme",
      "Büyük harf",
      "Çok dilli değiştirme",
      "Virgülle ayrılmış adlarla çoklu alan (iç içe nokta gösterimi desteklenir)",
    ],
    bn: [
      "ব্যাচ প্রিফিক্স/সাফিক্স",
      "খোঁজ-প্রতিস্থাপন",
      "সম্পূর্ণ প্রতিস্থাপন",
      "ক্যাপিটালাইজেশন",
      "বহুভাষিক প্রতিস্থাপন",
      "কমা দ্বারা পৃথক নামের মাধ্যমে মাল্টি-ফিল্ড (নেস্টেড ডট নোটেশন সমর্থিত)",
    ],
    id: [
      "Awalan/akhiran batch",
      "Cari-ganti",
      "Penggantian penuh",
      "Kapitalisasi",
      "Penggantian multi-bahasa",
      "Multi-field melalui nama yang dipisahkan koma (mendukung notasi titik bersarang)",
    ],
    it: [
      "Prefissi/suffissi in batch",
      "Trova-sostituisci",
      "Sostituzione completa",
      "Capitalizzazione",
      "Sostituzione multilingua",
      "Multi-campo tramite nomi separati da virgole (supporta notazione a punti annidata)",
    ],
      zh: [
      "批量添加前缀和后缀",
      "节点值查找替换",
      "整值替换",
      "首字母大写转换",
      "多语言变量替换（zh → 中文）",
      "通过逗号分隔的字段名批量匹配（支持嵌套点路径）",
    ],
  },
  "json-value-transformer": {
    en: [
    "Preset templates (status codes, country codes, date formats)",
    "Custom key-value mapping rules",
    "Recursive field name matching for precise transformation",
    "Conditional transformation support",
    "Reusable rules across projects",
  ],
    ja: [
      "プリセットテンプレート（ステータスコード、国コード、日付形式）",
      "カスタムキー値マッピングルール",
      "精密変換のためのフィールド名再帰マッチング",
      "条件変換サポート",
      "プロジェクト間で再利用可能なルール",
    ],
    ko: [
      "프리셋 템플릿 (상태 코드, 국가 코드, 날짜 형식)",
      "사용자 정의 키-값 매핑 규칙",
      "정밀 변환을 위한 필드 이름 재귀 매칭",
      "조건부 변환 지원",
      "프로젝트 간 재사용 가능한 규칙",
    ],
    fr: [
      "Modèles prédéfinis (codes statut, codes pays, formats date)",
      "Règles personnalisées clé-valeur",
      "Ciblage par nom de champ avec recherche récursive pour transformation précise",
      "Support de transformations conditionnelles",
      "Règles réutilisables entre projets",
    ],
    de: [
      "Vorgefertigte Vorlagen (Statuscodes, Ländercodes, Datumsformate)",
      "Benutzerdefinierte Schlüssel-Wert-Regeln",
      "Rekursive Feldnamen-Übereinstimmung für präzise Transformation",
      "Bedingte Transformationsunterstützung",
      "Projektübergreifend wiederverwendbare Regeln",
    ],
    es: [
      "Plantillas predefinidas (códigos estado, país, fechas)",
      "Reglas personalizadas clave-valor",
      "Coincidencia recursiva por nombre de campo",
      "Transformaciones condicionales",
      "Reglas reutilizables",
    ],
    pt: [
      "Modelos predefinidos (códigos status, país, datas)",
      "Regras personalizadas chave-valor",
      "Correspondência recursiva por nome de campo",
      "Transformações condicionais",
      "Regras reutilizáveis",
    ],
    ru: [
      "Готовые шаблоны",
      "Пользовательские правила",
      "Рекурсивное сопоставление по именам полей",
      "Условные преобразования",
      "Переиспользуемые правила",
    ],
    ar: [
      "قوالب جاهزة",
      "قواعد مخصصة",
      "مطابقة أسماء الحقول بشكل تكراري",
      "تحويلات شرطية",
      "قواعد قابلة لإعادة الاستخدام",
    ],
    hi: [
      "प्रीसेट टेम्पलेट",
      "कस्टम नियम",
      "फ़ील्ड नाम पुनरावर्ती मिलान",
      "शर्तीय रूपांतरण",
      "पुन: उपयोग योग्य नियम",
    ],
    vi: [
      "Mẫu định sẵn",
      "Quy tắc tùy chỉnh",
      "Khớp tên trường đệ quy",
      "Chuyển đổi có điều kiện",
      "Quy tắc tái sử dụng",
    ],
    th: [
      "เทมเพลตสำเร็จรูป",
      "กฎกำหนดเอง",
      "จับคู่ชื่อฟิลด์แบบเรียกซ้ำ",
      "แปลงมีเงื่อนไข",
      "กฎใช้ซ้ำได้",
    ],
    tr: [
      "Hazır şablonlar",
      "Özel kurallar",
      "Özyinelemeli alan adı eşleştirme",
      "Koşullu dönüşüm",
      "Yeniden kullanılabilir kurallar",
    ],
    bn: [
      "প্রিসেট টেমপ্লেট",
      "কাস্টম নিয়ম",
      "পুনরাবৃত্ত ফিল্ড নাম মিল",
      "শর্তসাপেক্ষ রূপান্তর",
      "পুনর্ব্যবহারযোগ্য নিয়ম",
    ],
    id: [
      "Template preset",
      "Aturan kustom",
      "Pencocokan nama field rekursif",
      "Transformasi bersyarat",
      "Aturan dapat digunakan kembali",
    ],
    it: [
      "Modelli predefiniti",
      "Regole personalizzate",
      "Corrispondenza ricorsiva per nome di campo",
      "Trasformazione condizionale",
      "Regole riutilizzabili",
    ],
      zh: [
      "预设模板（状态码、国家代码、日期格式）",
      "自定义键值映射规则",
      "字段名递归匹配精准定位转换目标",
      "支持条件转换",
      "规则可在项目间复用",
    ],
  },
  "json-value-swapper": {
    en: [
    "One-click swap of two fields across all array items",
    "Missing field detection with item count",
    "Preserves all other fields and structure",
    "First-level key swapping",
    "Available field listing for reference",
  ],
    ja: [
      "配列全項目での2フィールドのワンクリック交換",
      "項目数付き欠損フィールド検出",
      "他フィールドと構造を保持",
      "第1階層キーの交換",
      "参照用の利用可能フィールド一覧",
    ],
    ko: [
      "모든 배열 항목에 대한 두 필드의 원클릭 교환",
      "항목 수가 포함된 누락 필드 감지",
      "다른 모든 필드와 구조 보존",
      "1단계 키 교환",
      "참조용 사용 가능한 필드 목록",
    ],
    fr: [
      "Échange en un clic de deux champs sur tous les éléments",
      "Détection de champs manquants avec compteur",
      "Préservation de tous les autres champs",
      "Échange de clés de premier niveau",
      "Liste des champs disponibles pour référence",
    ],
    de: [
      "Ein-Klick-Tausch von zwei Feldern",
      "Erkennung fehlender Felder mit Anzahl",
      "Erhaltung aller anderen Felder",
      "Tausch erster Ebene",
      "Liste verfügbarer Felder",
    ],
    es: [
      "Intercambio en un clic de dos campos",
      "Detección de campos faltantes con conteo",
      "Preservación de otros campos",
      "Intercambio de primer nivel",
      "Lista de campos disponibles",
    ],
    pt: [
      "Troca em um clique de dois campos",
      "Detecção de campos ausentes com contagem",
      "Preservação de outros campos",
      "Troca de primeiro nível",
      "Lista de campos disponíveis",
    ],
    ru: [
      "Обмен двух полей одним кликом",
      "Обнаружение пропусков",
      "Сохранение других полей",
      "Первый уровень",
      "Список доступных полей",
    ],
    ar: [
      "تبادل حقلين بنقرة",
      "كشف حقول مفقودة",
      "حفظ الحقول الأخرى",
      "المستوى الأول",
      "قائمة الحقول المتاحة",
    ],
    hi: [
      "दो फ़ील्ड का एक-क्लिक एक्सचेंज",
      "गायब फ़ील्ड का पता लगाना",
      "अन्य फ़ील्ड संरक्षण",
      "पहला स्तर",
      "उपलब्ध फ़ील्ड सूची",
    ],
    vi: [
      "Hoán đổi hai trường một cú nhấp",
      "Phát hiện trường thiếu",
      "Bảo toàn trường khác",
      "Cấp một",
      "Danh sách trường khả dụng",
    ],
    th: [
      "สลับสองฟิลด์ในคลิกเดียว",
      "ตรวจจับฟิลด์หาย",
      "รักษาฟิลด์อื่น",
      "ระดับแรก",
      "รายการฟิลด์ใช้ได้",
    ],
    tr: [
      "İki alanın tek tık takası",
      "Eksik alan algılama",
      "Diğer alanların korunması",
      "Birinci seviye",
      "Kullanılabilir alan listesi",
    ],
    bn: [
      "দুটি ক্ষেত্রের এক-ক্লিক বিনিময়",
      "অনুপস্থিত ক্ষেত্র সনাক্তকরণ",
      "অন্যান্য ক্ষেত্র সংরক্ষণ",
      "প্রথম স্তর",
      "উপলব্ধ ক্ষেত্র তালিকা",
    ],
    id: [
      "Tukar dua bidang dengan satu klik",
      "Deteksi bidang hilang",
      "Preservasi bidang lain",
      "Level pertama",
      "Daftar bidang tersedia",
    ],
    it: [
      "Scambio due campi con un clic",
      "Rilevamento campi mancanti",
      "Conservazione altri campi",
      "Primo livello",
      "Lista campi disponibili",
    ],
      zh: [
      "数组全项一键交换两个字段",
      "带数量的缺失字段检测",
      "保留其他所有字段和结构",
      "仅支持第一层键交换",
      "可用字段列表供参考",
    ],
  },
  "json-node-inserter": {
    en: [
    "Insert new fields at specified position",
    "Multiple field insertion via comma-separated names",
    "Preserves original structure and field order",
    "Works across all objects in a JSON array",
  ],
    ja: [
      "指定位置への新フィールド挿入",
      "カンマ区切り名による複数フィールド挿入",
      "元の構造とフィールド順序を保持",
      "JSON 配列の全オブジェクトで動作",
    ],
    ko: [
      "지정된 위치에 새 필드 삽입",
      "쉼표로 구분된 이름을 통한 여러 필드 삽입",
      "원래 구조와 필드 순서 보존",
      "JSON 배열의 모든 객체에서 작동",
    ],
    fr: [
      "Insertion à position spécifiée",
      "Insertion multi-champs via virgules",
      "Préservation de la structure et ordre",
      "Fonctionne sur tous les objets du tableau",
    ],
    de: [
      "Einfügen an angegebener Position",
      "Multi-Feld-Einfügung via Komma",
      "Erhaltung von Struktur und Reihenfolge",
      "Funktioniert in allen Array-Objekten",
    ],
    es: [
      "Inserción en posición especificada",
      "Multi-campo vía comas",
      "Preservación de estructura y orden",
      "Funciona en todos los objetos del array",
    ],
    pt: [
      "Inserção em posição especificada",
      "Multi-campo via vírgulas",
      "Preservação de estrutura e ordem",
      "Funciona em todos os objetos",
    ],
    ru: [
      "Вставка в указанную позицию",
      "Мультипольная вставка",
      "Сохранение структуры",
      "Работает со всеми объектами",
    ],
    ar: [
      "إدراج في موضع محدد",
      "إدراج متعدد الحقول",
      "حفظ البنية",
      "يعمل على جميع الكائنات",
    ],
    hi: [
      "निर्दिष्ट स्थान पर सम्मिलन",
      "मल्टी-फ़ील्ड",
      "संरचना संरक्षण",
      "सभी ऑब्जेक्ट्स पर काम करता है",
    ],
    vi: [
      "Chèn vào vị trí chỉ định",
      "Đa trường",
      "Bảo toàn cấu trúc",
      "Hoạt động trên mọi đối tượng",
    ],
    th: [
      "แทรกตำแหน่งที่ระบุ",
      "หลายฟิลด์",
      "รักษาโครงสร้าง",
      "ทำงานในทุกอ็อบเจกต์",
    ],
    tr: [
      "Belirtilen konuma ekleme",
      "Çoklu alan",
      "Yapı koruması",
      "Tüm nesnelerde çalışır",
    ],
    bn: [
      "নির্দিষ্ট অবস্থানে সন্নিবেশ",
      "মাল্টি-ক্ষেত্র",
      "কাঠামো সংরক্ষণ",
      "সমস্ত অবজেক্টে কাজ করে",
    ],
    id: [
      "Sisipan di posisi yang ditentukan",
      "Multi-bidang",
      "Preservasi struktur",
      "Bekerja di semua objek",
    ],
    it: [
      "Inserimento in posizione specificata",
      "Multi-campo",
      "Conservazione struttura",
      "Funziona su tutti gli oggetti",
    ],
      zh: [
      "指定位置插入新字段",
      "逗号分隔名称批量插入",
      "保留原有结构和字段顺序",
      "适用于 JSON 数组的所有对象",
    ],
  },
  "json-sort-classify": {
    en: [
    "Numeric ascending and descending sort",
    "Custom value sequence (manual order)",
    "Multi-level grouping with main key and sub key",
    "Hierarchical classification from flat arrays",
    "Independent sort and classify operations",
  ],
    ja: [
      "数値昇順と降順ソート",
      "カスタム値シーケンス（手動順序）",
      "主キーと副キーによる多階層グループ化",
      "フラット配列からの階層分類",
      "独立したソートと分類操作",
    ],
    ko: [
      "숫자 오름차순 및 내림차순 정렬",
      "사용자 정의 값 시퀀스 (수동 순서)",
      "주 키와 부 키를 사용한 다단계 그룹화",
      "평면 배열에서 계층적 분류",
      "독립적인 정렬 및 분류 작업",
    ],
    fr: [
      "Tri numérique croissant/décroissant",
      "Séquence personnalisée (ordre manuel)",
      "Groupement multi-niveau avec clé principale et sous-clé",
      "Classification hiérarchique à partir de tableaux plats",
      "Opérations tri et classification indépendantes",
    ],
    de: [
      "Numerische Auf-/Absteigende Sortierung",
      "Benutzerdefinierte Reihenfolge",
      "Mehrstufige Gruppierung mit Haupt- und Unterschlüssel",
      "Hierarchische Klassifikation",
      "Unabhängige Sortier- und Klassifikationsoperationen",
    ],
    es: [
      "Ordenación numérica ascendente/descendente",
      "Orden personalizado manual",
      "Agrupación multinivel clave-subclave",
      "Clasificación jerárquica",
      "Operaciones independientes",
    ],
    pt: [
      "Ordenação numérica crescente/decrescente",
      "Ordem personalizada manual",
      "Agrupamento multinível chave-subchave",
      "Classificação hierárquica",
      "Operações independentes",
    ],
    ru: [
      "Числовая сортировка",
      "Пользовательский порядок",
      "Многоуровневая группировка",
      "Иерархическая классификация",
      "Независимые операции",
    ],
    ar: [
      "فرز رقمي",
      "ترتيب مخصص",
      "تجميع متعدد المستويات",
      "تصنيف هرمي",
      "عمليات مستقلة",
    ],
    hi: [
      "संख्यात्मक क्रम",
      "कस्टम क्रम",
      "बहु-स्तर ग्रुपिंग",
      "पदानुक्रमित वर्गीकरण",
      "स्वतंत्र संचालन",
    ],
    vi: [
      "Sắp xếp số",
      "Thứ tự tùy chỉnh",
      "Nhóm đa cấp",
      "Phân loại phân cấp",
      "Thao tác độc lập",
    ],
    th: [
      "จัดเรียงตัวเลข",
      "ลำดับกำหนดเอง",
      "จัดกลุ่มหลายระดับ",
      "จำแนกลำดับชั้น",
      "การทำงานอิสระ",
    ],
    tr: [
      "Sayısal sıralama",
      "Özel sıra",
      "Çok seviyeli gruplama",
      "Hiyerarşik sınıflandırma",
      "Bağımsız işlemler",
    ],
    bn: [
      "সংখ্যাগত সাজানো",
      "কাস্টম ক্রম",
      "বহু-স্তর গ্রুপিং",
      "পদানুক্রমিক শ্রেণীবিভাগ",
      "স্বাধীন অপারেশন",
    ],
    id: [
      "Pengurutan numerik",
      "Urutan kustom",
      "Pengelompokan multi-level",
      "Klasifikasi hierarkis",
      "Operasi independen",
    ],
    it: [
      "Ordinamento numerico",
      "Ordine personalizzato",
      "Raggruppamento multi-livello",
      "Classificazione gerarchica",
      "Operazioni indipendenti",
    ],
      zh: [
      "数值升序和降序排序",
      "自定义顺序（手动定义值序列）",
      "主键加子键的多层分组",
      "平铺数组转换为分层结构",
      "排序和分类功能独立",
    ],
  },
  "json-match-update": {
    en: [
    "Match by any field (ID, slug, name, custom key)",
    "Multi-field update per operation",
    "Unmatched item reporting",
    "Cross-dataset data synchronization",
    "Backfill missing values from source",
  ],
    ja: [
      "任意のフィールドでマッチング（ID、slug、名前、カスタムキー）",
      "操作あたり複数フィールド更新",
      "未マッチ項目レポート",
      "データセット間のデータ同期",
      "ソースからの欠損値バックフィル",
    ],
    ko: [
      "임의 필드로 매칭 (ID, slug, 이름, 사용자 정의 키)",
      "작업당 여러 필드 업데이트",
      "미매칭 항목 보고",
      "데이터셋 간 데이터 동기화",
      "소스에서 누락 값 백필",
    ],
    fr: [
      "Correspondance par tout champ (ID, slug, nom, clé personnalisée)",
      "Mise à jour multi-champs par opération",
      "Rapport d'éléments non appariés",
      "Synchronisation inter-ensembles",
      "Remplissage depuis source",
    ],
    de: [
      "Abgleich über beliebige Felder",
      "Multi-Feld-Aktualisierung pro Vorgang",
      "Bericht nicht zugeordneter Elemente",
      "Datensynchronisation zwischen Datensätzen",
      "Auffüllen aus Quelle",
    ],
    es: [
      "Correspondencia por cualquier campo",
      "Actualización multi-campo",
      "Reporte elementos no apareados",
      "Sincronización entre conjuntos",
      "Rellenado desde fuente",
    ],
    pt: [
      "Correspondência por qualquer campo",
      "Atualização multi-campo",
      "Relatório itens não correspondidos",
      "Sincronização entre conjuntos",
      "Preenchimento de fonte",
    ],
    ru: [
      "Сопоставление по любому полю",
      "Многопольное обновление",
      "Отчёт несоответствий",
      "Синхронизация наборов",
      "Заполнение из источника",
    ],
    ar: [
      "مطابقة بأي حقل",
      "تحديث متعدد الحقول",
      "تقرير غير المتطابق",
      "مزامنة المجموعات",
      "ملء من المصدر",
    ],
    hi: [
      "किसी भी फ़ील्ड से मिलान",
      "बहु-फ़ील्ड अपडेट",
      "बेमेल रिपोर्ट",
      "डेटा सेट सिंक्रनाइज़ेशन",
      "स्रोत से भरना",
    ],
    vi: [
      "Khớp bằng bất kỳ trường nào",
      "Cập nhật đa trường",
      "Báo cáo không khớp",
      "Đồng bộ dữ liệu",
      "Điền từ nguồn",
    ],
    th: [
      "จับคู่ด้วยฟิลด์ใด ๆ",
      "อัปเดตหลายฟิลด์",
      "รายงานไม่ตรง",
      "ซิงค์ชุดข้อมูล",
      "เติมจากแหล่ง",
    ],
    tr: [
      "Herhangi bir alanla eşleştirme",
      "Çoklu alan güncellemesi",
      "Eşleşmeyen rapor",
      "Veri seti senkronizasyonu",
      "Kaynaktan doldurma",
    ],
    bn: [
      "যেকোনো ক্ষেত্র দিয়ে মিল",
      "বহু-ক্ষেত্র আপডেট",
      "অমিলিত রিপোর্ট",
      "ডেটাসেট সিঙ্ক্রোনাইজেশন",
      "উৎস থেকে পূরণ",
    ],
    id: [
      "Pencocokan dengan bidang apa pun",
      "Pembaruan multi-bidang",
      "Laporan tidak cocok",
      "Sinkronisasi dataset",
      "Pengisian dari sumber",
    ],
    it: [
      "Corrispondenza con qualsiasi campo",
      "Aggiornamento multi-campo",
      "Report non corrispondenti",
      "Sincronizzazione dataset",
      "Riempimento da sorgente",
    ],
      zh: [
      "任意字段匹配（ID、slug、名称、自定义键）",
      "每次操作可更新多个字段",
      "未匹配项报告",
      "两个数据集之间的数据同步",
      "从源数据回填",
    ],
  },
  flare: {
    en: [
      "Imports from Chrome, Firefox, Edge, and Safari bookmark HTML",
      "Flare App mode (application shortcuts)",
      "Flare Bookmark mode (hierarchical favorites)",
      "Bidirectional conversion between formats",
      "Full folder hierarchy and tag preservation",
    ],
    zh: [
      "支持 Chrome、Firefox、Edge、Safari 书签 HTML 导入",
      "Flare App 模式（应用快捷方式）",
      "Flare Bookmark 模式（分层收藏夹）",
      "两种模式双向转换",
      "完整保留文件夹层级和标签",
    ],
    ja: ["Chrome、Firefox、Edge、Safari ブックマーク HTML からインポート", "Flare App モード（アプリケーションショートカット）", "Flare Bookmark モード（階層型お気に入り）", "形式間の双方向変換", "フォルダ階層とタグの完全保持"],
    ko: ["Chrome, Firefox, Edge, Safari 북마크 HTML에서 가져오기", "Flare App 모드 (애플리케이션 바로가기)", "Flare Bookmark 모드 (계층적 즐겨찾기)", "형식 간 양방향 변환", "폴더 계층 및 태그 완전 보존"],
    fr: ["Import depuis HTML de Chrome, Firefox, Edge, Safari", "Mode Flare App (raccourcis)", "Mode Flare Bookmark (favoris hiérarchiques)", "Conversion bidirectionnelle", "Préservation complète hiérarchie et tags"],
    de: ["Import aus Chrome, Firefox, Edge, Safari HTML", "Flare App-Modus (Verknüpfungen)", "Flare Bookmark-Modus (hierarchisch)", "Bidirektionale Konvertierung", "Vollständige Hierarchie- und Tag-Erhaltung"],
    es: ["Importa desde HTML de Chrome, Firefox, Edge, Safari", "Modo Flare App (accesos directos)", "Modo Flare Bookmark (jerárquico)", "Conversión bidireccional", "Preservación completa jerarquía y tags"],
    pt: ["Importa de HTML de Chrome, Firefox, Edge, Safari", "Modo Flare App (atalhos)", "Modo Flare Bookmark (hierárquico)", "Conversão bidirecional", "Preservação completa hierarquia e tags"],
    ru: ["Импорт из Chrome, Firefox, Edge, Safari", "Режим Flare App", "Режим Flare Bookmark", "Двусторонняя конвертация", "Сохранение иерархии и тегов"],
    ar: ["استيراد من Chrome، Firefox، Edge، Safari", "وضع Flare App", "وضع Flare Bookmark", "تحويل ثنائي الاتجاه", "حفظ كامل للتسلسل الهرمي والعلامات"],
    hi: ["Chrome, Firefox, Edge, Safari से आयात", "Flare App मोड", "Flare Bookmark मोड", "द्विदिश रूपांतरण", "पदानुक्रम और टैग संरक्षण"],
    vi: ["Nhập từ Chrome, Firefox, Edge, Safari", "Chế độ Flare App", "Chế độ Flare Bookmark", "Chuyển đổi hai chiều", "Bảo toàn phân cấp và thẻ"],
    th: ["นำเข้าจาก Chrome, Firefox, Edge, Safari", "โหมด Flare App", "โหมด Flare Bookmark", "แปลงสองทิศทาง", "รักษาลำดับชั้นและแท็ก"],
    tr: ["Chrome, Firefox, Edge, Safari'den içe aktarma", "Flare App modu", "Flare Bookmark modu", "İki yönlü dönüşüm", "Hiyerarşi ve etiket koruması"],
    bn: ["Chrome, Firefox, Edge, Safari থেকে আমদানি", "Flare App মোড", "Flare Bookmark মোড", "দ্বিমুখী রূপান্তর", "পদানুক্রম এবং ট্যাগ সংরক্ষণ"],
    id: ["Impor dari Chrome, Firefox, Edge, Safari", "Mode Flare App", "Mode Flare Bookmark", "Konversi dua arah", "Preservasi hierarki dan tag"],
    it: ["Importa da Chrome, Firefox, Edge, Safari", "Modalità Flare App", "Modalità Flare Bookmark", "Conversione bidirezionale", "Conservazione gerarchia e tag"],
  },
  "img-prompt": {
    en: [
    "Name pair input via colon or tab separator",
    "Customizable object and attribute key names",
    "Automatic deduplication of entries",
    "Standard JSON dataset output",
    "Built-in format validation and preview",
  ],
    ja: [
      "コロンまたはタブ区切りの名前ペア入力",
      "カスタマイズ可能な object と attribute キー名",
      "エントリの自動重複排除",
      "標準 JSON データセット出力",
      "組み込みの形式検証とプレビュー",
    ],
    ko: [
      "콜론 또는 탭 구분자를 통한 이름 쌍 입력",
      "사용자 정의 가능한 object 및 attribute 키 이름",
      "항목의 자동 중복 제거",
      "표준 JSON 데이터셋 출력",
      "내장된 형식 검증 및 미리보기",
    ],
    fr: [
      "Paires de noms séparées par deux-points ou tab",
      "Noms de clés object et attribute personnalisables",
      "Déduplication automatique des entrées",
      "Sortie JSON standard",
      "Validation et aperçu intégrés",
    ],
    de: [
      "Namenspaare durch Doppelpunkt oder Tab",
      "Anpassbare Objekt- und Attribut-Schlüsselnamen",
      "Automatische Eintrags-Deduplizierung",
      "Standard-JSON-Dataset-Ausgabe",
      "Integrierte Validierung und Vorschau",
    ],
    es: [
      "Pares de nombres por dos puntos o tabulación",
      "Nombres de claves object y attribute personalizables",
      "Deduplicación automática",
      "Salida JSON estándar",
      "Validación y vista previa integradas",
    ],
    pt: [
      "Pares de nomes por dois pontos ou tabulação",
      "Nomes de chaves object e attribute personalizáveis",
      "Deduplicação automática",
      "Saída JSON padrão",
      "Validação e pré-visualização integradas",
    ],
    ru: [
      "Пары имён через двоеточие или таб",
      "Настраиваемые ключи",
      "Автодедупликация",
      "Стандартный JSON",
      "Валидация и предпросмотр",
    ],
    ar: [
      "أزواج أسماء بنقطتين أو علامة تبويب",
      "مفاتيح قابلة للتخصيص",
      "إزالة تكرار تلقائية",
      "إخراج JSON قياسي",
      "تحقق ومعاينة مدمجة",
    ],
    hi: [
      "कोलन या टैब द्वारा नाम जोड़े",
      "कस्टमाइज़ कुंजी नाम",
      "स्वचालित डिडुप्लिकेशन",
      "मानक JSON आउटपुट",
      "एकीकृत सत्यापन",
    ],
    vi: [
      "Cặp tên bằng dấu hai chấm hoặc tab",
      "Tên khóa tùy chỉnh",
      "Tự loại trùng",
      "Đầu ra JSON chuẩn",
      "Xác thực tích hợp",
    ],
    th: [
      "คู่ชื่อด้วยจุดคู่หรือแท็บ",
      "ชื่อคีย์กำหนดเอง",
      "ลบซ้ำอัตโนมัติ",
      "เอาต์พุต JSON มาตรฐาน",
      "ตรวจสอบและแสดงตัวอย่าง",
    ],
    tr: [
      "İki nokta veya tab ile ad çiftleri",
      "Özelleştirilebilir anahtar adları",
      "Otomatik tekilleştirme",
      "Standart JSON çıktısı",
      "Entegre doğrulama",
    ],
    bn: [
      "কোলন বা ট্যাব দ্বারা নাম জোড়া",
      "কাস্টমাইজ কী নাম",
      "স্বয়ংক্রিয় ডিডুপ্লিকেশন",
      "স্ট্যান্ডার্ড JSON আউটপুট",
      "সমন্বিত বৈধতা",
    ],
    id: [
      "Pasangan nama via titik dua atau tab",
      "Nama kunci yang dapat disesuaikan",
      "Deduplikasi otomatis",
      "Output JSON standar",
      "Validasi terintegrasi",
    ],
    it: [
      "Coppie di nomi con due punti o tab",
      "Nomi chiavi personalizzabili",
      "Deduplicazione automatica",
      "Output JSON standard",
      "Validazione integrata",
    ],
      zh: [
      "冒号或制表符分隔的名称对输入",
      "自定义 object 和 attribute 键名",
      "条目自动去重",
      "输出标准 JSON 数据集",
      "内置格式验证和预览",
    ],
  },
  "chinese-conversion": {
    en: [
    "Simplified Chinese to Traditional (Taiwan/Hong Kong)",
    "Traditional Chinese to Simplified",
    "Japanese Shinjitai conversion",
    "Fully offline browser processing — no server upload",
    "Unlimited batch text conversion",
    "OpenCC engine for accurate conversion",
  ],
  },
  "novel-processor": {
    zh: [
      "修复网文 TXT 格式乱的 7 大问题（笔趣阁下载、网页复制、Word 导出均适用）",
      "智能识别「第X章」「Chapter X」等章节标题自动分割",
      "相邻重复行识别（完全相同的连续行会被删除，如重复广告横幅）",
      "段首缩进（两字符）、去除多余空行、修复误切短行",
      "繁体转简体、全角半角空格统一",
      "支持 300 万字以上超长小说，处理速度快",
      "Kindle 推送邮箱、微信读书、掌阅、静读天下兼容",
    ],
  },
  "regex-matcher": {
    en: [
    "Regex match, replace, and extract operations",
    "Text sorting and deduplication",
    "Prefix and suffix addition",
    "URL extraction",
    "Stackable processing rules",
    "Shortcut buttons for common operations (no regex needed)",
  ],
  },
  "text-processor": {
    en: [
    "Excel table data deduplication",
    "Column-specific value extraction",
    "Multi-rule chained text processing",
    "Custom prefix addition",
    "Text merging and formatting",
    "Sequential rule execution",
  ],
  },
};

export function getFeatureList(toolKey: string, locale: string = "en"): string[] {
  const tool = TOOL_FEATURES[toolKey];
  if (!tool) return [];
  if (locale === "zh-hant") return tool["zh-hant"] ?? tool.zh ?? tool.en ?? [];
  return tool[locale] ?? tool.en ?? [];
}
