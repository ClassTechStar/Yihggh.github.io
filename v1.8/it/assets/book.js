
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

 // ===== Tema =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? 'Passa alla modalità chiara' : 'Passa alla modalità scura';
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

 // ===== Scorrimento: progresso + ombra + torna su + progresso indice + anello di avanzamento =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} capitoli`;

 // Parametri dell’anello di avanzamento
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

 // Aggiornamento dell’anello di avanzamento
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

 // A che capitolo si è arrivati
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} capitoli`;
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

 // ===== Memoria della posizione di lettura =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // Troppo in alto: non salvare
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // Trova il nome del capitolo corrente
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

 // Ripristina la posizione al caricamento della pagina
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
 restoreToastText.textContent = `Ultima lettura: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // Nasconde automaticamente dopo 10 secondi
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

 // ===== Animazione d’ingresso allo scorrimento =====
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
 // I contenuti del primo schermo sono subito visibili
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== Apertura/chiusura barra laterale =====
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

 // Strumenti rapidi: apri l’indice
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== Navigazione globale per ancore: compensa lo scostamento della barra fissa =====
 // Bisogna usare scrollIntoView e non calcolare le coordinate a mano: .content-section ha
 // content-visibility:auto + contain-intrinsic-size(0 800px): i capitoli fuori schermo
 // occupano segnaposto da 800px, getBoundingClientRect restituisce le coordinate del segnaposto e uno scrollTo diretto
 // finirebbe nel punto sbagliato (più in là è il capitolo, maggiore è lo scarto accumulato). scrollIntoView lascia al browser
 // renderizza la destinazione su richiesta e la posiziona, e html{scroll-padding-top:5rem} compensa
 // navigazione.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // Passo 1: la modalità instant forza prima il rendering del capitolo e lo posiziona, evitando che content-visibility
 // deriva durante lo scorrimento fluido causata dal rendering differito.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // Passo 2: quando la destinazione è renderizzata e le coordinate stabili, si rilancia lo scorrimento fluido per un’esperienza morbida.
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

 // ===== Collasso dell’indice =====
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

 // ===== Filtro dell’indice =====
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

 // ===== Evidenziazione nell’indice =====
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

 // ===== Sistema di segnalibri =====
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

 // Aggiunge a ogni capitolo un pulsante segnalibro
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'Nei segnalibri' : 'Segnalibro') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'Rimuovi dai segnalibri' : 'Aggiungi il capitolo ai segnalibri');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'Nei segnalibri' : 'Segnalibro';
 btn.setAttribute('aria-label', added ? 'Rimuovi dai segnalibri' : 'Aggiungi il capitolo ai segnalibri');
 // Aggiorna i contrassegni nella barra laterale
 updateTocBookmark(id, added);
 });
 // Inserisce dopo l’h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // Inizializza i contrassegni dei segnalibri nella barra
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== Spunte di lettura capitolo =====
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
 // Trova la riga meta o l’elemento prima dell’h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'Letto' : 'Letto') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'Segna da leggere' : 'Segna come letto');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'Letto' : 'Letto';
 check.setAttribute('aria-label', done ? 'Segna da leggere' : 'Segna come letto');
 // Aggiorna la barra laterale
 updateTocCompleted(id, done);
 // Aggiorna il progresso di lettura
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
 // Aggiorna anche il conteggio dei capitoli letti
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} capitoli`;
 }
 }

 // ===== Ricerca (avanzata: navigazione da tastiera + conteggio risultati) =====
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
 renderSearchPlaceholder('Scrivi le parole chiave per cercare');
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
 renderSearchPlaceholder('Nessun risultato trovato');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">${results.length} risultati trovati</div>`;
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
 renderSearchPlaceholder('Scrivi le parole chiave per cercare');
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

 // Navigazione della ricerca da tastiera
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

 // ===== Dimensione del carattere =====
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

 // ===== Chiusura della barra laterale con lo swipe =====
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

 // ===== Navigazione tra capitoli =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'Capitolo precedente'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'Capitolo successivo'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== Stampa =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== Scorciatoie globali da tastiera =====
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

 // Chiude le finestre al clic sulla velatura
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
 // La stampa la gestisce già il browser
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

 // ===== Tracciamento dei giorni di lettura consecutivi =====
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

 // Mostra l’avviso della serie di giorni
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 Giorno ' + streak + ' di lettura di fila. Continua così!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage può non essere disponibile */ }
 }
 updateStreak();

 // ===== Backup/ripristino =====
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
 // Raccoglie gli stati dell’autocontrollo
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // Raccoglie gli stati di lettura dei capitoli
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // Raccoglie i segnalibri
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // Raccoglie le valutazioni
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'Backup-lettura-PhoneClass_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('Esportazione del backup non riuscita: ' + e.message);
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
 // Ripristina gli stati dell’autocontrollo
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // Ripristina gli stati di lettura dei capitoli
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
 // Ripristina i segnalibri
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('Ripristino riuscito! La pagina si ricaricherà per applicare tutti i dati.');
 location.reload();
 } catch(err) {
 alert('Ripristino non riuscito: formato file non valido. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('Cancellare tutti i dati di lettura? Operazione irreversibile! Prima esporta un backup.')) return;
 if (!confirm('Conferma di nuovo: tutto il progresso di lettura, i segnalibri e le valutazioni saranno eliminati. Continuare?')) return;
 localStorage.clear();
 alert('Tutti i dati cancellati. La pagina si ricaricherà.');
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

 // ===== Sistema di valutazione dei capitoli =====
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
 // Inserisce dopo l’h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== Ottimizzazione anti-rimbalzo dello scroll =====
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

 // ===== Segue la modalità scura di sistema =====
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

 // ===== Aggiunge automaticamente breadcrumb ed etichette di difficoltà ai titoli dei capitoli =====
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
 
 ${level === 'beginner' ? 'Base' : level === 'intermediate' ? 'Intermedio' : 'Avanzato'}
 </span>
 <span class="reading-time">
 ~${minutes} min di lettura
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== Aggiunge alle tappe un blocco “In sintesi” =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">In sintesi</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['I pieghevoli sono maturi ma non di massa: un “extra” raffinato, non un “soccorso” necessario', 'Piegato in traverso = telefono + tablet; piegato in lungo = tascabilità + sbirciata sullo schermo esterno', 'Adatto a: lettura intensiva/business/creatività in hover/donne che amano la portabilità', 'Sei controlli all’acquisto: tipo di cerniera, schermo interno UTG, piega, dimensione dello schermo esterno, peso e spessore, prezzo della riparazione', 'Trucchi esclusivi: multitasking a schermo diviso, hover a 90 gradi, sbirciata sullo schermo esterno, modalità PC', 'Cura essenziale: non aprirlo/chiuderlo al freddo, tener lontano sporco e sabbia, niente pellicole normali sullo schermo interno, cerniera al riparo dalla polvere', 'Aspettative: la piega resta per sempre, più pesante e spesso, autonomia media, valore di rivendita basso, riparazioni care', 'Filosofia d’acquisto: lo compri per la forma unica, non perché sia “più avanzato”'],
 'di-ling-zhang': ['Capire la collocazione del libro: divulgazione tech parlata chiara e con le mani in pasta', 'Impara il sistema di simboli: cosa significano [pulsanti], >, grassetto e corsivo', 'Perché la capacità del telefono “si sgonfia”: le cause principali', 'Prenditi l’abitudine di annotare le specifiche del tuo telefono', 'Telefono = caveau di asset digitali; la prevenzione è l’idea centrale', 'I dati spesso valgono più dell’hardware stesso'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + modem e altri moduli in un unico chip', 'Core grandi e piccoli della CPU lavorano insieme: prestazioni e batteria in equilibrio', 'Schermo: OLED/LCD, frequenza di aggiornamento, luminosità automatica', 'Cuore dell’imaging: il sensore conta più dei megapixel', 'Evoluzione delle porte: Micro USB → Lightning → USB-C unificato', 'Il 5G-A porta la nuova capacità di “unione di comunicazione e sensori”'],
 'di-yi-zhang-harmony': ['HarmonyOS = sistema operativo distribuito, pensato per molti dispositivi sin dalla nascita', 'HarmonyOS 4.3 è compatibile con AOSP e può eseguire app Android', 'HarmonyOS NEXT è pienamente autonomo e non supporta più le app Android', 'Prima di aggiornare, assicurati che le app che usi di più abbiano versioni native'],
 'di-er-zhang': ['Archiviazione a tre livelli: telefono / scheda SD / cloud', 'Cosa significano le cartelle Android più comuni (DCIM, Download ecc.)', 'Backup dei dati = cloud + locale, doppia protezione', 'Cancellare non è distruggere; solo “sovrascrivere” cancella davvero', 'Rapida guida ai formati di file più comuni (immagine/audio/video/documento)', 'Nomenclatura “data + evento”: la convenzione di base', 'La pulizia automatica a 72 ore risolve l’accumulo di cache delle app social', 'Doppia protezione per le foto: oscuramento + rimozione EXIF'],
 'di-san-zhang': ['4G/5G hanno ruoli diversi; il 5G-A è la versione potenziata', 'Differenze tecniche chiave di Wi-Fi 6/6E/7', 'Con il Wi-Fi pubblico massima cautela: non digitare dati sensibili', 'Bluetooth 5.x continua a crescere, il LE Audio inizia a diffondersi', 'L’NFC lavora entro 10cm: la prossimità fisica è essa stessa la garanzia'],
 'di-si-zhang': ['Le app installale prima di tutto dagli store ufficiali', 'Un pacchetto APK = certificato + risorse + configurazione + binario', 'Attento alle app “pulisci-velocizza”; che le app restino in background è normale', 'La verifica della firma app impedisce manomissioni: protezione a livello di sistema', 'Modalità pura = installazioni solo dallo store ufficiale: il primo muro contro il malware', '“Parassiti digitali” indica le versioni crackate con trojan dentro', 'Meccanismo di revisione degli store: scansione antivirus + revisione permessi + verifica degli sviluppatori'],
 'di-wu-zhang': ['Schermo: risoluzione, frequenza di aggiornamento, luminosità automatica', 'Suono: volumi suoneria/media/notifiche gestiti separatamente', 'Archiviazione: pulisci di regola cache e file inutili', 'Biometria: impronta contro volto; il 3D è più sicuro del 2D', 'Lettori di schermo: VoiceOver su iOS / TalkBack su Android sono gli occhi degli utenti non vedenti', 'Ingrandimento: alto contrasto, testo in grassetto, filtri colore - il tris', 'Descrizione immagini AI: l’AI legge immagini, menù e captcha per te', 'I sottotitoli dal vivo: una salvezza per chi non sente e per gli ambienti rumorosi', 'RTT/TTY: chi non parla o non sente può comunque telefonare'],
 'di-liu-zhang': ['Password di blocco + autenticazione a due fattori: la difesa di base', 'Permessi delle app: attivali al bisogno, principio del minimo privilegio', 'Niente pagamenti o accessi su Wi-Fi pubblici', 'Nell’epoca dell’AI vedere non è credere: volti e voci clonati, false autorità, falsi investimenti sono le truffe più comuni', 'Manuale di uscita: verifica con un gesto + parola d’ordine + seconda conferma', 'Prima di condividere le foto, anonimizzale: disattiva posizione e dati del dispositivo negli EXIF', 'Dispositivi IoT: cambiare la password predefinita', 'In truffa, ricorda: non fidarti, non svelare, non trasferire'],
 'di-qi-zhang-jichu': ['Satellitare: la “corda di salvataggio” nelle emergenze', 'Comunicare senza rete: radio a lunga gittata anche senza copertura', 'Rilevamento incidenti: la fusione dei sensori riconosce gli urti gravi', 'StarFlash: collegamento wireless a bassa latenza con un potenziale enorme'],
 'di-ba-zhang': ['Registrazione chiamate: attenzione alla legalità', 'iMessage/RCS portano gli SMS tradizionali verso i rich media', 'La cronologia di WeChat richiede la sua funzione di backup integrata', 'Le app di posta gestiscono più account in modo unificato', 'Blocco delle molestie: riconoscimento di sistema + liste nere/bianche + filtri per parole chiave negli SMS', '“Rifiuta chiamanti sconosciuti” su iOS blocca il disturbo, ma attenzione alle chiamate mancate', 'Le segnalazioni errate si contestano tramite Dianhua Bang/360/Tencent e i canali dell’operatore'],
 'di-jiu-zhang': ['WPS Office funziona meglio in Cina, Microsoft 365 ha la migliore compatibilità', 'Note in tre fasi: appunto → da leggere → sistema di conoscenza', 'Scansione col telefono: Note/Mic Lens/Baimiao/CamScanner', 'Cloud a misura di bisogno: iCloud/OneDrive/Baidu/Aliyun Drive, ognuno con i suoi scenari'],
 'di-shi-zhang': ['Chi vede il codice di pagamento incassa: mai mandarlo a chiunque in screenshot', 'Check-up di sicurezza in 5 minuti: pagamento biometrico + lucchetto di sicurezza + verifica dei pagamenti senza password + gestione dispositivi', 'In metro e autobus meglio la tessera virtuale nel portafoglio del telefono: funziona anche offline', 'Certificato sanitario elettronico, domande pensione, dichiarazione dei redditi: tutto dal telefono', 'Quattro no contro le truffe: mai bonifici al “conto sicuro”, mai mandare il codice di pagamento, mai toccare link sconosciuti, mai dare il numero della carta'],
 'di-shi-yi-zhang': ['Quattro errori comuni: obiettivo sporco, esposizione non regolata, abuso del flash, zoom digitale a sproposito', 'La modalità notturna fonde più scatti: mano ferma per 2-4 secondi', 'Modalità pro: ISO basso significa immagine più pulita; l’otturatore comanda la luce', 'Flusso di post-produzione: raddrizza → correzione base → rifinitura locale → stilizzazione', 'Ricerca intelligente + pulizia periodica + album manuali = il tris di gestione delle foto'],
 'di-shi-yi-zhang-advanced': ['I tre elementi del video: risoluzione, frame rate, bitrate', 'H.265 comprime il 50% in più rispetto a H.264', 'ProRes è il codec professionale di Apple: file enormi', 'HDR10/10+/Dolby Vision: ognuno ha la sua nicchia'],
 'di-shi-er-zhang': ['NetEase Cloud Music è la migliore per playlist e community, QQ Music ha il catalogo più ampio, Apple Music è essenziale e lossless, Spotify ha consigli fortissimi', 'Xiaoyuzhou è la prima scelta per i podcast in cinese; usa bene velocità e pulizia automatica', 'Video locali: VLC (tutti i formati) o nPlayer (controllo a gesti)', 'I sottolineati di WeChat Read sono sociali + sincronizzazione Kindle; la modalità occhio stanco va sempre attiva', 'La modalità di gioco tiene prima di tutto fluidi i frame; contro il surriscaldamento aiuta la ventola a clip'],
 'di-shi-san-zhang': ['Strumenti di produttività: to-do + pomodoro + calendario', 'Salute e sport: Apple Health/Google Fit come centro dati', 'Browser: prima Edge, con Copilot per la produttività', 'Cerca il vero: fida dei domini ufficiali, evita suffissi economici come .xyz', 'Prima la pulizia di sistema; terze parti come Qingzhuo sono solo un complemento, mai la pulizia totale con un tocco', 'App antitruffa: Centro nazionale antifrode + assistenti di marca + blocco dell’operatore', 'Blocco integrato: su iOS “Rifiuta chiamanti sconosciuti”; su Android si attiva nell’app telefono di ogni marca', 'Tre livelli insieme: blocco di sistema + operatore + centro antifrode; attenzione alla whitelist per evitare falsi positivi', 'Allerte meteo: app meteo di sistema + canali ufficiali; agisci secondo i livelli giallo/arancione/rosso/blu', 'Allerte disastri naturali: meteo + protezione civile; con piogge forti e tifoni stai lontano da zone basse e cartelloni', 'L’allarme terremoto non è una previsione: da secondi a decine di secondi prima; su Android di solito nelle impostazioni di sicurezza', 'TickTick: elenchi + calendario + pomodoro, agenda a linguaggio naturale', 'Digitalizzare carta: fotocamera di sistema/Mic Lens/Baimiao/CamScanner; scatta nitido e poi OCR', 'Controllo remoto del PC: Sunflower/ToDesk; se uno sconosciuto ti chiede di installare il controllo remoto = truffa', 'AI per l’ufficio: Trae e altri; il lavoro pesante al computer, dal telefono lo segui a distanza', 'Trasferimento rapido in LAN: LocalSend/AirDrop/Feige; appunti: KDE Connect/strumenti di marca', 'Codici usa e getta 2FA: Aegis/Microsoft Authenticator, copie cartacee dei codici di backup'],
 'di-shi-si-zhang': ['Con un password manager basta ricordare una master password', 'Bitwarden è open source e gratuito, 1Password offre la miglior esperienza', 'La master password deve essere lunga e complessa, con 2FA attiva', 'Fai regolarmente un audit di sicurezza delle password', 'Architettura a conoscenza zero: nemmeno il fornitore vede le tue password; la cifratura avviene in locale', 'AES-256 + derivazione PBKDF2/Argon2 sono la pietra angolare della sicurezza di un archivio password', 'La lezione dell’incidente LastPass 2022: i più esposti sono gli utenti con master password deboli', 'La forza della password è “l’entropia”: lunghezza + casualità valgono più dei simboli complicati', 'HaveIBeenPwned verifica le fughe di dati, 1Password Watchtower monitora gli incidenti', 'Le Passkey si fondano su FIDO2/WebAuthn: immuni al phishing, nessuna password trasmessa', 'Sincronizzazione Passkey su più dispositivi: portachiavi iCloud/Google Password Manager la supportano già', 'Le chiavi hardware (YubiKey/Titan) resistono a phishing e SIM swap: ideali per chi è più esposto', 'Cassaforti condivise 1Password + accesso di emergenza Bitwarden rendono più sicura la condivisione in famiglia e in team'],
 'di-shi-wu-zhang': ['Batterie al litio: ricarica quando serve, odiano il calore, invecchiano', 'Sotto l’80% di salute della batteria l’autonomia cala in modo evidente', 'Protocolli di ricarica rapida: PD/QC/VOOC/SuperCharge non sono interscambiabili', 'La ricarica wireless Qi2 introduce l’allineamento magnetico', 'Il cuore del risparmio: abbassa la luminosità + chiudi il background + passa al 4G'],
 'di-shi-liu-zhang': ['L’account è la registrazione anagrafica della tua vita digitale: tiene insieme contatti, foto, acquisti e Trova il telefono', 'Tre doveri: attiva il 2FA, imposta la chiave di recupero, verifica che Trova il telefono sia attivo', 'I 5GB di iCloud non bastano: pulisci o passa a 50GB a 6 yuan al mese', 'La sincronizzazione è bidirezionale (cancelli qui, sparisce ovunque), il backup è un’istantanea a senso unico (cancelli qui, resta lì)', 'Utenti Android, controllate separatamente: backup cloud di marca, backup Google, backup WeChat'],
 'di-shi-qi-zhang': ['Collaborazione tra dispositivi: AirDrop di Apple/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/Collega a Windows', 'Trasmetti alla TV: iPhone usa “Duplica schermo”, Android il casting wireless; se fallisce controlla di essere sullo stesso Wi-Fi', 'Smartwatch = filtro notifiche + postazione salute + pagamento dal polso; per i tuoi genitori può salvare la giornata', 'Casa intelligente: scegli per ecosistema - Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'Sicurezza degli agganci: in pubblico attenzione alla privacy durante il casting, e scollega per tempo i vecchi dispositivi'],
 'di-shi-ba-zhang': ['Backup completo: locale sul PC (il più affidabile) + cloud (il più comodo), doppia protezione', 'La cronologia di WeChat è il caso più particolare: la porta via solo il backup interno di WeChat, gli strumenti di migrazione no', 'Regola 3-2-1: 3 copie, 2 tipi di supporto, 1 fuori casa', 'Cambio telefono: stessa marca, app ufficiale di migrazione; tra marche diverse prepara prima un passaggio di dati'],
 'di-shi-jiu-zhang': ['Lentezza e surriscaldamento in quattro passi: ripensa ai cambi recenti → controlla lo storage → controlla i consumi → controlla il segnale', 'Routine per le app che crashano: chiudi e riapri → aggiorna → controlla i permessi → svuota la cache → reinstalla', 'Non carica: prima pulisci la porta, poi incrocia cavi e caricabatterie per isolare il colpevole', 'Rete irraggiungibile: aria on/off → dimentica il Wi-Fi e riconnettiti → riavvia il router', 'Il riavvio universale risolve la maggior parte dei problemi strani; per le riparazioni scegli centri autorizzati, prima copia i dati ed esci dagli account'],
 'di-er-shi-zhang-jinjie': ['Modalità sviluppatore: sette tocchi sul numero di build per attivarla', 'Blocco BL: protezione del produttore; sbloccalo con cautela', 'Root: i rischi superano i benefici; per gli utenti normali non è consigliato', 'Magisk richiede ancora il BL sbloccato, ma può nascondere lo stato di root'],
 'di-er-shi-yi-zhang': ['VPN = tunnel cifrato; una VPN gratuita può essere lei a rubarti i dati', 'Difesa dal man-in-the-middle su Wi-Fi pubblici: punta su HTTPS, niente riconnessione automatica, cose delicate solo con la rete mobile', 'L’handshake HTTPS cifra in quattro scambi, ma anche i siti di phishing fanno HTTPS', 'DoH/DoT cifrano le query DNS: l’operatore non sbircia la tua navigazione', 'La modalità incognito è una gomma locale, non un mantello dell’invisibilità: ISP e siti ti vedono lo stesso', 'Checklist di sicurezza: disattiva il Wi-Fi automatico, passa a DNS cifrato, attiva il 2FA, verifica i permessi delle app, blocca il Juice Jacking'],
 'di-er-shi-er-zhang': ['Fotocamera AI: riconosce la scena → fonde più scatti → ottimizza in modo intelligente', 'Assistenti vocali: sentire → capire → eseguire, in tre passi', 'AI sul dispositivo: veloce, rispettosa della privacy, funziona offline', 'I grandi modelli AI coprono conversazione/scrittura/traduzione/immagini/studio', 'Usi tipici: traduzione dal vivo, gomma AI, ritocco AI, gestione documenti, ricerca immagini AI', 'Framework di prompt CRISPE: ruolo + richiesta + contesto + output + tono + esempi', 'Con l’AI bada alle allucinazioni e alle fughe di privacy', '“Ruolo-Contesto-Compito-Vincoli” è un approccio ai prompt più facile da iniziare', 'Qualità di un buon prompt: concreto, con contesto, con formato, con vincoli, verificabile'],
 'di-er-shi-san-zhang': ['Elementi dell’automazione: trigger + azione + logica condizionale facoltativa', 'Scorciatoie iOS: routine del buon mattino in un tocco, risparmio automatico, spese registrate con lo scan', 'Android: auto clicker (macro a schermo), Tasker (l’automazione più potente), MacroDroid (amico dei principianti)', 'Insidie: trigger di posizione imprecisi, iOS non esegue in automatico senza conferma manuale, Tasker richiede l’accessibilità', 'Mentalità di automazione: trasforma il lavoro ripetitivo in condizione → azione, e il telefono diventa il tuo assistente personale'],
 'di-er-shi-si-zhang': ['Il Bootloader è il guardiano dell’avvio; la verifica della firma impedisce manomissioni', 'Le politiche di sblocco BL variano per marca (Xiaomi lo consente/Huawei lo blocca)', 'Soluzioni di root: Magisk/KernelSU/SuperSU', 'Tre tipi di flashing: ROM ufficiale/Recovery di terze parti/ROM di terze parti'],
 'di-er-shi-wu-zhang': ['Vendere il vecchio telefono: prima backup → esci dagli account → cancellazione cifrata → riempi e ricancella', 'Eredità digitale: Contatto legacy iCloud/Account inattivo Google', 'Ritiro: prima i programmi ufficiali di trade-in; il vecchio telefono può fare da telecamera o navigatore'],
 'di-er-shi-liu-zhang': ['Tre standard dell’AI-phone: modello grande sul dispositivo, potenza NPU in TOPS, AI Agent tra le app', 'Strategie AI dei produttori: Apple/Google/Huawei/Xiaomi/OPPO/vivo, ognuno ha i suoi punti di forza', 'Satellitare: i brevi messaggi BeiDou arrivano nella fascia media, le chiamate Tiantong restano di gamma alta', 'Pieghevoli: hardware maturo, app adattate al 70% circa, hover/split-screen sono l’esperienza unica', 'Il 6G è in arrivo, il Wi-Fi 7 è arrivato, il Bluetooth LE Audio inizia a diffondersi', 'Le batterie con anodo al silicio-carbonio portano i 5000-6000mAh a standard di gamma alta'],
 'di-er-shi-qi-zhang': ['Prima attiva la modalità semplificata o ingrandisci caratteri/icone: un ambiente ben impostato risolve metà dei problemi', 'Tre regole ferree con i genitori: non fretta, analogie, scrivi tutto', 'Sei truffe comuni da ricordare e ripetere spesso; tre linee di difesa bloccano il 90% delle frodi', 'L’assistenza remota ti permette di aggiustare il telefono dei genitori anche da un’altra città', 'Modalità cura WeChat + dettatura vocale: le due funzioni più utili per i più grandi', 'SOS emergenze e rilevamento delle cadute: configurazioni che salvano la vita al momento giusto'],
 'di-er-shi-ba-zhang': ['Scelta del telefono in tre mosse: prima i bisogni → poi il budget → alla fine il modello', 'Cinque soli parametri chiave: processore, schermo, fotocamera, batteria e ricarica, promessa di aggiornamenti', '¥1500-3500 è la fascia con il miglior rapporto qualità-prezzo, la più consigliata', 'Il flagship dell’anno scorso conviene più del mid-range di quest’anno', 'Cinque trappole: mito delle multicamera, culto dei megapixel, versioni dell’operatore, feticismo per gli schermi curvi, espedienti AI', '618 e Double 11 sono le due finestre migliori dell’anno per comprare un telefono'],
 'di-er-shi-jiu-zhang': ['Prima guarda i dati del tempo di schermo: capire la situazione è il primo passo per cambiare', 'Limiti alle app di intrattenimento, orari per Non disturbare: riprenditi l’attenzione', 'La regola 20-20-20 è l’abitudine più semplice ed efficace per gli occhi', 'Guardando il telefono il collo regge 5-6 volte il peso della testa; alza il telefono e allenta il collo di tanto in tanto', 'L’ultima ora prima di dormire senza telefono; il caricabatterie fuori dalla portata del braccio', 'L’antidoto all’ansia informativa è “bloccare attivamente”, non “ottenere di più”'],
 'di-san-shi-zhang': ['Tre campi del casting wireless: AirPlay (Apple), Miracast (Android), DLNA (invio multimediale multipiattaforma)', 'Il casting via cavo è più stabile e a lag zero; in sala riunioni non manca l’adattatore HDMI', 'Samsung DeX/modalità desktop Huawei trasformano il telefono in un PC leggero da ufficio', 'Connessione in auto: quattro soluzioni - CarPlay/Android Auto/HiCar/CarLife', 'Regole del casting in sala riunioni: prova prima, prepara un piano B, nascondi l’anteprima delle notifiche'],
 'di-san-shi-yi-zhang': ['Prima di girare, chiarisci: chi è il pubblico, che valore offri, su quale piattaforma pubblichi', 'Cinque cose prima di girare: 1080P/30fps, pulisci l’obiettivo, blocca fuoco ed esposizione, scegli l’orientamento, attiva la griglia', 'Cinque mosse di camera: carrello, controcarrello, panoramica, spostamento, inseguimento - la stabilità prima di tutto', 'Montaggio con CapCut: taglio → transizioni → sottotitoli → BGM → esportazione, in sei passi', 'I primi 3 secondi decidono tutto; un video racconta una cosa sola; la costanza vale più del talento'],
 'di-san-shi-er-zhang': ['Telefono perduto, i primi 30 minuti: prendi in prestito un telefono e chiamati → blocco remoto → blocco SIM → congelamento pagamenti → avvisa parenti e amici → denuncia', '72 ore dopo la truffa: blocca i bonifici → conserva le prove → chiama il 96110 → denuncia → contatta la banca → cambia le password', 'Telefono infettato: modalità provvisoria → disinstalla le app sospette → scansione di sicurezza → ripristino di fabbrica (ultima spiaggia)', 'Account rubato: cambia password → disconnetti i dispositivi → controlla gli accessi → attiva il 2FA → controlla i collegamenti → controlla i pagamenti', 'Il 99,9% delle richieste di riscatto sono truffe: non rispondere, non pagare, screenshot e blocca', 'Truffe con volto/voce clonato: cerca difetti in occhi, bocca, contorni e luci; chiedi di girare la testa, coprirsi il viso, fai domande personali, richiama un numero già noto', 'Effetto SIM swap: se il telefono mostra improvvisamente “Nessun servizio” è allarme; imposta un PIN della SIM, attiva la verifica a due passaggi dell’operatore, sposta gli account chiave su app autenticatore', 'Cinque abitudini quotidiane: schermata di blocco + 2FA, Trova il telefono, PIN della SIM, niente app sconosciute, backup regolari', 'Terremoto/meteo estremo: prima mettiti al sicuro lì vicino, poi evacua; un SMS consuma meno di una lunga chiamata', 'Senza segnale, prima il SOS satellitare (se il modello lo supporta); avvisi e impostazioni nel Capitolo 13'],
 'di-san-shi-san-zhang': ['Vision Pro e occhiali AR sono nuovi ingressi informatici oltre il telefono, ma a breve non lo sostituiranno', 'Le interfacce cervello-computer sono a 10-20 anni dai consumatori; l’etica matura prima della tecnologia', 'Il telefono evolve verso l’“invisibilità”: dal centro dispositivo al centro identità', 'Etica dell’AI, sovranità dei dati e divario digitale sono i temi centrali del prossimo decennio', 'Restare connessi restando indipendenti: la filosofia immutabile della vita digitale'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // Salta i capitoli che hanno già un riepilogo inline, per non duplicare
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== Pulsante copia (aggiunto agli elementi kbd) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'Copia');
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

 // ===== Contenuti lunghi richiudibili (livello h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // Richiudi solo le sezioni h4 lunghe
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // Aggiunge l’intestazione richiudibile
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

 // ===== Cruscotto di apprendimento: progresso lettura + autocontrollo salute del telefono =====
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
 // Progresso di lettura
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // Conteggio segnalibri
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // Ultimo capitolo
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // Autocontrollo salute
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'Punteggio pieno! La sicurezza del tuo telefono è ottima';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'Bene! ' + (totalChecks - checked) + ' voci ancora da sistemare';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'Sufficiente: dai priorità alle voci di sicurezza ancora da spuntare';
 else healthMsgEl.innerHTML = 'Il tuo telefono ha vulnerabilità: sistemale al più presto';
 }
 }

 // Ripristina gli stati delle spunte
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // Aggiorna ogni 3 secondi (coglie le spunte dei capitoli)
 setInterval(updateDashboard, 3000);

 // ===== Lettura vocale (TTS) =====
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
 // Clona e rimuove gli elementi da non leggere ad alta voce
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // Rimuove i corpi richiusi ma ne conserva il testo
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('Spiacenti, il tuo browser non supporta la lettura vocale. Prova Chrome o Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'Capitolo senza titolo';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'it-IT';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // Prova a usare una voce italiana più naturale
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('it'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // Legge automaticamente il capitolo successivo
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
 // Trova il capitolo attualmente visibile
 if (ttsSectionIndex < 0) {
 // Parte dall’inizio o dal capitolo più vicino alla posizione di scorrimento
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
 ttsLabel.textContent = 'Non avviato';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // Collegamento degli eventi
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
 // Ricrea e riproduce la sezione corrente
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

 // Scorciatoia: il tasto R attiva/disattiva la lettura vocale
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

 // ===== Inizializzazione =====
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

