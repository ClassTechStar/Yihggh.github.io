
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

 // ===== Θέμα =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? 'Αλλαγή σε φωτεινή λειτουργία' : 'Αλλαγή σε σκούρα λειτουργία';
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

 // ===== Κύλιση: πρόοδος + σκιά + επιστροφή στην κορυφή + πρόοδος περιεχομένων + δακτύλιος προόδου =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} κεφάλαια`;

 // Παράμετροι δακτυλίου προόδου
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

 // Ενημέρωση δακτυλίου προόδου
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

 // Έως ποιο κεφάλαιο φτάσαμε
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} κεφάλαια`;
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

 // ===== Μνήμη θέσης ανάγνωσης =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // Πολύ νωρίς για αποθήκευση
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // Εντοπίζει το όνομα του τρέχοντος κεφαλαίου
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

 // Επαναφορά θέσης κατά τη φόρτωση της σελίδας
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
 restoreToastText.textContent = `Τελευταία ανάγνωση: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // Αυτόματη απόκρυψη μετά από 10 δευτερόλεπτα
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

 // ===== Κινούμενη εμφάνιση κατά την κύλιση =====
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
 // Το περιεχόμενο της πρώτης οθόνης σημειώνεται αμέσως ορατό
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== Άνοιγμα/κλείσιμο πλευρικής μπάρας =====
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

 // Γρήγορα εργαλεία: άνοιγμα περιεχομένων
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== Καθολική πλοήγηση με άγκυρες: αντιστάθμιση της μετατόπισης της σταθερής μπάρας =====
 // Πρέπει να χρησιμοποιείται scrollIntoView και όχι χειροκίνητος υπολογισμός συντεταγμένων: το .content-section έχει
 // content-visibility:auto + contain-intrinsic-size(0 800px): τα κεφάλαια εκτός οθόνης
 // καταλαμβάνουν placeholders 800px, το getBoundingClientRect επιστρέφει τις συντεταγμένες του placeholder, και ένα απευθείας scrollTo
 // θα προσγειωνόταν λάθος (όσο πιο βαθύ το κεφάλαιο, τόσο μεγαλύτερη η σωρευτική απόκλιση). Το scrollIntoView αφήνει στον πλοηγό
 // απεικονίζει τον στόχο κατά ζήτηση και τον τοποθετεί, και το html{scroll-padding-top:5rem} αντισταθμίζει τη σταθερή μπάρα
 // μπάρας.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // Βήμα 1: η κατάσταση instant αναγκάζει πρώτα την απεικόνιση του κεφαλαίου-στόχου και το τοποθετεί, ώστε το content-visibility να μην
 // μετατόπιση κατά την ομαλή κύλιση που προκαλείται από καθυστερημένη απεικόνιση.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // Βήμα 2: αφού απεικονιστεί ο στόχος και σταθεροποιηθούν οι συντεταγμένες, ενεργοποιούμε ομαλή κύλιση για άνετη αίσθηση.
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

 // ===== Αναδίπλωση περιεχομένων =====
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

 // ===== Φίλτρο περιεχομένων =====
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

 // ===== Επισήμανση στα περιεχόμενα =====
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

 // ===== Σύστημα σελιδοδεικτών =====
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

 // Προσθέτει κουμπί σελιδοδείκτη σε κάθε κεφάλαιο
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'Στους σελιδοδείκτες' : 'Σελιδοδείκτης') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'Αφαίρεση από σελιδοδείκτες' : 'Προσθήκη του κεφαλαίου στους σελιδοδείκτες');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'Στους σελιδοδείκτες' : 'Σελιδοδείκτης';
 btn.setAttribute('aria-label', added ? 'Αφαίρεση από σελιδοδείκτες' : 'Προσθήκη του κεφαλαίου στους σελιδοδείκτες');
 // Ενημερώνει τα σημάδια της πλευρικής μπάρας
 updateTocBookmark(id, added);
 });
 // Εισάγει μετά το h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // Αρχικοποίηση σημαδιών σελιδοδεικτών στην πλευρική μπάρα
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== Σημάδια ολοκληρωμένου κεφαλαίου =====
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
 // Εύρεση της σειράς meta ή του στοιχείου πριν από το h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'Διαβασμένο' : 'Διαβασμένο') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'Αναίρεση σήμανσης διαβασμένο' : 'Σήμανση ως διαβασμένο');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'Διαβασμένο' : 'Διαβασμένο';
 check.setAttribute('aria-label', done ? 'Αναίρεση σήμανσης διαβασμένο' : 'Σήμανση ως διαβασμένο');
 // Ενημέρωση πλευρικής μπάρας
 updateTocCompleted(id, done);
 // Ενημέρωση προόδου ανάγνωσης
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
 // Ενημερώνει και τον μετρητή ολοκληρωμένων
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} κεφάλαια`;
 }
 }

 // ===== Αναζήτηση (βελτιωμένη: πλοήγηση με πληκτρολόγιο + μετρητής αποτελεσμάτων) =====
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
 renderSearchPlaceholder('Πληκτρολόγησε λέξεις-κλειδιά για να ξεκινήσει η αναζήτηση');
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
 renderSearchPlaceholder('Δεν βρέθηκαν σχετικά αποτελέσματα');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">Βρέθηκαν ${results.length} αποτελέσματα</div>`;
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
 renderSearchPlaceholder('Πληκτρολόγησε λέξεις-κλειδιά για να ξεκινήσει η αναζήτηση');
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

 // Πλοήγηση αναζήτησης με πληκτρολόγιο
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

 // ===== Μέγεθος γραμματοσειράς =====
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

 // ===== Κλείσιμο πλευρικής μπάρας με σάρωση =====
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

 // ===== Πλοήγηση μεταξύ κεφαλαίων =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'Προηγούμενο κεφάλαιο'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'Επόμενο κεφάλαιο'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== Εκτύπωση =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== Καθολικές συντομεύσεις πληκτρολογίου =====
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

 // Κλείνει τα παράθυρα με κλικ στο παραπέτασμα
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
 // Την εκτύπωση την διαχειρίζεται ήδη ο πλοηγός
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

 // ===== Παρακολούθηση διαδοχικών ημερών ανάγνωσης =====
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

 // Εμφανίζει την ειδοποίηση διαδοχικών ημερών
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 Ημέρα ' + streak + ' συνεχόμενης ανάγνωσης. Συνέχισε έτσι!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* Το localStorage μπορεί να μην είναι διαθέσιμο */ }
 }
 updateStreak();

 // ===== Αντίγραφο ασφαλείας/επαναφορά =====
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
 // Συλλογή καταστάσεων αυτοελέγχου
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // Συλλογή καταστάσεων ανάγνωσης κεφαλαίων
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // Συλλογή σελιδοδεικτών
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // Συλλογή αξιολογήσεων
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'Αντίγραφο-Ανάγνωσης-PhoneClass_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('Αποτυχία εξαγωγής αντιγράφου: ' + e.message);
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
 // Επαναφορά καταστάσεων αυτοελέγχου
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // Επαναφορά καταστάσεων ανάγνωσης κεφαλαίων
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
 // Επαναφορά σελιδοδεικτών
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('Η επαναφορά πέτυχε! Η σελίδα θα ξαναφορτώσει για να εφαρμόσει όλα τα δεδομένα.');
 location.reload();
 } catch(err) {
 alert('Η επαναφορά απέτυχε: μη έγκυρη μορφή αρχείου. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('Διαγραφή όλων των δεδομένων ανάγνωσης; Η ενέργεια είναι μη αναστρέψιμη! Εξάγετε αντίγραφο ασφαλείας πρώτα.')) return;
 if (!confirm('Επιβεβαιώστε ξανά: όλη η πρόοδος ανάγνωσης, οι σελιδοδείκτες και οι αξιολογήσεις θα διαγραφούν. Συνέχεια;')) return;
 localStorage.clear();
 alert('Όλα τα δεδομένα διαγράφηκαν. Η σελίδα θα ξαναφορτώσει.');
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

 // ===== Σύστημα αξιολόγησης κεφαλαίων =====
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
 // Εισάγει μετά το h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== Βελτιστοποίηση anti-debounce κύλισης =====
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

 // ===== Ακολουθεί το σκούρο θέμα του συστήματος =====
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

 // ===== Αυτόματη προσθήκη ψωμιών και ετικετών δυσκολίας στους τίτλους κεφαλαίων =====
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
 
 ${level === 'beginner' ? 'Αρχάριος' : level === 'intermediate' ? 'Μέσος' : 'Προχωρημένος'}
 </span>
 <span class="reading-time">
 ανάγνωση ~${minutes} λεπτών
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== Προσθήκη μπλοκ «Σύνοψη» στα κεφάλαια =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">Σύνοψη κεφαλαίου</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['Τα πτυσσόμενα ώριμασαν αλλά δεν είναι κυρίαρχα: συσκευή «επίδειξης», όχι «σωτηρίας»', 'Οριζόντιο δίπλωμα = τηλέφωνο + ταμπλέτα· κάθετο δίπλωμα = τσέπη + κλεφτή ματιά στην εξωτερική οθόνη', 'Κατάλληλο για: εντατική ανάγνωση/επιχειρήσεις/δημιουργία στηριγμένου/γυναίκες που εκτιμούν τη φορητότητα', 'Έξι έλεγχοι στην αγορά: τύπος αρθρώματος, εσωτερική οθόνη UTG, πτύχωμα, μέγεθος εξωτερικής οθόνης, βάρος και πάχος, τιμή επισκευής εκτός εγγύησης', 'Αποκλειστικά κόλπα: πολυεργασία σε μισο-οθόνη, στήριγμα 90 μοιρών, ματιά στην εξωτερική οθόνη, λειτουργία PC', 'Ουσία συντήρησης: όχι άνοιγμα-κλείσιμο σε κρύο, προστασία από ξένα σωματίδια, ποτέ κοινή μεμβράνη στην εσωτερική οθόνη, η άρθρωση μακριά από σκόνη', 'Προσδοκίες: το πτύχωμα είναι μόνιμο, πιο βαρύ και παχύ, μέτρια μπαταρία, χαμηλή αξία μεταπώλησης, ακριβές επισκευές', 'Φιλοσοφία αγοράς: το αγοράζεις για το μοναδικό του σχήμα, όχι επειδή είναι «πιο προηγμένο»'],
 'di-ling-zhang': ['Κατανόησε τη θέση του βιβλίου: σαφής, πρακτική καθοδήγηση ψηφιακής τεχνολογίας', 'Εξοικειωθείτε με το σύστημα συμβόλων: τι σημαίνουν [κουμπιά], >, έντονα και πλάγια', 'Γιατί «σβήνει» η χωρητικότητα του τηλεφώνου: οι κύριες αιτίες', 'Φτιάξε τη συνήθεια να σημειώνεις τις προδιαγραφές του δικού σου τηλεφώνου', 'Το τηλέφωνο = θησαυρό ψηφιακών περιουσιακών στοιχείων· η πρόληψη πρώτα είναι η βασική ιδέα', 'Τα δεδομένα συχνά αξίζουν περισσότερο από το ίδιο το υλικό'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + μόντεμ και άλλες μονάδες σε ένα chip', 'Μεγάλοι και μικροί πυρήνες CPU δουλεύουν μαζί: ισορροπία επιδόσεων και μπαταρίας', 'Οθόνη: OLED/LCD, ρυθμός ανανέωσης, αυτόματη φωτεινότητα', 'Ο πυρήνας του συστήματος απεικόνισης: το μέγεθος του αισθητήρα μετράει περισσότερο από τα megapixel', 'Εξέλιξη θυρών: Micro USB → Lightning → ενοποίηση σε USB-C', 'Το 5G-A φέρνει τη νέα ικανότητα «ένωσης επικοινωνίας και αισθητηριακής αντίληψης»'],
 'di-yi-zhang-harmony': ['HarmonyOS = κατανεμημένο λειτουργικό σύστημα, σχεδιασμένο για πολλές συσκευές από την αρχή', 'Το HarmonyOS 4.3 είναι συμβατό με AOSP και μπορεί να τρέξει εφαρμογές Android', 'Το HarmonyOS NEXT είναι πλήρως ανεξάρτητο και δεν υποστηρίζει πια εφαρμογές Android', 'Πριν την αναβάθμιση βεβαιωθείτε ότι οι συνηθισμένες εφαρμογές έχουν εγγενείς εκδόσεις'],
 'di-er-zhang': ['Αποθήκευση τριών στρωμάτων: συσκευή / κάρτα SD / σύννεφο', 'Τι σημαίνουν οι συνήθεις φάκελοι του Android (DCIM, Download κ.λπ.)', 'Αντίγραφο δεδομένων = αντίγραφο σύννεφου + τοπικό αντίγραφο, διπλή προστασία', 'Η διαγραφή δεν είναι καταστροφή· μόνο η «επιστρώση» σβήνει πραγματικά', 'Γρήγορος οδηγός των κοινών μορφών αρχείων (εικόνα/ήχος/βίντεο/έγγραφο)', 'Η ονομασία «ημερομηνία + γεγονός» είναι η βασική σύμβαση', 'Ο αυτόματος καθαρισμός των 72 ωρών λύνει το κόλλημα της cache των κοινωνικών εφαρμογών', 'Διπλή προστασία φωτογραφιών: κάλυψη + αφαίρεση EXIF'],
 'di-san-zhang': ['Το 4G/5G έχουν ο καθένας τον ρόλο του· το 5G-A είναι η ενισχυμένη έκδοση', 'Οι κρίσιμες τεχνικές διαφορές του Wi-Fi 6/6E/7', 'Το δημόσιο Wi-Fi απαιτεί προσοχή: μην πληκτρολογείς ευαίσθητα στοιχεία', 'Το Bluetooth 5.x συνεχίζει να εξελίσσεται, το LE Audio αρχίζει να εξαπλώνεται', 'Το NFC δουλεύει έως 10cm: η ίδια η φυσική εγγύτητα είναι η εγγύηση'],
 'di-si-zhang': ['Εγκαθιστάς εφαρμογές κατά βάση από επίσημα καταστήματα', 'Πακέτο APK = πιστοποιητικό + πόροι + ρυθμίσεις + δυαδικός κώδικας', 'Προσοχή στις εφαρμογές «καθαρισμού-επιτάχυνσης»· είναι λογικό εφαρμογές να μένουν στο παρασκήνιο', 'Η επαλήθευση υπογραφής εφαρμογής εμποδίζει παραποίηση: προστασία σε επίπεδο συστήματος', 'Καθαρή λειτουργία = εγκαταστάσεις μόνο από το επίσημο κατάστημα: ο πρώτος τοίχος ενάντια στο malware', '«Ψηφιακά παράσιτα» εννοούνται οι πειρατικές εκδόσεις με τροιάνους μέσα τους', 'Μηχανισμός ελέγχου των καταστημάτων εφαρμογών: σάρωση ιών + έλεγχος δι και ωμάτων + πιστοποίηση προγραμματιστών'],
 'di-wu-zhang': ['Οθόνη: ανάλυση, ρυθμός ανανέωσης, αυτόματη φωτεινότητα', 'Ήχος: η ένταση κλήσης/μέσων/ειδοποιήσεων ρυθμίζεται χωριστά', 'Αποθήκευση: καθάριζε τακτικά cache και περιττά αρχεία', 'Βιομετρία: δακτυλικό αποτύπωμα vs πρόσωπο· το 3D νικά το 2D σε ασφάλεια', 'Αναγνώστες οθόνης: VoiceOver στο iOS / TalkBack στο Android είναι τα μάτια των χρηστών με προβλήματα όρασης', 'Μεγέθυνση: υψηλή αντίθεση, έντονο κείμενο και χρωματικά φίλτρα - το τρίπτυχο', 'Περιγραφή εικόνων με AI: άσε την AI να σου διαβάζει εικόνες, μενού και captcha', 'Οι ζωντανοί υπότιτλοι: σωτήρας για βαρήκοους και θορυβώδη περιβάλλοντα', 'RTT/TTY: όσοι έχασαν φωνή ή ακοή μπορούν επίσης να καλούν'],
 'di-liu-zhang': ['Κωδικός κλειδώματος οθόνης + επαλήθευση δύο παραγόντων είναι η βασική γραμμή άμυνας', 'Δικαιώματα εφαρμογών: ενεργοποίησε ανά ανάγκη, με την αρχή των ελάχιστων προνομίων', 'Καμία πληρωμή ή σύνδεση σε δημόσιο Wi-Fi', 'Στην εποχή της AI το να βλέπεις δεν σημαίνει να πιστεύεις: κλωνοποιημένα πρόσωπα και φωνές, ψεύτικη εξουσιοδότηση, φανταστικές επενδύσεις είναι τα συχνότερα κόλπα', 'Σχέδιο εξόδου: επαλήθευση με κίνηση + μυστική λέξη + δεύτερη επιβεβαίωση', 'Ανωνυμοποίηση πριν τον διαμοιρασμό: κλείστε τοποθεσία και στοιχεία συσκευής στα EXIF', 'Συσκευές IoT: άλλαξε τον προεπιλεγμένο κωδικό', 'Αν σε απάτησαν, θυμήσου: μην πιστεύεις εύκολα, μην αποκαλύπτεις, μην μεταφέρεις'],
 'di-qi-zhang-jichu': ['Δορυφόρος: το «γρανάζι σωτηρίας» σε έκτακτες ανάγκες', 'Επικοινωνία χωρίς δίκτυο: ραδιοσυζήτηση μεγάλης εμβέλειας και χωρίς σήμα', 'Ανίχνευση ατυχήματος: η σύντηξη αισθητήρων αναγνωρίζει σοβαρές συγκρούσεις', 'StarFlash: ασύρματη σύνδεση χαμηλής καθυστέρησης με τεράστιο δυναμικό'],
 'di-ba-zhang': ['Καταγραφή κλήσεων: προσέχετε τη νομική πλευρά', 'Το iMessage/RCS αναβαθμίζει το παραδοσιακό SMS σε πλούσια πολυμέσα', 'Το ιστορικό του WeChat απαιτεί τη δική του ενσωματωμένη λειτουργία αντιγράφου', 'Οι εφαρμογές αλληλογραφίας διαχειρίζονται πολλαπλούς λογαριασμούς ενιαία', 'Μπλόκο ενοχλήσεων: αναγνώριση συστήματος + μαύρες/άσπρες λίστες + φίλτρα λέξεων-κλειδιών σε SMS', 'Η «Σίγαση αγνώστων» στο iOS μπλοκάρει ενοχλήσεις, αλλά πρόσεχε τις αναπάντητες κλήσεις', 'Λάθος επισημάνσεις ως ανεπιθύμητα αναιρούνται μέσω Dianhua Bang/360/Tencent και των καναλιών του παρόχου'],
 'di-jiu-zhang': ['Το WPS Office λειτουργεί καλύτερα στην Κίνα, το Microsoft 365 έχει την καλύτερη συμβατότητα', 'Σημειώσεις σε τρία στάδια: σημειώθηκε → διαβαστεί αργότερα → σύστημα γνώσης', 'Σάρωση με τηλέφωνο: Σημειώσεις/Mic Lens/Baimiao/CamScanner', 'Σύννεφο ανάλογα με την ανάγκη: iCloud/OneDrive/Baidu/Aliyun Drive, το καθένα με τα δικά του σενάρια'],
 'di-shi-zhang': ['Όποιος βλέπει τον κωδικό πληρωμής παίρνει τα χρήματα: μη στείλεις ποτέ στιγμιότυπό του σε κανέναν', 'Έλεγχος ασφαλείας 5 λεπτών: βιομετρική πληρωμή + κλείδωμα ασφαλείας + έλεγχος πληρωμών χωρίς κωδικό + διαχείριση συσκευών', 'Στο μετρό και στο λεωφορείο προτίμησε την εικονική κάρτα μετακινήσεων στο πορτοφόλι του τηλεφώνου: δουλεύει και εκτός σύνδεσης', 'Ηλεκτρονική βεβαίωση ασφάλισης υγείας, ερωτήματα σύνταξης, δήλωση φόρου: όλα από το τηλέφωνο', 'Τέσσερα «όχι» κατά της απάτης: ποτέ μεταφορά σε «ασφαλή λογαριασμό», ποτέ αποστολή κωδικού πληρωμής, ποτέ άγνωστοι σύνδεσμοι, ποτέ νούμερο κάρτας'],
 'di-shi-yi-zhang': ['Τέσσερα συχνά λάθη: βρομικός φακός, αμετάβλητη έκθεση, υπερβολική χρήση φλας, ψηφιακό ζουμ σε λάθος χρήση', 'Η νυχτερινή λειτουργία συντήκει πολλά πλαίσια· σταθερό χέρι 2-4 δευτερόλεπτα', 'Λειτουργία pro: χαμηλό ISO σημαίνει καθαρή εικόνα· το κλείστρο ελέγχει το φως', 'Αλυσίδα επεξεργασίας: ίσιωμα → βασικές ρυθμίσεις → τοπικό στίλβωμα → στυλ', 'Έξυπνη αναζήτηση + τακτικός καθαρισμός + χειροκίνητα άλμπουμ = το τρίπτυχο διαχείρισης φωτογραφιών'],
 'di-shi-yi-zhang-advanced': ['Τρεις πυλώνες του βίντεο: ανάλυση, ρυθμός πλαισίων, bitrate', 'Το H.265 συμπιέζει 50% καλύτερα από το H.264', 'Το ProRes είναι ο επαγγελματικός κωδικοποιητής της Apple: τεράστια αρχεία', 'HDR10/10+/Dolby Vision: το καθένα έχει τη δική του θέση'],
 'di-shi-er-zhang': ['Το NetEase Cloud Music πρωτοστατεί σε playlists και κοινότητα, το QQ Music έχει τον ευρύτερο κατάλογο, το Apple Music είναι καθαρό και χωρίς απώλειες, το Spotify έχει ισχυρές συστάσεις', 'Το Xiaoyuzhou είναι η πρώτη επιλογή για podcast στα κινεζικά· εκμεταλλευτείτε καλά την επιτάχυνση και τον αυτόματο καθαρισμό', 'Τοπικό βίντεο: VLC (όλα τα formats) ή nPlayer (έλεγχος με χειρονομίες)', 'Οι υπογραμμίσεις στο WeChat Read είναι κοινωνικές + συγχρονισμός Kindle· η λειτουργία προστασίας ματιών να είναι πάντα ενεργή', 'Η λειτουργία παιχνιδιού προτεραιοποιεί πρώτα το ομαλό frame rate· στη ζέστη βοηθά ο ψύκτης με κλιπ'],
 'di-shi-san-zhang': ['Εργαλεία παραγωγικότητας: εργασίες + pomodoro + ημερολόγιο', 'Υγεία και άθληση: Apple Health/Google Fit ως κόμβος δεδομένων', 'Πλοηγός: Edge πρώτα, μαζί με Copilot για περισσότερη παραγωγικότητα', 'Ψάξτε την αλήθεια: εμπιστευτείτε επίσημα domains, αποφύγετε φτηνές καταλήξεις όπως .xyz', 'Προτιμήστε τον ενσωματωμένο καθαρισμό· οι τρίτοι όπως το Qingzhuo είναι μόνο συμπλήρωμα, ποτέ τα πάντα με ένα άγγιγμα', 'Εφαρμογές κατά της παρενόχλησης: Εθνικό Κέντρο Αντικαταπολέμησης Απάτης + φρουροί μάρκας + μπλόκο παρόχου', 'Ενσωματωμένο μπλόκο: στο iOS «Σίγαση αγνώστων»· στο Android ενεργοποιείται μέσα στην εφαρμογή τηλεφώνου κάθε μάρκας', 'Τρία επίπεδα μαζί: μπλόκο συστήματος + πάροχος + κέντρο καταπολέμησης απάτης· προσοχή στη λίστα άσπρης ώστε να μη μπλοκάρετε δικούς σας', 'Ειδοποιήσεις καιρού: εφαρμογή καιρού του συστήματος + επίσημα μετεωρολογικά κανάλια· ενέργεια ανά επίπεδο μπλε/κίτρινο/πορτοκαλί/κόκκινο', 'Ειδοποιήσεις φυσικών καταστροφών: μετεωρολογία + προστασία πολιτών· σε καταρρακτώδεις βροχές και τυφώνες μακριά από χαμηλά σημεία και διαφημιστικές πινακίδες', 'Η έγ και ρη προειδοποίηση σεισμού δεν είναι πρόβλεψη: δευτερόλεπτα έως δεκάδες δευτερόλεπτα νωρίτερα· στο Android συνήθως στις ρυθμίσεις ασφαλείας', 'TickTick: λίστες + ημερολόγιο + pomodoro, προγραμματισμός με φυσική γλώσσα', 'Ψηφιοποίηση χαρτιού: κάμερα συστήματος/Mic Lens/Baimiao/CamScanner· τράβηξε καθαρά και μετά OCR', 'Απομακρυσμένος έλεγχος PC: Sunflower/ToDesk· αν ένας άγνωστος ζητήσει να εγκαταστήσεις απομακρυσμένο έλεγχο = απάτη', 'AI στο γραφείο: Trae και άλλα· το βαρύ στον υπολογιστή, από το τηλέφωνο παρακολουθείς εξ αποστάσεως', 'Γρήγορη μεταφορά σε τοπικό δίκτυο: LocalSend/AirDrop/Feige· πρόχειρο: KDE Connect/εργαλεία μάρκας', 'Κωδικοί μιάς χρήσης 2FA: Aegis/Microsoft Authenticator, έντυπα αντίγραφα των κωδικών ανάκτησης σε δύο σημεία'],
 'di-shi-si-zhang': ['Με διαχειριστή κωδικών αρκεί να θυμάσαι έναν κύριο κωδικό', 'Το Bitwarden είναι ανοιχτού κώδικα και δωρεάν, το 1Password προσφέρει την καλύτερη εμπειρία', 'Ο κύριος κωδικός πρέπει να είναι μακρύς και σύνθετος, με ενεργοποιημένο 2FA', 'Κάντε τακτικό έλεγχο ασφαλείας κωδικών', 'Αρχιτεκτονική μηδενικής γνώσης: ούτε ο πάροχος βλέπει τους κωδικούς σου· η κρυπτογράφηση γίνεται τοπικά', 'AES-256 + παραγωγή κλειδιών PBKDF2/Argon2 είναι ο ακρογωνιαίος λίθος της ασφάλειας θησαυρού κωδικών', 'Το δίδαγμα του επεισοδίου LastPass 2022: οι πιο εκτεθειμένοι είναι οι χρήστες με αδύναμο κύριο κωδικό', 'Η δύναμη του κωδικού είναι η «εντροπία»: μήκος + τυχαιότητα νικά τα περίπλοκα σύμβολα', 'Το HaveIBeenPwned ελέγχει διαρροές, το 1Password Watchtower παρακολουθεί συμβάντα', 'Τα Passkey βασίζονται σε FIDO2/WebAuthn: ανθεκτικά στο φίσινγκ, χωρίς αποστολή κωδικού', 'Συγχρονισμός Passkey μεταξύ συσκευών: κλειδοθήκη iCloud/Google Password Manager τον υποστηρίζουν ήδη', 'Τα υλικά κλειδιά (YubiKey/Titan) αντέχουν σε φίσινγκ και απαγωγή SIM - ιδανικά για όσους εκτίθενται περισσότερο', 'Κοινόχρηστες κάσες 1Password + έκτακτη πρόσβαση Bitwarden κάνουν τον οικογενειακό και ομαδικό διαμοιρασμό πιο ασφαλή'],
 'di-shi-wu-zhang': ['Μπαταρίες λιθίου: φόρτιζε κατά τη χρήση, μισούν τη ζέστη, γηράσκουν', 'Κάτω από 80% υγεία μπαταρίας, η διάρκεια πέφτει αισθητά', 'Πρωτόκολλα ταχύφορσης: PD/QC/VOOC/SuperCharge δεν είναι αμοιβαία ανταλλάξιμα', 'Η ασύρματη φόρτιση Qi2 εισάγει μαγνητική στοίχιση', 'Ο πυρήνας της εξοικονόμησης: χαμήλωσε τη φωτεινότητα + κλείσε το παρασκήνιο + πήγαινε σε 4G'],
 'di-shi-liu-zhang': ['Ο λογαριασμός είναι το μητρώο της ψηφιακής σου ζωής: συνδέει επαφές, φωτογραφίες, αγορές και Εύρεση τηλεφώνου', 'Τρεις υποχρεώσεις: ενεργοποιήστε 2FA, ορίστε κλειδί ανάκτησης, επιβεβαιώστε ότι η Εύρεση τηλεφώνου είναι ενεργή', 'Τα 5GB του iCloud δεν φτάνουν: καθάρισμα ή αναβάθμιση σε 50GB με περίπου ¥1/μήνα', 'Ο συγχρονισμός είναι διπλής κατεύθυνσης (σβήνεις εδώ, χάνεται παντού), το αντίγραφο είναι μονής κατεύθυνσης στιγμιότυπο (σβήνεις εδώ, εκεί παραμένει)', 'Χρήστες Android, ελέγξτε χωριστά: αντίγραφο σύννεφου της μάρκας, αντίγραφο Google, αντίγραφο WeChat'],
 'di-shi-qi-zhang': ['Διασυνδεδεμένη εργασία: AirDrop της Apple/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/Σύνδεση με Windows', 'Προβολή στην τηλεόραση: το iPhone μέσω Screen Mirroring, το Android μέσω ασύρματης προβολής· αν αποτύχει, ελέγξτε ότι είστε στο ίδιο Wi-Fi', 'Έξυπνο ρολόι = φίλτρο ειδοποιήσεων + σταθμός υγείας + πληρωμή από τον καρπό· για τους γονείς μπορεί να σώσει τη μέρα', 'Έξυπνο σπίτι: επιλέξτε κατά οικοσύστημα - Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'Ασφάλεια συνδέσεων: σε δημόσιους χώρους πρόσεχε το απόρρητο κατά την προβολή, και ξεσύνδεσε έγ και ρα τις παλιές συσκευές'],
 'di-shi-ba-zhang': ['Πλήρες αντίγραφο: τοπικά στον υπολογιστή (το πιο αξιόπιστο) + σύννεφο (το πιο ανέμελο), διπλή προστασία', 'Το ιστορικό συνομιλιών του WeChat είναι η πιο ειδική περίπτωση: μόνο το ενσωματωμένο αντίγραφο του WeChat το μεταφέρει, τα εργαλεία μετάβασης αποτυγχάνουν', 'Κανόνας 3-2-1: 3 αντίγραφα, 2 είδη μέσων, 1 εκτός σπιτιού', 'Αλλαγή τηλεφώνου: ίδια μάρκα με την επίσημη εφαρμογή μεταφοράς· μεταξύ μαρκών προετοιμάστε σταθμό αναμετάδοσης δεδομένων'],
 'di-shi-jiu-zhang': ['Κολλήματα και ζέστη σε τέσσερα βήματα: θυμήσου τι άλλαξε → έλεγχος αποθηκευτικού χώρου → έλεγχος κατανάλωσης → έλεγχος σήματος', 'Ρουτίνα για εφαρμογές που κρασάρουν: κλείσιμο και επαναφορά → ενημέρωση → έλεγχος δι και ωμάτων → καθάρισμα cache → επανεγκατάσταση', 'Δεν φορτίζει: καθάρισε πρώτα τη θύρα, μετά εναλλάξ καλώδια και φορτιστές για να βρεθεί ο ένοχος', 'Χωρίς δίκτυο: αεροπλάνο off/on → «ξεχάστε» το Wi-Fi και ξανασυνδεθείτε → επανεκκίνηση router', 'Η καθολική επανεκκίνηση λύνει τα περισσότερα ανεξήγητα προβλήματα· για επισκευή επιλέξτε εξουσιοδοτημένα συνεργεία, πριν την παράδοση: αντίγραφο + αποσύνδεση λογαριασμών'],
 'di-er-shi-zhang-jinjie': ['Λειτουργία προγραμματιστή: επτά χτυπήματα στον αριθμό build για ενεργοποίηση', 'Κλείδωμα BL: προστασία του κατασκευαστή· ξεκλείδωσε με προσοχή', 'Root: ο κίνδυνος υπερβαίνει το όφελος· δεν συνιστάται για συνηθισμένους χρήστες', 'Το Magisk εξακολουθεί να χρειάζεται ξεκλείδωτο BL, αλλά μπορεί να κρύψει την κατάσταση root'],
 'di-er-shi-yi-zhang': ['VPN = κρυπτογραφημένη σήραγγα· ένα δωρεάν VPN ίσως είναι εκείνο που κλέβει τα δεδομένα σου', 'Άμυνα ενάντια στον άνθρωπο-εν τω μέσω σε δημόσιο Wi-Fi: εμπιστευτείτε το HTTPS, κλείστε την αυτόματη σύνδεση, τα ευαίσθητα μόνο με δεδομένα κινητής', 'Η χειραψία HTTPS κρυπτογραφεί σε τέσσερις κύκλους, αλλά και οι ιστότοποι φίσινγκ χρησιμοποιούν HTTPS', 'Το DoH/DoT κρυπτογραφεί τα ερωτήματα DNS: ο πάροχος δεν κατασκοπεύει την περιήγησή σου', 'Η λειτουργία ανώνυμης περιήγησης = τοπική γόμα, όχι αόρατο μανδύα: ο πάροχος και οι ιστότοποι εξακολουθούν να σε βλέπουν', 'Λίστα ελέγχου ασφαλείας: κλείστε την αυτόματη σύνδεση Wi-Fi, περάστε σε κρυπτογραφημένο DNS, ενεργοποιήστε 2FA, ελέγξτε τα δι και ώματα των εφαρμογών και μπλοκάρετε το Juice Jacking'],
 'di-er-shi-er-zhang': ['Κάμερα AI: αναγνώριση σκηνής → σύντηξη πλαισίων → έξυπνη βελτιστοποίηση', 'Φωνητικοί βοηθοί: να ακούει → να καταλαβαίνει → να εκτελεί, σε τρία βήματα', 'AI στη συσκευή: γρήγορη, φιλική στην ιδιωτικότητα, δουλεύει εκτός σύνδεσης', 'Τα μεγάλα μοντέλα AI καλύπτουν συνομιλία/γραφή/μετάφραση/εικόνα/μάθηση', 'Τυπικές χρήσεις: ζωντανή μετάφραση, AI γόμα, AI ρετούς, επεξεργασία εγγράφων, AI αναζήτηση εικόνων', 'Πλαίσιο προτροπών CRISPE: ρόλος + αίτημα + υπόβαθρο + έξοδος + τόνος + παραδείγματα', 'Με την AI, πρόσεχε τις ψευδαισθήσεις και τις διαρροές ιδιωτικότητας', '«Ρόλος-Υπόβαθρο-Εργασία-Περιορισμοί» είναι ευκολότερη είσοδος στη συγγραφή προτροπών', 'Χαρακτηριστικά καλής προτροπής: συγκεκριμένη, με υπόβαθρο, με μορφή, με περιορισμούς, επαληθεύσιμη'],
 'di-er-shi-san-zhang': ['Στοιχεία αυτοματισμού: σκανδάλη + ενέργεια + προαιρετική λογική απόφασης', 'Συντομεύσεις iOS: πρωινή ρουτίνα με ένα άγγιγμα, αυτόματη εξοικονόμηση, καταγραφή εξόδων μέσω σάρωσης', 'Android: αυτόματοι κλικέρ (μακροεντολές οθόνης), Tasker (η πιο ισχυρή αυτοματοποίηση), MacroDroid (φιλικό σε αρχάριους)', 'Παγίδες: ανακριβείς σκανδές τοποθεσίας, το iOS δεν εκτελείται αυτόματα χωρίς χειροκίνητη επιβεβαίωση, το Tasker απαιτεί άδεια προσβασιμότητας', 'Σκέψη αυτοματισμού: μετατρέψτε την επαναληπτική δουλειά σε συνθήκη → ενέργεια, και το τηλέφωνο γίνεται ο προσωπικός σου βοηθός'],
 'di-er-shi-si-zhang': ['Ο Bootloader είναι ο θυρωρός της εκκίνησης· η επαλήθευση υπογραφής εμποδίζει την παραποίηση', 'Οι πολιτικές ξεκλειδώματος BL διαφέρουν ανά μάρκα (η Xiaomi επιτρέπει/η Huawei κλειδώνει)', 'Επιλογές root: Magisk/KernelSU/SuperSU', 'Τρία είδη flash: επίσημο ROM/Recovery τρίτων/ROM τρίτων'],
 'di-er-shi-wu-zhang': ['Πώληση παλιού τηλεφώνου: αντίγραφο → αποσύνδεση → κρυπτογραφημένο σβήσιμο → γέμισμα και νέο σβήσιμο', 'Ψηφιακή κληρονομιά: Επαφή κληρονομιάς iCloud/Ανενεργός λογαριασμός Google', 'Ανακύκλωση: προτίμησε τα επίσημα προγράμματα ανταλλαγής· το παλιό τηλέφωνο μπορεί να γίνει κάμερα ή πλοηγός'],
 'di-er-shi-liu-zhang': ['Τρία κριτήρια για τηλέφωνο AI: μεγάλο μοντέλο στη συσκευή, ισχύς NPU σε TOPS, AI Agent πάνω από τις εφαρμογές', 'Στρατηγικές AI των κατασκευαστών: Apple/Google/Huawei/Xiaomi/OPPO/vivo, ο καθένας με τα πλεονεκτήματά του', 'Δορυφόρος: τα σύντομα μηνύματα BeiDou έφτασαν στη μέση κατηγορία, οι κλήσεις Tiantong παραμένουν ναυαρχίδα', 'Πτυσσόμενα: ώριμο υλικό, εφαρμογές προσαρμοσμένες περίπου στο εβδομήντα τοις εκατό, το πτύχωμα-στήριγμα και η μισο-οθόνη είναι η μοναδική εμπειρία', 'Το 6G είναι ακόμα στον δρόμο, το Wi-Fi 7 ήρθε, το Bluetooth LE Audio αρχίζει να διαδίδεται', 'Μπαταρίες ανόδου πυριτίου-άνθρακα κάνουν τα 5000-6000mAh πρότυπο στις ναυαρχίδες'],
 'di-er-shi-qi-zhang': ['Ενεργοποιήστε πρώτα απλή λειτουργία ή μεγαλώστε γραμματοσειρές/εικονίδια: σωστά στημένα περιβάλλον λύνει τα μισά προβλήματα', 'Τρεις σιδερένιοι κανόνες με τους ηλικιωμένους: όχι βιασύνη, αναλογίες, και γράψε το', 'Έξι συνηθισμένες απάτες που πρέπει να υπενθυμίζονται ξανά και ξανά· τρεις αμυντικές γραμμές αναχαιτίουν το 90% της απάτης', 'Η τηλεβοηθεία σου επιτρέπει να φτιάξεις το τηλέφωνο των γονιών σου και από άλλη πόλη', 'Η λειτουργία φροντίδας του WeChat + η φωνητική εισαγωγή είναι οι δύο πιο χρήσιμες λειτουργίες για ηλικιωμένους', 'Κλήση SOS και ανίχνευση πτώσης: ρυθμίσεις που σώζουν ζωές στην κρίσιμη στιγμή'],
 'di-er-shi-ba-zhang': ['Επιλογή τηλεφώνου σε τρία βήματα: πρώτα οι ανάγκες → μετά ο προϋπολογισμός → τέλος το μοντέλο', 'Πέντε μόνο κρίσιμες παράμετροι: επεξεργαστής, οθόνη, κάμερα, μπαταρία και φόρτιση, υπόσχεση ενημερώσεων', '¥1500-3500 είναι η ζώνη με την καλύτερη σχέση ποιότητας-τιμής, η πιο συνιστώμενη', 'Η ναυαρχίδα πέρυσι αποφέρει περισσότερα από τη μέση κατηγορία φέτος', 'Πέντε παγίδες: ο μύθος των πολλαπλών καμερών, η λατρεία των megapixel, οι εκδόσεις παρόχων, η λατρεία καμπύλης οθόνης, τα τεχνάσματα AI', 'Το 618 και το Double 11 είναι τα δύο καλύτερα χρονικά παράθυρα του έτους για αγορά τηλεφώνου'],
 'di-er-shi-jiu-zhang': ['Δες πρώτα τα δεδομένα χρόνου οθόνης· η καθαρή εικόνα της κατάστασης είναι το πρώτο βήμα αλλαγής', 'Βάλτε όρια στις εφαρμογές διασκέδασης και ωράρια στην Μην ενοχλείς, και ξαναπάρε τον έλεγχο της προσοχής σου', 'Ο κανόνας 20-20-20 είναι η πιο απλή και αποτελεσματική συνήθεια για τα μάτια', 'Το κοιτάζοντας το τηλέφωνο φορτίζει τον αυχένα με 5-6 φορές το βάρος του κεφαλιού· σήκωσε το τηλέφωνο και τέντωσε τον αυχένα τακτικά', 'Μία ώρα πριν τον ύπνο χωρίς τηλέφωνο· ο φορτιστής μακριά από την έκταση του χεριού', 'Το αντίδοτο στην αγωνία πληροφοριών είναι «ενεργός μπλόκο», όχι «να παίρνεις περισσότερα»'],
 'di-san-shi-zhang': ['Τρεις στρατόπεδα της ασύρματης προβολής: AirPlay (Apple), Miracast (Android), DLNA (αποστολή πολυμέσων διαπλατφορμικά)', 'Η ενσύρματη προβολή είναι σταθερότερη και χωρίς καθυστέρηση· στην αίθουσα συσκέψεων ο προσαρμογέας HDMI είναι απαραίτητος', 'Samsung DeX/λειτουργία desktop Huawei μετατρέπουν το τηλέφωνο σε ελαφρύ γραφείο-υπολογιστή', 'Σύνδεση στο αυτοκίνητο: τέσσερις λύσεις - CarPlay/Android Auto/HiCar/CarLife', 'Κανόνες προβολής στην αίθουσα συσκέψεων: δοκιμή εκ των προτέρων, σχέδιο Β έτοιμο, απόκρυψη προεπισκόπησης ειδοποιήσεων'],
 'di-san-shi-yi-zhang': ['Πριν την λήψη ξεκαθάρισε: ποιος είναι το κοινό, τι αξία προσφέρεις, σε ποια πλατφόρμα ανεβάζεις', 'Πέντε πράγματα πριν την λήψη: 1080P/30fps, καθάρισμα φακού, κλείδωμα εστίασης και έκθεσης, επιλογή προσανατολισμού, ενεργοποίηση πλέγματος', 'Πέντε κινήσεις κάμερας: κοντινό, μακρινό, πάνω, μετακίνηση, παρακολούθηση - η σταθερότητα πρώτα', 'Μοντάζ με CapCut: κόψιμο → μεταβάσεις → υπότιτλοι → BGM → εξαγωγή, σε έξι βήματα', 'Τα πρώτα 3 δευτερόλεπτα κρίνουν τα πάντα· ένα βίντεο λέει ένα πράγμα· η συνέπεια νικά το ταλέντο'],
 'di-san-shi-er-zhang': ['Χαμένο τηλέφωνο, χρυσά 30 λεπτά: δανειστείτε ένα τηλέφωνο και καλέστε το δικό σας → απομακρυσμένο κλείδωμα → απενεργοποίηση SIM → πάγωμα πληρωμών → ενημέρωση οικείων → μήνυση', '72 ώρες μετά την απάτη: σταματήστε τις μεταφορές → κρατήστε αποδείξεις → καλέστε το 96110 → μήνυση → επικοινωνήστε με την τράπεζα → αλλάξτε κωδικούς', 'Μολυσμένο τηλέφωνο: ασφαλής λειτουργία → απεγκατάσταση ύποπτων εφαρμογών → σάρωση ασφαλείας → επαναφορά εργοστασιακών ρυθμίσεων (τελευταία λύση)', 'Κλοπή λογαριασμού: άλλαξε κωδικό → αποσύνδεσε τις συσκευές → έλεγξε ιστορικό συνδέσεων → ενεργοποίησε 2FA → έλεγξε συνδέσεις → έλεγξε πληρωμές', 'Το 99,9% των μηνυμάτων λύτρων είναι απάτη: μην απαντήσεις, μην πληρώσεις, στιγμιότυπο και μπλοκ', 'Απάτες με κλωνοποιημένο πρόσωπο/φωνή: ψάξτε για ελαττώματα στο βλέμμα, τα χείλη, τα περιγράμματα και τον φωτισμό· ζητήστε να γυρίσει το κεφάλι ή να σκεπάσει το πρόσωπο, κάντε προσωπικές ερωτήσεις και καλέστε πίσω σε γνωστό αριθμό', 'Απαγωγή SIM (SIM swap): αν το τηλέφωνο δείξει ξαφνικά «Χωρίς υπηρεσία», συναγερμός· βάλε PIN στη SIM, ενεργοποίησε τη δεύτερη επαλήθευση από τον πάροχο και μετέφερε τα κρίσιμα μέλη σε εφαρμογές ελέγχου ταυτότητας', 'Πέντε καθημερινές συνήθειες: κλείδωμα οθόνης + 2FA, Εύρεση τηλεφώνου, PIN της SIM, όχι άγνωστες εφαρμογές, τακτικά αντίγραφα ασφαλείας', 'Σεισμός/ακραίες καιρικές συνθήκες: πρώτα καταφύγιο κοντά, μετά εκκένωση· το SMS εξοικονομεί μπαταρία σε σχέση με μακριά κλήση', 'Χωρίς σήμα, προτεραιότητα στο δορυφορικό SOS (αν το μοντέλο το υποστηρίζει)· ειδοποιήσεις και ρυθμίσεις στο Κεφάλαιο 13'],
 'di-san-shi-san-zhang': ['Το Vision Pro και τα γυαλιά AR είναι νέες πύλες υπολογιστών πέρα από το τηλέφωνο, αλλά δεν θα το αντικαταστήσουν σύντομα', 'Οι διεπαφές εγκεφάλου-υπολογιστή απέχουν 10-20 χρόνια από τον καταναλωτή· η ηθική ωριμάζει πριν την τεχνολογία', 'Το τηλέφωνο εξελίσσεται προς την «αορατότητα»: από κέντρο-συσκευή σε κέντρο-ταυτότητα', 'Ηθική AI, κυριαρχία δεδομένων και ψηφιακό χάσμα είναι τα κεντρικά ζητήματα της επόμενης δεκαετίας', 'Να παραμένεις συνδεδεμένος και να παραμένεις αυτόνομος: η αμετάβλητη φιλοσοφία της ψηφιακής ζωής'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // Παραλείψει κεφάλαια που έχουν ήδη ενσωματωμένη σύνοψη, για να μη διπλασιαστεί
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== Κουμπί αντιγραφής (προστίθεται σε στοιχεία kbd) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'Αντιγραφή');
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

 // ===== Αναδιπλούμενο μακρύ περιεχόμενο (επίπεδο h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // Αναδίπλωση μόνο μεγάλων τμημάτων h4
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // Προσθήκη αναδιπλούμενης κεφαλίδας
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

 // ===== Ταμπλό μάθησης: πρόοδος ανάγνωσης + αυτοέλεγχος υγείας τηλεφώνου =====
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
 // Πρόοδος ανάγνωσης
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // Αριθμός σελιδοδεικτών
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // Τελευταίο κεφάλαιο
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // Αυτοέλεγχος υγείας
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'Τέλειο σκορ! Η ασφάλεια του τηλεφώνου σου βρίσκεται σε άριστη κατάσταση';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'Μπράβο! ' + (totalChecks - checked) + ' σημεία που μπορούν να βελτιωθούν';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'Στο όριο - προτεραιότητα στα μη τικαρισμένα σημεία ασφαλείας';
 else healthMsgEl.innerHTML = 'Το τηλέφωνό σου έχει ακόμη κενά ασφαλείας - φρόντισε να τα καλύψεις σύντομα';
 }
 }

 // Επαναφορά καταστάσεων τικ
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // Ανανεώνει κάθε 3 δευτερόλεπτα (πιάνει τα τικ των κεφαλαίων)
 setInterval(updateDashboard, 3000);

 // ===== Φωνητική ανάγνωση (TTS) =====
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
 // Κλωνοποίηση και αφαίρεση στοιχείων που δεν πρέπει να διαβαστούν δυνατά
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // Αφαίρεση των αναδιπλωμένων σωμάτων αλλά διατήρηση του κειμένου τους
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('Συγγνώμη, ο πλοηγός σου δεν υποστηρίζει φωνητική ανάγνωση. Δοκίμασε Chrome ή Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'Κεφάλαιο χωρίς τίτλο';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'el-GR';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // Προσπαθεί να χρησιμοποιήσει πιο φυσική ελληνική φωνή
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('el'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // Διαβάζει αυτόματα το επόμενο κεφάλαιο
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
 // Εντοπίζει το κεφάλαιο που φαίνεται τώρα
 if (ttsSectionIndex < 0) {
 // Ξεκινά από την αρχή ή από το κεφάλαιο πιο κοντά στη θέση κύλισης
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
 ttsLabel.textContent = 'Δεν ξεκίνησε';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // Δέσιμο συμβάντων
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
 // Επανέρχεται και αναπαράγει το τρέχον τμήμα
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

 // Συντόμευση: το πλήκτρο R εναλλάσσει τη φωνητική ανάγνωση
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

 // ===== Αρχικοποίηση =====
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

