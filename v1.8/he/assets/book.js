
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

 // ===== ערכת נושא =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה';
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

 // ===== גלילה: התקדמות + צל + חזרה למעלה + התקדמות תוכן עניינים + טבעת התקדמות =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} פרקים`;

 // פרמטרי טבעת ההתקדמות
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

 // עדכון טבעת ההתקדמות
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

 // עד איזה פרק הגעתם
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} פרקים`;
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

 // ===== זיכרון מיקום הקריאה =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // מוקדם מדי לשמור
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // מאתר את שם הפרק הנוכחי
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

 // משחזר מיקום בטעינת העמוד
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
 restoreToastText.textContent = `קריאה אחרונה: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // מוסתר אוטומטית אחרי 10 שניות
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

 // ===== אנימציית כניסה בגלילה =====
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
 // תוכן המסך הראשון מוצג גלוי ישירות
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== פתיחה/סגירה של הסרגל הצדדי =====
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

 // כלים מהירים: פתיחת תוכן העניינים
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== ניווט גלובלי בעוגנים: פיצוי על היסט של הסרגל הקבוע =====
 // חובה להשתמש ב-scrollIntoView ולא לחשב קואורדינטות ידנית: ל-.content-section יש
 // content-visibility:auto + contain-intrinsic-size(0 800px): פרקים מחוץ למסך
 // תופסים placeholder של 800px, getBoundingClientRect מחזיר את הקואורדינטות של ה-placeholder, ו-scrollTo ישיר
 // ינחת במקום הלא נכון (ככל שהפרק מאוחר יותר, הסטייה המצטברת גדולה). scrollIntoView משאיר לדפדפן
 // מציג את היעד לפי דרישה וממקם אותו, ו-html{scroll-padding-top:5rem} מפצה על הסרגל הקבוע
 // הקבוע.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // שלב 1: מצב instant מכריח קודם רינדור של הפרק המבוקש וממקם אותו, כדי ש-content-visibility
 // סטייה בזמן גלילה חלקה שנגרמת מרינדור מושהה.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // שלב 2: אחרי שהיעד מרונדר והקואורדינטות יציבות, מפעילים גלילה חלקה לתחושה נעימה.
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

 // ===== קיפול תוכן העניינים =====
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

 // ===== מסנן תוכן העניינים =====
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

 // ===== הדגשה בתוכן העניינים =====
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

 // ===== מערכת סימניות =====
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

 // מוסיף כפתור סימנייה לכל פרק
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'בסימניות' : 'סימנייה') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'הסרה מהסימניות' : 'הוספת הפרק לסימניות');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'בסימניות' : 'סימנייה';
 btn.setAttribute('aria-label', added ? 'הסרה מהסימניות' : 'הוספת הפרק לסימניות');
 // מעדכן את סימני הסרגל הצדדי
 updateTocBookmark(id, added);
 });
 // מוסיף אחרי ה-h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // מאתחל סימני סימניות בסרגל הצדדי
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== סימוני פרק שנקרא =====
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
 // למצוא את שורת המטה או את האלמנט שלפני ה-h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'נקרא' : 'נקרא') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'ביטול סימון נקרא' : 'סימון כנקרא');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'נקרא' : 'נקרא';
 check.setAttribute('aria-label', done ? 'ביטול סימון נקרא' : 'סימון כנקרא');
 // מעדכן את הסרגל הצדדי
 updateTocCompleted(id, done);
 // מעדכן את התקדמות הקריאה
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
 // מעדכן גם את מונה הפרקים שנקראו
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} פרקים`;
 }
 }

 // ===== חיפוש (משופר: ניווט מקלדת + מונה תוצאות) =====
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
 renderSearchPlaceholder('הקלידו מילות מפתח כדי לחפש');
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
 renderSearchPlaceholder('לא נמצאו תוצאות');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">נמצאו ${results.length} תוצאות</div>`;
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
 renderSearchPlaceholder('הקלידו מילות מפתח כדי לחפש');
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

 // ניווט מקלדת בחיפוש
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

 // ===== גודל גופן =====
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

 // ===== סגירת הסרגל הצדדי בהחלקה =====
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

 // ===== ניווט בין פרקים =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'הפרק הקודם'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'הפרק הבא'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== הדפסה =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== קיצורי מקלדת גלובליים =====
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

 // סוגר חלונות בלחיצה על הווילון
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
 // את ההדפסה הדפדפן כבר מטפל
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

 // ===== מעקב אחרי ימי קריאה רצופים =====
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

 // מציג את ההתראה של ימים רצופים
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 יום ' + streak + ' של קריאה רצופה. המשיכו כך!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* ייתכן ש-localStorage אינו זמין */ }
 }
 updateStreak();

 // ===== גיבוי/שחזור =====
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
 // אוסף את מצבי הבדיקה העצמית
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // אוסף את מצבי הקריאה של הפרקים
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // אוסף סימניות
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // אוסף דירוגים
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'גיבוי-קריאה-PhoneClass_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('ייצוא הגיבוי נכשל: ' + e.message);
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
 // משחזר מצבי הבדיקה העצמית
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // משחזר את מצבי הקריאה של הפרקים
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
 // משחזר סימניות
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('השחזור הצליח! העמוד ייטען מחדש כדי להחיל את כל הנתונים.');
 location.reload();
 } catch(err) {
 alert('השחזור נכשל: פורמט קובץ לא תקין. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('למחוק את כל נתוני הקריאה? הפעולה בלתי הפיכה! ייצאו גיבוי קודם.')) return;
 if (!confirm('אשרו שוב: כל התקדמות הקריאה, הסימניות והדירוגים יימחקו. להמשיך?')) return;
 localStorage.clear();
 alert('כל הנתונים נמחקו. העמוד ייטען מחדש.');
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

 // ===== מערכת דירוג פרקים =====
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
 // מוסיף אחרי ה-h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== אופטימיזציית דה-באונס של גלילה =====
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

 // ===== עוקב אחרי מצב כהה של המערכת =====
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

 // ===== הוספה אוטומטית של נתיבי ניווט ותגיות קושי לכל כותרת פרק =====
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
 
 ${level === 'beginner' ? 'מתחיל' : level === 'intermediate' ? 'בינוני' : 'מתקדם'}
 </span>
 <span class="reading-time">
 ~${minutes} דקות קריאה
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== הוספת חסימת „סיכום“ לפרקים =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">סיכום הפרק</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['המתקפלים בשלים אך לא המיינסטרים: „קישוט“ ולא „הצלה“', 'קיפול רוחבי = טלפון + טאבלט; קיפול אורכי = כיס + מבט חטוף על המסך החיצוני', 'מתאים ל: קריאה מרובה/עסקים/יצירה ב-hover/נשים שמעריכות ניידות', 'שש בדיקות ברכישה: סוג הציר, המסך הפנימי UTG, הקפל, גודל המסך החיצוני, משקל ועובי, מחיר תיקון אחרי אחריות', 'טריקים בלעדיים: ריבוי משימות במסך מפוצל, hover ב-90 מעלות, צצצוח על המסך החיצוני, מצב מחשב', 'לב התחזוקה: לא לפתוח ולסגור בקור, להרחיק גרגרים, לא סרט רגיל על המסך הפנימי, והציר נקי מאבק', 'ציפיות: הקפל הוא לצמיתות, המכשיר כבד ועבה יותר, סוללה בינונית, שווי מכירה חוזרת נמוך, ותיקונים יקרים', 'פילוסופיית קנייה: קונים אותו בזכות הצורה הייחודית, לא כי הוא „מתקדם יותר“'],
 'di-ling-zhang': ['הבינו את עמדת הספר: הדרכת טכנולוגיה ברורה ובידיים על ההגה', 'השתלטו על מערכת הסמלים: מה משמעות [כפתורים], >, מודגש ונטוי', 'מדוע „מתכווצת“ קיבולת הטלפון: הסיבות העיקריות', 'בנו הרגל של רישום מפרטי הטלפון שלכם', 'טלפון = כספת נכסים דיגיטליים; מניעה קודמת היא הרעיון המרכזי', 'נתונים לעיתים שווים יותר מהחומרה עצמה'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + מודם ומודולים נוספים על שבב אחד', 'ליבות גדולות וקטנות של ה-CPU עובדות יחד: איזון ביצועים וסוללה', 'מסך: OLED/LCD, קצב רענון, בהירות אוטומטית', 'לב מערכת הצילום: גודל החיישן חשוב ממספר הפיקסלים', 'התפתחות היציאות: Micro USB → Lightning → איחוד תחת USB-C', '5G-A מביא את היכולת החדשה של „איחוד תקשורת וחישה“'],
 'di-yi-zhang-harmony': ['HarmonyOS = מערכת הפעלה מבוזרת, מתוכננת לריבוי מכשירים מהיום הראשון', 'HarmonyOS 4.3 תואם ל-AOSP ויכול להריץ אפליקציות אנדרואיד', 'HarmonyOS NEXT עצמאי לחלוטין ואינו תומך עוד באפליקציות אנדרואיד', 'לפני שדרוג, ודאו שלאפליקציות המוכרות יש גרסאות נייטיב'],
 'di-er-zhang': ['אחסון בשלוש שכבות: המכשיר / כרטיס SD / ענן', 'מה אומרות התיקיות הנפוצות באנדרואיד (DCIM, Download וכו׳)', 'גיבוי נתונים = גיבוי ענן + גיבוי מקומי, הגנה כפולה', 'מחיקה איננה השמדה; רק „כתיבה מחדש“ מוחקת באמת', 'עזר זיכרון לפורמטי קבצים נפוצים (תמונה/שמע/וידאו/מסמך)', 'מתן שמות „תאריך + אירוע“ הוא הקונבנציה הבסיסית', 'הניקוי האוטומטי ל-72 שעות פותר את הצבירה של מטמון אפליקציות חברתיות', 'הגנה כפולה לתמונות: הסתרה + קילוף EXIF'],
 'di-san-zhang': ['ל-4G/5G תפקידים שונים; 5G-A היא הגרסה המורחבת', 'ההבדלים הטכניים המרכזיים בין Wi-Fi 6/6E/7', 'וי-פיי ציבורי דורש זהירות: אל תקלידו מידע רגיש', 'Bluetooth 5.x ממשיך להתפתח, LE Audio מתחיל להתפשט', 'NFC עובד עד 10 ס״מ: הקרבה הפיזית עצמה היא הערבות'],
 'di-si-zhang': ['התקינו אפליקציות קודם כל מהחנויות הרשמיות', 'חבילת APK = תעודה + משאבים + הגדרות + קוד בינארי', 'היזהרו מאפליקציות „ניקוי-האצה“; שהייה של אפליקציות ברקע יכולה להיות לגיטימית', 'אימות חתימת אפליקציה מונע טמפר: הגנה ברמת המערכת', 'מצב טהור = התקנות מהחנות הרשמית בלבד: החומה הראשונה מפני תוכנה זדונית', '„טפילים דיגיטליים“ מתייחס לגרסאות פרוצות עם טרויאנים בפנים', 'מנגנון הסקירה של חנויות האפליקציות: סריקת וירוסים + סקירת הרשאות + אימות מפתחים'],
 'di-wu-zhang': ['מסך: רזולוציה, קצב רענון, בהירות אוטומטית', 'שמע: ווליום צלצול/מדיה/התראות מנוהלים בנפרד', 'אחסון: נקו בקביעות מטמון וקבצים מיותרים', 'ביומטריה: טביעת אצבע מול פנים; 3D מנצח 2D באבטחה', 'קוראי מסך: VoiceOver ב-iOS / TalkBack באנדרואיד הם העיניים של משתמשים עם לקות ראייה', 'הגדלה: ניגודיות גבוהה, טקסט מודגש ומסנני צבע: השלישייה', 'תיאור תמונות ב-AI: תן ל-AI לקרוא בשבילך תמונות, תפריטים וקפצצות', 'כתוביות חיות: מציל לכבדי שמיעה ולסביבות רועשות', 'RTT/TTY: גם מי שאיבד את הקול או השמיעה יכול להתקשר'],
 'di-liu-zhang': ['סיסמת מסך נעילה + אימות דו-שלבי הם קו ההגנה הבסיסי', 'הרשאות אפליקציות: הפעילו לפי הצורך, עקרון ההרשאה המזערית', 'אף תשלום ואף כניסה לחשבון בווי-פיי ציבורי', 'בעידן ה-AI אין לסמוך על העיניים: פנים וקול מזויפים, התחזות לסמכות, והשקעות פיקטיביות הן התרגילים הנפוצים', 'תוכנית יציאה: אימות בתנועה + מילת סוד + אישור שני', 'לפני שיתוף תמונות, אנונימיזציה: כבו מיקום ומידע מכשיר ב-EXIF', 'מכשירי IoT: החליפו את סיסמת ברירת המחדל', 'אם הונו אותך זכור: אל תאמין בקלות, אל תחשוף, אל תעביר'],
 'di-qi-zhang-jichu': ['לוויין: „חבל ההצלה“ בחירום', 'תקשורת בלי רשת: קשר ארוך טווח גם בלי כיסוי', 'זיהוי תאונה: מיזוג חיישנים מזהה התנגשויות קשות', 'StarFlash: חיבור אלחוטי בהשהיה נמוכה עם פוטנציאל עצום'],
 'di-ba-zhang': ['הקלטת שיחות: שימו לב להיבט המשפטי', 'iMessage/RCS מעלים את ה-SMS המסורתי למדיה עשירה', 'היסטוריית הצאט של WeChat דורשת את פונקציית הגיבוי הפנימית של WeChat', 'אפליקציות דואר מנהלות מספר חשבונות באופן מאוחד', 'חסימת הטרדות: זיהוי מערכת + רשימות שחורות/לבנות + מסנני מילות מפתח ב-SMS', '„השתק שיחות ממספרים לא מוכרים“ ב-iOS חוסם הטרדות, אבל שימו לב לשיחות שלא נענו', 'סימוני ספאם שגויים ניתנים לערעור דרך Dianhua Bang/360/Tencent וערוצי הספק'],
 'di-jiu-zhang': ['WPS Office הכי טוב בסין, ו-Microsoft 365 הכי תואם', 'הערות בשלושה שלבים: רשמת → לקרוא אחר כך → מערכת ידע', 'סריקה בטלפון: הערות/Mic Lens/Baimiao/CamScanner', 'ענן לפי הצורך: iCloud/OneDrive/באידו/Aliyun Drive, לכל אחד התרחישים שלו'],
 'di-shi-zhang': ['מי שרואה את קוד התשלום מקבל את הכסף: לעולם אל תשלחו לו צילום מסך', 'בדיקת אבטחה של 5 דקות: תשלום ביומטרי + מנעול אבטחה + בדיקת תשלומים ללא סיסמה + ניהול מכשירים', 'במטרו ובאוטובוס עדיף כרטיס נסיעה וירטואלי בארנק הטלפון: עובד גם אופליין', 'תעודת ביטוח בריאות דיגיטלית, בירורי פנסיה, דוח מס: הכל מהטלפון', 'ארבע „לא“ מול הונאות: לא להעביר ל„חשבון בטוח“, לא לשלוח קוד תשלום, לא ללחוץ על קישורים לא מוכרים, לא למסור מספר כרטיס בנק'],
 'di-shi-yi-zhang': ['ארבע טעויות נפוצות: עדשה מלוכלכת, חשיפה לא מכוונת, שימוש מופרז בפלאש, זום דיגיטלי מיותר', 'מצב לילה ממזג מספר פריימים; יד יציבה 2-4 שניות', 'מצב מקצועי: ISO נמוך תמונה נקייה, ומהירות התריס שולטת באור', 'שרשרת הפוסט-עיבוד: יישור → כיווני בסיס → ליטוש מקומי → סטיילינג', 'חיפוש חכם + ניקוי קבוע + אלבומים ידניים = שלישיית ניהול התמונות'],
 'di-shi-yi-zhang-advanced': ['שלושת עמודי הווידאו: רזולוציה, קצב פריימים, bitrate', 'H.265 דוחס טוב יותר מ-H.264 ב-50%', 'ProRes הוא הקודק המקצועי של אפל: קבצים עצומים', 'HDR10/10+/Dolby Vision: לכל אחד נישה משלו'],
 'di-shi-er-zhang': ['NetEase Cloud Music הטובה ביותר לפלייליסטים וקהילה, ל-QQ Music הקטלוג הרחב ביותר, Apple Music נקייה וללא אובדן, ול-Spotify המלצות חזקות', 'Xiaoyuzhou הבחירה הראשונה לפודקאסטים בסינית; נצלו היטב האצה וניקוי אוטומטי', 'וידאו מקומי: VLC (כל הפורמטים) או nPlayer (שליטה במחוות)', 'קווים תחתונים ב-WeChat Read חברתיים + סנכרון Kindle; מצב הגנת עיניים תמיד דלוק', 'מצב משחק מדגיש קודם כל קצב פריימים חלק; לחום מסייע מאוורר בקליפ'],
 'di-shi-san-zhang': ['כלי פרודוקטיביות: משימות + פומודורו + לוח שנה', 'בריאות וספורט: Apple Health/Google Fit כמרכז הנתונים', 'דפדפן: Edge קודם, עם Copilot להגברת היעילות', 'חפשו את האמת: סמכו על דומיינים רשמיים, הימנעו מסיומות זולות כמו .xyz', 'העדיפו ניקוי מובנה; צד שלישי כמו Qingzhuo הוא רק תוספת, ולעולם לא ניקוי הכל בנגיעה אחת', 'אפליקציות נגד הטרדות: המרכז הלאומי נגד הונאות + שומרי מותג + חסימת הספק', 'חסימה מובנית: ב-iOS „השתק שיחות ממספרים לא מוכרים“; באנדרואיד מפעילים בתוך אפליקציית הטלפון של כל יצרן', 'שלוש שכבות יחד: חסימת מערכת + ספק + מרכז אנטי-הונאה; שימו לב לרשימה הלבנה כדי לא לחסום את שלכם', 'התראות מזג אוויר: אפליקציית מזג האוויר של המערכת + ערוצים רשמיים; פעלו לפי הרמות הכחול/צהוב/כתום/אדום', 'התרעות אסונות טבע: מטאורולוגיה + כוננות חירום; בגשמים עזים וטייפון התרחקו מאזורים נמוכים ומשלטי פרסום', 'התרעת רעידת אדמה אינה חיזוי: שניות עד עשרות שניות מראש; באנדרואיד בדרך כלל בהגדרות אבטחה', 'TickTick: רשימות + לוח שנה + פומודורו, תזמון בשפה טבעית', 'סריקת נייר: מצלמת המערכת/Mic Lens/Baimiao/CamScanner; צלמו חד ואז OCR', 'שליטה מרחוק במחשב: Sunflower/ToDesk; אם זר מבקש ממך להתקין שליטה מרחוק = הונאה', 'AI במשרד: Trae ועוד; עבודה כבדה במחשב, ומהטלפון עוקבים מרחוק', 'העברה מהירה ברשת המקומית: LocalSend/AirDrop/Feige; לוח העתקה: KDE Connect/כלי יצרן', 'קודי חד-פעמי 2FA: Aegis/Microsoft Authenticator, עותקים נייר של קודי גיבוי בשני מקומות'],
 'di-shi-si-zhang': ['עם מנהל סיסמאות מספיק לזכור סיסמת אב אחת', 'Bitwarden קוד פתוח וחינמי, ל-1Password חוויית השימוש הטובה ביותר', 'סיסמת האב צריכה להיות ארוכה ומורכבת, עם 2FA מופעל', 'בדקו אבטחת סיסמאות באופן קבוע', 'ארכיטקטורת ידיעה-אפס: גם הספק לא רואה את הסיסמאות שלך; ההצפנה מתבצעת מקומית', 'AES-256 + נגזרת מפתחות PBKDF2/Argon2 הן אבן היסוד של אבטחת כספת סיסמאות', 'הלקח מפרשת LastPass 2022: הסיכון הגדול ביותר למשתמשים עם סיסמת אב חלשה', 'עוצמת הסיסמה היא „אנטרופיה“: אורך + אקראיות מנצחים סמלים מתוחכמים', 'HaveIBeenPwned בודק דליפות, 1Password Watchtower מנטר תקלות', 'Passkey נשענות על FIDO2/WebAuthn: עמידות לפישינג, ושום סיסמה לא מועברת', 'סנכרון Passkey בין מכשירים: מחזיק המפתחות של iCloud/Google Password Manager כבר תומכים', 'מפתחות חומרה (YubiKey/Titan) עמידים לפישינג ולחטיפת SIM - אידיאליים למי שחשוף יותר', 'כספות משותפות של 1Password + גישת חירום של Bitwarden הופכות שיתוף משפחתי וצוותי לבטוח יותר'],
 'di-shi-wu-zhang': ['סוללות ליתיום: לטעון לפי שימוש, שונאות חום, ומזדקנות', 'מתחת ל-80% בריאות סוללה, זמן העבודה צונח באופן ניכר', 'פרוטוקולי טעינה מהירה: PD/QC/VOOC/SuperCharge אינם ניתנים להחלפה', 'טעינה אלחוטית Qi2 מוסיפה יישור מגנטי', 'לב חיסכון הסוללה: הנמיכו בהירות + סגרו רקע + עברו ל-4G'],
 'di-shi-liu-zhang': ['החשבון הוא מרשם האוכלוסין של החיים הדיגיטליים שלך: מקשר אנשי קשר, תמונות, רכישות ומצא את הטלפון', 'שלושה חובות: הפעילו 2FA, הגדירו מפתח שחזור, וודאו שמצא את הטלפון מופעל', '5GB של iCloud לא מספיקים: נקו או עברו ל-50GB בכ-¥1 בחודש', 'סנכרון דו-כיווני (מחקת כאן - נעלם בכל מקום), גיבוי תמונת מצב חד-כיוונית (מחקת כאן - שם נשאר)', 'משתמשי אנדרואיד, בדקו בנפרד: גיבוי ענן של היצרן, גיבוי גוגל, גיבוי WeChat'],
 'di-shi-qi-zhang': ['עבודה בין מכשירים: AirDrop של אפל/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/קישור ל-Windows', 'שידור לטלוויזיה: האייפון דרך שכפול מסך, אנדרואיד דרך שידור אלחוטי; אם נכשל, ודאו שאתם באותו וי-פיי', 'שעון חכם = מסנן התראות + תחנת בריאות + תשלום מהיד; להורים כזה עשוי להציל את היום', 'בית חכם: בחרו לפי אקוסיסטם - Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'אבטחת קישורים: במקומות ציבוריים שימו לב לפרטיות בזמן שידור, ונתקו מכשירים ישנים בזמן'],
 'di-shi-ba-zhang': ['גיבוי מלא: מקומי במחשב (האמין ביותר) + ענן (השקט ביותר), הגנה כפולה', 'היסטוריית הצאט של WeChat היא המקרה המיוחד: רק הגיבוי הפנימי של WeChat מעביר אותה, כלי ההגירה כושלים', 'כלל 3-2-1: 3 עותקים, 2 סוגי מדיה, 1 מחוץ לבית', 'מעבר טלפון: באותו מותג באפליקציית ההעברה הרשמית; בין מותגים, הכינו מראש תחנת ביניים לנתונים'],
 'di-shi-jiu-zhang': ['איטיות וחום בארבעה צעדים: היזכרו מה השתנה → בדקו אחסון → בדקו צריכה → בדקו קליטה', 'שגרה לאפליקציה שמתרסקת: סגרו ופתחו מחדש → עדכנו → בדקו הרשאות → נקו מטמון → התקינו מחדש', 'לא נטען: נקו את השקע קודם, ואז החליפו כבל ומטען בצורה צולבת לאיתור האשם', 'אין רשת: כבו והדליקו מצב טיסה → „שכחו“ את הווי-פיי והתחברו מחדש → הפעילו את הנתב מחדש', 'הפעלה מחדש אוניברסלית פותרת רוב הבעיות המוזרות; לתיקון בחרו מוסכים מורשים, ולפני: גיבוי + יציאה מהחשבונות'],
 'di-er-shi-zhang-jinjie': ['מצב מפתח: שבע הקשות על מספר ה-build להפעלה', 'נעילת BL: הגנת היצרן; לפתוח בזהירות', 'Root: הסיכון גובר על התועלת; לא מומלץ למשתמש רגיל', 'Magisk עדיין דורש BL פתוח, אך יכול להסתיר את מצב ה-root'],
 'di-er-shi-yi-zhang': ['VPN = מנהרה מוצפנת; VPN חינמי עשוי להיות זה שיגנוב לך את הנתונים', 'הגנה מפני איש-באמצע בווי-פיי ציבורי: סמכו על HTTPS, כבו חיבור אוטומטי, ורגיש - רק ברשת סלולרית', 'לחיצת היד של HTTPS מצפינה בארבעה סבבים, אבל גם אתרי פישינג משתמשים ב-HTTPS', 'DoH/DoT מצפינים שאילתות DNS: הספק לא מציץ על הגלישה שלך', 'מצב גלישה פרטית = מחק מקומי, לא גלימת היעלמות: הספק והאתרים עדיין רואים אותך', 'רשימת אבטחה: כבו חיבור וי-פיי אוטומטי, עברו ל-DNS מוצפן, הפעילו 2FA, בדקו הרשאות אפליקציות, וחסמו Juice Jacking'],
 'di-er-shi-er-zhang': ['מצלמת AI: זיהוי סצנה → מיזוג פריימים → אופטימיזציה חכמה', 'עוזרות קוליות: לשמוע → להבין → לבצע, בשלושה שלבים', 'AI על המכשיר: מהיר, ידידותי לפרטיות, עובד אופליין', 'מודלי AI גדולים מכסים שיחה/כתיבה/תרגום/תמונה/למידה', 'שימושים טיפוסיים: תרגום חי, מחק AI, עריכת תמונות AI, עבודה עם מסמכים, חיפוש תמונות ב-AI', 'מסגרת CRISPE לפרומפטים: תפקיד + בקשה + הקשר + פלט + טון + דוגמאות', 'עם AI שימו לב להזיות ולדליפות פרטיות', '„תפקיד-הקשר-משימה-מגבלות“ הוא גישה קלה יותר להתחלה עם פרומפטים', 'מאפייני פרומפט טוב: מדויק, עם הקשר, עם פורמט, עם מגבלות, ניתן לאימות'],
 'di-er-shi-san-zhang': ['יסודות האוטומציה: טריגר + פעולה + לוגיקת החלטה אופציונלית', 'קיצורי דרך ב-iOS: שגרת בוקר בנגיעה אחת, חיסכון אוטומטי, הוצאות ברישום סריקה', 'אנדרואיד: מקלידים אוטומטיים (מאקרו מסך), Tasker (האוטומציה החזקה ביותר), MacroDroid (ידידותי למתחילים)', 'מלכודות: טריגרים של מיקום לא מדויקים, iOS לא מריץ אוטומטית בלי אישור ידני, Tasker דורש הרשאת נגישות', 'חשיבה של אוטומציה: להפוך עבודה חוזרת ל„תנאי → פעולה“, והטלפון יהפוך לעוזר האישי שלך'],
 'di-er-shi-si-zhang': ['ה-Bootloader הוא שוער הכניסה באתחול; אימות חתימה מונע טמפר', 'מדיניות פתיחת BL שונה בין המותגים (שיאומי מרשה/הואווי נועלת)', 'אפשרויות Root: Magisk/KernelSU/SuperSU', 'שלושה סוגי פלאש: ROM רשמי/Recovery צד שלישי/ROM צד שלישי'],
 'di-er-shi-wu-zhang': ['מכירת טלפון ישן: קודם גיבוי → יציאה מהחשבונות → מחיקה מוצפנת → מילוי ומחיקה חוזרת', 'ירושה דיגיטלית: איש קשר להנצחה ב-iCloud/חשבון Google לא פעיל', 'מיחזור: העדיפו תוכניות trade-in רשמיות; טלפון ישן עוד יכול לשמש מצלמה או נווט'],
 'di-er-shi-liu-zhang': ['שלושה קריטריונים לטלפון AI: מודל גדול על המכשיר, עוצמת NPU ב-TOPS, ו-AI Agent מעל האפליקציות', 'אסטרטגיות AI של היצרנים: אפל/גוגל/הואווי/שיאומי/OPPO/vivo, לכל אחד יתרונות משלו', 'לוויין: הודעות קצרות של BeiDou הגיעו לטווח הביניים, שיחות Tiantong נשארו לדגלים', 'מתקפלים: חומרה בשלה, אפליקציות מותאמות בכ-70%, hover/מסך מפוצל הם החוויה הייחודית', '6G עוד בדרך, Wi-Fi 7 כבר כאן, ו-Bluetooth LE Audio מתחיל להתפשט', 'סוללות אנודת סיליקון-פחם הופכות את 5000-6000mAh לסטנדרט בדגלים'],
 'di-er-shi-qi-zhang': ['הפעילו קודם מצב פשוט או הגדילו גופנים/סמלים: סביבה מותאמת מונעת חצי מהבעיות', 'שלושה חוקי ברזל עם ותיקים: לא למהר, להשתמש באנלוגיות, לכתוב', 'שש הונאות נפוצות שחוזרים ומזהירים מהן; שלוש חזיתות הגנה עוצרות 90% מההונאות', 'סיוע מרחוק מאפשר לתקן את הטלפון של ההורים גם מעיר אחרת', 'מצב טיפול של WeChat + קלט קולי הן שתי הפונקציות השימושיות ביותר לוותיקים', 'קריאת SOS וזיהוי נפילה: הגדרות שמצילות חיים ברגע הקריטי'],
 'di-er-shi-ba-zhang': ['בחירת טלפון בשלושה צעדים: קודם הצרכים → אז התקציב → לבסוף הדגם', 'רק חמישה פרמטרים חשובים: מעבד, מסך, מצלמה, סוללה וטעינה, הבטחת עדכונים', '¥1500-3500 הוא טווח היחס הטוב ביותר, המומלץ ביותר', 'דגל של שנה שעברה משתלם יותר מביניים של השנה', 'חמש מלכודות: מיתוס המצלמות המרובות, פולחן המגה-פיקסל, גרסאות ספק, פולחן מסך עקום, גימיקים של AI', '618 ו-Double 11 הם שני חלונות הזמן הטובים בשנה לקניית טלפון'],
 'di-er-shi-jiu-zhang': ['קודם הביטו בנתוני זמן המסך; לראות את המצב בבירור הוא הצעד הראשון לשינוי', 'הציבו מגבלות לאפליקציות בידור וזמנים לנא לא להפריע, והשיבו לעצמכם את תשומת הלב', 'כלל 20-20-20 הוא ההרגל הפשוט והיעיל ביותר לעיניים', 'הבטה למטה בטלפון מעמיסה על הצוואר פי 5-6 ממשקל הראש; הרימו את הטלפון והזיעו את הצוואר מדי פעם', 'השעה לפני השינה בלי טלפון; את המטען הרחק מטווח היד', 'הנגד לחרדת המידע הוא „חסימה אקטיבית“, לא „לקבל יותר“'],
 'di-san-shi-zhang': ['שלושה מחנות של שידור אלחוטי: AirPlay (אפל), Miracast (אנדרואיד), DLNA (שליחת מדיה חוצת פלטפורמות)', 'שידור בכבל יציב יותר וללא השהיה; בחדר ישיבות אסור לוותר על מתאם HDMI', 'Samsung DeX/מצב שולחן עבודה של הואווי הופכים את הטלפון למחשב משרדי קל', 'חיבור ברכב: ארבעה פתרונות - CarPlay/Android Auto/HiCar/CarLife', 'כללי שידור בחדר ישיבות: בדקו מראש, הכינו תוכנית ב, הסתירו תצוגה מקדימה של התראות'],
 'di-san-shi-yi-zhang': ['לפני צילום, הבהירו: מי הקהל, איזו ערך אתם נותנים, באיזו פלטפורמה מפרסמים', 'חמישה דברים לפני צילום: 1080P/30fps, נקו את העדשה, נעלו פוקוס וחשיפה, בחרו כיוון, הפעילו רשת', 'חמישה תנועות מצלמה: התקרבות, התרחקות, פאן, תזוזה, מעקב - היציבות קודמת לכל', 'עריכה ב-CapCut: חיתוך → מעברים → כתוביות → BGM → ייצוא, בשישה שלבים', 'שלוש השניות הראשונות מכריעות הכל; סרטון אחד מספר דבר אחד; התמדה מנצחת כישרון'],
 'di-san-shi-er-zhang': ['טלפון אבד, 30 הדקות של הזהב: שאלו טלפון והתקשרו אליכם → נעילה מרחוק → חסימת ה-SIM → הקפאת תשלומים → עדכון קרובים וחברים → דיווח למשטרה', '72 שעות אחרי ההונאה: עצרו העברות → שמרו ראיות → התקשרו ל-96110 → דווחו למשטרה → פנו לבנק → החליפו סיסמאות', 'טלפון נגוע: מצב בטוח → הסרת אפליקציות חשודות → סריקת אבטחה → איפוס יצרן (הפתרון האחרון)', 'חשבון נגנב: החליפו סיסמה → צאו מהמכשירים → בדקו היסטוריית כניסות → הפעילו 2FA → בדקו קישורים → בדקו תשלומים', '99.9% מהודעות הכופר הן הונאה: לא להשיב, לא לשלם, צילום מסך וחסימה', 'הונאות פנים/קול משוכפל: חפשו פגמים במצמוץ, בפה, בקווי מתאר ובתאורה; בקשו להסתובב, לכסות את הפנים, שאלו שאלות אישיות, וחזרו למספר מוכר', 'חטיפת SIM: אם הטלפון מציג פתאום „אין שירות“ - זו אזעקה; הגדר PIN ל-SIM, הפעל אימות שני אצל הספק, ועבור עם החשבונות החשובים לאפליקציות אימות', 'חמש הרגלים יומיים: מסך נעילה + 2FA, מצא את הטלפון, PIN ל-SIM, לא אפליקציות לא מוכרות, גיבויים קבועים', 'רעידת אדמה/מזג קיצוני: הסתתרו בקרבה קודם, ואז פנו לפינוי; הודעה ב-SMS חוסכת סוללה יותר משיחה ארוכה', 'בלי קליטה - SOS לווייני קודם (אם הדגם תומך); התראות והגדרות בפרק 13'],
 'di-san-shi-san-zhang': ['Vision Pro ומשקפי AR הם כניסות מחשוב חדשות מעבר לטלפון, אך לא יחליפו אותו בקרוב', 'ממשקי מוח-מחשב עוד במרחק 10-20 שנה מהצרכן; האתיקה מבשילה לפני הטכנולוגיה', 'הטלפון מתפתח לכיוון „העלמות“: ממרכזיות מכשיר למרכזיות זהות', 'אתיקה של AI, ריבונות נתונים ופער דיגיטלי הם סוגיות הליבה של העשור הבא', 'להישאר מחוברים ולהישאר עצמאיים: הפילוסופיה הבלתי משתנה של החיים הדיגיטליים'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // מדלג על פרקים שכבר יש להם סיכום מובנה, כדי למנוע כפילות
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== כפתור העתקה (מתווסף לאלמנטים מסוג kbd) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'העתקה');
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

 // ===== תוכן ארוך מתקפל (ברמת h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // לקפל רק מקטעי h4 ארוכים
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // מוסיף את הכותרת המתקפלת
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

 // ===== לוח למידה: התקדמות קריאה + בדיקה עצמית לבריאות הטלפון =====
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
 // התקדמות קריאה
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // מספר סימניות
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // פרק אחרון
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // בדיקה עצמית לבריאות
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'ציון מלא! האבטחה של הטלפון שלך במצב מצוין';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'מצוין! ' + (totalChecks - checked) + ' סעיפים לשיפור';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'בקושי עובר: תעדפו את סעיפי האבטחה שטרם סומנו';
 else healthMsgEl.innerHTML = 'בטלפון שלך יש פערי אבטחה - טפל בהם בהקדם';
 }
 }

 // משחזר מצבי הסימון
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // מתרנדן כל 3 שניות (לוכד את הסימונים בפרקים)
 setInterval(updateDashboard, 3000);

 // ===== קריאה בקול (TTS) =====
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
 // משכפול והסרה של אלמנטים שלא ייקראו בקול
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // מסיר את הגופים המקופלים אך שומר על הטקסט שלהם
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('מצטערים, הדפדפן שלך לא תומך בקריאה בקול. נסה Chrome או Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'פרק ללא שם';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'he-IL';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // מנסה להשתמש בקול עברי טבעי יותר
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('he'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // מקריא אוטומטית את הפרק הבא
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
 // מאתר את הפרק הגלוי כרגע
 if (ttsSectionIndex < 0) {
 // מתחיל מההתחלה או מהפרק הקרוב ביותר למיקום הגלילה
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
 ttsLabel.textContent = 'טרם התחיל';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // חיבור אירועים
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
 // יוצר מחדש ומנגן את הקטע הנוכחי
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

 // קיצור: מקש R מפעיל/כבה קריאה בקול
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

 // ===== אתחול =====
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

