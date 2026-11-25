
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
 const nextLabel = isDark ? 'Cambiar al modo claro' : 'Cambiar al modo oscuro';
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

 // ===== Desplazamiento: progreso + sombra + volver arriba + progreso del índice + anillo de progreso =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} capítulos`;

 // Parámetros del anillo de progreso
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

 // Actualización del anillo de progreso
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

 // Hasta qué capítulo se ha leído
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} capítulos`;
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

 // ===== Memoria de la posición de lectura =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // Demasiado pronto para guardar
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // Encuentra el nombre del capítulo actual
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

 // Restaura la posición al cargar la página
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
 restoreToastText.textContent = `Última lectura: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // Se oculta automáticamente tras 10 segundos
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

 // ===== Animación de entrada al desplazarse =====
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
 // El contenido de la primera pantalla se muestra visible directamente
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== Abrir/cerrar la barra lateral =====
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

 // Herramientas rápidas: abrir el índice
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== Navegación global por anclas: compensa el desplazamiento de la barra fija =====
 // Hay que usar scrollIntoView y no calcular coordenadas a mano: .content-section tiene
 // content-visibility:auto + contain-intrinsic-size(0 800px): los capítulos fuera de pantalla
 // ocupan marcadores de 800px, getBoundingClientRect devuelve las coordenadas del marcador y un scrollTo directo
 // caería en el lugar equivocado (cuanto más adelante el capítulo, mayor el desvío acumulado). El scrollIntoView deja que el navegador
 // renderiza el destino a demanda y lo posiciona, y html{scroll-padding-top:5rem} compensa la barra
 // fija.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // Paso 1: el modo instant fuerza primero el renderizado del capítulo y lo posiciona, evitando que content-visibility
 // desvío durante el scroll suave causado por el renderizado diferido.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // Paso 2: cuando el destino ya está renderizado y las coordenadas estables, se lanza un scroll suave para una experiencia agradable.
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

 // ===== Plegado del índice =====
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

 // ===== Filtro del índice =====
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

 // ===== Resaltado en el índice =====
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

 // ===== Sistema de marcadores =====
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

 // Añade a cada capítulo un botón de marcador
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'En marcadores' : 'Marcador') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'Quitar de marcadores' : 'Añadir el capítulo a marcadores');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'En marcadores' : 'Marcador';
 btn.setAttribute('aria-label', added ? 'Quitar de marcadores' : 'Añadir el capítulo a marcadores');
 // Actualiza las marcas de la barra lateral
 updateTocBookmark(id, added);
 });
 // Inserta después del h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // Inicializa las marcas de marcadores en la barra lateral
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== Marcas de capítulo leído =====
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
 // Buscar la fila de meta o el elemento anterior al h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'Leído' : 'Leído') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'Quitar leído' : 'Marcar como leído');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'Leído' : 'Leído';
 check.setAttribute('aria-label', done ? 'Quitar leído' : 'Marcar como leído');
 // Actualiza la barra lateral
 updateTocCompleted(id, done);
 // Actualiza el progreso de lectura
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
 // También actualiza el recuento de leídos
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} capítulos`;
 }
 }

 // ===== Búsqueda (mejorada: navegación por teclado + recuento de resultados) =====
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
 renderSearchPlaceholder('Escribe palabras clave para buscar');
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
 renderSearchPlaceholder('Sin resultados');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">${results.length} resultados encontrados</div>`;
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
 renderSearchPlaceholder('Escribe palabras clave para buscar');
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

 // Navegación de la búsqueda con teclado
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

 // ===== Tamaño de letra =====
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

 // ===== Cerrar la barra lateral con un deslizamiento =====
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

 // ===== Navegación entre capítulos =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'Capítulo anterior'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'Capítulo siguiente'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== Imprimir =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== Atajos globales de teclado =====
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

 // Cierra las ventanas al hacer clic en el velo
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
 // La impresión ya la gestiona el navegador
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

 // ===== Seguimiento de días seguidos de lectura =====
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

 // Muestra el aviso de días seguidos
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 Día ' + streak + ' de lectura seguida. ¡Sigue así!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage puede no estar disponible */ }
 }
 updateStreak();

 // ===== Copia de seguridad/restauración =====
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
 // Recoge los estados de la autocomprobación
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // Recoge los estados de lectura de los capítulos
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // Recoge los marcadores
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // Recoge las valoraciones
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'Backup-lectura-PhoneClass_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('Fallo al exportar la copia: ' + e.message);
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
 // Restaura los estados de la autocomprobación
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // Restaura los estados de lectura de los capítulos
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
 // Restaura los marcadores
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('¡Restauración lograda! La página se recargará para aplicar todos los datos.');
 location.reload();
 } catch(err) {
 alert('Fallo en la restauración: formato de archivo incorrecto. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('¿Borrar todos los datos de lectura? ¡Es irreversible! Exporta antes una copia de seguridad.')) return;
 if (!confirm('Confirma otra vez: todo el progreso de lectura, los marcadores y las valoraciones se eliminarán. ¿Continuar?')) return;
 localStorage.clear();
 alert('Todos los datos borrados. La página se recargará.');
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

 // ===== Sistema de valoración de capítulos =====
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
 // Inserta después del h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== Optimización antirrebote del scroll =====
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

 // ===== Seguir el modo oscuro del sistema =====
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

 // ===== Añade automáticamente migas y etiquetas de dificultad a cada título =====
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
 
 ${level === 'beginner' ? 'Básico' : level === 'intermediate' ? 'Intermedio' : 'Avanzado'}
 </span>
 <span class="reading-time">
 ~${minutes} min de lectura
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== Añade a los capítulos un bloque “En resumen” =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">En resumen</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['Los plegables están maduros pero no son de masas: un “adorno”, no un “socorro”', 'Doblar a lo ancho = móvil + tableta; doblar a lo largo = bolsillo + mirada rápida en la pantalla externa', 'Ideal para: lectura intensiva/negocios/creación en hover/mujeres que valoran la portabilidad', 'Seis comprobaciones al comprar: tipo de bisagra, pantalla interna UTG, marca del pliegue, tamaño de la pantalla externa, peso y grosor, precio de la reparación', 'Trucos exclusivos: multitarea en pantalla dividida, hover a 90 grados, mirada rápida en la pantalla externa, modo PC', 'Cuidados esenciales: no abrirlo y cerrarlo con frío, protegerlo de arena y polvo, nunca película normal en la pantalla interna, bisagra a salvo del polvo', 'Expectativas: la marca del pliegue es permanente, es más pesado y grueso, la batería es normal, la reventa pierde valor, reparar es caro', 'Filosofía de compra: lo compras por su forma única, no porque sea “más avanzado”'],
 'di-ling-zhang': ['Entiende la propuesta del libro: divulgación digital hablada con claridad y con las manos en la masa', 'Domina el sistema de símbolos: qué significan [botones], >, negrita y cursiva', 'Por qué la capacidad del móvil “se encoge”: las razones principales', 'Adquiere el hábito de anotar las especificaciones de tu móvil', 'Móvil = bóveda de activos digitales; prevenir primero es la idea central', 'Los datos suelen valer más que el propio hardware'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + módem y otros módulos en un solo chip', 'Los núcleos grandes y pequeños de la CPU trabajan juntos: equilibrio entre potencia y batería', 'Pantalla: OLED/LCD, tasa de refresco, brillo automático', 'El corazón del sistema fotográfico: el sensor pesa más que los megapíxeles', 'Evolución de los puertos: Micro USB → Lightning → USB-C unificado', 'El 5G-A trae la nueva capacidad de “unión de comunicación y percepción”'],
 'di-yi-zhang-harmony': ['HarmonyOS = sistema operativo distribuido, pensado para muchos dispositivos desde su nacimiento', 'HarmonyOS 4.3 es compatible con AOSP y puede ejecutar apps de Android', 'HarmonyOS NEXT es totalmente autónomo y ya no admite apps de Android', 'Antes de actualizar, asegúrate de que tus apps habituales tienen versiones nativas'],
 'di-er-zhang': ['Almacenamiento en tres capas: aparato / tarjeta SD / nube', 'Qué significan las carpetas comunes de Android (DCIM, Download, etc.)', 'Copia de datos = copia en la nube + copia local, doble protección', 'Borrar no es destruir; solo “sobrescribir” elimina de verdad', 'Guía rápida de los formatos de archivo comunes (imagen/audio/vídeo/documento)', 'Nombrar como “fecha + evento” es la convención básica', 'La limpieza automática de 72 horas resuelve la acumulación de caché de las apps sociales', 'Doble protección para fotos: censurado + eliminación de EXIF'],
 'di-san-zhang': ['4G/5G tienen papeles distintos; el 5G-A es la versión reforzada', 'Diferencias técnicas clave del Wi-Fi 6/6E/7', 'El Wi-Fi público exige cautela: no introduzcas información sensible', 'El Bluetooth 5.x sigue mejorando, el LE Audio empieza a popularizarse', 'El NFC trabaja a 10cm o menos: la cercanía física es la propia garantía'],
 'di-si-zhang': ['Instala las apps, ante todo, en tiendas oficiales', 'Un paquete APK = certificado + recursos + configuración + binario', 'Cuidado con las apps “limpiadoras-aceleradoras”; que las apps vivan en segundo plano puede ser razonable', 'La verificación de firma de las apps impide manipulaciones: protección a nivel de sistema', 'Modo puro = solo instalaciones de la tienda oficial: el primer muro contra el malware', '“Parásitos digitales” se refiere a versiones piratas con troyanos dentro', 'Mecanismo de revisión de las tiendas: análisis antivirus + revisión de permisos + verificación de desarrolladores'],
 'di-wu-zhang': ['Pantalla: resolución, tasa de refresco, brillo automático', 'Sonido: volúmenes de tono/media/notificaciones gestionados por separado', 'Almacenamiento: limpia con regularidad caché y archivos innecesarios', 'Biometría: huella contra cara; el 3D gana al 2D en seguridad', 'Lectores de pantalla: VoiceOver en iOS / TalkBack en Android son los ojos de los usuarios con discapacidad visual', 'Ampliación: alto contraste, texto en negrita y filtros de color: el trío', 'Descripción de imágenes con IA: la IA lee imágenes, menús y captchas por ti', 'Los subtítulos en directo: un salvavidas para quienes no oyen y para entornos ruidosos', 'RTT/TTY: quienes no pueden hablar u oír también pueden llamar'],
 'di-liu-zhang': ['Contraseña de bloqueo + autenticación en dos pasos son la línea base de defensa', 'Permisos de apps: activa según la necesidad, principio de mínimo privilegio', 'Nada de pagos ni inicios de sesión en Wi-Fi público', 'En la era de la IA, ver no es creer: caras y voces clonadas, falsa autoridad e inversiones falsas son los engaños más comunes', 'Guía de salida: verificación con un gesto + palabra de control + segunda confirmación', 'Antes de compartir fotos, anonimízalas: desactiva la ubicación y los datos del aparato en los EXIF', 'Dispositivos IoT: cambia la contraseña predeterminada', 'Si te estafan, recuerda: no confíes, no reveles, no transfieras'],
 'di-qi-zhang-jichu': ['Satélite: la “cuerda de salvamento” en emergencias', 'Comunicar sin red: radiocomunicación de larga distancia sin cobertura', 'Detección de accidentes: la fusión de sensores reconoce colisiones graves', 'StarFlash: conexión inalámbrica de baja latencia con un potencial enorme'],
 'di-ba-zhang': ['Grabar llamadas: atención a la legalidad', 'iMessage/RCS elevan los SMS tradicionales a mensajes multimedia', 'El historial de WeChat necesita la propia función de copia de WeChat', 'Las apps de correo gestionan varias cuentas de forma unificada', 'Bloqueo de acoso: detección del sistema + listas negra/blanca + filtros de palabras clave en SMS', '“Silenciar desconocidos” en iOS frena el acoso, pero ojo con las llamadas perdidas', 'Las marcas erróneas de spam se reclaman vía Dianhua Bang/360/Tencent y los canales del operador'],
 'di-jiu-zhang': ['WPS Office funciona mejor en China, Microsoft 365 tiene la mejor compatibilidad', 'Notas en tres fases: anotado → para leer después → sistema de conocimiento', 'Escaneo con el móvil: Notas/Mic Lens/Baimiao/CamScanner', 'Nube según la necesidad: iCloud/OneDrive/Baidu/Aliyun Drive, cada uno con sus escenarios'],
 'di-shi-zhang': ['Quien ve el código de pago cobra: jamás le mandes una captura a nadie', 'Revisión de seguridad de 5 minutos: pago biométrico + candado de seguridad + revisión de pagos sin contraseña + gestión de dispositivos', 'En metro y autobús, mejor la tarjeta de transporte virtual en la cartera del móvil: funciona incluso sin conexión', 'Certificado médico electrónico, consultas de pensión, declaración de impuestos: todo desde el móvil', 'Cuatro noes contra las estafas: nunca transfieras a una “cuenta segura”, nunca envíes el código de pago, nunca toques enlaces desconocidos, nunca des el número de la tarjeta'],
 'di-shi-yi-zhang': ['Cuatro errores comunes: lente sucia, exposición sin ajustar, abuso del flash, zoom digital mal usado', 'El modo nocturno fusiona varios fotogramas; mano firme 2-4 segundos', 'Modo pro: ISO más bajo, imagen más limpia; el obturador comanda la luz', 'Flujo de posproducción: corrige → ajustes básicos → retoque local → estiliza', 'Búsqueda inteligente + limpieza regular + álbumes manuales = el trío de gestión de fotos'],
 'di-shi-yi-zhang-advanced': ['Los tres elementos del vídeo: resolución, fotogramas por segundo, bitrate', 'H.265 comprime un 50% más que H.264', 'ProRes es el códec profesional de Apple: archivos enormes', 'HDR10/10+/Dolby Vision: cada uno tiene su nicho'],
 'di-shi-er-zhang': ['NetEase Cloud Music es la mejor en listas y comunidad, QQ Music tiene el catálogo más amplio, Apple Music es sobria y sin pérdidas, Spotify tiene recomendaciones muy fuertes', 'Xiaoyuzhou es la primera elección de podcasts en chino; aprovecha la velocidad y la limpieza automática', 'Vídeo local: VLC (todos los formatos) o nPlayer (control por gestos)', 'Los subrayados de WeChat Read son sociales + sincronización con Kindle; el modo de cuidado ocular siempre activado', 'El modo de juego prioriza la fluidez de los fotogramas; contra el calor ayuda la refrigeración con pinza'],
 'di-shi-san-zhang': ['Herramientas de productividad: tareas + pomodoro + calendario', 'Salud y deporte: Apple Health/Google Fit como centro de datos', 'Navegador: Edge primero, con Copilot para rendir más', 'Busca lo verdadero: confía en dominios oficiales, evita sufijos baratos como .xyz', 'Prefiere la limpieza nativa; las de terceros como Qingzhuo son solo complemento, nunca limpiarlo todo de un toque', 'Apps antienlace: Centro Nacional Antifraude + guardianes de marca + bloqueo del operador', 'Bloqueo nativo: en iOS, Silenciar desconocidos; en Android se activa en la app de teléfono de cada marca', 'Tres capas juntas: bloqueo del sistema + operador + centro antifraude; cuida la lista blanca para no bloquear a los tuyos', 'Alertas del tiempo: app del tiempo del sistema + canales oficiales; actúa según los niveles azul/amarillo/naranja/rojo', 'Alertas de desastres naturales: meteorología + protección civil; con lluvias fuertes y tifones, lejos de zonas bajas y vallas publicitarias', 'La alerta de terremoto no es predicción: segundos a decenas de segundos de antelación; en Android suele estar en los ajustes de seguridad', 'TickTick: listas + calendario + pomodoro, agenda en lenguaje natural', 'Digitalizar papel: cámara del sistema/Mic Lens/Baimiao/CamScanner; fotografía nítido y luego OCR', 'Control remoto del PC: Sunflower/ToDesk; si un desconocido te pide instalar control remoto = estafa', 'IA en la oficina: Trae y más; el trabajo pesado en el ordenador, desde el móvil lo sigues a distancia', 'Transferencia rápida en red local: LocalSend/AirDrop/Feige; portapapeles: KDE Connect/herramientas de marca', 'Códigos de un solo uso 2FA: Aegis/Microsoft Authenticator, copias en papel de los códigos de respaldo'],
 'di-shi-si-zhang': ['Con un gestor de contraseñas basta con recordar una contraseña maestra', 'Bitwarden es de código abierto y gratis, 1Password ofrece la mejor experiencia', 'La contraseña maestra debe ser larga y compleja, con la doble verificación activada', 'Audita la seguridad de tus contraseñas con regularidad', 'Arquitectura de conocimiento cero: ni el proveedor ve tus contraseñas; el cifrado ocurre en local', 'AES-256 + derivación PBKDF2/Argon2 son la piedra angular de la seguridad de una bóveda de contraseñas', 'La lección del caso LastPass 2022: los más expuestos fueron los usuarios con contraseña maestra débil', 'La fuerza de la contraseña es la “entropía”: longitud + aleatoriedad vencen a los símbolos complejos', 'HaveIBeenPwned comprueba filtraciones, 1Password Watchtower vigila incidentes', 'Las Passkeys se basan en FIDO2/WebAuthn: inmunes al phishing, no se transmite ninguna contraseña', 'Sincronización de Passkey entre dispositivos: el llavero iCloud/Google Password Manager ya la soportan', 'Las llaves físicas (YubiKey/Titan) resisten phishing y secuestro de SIM: ideales para perfiles muy expuestos', 'Cámaras compartidas de 1Password + acceso de emergencia de Bitwarden hacen más seguro el compartir en familia y en equipo'],
 'di-shi-wu-zhang': ['Baterías de litio: carga según el uso, odian el calor, envejecen', 'Por debajo del 80% de salud de batería, la autonomía cae de forma notable', 'Protocolos de carga rápida: PD/QC/VOOC/SuperCharge no son intercambiables', 'La carga inalámbrica Qi2 introduce el alineamiento magnético', 'El núcleo del ahorro: baja el brillo + cierra el segundo plano + cambia a 4G'],
 'di-shi-liu-zhang': ['La cuenta es el registro civil de tu vida digital: ata contactos, fotos, compras y Buscar mi móvil', 'Tres obligaciones: activa el 2FA, define la clave de recuperación, confirma que Buscar mi móvil está activado', 'Los 5GB de iCloud no bastan: limpia o pasa a 50GB por unos ¥1/mes', 'La sincronización es bidireccional (borras aquí, desaparece en todas partes), la copia es una instantánea de ida (borras aquí, allí queda)', 'Usuarios de Android, comprobad por separado: copia en la nube de la marca, copia de Google, copia de WeChat'],
 'di-shi-qi-zhang': ['Colaboración entre dispositivos: AirDrop de Apple/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/Conectar con Windows', 'Emitir a la TV: el iPhone usa Duplicar pantalla, Android usa emisión inalámbrica; si falla, comprueba que estás en el mismo Wi-Fi', 'Reloj inteligente = filtro de notificaciones + puesto de salud + pago desde la muñeca; uno para tus padres puede librar el día', 'Hogar inteligente: elige por ecosistema - Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'Seguridad de los vínculos: en público cuida la privacidad al emitir, y desvincula a tiempo los aparatos viejos'],
 'di-shi-ba-zhang': ['Copia completa: local en el ordenador (la más fiable) + nube (la más cómoda), doble protección', 'El historial de WeChat es el caso más especial: solo el backup propio de WeChat lo lleva; las herramientas de migración no pueden', 'Regla 3-2-1: 3 copias, 2 tipos de soporte, 1 fuera de casa', 'Cambio de móvil: misma marca usa la app oficial de migración; entre marcas, prepara antes un relevo de datos'],
 'di-shi-jiu-zhang': ['Tirones y calor en cuatro pasos: piensa qué cambió → revisa el almacenamiento → revisa el consumo → revisa la señal', 'Rutina para apps que se cierran: cierra y reabre → actualiza → revisa permisos → borra la caché → reinstala', 'No carga: primero limpia el puerto, luego cruza cables y cargadores para aislar al culpable', 'Sin red: apaga y enciende el modo avión → olvida el Wi-Fi y reconecta → reinicia el router', 'El reinicio universal resuelve la mayoría de problemas extraños; para reparar elige servicios autorizados, antes copia los datos y cierra sesión'],
 'di-er-shi-zhang-jinjie': ['Modo desarrollador: siete toques al número de compilación para activarlo', 'Bloqueo BL: protección del fabricante; desbloquéalo con cautela', 'Root: el riesgo supera el beneficio; para usuarios normales no se recomienda', 'Magisk sigue necesitando el BL desbloqueado, pero puede ocultar el estado de root'],
 'di-er-shi-yi-zhang': ['VPN = túnel cifrado; una VPN gratuita puede ser ella la que te roba los datos', 'Defensa del intermediario en Wi-Fi público: confía en HTTPS, desactiva la conexión automática, lo delicado solo con datos móviles', 'El saludo HTTPS cifra en cuatro intercambios, pero las webs de phishing también usan HTTPS', 'DoH/DoT cifran las consultas DNS: tu operador no espía tu navegación', 'El modo incógnito es una goma local, no una capa de invisibilidad: tu operador y las webs siguen viéndote', 'Lista de seguridad: desactiva la conexión automática de Wi-Fi, cambia a DNS cifrado, activa el 2FA, revisa los permisos de las apps, bloquea el Juice Jacking'],
 'di-er-shi-er-zhang': ['Cámara con IA: reconoce la escena → fusiona fotogramas → optimiza con inteligencia', 'Asistentes de voz: oír → entender → ejecutar, en tres pasos', 'IA en el aparato: rápida, privada, funciona sin conexión', 'Los grandes modelos de IA cubren conversación/escritura/traducción/imagen/estudio', 'Usos típicos: traducción en vivo, borrador de IA, retoque de IA, gestión de documentos, búsqueda de imágenes con IA', 'Framework de prompts CRISPE: rol + petición + contexto + salida + tono + ejemplos', 'Con la IA, cuidado con las alucinaciones y las filtraciones de privacidad', '“Rol-Contexto-Tarea-Restricciones” es un camino más fácil para empezar con los prompts', 'Rasgos de un buen prompt: concreto, con contexto, con formato, con restricciones, verificable'],
 'di-er-shi-san-zhang': ['Elementos de la automatización: disparador + acción + lógica de decisión opcional', 'Atajos de iOS: rutina de buenos días con un toque, ahorro automático, gastos registrados al escanear', 'Android: clicadores automáticos (macros de pantalla), Tasker (la automatización más potente), MacroDroid (amigable para principiantes)', 'Trampas: disparadores de ubicación imprecisos, iOS no se ejecuta en automático sin confirmación manual, Tasker necesita permiso de accesibilidad', 'Mentalidad de automatización: convierte la rutina en condición → acción, y el móvil será tu asistente personal'],
 'di-er-shi-si-zhang': ['El Bootloader es el guardián del arranque; la verificación de firma impide manipulaciones', 'Las políticas de desbloqueo BL varían por marca (Xiaomi lo permite/Huawei lo bloquea)', 'Opciones de root: Magisk/KernelSU/SuperSU', 'Tres tipos de flasheo: ROM oficial/Recovery de terceros/ROM de terceros'],
 'di-er-shi-wu-zhang': ['Vender el móvil viejo: primero copia → cierra sesión → borrado cifrado → rellenar y borrar otra vez', 'Herencia digital: Contacto heredado de iCloud/Cuenta inactiva de Google', 'Reciclaje: primero los programas oficiales de entrega a cambio; el móvil viejo aún puede ser cámara o navegador'],
 'di-er-shi-liu-zhang': ['Tres criterios del móvil con IA: modelo grande en el aparato, potencia de la NPU en TOPS, AI Agent entre apps', 'Estrategias de IA de los fabricantes: Apple/Google/Huawei/Xiaomi/OPPO/vivo, cada uno con sus puntos fuertes', 'Satélite: los mensajes cortos de BeiDou llegan a la gama media, las llamadas Tiantong siguen siendo de gama alta', 'Plegables: hardware maduro, apps adaptadas al 70% aproximadamente, hover/pantalla dividida son la experiencia exclusiva', 'El 6G sigue en camino, el Wi-Fi 7 ya aterrizó, el Bluetooth LE Audio empieza a extenderse', 'Las baterías de ánodo de silicio-carbono hacen del 5000-6000mAh el estándar de gama alta'],
 'di-er-shi-qi-zhang': ['Activa primero el modo fácil o agranda fuentes/iconos: con el entorno bien puesto, la mitad de los problemas desaparece', 'Tres reglas de hierro con los mayores: no metas prisa, usa analogías, escríbelo', 'Seis estafas comunes que conviene recordar una y otra vez; tres líneas de defensa bloquean el 90% del fraude', 'La asistencia remota permite arreglar el móvil de tus padres incluso desde otra ciudad', 'Modo cuidado de WeChat + dictado por voz: las dos funciones más útiles para las personas mayores', 'Llamada SOS y detección de caídas: configuraciones que salvan vidas en el momento clave'],
 'di-er-shi-ba-zhang': ['Elección del móvil en tres pasos: primero las necesidades → luego el presupuesto → al final el modelo', 'Solo cinco parámetros importan: procesador, pantalla, cámara, batería y carga, promesa de actualizaciones', '¥1500-3500 es la franja con mejor relación calidad-precio, la más recomendada', 'La gama alta del año pasado rinde más que la media de este año', 'Cinco trampas: mito de las multicámara, culto a los megapíxeles, versiones del operador, fetichismo de la pantalla curva, reclamos de IA', 'El 618 y el Double 11 son las dos mejores ventanas del año para comprar un móvil'],
 'di-er-shi-jiu-zhang': ['Primero mira los datos de tiempo de pantalla; ver la situación con claridad es el primer paso para cambiar', 'Pon límites a las apps de ocio y horarios a No molestar, y recupera tu atención', 'La regla 20-20-20 es el hábito más simple y eficaz para cuidar la vista', 'Mirar el móvil carga el cuello con 5-6 veces el peso de la cabeza; sube el móvil y estira el cuello a menudo', 'La hora previa a dormir, sin móvil; deja el cargador fuera del alcance del brazo', 'El antídoto contra la ansiedad informativa es “bloquear activamente”, no “recibir más”'],
 'di-san-shi-zhang': ['Tres campos de la emisión inalámbrica: AirPlay (Apple), Miracast (Android), DLNA (envío multimedia multiplataforma)', 'La emisión por cable es más estable y sin retraso; en la sala de reuniones no puede faltar el adaptador HDMI', 'Samsung DeX/modo escritorio de Huawei convierten el móvil en un PC ligero de oficina', 'Conexión en el coche: cuatro soluciones - CarPlay/Android Auto/HiCar/CarLife', 'Reglas de emisión en la sala de reuniones: prueba antes, prepara el plan B, oculta la vista previa de notificaciones'],
 'di-san-shi-yi-zhang': ['Antes de grabar, ten claro: quién es el público, qué valor das, en qué plataforma publicas', 'Cinco cosas antes de grabar: 1080P/30fps, limpia la lente, bloquea foco y exposición, elige la orientación, activa la cuadrícula', 'Cinco movimientos de cámara: acercar, alejar, panorámica, desplazar, seguir - la estabilidad es lo primero', 'Edición con CapCut: corte → transiciones → subtítulos → BGM → exportación, en seis pasos', 'Los primeros 3 segundos lo deciden todo; un vídeo cuenta una sola cosa; la constancia vale más que el talento'],
 'di-san-shi-er-zhang': ['Móvil perdido, 30 minutos de oro: pide un móvil prestado y llámate → bloqueo remoto → bloqueo de la SIM → congelar pagos → avisar a familia y amigos → denuncia', '72 horas tras la estafa: detén las transferencias → guarda las pruebas → llama al 96110 → denuncia → contacta con el banco → cambia las contraseñas', 'Móvil infectado: modo seguro → desinstala apps sospechosas → análisis de seguridad → restablecimiento de fábrica (último recurso)', 'Cuenta robada: cambia la contraseña → cierra sesión en los dispositivos → revisa los inicios de sesión → activa el 2FA → revisa los vínculos → revisa los pagos', 'El 99,9% de los mensajes de rescate son estafas: no respondas, no pagues, captura y bloquea', 'Estafas con cara/voz clonados: busca defectos en parpadeos, boca, contornos y luces; pide que giren la cabeza, que se tapen la cara, haz preguntas personales, devuelve la llamada a un número ya conocido', 'Secuestro de SIM: si el móvil muestra de pronto “Sin servicio”, alerta; pon PIN a la SIM, activa la segunda verificación del operador, pasa las cuentas clave a apps de autenticación', 'Cinco hábitos diarios: bloqueo de pantalla + 2FA, Buscar mi móvil, PIN de la SIM, nada de apps desconocidas, copias de seguridad regulares', 'Terremoto/tiempo extremo: primero resguárdate cerca, luego evacúa; un SMS gasta menos batería que una llamada larga', 'Sin señal, prioriza el SOS por satélite (si el modelo lo admite); alertas y ajustes en el Capítulo 13'],
 'di-san-shi-san-zhang': ['Vision Pro y las gafas AR son nuevas puertas de computación más allá del móvil, pero no lo sustituirán pronto', 'Las interfaces cerebro-computadora están a 10-20 años del consumidor; la ética madura antes que la tecnología', 'El móvil evoluciona hacia la “invisibilidad”: del centro en el dispositivo al centro en la identidad', 'La ética de la IA, la soberanía de los datos y la brecha digital son los temas centrales de la próxima década', 'Estar conectado y seguir siendo independiente: la filosofía inmutable de la vida digital'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // Saltarse los capítulos que ya tienen resumen en línea, para no duplicar
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== Botón de copiar (añadido a los elementos kbd) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'Copiar');
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

 // ===== Contenido largo plegable (nivel h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // Solo plegar secciones h4 largas
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // Añade el encabezado plegable
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

 // ===== Panel de aprendizaje: progreso de lectura + autotest de salud del móvil =====
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
 // Progreso de lectura
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // Recuento de marcadores
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // Último capítulo
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // Autocomprobación de salud
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = '¡Puntuación perfecta! La seguridad de tu móvil está en muy buen estado';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = '¡Bien! ' + (totalChecks - checked) + ' puntos por pulir';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'Aprobado justito: prioriza los puntos de seguridad sin marcar';
 else healthMsgEl.innerHTML = 'Tu móvil tiene brechas de seguridad: corrígelas cuanto antes';
 }
 }

 // Restaura los estados de las marcas
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // Actualiza cada 3 segundos (recoge las marcas de los capítulos)
 setInterval(updateDashboard, 3000);

 // ===== Lectura en voz alta (TTS) =====
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
 // Clona y elimina los elementos que no deben leerse en voz alta
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // Elimina los cuerpos plegados pero conserva su texto
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('Lo sentimos, tu navegador no admite lectura en voz alta. Prueba Chrome o Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'Capítulo sin título';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'es-ES';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // Intenta usar una voz en español más natural
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('es'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // Lee automáticamente el capítulo siguiente
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
 // Encuentra el capítulo visible ahora mismo
 if (ttsSectionIndex < 0) {
 // Empieza desde el principio o desde el capítulo más cercano a la posición de scroll
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
 ttsLabel.textContent = 'Sin empezar';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // Vinculación de eventos
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
 // Vuelve a crear y reproducir la sección actual
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

 // Atajo: la tecla R activa o desactiva la lectura en voz alta
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

 // ===== Inicialización =====
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

