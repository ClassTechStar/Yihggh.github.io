
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

 // ===== Thème =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? 'Passer en mode clair' : 'Passer en mode sombre';
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

 // ===== Défilement : progression + ombre + retour en haut + progression du sommaire + anneau de progression =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} chapitres`;

 // Paramètres de l’anneau de progression
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

 // Mise à jour de l’anneau de progression
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

 // Jusqu’à quel chapitre on a lu
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} chapitres`;
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

 // ===== Mémoire de la position de lecture =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // Trop tôt pour enregistrer
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // Trouve le nom du chapitre en cours
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

 // Restaure la position au chargement de la page
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
 restoreToastText.textContent = `Dernière lecture : ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // Masquage automatique après 10 secondes
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

 // ===== Animation d’entrée au défilement =====
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
 // Le contenu du premier écran est visible directement
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== Ouverture/fermeture de la barre latérale =====
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

 // Outils rapides : ouvrir le sommaire
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== Navigation globale par ancres : compense le décalage de la barre fixe =====
 // Il faut utiliser scrollIntoView plutôt que calculer les coordonnées à la main : .content-section a
 // content-visibility:auto + contain-intrinsic-size(0 800px) : les chapitres hors écran
 // occupent des espaces réservés de 800px, getBoundingClientRect renvoie les coordonnées du prototype et un scrollTo direct
 // atterrirait au mauvais endroit (plus le chapitre est loin, plus l’écart s’accumule). scrollIntoView laisse au navigateur
 // affiche la cible à la demande et la positionne, et html{scroll-padding-top:5rem} compense la barre
 // fixe.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // Étape 1 : le mode instant force d’abord le rendu du chapitre visé et le positionne, pour éviter que content-visibility
 // dérive pendant le défilement fluide causée par le rendu différé.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // Étape 2 : une fois la cible rendue et les coordonnées stables, on relance un défilement fluide pour un confort optimal.
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

 // ===== Repliage du sommaire =====
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

 // ===== Filtre du sommaire =====
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

 // ===== Surlignage dans le sommaire =====
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

 // ===== Système de favoris =====
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

 // Ajoute un bouton favori à chaque chapitre
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'Aux favoris' : 'Favori') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'Retirer des favoris' : 'Ajouter le chapitre aux favoris');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'Aux favoris' : 'Favori';
 btn.setAttribute('aria-label', added ? 'Retirer des favoris' : 'Ajouter le chapitre aux favoris');
 // Met à jour les marques de la barre latérale
 updateTocBookmark(id, added);
 });
 // Insère après le h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // Initialise les marques de favoris dans la barre latérale
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== Coches des chapitres lus =====
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
 // Trouver la ligne de meta ou l’élément avant le h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'Lu' : 'Lu') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'Retirer lu' : 'Marquer comme lu');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'Lu' : 'Lu';
 check.setAttribute('aria-label', done ? 'Retirer lu' : 'Marquer comme lu');
 // Met à jour la barre latérale
 updateTocCompleted(id, done);
 // Met à jour la progression de lecture
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
 // Met aussi à jour le compteur de lectures
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} chapitres`;
 }
 }

 // ===== Recherche (enrichie : navigation clavier + compteur de résultats) =====
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
 renderSearchPlaceholder('Saisissez des mots-clés pour chercher');
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
 renderSearchPlaceholder('Aucun résultat trouvé');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">${results.length} résultats trouvés</div>`;
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
 renderSearchPlaceholder('Saisissez des mots-clés pour chercher');
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

 // Navigation clavier de la recherche
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

 // ===== Taille de police =====
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

 // ===== Fermer la barre latérale au balayage =====
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

 // ===== Navigation entre chapitres =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'Chapitre précédent'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'Chapitre suivant'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== Impression =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== Raccourcis clavier globaux =====
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

 // Ferme les fenêtres au clic sur le voile
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
 // L’impression est déjà gérée par le navigateur
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

 // ===== Suivi des jours de lecture consécutifs =====
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

 // Affiche l’avis de jours consécutifs
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 Jour ' + streak + ' de lecture d’affilée. Continuez ainsi !';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage peut être indisponible */ }
 }
 updateStreak();

 // ===== Sauvegarde/restauration =====
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
 // Recueille les états de l’autodiagnostic
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // Recueille les états des chapitres lus
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // Recueille les favoris
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // Recueille les notes
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'Sauvegarde-lecture-PhoneClass_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('Échec de l’export de la sauvegarde : ' + e.message);
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
 // Restaure les états de l’autodiagnostic
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // Restaure les états des chapitres lus
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
 // Restaure les favoris
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('Restauration réussie ! La page va se recharger pour appliquer toutes les données.');
 location.reload();
 } catch(err) {
 alert('Échec de la restauration : format de fichier invalide. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('Effacer toutes les données de lecture ? C’est irréversible ! Exportez d’abord une sauvegarde.')) return;
 if (!confirm('Confirmez encore : toute la progression de lecture, les favoris et les notes seront supprimés. Continuer ?')) return;
 localStorage.clear();
 alert('Toutes les données effacées. La page va se recharger.');
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

 // ===== Système de notation des chapitres =====
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
 // Insère après le h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== Optimisation anti-rebond du scroll =====
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

 // ===== Suit le mode sombre du système =====
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

 // ===== Ajoute automatiquement fil d’Ariane et étiquettes de difficulté aux titres =====
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
 
 ${level === 'beginner' ? 'Débutant' : level === 'intermediate' ? 'Intermédiaire' : 'Avancé'}
 </span>
 <span class="reading-time">
 ~${minutes} min de lecture
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== Ajoute aux chapitres un bloc « À retenir » =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">À retenir</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['Les pliables sont matures mais pas dominants : un « agrément », pas une « bouée de sauvetage »', 'Pli transversal = téléphone + tablette ; pli longitudinal = poche + coup d’œil sur l’écran externe', 'Idéal pour : lecture intensive/business/création en hover/femmes attachées à la portabilité', 'Six points à vérifier à l’achat : type de charnière, écran interne UTG, pli, taille de l’écran externe, poids et épaisseur, prix de la réparation hors garantie', 'Astuces exclusives : multitâche en écran partag, hover à 90 degrés, coup d’œil sur l’écran externe, mode PC', 'Soins essentiels : pas d’ouverture/fermeture par grand froid, à l’abri des poussières, jamais de film ordinaire sur l’écran interne, charnière protégée de la poussière', 'Attentes : le pli est définitif, c’est plus lourd et plus épais, l’autonomie est moyenne, la valeur de revente est faible, la réparation coûteuse', 'Philosophie d’achat : on l’achète pour sa forme unique, pas parce qu’il serait « plus avancé »'],
 'di-ling-zhang': ['Comprendre la position du livre : une vulgarisation tech claire et les mains dans le cambouis', 'Maîtrisez le système de symboles : ce que veulent dire [boutons], >, gras et italique', 'Pourquoi la capacité du téléphone « fond » : les principales raisons', 'Prenez l’habitude de noter les spécifications de votre propre téléphone', 'Téléphone = coffre-fort d’actifs numériques ; prévenir d’abord est l’idée centrale', 'Les données valent souvent plus cher que le matériel lui-même'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + modem et autres modules réunis sur une seule puce', 'Les cœurs rapides et lents du CPU travaillent ensemble : performance et autonomie en équilibre', 'Écran : OLED/LCD, taux de rafraîchissement, luminosité automatique', 'Le cœur de l’image : le capteur compte plus que le nombre de mégapixels', 'Évolution des ports : Micro USB → Lightning → USB-C unifié', 'La 5G-A apporte la nouvelle capacité d’« union communication-perception »'],
 'di-yi-zhang-harmony': ['HarmonyOS = un système d’exploitation distribué, pensé multi-appareils dès la conception', 'HarmonyOS 4.3 est compatible AOSP et peut exécuter des applis Android', 'HarmonyOS NEXT est pleinement autonome et ne prend plus en charge les applis Android', 'Avant de mettre à niveau, assurez-vous que vos applis habituelles ont des versions natives'],
 'di-er-zhang': ['Stockage à trois étages : appareil / carte SD / cloud', 'Ce que signifient les dossiers Android courants (DCIM, Download, etc.)', 'Sauvegarde des données = copie cloud + copie locale, double protection', 'Supprimer n’est pas détruire ; seul « l’écrasement » efface vraiment', 'Aide-mémoire des formats de fichiers courants (image/audio/vidéo/document)', 'Nommer « date + événement » est la convention de base', 'Le nettoyage automatique à 72 heures règle l’engorgement du cache des applis sociales', 'Double protection des photos : masquage + retrait des EXIF'],
 'di-san-zhang': ['4G/5G ont chacune leur rôle ; la 5G-A est la version renforcée', 'Différences techniques clés du Wi-Fi 6/6E/7', 'Le Wi-Fi public exige de la vigilance : n’y saisissez pas d’informations sensibles', 'Le Bluetooth 5.x progresse sans cesse, le LE Audio commence à se généraliser', 'Le NFC travaille à moins de 10cm : la proximité physique est la garantie en soi'],
 'di-si-zhang': ['Installez les applis d’abord depuis les boutiques officielles', 'Un paquet APK = certificat + ressources + configuration + binaire', 'Méfiez-vous des applis « nettoyeurs-accélérateurs » ; qu’une appli résidente en arrière-plan est raisonnable', 'La vérification de signature des applis empêche la falsification : protection au niveau du système', 'Mode pur = installations uniquement depuis la boutique officielle : le premier mur contre les maliciels', '« Parasites numériques » désigne les versions piratées avec des chevaux de Troie à l’intérieur', 'Mécanisme de revue des boutiques : analyse antivirale + revue des permissions + vérification des développeurs'],
 'di-wu-zhang': ['Écran : résolution, taux de rafraîchissement, luminosité automatique', 'Son : volumes sonnerie/média/notifications gérés séparément', 'Stockage : nettoyez régulièrement cache et fichiers inutiles', 'Biométrie : empreinte contre visage ; le 3D l’emporte sur le 2D en sécurité', 'Lecteurs d’écran : VoiceOver sur iOS / TalkBack sur Android sont les yeux des utilisateurs malvoyants', 'Agrandissement : contraste élevé, texte en gras, filtres de couleur : le trio', 'Description d’images par l’IA : l’IA lit pour vous images, menus et captchas', 'Les sous-titres en direct : une bouée pour les malentendants et les environnements bruyants', 'RTT/TTY : ceux qui ont perdu la voix ou l’ouïe peuvent téléphoner'],
 'di-liu-zhang': ['Mot de passe de verrouillage + authentification à deux facteurs : la défense de base', 'Permissions des applis : activer selon le besoin, principe du moindre privilège', 'Aucun paiement ni connexion sur un Wi-Fi public', 'À l’ère de l’IA, voir n’est pas croire : visages et voix clonés, fausse autorité, faux investissements sont les arnaques les plus courantes', 'Plan de sortie : vérification par un geste + mot de contrôle + seconde confirmation', 'Anonymisez avant de partager : coupez la localisation et les données d’appareil dans les EXIF', 'Appareils IoT : changez le mot de passe par défaut', 'Face à l’arnaque, retenez : ne pas croire à la légère, ne pas divulguer, ne pas virer'],
 'di-qi-zhang-jichu': ['Satellite : la « corde de secours » en situation d’urgence', 'Communiquer sans réseau : radio longue portée même sans couverture', 'Détection d’accident : la fusion de capteurs reconnaît les collisions graves', 'StarFlash : liaison sans fil à faible latence au potentiel énorme'],
 'di-ba-zhang': ['Enregistrement des appels : attention à la légalité', 'iMessage/RCS font passer le SMS traditionnel aux messages enrichis', 'L’historique WeChat exige la fonction de sauvegarde propre à WeChat', 'Les applis de messagerie gèrent plusieurs comptes de façon unifiée', 'Filtrage du harcèlement : reconnaissance système + listes noire/blanche + filtres par mots-clés des SMS', '« Ignorer les appelants inconnus » sur iOS bloque le harcèlement, mais attention aux appels manqués', 'Les signalements erronés se contestent via Dianhua Bang/360/Tencent et les canaux de l’opérateur'],
 'di-jiu-zhang': ['WPS Office est le meilleur en Chine, Microsoft 365 offre la meilleure compatibilité', 'Notes en trois phases : griffonné → à lire plus tard → système de connaissances', 'Scanner au téléphone : Notes/Mic Lens/Baimiao/CamScanner', 'Cloud au fil des besoins : iCloud/OneDrive/Baidu/Aliyun Drive, chacun ses scénarios'],
 'di-shi-zhang': ['Qui voit le code de paiement encaisse : ne lui envoyez jamais de capture d’écran', 'Bilan de sécurité en 5 minutes : paiement biométrique + verrou de sécurité + vérification des paiements sans mot de passe + gestion des appareils', 'En métro et en bus, préférez la carte de transport virtuelle du portefeuille du téléphone : elle marche même hors ligne', 'Attestation d’assurance maladie, demandes de retraite, déclaration d’impôts : tout se règle au téléphone', 'Quatre « non » face aux arnaques : jamais de virement vers un « compte sûr », jamais d’envoi du code de paiement, jamais de clic sur des liens inconnus, jamais de numéro de carte communiqué'],
 'di-shi-yi-zhang': ['Quatre erreurs fréquentes : objectif sale, exposition non réglée, abus du flash, zoom numérique mal employé', 'Le mode nuit fusionne plusieurs images ; main stable 2-4 secondes', 'Mode pro : ISO bas, image propre ; l’obturateur commande la lumière', 'Flux de post-traitement : redresser → ajustements de base → retouches locales → styliser', 'Recherche intelligente + nettoyage régulier + albums manuels = le trio de la gestion photo'],
 'di-shi-yi-zhang-advanced': ['Les trois piliers de la vidéo : résolution, cadence, débit', 'H.265 compresse 50 % de mieux que H.264', 'ProRes est le codec professionnel d’Apple : fichiers énormes', 'HDR10/10+/Dolby Vision : chacun sa niche'],
 'di-shi-er-zhang': ['NetEase Cloud Music est la meilleure pour les playlists et la communauté, QQ Music a le catalogue le plus vaste, Apple Music est épurée et sans perte, Spotify recommande avec brio', 'Xiaoyuzhou est le premier choix de podcasts en chinois ; exploitez bien vitesse et nettoyage automatique', 'Vidéo locale : VLC (tous formats) ou nPlayer (contrôle par gestes)', 'Les surlignages de WeChat Read sont sociaux + synchronisation Kindle ; le mode confort oculaire toujours activé', 'Le mode jeu privilégie d’abord la fluidité des images ; contre la surchauffe, le ventilateur à pince aide'],
 'di-shi-san-zhang': ['Outils de productivité : tâches + pomodoro + calendrier', 'Santé et sport : Apple Health/Google Fit en tour de contrôle des données', 'Navigateur : Edge d’abord, avec Copilot pour gagner en efficacité', 'Cherchez le vrai : fiez-vous aux domaines officiels, évitez les extensions bon marché comme .xyz', 'Préférez le nettoyage natif ; les tiers comme Qingzhuo ne sont qu’un appoint, jamais le grand nettoyage en un geste', 'Applis anti-harcèlement : Centre national antifraude + gardiens de marque + blocage opérateur', 'Blocage intégré : sur iOS « Ignorer les appelants inconnus » ; sur Android, à activer dans l’appli téléphone de chaque marque', 'Trois niveaux cumulés : blocage système + opérateur + centre antifraude ; attention à la liste blanche pour ne pas bloquer les vôtres', 'Alertes météo : appli météo du système + canaux officiels ; réagissez selon les niveaux bleu/jaune/orange/rouge', 'Alertes catastrophes naturelles : météo + protection civile ; en pluie torrentielle ou typhon, fuyez les zones basses et les panneaux publicitaires', 'L’alerte séisme n’est pas une prédiction : de quelques secondes à quelques dizaines de secondes ; sur Android, souvent dans les paramètres de sécurité', 'TickTick : listes + calendrier + pomodoro, agenda en langage naturel', 'Numériser le papier : appareil photo du système/Mic Lens/Baimiao/CamScanner ; visez net, puis OCR', 'Contrôle à distance du PC : Sunflower/ToDesk ; qu’un inconnu vous demande d’installer une prise en main à distance = arnaque', 'IA au bureau : Trae et autres ; le lourd sur l’ordinateur, du téléphone vous suivez à distance', 'Transfert rapide en réseau local : LocalSend/AirDrop/Feige ; presse-papiers : KDE Connect/outils de marque', 'Codes à usage unique 2FA : Aegis/Microsoft Authenticator, copies papier des codes de secours'],
 'di-shi-si-zhang': ['Avec un gestionnaire de mots de passe, un seul mot de passe maître à retenir', 'Bitwarden est open source et gratuit, 1Password offre la meilleure expérience', 'Le mot de passe maître doit être long et complexe, avec le 2FA activé', 'Auditez régulièrement la sécurité de vos mots de passe', 'Architecture à connaissance zéro : même le fournisseur ne voit pas vos mots de passe ; le chiffrement se fait en local', 'AES-256 + dérivation PBKDF2/Argon2 sont la pierre angulaire de la sécurité d’un coffre à mots de passe', 'La leçon de l’incident LastPass 2022 : les plus exposés sont les utilisateurs à mot de passe maître faible', 'La force du mot de passe est « l’entropie » : longueur + caractère aléatoire valent mieux que les symboles savants', 'HaveIBeenPwned vérifie les fuites, 1Password Watchtower surveille les incidents', 'Les Passkey reposent sur FIDO2/WebAuthn : immunisées contre le phishing, aucun mot de passe transmis', 'Synchronisation des Passkey entre appareils : trousseau iCloud/Google Password Manager la prennent déjà en charge', 'Les clés matérielles (YubiKey/Titan) résistent au phishing et au détournement de SIM : idéales pour les profils très exposés', 'Coffres partagés 1Password + accès d’urgence Bitwarden rendent le partage en famille et en équipe plus sûr'],
 'di-shi-wu-zhang': ['Batteries au lithium : rechargez au fil de l’usage, elles redoutent la chaleur et vieillissent', 'Sous 80 % de santé de batterie, l’autonomie chute nettement', 'Protocoles de charge rapide : PD/QC/VOOC/SuperCharge ne sont pas interchangeables', 'La charge sans fil Qi2 introduit l’alignement magnétique', 'Le cœur de l’économie : baisser la luminosité + fermer l’arrière-plan + passer en 4G'],
 'di-shi-liu-zhang': ['Le compte est l’état civil de votre vie numérique : il relie contacts, photos, achats et Localiser mon téléphone', 'Trois indispensables : activer le 2FA, définir une clé de récupération, vérifier que Localiser est activé', 'Les 5 Go d’iCloud ne suffisent pas : nettoyez, ou passez à 50 Go pour environ ¥1/mois', 'La synchronisation est bidirectionnelle (supprimé ici, parti partout), la sauvegarde un instantané à sens unique (supprimé ici, conservé là)', 'Utilisateurs Android, vérifiez séparément : sauvegarde cloud de marque, sauvegarde Google, sauvegarde WeChat'],
 'di-shi-qi-zhang': ['Collaboration entre appareils : AirDrop d’Apple/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/Lier à Windows', 'Diffuser vers la TV : l’iPhone passe par Recopie de l’écran, Android par la diffusion sans fil ; en cas d’échec, vérifiez que vous êtes sur le même Wi-Fi', 'Montre connectée = filtre de notifications + poste de santé + paiement au poignet ; pour vos parents, cela peut sauver la mise', 'Maison intelligente : choisissez selon l’écosystème - Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'Sécurité des liens : en public, gare à la vie privée pendant la diffusion, et dissociez à temps les anciens appareils'],
 'di-shi-ba-zhang': ['Sauvegarde complète : en local sur ordinateur (la plus fiable) + cloud (la plus tranquille), double protection', 'L’historique WeChat est le cas le plus particulier : seul le système de sauvegarde intégré de WeChat l’emporte, les outils de migration échouent', 'Règle 3-2-1 : 3 copies, 2 types de support, 1 hors du domicile', 'Changement de téléphone : même marque, applis officielle de migration ; entre marques, préparez d’abord un relais de données'],
 'di-shi-jiu-zhang': ['Lenteurs et chauffe en quatre étapes : rappelez-vous ce qui a changé → vérifiez le stockage → vérifiez la consommation → vérifiez le signal', 'Routine pour applis qui plantent : fermer et rouvrir → mettre à jour → vérifier les permissions → vider le cache → réinstaller', 'Ne charge plus : nettoyez d’abord le port, puis croisez câbles et chargeurs pour isoler le coupable', 'Pas de réseau : mode avion off/on → oublier le Wi-Fi et se reconnecter → redémarrer la box', 'Le redémarrage universel résout la plupart des bizarreries ; pour la réparation, choisissez un service agréé, et avant : sauvegarde + déconnexion des comptes'],
 'di-er-shi-zhang-jinjie': ['Mode développeur : sept pressions sur le numéro de build pour l’activer', 'Verrou BL : protection du fabricant ; déverrouillez avec prudence', 'Root : le risque l’emporte sur le bénéfice ; déconseillé aux utilisateurs ordinaires', 'Magisk exige toujours le BL déverrouillé, mais sait masquer l’état de root'],
 'di-er-shi-yi-zhang': ['VPN = tunnel chiffré ; un VPN gratuit peut être lui-même à voler vos données', 'Défense contre l’homme du milieu en Wi-Fi public : faites confiance à HTTPS, coupez la connexion automatique, le sensible uniquement en données mobiles', 'La poignée de main HTTPS chiffre en quatre échanges, mais les sites de phishing font aussi du HTTPS', 'DoH/DoT chiffrent les requêtes DNS : votre opérateur n’espionne plus votre navigation', 'Le mode incognito est une gomme locale, pas une cape d’invisibilité : votre fournisseur d’accès et les sites vous voient toujours', 'Liste de sécurité : coupez la connexion Wi-Fi automatique, passez à un DNS chiffré, activez le 2FA, vérifiez les permissions des applis, bloquez le Juice Jacking'],
 'di-er-shi-er-zhang': ['Caméra IA : reconnaître la scène → fusionner les images → optimiser intelligemment', 'Assistants vocaux : entendre → comprendre → exécuter, en trois temps', 'IA sur l’appareil : rapide, respectueuse de la vie privée, fonctionne hors ligne', 'Les grands modèles d’IA couvrent conversation/écriture/traduction/image/étude', 'Usages typiques : traduction en direct, gomme IA, retouche IA, gestion de documents, recherche d’images par IA', 'Framework de prompts CRISPE : rôle + requête + contexte + sortie + ton + exemples', 'Avec l’IA, gare aux hallucinations et aux fuites de vie privée', '« Rôle-Contexte-Tâche-Contraintes » est une approche des prompts plus facile pour débuter', 'Qualités d’un bon prompt : précis, avec du contexte, avec un format, avec des limites, vérifiable'],
 'di-er-shi-san-zhang': ['Éléments de l’automatisation : déclencheur + action + logique de décision facultative', 'Raccourcis iOS : routine du matin en un geste, économiseur automatique, dépenses enregistrées au scan', 'Android : cliqueurs automatiques (macros d’écran), Tasker (l’automatisation la plus puissante), MacroDroid (convivial pour débutants)', 'Pièges : déclencheurs de localisation imprécis, iOS exige une confirmation manuelle pour s’exécuter, Tasker demande l’accessibilité', 'État d’esprit automatisation : transformer la corvée répétitive en condition → action, et le téléphone devient votre assistant personnel'],
 'di-er-shi-si-zhang': ['Le Bootloader est le gardien du démarrage ; la vérification de signature empêche la falsification', 'Les politiques de déverrouillage BL varient selon les marques (Xiaomi l’autorise/Huawei le verrouille)', 'Options de root : Magisk/KernelSU/SuperSU', 'Trois types de flashage : ROM officielle/Recovery tiers/ROM tierce'],
 'di-er-shi-wu-zhang': ['Vendre son ancien téléphone : d’abord sauvegarde → déconnexion → effacement chiffré → remplir et effacer à nouveau', 'Héritage numérique : Contact hérité iCloud/Compte inactif Google', 'Recyclage : d’abord les reprises officielles ; le vieux téléphone peut encore servir de caméra ou de GPS'],
 'di-er-shi-liu-zhang': ['Trois critères du téléphone à IA : grand modèle embarqué, puissance NPU en TOPS, AI Agent au-dessus des applis', 'Stratégies IA des fabricants : Apple/Google/Huawei/Xiaomi/OPPO/vivo, chacun ses forces', 'Satellite : les messages courts BeiDou descendent dans le milieu de gamme, les appels Tiantong restent l’apanage des fleurons', 'Pliables : matériel mature, applis adaptées à environ 70 %, hover/écran partag sont l’expérience unique', 'La 6G est encore en route, le Wi-Fi 7 est là, le Bluetooth LE Audio commence à se répandre', 'Les batteries à anode silicium-carbone rendent les 5000-6000mAh la norme des fleurons'],
 'di-er-shi-qi-zhang': ['Activez d’abord le mode facile ou agrandissez polices/icônes : un environnement bien réglé dissout la moitié des problèmes', 'Trois règles d’or avec les aînés : ne pas presser, user d’analogies, écrire', 'Six arnaques courantes à répéter sans relâche ; trois lignes de défense stoppent 90 % des fraudes', 'L’assistance à distance permet de dépanner le téléphone de vos parents même depuis une autre ville', 'Mode bienveillance de WeChat + saisie vocale : les deux fonctions les plus utiles pour les aînés', 'Appel SOS et détection de chute : des réglages qui sauvent la vie au moment décisif'],
 'di-er-shi-ba-zhang': ['Choisir son téléphone en trois temps : d’abord les besoins → puis le budget → enfin le modèle', 'Cinq paramètres clés seulement : processeur, écran, caméra, batterie et charge, promesse de mises à jour', '¥1500-3500 est la fourchette au meilleur rapport qualité-prix, la plus recommandée', 'Le fleuron de l’an dernier est plus rentable que le milieu de gamme de cette année', 'Cinq pièges : mythe des multi-caméras, culte des mégapixels, versions opérateur, culte de l’écran incurvé, artifices IA', 'Le 618 et le Double 11 sont les deux meilleures fenêtres de l’année pour acheter un téléphone'],
 'di-er-shi-jiu-zhang': ['Regardez d’abord les données de temps d’écran : voir clair est le premier pas pour changer', 'Des limites pour les applis de divertissement, des horaires pour Ne pas déranger : reprenez le contrôle de votre attention', 'La règle 20-20-20 est l’habitude la plus simple et la plus efficace pour les yeux', 'Tête penchée vers le téléphone, la nuque porte 5 à 6 fois le poids de la tête ; levez le téléphone et étirez la nuque régulièrement', 'L’heure avant le coucher sans téléphone ; le chargeur hors de portée du bras', 'L’antidote à l’anxiété informationnelle est le « blocage actif », pas « en recevoir plus »'],
 'di-san-shi-zhang': ['Trois camps de la diffusion sans fil : AirPlay (Apple), Miracast (Android), DLNA (envoi multimédia multiplateforme)', 'La diffusion par câble est plus stable et sans latence ; en salle de réunion, l’adaptateur HDMI est incontournable', 'Samsung DeX/mode bureau de Huawei transforment le téléphone en PC de bureau léger', 'Connexion en voiture : quatre solutions - CarPlay/Android Auto/HiCar/CarLife', 'Règles de diffusion en salle de réunion : tester à l’avance, prévoir un plan B, masquer l’aperçu des notifications'],
 'di-san-shi-yi-zhang': ['Avant de tourner, tranchez : qui est le public, quelle valeur vous apportez, sur quelle plateforme vous publiez', 'Cinq choses avant de filmer : 1080P/30fps, nettoyer l’objectif, verrouiller mise au point et exposition, choisir l’orientation, activer la grille', 'Cinq mouvements de caméra : avancer, reculer, panoramique, déplacement, suivi - la stabilité d’abord', 'Montage avec CapCut : couper → transitions → sous-titres → BGM → export, en six étapes', 'Les 3 premières secondes décident de tout ; une vidéo, un seul message ; la constance vaut mieux que le talent'],
 'di-san-shi-er-zhang': ['Téléphone perdu, les 30 minutes d’or : empruntez un téléphone et appelez-vous → verrouillage à distance → blocage de la SIM → gel des paiements → prévenir proches → dépôt de plainte', '72 heures après l’arnaque : stoppez les virements → conservez les preuves → appelez le 96110 → plainte → contactez la banque → changez les mots de passe', 'Téléphone infecté : mode sans échec → désinstaller les applis suspectes → analyse de sécurité → réinitialisation d’usine (dernier recours)', 'Compte volé : changez le mot de passe → déconnectez les appareils → vérifiez l’historique de connexion → activez le 2FA → vérifiez les liens → vérifiez les paiements', '99,9 % des demandes de rançon sont des arnaques : ne répondez pas, ne payez pas, capturez et bloquez', 'Arnaques au visage/à la voix clonés : guettez les défauts de clignement, de bouche, de contours et de lumière ; demandez de tourner la tête, de couvrir le visage, posez des questions personnelles, rappelez un numéro déjà connu', 'Détournement de SIM : si le téléphone affiche soudain « Pas de réseau », c’est une alerte ; définis un code PIN de la SIM, active la double vérification de l’opérateur, bascule les comptes clés sur des applis d’authentification', 'Cinq habitudes quotidiennes : verrouillage d’écran + 2FA, Localiser mon téléphone, code PIN de la SIM, pas d’applis inconnues, sauvegardes régulières', 'Séisme/intempéries : se mettre à l’abri sur place d’abord, évacuer ensuite ; un SMS économise plus de batterie qu’un long appel', 'Sans signal, privilégiez le SOS satellite (si le modèle le permet) ; alertes et réglages au Chapitre 13'],
 'di-san-shi-san-zhang': ['Vision Pro et les lunettes AR sont de nouvelles portes d’entrée informatiques au-delà du téléphone, mais ne le remplaceront pas vite', 'Les interfaces cerveau-machine sont encore à 10-20 ans du grand public ; l’éthique mûrit avant la technologie', 'Le téléphone évolue vers l’« invisibilité » : du centre-appareil au centre-identité', 'Éthique de l’IA, souveraineté des données et fracture numérique sont les thèmes majeurs de la décennie', 'Rester connecté tout en restant indépendant : la philosophie immuable de la vie numérique'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // Ignorer les chapitres qui ont déjà un résumé en ligne, pour éviter les doublons
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== Bouton copier (ajouté aux éléments kbd) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'Copier');
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

 // ===== Contenu long repliable (niveau h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // Ne replier que les longues sections h4
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // Ajoute l’en-tête repliable
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

 // ===== Tableau de bord d’apprentissage : progression de lecture + autodiagnostic du téléphone =====
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
 // Progression de lecture
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // Nombre de favoris
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // Dernier chapitre
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // Autodiagnostic de santé
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'Note parfaite ! La sécurité de ton téléphone est en excellent état';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'Bien ! ' + (totalChecks - checked) + ' points encore à peaufiner';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'Passable : priorisez les points de sécurité non cochés';
 else healthMsgEl.innerHTML = 'Ton téléphone présente des failles de sécurité : corrige-les au plus vite';
 }
 }

 // Restaure les états des coches
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // Rafraîchit toutes les 3 secondes (capte les coches des chapitres)
 setInterval(updateDashboard, 3000);

 // ===== Lecture vocale (TTS) =====
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
 // Clone et retire les éléments qui ne doivent pas être lus à voix haute
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // Retire les corps repliés mais conserve leur texte
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('Désolé, ton navigateur ne prend pas en charge la lecture vocale. Essaie Chrome ou Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'Chapitre sans titre';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'fr-FR';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // Essaie d’utiliser une voix française plus naturelle
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('fr'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // Lit automatiquement le chapitre suivant
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
 // Trouve le chapitre actuellement visible
 if (ttsSectionIndex < 0) {
 // Démarre du début ou du chapitre le plus proche de la position de défilement
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
 ttsLabel.textContent = 'Non commencé';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // Branchement des événements
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
 // Recrée et lit la section en cours
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

 // Raccourci : la touche R active/coupe la lecture vocale
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

 // ===== Initialisation =====
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

