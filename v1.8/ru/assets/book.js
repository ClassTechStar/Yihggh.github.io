
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

 // ===== Тема =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему';
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

 // ===== Прокрутка: прогресс + тень + кнопка «наверх» + прогресс оглавления + кольцо прогресса =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} глав`;

 // Параметры кольца прогресса
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

 // Обновление кольца прогресса
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

 // До какой главы дочитали
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} глав`;
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

 // ===== Память позиции чтения =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // Слишком близко к началу - не сохраняем
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // Найти имя текущей главы
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

 // Восстановить позицию при загрузке страницы
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
 restoreToastText.textContent = `Прочитали: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // Автоскрытие через 10 секунд
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

 // ===== Анимация появления при прокрутке =====
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
 // Контент первого экрана делаем видимым сразу
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== Открытие/закрытие боковой панели =====
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

 // Быстрые инструменты: открыть оглавление
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== Глобальная навигация по якорям: компенсация смещения фиксированной панели =====
 // Обязательно использовать scrollIntoView, а не ручной расчёт координат: у .content-section задано
 // content-visibility:auto + contain-intrinsic-size(0 800px): главы за экраном
 // занимают 800px-заглушки, getBoundingClientRect возвращает координаты заглушки, и прямой scrollTo
 // окажется не там (чем дальше глава, тем больше накопленное смещение). scrollIntoView поручает браузеру
 // сам визуализирует цель по требованию и позиционирует её, а html{scroll-padding-top:5rem} компенсирует
 // панели.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // Шаг 1: режим instant сначала принудительно отрисовывает нужную главу и позиционирует её, чтобы content-visibility
 // смещения при плавной прокрутке из-за отложенной отрисовки.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // Шаг 2: когда цель отрисована и координаты стабильны, запускаем плавную прокрутку для комфортного ощущения.
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

 // ===== Сворачивание оглавления =====
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

 // ===== Фильтр оглавления =====
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

 // ===== Подсветка в оглавлении =====
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

 // ===== Система закладок =====
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

 // Добавить кнопку закладки каждой главе
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'В закладках' : 'В закладки') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'Убрать из закладок' : 'Добавить главу в закладки');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'В закладках' : 'В закладки';
 btn.setAttribute('aria-label', added ? 'Убрать из закладок' : 'Добавить главу в закладки');
 // Обновить отметки боковой панели
 updateTocBookmark(id, added);
 });
 // Вставить после h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // Инициализировать отметки закладок в боковой панели
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== Отметки о прочтении глав =====
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
 // Найти строку меты или элемент перед h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'Прочитано' : 'Прочитано') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'Снять отметку' : 'Отметить как прочитанное');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'Прочитано' : 'Прочитано';
 check.setAttribute('aria-label', done ? 'Снять отметку' : 'Отметить как прочитанное');
 // Обновить боковую панель
 updateTocCompleted(id, done);
 // Обновить прогресс прочтения
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
 // Также обновить счётчик прочитанного
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} глав`;
 }
 }

 // ===== Поиск (расширенный: навигация клавишами + счётчик результатов) =====
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
 renderSearchPlaceholder('Введите ключевые слова для поиска');
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
 renderSearchPlaceholder('Ничего не найдено');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">${results.length} найдено</div>`;
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
 renderSearchPlaceholder('Введите ключевые слова для поиска');
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

 // Навигация в поиске с клавиатуры
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

 // ===== Размер шрифта =====
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

 // ===== Закрытие панели свайпом =====
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

 // ===== Навигация по главам =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'Предыдущая глава'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'Следующая глава'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== Печать =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== Глобальные горячие клавиши =====
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

 // Закрывать окна по клику на затемнение
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
 // Печать браузер обрабатывает сам
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

 // ===== Отслеживание дней чтения подряд =====
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

 // Показать уведомление о серии дней
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 День ' + streak + ' чтения подряд. Так держать!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage может быть недоступен */ }
 }
 updateStreak();

 // ===== Резервное копирование/восстановление =====
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
 // Собрать состояния самопроверки
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // Собрать состояния прочтения глав
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // Собрать закладки
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // Собрать оценки
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'PhoneClass-backup-reading_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('Не удалось экспортировать копию: ' + e.message);
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
 // Восстановить состояния самопроверки
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // Восстановить состояния прочтения глав
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
 // Восстановить закладки
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('Восстановление прошло успешно! Страница перезагрузится, чтобы применить все данные.');
 location.reload();
 } catch(err) {
 alert('Ошибка восстановления: неверный формат файла. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('Удалить все данные о чтении? Действие необратимо! Сначала экспортируйте резервную копию.')) return;
 if (!confirm('Подтвердите ещё раз: весь прогресс чтения, закладки и оценки будут удалены. Продолжить?')) return;
 localStorage.clear();
 alert('Все данные удалены. Страница будет перезагружена.');
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

 // ===== Система оценок глав =====
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
 // Вставить после h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== Оптимизация: дребезг прокрутки =====
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

 // ===== Следовать тёмной теме системы =====
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

 // ===== Автоматически добавлять к заголовкам глав хлебные крошки и метки сложности =====
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
 
 ${level === 'beginner' ? 'Начальный' : level === 'intermediate' ? 'Средний' : 'Продвинутый'}
 </span>
 <span class="reading-time">
 ~${minutes} мин чтения
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== Добавлять главам блок «Кратко» =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">Кратко о главе</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['Складные уже зрелые, но не массовые: устройство «для украшения», а не «для спасения»', 'Поперечная складка = телефон + планшет; продольная = компактность + быстрый взгляд на внешний экран', 'Кому подходит: активное чтение/бизнес/съёмка в зависании/женщинам, ценящим компактность', 'Шесть пунктов при выборе: тип шарнира, внутренний экран UTG, складка, размер внешнего экрана, вес и толщина, цена послегарантийного ремонта', 'Эксклюзивные приёмы: многозадачность на двух половинах, зависание под 90 градусов, быстрый взгляд на внешний экран, режим ПК', 'Основа ухода: не раскрывать на морозе, беречь от песчинок, не клеить обычную плёнку на внутренний экран, оберегать шарнир от пыли', 'Ожидания: складка останется навсегда, устройство тяжелее и толще, автономность средняя, остаточная стоимость низкая, ремонт дорогой', 'Философия покупки: его берут за уникальную форму, а не потому, что он «более продвинутый»'],
 'di-ling-zhang': ['Понять позицию книги: доходная цифровая энциклопедия, где всё можно сделать руками', 'Освоить систему символов: что значат [кнопки], >, полужирный и курсив', 'Почему объём памяти телефона «усыхает»: главные причины', 'Заведите привычку записывать конфигурацию своего телефона', 'Телефон = хранилище цифровых активов; профилактика - главная идея', 'Данные нередко стоят дороже самого устройства'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + модем и другие модули в одной микросхеме', 'Большие и малые ядра CPU работают вместе: баланс производительности и автономности', 'Экран: OLED/LCD, частота обновления, автояркость', 'Ядро фотосистемы: размер сенсора важнее числа мегапикселей', 'Эволюция разъёмов: Micro USB → Lightning → единый USB-C', '5G-A приносит новую способность «единства связи и сенсорики»'],
 'di-yi-zhang-harmony': ['HarmonyOS = распределённая ОС, многодевайсность заложена с самого начала', 'HarmonyOS 4.3 совместим с AOSP и умеет запускать Android-приложения', 'HarmonyOS NEXT полностью самостоятелен и больше не поддерживает Android-приложения', 'Перед обновлением обязательно убедитесь, что у привычных приложений есть нативные версии'],
 'di-er-zhang': ['Три уровня хранения: сам телефон / SD-карта / облако', 'Что означают обычные папки Android (DCIM, Download и др.)', 'Резервирование данных = облачная копия + локальная копия, двойная страховка', 'Удаление - не уничтожение; по-настоящему стирает только «перезапись»', 'Шпаргалка по частым форматам файлов (изображения/аудио/видео/документы)', 'Именование «дата + событие» - базовая норма', 'Автоочистка за 72 часа решает проблему разросшегося кэша соцприложений', 'Двойная защита фото: маскировка + срезание EXIF'],
 'di-san-zhang': ['У 4G/5G свои роли; 5G-A - расширенная версия', 'Ключевые технические различия Wi-Fi 6/6E/7', 'Публичный Wi-Fi - зона осторожности: не вводите чувствительные данные', 'Bluetooth 5.x продолжает развиваться, LE Audio уже распространяется', 'NFC работает на расстоянии до 10 см; сама физическая близость и есть гарантия безопасности'],
 'di-si-zhang': ['Приложения ставьте прежде всего из официальных магазинов', 'APK-пакет = сертификат + ресурсы + конфигурация + бинарный код', 'Осторожно с приложениями «ускорителей очистки»; фоновым приложениям жить положено', 'Проверка подписи приложения защищает от подмены: системный уровень защиты', 'Чистый режим = установка только из официального магазина: первая стена против вредоносного ПО', '«Цифровые паразиты» - это взломанные версии приложений с троянами внутри', 'Механизм проверки магазинов приложений: сканирование на вирусы + проверка прав + верификация разработчика'],
 'di-wu-zhang': ['Экран: разрешение, частота обновления, автояркость', 'Звук: громкость звонка/медиа/уведомлений настраиваются раздельно', 'Хранилище: регулярно чистить кэш и ненужные файлы', 'Биометрия: отпечаток против лица; 3D безопаснее 2D', 'Экранные дикторы: VoiceOver на iOS / TalkBack на Android - глаза незрячих пользователей', 'Увеличение: высококонтрастная тема, жирный шрифт, цветовые фильтры - трио', 'ИИ-описание картинок: ИИ читает изображения, меню и капчи за вас', 'Живые субтитры - спасение для слабослышащих и для шумной обстановки', 'RTT/TTY: люди без голоса или слуха тоже могут звонить'],
 'di-liu-zhang': ['Пароль экрана блокировки + двухфакторная аутентификация - базовая линия обороны', 'Права приложений: включать по необходимости, принцип минимальных привилегий', 'Никаких платежей и входов в аккаунты через публичный Wi-Fi', 'В эпоху ИИ глазам верить нельзя: подмена лица и голоса, притворство авторитетом, фейковые инвестиции - самые частые схемы', 'План прорыва: проверка действием + контрольное слово + повторное подтверждение', 'Перед отправкой фото - обезличить: отключить в EXIF геолокацию и данные устройства', 'Устройствам IoT - сменить пароль по умолчанию', 'Столкнувшись с обманом, помните: не верить на слово, не раскрывать данные, не переводить деньги'],
 'di-qi-zhang-jichu': ['Спутниковая связь: «спасательный круг» в чрезвычайной ситуации', 'Связь без сети: переговоры на дальней дистанции без интернета', 'Детекция аварии: слияние сенсоров распознаёт серьёзное столкновение', 'StarFlash (NearLink): низколатентное беспроводное соединение с огромным потенциалом'],
 'di-ba-zhang': ['Запись разговоров: помните о законе', 'iMessage/RCS превращают обычные SMS в мультимедийные сообщения', 'Историю переписки WeChat сохраняет только его собственная функция резервного копирования', 'Почтовые приложения поддерживают единое управление несколькими аккаунтами', 'Фильтрация спама: системное распознавание + чёрные/белые списки + фильтры по ключевым словам SMS', '«Заглушить неизвестных» на iOS отсекает спам, но следите, чтобы не пропустить важное', 'Ошибочные метки спама можно оспорить через Dianhua Bang/360/Tencent и каналы оператора'],
 'di-jiu-zhang': ['WPS Office лучше всего работает в Китае, Microsoft 365 - лидер по совместимости', 'Заметки в три этапа: записал → прочту позже → система знаний', 'Сканирование телефоном: Заметки/Mic Lens/Baimiao/CamScanner', 'Облачные хранилища по потребности: iCloud/OneDrive/Яндекс.Диск и Baidu/Aliyun Drive - у каждого свои сценарии'],
 'di-shi-zhang': ['Платёжный код: кто увидел - тот и получил деньги; никому и никогда не отправляйте его скриншот', 'Пятиминутный чек безопасности: биометрическая оплата + защитный замок + проверка платежей без пароля + управление устройствами', 'В метро и автобусе - виртуальная транспортная карта из кошелька телефона; работает и офлайн', 'Электронный полис ОМС, запросы пенсионных данных, налоговая декларация - всё решается с телефона', 'Четыре «нет» мошенникам: не переводить на «безопасный счёт», не отправлять платёжный код, не открывать незнакомые ссылки, не сообщать номер банковской карты'],
 'di-shi-yi-zhang': ['Четыре частые ошибки: грязный объектив, не настроенная экспозиция, злоупотребление вспышкой, неуместный цифровой зум', 'Ночной режим собирает картинку из множества кадров; держите ровно 2-4 секунды', 'Про-режим: чем ниже ISO, тем чище картинка; выдержка управляет светом', 'Пост-обработка: исправить геометрию → базовая коррекция → локальная доводка → стилизация', 'Умный поиск + регулярная чистка + ручные альбомы = трио управления фотографиями'],
 'di-shi-yi-zhang-advanced': ['Три кита видео: разрешение, частота кадров, битрейт', 'H.265 сжимает на 50% лучше, чем H.264', 'ProRes - профессиональный кодек Apple; файлы огромные', 'HDR10/10+/Dolby Vision - у каждого своя ниша'],
 'di-shi-er-zhang': ['NetEase Cloud Music сильна плейлистами и сообществом, у QQ Music самый широкий каталог, Apple Music проста и без потерь, у Spotify сильные рекомендации', 'Xiaoyuzhou - первый выбор среди русскоязычных и китайских подкастов; используйте ускорение и автоочистку', 'Локальное видео: VLC (все форматы) или nPlayer (управление жестами)', 'Выделения в WeChat Read - с соцфункциями + синхронизация с Kindle; режим защиты глаз включать обязательно', 'Игровой режим прежде всего держит стабильный FPS; при перегреве выручает охлаждающая накладка'],
 'di-shi-san-zhang': ['Инструменты продуктивности: задачи + помодоро + календарь', 'Здоровье и спорт: Apple Health/Google Fit как центр данных', 'Браузер - сначала Edge, вместе с Copilot для продуктивности', 'Поиск: отличайте правду; доверяйте официальным доменам, избегайте дешёвых зон вроде .xyz', 'Чистку начинайте со встроенной; сторонние вроде Qingzhuo - лишь дополнение, никакой очистки «всего одним нажатием»', 'Приложения от спама: Национальный центр борьбы с мошенничеством + фирменные «стражи» + блокировка оператора', 'Встроенная блокировка: на iOS - «Заглушить неизвестных»; на Android включается в фирменном телефонном приложении каждого бренда', 'Три уровня вместе: системная блокировка + оператор + центр борьбы с мошенничеством; следите за белым списком, чтобы не блокировать своих', 'Погодные оповещения: системное приложение погоды + официальные метеоканалы; действуйте по уровням синий/жёлтый/оранжевый/красный', 'Оповещения о стихийных бедствиях: метео + каналы МЧС; в ливень и тайфун держитесь подальше от низин и рекламных щитов', 'Оповещение о землетрясении - не прогноз: секунды или десятки секунд заранее; на Android обычно в настройках безопасности', 'TickTick: списки + календарь + помодоро, задачи на естественном языке', 'Сканирование бумаги: системная камера/Mic Lens/Baimiao/CamScanner; снимайте чётко, затем OCR', 'Удалённый доступ к ПК: Sunflower/ToDesk; если незнакомец просит установить удалённый доступ - это мошенничество', 'ИИ в офисе: Trae и другие; тяжёлая работа на ПК, с телефона - дистанционное сопровождение', 'Быстрая передача по локальной сети: LocalSend/AirDrop/Feige; буфер обмена: KDE Connect/фирменные инструменты', 'Одноразовые коды 2FA: Aegis/Microsoft Authenticator, резервные коды - на бумаге в двух местах'],
 'di-shi-si-zhang': ['С менеджером паролей достаточно помнить один мастер-пароль', 'Bitwarden - открытый и бесплатный, 1Password - лучший по удобству', 'Мастер-пароль должен быть длинным и сложным, с включённой 2FA', 'Регулярно проводите аудит парольной безопасности', 'Архитектура с нулевым знанием: даже сервис не видит ваших паролей; шифрование происходит локально', 'AES-256 + функции выведения ключей PBKDF2/Argon2 - краеугольный камень безопасности парольных хранилищ', 'Урок инцидента LastPass 2022: больше всех рискуют пользователи со слабым мастер-паролем', 'Сила пароля - в «энтропии»: длина + случайность важнее хитрых символов', 'HaveIBeenPwned проверяет утечки, 1Password Watchtower следит за инцидентами', 'Passkey построены на FIDO2/WebAuthn: защита от фишинга, пароль никуда не передаётся', 'Кросс-девайсная синхронизация Passkey: связка ключей iCloud/Google Password Manager уже поддерживают её', 'Аппаратные ключи (YubiKey/Titan) устойчивы к фишингу и перехвату SIM - для особо бдительных пользователей', 'Общие хранилища 1Password + экстренный доступ Bitwarden делают семейный и командный обмен безопаснее'],
 'di-shi-wu-zhang': ['Литиевые батареи: заряжай по мере надобности, боятся жары, стареют', 'Ниже 80% здоровья батареи время работы заметно сокращается', 'Протоколы быстрой зарядки: PD/QC/VOOC/SuperCharge взаимно несовместимы', 'Беспроводная зарядка Qi2 добавляет магнитное позиционирование', 'Ядро экономии заряда: ниже яркость + закрыть фоновые приложения + переключиться на 4G'],
 'di-shi-liu-zhang': ['Аккаунт - прописка вашей цифровой жизни: связывает контакты, фото, покупки и «Найти телефон»', 'Три «обязательно»: включить 2FA, задать ключ восстановления, убедиться, что «Найти телефон» включён', 'iCloud на 5 ГБ не хватает: чистите или переходите на 50 ГБ за 6 юаней в месяц', 'Синхронизация двусторонняя (удалил - пропало везде), резервная копия - односторонний снимок (удалил - копия осталась)', 'Пользователям Android проверять по отдельности: фирменное облачное резервирование, резервирование Google, резервирование WeChat'],
 'di-shi-qi-zhang': ['Связка устройств: AirDrop от Apple/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/Link to Windows', 'Трансляция на телевизор: iPhone - «Повтор экрана», Android - беспроводная трансляция; если не выходит, проверьте один и тот же Wi-Fi', 'Умные часы = фильтр уведомлений + пункт здоровья + оплата с запястья; такие родителям могут выручить', 'Умный дом выбирайте по экосистеме: Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'Безопасность связок: на публике следите за приватностью при трансляции, старые устройства отвязывайте вовремя'],
 'di-shi-ba-zhang': ['Полная копия устройства: локально на ПК (надёжнее всего) + облако (спокойнее всего) - двойная страховка', 'Переписка WeChat - особый случай: переносится только встроенным резервным копированием WeChat, инструменты миграции бессильны', 'Правило 3-2-1: 3 копии, 2 типа носителей, 1 - вне дома', 'Переезд на новый телефон: у одного бренда - фирменное приложение переноса; между брендами заранее готовьте транзит данных'],
 'di-shi-jiu-zhang': ['Тормоза и нагрев в четыре шага: вспомнить недавнее → проверить хранилище → проверить расход заряда → проверить сигнал', 'Порядок при падении приложения: закрыть и открыть заново → обновить → проверить права → очистить кэш → переустановить', 'Не заряжается: сначала почистите разъём, затем крестом меняйте кабель и зарядку, чтобы найти виновника', 'Нет сети: выключить и включить авиарежим → «забыть» Wi-Fi и подключиться заново → перезагрузить роутер', 'Универсальная перезагрузка решает большинство странных проблем; для ремонта выбирайте авторизованные сервисы, перед сдачей сделайте копию и выйдите из аккаунтов'],
 'di-er-shi-zhang-jinjie': ['Режим разработчика: семь нажатий на номер сборки для включения', 'BL-замок: заводская защита; разблокировка - с осторожностью', 'Root: риски перевешивают пользу; обычным пользователям не рекомендуется', 'Magisk всё ещё требует разблокировать BL, но умеет скрывать статус root'],
 'di-er-shi-yi-zhang': ['VPN = шифрованный туннель; бесплатный VPN вполне может красть ваши данные', 'Защита от «человека посередине» в публичном Wi-Fi: доверять HTTPS, отключать автоподключение, чувствительное - только через мобильный интернет', 'HTTPS-рукопожатие шифрует за четыре обмена, но и фишинговые сайты умеют HTTPS', 'DoH/DoT шифруют DNS-запросы: оператор не подсмотрит ваши посещения', 'Инкогнито = локальный ластик, а не плащ-невидимка: провайдер и сайты по-прежнему вас видят', 'Список безопасности: отключите автоподключение Wi-Fi, включите шифрованный DNS, включите 2FA, проверьте права приложений, запретите Juice Jacking'],
 'di-er-shi-er-zhang': ['ИИ-камера: распознать сцену → слить кадры → умная оптимизация', 'Голосовые ассистенты: расслышать → понять → исполнить, три шага', 'ИИ на устройстве: быстро, приватно, работает офлайн', 'Большие ИИ-модели: сценарии общения/письма/перевода/картинок/учёбы', 'Типичные задачи: живой перевод, ИИ-ластик, ИИ-ретушь, работа с документами, ИИ-поиск по картинкам', 'Фреймворк промптов CRISPE: роль + запрос + контекст + вывод + тон + примеры', 'С ИИ остерегайтесь галлюцинаций и утечек приватности', '«Роль-Контекст-Задача-Ограничения» - более простой вход в мир промптов', 'Признаки хорошего промпта: конкретность, контекст, формат, ограничения, проверяемость'],
 'di-er-shi-san-zhang': ['Элементы автоматизации: триггер + действие + опциональная логика условия', 'Быстрые команды iOS: утренний сценарий в одно касание, автоэкономия заряда, учёт расходов по QR', 'Android: автокликеры (экранные макросы), Tasker (самая мощная автоматизация), MacroDroid (дружелюбен к новичкам)', 'Грабли: неточное срабатывание по геолокации, iOS не запускает автоматом без подтверждения, Tasker требует особых прав доступа', 'Мышление автоматизации: превратить рутину в «условие → действие», и телефон станет вашим личным ассистентом'],
 'di-er-shi-si-zhang': ['Bootloader - привратник на старте; проверка подписей защищает от подмены', 'Политики разблокировки BL у брендов различаются (Xiaomi позволяет/Huawei блокирует)', 'Варианты Root: Magisk/KernelSU/SuperSU', 'Три типа прошивок: официальная ROM/сторонний Recovery/сторонняя ROM'],
 'di-er-shi-wu-zhang': ['Продажа старого телефона: копия → выход из аккаунтов → шифрованная очистка → заполнить и очистить снова', 'Цифровое наследство: Legacy Contact в iCloud/неактивный аккаунт Google', 'Утилизация: сначала официальные программы trade-in; старый телефон может побыть камерой или навигатором'],
 'di-er-shi-liu-zhang': ['Три признака ИИ-телефона: большая модель на устройстве, производительность NPU в TOPS, AI Agent поверх приложений', 'ИИ-стратегии производителей: Apple/Google/Huawei/Xiaomi/OPPO/vivo - у каждого свои сильные стороны', 'Спутниковая связь: короткие сообщения BeiDou дошли до среднего класса, звонки Tiantong остаются флагманскими', 'Складные: железо зрелое, приложения адаптированы процентов на семьдесят, зависание/сплит-скрин - уникальный опыт', '6G ещё в пути, Wi-Fi 7 уже здесь, Bluetooth LE Audio начинает распространяться', 'Аккумуляторы с кремний-углеродным анодом делают 5000-6000 м Ач нормой для флагманов'],
 'di-er-shi-qi-zhang': ['Сначала включите простой режим или увеличьте шрифт/значки: при удобной среде половина проблем исчезает', 'Три железных правила помощи старшим: не торопить, объяснять через аналогии, записывать', 'Шесть частых схем мошенничества, о которых надо напоминать снова и снова; три линии обороны отсекают 90% обмана', 'Удалённая помощь позволяет починить телефон родителям, даже находясь в другом городе', 'Режим заботы WeChat + голосовой ввод - две самые полезные для старших функции', 'Экстренный вызов SOS и детекция падения - настройки, которые спасают жизнь в решающий момент'],
 'di-er-shi-ba-zhang': ['Выбор телефона в три шага: сначала потребности → затем бюджет → в конце модель', 'Ключевых параметров всего пять: процессор, экран, камера, батарея и зарядка, обещание обновлений', '¥1500-3500 - самый выгодный и самый рекомендуемый «сладкий» диапазон', 'Флагман прошлого года выгоднее среднего класса нынешнего', 'Пять ловушек: миф о мультикамерах, культ мегапикселей, операторские версии, культ изогнутых экранов, ИИ-приманки', '618 и «Двойная одиннадцать» - два лучших окна в году для покупки телефона'],
 'di-er-shi-jiu-zhang': ['Сначала посмотрите статистику экранного времени; осознание - первый шаг к переменам', 'Лимиты для развлекательных приложений, таймеры для «Не беспокоить» - верните себе внимание', 'Правило 20-20-20 - самый простой и действенный навык гигиены глаз', 'Наклон к телефону нагружает шею весом головы в 5-6 раз; держите телефон выше и разминайте шею', 'За час до сна - без телефона; зарядку держите вне вытянутой руки', 'Противоядие от информационной тревоги - «активная блокировка», а не «получать больше»'],
 'di-san-shi-zhang': ['Три лагеря беспроводной трансляции: AirPlay (Apple), Miracast (Android), DLNA (кроссплатформенная передача медиа)', 'Проводная трансляция стабильнее и без задержек; для переговорной обязателен переходник HDMI', 'Samsung DeX/режим Huawei превращают телефон в лёгкий офисный ПК', 'Подключение в автомобиле: четыре решения - CarPlay/Android Auto/HiCar/CarLife', 'Железные правила трансляции в переговорной: протестировать заранее, подготовить план Б, скрыть предпросмотр уведомлений'],
 'di-san-shi-yi-zhang': ['До съёмки ответьте: кто зритель, какую ценность даёте, на какой площадке публикуете', 'Пять дел перед съёмкой: 1080P/30fps, протереть объектив, заблокировать фокус и экспозицию, выбрать ориентацию, включить сетку', 'Пять приёмов камеры: наезд, отъезд, панорама, перемещение, сопровождение - стабильность прежде всего', 'Монтаж в CapCut: обрезка → переходы → субтитры → BGM → экспорт, шесть шагов', 'Первые 3 секунды решают всё; одно видео - одна мысль; постоянство важнее таланта'],
 'di-san-shi-er-zhang': ['Золотые 30 минут при утере телефона: одолжите телефон и позвоните себе → удалённая блокировка → блокировка SIM → заморозка платежей → сообщить близким → заявление в полицию', '72 часа после обмана: прекратить переводы → сохранить доказательства → позвонить на 96110 → заявить в полицию → связаться с банком → сменить пароли', 'Телефон заражён: безопасный режим → удалить подозрительные приложения → антивирусное сканирование → сброс к заводским (крайняя мера)', 'Аккаунт украли: сменить пароль → выйти на устройствах → проверить историю входов → включить 2FA → проверить привязки → проверить платежи', '99,9% требований выкупа - мошенничество: не отвечать, не платить, сделать скриншот и заблокировать', 'Мошенничество с подменой лица/голоса: ищите изъяны в моргании, артикуляции, контурах и свете; попросите повернуть голову, закрыть лицо, задайте личный вопрос, перезвоните по известному номеру', 'Перехват SIM: если телефон внезапно показывает «Нет сети» - тревога; установите PIN на SIM, включите вторую проверку у оператора, переведите ключевые аккаунты на приложения-аутентификаторы', 'Пять ежедневных привычек: экран блокировки + 2FA, «Найти телефон», PIN на SIM, не ставить неизвестные приложения, регулярные резервные копии', 'Землетрясение/непогода: сначала укрыться поблизости, потом эвакуироваться; SMS о том, что вы живы, экономнее долгого звонка', 'Без сигнала - сначала спутниковый SOS (если модель поддерживает); оповещения и настройки - в Главе 13'],
 'di-san-shi-san-zhang': ['Vision Pro и AR-очки - новые вычислительные входы помимо телефона, но в ближайшие годы они его не заменят', 'До потребительских нейроинтерфейсов ещё 10-20 лет; этика созревает раньше технологии', 'Телефон эволюционирует к «невидимости»: от центра устройств к центру идентичности', 'Этика ИИ, суверенитет данных и цифровой разрыв - ключевые темы следующего десятилетия', 'Быть на связи и оставаться независимым - неизменная философия цифровой жизни'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // Пропускать главы, где краткое резюме уже встроено, чтобы не дублировать
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== Кнопка копирования (добавляется к элементам kbd) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'Копировать');
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

 // ===== Сворачиваемый длинный контент (уровень h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // Сворачивать только длинные h4-блоки
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // Добавить заголовок сворачивания
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

 // ===== Учебная панель: прогресс чтения + самопроверка телефона =====
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
 // Прогресс чтения
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // Количество закладок
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // Последняя глава
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // Самопроверка здоровья
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'Отлично! Безопасность вашего телефона в отличном состоянии';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'Хорошо! ' + (totalChecks - checked) + ' пунктов можно улучшить';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'На троечку - в приоритете неотмеченные пункты безопасности';
 else healthMsgEl.innerHTML = 'У вашего телефона есть уязвимости - исправьте их поскорее';
 }
 }

 // Восстановить состояния отметок
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // Обновлять каждые 3 секунды (ловит отметки глав)
 setInterval(updateDashboard, 3000);

 // ===== Озвучка текста (TTS) =====
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
 // Клонировать и убрать элементы, которые не надо озвучивать
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // Убрать свёрнутые тела, но сохранить их текст
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('Извините, ваш браузер не поддерживает озвучку текста. Рекомендуем Chrome или Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'Глава без названия';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'ru-RU';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // Попробовать выбрать более естественный русский голос
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('ru'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // Автоматически читать следующую главу
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
 // Найти текущую видимую главу
 if (ttsSectionIndex < 0) {
 // Начать с начала или с главы, ближайшей к позиции прокрутки
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
 ttsLabel.textContent = 'Не начато';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // Привязка событий
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
 // Пересоздать и воспроизвести текущий фрагмент
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

 // Горячая клавиша: R переключает озвучку
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

 // ===== Инициализация =====
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

