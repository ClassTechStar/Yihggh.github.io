
/* ═══ Reader Bundle（P1-4/P2-1/P2-3）═══
 * ReaderPrefs：版本化偏好读写（P1-4，借鉴 ClassIsland MigrateSettings）
 * 安全模式：?safe=1 禁用增强（P2-3，借鉴 CW2 --safe-mode）
 * 公告横幅：docs/announcements.json feed（P2-1，借鉴 CW2 通知队列）
 * 幂等标记：window.__readerBundle
 */
(function () {
 if (window.__readerBundle) return;
 window.__readerBundle = true;
 window.__SAFE = /[?&]safe=1/.test(location.search);
 if (window.__SAFE) document.documentElement.classList.add('safe');

 var NS = 'rp', RP_VER = 2;
 var RS = {
 VERSION: RP_VER,
 get: function (k, d) {
 try {
 var v = localStorage.getItem(NS + ':' + k);
 if (v !== null) return JSON.parse(v);
 return d;
 } catch (e) { return d; }
 },
 set: function (k, v) {
 try { localStorage.setItem(NS + ':' + k, JSON.stringify(v)); }
 catch (e) { /* M11：隐私模式/配额失败静默，进度类由调用方兜底 */ }
 },
 remove: function (k) { try { localStorage.removeItem(NS + ':' + k); } catch (e) {} }
 };
 window.RS = RS;

 /* 迁移链：v1 → v2。v1 无命名空间直接存原始键（fontSize/theme/rating-/health-check-）；
 v2 统一进 rp: 命名空间。旧键保留不动（书内旧代码仍读旧键，渐进迁移）。 */
 (function migrate() {
 try {
 if (RS.get('migrated') === RP_VER) return;
 ['fontSize', 'theme'].forEach(function (k) {
 var v = localStorage.getItem(k);
 if (v !== null && RS.get(k, null) === null) RS.set(k, v);
 });
 RS.set('migrated', RP_VER);
 } catch (e) {}
 })();

 /* P2-1 公告横幅：safe 模式跳过；fetch 失败（离线单文件）静默 */
 function announce() {
 if (window.__SAFE) return;
 var url = location.pathname.indexOf('/v1.8/') >= 0
 ? '../../announcements.json' : 'announcements.json';
 var tryAt = function (i) {
 if (i >= 1) return;
 fetch(url).then(function (r) {
 if (!r.ok) throw 0;
 return r.json();
 }).then(function (feed) {
 var now = Date.now();
 var items = (feed.items || []).filter(function (a) {
 var okWin = (!a.from || Date.parse(a.from) <= now) &&
 (!a.until || Date.parse(a.until) >= now);
 if (!okWin) return false;
 var dis = RS.get('announce-dismissed', {});
 return !dis[a.id];
 }).sort(function (x, y) { return (y.priority || 0) - (x.priority || 0); });
 var top = items[0];
 if (!top) return;
 var bar = document.createElement('div');
 bar.id = 'announce-bar';
 bar.setAttribute('data-level', top.level || 'info');
 bar.innerHTML = '<span>' + top.text + '</span><button aria-label="关闭">✕</button>';
 bar.querySelector('button').onclick = function () {
 bar.remove();
 var dis = RS.get('announce-dismissed', {});
 dis[top.id] = Date.now();
 RS.set('announce-dismissed', dis);
 };
 document.body.insertBefore(bar, document.body.firstChild);
 }).catch(function () { tryAt(i + 1); });
 };
 tryAt(0);
 }

 /* P2-3 SW 自愈：?nosw=1 注销全部 Service Worker（缓存失配逃生口） */
 if (/[?&]nosw=1/.test(location.search) && navigator.serviceWorker) {
 navigator.serviceWorker.getRegistrations().then(function (rs) {
 rs.forEach(function (r) { r.unregister(); });
 }).catch(function () {});
 }

 if (document.readyState === 'loading') {
 document.addEventListener('DOMContentLoaded', announce);
 } else {
 announce();
 }
})();


 (function() {
 'use strict';

 const $ = (sel, ctx) => (ctx || document).querySelector(sel);
 const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

 const html = document.documentElement;
 const body = document.body;
 const navbar = $('#navbar');
 const sidebar = $('#sidebar');
 const overlay = $('#overlay');
 const menuToggle = $('#menu-toggle');
 const backToTop = $('#back-to-top');
 const progressBar = $('#reading-progress');
 const searchOverlay = $('#search-overlay');
 const searchInput = $('#search-input');
 const searchResults = $('#search-results');
 const tocProgressBar = $('#toc-progress-bar');
 const readingProgressText = $('#reading-progress-text');
 const readingPercent = $('#reading-percent');
 const contentEl = $('#content');
 const tocList = $('#toc-list');
 const tocFilter = $('#toc-filter');
 const printBtn = $('#print-btn');
 const quickSearch = $('#quick-search');
 const quickTheme = $('#quick-theme');
 const quickPrint = $('#quick-print');
 const quickToc = $('#quick-toc');
 let themeToggle = null;
 const restoreToast = $('#restore-toast');
 const restoreToastText = $('#restore-toast-text');
 const restoreBtn = $('#restore-btn');
 const dismissBtn = $('#dismiss-btn');

 // ===== المظهر =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن';
 [themeToggle, quickTheme].filter(Boolean).forEach(btn => {
 btn.setAttribute('aria-label', nextLabel);
 btn.setAttribute('title', nextLabel);
 btn.setAttribute('aria-pressed', String(isDark));
 });
 }
 function applyTheme(theme) {
 const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
 html.classList.toggle('dark', resolvedTheme === 'dark');
 body.classList.toggle('dark', resolvedTheme === 'dark');
 html.setAttribute('data-theme', resolvedTheme);
 body.setAttribute('data-theme', resolvedTheme);
 localStorage.setItem('theme', resolvedTheme);
 syncThemeControls();
 }
 const savedTheme = localStorage.getItem('theme');
 if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
 applyTheme('dark');
 } else {
 applyTheme('light');
 }
 function toggleTheme() {
 applyTheme(html.classList.contains('dark') ? 'light' : 'dark');
 }
 themeToggle = $('#theme-toggle');
 if (themeToggle) themeToggle.addEventListener('click', (e) => {
 e.preventDefault();
 toggleTheme();
 });
 if (quickTheme) quickTheme.addEventListener('click', (e) => {
 e.preventDefault();
 toggleTheme();
 });

 // ===== التمرير: التقدم + الظل + العودة إلى الأعلى + تقدم الفهرس + حلقة التقدم =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} فصول`;

 // معاملات حلقة التقدم
 const progressRingFg = backToTop ? backToTop.querySelector('.progress-ring .fg') : null;
 const RING_CIRCUMFERENCE = 2 * Math.PI * 18; // r=18
 if (progressRingFg) progressRingFg.setAttribute('stroke-dasharray', RING_CIRCUMFERENCE.toFixed(1));

 let ticking = false;
 function onScroll() {
 if (!ticking) {
 requestAnimationFrame(() => {
 const scrollY = window.scrollY;
 const docHeight = document.documentElement.scrollHeight - window.innerHeight;
 const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
 if (progressBar) progressBar.style.width = progress + '%';

 // تحديث حلقة التقدم
 if (progressRingFg) {
 const offset = RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE;
 progressRingFg.setAttribute('stroke-dashoffset', offset.toFixed(1));
 }

 if (navbar) {
 if (scrollY > 50) {
 navbar.classList.add('shadow-md', 'bg-white/95', 'dark:bg-gray-800/95', 'backdrop-blur-sm');
 } else {
 navbar.classList.remove('shadow-md', 'bg-white/95', 'dark:bg-gray-800/95', 'backdrop-blur-sm');
 }
 }

 if (backToTop) {
 if (scrollY > 300) {
 backToTop.classList.remove('opacity-0', 'invisible');
 backToTop.classList.add('opacity-100', 'visible');
 } else {
 backToTop.classList.add('opacity-0', 'invisible');
 backToTop.classList.remove('opacity-100', 'visible');
 }
 }

 // إلى أي فصل وصلت القراءة
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} فصول`;
 }
 if (readingPercent) {
 const pct = Math.round(progress);
 readingPercent.textContent = pct + '%';
 }
 if (tocProgressBar) {
 tocProgressBar.style.transform = `scaleX(${Math.min(1, progress/100)})`;
 }

 ticking = false;
 });
 ticking = true;
 }
 }
 window.addEventListener('scroll', onScroll, { passive: true });

 if (backToTop) {
 backToTop.addEventListener('click', () => {
 window.scrollTo({ top: 0, behavior: 'smooth' });
 });
 }

 // ===== ذاكرة موضع القراءة =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // مبكر جدًا للحفظ
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // إيجاد اسم الفصل الحالي
 let currentChapter = '';
 let currentSectionId = '';
 let currentOffset = 0;
 const viewportTop = scrollY + 100;
 for (let i = sections.length - 1; i >= 0; i--) {
 if (sections[i].offsetTop <= viewportTop) {
 const h3 = sections[i].querySelector('h3');
 if (h3) currentChapter = h3.textContent;
 currentSectionId = sections[i].getAttribute('id') || '';
 currentOffset = Math.max(0, scrollY - sections[i].offsetTop);
 break;
 }
 }
 if (currentChapter) localStorage.setItem(POSITION_CHAPTER_KEY, currentChapter);
 if (currentSectionId) {
 localStorage.setItem(POSITION_SECTION_KEY, currentSectionId);
 localStorage.setItem(POSITION_OFFSET_KEY, String(currentOffset));
 }
 }
 window.addEventListener('scroll', () => {
 clearTimeout(savePosTimer);
 savePosTimer = setTimeout(saveReadingPosition, 1000);
 }, { passive: true });

 // استعادة الموضع عند تحميل الصفحة
 function tryRestorePosition() {
 const savedPos = parseInt(localStorage.getItem(POSITION_KEY) || '0', 10);
 const savedChapter = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 const savedSectionId = localStorage.getItem(POSITION_SECTION_KEY) || '';
 const savedOffset = parseInt(localStorage.getItem(POSITION_OFFSET_KEY) || '0', 10);
 if (savedPos > 500 && savedChapter && restoreToast && restoreToastText) {
 // 方案 W5：默认直达上次位置。优先按章节 id 定位：content-visibility 下
 // 直接跳 scrollY 会因未渲染章节的占位高度而漂移；先强制渲染该章再补章内偏移。
 const sectionEl = savedSectionId ? document.getElementById(savedSectionId) : null;
 if (sectionEl) {
 sectionEl.scrollIntoView({ behavior: 'instant', block: 'start' });
 requestAnimationFrame(() => {
 window.scrollTo({ top: sectionEl.offsetTop + savedOffset, behavior: 'auto' });
 });
 } else {
 window.scrollTo({ top: savedPos, behavior: 'auto' });
 }
 restoreToastText.textContent = `آخر قراءة: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // إخفاء تلقائي بعد 10 ثوانٍ
 setTimeout(() => restoreToast.classList.remove('show'), 15000);
 }
 }
 if (restoreBtn) {
 // 位置已自动恢复：按钮改为「撤销」，把读者送回本次打开时的位置（顶部）
 restoreBtn.addEventListener('click', () => {
 window.scrollTo({ top: 0, behavior: 'smooth' });
 if (restoreToast) restoreToast.classList.remove('show');
 });
 }
 if (dismissBtn) {
 dismissBtn.addEventListener('click', () => {
 if (restoreToast) restoreToast.classList.remove('show');
 });
 }

 // ===== حركة الظهور عند التمرير =====
 // 渐进增强：只有观察器可用时才启用隐藏态，否则正文保持默认可见
 const supportsIO = 'IntersectionObserver' in window;
 if (supportsIO) html.classList.add('anim-ready');
 const visibleObserver = supportsIO ? new IntersectionObserver((entries) => {
 entries.forEach(entry => {
 if (entry.isIntersecting || entry.intersectionRatio > 0) {
 entry.target.classList.add('visible');
 visibleObserver.unobserve(entry.target);
 }
 });
 }, { rootMargin: '0px 0px -40px 0px', threshold: 0 }) : null;
 // 阈值必须为 0：超长章节用 0.05 永远达不到，会整章白屏
 // 兜底：观察器若因任何原因未触发，2 秒后强制全部显示
 setTimeout(() => {
 sections.forEach(sec => sec.classList.add('visible'));
 }, 2000);
 // محتوى الشاشة الأولى يظهر مرئيًا مباشرة
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== فتح/إغلاق الشريط الجانبي =====
 function openSidebar() {
 sidebar.classList.remove('-translate-x-full');
 overlay.classList.remove('hidden');
 body.classList.add('overflow-hidden');
 if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
 }
 function closeSidebar() {
 sidebar.classList.add('-translate-x-full');
 overlay.classList.add('hidden');
 body.classList.remove('overflow-hidden');
 if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
 }
 if (menuToggle) menuToggle.addEventListener('click', () => {
 if (sidebar.classList.contains('-translate-x-full')) openSidebar();
 else closeSidebar();
 });
 if (overlay) overlay.addEventListener('click', closeSidebar);

 // الأدوات السريعة: فتح الفهرس
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== التنقل العالمي بالمراسئ: تعويض انزياح الشريط الثابت =====
 // لا بد من استخدام scrollIntoView بدل حساب الإحداثيات يدويًا: .content-section لديها
 // content-visibility:auto + contain-intrinsic-size(0 800px): الفصول خارج الشاشة
 // تشغل عناصر نائبة بارتفاع 800px، ويعيد getBoundingClientRect إحداثيات العنصر النائب، وscrollTo المباشر
 // سيهبط في المكان الخطأ (كلما تأخر الفصل زاد الانحراف المتراكم). يترك scrollIntoView للمتصفح
 // يعرض الهدف عند الطلب ويحدد موقعه، وhtml{scroll-padding-top:5rem} يعوّض الشريط
 // الثابت.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // الخطوة 1: يفرض الوضع instant أولًا عرض الفصل الهدف وتحديد موقعه، حتى لا يتسبب content-visibility
 // الانحراف أثناء التمرير السلس بسبب العرض المؤجل.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // الخطوة 2: بعد عرض الهدف واستقرار الإحداثيات، نطلق تمريرًا سلسًا لإحساس مريح.
 requestAnimationFrame(() => {
 el.scrollIntoView({ behavior: 'smooth', block: 'start' });
 el.classList.add('scroll-target-flash');
 setTimeout(() => el.classList.remove('scroll-target-flash'), 1200);
 });
 }
 document.addEventListener('click', (e) => {
 const link = e.target.closest('a[href^="#"]');
 if (!link) return;
 const href = link.getAttribute('href');
 if (!href || href === '#' || href === '#top') return;
 e.preventDefault();
 const targetId = href.slice(1);
 if (window.innerWidth < 1024) closeSidebar();
 requestAnimationFrame(() => scrollToAnchor(targetId));
 }, { passive: false });

 // ===== طي الفهرس =====
 $$('.toc-toggle-btn').forEach(btn => {
 btn.addEventListener('click', (e) => {
 e.preventDefault();
 e.stopPropagation();
 const targetId = btn.dataset.target;
 if (!targetId) return;
 const childList = document.getElementById(targetId);
 if (!childList) return;
 const icon = btn.querySelector('.toc-toggle-icon');
 const isOpen = childList.classList.contains('open');
 childList.classList.toggle('open', !isOpen);
 if (icon) {
 icon.classList.toggle('fa-chevron-down', !isOpen);
 icon.classList.toggle('fa-chevron-up', isOpen);
 }
 });
 });

 // ===== مرشح الفهرس =====
 if (tocFilter && tocList) {
 tocFilter.addEventListener('input', () => {
 const q = tocFilter.value.trim().toLowerCase();
 $$('.toc-parent', tocList).forEach(parent => {
 let hasMatch = false;
 $$('a', parent).forEach(a => {
 const txt = a.textContent.toLowerCase();
 const show = !q || txt.includes(q);
 a.closest('li').style.display = show ? '' : 'none';
 if (show) hasMatch = true;
 });
 parent.style.display = hasMatch ? '' : 'none';
 });
 });
 }

 // ===== إبراز في الفهرس =====
 const tocLinkMap = new Map();
 $$('#sidebar a').forEach(item => {
 const href = item.getAttribute('href');
 if (href && href.startsWith('#')) {
 tocLinkMap.set(href.slice(1), item);
 }
 });

 let currentActive = null;
 function ensureParentExpanded(link) {
 if (!link) return;
 const parentLi = link.closest('.toc-parent');
 if (!parentLi) return;
 const childList = parentLi.querySelector(':scope > ul.toc-child');
 if (childList && !childList.classList.contains('open')) {
 childList.classList.add('open');
 const btn = parentLi.querySelector('.toc-toggle-btn .toc-toggle-icon');
 if (btn) {
 btn.classList.remove('fa-chevron-up');
 btn.classList.add('fa-chevron-down');
 }
 }
 }
 const observer = new IntersectionObserver((entries) => {
 entries.forEach(entry => {
 if (entry.isIntersecting) {
 const id = entry.target.getAttribute('id');
 if (currentActive) currentActive.classList.remove('active');
 const link = tocLinkMap.get(id);
 if (link) {
 link.classList.add('active');
 currentActive = link;
 ensureParentExpanded(link);
 try { link.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { link.scrollIntoView(); }
 }
 }
 });
 }, { root: null, rootMargin: '0px 0px -60% 0px', threshold: 0 });

 sections.forEach(section => observer.observe(section));

 // ===== نظام الإشارات المرجعية =====
 const BOOKMARKS_KEY = 'phoneCourse_bookmarks';
 function getBookmarks() {
 try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); } catch { return []; }
 }
 function saveBookmarks(bm) { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bm)); }
 function toggleBookmark(id) {
 let bm = getBookmarks();
 const idx = bm.indexOf(id);
 if (idx >= 0) bm.splice(idx, 1);
 else bm.push(id);
 saveBookmarks(bm);
 return idx < 0; // true = added
 }
 function isBookmarked(id) { return getBookmarks().includes(id); }

 // إضافة زر إشارة مرجعية لكل فصل
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'في الإشارات المرجعية' : 'إشارة مرجعية') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'إزالة من الإشارات المرجعية' : 'إضافة الفصل إلى الإشارات المرجعية');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'في الإشارات المرجعية' : 'إشارة مرجعية';
 btn.setAttribute('aria-label', added ? 'إزالة من الإشارات المرجعية' : 'إضافة الفصل إلى الإشارات المرجعية');
 // تحديث علامات الشريط الجانبي
 updateTocBookmark(id, added);
 });
 // الإدراج بعد h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // تهيئة علامات الإشارات المرجعية في الشريط الجانبي
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== علامات إتمام الفصول =====
 const COMPLETED_KEY = 'phoneCourse_completed';
 function getCompleted() {
 try { return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]'); } catch { return []; }
 }
 function saveCompleted(arr) { localStorage.setItem(COMPLETED_KEY, JSON.stringify(arr)); }
 function toggleCompleted(id) {
 let arr = getCompleted();
 const idx = arr.indexOf(id);
 if (idx >= 0) arr.splice(idx, 1);
 else arr.push(id);
 saveCompleted(arr);
 return idx < 0;
 }
 function isCompleted(id) { return getCompleted().includes(id); }

 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 // إيجاد صف الميتا أو العنصر السابق للعنوان h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'مقروء' : 'مقروء') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'إلغاء علامة المقروء' : 'وضع علامة مقروء');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'مقروء' : 'مقروء';
 check.setAttribute('aria-label', done ? 'إلغاء علامة المقروء' : 'وضع علامة مقروء');
 // تحديث الشريط الجانبي
 updateTocCompleted(id, done);
 // تحديث تقدم القراءة
 updateCompletedProgress();
 });
 if (metaDiv && metaDiv.classList.contains('flex')) {
 metaDiv.appendChild(check);
 } else {
 h3.parentNode.insertBefore(check, h3.nextSibling.nextSibling);
 }
 });

 function updateTocCompleted(id, done) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('completed-toc', done);
 }
 }
 getCompleted().forEach(id => updateTocCompleted(id, true));

 function updateCompletedProgress() {
 const completed = getCompleted().length;
 if (readingProgressText) {
 // يحدّث عداد الإتمام أيضًا
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} فصول`;
 }
 }

 // ===== البحث (معزز: تنقل بلوحة المفاتيح + عداد النتائج) =====
 let searchSelectedIdx = -1;
 let searchResultItems = [];

 // 方案 W5：不再预建全书索引。120 章 × textContent 全量拷进 JS 数组会让
 // 低端安卓首次搜索内存峰值翻倍；改为 runSearch 逐章扫描、只保留命中章。

 function renderSearchPlaceholder(message) {
 if (searchResults) {
 searchResults.innerHTML = `<div class="p-4 text-center text-gray-400 text-sm">${message}</div>`;
 }
 }
 function runSearch(query) {
 const normalizedQuery = (query || '').trim().toLowerCase();
 if (!normalizedQuery) {
 renderSearchPlaceholder('اكتب كلمات مفتاحية لبدء البحث');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }
 const results = [];
 // 逐章读取 textContent：只保留命中的前 20 章，扫完一章即释放上一章
 for (const section of sections) {
 const id = section.getAttribute('id');
 const h3 = section.querySelector('h3');
 const title = h3 ? h3.textContent : '';
 const text = section.textContent;
 if (!title.toLowerCase().includes(normalizedQuery) &&
 !text.toLowerCase().includes(normalizedQuery)) continue;
 results.push({ id, title, text });
 if (results.length >= 20) break;
 }

 if (results.length === 0) {
 renderSearchPlaceholder('لا نتائج مطابقة');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">وُجد ${results.length} من النتائج</div>`;
 searchResults.innerHTML = countHtml + results.map(item => {
 const idx = item.text.toLowerCase().indexOf(normalizedQuery);
 const start = Math.max(0, idx - 40);
 const end = Math.min(item.text.length, idx + normalizedQuery.length + 80);
 let excerpt = (start > 0 ? '...' : '') + item.text.slice(start, end) + (end < item.text.length ? '...' : '');
 const re = new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
 const highlightedTitle = item.title.replace(re, '<mark>$&</mark>');
 const highlightedExcerpt = excerpt.replace(re, '<mark>$&</mark>');
 return `<div class="search-result-item" data-target="${item.id}">
 <div class="result-title">${highlightedTitle}</div>
 <div class="result-excerpt">${highlightedExcerpt}</div>
 </div>`;
 }).join('');

 searchResultItems = $$('.search-result-item', searchResults);
 searchSelectedIdx = -1;

 searchResultItems.forEach(el => {
 el.addEventListener('click', () => {
 const targetId = el.dataset.target;
 if (targetId) {
 closeSearch();
 scrollToAnchor(targetId);
 }
 });
 });
 }
 function openSearch() {
 if (!searchOverlay) return;
 searchOverlay.classList.add('active');
 searchOverlay.setAttribute('aria-hidden', 'false');
 if (searchInput) {
 setTimeout(() => {
 searchInput.focus();
 if (searchInput.value) {
 runSearch(searchInput.value);
 }
 }, 100);
 }
 }
 function closeSearch() {
 if (searchOverlay) {
 searchOverlay.classList.remove('active');
 searchOverlay.setAttribute('aria-hidden', 'true');
 }
 if (searchInput) searchInput.value = '';
 renderSearchPlaceholder('اكتب كلمات مفتاحية لبدء البحث');
 searchSelectedIdx = -1;
 searchResultItems = [];
 }

 function updateSearchSelection() {
 searchResultItems.forEach((el, i) => {
 el.classList.toggle('selected', i === searchSelectedIdx);
 });
 if (searchSelectedIdx >= 0 && searchResultItems[searchSelectedIdx]) {
 searchResultItems[searchSelectedIdx].scrollIntoView({ block: 'nearest' });
 }
 }

 const searchToggle = $('#search-toggle');
 if (searchToggle) searchToggle.addEventListener('click', openSearch);
 if (quickSearch) quickSearch.addEventListener('click', openSearch);
 const searchClose = $('#search-close');
 if (searchClose) searchClose.addEventListener('click', closeSearch);
 if (searchOverlay) searchOverlay.addEventListener('click', (e) => {
 if (e.target === searchOverlay) closeSearch();
 });

 let searchTimer = null;
 if (searchInput) searchInput.addEventListener('input', () => {
 clearTimeout(searchTimer);
 searchTimer = setTimeout(() => runSearch(searchInput.value), 200);
 });

 // التنقل في البحث بلوحة المفاتيح
 if (searchInput) searchInput.addEventListener('keydown', (e) => {
 if (!searchResultItems.length) return;
 if (e.key === 'ArrowDown') {
 e.preventDefault();
 searchSelectedIdx = Math.min(searchSelectedIdx + 1, searchResultItems.length - 1);
 updateSearchSelection();
 } else if (e.key === 'ArrowUp') {
 e.preventDefault();
 searchSelectedIdx = Math.max(searchSelectedIdx - 1, 0);
 updateSearchSelection();
 } else if (e.key === 'Enter' && searchSelectedIdx >= 0) {
 e.preventDefault();
 const el = searchResultItems[searchSelectedIdx];
 if (el) {
 const targetId = el.dataset.target;
 if (targetId) {
 closeSearch();
 scrollToAnchor(targetId);
 }
 }
 }
 });

 // ===== حجم الخط =====
 const DEFAULT_FONT_SIZE = 16;
 function setFontSize(size) {
 contentEl.style.fontSize = size + 'px';
 localStorage.setItem('fontSize', size + 'px');
 }
 const savedFontSize = parseInt(localStorage.getItem('fontSize') || '', 10);
 setFontSize(Number.isFinite(savedFontSize) ? savedFontSize : DEFAULT_FONT_SIZE);

 $$('.font-size-btn').forEach(btn => {
 btn.addEventListener('click', () => {
 const action = btn.dataset.action;
 const current = parseFloat(getComputedStyle(contentEl).fontSize);
 let newSize;
 if (action === 'reset') newSize = DEFAULT_FONT_SIZE;
 else if (action === 'increase') newSize = Math.min(current + 2, 24);
 else newSize = Math.max(current - 2, 12);
 setFontSize(newSize);
 });
 });

 // ===== إغلاق الشريط الجانبي بالسحب =====
 let touchStartX = 0;
 let touchStartY = 0;
 sidebar.addEventListener('touchstart', (e) => {
 touchStartX = e.touches[0].clientX;
 touchStartY = e.touches[0].clientY;
 }, { passive: true });
 sidebar.addEventListener('touchend', (e) => {
 const dx = e.changedTouches[0].clientX - touchStartX;
 const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
 if (dx < -60 && dy < 50 && window.innerWidth < 1024) closeSidebar();
 }, { passive: true });

 // ===== التنقل بين الفصول =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'الفصل السابق'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'الفصل التالي'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== الطباعة =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== اختصارات لوحة المفاتيح العامة =====
 const shortcutsOverlay = $('#shortcuts-overlay');
 const backupOverlay = $('#backup-overlay');
 function openShortcuts() { if (shortcutsOverlay) shortcutsOverlay.classList.add('active'); }
 function closeShortcuts() { if (shortcutsOverlay) shortcutsOverlay.classList.remove('active'); }
 function openBackup() { if (backupOverlay) backupOverlay.classList.add('active'); }
 function closeBackup() { if (backupOverlay) backupOverlay.classList.remove('active'); }

 const quickShortcuts = $('#quick-shortcuts');
 const quickBackup = $('#quick-backup');
 if (quickShortcuts) quickShortcuts.addEventListener('click', openShortcuts);
 if (quickBackup) quickBackup.addEventListener('click', openBackup);
 const shortcutsClose = $('#shortcuts-close');
 const backupClose = $('#backup-close');
 if (shortcutsClose) shortcutsClose.addEventListener('click', closeShortcuts);
 if (backupClose) backupClose.addEventListener('click', closeBackup);

 // إغلاق النوافذ عند النقر على الستارة
 if (shortcutsOverlay) shortcutsOverlay.addEventListener('click', (e) => {
 if (e.target === shortcutsOverlay) closeShortcuts();
 });
 if (backupOverlay) backupOverlay.addEventListener('click', (e) => {
 if (e.target === backupOverlay) closeBackup();
 });

 document.addEventListener('keydown', (e) => {
 if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
 if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
 e.preventDefault();
 if (searchOverlay && searchOverlay.classList.contains('active')) closeSearch();
 else openSearch();
 } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
 // الطباعة يعالجها المتصفح أصلًا
 } else if (e.key === 'Escape') {
 if (searchOverlay && searchOverlay.classList.contains('active')) closeSearch();
 if (shortcutsOverlay && shortcutsOverlay.classList.contains('active')) closeShortcuts();
 if (backupOverlay && backupOverlay.classList.contains('active')) closeBackup();
 } else if (e.key === 't' || e.key === 'T') {
 if (!e.ctrlKey && !e.metaKey) toggleTheme();
 } else if (e.key === '?') {
 if (!e.ctrlKey && !e.metaKey && shortcutsOverlay) {
 shortcutsOverlay.classList.contains('active') ? closeShortcuts() : openShortcuts();
 }
 }
 });

 // ===== تعقب أيام القراءة المتتالية =====
 const STREAK_KEY = 'reading-streak';
 const STREAK_DATE_KEY = 'reading-streak-date';
 const streakToast = $('#streak-toast');
 const streakToastText = $('#streak-toast-text');

 function updateStreak() {
 try {
 const today = new Date().toDateString();
 const lastDate = localStorage.getItem(STREAK_DATE_KEY);
 let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);

 if (lastDate !== today) {
 const yesterday = new Date(Date.now() - 86400000).toDateString();
 if (lastDate === yesterday) {
 streak += 1;
 } else if (lastDate !== today) {
 streak = 1;
 }
 localStorage.setItem(STREAK_KEY, streak.toString());
 localStorage.setItem(STREAK_DATE_KEY, today);

 // إظهار تنبيه الأيام المتتالية
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 اليوم ' + streak + ' في القراءة المتواصلة. واصل!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* قد لا يتوفر localStorage */ }
 }
 updateStreak();

 // ===== النسخ الاحتياطي/الاستعادة =====
 function exportBackup() {
 try {
 const data = {
 version: '3.0',
 exportDate: new Date().toISOString(),
 theme: localStorage.getItem('theme'),
 fontSize: localStorage.getItem('fontSize'),
 readingPosition: localStorage.getItem(POSITION_KEY),
 readingChapter: localStorage.getItem(POSITION_CHAPTER_KEY),
 streak: localStorage.getItem(STREAK_KEY),
 streakDate: localStorage.getItem(STREAK_DATE_KEY),
 healthChecks: {},
 chapterChecks: {},
 bookmarks: [],
 ratings: {}
 };
 // جمع حالات الفحص الذاتي
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // جمع حالات إتمام الفصول
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // جمع الإشارات المرجعية
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // جمع التقييمات
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'نسخة-قراءة-PhoneClass_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('فشل تصدير النسخة الاحتياطية: ' + e.message);
 }
 }

 function importBackup(file) {
 const reader = new FileReader();
 reader.onload = (e) => {
 try {
 const data = JSON.parse(e.target.result);
 if (data.theme) localStorage.setItem('theme', data.theme);
 if (data.fontSize) localStorage.setItem('fontSize', data.fontSize);
 if (data.readingPosition) localStorage.setItem(POSITION_KEY, data.readingPosition);
 if (data.readingChapter) localStorage.setItem(POSITION_CHAPTER_KEY, data.readingChapter);
 if (data.streak) localStorage.setItem(STREAK_KEY, data.streak);
 if (data.streakDate) localStorage.setItem(STREAK_DATE_KEY, data.streakDate);
 // استعادة حالات الفحص الذاتي
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // استعادة حالات إتمام الفصول
 if (data.chapterChecks) {
 Object.keys(data.chapterChecks).forEach(id => {
 const sec = document.getElementById(id);
 if (sec) {
 const check = sec.querySelector('.chapter-check');
 if (check) check.classList.add('checked');
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('completed-toc');
 }
 });
 }
 // استعادة الإشارات المرجعية
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('نجحت الاستعادة! ستُعاد تحميل الصفحة لتطبيق كل البيانات.');
 location.reload();
 } catch(err) {
 alert('فشلت الاستعادة: صيغة الملف غير صحيحة. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('حذف كل بيانات القراءة؟ لا يمكن التراجع! صدّر نسخة احتياطية أولًا.')) return;
 if (!confirm('أكد مجددًا: كل تقدم القراءة والإشارات المرجعية والتقييمات ستُحذف. أترافق؟')) return;
 localStorage.clear();
 alert('حُذفت كل البيانات. ستُعاد تحميل الصفحة.');
 location.reload();
 }

 const backupExport = $('#backup-export');
 const backupImportBtn = $('#backup-import-btn');
 const backupImportInput = $('#backup-import-input');
 const backupReset = $('#backup-reset');
 if (backupExport) backupExport.addEventListener('click', exportBackup);
 if (backupImportBtn && backupImportInput) {
 backupImportBtn.addEventListener('click', () => backupImportInput.click());
 }
 if (backupImportInput) backupImportInput.addEventListener('change', (e) => {
 if (e.target.files[0]) importBackup(e.target.files[0]);
 });
 if (backupReset) backupReset.addEventListener('click', resetAllData);

 // ===== نظام تقييم الفصول =====
 sections.forEach(sec => {
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const ratingDiv = document.createElement('div');
 ratingDiv.className = 'chapter-rating';
 ratingDiv.dataset.rating = localStorage.getItem('rating-' + sec.id) || '0';
 for (let i = 1; i <= 5; i++) {
 const star = document.createElement('span');
 star.className = 'star';
 star.textContent = '★';
 star.dataset.value = i;
 star.addEventListener('click', () => {
 const current = parseInt(ratingDiv.dataset.rating, 10);
 const newRating = current === i ? 0 : i;
 ratingDiv.dataset.rating = newRating;
 localStorage.setItem('rating-' + sec.id, newRating);
 updateStars(ratingDiv);
 });
 ratingDiv.appendChild(star);
 }
 // الإدراج بعد h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== تحسين مضاد للاهتزاز في التمرير =====
 let scrollTicking = false;
 const originalOnScroll = onScroll;
 function debouncedScroll() {
 if (!scrollTicking) {
 requestAnimationFrame(() => {
 originalOnScroll();
 scrollTicking = false;
 });
 scrollTicking = true;
 }
 }
 window.removeEventListener('scroll', onScroll);
 window.addEventListener('scroll', debouncedScroll, { passive: true });

 // ===== اتباع الوضع الداكن للنظام =====
 if (window.matchMedia) {
 const mq = window.matchMedia('(prefers-color-scheme: dark)');
 if (mq.addEventListener) {
 mq.addEventListener('change', (e) => {
 if (!localStorage.getItem('theme')) {
 applyTheme(e.matches ? 'dark' : 'light');
 }
 });
 } else if (mq.addListener) {
 mq.addListener((e) => {
 if (!localStorage.getItem('theme')) {
 applyTheme(e.matches ? 'dark' : 'light');
 }
 });
 }
 }

 // ===== إضافة مسار تنقل ووسوم صعوبة تلقائيًا إلى عناوين الفصول =====
 sections.forEach(sec => {
 const id = sec.id || '';
 const h3 = sec.querySelector('h3');
 if (!h3) return;

 let level = 'intermediate';
 if (id.startsWith('di-ling') || id.startsWith('di-yi') || id.startsWith('di-er') || id.startsWith('di-san') || id.startsWith('di-er-shi-qi') || id.startsWith('di-er-shi-ba') || id.startsWith('di-er-shi-jiu') || id.startsWith('di-san-shi') || id.startsWith('fu-lu')) {
 level = 'beginner';
 } else if (id.startsWith('di-shi-wu') || id.startsWith('di-shi-liu') || id.startsWith('di-shi-qi') || id.startsWith('di-shi-ba') || id.startsWith('di-shi-jiu') || id.startsWith('di-er-shi')) {
 level = 'intermediate';
 } else {
 level = 'advanced';
 }

 const text = sec.textContent || '';
 const minutes = Math.max(2, Math.round(text.length / 900));

 const meta = document.createElement('div');
 meta.className = 'flex flex-wrap items-center gap-2 mb-2 text-xs';
 meta.innerHTML = `
 <span class="difficulty-tag difficulty-${level}">
 
 ${level === 'beginner' ? 'مبتدئ' : level === 'intermediate' ? 'متوسط' : 'متقدم'}
 </span>
 <span class="reading-time">
 ~${minutes} دقيقة قراءة
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== إضافة فصول كتلة «خلاصة» =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">خلاصة الفصل</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['الهواتف القابلة للطي ناضجة لكنها ليست سائدة: جهاز «تتويج» لا «نجدة»', 'الطي العرضي = هاتف + لوحي؛ والطي الطولي = جراب + نظرة سريعة على الشاشة الخارجية', 'يناسب: القراءة المكثفة/الأعمال/الإبداع أثناء التعليق/النساء اللواتي يقدّرن الحمل السهل', 'ست فحوصات عند الشراء: نوع المفصلة، والشاشة الداخلية UTG، والتجعيد، وحجم الشاشة الخارجية، والوزن والسماكة، وسعر الإصلاح بعد الضمان', 'حيل حصرية: تعدد مهام بشاشة مقسومة، وتعليق بزاوية 90، ولقطة سريعة على الشاشة الخارجية، ووضع الحاسوب', 'جوهر العناية: لا فتح وإغلاق في البرد، وحماية من الحبيبات، ولا غشاء عادي على الشاشة الداخلية، والمفصلة بمعزل عن الغبار', 'التوقعات: التجعيد دائم، والهاتف أثقل وأسمك، والبطارية عادية، وقيمة إعادة البيع منخفضة، والإصلاح مكلف', 'فلسفة الشراء: تشتريه لشكله الفريد، لا لأنه «أكثر تقدمًا»'],
 'di-ling-zhang': ['افهم موقف الكتاب: علوم رقمية بلسان واضح ويدوية التنفيذ', 'أتقن نظام الرموز: ماذا تعني [الأزرار] و> والخط العريض والمائل', 'لماذا «يذوب» سعة الهاتف: الأسباب الرئيسية', 'ابنِ عادة تدوين مواصفات هاتفك بنفسك', 'الهاتف = خزنة أصول رقمية؛ والوقاية أولًا هي الفكرة الجوهرية', 'البيانات كثيرًا ما تساوي أكثر من العتاد نفسه'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + المودم ووحدات أخرى في شريحة واحدة', 'أنوية CPU الكبيرة والصغيرة تعمل معًا: توازن الأداء والبطارية', 'الشاشة: OLED/LCD، ومعدل التحديث، والسطوع التلقائي', 'جوهر نظام التصوير: حجم المستشعر أهم من عدد البكسلات', 'تطور المنافذ: Micro USB ثم Lightning ثم توحيد USB-C', 'يمنح 5G-A قدرة «وحدة الاتصال والاستشعار» الجديدة'],
 'di-yi-zhang-harmony': ['HarmonyOS نظام تشغيل موزع صُمم لتعدد الأجهزة منذ اليوم الأول', 'HarmonyOS 4.3 متوافق مع AOSP ويشغّل تطبيقات أندرويد', 'HarmonyOS NEXT مستقل تمامًا ولم يعد يدعم تطبيقات أندرويد', 'قبل الترقية تأكد أن تطبيقاتك المألوفة لها إصدارات أصلية'],
 'di-er-zhang': ['تخزين ثلاثي الطبقات: الجهاز / بطاقة SD / السحابة', 'معنى المجلدات الشائعة في أندرويد (DCIM وDownload وغيرهما)', 'نسخ البيانات = نسخة سحابية + نسخة محلية، حماية مزدوجة', 'الحذف ليس إتلافًا؛ «الكتابة فوقها» وحدها تمحو فعلًا', 'دليل سريع لصيغ الملفات الشائعة (صورة/صوت/فيديو/مستند)', 'التسمية «تاريخ + حدث» هي القاعدة الأساسية', 'التنظيف التلقائي بعد 72 ساعة يحل تراكم ذاكرة تطبيقات التواصل المؤقتة', 'حماية مزدوجة للصور: تغطية + إزالة EXIF'],
 'di-san-zhang': ['لكل من 4G/5G موقعه؛ والـ5G-A نسخة معززة', 'الفروق التقنية الجوهرية بين Wi-Fi 6/6E/7', 'الواي فاي العام يستوجب الحذر: لا تُدخل بيانات حساسة', 'بلوتوث 5.x يواصل التطور، وLE Audio بدأ انتشارًا', 'NFC يعمل في نطاق 10 سم؛ القرب المادي نفسه هو الضمانة الأمنية'],
 'di-si-zhang': ['ثبّت التطبيقات من المتاجر الرسمية أولًا', 'حزمة APK = شهادة + موارد + إعدادات + كود ثنائي', 'احترس من تطبيقات «التنظيف والتسريع»؛ وبقاء التطبيقات في الخلفية أمر مشروع', 'التحقق من توقيع التطبيق يمنع العبث: حماية على مستوى النظام', 'الوضع النقي = التثبيت من المتجر الرسمي وحده: الجدار الأول أمام البرمجيات الخبيثة', '«الطفيليات الرقمية» تعني النسخ المقرصنة المزروعة فيها أحصنة طروادة', 'آلية مراجعة متاجر التطبيقات: فحص فيروسات + مراجعة أذونات + توثيق المطوّرين'],
 'di-wu-zhang': ['الشاشة: الدقة، ومعدل التحديث، والسطوع التلقائي', 'الصوت: مستوى الرنين/الوسائط/الإشعارات يُدار كل على حدة', 'التخزين: نظّف الذاكرة المؤقتة والملفات غير الضرورية بانتظام', 'القياسات الحيوية: بصمة أم وجه؟ ثلاثي الأبعاد أأمن من ثنائي', 'قارئات الشاشة: VoiceOver في iOS / TalkBack في أندرويد هما عينا المستخدمين ضعاف البصر', 'التكبير: تباين عالٍ وخط عريض ومرشحات ألوان: ثلاثية', 'وصف الصور بالذكاء الاصطناعي: دع الذكاء الاصطناعي يقرأ الصور والقوائم والكابتشا نيابة عنك', 'الترجمة الفورية على الشاشة منقذ لضعاف السمع وللأماكن الصاخبة', 'RTT/TTY: من فقد الصوت أو السمع يستطيع الاتصال أيضًا'],
 'di-liu-zhang': ['رمز قفل الشاشة + التحقق الثنائي خط الدفاع الأساسي', 'أذونات التطبيقات: فعّلها حسب الحاجة، بمبدأ أقل امتياز', 'لا دفعات ولا دخول لحسابات عبر الواي فاي العام', 'في عصر الذكاء الاصطناعي لا يكفي أن ترى لتصدق: الوجه والصوت المزيفان، وانتحال الشخصيات المهمة، والاستثمارات الوهمية أشهر الحيل', 'خطة الخروج: تحقق بحركة + كلمة سر مشتركة + تأكيد ثانٍ', 'جهّز الصور قبل مشاركتها: أوقف الموقع وبيانات الجهاز في EXIF', 'أجهزة إنترنت الأشياء: غيّر كلمة المرور الافتراضية', 'إذا احتالك فتذكر: لا تثق بسهولة، ولا تفش، ولا تحوّل'],
 'di-qi-zhang-jichu': ['الأقمار: «حبل النجاة» في الطوارئ', 'التخاطب دون شبكة: نداء بعيد المدى حتى بلا تغطية', 'كشف الحوادث: دمج المستشعرات يتعرف على الاصطدامات الشديدة', 'StarFlash: اتصال لاسلكي منخفض التأخير بكنز إمكانات'],
 'di-ba-zhang': ['تسجيل المكالمات: انتبه للجانب القانوني', 'iMessage/RCS يرقّيان الرسائل النصية التقليدية إلى وسائط غنية', 'سجل محادثات WeChat يحتاج وظيفة النسخ الاحتياطي الداخلية لـ WeChat', 'تطبيقات البريد تدير حسابات متعددة بشكل موحد', 'حجب التحرش: التعرف النظامي + القوائم السوداء/البيضاء + مرشحات كلمات الرسائل النصية', '«كتم المتصلين المجهولين» في iOS يصد الإزعاج، لكن انتبه للمكالمات الفائتة', 'الوسم الخاطئ كإزعاج يُطعن عبر Dianhua Bang/360/Tencent وقنوات المشغل'],
 'di-jiu-zhang': ['WPS Office أفضل تجربة في الصين، وMicrosoft 365 الأفضل توافقًا', 'الملاحظات بثلاث مراحل: سجلت → أقرأه لاحقًا → منظومة معرفة', 'المسح بالهاتف: الملاحظات/Mic Lens/Baimiao/CamScanner', 'تخزين سحابي حسب الحاجة: iCloud/OneDrive/بايدو/Aliyun Drive، لكل منها سيناريوهاته'],
 'di-shi-zhang': ['من يرى رمز الدفع يحصل على المال: لا ترسل له لقطة شاشة لأي أحد أبدًا', 'فحص أمني من 5 دقائق: الدفع الحيوي + القفل الأمني + مراجعة الدفع بلا رمز + إدارة الأجهزة', 'في المترو والحافلة، يُفضَّل بطاقة المواصفات الافتراضية في محفظة الهاتف: تعمل حتى دون اتصال', 'شهادة التأمين الصحي الإلكترونية، واستعلامات المعاش، والإقرار الضريبي: كلها من الهاتف', 'أربع نيم أمام النصب: لا تحويل إلى «حساب آمن»، ولا إرسال رمز الدفع، ولا لمس روابط مجهولة، ولا إعطاء رقم البطاقة البنكية'],
 'di-shi-yi-zhang': ['أربعة أخطاء شائعة: عدسة وسخة، وعدم ضبط التعريض، وإفراط في الفلاش، وسوء استخدام التكبير الرقمي', 'الوضع الليلي يدمج إطارات متعددة؛ ثبّت اليد 2-4 ثوانٍ', 'الوضع الاحترافي: ISO منخفض صورة أنقى، وسرعة الغالق تدير الضوء', 'سلسلة المعالجة: تصحيح → تعديلات أساسية → تنقيح موضعي → تنميط', 'البحث الذكي + التنظيف الدوري + الألبومات اليدوية = ثلاثية إدارة الصور'],
 'di-shi-yi-zhang-advanced': ['أركان الفيديو الثلاثة: الدقة، ومعدل الإطارات، ومعدل البت', 'H.265 يضغط أفضل من H.264 بنسبة 50%', 'ProRes كودك أبل الاحترافي: ملفات عملاقة', 'HDR10/10+/Dolby Vision لكل منها نيشته'],
 'di-shi-er-zhang': ['NetEase Cloud Music الأقوى في القوائم والمجتمع، وQQ Music الأوسع كتالوجًا، وApple Music نظيفة وبلا فقدان، وSpotify قوية التوصيات', 'Xiaoyuzhou الخيار الأول للبودكاست الصيني؛ وأحسِن استخدام التسريع والتنظيف التلقائي', 'الفيديو المحلي: VLC (كل الصيغ) أو nPlayer (تحكم بالإيماءات)', 'التسطير في WeChat Read اجتماعي + مزامنة Kindle؛ ووضع حماية العين يبقى مفعّلًا دائمًا', 'وضع الألعاب أولوية إبقاء الإطارات سلسة؛ ومع السخونة يساعد مروحة التثبيت'],
 'di-shi-san-zhang': ['أدوات الإنتاجية: مهام + بومودورو + تقويم', 'الصحة والرياضة: Apple Health/Google Fit مركز البيانات', 'المتصفح: Edge أولًا، ومع Copilot لزيادة الإنتاجية', 'ابحث عن الصدق: اعتمد النطاقات الرسمية، وتجنب اللواحق الرخيصة مثل .xyz', 'فضّل التنظيف المدمج؛ وأدوات الطرف الثالث مثل Qingzhuo مجرد إضافة، ولا تنظيف شامل بلمسة واحدة', 'تطبيقات مكافحة الإزعاج: المركز الوطني لمكافحة الاحتيال + حرّاس الشركات + حجب المشغل', 'الحجب المدمج: في iOS «كتم المتصلين المجهولين»؛ وفي أندرويد يُفعَّل داخل تطبيق الهاتف لكل شركة', 'ثلاث طبقات مجتمعة: حجب النظام + المشغل + مركز مكافحة الاحتيال؛ وانتبه للقائمة البيضاء كي لا تحجب رفاقك', 'إنذارات الطقس: تطبيق الطقس النظامي + القنوات الرسمية؛ وتصرّف حسب المستويات الأزرق/الأصفر/البرتقالي/الأحمر', 'إنذارات الكوارث الطبيعية: الأرصاد + الدفاع المدني؛ وفي الأمطار الغزيرة والأعاصير ابتعد عن المنخفضات واللوحات الإعلانية', 'الإنذار المبكر للزلازل ليس تنبؤًا: ثوانٍ إلى عشرات الثواني مقدمًا؛ وفي أندرويد غالبًا في إعدادات الأمان', 'TickTick: قوائم + تقويم + بومودورو، وجدولة بلغة طبيعية', 'رقن الورق: كاميرا النظام/Mic Lens/Baimiao/CamScanner؛ صوّر بوضوح ثم OCR', 'التحكم عن بعد في الحاسوب: Sunflower/ToDesk؛ وأن يطلب منك غريب تثبيت تحكم عن بعد = احتيال', 'الذكاء الاصطناعي في المكتب: Trae وغيره؛ الشاق على الحاسوب، ومن الهاتف تتابع عن بعد', 'النقل السريع داخل الشبكة المحلية: LocalSend/AirDrop/Feige؛ الحافظة: KDE Connect/أدوات الشركات', 'رموز 2FA للاستخدام الواحد: Aegis/Microsoft Authenticator، ونسخ ورقية من رموز الاسترجاع في مكانين'],
 'di-shi-si-zhang': ['مع مدير كلمات المرور يكفي تذكر كلمة رئيسية واحدة', 'Bitwarden مفتوح المصدر ومجاني، و1Password أفضل تجربة', 'يجب أن تكون كلمة المرور الرئيسية طويلة معقدة، مع تفعيل التحقق الثنائي', 'راجع أمان كلمات مرورك بانتظام', 'معمارية المعرفة الصفرية: حتى المزود لا يرى كلمات مرورك؛ والتشفير يتم محليًا', 'AES-256 + اشتقاق المفاتيح PBKDF2/Argon2 هما حجر الأساس لأمان خزنة كلمات المرور', 'عبرة حادثة LastPass عام 2022: الأكثر تضررًا مَن معهم كلمة مرور رئيسية ضعيفة', 'قوة كلمة المرور في «الإنتروبيا»: الطول + العشوائية تغلب الرموز المعقدة', 'HaveIBeenPwned يفحص التسريبات، و1Password Watchtower يراقب الحوادث', 'تُبنى Passkey على FIDO2/WebAuthn: مقاومة للتصيد، ولا تُنقل كلمة مرور إطلاقًا', 'مزامنة Passkey بين الأجهزة: حزمة مفاتيح iCloud/مدير كلمات مرور Google يدعمانها أصلًا', 'المفاتيح المادية (YubiKey/Titan) تصمد أمام التصيد واختطاف الشريحة - مثالية للأشخاص الأكثر عرضة', 'الخزائن المشتركة في 1Password + الوصول الطارئ في Bitwarden يجعلان المشاركة العائلية والجماعية أكثر أمانًا'],
 'di-shi-wu-zhang': ['بطاريات الليثيوم: اشحنها كلما احتجت، تكره الحرارة، وتشيخ', 'تحت 80% من صحة البطارية يتراجع زمن العمل بشكل ملحوظ', 'بروتوكولات الشحن السريع: PD/QC/VOOC/SuperCharge غير قابلة للتبادل', 'الشحن اللاسلكي Qi2 أضاف المحاذاة المغناطيسية', 'جوهر توفير الطاقة: خفّض السطوع + أغلق الخلفية + انتقل إلى 4G'],
 'di-shi-liu-zhang': ['الحساب هو سجل قيدك في الحياة الرقمية: يربط جهات الاتصال والصور والمشتريات وتعقب الهاتف', 'ثلاثة واجبات: فعّل التحقق الثنائي، واضبط مفتاح الاسترجاع، وتأكد أن تعقب الهاتف مفعّل', 'خمسة جيجابايت في iCloud لا تكفي: نظّف أو انتقل إلى 50 جيجابايت بنحو ¥1 شهريًا', 'المزامنة ثنائية الاتجاه (حذفت هنا فزال في كل مكان)، والنسخة الاحتياطية لقطة باتجاه واحد (حذفت هنا وبقيت هناك)', 'مستخدمو أندرويد يفحصون كلًا على حدة: النسخ السحابي للشركة، ونسخ جوجل، ونسخ WeChat'],
 'di-shi-qi-zhang': ['العمل عبر الأجهزة: AirDrop من أبل/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/الربط بويندوز', 'الإرسال إلى التلفاز: الآيفون عبر «ميزان الشاشة»، وأندرويد عبر الإرسال اللاسلكي؛ عند الفشل تحقق من أنكما على الشبكة نفسها', 'الساعة الذكية = مرشح إشعارات + محطة صحة + دفع من الرسغ؛ لأمك ووالدك قد تنقذ الموقف', 'المنزل الذكي تختاره بحسب النظام البيئي: Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'أمان الربط: في الأماكن العامة انتبه للخصوصية أثناء البث، وأزل ربط الأجهزة القديمة في حينه'],
 'di-shi-ba-zhang': ['نسخة كاملة: محليًا على الحاسوب (الأكثر موثوقية) + السحابة (الأكثر راحة)، حماية مزدوجة', 'سجل محادثات WeChat حالة خاصة: لا ينقله سوى النسخ الاحتياطي الداخلي لـ WeChat، وأدوات الترحيل عاجزة', 'قاعدة 3-2-1: ثلاث نسخ، ووسيطان، وواحدة خارج المنزل', 'تغيير الهاتف: الشركة نفسها تستخدم تطبيق الترحيل الرسمي؛ وبين الشركات جهّز مسبقًا جسرًا لنقل البيانات'],
 'di-shi-jiu-zhang': ['البطء والسخونة في أربع خطوات: تذكّر ما تغيّر → افحص التخزين → افحص الاستهلاك → افحص الإشارة', 'روتين التطبيق المنهار: أغلقه وافتحه → حدّثه → راجع الأذونات → امسح الذاكرة المؤقتة → أعده تثبيته', 'لا يشحن: نظّف المنفذ أولًا، ثم بدّل الكابل والشاحن تبادليًا لعزل الجاني', 'لا شبكة: أطفئ وضع الطيران وأعده → انسَ شبكة الواي فاي وأعد الاتصال → أعد تشغيل الراوتر', 'إعادة التشغيل الشاملة تحل معظم المشكلات الغريبة؛ وللإصلاح اختر مراكز معتمدة، وقبل التسليم: نسخة احتياطية + الخروج من الحسابات'],
 'di-er-shi-zhang-jinjie': ['وضع المطوّر: سبع نقرات على رقم الإصدار لتفعيله', 'قفل BL: حماية الشركة المصنعة؛ افتحه بحذر', 'الـRoot: المخاطر تفوق المنفعة؛ غير موصى به للمستخدم العادي', 'Magisk ما يزال يحتاج فتح BL، لكنه يستطيع إخفاء حالة الـroot'],
 'di-er-shi-yi-zhang': ['الـVPN نفق مشفر؛ والـVPN المجاني قد يكون من يسرق بياناتك', 'الدفاع عن الوسيط الخفي في الواي فاي العام: ثق بـ HTTPS، وأوقف الاتصال التلقائي، والحساس في التقميل فقط', 'مصافحة HTTPS تشفر في أربع جولات، لكن مواقع التصيد تستخدم HTTPS أيضًا', 'DoH/DoT تشفر استعلامات DNS فلا يتلصص مزود الخدمة على تنقلك', 'وضع التخفي ممحاة محلية لا عباءة غياب: مزود الخدمة والمواقع ما زالوا يرونك', 'قائمة الأمان: أوقف الاتصال التلقائي بشبكات الواي فاي، وانتقل إلى DNS مشفر، وفعّل التحقق الثنائي 2FA، وراجع أذونات التطبيقات، وامنع Juice Jacking'],
 'di-er-shi-er-zhang': ['كاميرا الذكاء الاصطناعي: تمييز المشهد → دمج الإطارات → تحسين ذكي', 'المساعدات الصوتية: تسمع → تفهم → تنفذ، ثلاث خطوات', 'الذكاء الاصطناعي على الجهاز: سريع، حريص على الخصوصية، يعمل دون اتصال', 'النماذج الكبيرة تغطي دردشة/كتابة/ترجمة/صور/تعلّم', 'استخدامات نموذجية: الترجمة الفورية، وممحاة الذكاء الاصطناعي، وتعديل الصور، ومعالجة المستندات، والبحث عن الصور بالذكاء الاصطناعي', 'إطار CRISPE للأوامر التوجيهية: دور + طلب + سياق + مخرجات + نبرة + أمثلة', 'مع الذكاء الاصطناعي احذر الهلوسة وتسريبات الخصوصية', '«الدور-السياق-المهمة-القيود» مدخل أسهل إلى عالم الأوامر التوجيهية', 'سمات الأمر الجيد: محدد، ومعه سياق، ومعه صيغة، ومعه قيود، وقابل للتحقق'],
 'di-er-shi-san-zhang': ['عناصر الأتمتة: مُشغِّل + إجراء + منطق قرار اختياري', 'اختصارات iOS: روتين الصباح بلمسة، وتوفير الطاقة تلقائيًا، وتسجيل المصاريف بالمسح', 'أندرويد: النقر التلقائي (ماكرو الشاشة)، وTasker (أقوى أتمتة)، وMacroDroid (ودود للمبتدئين)', 'المصائد: مشغلات الموقع غير الدقيقة، وiOS لا يعمل تلقائيًا دون تأكيد يدوي، وTasker يحتاج إذن إمكانية الوصول', 'عقلية الأتمتة: حوّل العمل المتكرر إلى «شرط → إجراء»، ويصبح الهاتف مساعدك الشخصي'],
 'di-er-shi-si-zhang': ['الـBootloader حارس البوابة عند الإقلاع؛ والتحقق من التوقيع يمنع العبث', 'سياسات فتح BL تختلف بين الشركات (شاومي تسمح/هواوي تمنع)', 'خيارات الـRoot: Magisk/KernelSU/SuperSU', 'ثلاثة أنواع للتفليش: ROM رسمي/Recovery من طرف ثالث/ROM من طرف ثالث'],
 'di-er-shi-wu-zhang': ['بيع الهاتف القديم: نسخة احتياطية → خروج من الحسابات → مسح مشفر → ملء ومسح مجددًا', 'الإرث الرقمي: جهة إرث iCloud/حساب Google غير النشط', 'التدوير: قدّم برامج الاستبدال الرسمية؛ والهاتف القديم قد يعمل كاميرا أو ملاحًا'],
 'di-er-shi-liu-zhang': ['ثلاثة معايير لهاتف الذكاء الاصطناعي: نموذج كبير على الجهاز، وقدرة NPU بوحدة TOPS، وAI Agent عبر التطبيقات', 'استراتيجيات الذكاء الاصطناعي لدى المصنعين: أبل/جوجل/هواوي/شاومي/OPPO/vivo ولكلٍّ نقاط قوته', 'الأقمار: رسائل BeiDou القصيرة بلغت الفئة الوسطى، ومكالمات Tiantong ما تزال للفئة العليا', 'القابلة للطي: عتاد ناضج، وتطبيقات متوافقة بنسبة سبعين بالمئة تقريبًا، والتعليق وتقسيم الشاشة هما التجربة الفريدة', 'الجيل السادس لا يزال في الطريق، وWi-Fi 7 وصل، وبلوتوث LE Audio بدأ ينتشر', 'بطاريات الأنود بالسيليكون-كربون تجعل 5000-6000mAh معيار الفئة العليا'],
 'di-er-shi-qi-zhang': ['فعّل أولًا الوضع المبسط أو كبّر الخطوط والأيقونات: حين تضبط البيئة تختفي نصف المشكلات', 'ثلاث قواعد حديدية مع الكبار: لا تستعجل، واستخدم التشبيهات، واكتب', 'ست احتيالات شائعة يجب التنبيه إليها مرارًا؛ وثلاثة خطوط دفاع تصد 90% من النصب', 'المساعدة عن بعد تتيح لك إصلاح هاتف والديك وأنت في مدينة أخرى', 'وضع الرعاية في WeChat + الإدخال الصوتي أهم وظيفتين لكبار السن', 'نداء SOS وكشف السقوط إعدادات تنقذ الحياة في اللحظة الفاصلة'],
 'di-er-shi-ba-zhang': ['اختيار الهاتف في ثلاث خطوات: الاحتياجات أولًا ثم الميزانية ثم الطراز', 'خمسة معايير فقط تهم: المعالج، والشاشة، والكاميرا، والبطارية والشحن، ووعد التحديثات', 'من ¥1500 إلى 3500 هي النطاق الأفضل قيمة والأكثر ترشيحًا', 'فئة العام الماضي العليا أوفر من الفئة الوسطى هذه السنة', 'خمس مصائد: خرافة الكاميرات المتعددة، وعبادة الميجابكسل، وإصدارات المشغلين، وتقديس الشاشة المنحنية، وحيل الذكاء الاصطناعي', '618 و«الاثنا عشر المزدوج» أفضل نافذتين في السنة لشراء هاتف'],
 'di-er-shi-jiu-zhang': ['انظر أولًا إلى بيانات وقت الشاشة؛ فإدراك الواقع خطوة التغيير الأولى', 'ضع حدودًا لتطبيقات الترفيه ومواعيد لوضع الهدوء، واستعد انتباهك', 'قاعدة 20-20-20 أبسط وأجدى عادة للعناية بالعين', 'الانحناء نحو الهاتف يحمّل الرقبة 5-6 أضعاف وزن الرأس؛ ارفع الهاتف ومُد الرقبة بين حين وآخر', 'الساعة قبل النوم بلا هاتف؛ وضع الشاحن خارج مدى اليد', 'ترياق قلق المعلومات هو «الحجب النشط» لا «الحصول على المزيد»'],
 'di-san-shi-zhang': ['ثلاثة معسكرات للبث اللاسلكي: AirPlay (أبل) وMiracast (أندرويد) وDLNA (إرسال وسائط عبر الأنظمة كلها)', 'الإرسال بالكابل أثبت وبلا تأخير؛ وفي قاعة الاجتماعات لا غنى عن محول HDMI', 'وضع Samsung DeX/سطح المكتب من هواوي يحولان الهاتف إلى حاسوب مكتب خفيف', 'الاتصال في السيارة: أربعة حلول - CarPlay/Android Auto/HiCar/CarLife', 'قواعد البث في قاعة الاجتماعات: جرّب مسبقًا، وجهّز الخطة ب، وأخف معاينة الإشعارات'],
 'di-san-shi-yi-zhang': ['قبل التصوير ضع أمرك: من الجمهور، وما القيمة التي تقدمها، وعلى أي منصة تنشر', 'خمس مهام قبل التصوير: دقة 1080P وسرعة 30fps، وتنظيف العدسة، وتثبيت التركيز والتعريض، واختيار الاتجاه، وتشغيل الشبكة', 'خمس حركات كاميرا: اقتراب، وإبعاد، وتحويم، وإزاحة، وتتبع - والثبات أولًا', 'المونتاج بـ CapCut: القص → الانتقالات → الترجمة → الموسيقى → التصدير، في ست خطوات', 'أول 3 ثوانٍ تحدد المصير؛ فيديو واحد يروي فكرة واحدة؛ والاستمرارية أهم من الموهبة'],
 'di-san-shi-er-zhang': ['الهاتف المفقود، 30 دقيقة ذهبية: استعر هاتفًا واتصل بنفسك → قفل عن بُعد → إيقاف الشريحة → تجميد الدفعات → إبلاغ الأهل والأصدقاء → إبلاغ الشرطة', '72 ساعة بعد الاحتيال: أوقف التحويلات → احفظ الأدلة → اتصل بـ 96110 → أبلغ الشرطة → تواصل مع البنك → غيّر كلمات المرور', 'الهاتف مصاب: الوضع الآمن → إزالة التطبيقات المشبوهة → فحص أمني → إعادة ضبط المصنع (الحل الأخير)', 'الحساب مسروق: غيّر كلمة المرور → سجّل الخروج من الأجهزة → راجع سجل الدخول → فعّل التحقق الثنائي → راجع الارتباطات → راجع الدفعات', '99.9% من رسائل الفدية احتيال: لا ترد، لا تدفع، صوّر الشاشة واحظر', 'احتيال بالوجه/الصوت المقلد: راقب الخلل في الرمش والفم والحواف والإضاءة؛ اطلب تدوير الرأس أو تغطية الوجه، وطرح أسئلة شخصية، والاتصال العكسي على رقم معروف', 'اختطاف شريحة SIM: إذا ظهر "لا خدمة" فجأة فهو إنذار؛ اضبط رمز PIN للشريحة، وفعّل التحقق الثاني لدى المشغل، وانقل الحسابات المهمة إلى تطبيقات المصادقة', 'خمس عادات يومية: قفل الشاشة + التحقق الثنائي، وتعقب الهاتف، ورمز PIN للشريحة، ولا تطبيقات مجهولة، ونسخ احتياطي منتظم', 'زلزال/طقس متطرف: احتمِ قريبًا أولًا ثم أخلُ؛ والرسالة النصية تستهلك أقل من مكالمة طويلة', 'بلا إشارة، قدّم SOS عبر الأقمار (إن دعمه الجهاز)؛ والإنذارات والإعدادات في الفصل 13'],
 'di-san-shi-san-zhang': ['Vision Pro ونظارات AR مداخل حوسبة جديدة خارج الهاتف، لكنها لن تستبدله قريبًا', 'واجهات الدماغ والحاسوب تبعد 10-20 سنة عن المستهلك، والأخلاقيات تنضج قبل التكنولوجيا', 'الهاتف يتطور نحو «الاختفاء»: من مركزية الجهاز إلى مركزية الهوية', 'أخلاقيات الذكاء الاصطناعي وسيادة البيانات والفجوة الرقمية هي قضايا العقد القادم المحورية', 'البقاء متصلًا والمحافظة على الاستقلال: فلسفة الحياة الرقمية التي لا تتغير'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // تجاوز الفصول التي فيها خلاصة مدمجة أصلًا تجنبًا للتكرار
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== زر النسخ (يضاف إلى عناصر kbd) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'نسخ');
 btn.addEventListener('click', () => {
 const text = kbd.textContent.trim();
 navigator.clipboard.writeText(text).then(() => {
 btn.classList.add('copied');
 btn.innerHTML = '';
 setTimeout(() => {
 btn.classList.remove('copied');
 btn.innerHTML = '';
 }, 1500);
 }).catch(() => {});
 });
 kbd.parentNode.insertBefore(btn, kbd.nextSibling);
 });

 // ===== محتوى طويل قابل للطي (مستوى h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // طي أقسام h4 الطويلة فقط
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // إضافة ترويسة الطي
 const header = document.createElement('div');
 header.className = 'collapsible-header';
 header.innerHTML = '' + h4.innerHTML;
 if (h4.id) header.id = h4.id;
 h4.replaceWith(header);

 const body = document.createElement('div');
 body.className = 'collapsible-body';
 elements.forEach(el => body.appendChild(el));

 header.after(body);

 header.addEventListener('click', () => {
 const isCollapsed = body.classList.contains('collapsed');
 body.classList.toggle('collapsed', !isCollapsed);
 header.classList.toggle('collapsed', !isCollapsed);
 });
 }
 });
 });

 // ===== لوحة التعلم: تقدم القراءة + الفحص الذاتي لصحة الهاتف =====
 const dashProgressRing = $('#progress-ring-fg');
 const progressPercent = $('#progress-percent');
 const readCountEl = $('#read-count');
 const bookmarkCountEl = $('#bookmark-count');
 const lastChapterEl = $('#last-chapter');
 const healthScoreEl = $('#health-score');
 const healthBarEl = $('#health-bar');
 const healthMsgEl = $('#health-msg');
 const checkInputs = $$('.check-input');
 const DASH_RING_CIRCUMFERENCE = 213.6;

 function updateDashboard() {
 // تقدم القراءة
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // عدد الإشارات المرجعية
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // آخر فصل
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // الفحص الذاتي للصحة
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'الدرجة الكاملة! أمن هاتفك في حالة ممتازة';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'جيد! ' + (totalChecks - checked) + ' بندًا ينتظر التحسين';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'درجة مقبولة - أعطِ الأولوية لبنود الأمان غير المفعلة';
 else healthMsgEl.innerHTML = 'هاتفك فيه ثغرات أمنية - عالجها في أقرب وقت';
 }
 }

 // استعادة حالات العلامات
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // يحدّث كل 3 ثوانٍ (يلتقط علامات الفصول)
 setInterval(updateDashboard, 3000);

 // ===== القراءة الصوتية (TTS) =====
 const ttsControls = $('#tts-controls');
 const ttsPlayBtn = $('#tts-play');
 const ttsPrevBtn = $('#tts-prev');
 const ttsNextBtn = $('#tts-next');
 const ttsStopBtn = $('#tts-stop');
 const ttsSpeedUp = $('#tts-speed-up');
 const ttsSpeedDown = $('#tts-speed-down');
 const ttsSpeedDisplay = $('#tts-speed-display');
 const ttsLabel = $('#tts-label');
 const quickTtsBtn = $('#quick-tts');
 let ttsUtterance = null;
 let ttsSpeed = 1.0;
 let ttsActive = false;
 let ttsSectionIndex = -1;
 let ttsPendingPlay = false;
 const ttsSectionIds = sections.map(s => s.id);

 function updateTtsSpeedDisplay() {
 ttsSpeedDisplay.textContent = ttsSpeed.toFixed(1) + 'x';
 }

 function getSectionText(sec) {
 if (!sec) return '';
 // استنساخ وإزالة العناصر التي لا يجب قراءتها بصوت عالٍ
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // إزالة الأجسام المطوية مع الإبقاء على نصها
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('عذرًا، متصفحك لا يدعم القراءة الصوتية. جرّب Chrome أو Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'فصل بلا عنوان';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'ar-SA';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // محاولة استخدام صوت عربية أكثر طبيعية
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('ar'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // تشغيل الفصل التالي تلقائيًا
 if (ttsSectionIndex < sections.length - 1 && ttsActive) {
 ttsSectionIndex++;
 speakSection(ttsSectionIndex);
 } else {
 stopTts();
 }
 };

 ttsUtterance.onerror = (e) => {
 if (e.error !== 'interrupted' && e.error !== 'canceled') {
 console.warn('TTS error:', e.error);
 }
 stopTts();
 };

 window.speechSynthesis.speak(ttsUtterance);
 ttsPendingPlay = false;
 }

 function toggleTtsPlay() {
 if (!ttsActive) {
 // إيجاد الفصل المرئي حاليًا
 if (ttsSectionIndex < 0) {
 // يبدأ من البداية أو من أقرب فصل لموضع التمرير
 const scrollCenter = window.scrollY + window.innerHeight / 2;
 let closestIdx = 0;
 let closestDist = Infinity;
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 const secCenter = rect.top + window.scrollY + rect.height / 2;
 const dist = Math.abs(scrollCenter - secCenter);
 if (dist < closestDist) {
 closestDist = dist;
 closestIdx = i;
 }
 });
 ttsSectionIndex = closestIdx;
 }
 speakSection(ttsSectionIndex);
 } else if (window.speechSynthesis.speaking) {
 if (window.speechSynthesis.paused) {
 window.speechSynthesis.resume();
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 } else {
 window.speechSynthesis.pause();
 ttsPlayBtn.classList.remove('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '▶';
 }
 }
 }

 function stopTts() {
 window.speechSynthesis.cancel();
 ttsActive = false;
 ttsSectionIndex = -1;
 ttsUtterance = null;
 ttsPlayBtn.classList.remove('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '▶';
 ttsControls.classList.remove('active');
 ttsLabel.textContent = 'لم يبدأ';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // ربط الأحداث
 if (ttsPlayBtn) ttsPlayBtn.addEventListener('click', toggleTtsPlay);
 if (ttsStopBtn) ttsStopBtn.addEventListener('click', stopTts);
 if (ttsPrevBtn) ttsPrevBtn.addEventListener('click', () => {
 if (ttsSectionIndex > 0) {
 ttsSectionIndex -= 2;
 if (ttsSectionIndex < 0) ttsSectionIndex = 0;
 speakSection(ttsSectionIndex);
 }
 });
 if (ttsNextBtn) ttsNextBtn.addEventListener('click', () => {
 if (ttsSectionIndex < sections.length - 1) {
 speakSection(ttsSectionIndex + 1);
 }
 });
 if (ttsSpeedUp) ttsSpeedUp.addEventListener('click', () => {
 ttsSpeed = Math.min(2.5, ttsSpeed + 0.25);
 updateTtsSpeedDisplay();
 if (ttsActive && ttsUtterance) {
 ttsUtterance.rate = ttsSpeed;
 // إعادة إنشاء المقطع الحالي وتشغيله
 const idx = ttsSectionIndex;
 window.speechSynthesis.cancel();
 setTimeout(() => { if (ttsActive) speakSection(idx); }, 100);
 }
 });
 if (ttsSpeedDown) ttsSpeedDown.addEventListener('click', () => {
 ttsSpeed = Math.max(0.5, ttsSpeed - 0.25);
 updateTtsSpeedDisplay();
 if (ttsActive && ttsUtterance) {
 ttsUtterance.rate = ttsSpeed;
 const idx = ttsSectionIndex;
 window.speechSynthesis.cancel();
 setTimeout(() => { if (ttsActive) speakSection(idx); }, 100);
 }
 });
 if (quickTtsBtn) quickTtsBtn.addEventListener('click', toggleTtsPlay);

 // اختصار: زر R يبدّل القراءة الصوتية
 document.addEventListener('keydown', (e) => {
 if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
 if (e.key === 'r' || e.key === 'R') {
 if (!e.ctrlKey && !e.metaKey && !e.altKey) {
 toggleTtsPlay();
 }
 } else if (e.key === 'Escape' && ttsActive) {
 stopTts();
 }
 });

 // ===== التهيئة =====
 onScroll();
 tryRestorePosition();
 })();
 

/* Update checker: source = GitHub Releases (book channel: tags starting with v<digit>). */
(function(){
"use strict";
var PAGE_VERSION="v1.8";
var REPO="ClassTechStar/Your-Missing-Phone-Class";
function cmpVer(a,b){a=String(a).replace(/^v/,"");b=String(b).replace(/^v/,"");var A=a.split(/[-.]/),B=b.split(/[-.]/),i,x,y;for(i=0;i<Math.max(A.length,B.length);i++){x=parseInt(A[i]||"0",10);y=parseInt(B[i]||"0",10);if(x!==y)return x-y;}return 0;}
function show(tag,url){
var b=document.createElement("div");
b.style.cssText="position:fixed;left:12px;bottom:12px;z-index:99990;background:var(--accent-book);color:#fff;padding:10px 14px;border-radius:999px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center;max-width:92vw";
var t=document.createElement("span");t.textContent="New version "+tag+" is available";
var a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener";
a.textContent="View update";a.style.cssText="color:#fff;text-decoration:underline;font-weight:600";
var x=document.createElement("button");x.type="button";x.textContent="×";x.setAttribute("aria-label","Close");
x.style.cssText="background:rgba(255,255,255,.25);border:0;color:#fff;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:14px;line-height:1";
x.onclick=function(){b.remove();try{var s=JSON.parse(localStorage.getItem("pc-gh-update")||"{}");s.d=tag;localStorage.setItem("pc-gh-update",JSON.stringify(s));}catch(e){}};
b.appendChild(t);b.appendChild(a);b.appendChild(x);
document.body.appendChild(b);
setTimeout(function(){if(b.parentNode)b.parentNode.removeChild(b);},60000);
}
try{
if(location.protocol==="file:")return;
var st=null;try{st=JSON.parse(localStorage.getItem("pc-gh-update")||"null");}catch(e){}
var now=Date.now();
if(st&&st.v===PAGE_VERSION&&now-(st.t||0)<86400e3)return;
var done=function(){try{localStorage.setItem("pc-gh-update",JSON.stringify({t:now,v:PAGE_VERSION}));}catch(e){}};
fetch("https://api.github.com/repos/"+REPO+"/releases?per_page=30",{headers:{"Accept":"application/vnd.github+json"}}).then(function(r){return r.ok?r.json():[];}).then(function(list){
if(!Array.isArray(list))return done();
for(var i=0;i<list.length;i++){
var tag=String(list[i]&&list[i].tag_name||"");
if(/^v\d/.test(tag)){
if(cmpVer(tag,PAGE_VERSION)>0&&(!st||st.d!==tag))show(tag,list[i].html_url||("https://github.com/"+REPO+"/releases/tag/"+tag));
break;
}
}
done();
}).catch(function(){done();});
}catch(e){}
})();

