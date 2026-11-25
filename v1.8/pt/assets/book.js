
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
 const nextLabel = isDark ? 'Mudar para o modo claro' : 'Mudar para o modo escuro';
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

 // ===== Rolagem: progresso + sombra + voltar ao topo + progresso do índice + anel de progresso =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} capítulos`;

 // Parâmetros do anel de progresso
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

 // Atualização do anel de progresso
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

 // Até que capítulo se leu
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

 // ===== Memória da posição de leitura =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // Cedo demais para salvar
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // Encontra o nome do capítulo atual
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

 // Restaura a posição ao carregar a página
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
 restoreToastText.textContent = `Última leitura: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // Oculta automaticamente após 10 segundos
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

 // ===== Animação de entrada na rolagem =====
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
 // O conteúdo da primeira tela fica visível direto
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== Abrir/fechar a barra lateral =====
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

 // Ferramentas rápidas: abrir o índice
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== Navegação global por âncoras: compensa o deslocamento da barra fixa =====
 // É preciso usar scrollIntoView em vez de calcular coordenadas: .content-section tem
 // content-visibility:auto + contain-intrinsic-size(0 800px): capítulos fora da tela
 // ocupam espaços reservados de 800px, getBoundingClientRect devolve as coordenadas do placeholder e um scrollTo direto
 // cairia no lugar errado (quanto mais adiante o capítulo, maior o desvio acumulado). O scrollIntoView deixa o navegador
 // renderiza o destino sob demanda e o posiciona, e html{scroll-padding-top:5rem} compensa a barra
 // fixa.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // Passo 1: o modo instant primeiro força a renderização do capítulo e o posiciona, evitando que o content-visibility
 // desvio durante o scroll suave causado pela renderização adiada.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // Passo 2: quando o destino já está renderizado e as coordenadas estáveis, dispara um scroll suave para uma experiência agradável.
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

 // ===== Recolher o índice =====
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

 // ===== Filtrar o índice =====
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

 // ===== Realçar no índice =====
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

 // ===== Sistema de favoritos =====
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

 // Adiciona a cada capítulo um botão de favorito
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'Nos favoritos' : 'Favorito') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'Remover dos favoritos' : 'Adicionar o capítulo aos favoritos');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'Nos favoritos' : 'Favorito';
 btn.setAttribute('aria-label', added ? 'Remover dos favoritos' : 'Adicionar o capítulo aos favoritos');
 // Atualiza as marcações da barra lateral
 updateTocBookmark(id, added);
 });
 // Insere depois do h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // Inicializa as marcações de favoritos na barra lateral
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== Marcações de capítulo lido =====
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
 // Encontra a linha de meta ou o elemento antes do h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'Lido' : 'Lido') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'Desmarcar lido' : 'Marcar como lido');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'Lido' : 'Lido';
 check.setAttribute('aria-label', done ? 'Desmarcar lido' : 'Marcar como lido');
 // Atualiza a barra lateral
 updateTocCompleted(id, done);
 // Atualiza o progresso de leitura
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
 // Também atualiza a contagem de lidos
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} capítulos`;
 }
 }

 // ===== Busca (aprimorada: navegação por teclado + contagem de resultados) =====
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
 renderSearchPlaceholder('Digite palavras-chave para buscar');
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
 renderSearchPlaceholder('Nada encontrado');
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
 renderSearchPlaceholder('Digite palavras-chave para buscar');
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

 // Navegação da busca por teclado
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

 // ===== Tamanho da fonte =====
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

 // ===== Fechar a barra lateral com deslize =====
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

 // ===== Navegação entre capítulos =====
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
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'Próximo capítulo'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== Impressão =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== Atalhos globais de teclado =====
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

 // Fecha as janelas ao clicar no véu
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
 // A impressão o navegador já trata
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

 // ===== Rastreamento de dias seguidos de leitura =====
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

 // Mostra o aviso da sequência de dias
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 Dia ' + streak + ' de leitura seguida. Continue assim!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage pode estar indisponível */ }
 }
 updateStreak();

 // ===== Backup/restauração =====
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
 // Coleta os estados da autodiagnóstico
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // Coleta os estados de leitura dos capítulos
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // Coleta os favoritos
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // Coleta as avaliações
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'Backup-leitura-PhoneClass_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('Falha ao exportar backup: ' + e.message);
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
 // Restaura os estados da autodiagnóstico
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // Restaura os estados de leitura dos capítulos
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
 // Restaura os favoritos
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('Restauração concluída! A página será recarregada para aplicar todos os dados.');
 location.reload();
 } catch(err) {
 alert('Falha na restauração: formato de arquivo inválido. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('Apagar todos os dados de leitura? A ação é irreversível! Exporte um backup antes.')) return;
 if (!confirm('Confirme de novo: todo o progresso de leitura, os favoritos e as avaliações serão excluídos. Continuar?')) return;
 localStorage.clear();
 alert('Todos os dados apagados. A página será recarregada.');
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

 // ===== Sistema de avaliação de capítulos =====
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
 // Insere depois do h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== Otimização anti-tremedeira do scroll =====
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

 // ===== Segue o modo escuro do sistema =====
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

 // ===== Adiciona automaticamente breadcrumbs e etiquetas de dificuldade aos títulos =====
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
 
 ${level === 'beginner' ? 'Básico' : level === 'intermediate' ? 'Intermediário' : 'Avançado'}
 </span>
 <span class="reading-time">
 ~${minutes} min de leitura
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== Adiciona aos capítulos um bloco “Resumo” =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">Resumo do capítulo</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['Dobráveis estão maduros, mas não são mainstream: um “enfeite”, não um “salva-vidas”', 'Dobra na horizontal = celular + tablet; dobra na vertical = bolso + espiadinha na tela externa', 'Ideal para: leitura intensa/negócios/criação em hover/mulheres que valorizam portabilidade', 'Seis checagens na compra: tipo da dobradiça, tela interna UTG, marca da dobra, tamanho da tela externa, peso e espessura, preço do reparo fora da garantia', 'Truques exclusivos: multitarefa em tela dividida, hover a 90 graus, espiadinha na tela externa, modo PC', 'Cuidados essenciais: não abrir/fechar no frio, proteger de poeira e areia, nunca película comum na tela interna, dobradiça livre de poeira', 'Expectativas: a marca da dobra é permanente, é mais pesado e grosso, a bateria é mediana, a revenda desvaloriza, o reparo é caro', 'Filosofia de compra: você o compra pela forma única, não porque é “mais avançado”'],
 'di-ling-zhang': ['Entenda a proposta do livro: ciência digital falada com clareza e com as mãos na massa', 'Domine o sistema de símbolos: o que significam [botões], >, negrito e itálico', 'Por que a capacidade do celular “encolhe”: as principais razões', 'Crie o hábito de anotar as especificações do seu celular', 'Celular = cofre de ativos digitais; prevenir primeiro é a ideia central', 'Os dados costumam valer mais que o próprio hardware'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + modem e outros módulos num único chip', 'Núcleos grandes e pequenos da CPU trabalham juntos: desempenho e bateria em equilíbrio', 'Tela: OLED/LCD, taxa de atualização, brilho automático', 'Núcleo do sistema de imagem: o sensor importa mais que a contagem de pixels', 'Evolução das portas: Micro USB → Lightning → USB-C unificado', 'O 5G-A traz a nova capacidade de “união de comunicação e sensoriamento”'],
 'di-yi-zhang-harmony': ['HarmonyOS = sistema operacional distribuído, pensado para muitos dispositivos desde o início', 'HarmonyOS 4.3 é compatível com AOSP e pode rodar apps Android', 'HarmonyOS NEXT é totalmente autônomo e não suporta mais apps Android', 'Antes de atualizar, confirme que seus apps de uso diário já têm versões nativas'],
 'di-er-zhang': ['Armazenamento em três camadas: aparelho / cartão SD / nuvem', 'O que significam as pastas comuns do Android (DCIM, Download etc.)', 'Backup de dados = cópia na nuvem + cópia local, proteção dupla', 'Apagar não é destruir; só “sobrescrever” elimina de verdade', 'Guia rápido dos formatos de arquivo comuns (imagem/áudio/vídeo/documento)', 'Nomenclatura “data + evento” é a convenção básica', 'A limpeza automática de 72 horas resolve o acúmulo de cache dos apps sociais', 'Proteção dupla para fotos: ocultação + remoção de EXIF'],
 'di-san-zhang': ['4G/5G têm papéis diferentes; o 5G-A é a versão reforçada', 'Diferenças técnicas-chave do Wi-Fi 6/6E/7', 'Wi-Fi público exige cautela: evite digitar informações sensíveis', 'O Bluetooth 5.x segue evoluindo, o LE Audio começa a se popularizar', 'O NFC trabalha a até 10cm: a proximidade física é a própria garantia'],
 'di-si-zhang': ['Instale apps de preferência nas lojas oficiais', 'Um pacote APK = certificado + recursos + configuração + binário', 'Cuidado com apps “limpadores-aceleradores”; apps residentes em segundo plano podem ser legítimos', 'A verificação de assinatura do app impede adulteração: proteção a nível de sistema', 'Modo puro = só instalações da loja oficial: a primeira muralha contra malware', '“Parasitas digitais” se refere a versões crackeadas com cavalos de Troia dentro', 'Mecanismo de revisão das lojas de apps: varredura de vírus + revisão de permissões + verificação do desenvolvedor'],
 'di-wu-zhang': ['Tela: resolução, taxa de atualização, brilho automático', 'Som: volumes de toque/mídia/notificações geridos separadamente', 'Armazenamento: limpe com regularidade cache e arquivos desnecessários', 'Biometria: digital contra rosto; 3D vence 2D em segurança', 'Leitores de tela: VoiceOver no iOS / TalkBack no Android são os olhos de usuários com deficiência visual', 'Ampliação: alto contraste, texto em negrito e filtros de cor - o trio', 'Descrição de imagens por IA: a IA lê imagens, cardápios e captchas para você', 'Legendas ao vivo: um salva-vidas para quem não ouve e para ambientes barulhentos', 'RTT/TTY: quem perdeu a voz ou a audição também pode telefonar'],
 'di-liu-zhang': ['Senha de bloqueio + autenticação de dois fatores são a linha de base da defesa', 'Permissões de apps: ative conforme a necessidade, princípio do menor privilégio', 'Nenhum pagamento ou login em Wi-Fi público', 'Na era da IA, ver não é crer: rostos e vozes clonados, falsa autoridade e investimentos falsos são os golpes mais comuns', 'Roteiro de reação: verificação por ação + palavra de confirmação + segunda checagem', 'Antes de compartilhar fotos, anonimize: desative localização e dados do aparelho nos EXIF', 'Dispositivos IoT: troque a senha padrão', 'Se cair num golpe, lembre: não confie, não revele, não transfira'],
 'di-qi-zhang-jichu': ['Satélite: o “cordão de salvação” nas emergências', 'Comunicação sem rede: rádio de longo alcance mesmo sem cobertura', 'Detecção de acidente: a fusão de sensores reconhece colisões graves', 'StarFlash: conexão sem fio de baixa latência com potencial enorme'],
 'di-ba-zhang': ['Gravação de chamadas: atenção à legalidade', 'iMessage/RCS elevam o SMS tradicional a mídia rica', 'O histórico do WeChat precisa da própria função de backup dele', 'Apps de e-mail gerenciam várias contas de forma unificada', 'Bloqueio de incômodos: reconhecimento do sistema + listas negra/branca + filtros de palavras-chave em SMS', '“Silenciar desconhecidos” no iOS barra o incômodo, mas atenção às chamadas perdidas', 'Marcações erradas de spam podem ser contestadas via Dianhua Bang/360/Tencent e canais da operadora'],
 'di-jiu-zhang': ['WPS Office funciona melhor na China, Microsoft 365 tem a melhor compatibilidade', 'Notas em três etapas: anotou → ler depois → sistema de conhecimento', 'Digitalizar pelo celular: Notas/Mic Lens/Baimiao/CamScanner', 'Nuvem conforme a necessidade: iCloud/OneDrive/Baidu/Aliyun Drive, cada um com seus cenários'],
 'di-shi-zhang': ['Quem vê o código de pagamento recebe o dinheiro: jamais mande um print dele a alguém', 'Check-up de segurança de 5 minutos: pagamento biométrico + trava de segurança + revisão de pagamentos sem senha + gestão de dispositivos', 'No metrô e no ônibus, prefira o cartão de transporte virtual na carteira do celular: funciona até offline', 'Certificado eletrônico do plano de saúde, consulta previdenciária, imposto de renda: tudo pelo celular', 'Quatro não contra golpes: nunca transfira para “conta segura”, nunca mande o código de pagamento, nunca toque em links desconhecidos, nunca passe o número do cartão'],
 'di-shi-yi-zhang': ['Quatro erros comuns: lente suja, exposição sem ajuste, abuso do flash, zoom digital mal usado', 'O modo noturno funde vários quadros; mão firme por 2-4 segundos', 'Modo pro: ISO mais baixo, imagem mais limpa; o obturador comanda a luz', 'Fluxo de pós-produção: corrija → ajustes básicos → retoque local → estilize', 'Busca inteligente + limpeza regular + álbuns manuais = o trio do gerenciamento de fotos'],
 'di-shi-yi-zhang-advanced': ['Os três elementos do vídeo: resolução, taxa de quadros, bitrate', 'H.265 comprime 50% a mais que o H.264', 'ProRes é o codec profissional da Apple: arquivos enormes', 'HDR10/10+/Dolby Vision: cada um tem seu nicho'],
 'di-shi-er-zhang': ['NetEase Cloud Music é a melhor em playlists e comunidade, QQ Music tem o catálogo mais amplo, Apple Music é limpa e sem perdas, Spotify tem recomendações fortes', 'Xiaoyuzhou é a primeira escolha de podcasts em chinês; use bem velocidade e limpeza automática', 'Vídeo local: VLC (todos os formatos) ou nPlayer (controle por gestos)', 'Marcações no WeChat Read têm função social + sincronização com Kindle; o modo de proteção ocular deve ficar sempre ligado', 'O modo de jogo prioriza a fluidez dos frames; contra o superaquecimento ajuda a ventoinha de presilha'],
 'di-shi-san-zhang': ['Ferramentas de produtividade: tarefas + pomodoro + calendário', 'Saúde e esporte: Apple Health/Google Fit como centro de dados', 'Navegador: Edge primeiro, com Copilot para turbinar a produtividade', 'Busque o verdadeiro: confie em domínios oficiais, evite sufixos baratos como .xyz', 'Prefira a limpeza nativa; terceiros como Qingzhuo são só complemento - nunca limpar tudo com um toque', 'Apps antienrolação: Centro Nacional Antifraude + guardiões das marcas + bloqueio da operadora', 'Bloqueio nativo: no iOS, Silenciar desconhecidos; no Android, ative no app de telefone de cada marca', 'Três camadas somadas: bloqueio do sistema + operadora + centro antifraude; cuide da lista branca para não bloquear os seus', 'Alertas do tempo: app de tempo do sistema + canais oficiais; aja conforme os níveis azul/amarelo/laranja/vermelho', 'Alertas de desastres naturais: meteorologia + defesa civil; em chuvas fortes e tufões fique longe de áreas baixas e outdoors', 'Alerta de terremoto não é previsão: segundos a dezenas de segundos de antecedência; no Android costuma ficar nas configurações de segurança', 'TickTick: listas + calendário + pomodoro, agenda em linguagem natural', 'Digitalizar papel: câmera do sistema/Mic Lens/Baimiao/CamScanner; fotografe nítido e depois OCR', 'Controle remoto do PC: Sunflower/ToDesk; se um desconhecido pedir para instalar controle remoto = golpe', 'IA no escritório: Trae e outros; o trabalho pesado no computador, pelo celular você acompanha de longe', 'Transferência rápida em rede local: LocalSend/AirDrop/Feige; área de transferência: KDE Connect/ferramentas da marca', 'Códigos descartáveis de 2FA: Aegis/Microsoft Authenticator, cópias em papel dos códigos de reserva'],
 'di-shi-si-zhang': ['Com um gerenciador de senhas, basta lembrar uma senha-mestre', 'Bitwarden é de código aberto e gratuito, 1Password tem a melhor experiência', 'A senha-mestre deve ser longa e complexa, com 2FA ativado', 'Faça auditoria de segurança das senhas com regularidade', 'Arquitetura de conhecimento zero: nem o fornecedor vê suas senhas; a criptografia acontece localmente', 'AES-256 + derivação PBKDF2/Argon2 são a pedra fundamental da segurança de um cofre de senhas', 'A lição do caso LastPass 2022: os mais expostos foram usuários com senha-mestre fraca', 'A força da senha é a “entropia”: comprimento + aleatoriedade vencem símbolos complicados', 'HaveIBeenPwned verifica vazamentos, 1Password Watchtower monitora incidentes', 'Passkeys se baseiam em FIDO2/WebAuthn: imunes a phishing, nenhuma senha transmitida', 'Sincronização de Passkey entre dispositivos: chaveiro iCloud/Google Password Manager já suportam', 'Chaves físicas (YubiKey/Titan) resistem a phishing e sequestro de SIM - ideais para quem tem mais exposição', 'Cofres compartilhados do 1Password + acesso de emergência do Bitwarden deixam o compartilhamento em família e em equipe mais seguro'],
 'di-shi-wu-zhang': ['Baterias de lítio: carregue conforme o uso, odeiam calor, envelhecem', 'Abaixo de 80% de saúde da bateria, a autonomia cai de forma notável', 'Protocolos de carga rápida: PD/QC/VOOC/SuperCharge não são intercambiáveis', 'O carregamento sem fio Qi2 introduz alinhamento magnético', 'Núcleo da economia de bateria: baixe o brilho + feche o segundo plano + mude para o 4G'],
 'di-shi-liu-zhang': ['A conta é o registro civil da sua vida digital: junta contatos, fotos, compras e Encontrar o celular', 'Três obrigações: ative o 2FA, defina a chave de recuperação, confirme que Encontrar o celular está ativo', 'Os 5GB do iCloud não bastam: limpe ou passe para 50GB por cerca de ¥1/mês', 'Sincronização é bidirecional (apagou aqui, some em todo lugar), backup é retrato de mão única (apagou aqui, lá fica)', 'Usuários Android, confiram separadamente: backup na nuvem da marca, backup Google, backup WeChat'],
 'di-shi-qi-zhang': ['Colaboração entre dispositivos: AirDrop da Apple/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/Conectar ao Windows', 'Transmitir para a TV: iPhone usa Espelhamento de Tela, Android usa transmissão sem fio; se falhar, confira se está no mesmo Wi-Fi', 'Relógio inteligente = filtro de notificações + posto de saúde + pagamento no pulso; um para os pais pode salvar o dia', 'Casa inteligente: escolha pelo ecossistema - Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'Segurança dos vínculos: em público cuidado com a privacidade ao transmitir, e desvincule os aparelhos antigos a tempo'],
 'di-shi-ba-zhang': ['Backup completo: local no computador (o mais confiável) + nuvem (o mais prático), proteção dupla', 'O histórico do WeChat é o caso mais especial: só o backup interno do WeChat o leva; ferramentas de migração não dão conta', 'Regra 3-2-1: 3 cópias, 2 tipos de mídia, 1 fora de casa', 'Troca de celular: mesma marca usa o app oficial de migração; entre marcas, prepare antes um relevo de dados'],
 'di-shi-jiu-zhang': ['Travamento e aquecimento em quatro passos: lembre o que mudou → confira o armazenamento → confira o consumo → confira o sinal', 'Rotina para app que trava: feche e reabra → atualize → confira permissões → limpe o cache → reinstale', 'Não carrega: primeiro limpe a porta, depois cruze cabos e carregadores para isolar o culpado', 'Sem rede: ligue e desligue o modo avião → esqueça o Wi-Fi e reconecte → reinicie o roteador', 'A reinicialização universal resolve a maioria dos problemas estranhos; para conserto escolha assistências autorizadas, antes faça backup e saia das contas'],
 'di-er-shi-zhang-jinjie': ['Modo desenvolvedor: sete toques no número da versão para ativar', 'Bloqueio BL: proteção do fabricante; desbloqueie com cautela', 'Root: o risco supera o benefício; para usuários comuns não é recomendado', 'Magisk ainda exige BL desbloqueado, mas consegue esconder o estado de root'],
 'di-er-shi-yi-zhang': ['VPN = túnel criptografado; uma VPN gratuita pode ser ela mesma a roubar seus dados', 'Defesa contra homem-do-meio no Wi-Fi público: confie no HTTPS, desligue a conexão automática, tarefas sensíveis só no dados móveis', 'O handshake HTTPS criptografa em quatro trocas, mas sites de phishing também usam HTTPS', 'DoH/DoT criptografam as consultas DNS: a operadora não espia sua navegação', 'Modo anônimo = borracha local, não capa de invisibilidade: operadora e sites continuam vendo você', 'Checklist de segurança: desligue a conexão automática de Wi-Fi, use DNS criptografado, ative o 2FA, revise permissões de apps, bloqueie o Juice Jacking'],
 'di-er-shi-er-zhang': ['Câmera com IA: reconhece a cena → funde vários quadros → otimiza de forma inteligente', 'Assistentes de voz: ouvir → entender → executar, três passos', 'IA no aparelho: rápida, privada, funciona offline', 'Grandes modelos de IA cobrem conversa/escrita/tradução/imagem/estudo', 'Usos típicos: tradução ao vivo, borracha de IA, retoque de IA, trabalho com documentos, busca de imagens com IA', 'Framework de prompts CRISPE: papel + pedido + contexto + saída + tom + exemplos', 'Com IA, cuidado com alucinações e vazamentos de privacidade', '“Papel-Contexto-Tarefa-Restrições” é um caminho mais fácil para começar com prompts', 'Traços de um bom prompt: específico, com contexto, com formato, com restrições, verificável'],
 'di-er-shi-san-zhang': ['Elementos da automação: gatilho + ação + lógica de decisão opcional', 'Atalhos do iOS: rotina de bom-dia num toque, economia automática, despesas registradas por leitura de código', 'Android: clicadores automáticos (macros de tela), Tasker (a automação mais poderosa), MacroDroid (amigável a iniciantes)', 'Armadilhas: gatilhos de localização imprecisos, iOS não roda em automático sem confirmação manual, Tasker exige permissão de acessibilidade', 'Mentalidade de automação: transforme tarefas repetitivas em condição → ação, e o celular vira seu assistente pessoal'],
 'di-er-shi-si-zhang': ['O Bootloader é o porteiro da inicialização; a verificação de assinatura impede adulteração', 'Políticas de desbloqueio BL variam por marca (Xiaomi permite/Huawei bloqueia)', 'Opções de root: Magisk/KernelSU/SuperSU', 'Três tipos de flash: ROM oficial/Recovery de terceiros/ROM de terceiros'],
 'di-er-shi-wu-zhang': ['Vender o celular antigo: primeiro backup → saia das contas → apagar criptografado → preencher e apagar de novo', 'Herança digital: Contato legado do iCloud/Conta inativa do Google', 'Reciclagem: prefira programas oficiais de trade-in; o celular velho ainda pode servir como câmera ou navegador'],
 'di-er-shi-liu-zhang': ['Três critérios do celular com IA: modelo grande no aparelho, potência da NPU em TOPS, AI Agent entre apps', 'Estratégias de IA dos fabricantes: Apple/Google/Huawei/Xiaomi/OPPO/vivo, cada um com seus pontos fortes', 'Satélite: as mensagens curtas do BeiDou chegaram à faixa intermediária, as ligações Tiantong seguem de topo de linha', 'Dobráveis: hardware maduro, apps adaptados uns 70%, hover/tela dividida são a experiência exclusiva', 'O 6G ainda vem chegando, o Wi-Fi 7 já pousou, o Bluetooth LE Audio começa a se espalhar', 'Baterias com anodo de silício-carbono tornam 5000-6000mAh padrão nos topo de linha'],
 'di-er-shi-qi-zhang': ['Primeiro ative o modo fácil ou aumente fontes/ícones: com o ambiente ajustado, metade dos problemas desaparece', 'Três regras de ferro com os mais velhos: não apresse, use analogias, escreva', 'Seis golpes comuns para avisar sempre de novo; três linhas de defesa barram 90% das fraudes', 'A assistência remota permite consertar o celular dos pais mesmo de outra cidade', 'Modo cuidado do WeChat + entrada por voz: as duas funções mais úteis para os mais velhos', 'Chamada SOS e detecção de queda: configurações que salvam vidas na hora crítica'],
 'di-er-shi-ba-zhang': ['Escolha do celular em três passos: primeiro as necessidades → depois o orçamento → por fim o modelo', 'Só cinco parâmetros importam: processador, tela, câmera, bateria e carregamento, promessa de atualizações', '¥1500-3500 é a faixa de melhor custo-benefício, a mais recomendada', 'O topo de linha do ano passado rende mais que o intermediário deste ano', 'Cinco armadilhas: mito das multicâmeras, culto aos megapixels, edições da operadora, culto às telas curvas, truques de IA', '618 e Double 11 são as duas melhores janelas do ano para comprar um celular'],
 'di-er-shi-jiu-zhang': ['Primeiro olhe os dados de tempo de tela; enxergar a realidade é o primeiro passo para mudar', 'Limites para apps de diversão e horários para Não perturbe: recupere sua atenção', 'A regra 20-20-20 é o hábito mais simples e eficaz para os olhos', 'Olhar para o celular sobrecarrega o pescoço com 5-6 vezes o peso da cabeça; erga o aparelho e movimente o pescoço', 'Uma hora antes de dormir, sem celular; deixe o carregador fora do alcance do braço', 'O antídoto à ansiedade de informação é “bloquear ativamente”, não “receber mais”'],
 'di-san-shi-zhang': ['Três campos da transmissão sem fio: AirPlay (Apple), Miracast (Android), DLNA (envio de mídia multiplataforma)', 'Transmissão por cabo é mais estável e com lag zero; na sala de reunião não pode faltar o adaptador HDMI', 'Samsung DeX/modo desktop da Huawei transformam o celular num PC leve de escritório', 'Conexão no carro: quatro soluções - CarPlay/Android Auto/HiCar/CarLife', 'Regras da transmissão na sala de reunião: teste antes, prepare o plano B, oculte a prévia das notificações'],
 'di-san-shi-yi-zhang': ['Antes de gravar, deixe claro: quem é o público, que valor você entrega, em que plataforma vai postar', 'Cinco coisas antes de gravar: 1080P/30fps, limpe a lente, trave foco e exposição, escolha a orientação, ative a grade', 'Cinco movimentos de câmera: aproximar, afastar, girar, deslocar, seguir - estabilidade em primeiro lugar', 'Edição no CapCut: corte → transições → legendas → BGM → exportação, em seis passos', 'Os primeiros 3 segundos decidem tudo; um vídeo conta uma história só; constância vale mais que talento'],
 'di-san-shi-er-zhang': ['Celular perdido, 30 minutos de ouro: peça um celular emprestado e ligue para si → bloqueio remoto → bloqueio do SIM → congelar pagamentos → avisar família e amigos → boletim de ocorrência', '72 horas após o golpe: pare transferências → guarde as provas → ligue 96110 → registre boletim → fale com o banco → troque as senhas', 'Celular infectado: modo de segurança → desinstale apps suspeitos → varredura de segurança → restauração de fábrica (último recurso)', 'Conta roubada: troque a senha → deslogue nos dispositivos → confira histórico de login → ative o 2FA → revise vínculos → revise pagamentos', '99,9% das mensagens de resgate são golpes: não responda, não pague, tire print e bloqueie', 'Golpes com rosto/voz clonados: procure falhas em piscadas, boca, contornos e luz; peça para virar a cabeça, cobrir o rosto, faça perguntas pessoais, retorne para um número já conhecido', 'Sequestro de SIM: se o celular mostra de repente “Sem serviço”, é alerta; defina PIN do SIM, ative a segunda verificação da operadora, passe as contas-chave para apps autenticadores', 'Cinco hábitos diários: bloqueio de tela + 2FA, Encontrar o celular, PIN do SIM, nada de apps desconhecidos, backups regulares', 'Terremoto/clima extremo: primeiro abrigue-se perto, depois evacue; um SMS gasta menos bateria que uma ligação longa', 'Sem sinal, prefira o SOS via satélite (se o modelo suporta); alertas e configurações no Capítulo 13'],
 'di-san-shi-san-zhang': ['Vision Pro e óculos AR são novas portas de computação além do celular, mas não o substituirão em breve', 'As interfaces cérebro-computador estão a 10-20 anos do consumidor; a ética amadurece antes da tecnologia', 'O celular evolui para a “invisibilidade”: do centro no dispositivo ao centro na identidade', 'Ética da IA, soberania de dados e divisão digital são os temas centrais da próxima década', 'Estar conectado e continuar independente: a filosofia imutável da vida digital'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // Pula capítulos que já têm resumo embutido, para não duplicar
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== Botão de copiar (adicionado aos elementos kbd) =====
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

 // ===== Conteúdo longo recolhível (nível h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // Só recolhe seções h4 longas
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // Adiciona o cabeçalho recolhível
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

 // ===== Painel de aprendizado: progresso de leitura + autodiagnóstico do celular =====
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
 // Progresso de leitura
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // Contagem de favoritos
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // Último capítulo
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // Autodiagnóstico de saúde
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'Nota máxima! A segurança do seu celular está em ótimo estado';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'Boa! ' + (totalChecks - checked) + ' itens ainda para melhorar';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'Na média - priorize os itens de segurança ainda não marcados';
 else healthMsgEl.innerHTML = 'Seu celular tem brechas de segurança - corrija o quanto antes';
 }
 }

 // Restaura os estados das marcações
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // Atualiza a cada 3 segundos (captura as marcações dos capítulos)
 setInterval(updateDashboard, 3000);

 // ===== Leitura em voz alta (TTS) =====
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
 // Clona e remove os elementos que não devem ser lidos em voz alta
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // Remove os corpos recolhidos mas mantém o texto deles
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('Desculpe, seu navegador não suporta leitura em voz alta. Tente Chrome ou Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'Capítulo sem título';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'pt-BR';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // Tenta usar uma voz em português mais natural
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('pt'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // Lê automaticamente o próximo capítulo
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
 // Encontra o capítulo visível no momento
 if (ttsSectionIndex < 0) {
 // Começa do início ou do capítulo mais próximo da posição de rolagem
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
 ttsLabel.textContent = 'Não iniciado';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // Ligação dos eventos
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
 // Recria e reproduz a seção atual
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

 // Atalho: a tecla R alterna a leitura em voz alta
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

 // ===== Inicialização =====
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

