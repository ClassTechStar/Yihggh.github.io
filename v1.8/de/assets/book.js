
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

 // ===== Thema =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln';
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

 // ===== Scrollen: Fortschritt + Schatten + nach oben + Inhaltsfortschritt + Fortschrittsring =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} Kapitel`;

 // Parameter des Fortschrittsrings
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

 // Fortschrittsring aktualisieren
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

 // Bis zu welchem Kapitel gelesen wurde
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} Kapitel`;
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

 // ===== Gedächtnis der Leseposition =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // Zu früh zum Speichern
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // Den Namen des aktuellen Kapitels finden
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

 // Position beim Laden der Seite wiederherstellen
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
 restoreToastText.textContent = `Zuletzt gelesen: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // Automatisch nach 10 Sekunden ausblenden
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

 // ===== Einblende-Animation beim Scrollen =====
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
 // Inhalt des ersten Bildschirms ist direkt sichtbar
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== Seitenleiste öffnen/schließen =====
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

 // Schnellwerkzeuge: Inhaltsverzeichnis öffnen
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== Globale Anker-Navigation: Versatz der festen Leiste ausgleichen =====
 // Es muss scrollIntoView verwendet werden statt manueller Koordinaten: .content-section hat
 // content-visibility:auto + contain-intrinsic-size(0 800px): Kapitel außerhalb des Bildschirms
 // belegen 800px-Platzhalter, getBoundingClientRect liefert die Platzhalterkoordinaten, und ein direktes scrollTo
 // an der falschen Stelle landen (je weiter hinten das Kapitel, desto größer die Abweichung). scrollIntoView überlässt es dem Browser,
 // rendert das Ziel bei Bedarf und positioniert es, und html{scroll-padding-top:5rem} gleicht die feste Leiste aus
 // Leiste.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // Schritt 1: Der Modus instant erzwingt zuerst das Rendern des Zielkapitels und positioniert es, damit content-visibility
 // Verschiebung beim sanften Scrollen durch verzögertes Rendern.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // Schritt 2: Sobald das Ziel gerendert ist und die Koordinaten stabil, startet ein sanfter Scroll für ein geschmeidiges Gefühl.
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

 // ===== Inhaltsverzeichnis einklappen =====
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

 // ===== Inhaltsverzeichnis filtern =====
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

 // ===== Im Inhaltsverzeichnis hervorheben =====
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

 // ===== Lesezeichen-System =====
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

 // Jedes Kapitel bekommt eine Lesezeichen-Schaltfläche
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'In den Lesezeichen' : 'Lesezeichen') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'Aus den Lesezeichen entfernen' : 'Kapitel zu den Lesezeichen hinzufügen');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'In den Lesezeichen' : 'Lesezeichen';
 btn.setAttribute('aria-label', added ? 'Aus den Lesezeichen entfernen' : 'Kapitel zu den Lesezeichen hinzufügen');
 // Marken der Seitenleiste aktualisieren
 updateTocBookmark(id, added);
 });
 // Nach der h3 einfügen
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // Lesezeichen-Marken der Seitenleiste initialisieren
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== Lese-Häkchen der Kapitel =====
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
 // Meta-Zeile oder das Element vor der h3 finden
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'Gelesen' : 'Gelesen') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'Markierung zurücknehmen' : 'Als gelesen markieren');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'Gelesen' : 'Gelesen';
 check.setAttribute('aria-label', done ? 'Markierung zurücknehmen' : 'Als gelesen markieren');
 // Seitenleiste aktualisieren
 updateTocCompleted(id, done);
 // Lesefortschritt aktualisieren
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
 // Aktualisiert auch die Zählanzeige der gelesenen Kapitel
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} Kapitel`;
 }
 }

 // ===== Suche (erweitert: Tastaturnavigation + Ergebniszähler) =====
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
 renderSearchPlaceholder('Stichwörter eingeben, um zu suchen');
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
 renderSearchPlaceholder('Keine Treffer');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">${results.length} Ergebnisse gefunden</div>`;
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
 renderSearchPlaceholder('Stichwörter eingeben, um zu suchen');
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

 // Tastaturnavigation der Suche
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

 // ===== Schriftgröße =====
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

 // ===== Seitenleiste per Wisch schließen =====
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

 // ===== Kapitel-Navigation =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'Vorheriges Kapitel'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'Nächstes Kapitel'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== Drucken =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== Globale Tastenkürzel =====
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

 // Fenster beim Klick auf den Schleier schließen
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
 // Das Drucken übernimmt der Browser selbst
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

 // ===== Verfolgung der Lesetage in Folge =====
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

 // Serien-Toast anzeigen
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 Tag ' + streak + ' Lesen in Folge. Bleib dran!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage könnte nicht verfügbar sein */ }
 }
 updateStreak();

 // ===== Backup/Wiederherstellung =====
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
 // Zustände der Selbstprüfung einsammeln
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // Lesezustände der Kapitel einsammeln
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // Lesezeichen einsammeln
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // Bewertungen einsammeln
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'PhoneClass-Lese-Backup_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('Backup-Export fehlgeschlagen: ' + e.message);
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
 // Zustände der Selbstprüfung wiederherstellen
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // Lesezustände der Kapitel wiederherstellen
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
 // Lesezeichen wiederherstellen
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('Wiederherstellung erfolgreich! Die Seite lädt neu, um alle Daten anzuwenden.');
 location.reload();
 } catch(err) {
 alert('Wiederherstellung fehlgeschlagen: falsches Dateiformat. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('Alle Lesedaten löschen? Das kann nicht rückgängig gemacht werden! Zuerst ein Backup exportieren.')) return;
 if (!confirm('Nochmals bestätigen: gesamter Lesefortschritt, Lesezeichen und Bewertungen werden gelöscht. Fortfahren?')) return;
 localStorage.clear();
 alert('Alle Daten gelöscht. Die Seite lädt neu.');
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

 // ===== Bewertungssystem der Kapitel =====
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
 // Nach der h3 einfügen
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== Scroll-Entprell-Optimierung =====
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

 // ===== Dem dunklen Systemmodus folgen =====
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

 // ===== Kapiteltiteln automatisch Brotkrumen und Schwierigkeitslabels hinzufügen =====
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
 
 ${level === 'beginner' ? 'Einsteiger' : level === 'intermediate' ? 'Fortgeschritten' : 'Profi'}
 </span>
 <span class="reading-time">
 ~${minutes} Min. Lesezeit
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== Kapiteln einen „Merksatz“-Block hinzufügen =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">Merksatz</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['Faltbare sind ausgereift, aber nicht Mainstream: ein „Draufgabe“-Gerät, kein „Rettungsanker“', 'Quer gefaltet = Handy + Tablet; längs gefaltet = Hosentasche + Blick aufs Außendisplay', 'Geeignet für: intensives Lesen/Business/Kreatives im Hover/Frauen, die Mobilität schätzen', 'Sechs Prüfpunkte beim Kauf: Scharniertyp, UTG-Innendisplay, Falz, Größe des Außendisplays, Gewicht und Dicke, Reparaturpreis nach Garantie', 'Exklusive Spielereien: Split-Screen-Multitasking, 90-Grad-Hover, Blick aufs Außendisplay, PC-Modus', 'Pflegekern: bei Kälte nicht öffnen und schließen, vor Fremdkörpern schützen, kein normales Schutzglas aufs Innendisplay, Scharnier staubfrei halten', 'Erwartungen: die Falz bleibt für immer, schwerer und dicker, durchschnittliche Akkulaufzeit, geringer Wiederverkaufswert, teure Reparaturen', 'Kaufphilosophie: Man kauft es wegen seiner einzigartigen Form, nicht weil es „fortschrittlicher“ wäre'],
 'di-ling-zhang': ['Die Position des Buchs verstehen: eine klare, hands-on Tech-Einführung zum Mitmachen', 'Beherrsche das Symbolsystem: was [Tasten], >, Fett und Kursiv bedeuten', 'Warum der Telefonspeicher „schrumpft“: die Hauptgründe', 'Gewohnheit entwickeln: die Specs des eigenen Handys aufschreiben', 'Handy = Tresor digitaler Werte; Vorsorge zuerst ist die Kernidee', 'Daten sind oft mehr wert als die Hardware selbst'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + Modem und weitere Module auf einem Chip', 'Große und kleine CPU-Kerne arbeiten zusammen: Leistung und Akku im Gleichgewicht', 'Display: OLED/LCD, Bildwiederholrate, automatische Helligkeit', 'Kern der Bildkette: Sensorgröße zählt mehr als die Megapixelzahl', 'Anschluss-Evolution: Micro USB → Lightning → einheitlich USB-C', '5G-A bringt die neue Fähigkeit der „Vereinigung von Kommunikation und Sensorik“'],
 'di-yi-zhang-harmony': ['HarmonyOS = ein verteiltes Betriebssystem, von Anfang an auf viele Geräte ausgelegt', 'HarmonyOS 4.3 ist AOSP-kompatibel und kann Android-Apps ausführen', 'HarmonyOS NEXT ist vollkommen eigenständig und unterstützt keine Android-Apps mehr', 'Vor dem Upgrade vergewissern, dass die häufig genutzten Apps native Versionen haben'],
 'di-er-zhang': ['Dreistufiger Speicher: Gerät / SD-Karte / Cloud', 'Was gängige Android-Ordner bedeuten (DCIM, Download usw.)', 'Daten-Backup = Cloud-Backup + lokales Backup, doppelt abgesichert', 'Löschen ist nicht zerstören; nur „Überschreiben“ löscht wirklich', 'Schnellreferenz gängiger Dateiformate (Bild/Audio/Video/Dokument)', '„Datum + Ereignis“ als Name ist die Grundkonvention', 'Die 72-Stunden-Autoräumung löst den Cache-Stau der Sozial-Apps', 'Doppelschutz für Fotos: Verpixeln + EXIF-Strippen'],
 'di-san-zhang': ['4G/5G haben je ihren Platz; 5G-A ist die erweiterte Version', 'Zentrale technische Unterschiede von Wi-Fi 6/6E/7', 'Öffentliches WLAN verlangt Wachsamkeit: keine sensiblen Daten eingeben', 'Bluetooth 5.x entwickelt sich weiter, LE Audio beginnt sich zu verbreiten', 'NFC arbeitet bis 10cm: die physische Nähe ist die Sicherheitsgarantie'],
 'di-si-zhang': ['Apps zuerst aus den offiziellen Stores installieren', 'Ein APK-Paket = Zertifikat + Ressourcen + Konfiguration + Binärcode', 'Vorsicht bei „Putz-Beschleuniger“-Apps; dass Apps im Hintergrund bleiben, kann legitim sein', 'App-Signaturprüfung verhindert Manipulation: Schutz auf Systemebene', 'Reiner Modus = Installationen nur aus dem offiziellen Store: die erste Mauer gegen Schadsoftware', '„Digitale Parasiten“ meint geknackte Software mit Trojanern im Bauch', 'Prüfmechanismus der App-Stores: Virenscan + Berechtigungsprüfung + Entwicklerverifikation'],
 'di-wu-zhang': ['Display: Auflösung, Wiederholrate, automatische Helligkeit', 'Ton: Klingel-/Media-/Benachrichtigungslautstärke getrennt regeln', 'Speicher: Cache und unnötige Dateien regelmäßig leeren', 'Biometrie: Fingerabdruck gegen Gesicht; 3D schlägt 2D bei der Sicherheit', 'Screenreader: VoiceOver auf iOS / TalkBack auf Android sind die Augen sehbehinderter Nutzer', 'Vergrößerung: hoher Kontrast, fetter Text, Farbfilter - das Trio', 'KI-Bildbeschreibung: die KI liest Bilder, Speisekarten und Captchas für dich', 'Live-Untertitel: eine Rettung für Hörgeschädigte und laute Umgebungen', 'RTT/TTY: Menschen ohne Stimme oder Gehör können trotzdem telefonieren'],
 'di-liu-zhang': ['Sperrbildschirm-Passwort + Zwei-Faktor sind die Grundlinie der Verteidigung', 'App-Berechtigungen: nach Bedarf einschalten, Minimalprinzip', 'Keine Zahlungen oder Logins im öffentlichen WLAN', 'Im KI-Zeitalter ist Sehen nicht Glauben: geklonte Gesichter und Stimmen, falsche Autorität, falsche Anlagen sind die häufigsten Maschen', 'Ausweg-Plan: Handlungsprüfung + Geheimwort + zweite Bestätigung', 'Vor dem Teilen anonymisieren: Standort und Geräteinfos in den EXIF deaktivieren', 'IoT-Geräte: Standardpasswort ändern', 'Im Betrugsfall merken: nicht leichtgläubig, nichts verraten, nichts überweisen'],
 'di-qi-zhang-jichu': ['Satellit: der „Rettungsanker“ im Notfall', 'Funk ohne Netz: Weitsprechfunk auch ohne Netzabdeckung', 'Unfallerkennung: Sensorfusion erkennt schwere Kollisionen', 'StarFlash: drahtlose Verbindung mit geringer Latenz und großem Potenzial'],
 'di-ba-zhang': ['Anrufaufzeichnung: die Rechtslage beachten', 'iMessage/RCS heben die klassische SMS zu Rich Media', 'Der WeChat-Chatverlauf braucht WeChats eigene Backup-Funktion', 'Mail-Apps verwalten mehrere Konten einheitlich', 'Spam-Blockierung: Systemerkennung + Schwarz-/Weißlisten + SMS-Schlüsselwortfilter', '„Unbekannte stummschalten“ auf iOS blockt den Ärger, aber Achtung vor verpassten Anrufen', 'Falsche Spam-Markierungen lassen sich über Dianhua Bang/360/Tencent und die Anbieterkanäle anfechten'],
 'di-jiu-zhang': ['WPS Office läuft in China am besten, Microsoft 365 hat die beste Kompatibilität', 'Notizen in drei Phasen: hingekritzelt → später lesen → Wissenssystem', 'Mit dem Handy scannen: Notizen/Mic Lens/Baimiao/CamScanner', 'Cloud nach Bedarf: iCloud/OneDrive/Baidu/Aliyun Drive, jedes mit eigenen Stärken'],
 'di-shi-zhang': ['Wer den Bezahlcode sieht, kassiert: niemals jemandem einen Screenshot davon schicken', '5-Minuten-Sicherheitscheck: biometrisches Bezahlen + Sicherheitsschloss + passwortlose Zahlungen prüfen + Geräteverwaltung', 'In Metro und Bus besser die virtuelle Verkehrskarte aus der Handy-Brieftasche: funktioniert auch offline', 'Elektronische Versicherungskarte, Rentenabfragen, Steuererklärung: alles vom Handy aus machbar', 'Vier Neins gegen Betrug: nie auf ein „sicheres Konto“ überweisen, nie den Bezahlcode schicken, nie unbekannte Links antippen, nie die Kartennummer preisgeben'],
 'di-shi-yi-zhang': ['Vier häufige Fehler: schmutzige Linse, unregulierte Belichtung, Flash-Übergebrauch, falsch eingesetzter Digitalzoom', 'Der Nachtmodus fusioniert mehrere Aufnahmen; 2-4 Sekunden ruhig halten', 'Pro-Modus: niedriges ISO heißt sauberes Bild; der Verschluss steuert das Licht', 'Nachbearbeitungs-Kette: begradigen → Grundkorrekturen → lokale Feinschliffe → stilisieren', 'Intelligente Suche + regelmäßiges Aufräumen + manuelle Alben = das Foto-Management-Trio'],
 'di-shi-yi-zhang-advanced': ['Die drei Säulen des Videos: Auflösung, Framerate, Bitrate', 'H.265 komprimiert 50 % besser als H.264', 'ProRes ist Apples professioneller Codec: riesige Dateien', 'HDR10/10+/Dolby Vision: jedes hat seine Nische'],
 'di-shi-er-zhang': ['NetEase Cloud Music ist stark bei Playlists und Community, QQ Music hat den größten Katalog, Apple Music ist schlicht und verlustfrei, Spotify empfiehlt stark', 'Xiaoyuzhou ist die erste Wahl für chinesischsprachige Podcasts; nutze Tempo und automatische Aufräumung', 'Lokale Videos: VLC (alle Formate) oder nPlayer (Gestensteuerung)', 'Markierungen in WeChat Read sind sozial + Kindle-Synchronisierung; Augenschutzmodus immer einschalten', 'Der Spielmodus sichert zuerst flüssige Frameraten; gegen Überhitzung hilft der Kühlclip'],
 'di-shi-san-zhang': ['Produktivitätswerkzeuge: To-dos + Pomodoro + Kalender', 'Gesundheit und Sport: Apple Health/Google Fit als Datenzentrale', 'Browser: zuerst Edge, zusammen mit Copilot für mehr Effizienz', 'Suche nach Wahrheit: offiziellen Domains vertrauen, billige Endungen wie .xyz meiden', 'Bevorzugt die Reinigung des Systems; Drittanbieter wie Qingzhuo sind nur Ergänzung, nie alles mit einem Wisch löschen', 'Anti-Belästigungs-Apps: Nationales Anti-Betrugs-Zentrum + Marken-Wächter + Netzbetreibersperre', 'Eingebauter Schutz: auf iOS „Unbekannte stummschalten“; auf Android in der Telefon-App jeder Marke aktivieren', 'Drei Schichten gemeinsam: Systemblockierung + Netzbetreiber + Anti-Betrugs-Zentrum; an die Whitelist denken, um Fehlalarme zu vermeiden', 'Wetterwarnungen: System-Wetter-App + offizielle Wetterkanäle; nach Blau/Gelb/Orange/Rot handeln', 'Warnungen vor Naturkatastrophen: Wetter + Katastrophenschutz; bei Starkregen und Taifun meide Senken und Werbetafeln', 'Erdbeben-Frühwarnung ist keine Vorhersage: Sekunden bis Zehnersekunden Vorlauf; auf Android meist in den Sicherheitseinstellungen', 'TickTick: Listen + Kalender + Pomodoro, Aufgaben in natürlicher Sprache', 'Papier scannen: Systemkamera/Mic Lens/Baimiao/CamScanner; scharf ablichten, dann OCR', 'PC-Fernsteuerung: Sunflower/ToDesk; lässt ein Fremder dich eine Fernsteuerung installieren = Betrug', 'KI im Büro: Trae und mehr; Schwerarbeit am Rechner, vom Handy aus aus der Ferne mitverfolgen', 'Schnellübertragung im lokalen Netz: LocalSend/AirDrop/Feige; Zwischenablage: KDE Connect/Hersteller-Tools', '2FA-Einmalcodes: Aegis/Microsoft Authenticator, Backup-Codes doppelt auf Papier'],
 'di-shi-si-zhang': ['Mit einem Passwort-Manager genügt ein Masterpasswort im Kopf', 'Bitwarden ist quelloffen und gratis, 1Password bietet das beste Erlebnis', 'Das Masterpasswort muss lang und komplex sein, mit aktivierter 2FA', 'Passwortsicherheit regelmäßig prüfen', 'Zero-Knowledge-Architektur: selbst der Anbieter sieht deine Passwörter nicht; die Verschlüsselung passiert lokal', 'AES-256 + Schlüsselableitung PBKDF2/Argon2 sind das Fundament der Sicherheit eines Passwort-Tresors', 'Die Lehre aus dem LastPass-Vorfall 2022: Nutzer mit schwachem Masterpasswort sind am stärksten gefährdet', 'Passwortstärke ist „Entropie“: Länge + Zufall schlagen komplizierte Symbole', 'HaveIBeenPwned prüft Leaks, 1Password Watchtower überwacht Vorfälle', 'Passkeys bauen auf FIDO2/WebAuthn: phishing-resistent, kein Passwort wird übertragen', 'Passkey-Geräteübergreifende Synchronisierung: iCloud-Schlüsselbund/Google Password Manager unterstützen sie schon', 'Hardware-Schlüssel (YubiKey/Titan) trotzen Phishing und SIM-Hijacking - ideal für besonders Betroffene', 'Gemeinsame 1Password-Tresore + Bitwarden-Notzugang machen Familie und Team sicherer'],
 'di-shi-wu-zhang': ['Lithium-Akkus: nach Bedarf laden, Hitze hassen, altern', 'Unter 80 % Akkugesundheit fällt die Laufzeit deutlich ab', 'Schnellladeprotokolle: PD/QC/VOOC/SuperCharge sind nicht austauschbar', 'Qi2-Drahtlosladen bringt magnetische Ausrichtung', 'Kern des Energiesparens: Helligkeit senken + Hintergrund schließen + auf 4G wechseln'],
 'di-shi-liu-zhang': ['Das Konto ist das Einwohnermeldeamt deines Digitallebens: verknüpft Kontakte, Fotos, Käufe und Handy suchen', 'Drei Pflichten: 2FA aktivieren, Wiederherstellungsschlüssel setzen, prüfen, dass Handy suchen an ist', 'Die 5GB iCloud reichen nicht: aufräumen oder auf 50GB für etwa ¥1/Monat wechseln', 'Synchronisierung ist zweiseitig (gelöscht hier, überall weg), Backup ein einseitiger Schnappschuss (gelöscht hier, dort bleibt es)', 'Android-Nutzer, getrennt prüfen: Cloud-Backup der Marke, Google-Backup, WeChat-Backup'],
 'di-shi-qi-zhang': ['Geräteübergreifendes Arbeiten: Apple AirDrop/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/Link zu Windows', 'Auf den TV übertragen: iPhone nutzt Bildschirmsynchronisierung, Android drahtlose Übertragung; klappt es nicht, prüfe das gemeinsame WLAN', 'Smartwatch = Benachrichtigungsfilter + Gesundheitsstation + Zahlung am Handgelenk; für die Eltern kann sie den Tag retten', 'Smart Home nach Ökosystem wählen: Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'Koppel-Sicherheit: in der Öffentlichkeit beim Streamen auf Privatsphäre achten, alte Geräte rechtzeitig entkoppeln'],
 'di-shi-ba-zhang': ['Voll-Backup: lokal am PC (am verlässlichsten) + Cloud (am sorgenfreisten), doppelt abgesichert', 'Der WeChat-Chatverlauf ist der Sonderfall: nur WeChats eigenes Backup trägt ihn, Umzugstools scheitern', '3-2-1-Backup-Regel: 3 Kopien, 2 Medien, 1 außer Haus', 'Handywechsel: gleiche Marke nutzt die offizielle Umzugs-App; markenübergreifend vorher einen Daten-Umstieg vorbereiten'],
 'di-shi-jiu-zhang': ['Ruckeln und Hitze in vier Schritten: Änderungen Revue passieren lassen → Speicher prüfen → Verbrauch prüfen → Signal prüfen', 'Routine bei App-Abstürzen: schließen und neu öffnen → aktualisieren → Berechtigungen prüfen → Cache leeren → neu installieren', 'Lädt nicht: erst die Buchse reinigen, dann Kabel und Netzteil kreuzweise tauschen, um den Schuldigen zu finden', 'Kein Netz: Flugmodus aus/ein → WLAN vergessen und neu verbinden → Router neu starten', 'Der Allround-Neustart löst die meisten seltsamen Probleme; zur Reparatur nur autorisierte Werkstätten, vorher Backup + Abmelden'],
 'di-er-shi-zhang-jinjie': ['Entwicklermodus: siebenmal auf die Build-Nummer tippen zum Einschalten', 'BL-Sperre: Herstellerschutz; nur vorsichtig entsperren', 'Root: das Risiko überwiegt den Nutzen; für normale Nutzer nicht empfohlen', 'Magisk braucht weiterhin den entsperrten BL, kann den Root-Status aber verbergen'],
 'di-er-shi-yi-zhang': ['VPN = verschlüsselter Tunnel; ein Gratis-VPN kann selbst deine Daten stehlen', 'Schutz vor Man-in-the-Middle im öffentlichen WLAN: HTTPS vertrauen, Auto-Connect aus, heikles nur über mobile Daten', 'Der HTTPS-Handshake verschlüsselt in vier Durchläufen, doch auch Phishing-Seiten nutzen HTTPS', 'DoH/DoT verschlüsseln DNS-Anfragen: der Anbieter späht deine Surfrouten nicht mehr aus', 'Inkognito = lokaler Radiergummi, kein Tarnumhang: Anbieter und Websites sehen dich weiterhin', 'Sicherheitscheckliste: automatisches WLAN abschalten, auf verschlüsseltes DNS wechseln, 2FA aktivieren, App-Berechtigungen prüfen, Juice Jacking blockieren'],
 'di-er-shi-er-zhang': ['KI-Kamera: Szene erkennen → mehrere Aufnahmen fusionieren → intelligent optimieren', 'Sprachassistenten: hören → verstehen → ausführen, drei Schritte', 'KI auf dem Gerät: schnell, privat, funktioniert offline', 'Große KI-Modelle decken Chat/Schreiben/Übersetzen/Bilder/Lernen ab', 'Typische Anwendungen: Live-Übersetzung, KI-Radierer, KI-Bildbearbeitung, Dokumentenarbeit, KI-Bildersuche', 'CRISPE-Prompt-Framework: Rolle + Anfrage + Kontext + Ausgabe + Ton + Beispiele', 'Mit KI auf Halluzinationen und Datenschutzlecks achten', '„Rolle-Kontext-Aufgabe-Grenzen“ ist der leichtere Einstieg ins Prompt-Schreiben', 'Merkmale eines guten Prompts: konkret, mit Kontext, mit Format, mit Grenzen, überprüfbar'],
 'di-er-shi-san-zhang': ['Bausteine der Automatisierung: Auslöser + Aktion + optionale Entscheidungslogik', 'iOS-Kurzbefehle: Morgens eins Gute-Morgen-Ritual, automatischer Stromsparmodus, Ausgaben per Scan erfassen', 'Android: Auto-Klicker (Bildschirm-Makros), Tasker (die mächtigste Automatisierung), MacroDroid (einsteigerfreundlich)', 'Stolperfallen: ungenaue Standort-Trigger, iOS läuft nicht automatisch ohne manuelle Bestätigung, Tasker braucht die Bedienungshilfen-Berechtigung', 'Automatisierungs-Denke: wiederkehrende Arbeit in Bedingung → Aktion verwandeln, und das Handy wird dein persönlicher Assistent'],
 'di-er-shi-si-zhang': ['Der Bootloader ist der Türsteher beim Start; die Signaturprüfung verhindert Manipulation', 'BL-Entsperr-Politiken unterscheiden sich je Marke (Xiaomi erlaubt/Huawei sperrt)', 'Root-Varianten: Magisk/KernelSU/SuperSU', 'Drei Flash-Arten: offizielle ROM/Recovery von Drittanbietern/ROM von Drittanbietern'],
 'di-er-shi-wu-zhang': ['Altes Handy verkaufen: erst Backup → abmelden → verschlüsselt löschen → füllen und erneut löschen', 'Digitales Erbe: iCloud-Legacy-Kontakt/Google-Konto für Inaktivität', 'Recycling: zuerst offizielle Rückkaufprogramme; das alte Handy kann Kamera oder Navi spielen'],
 'di-er-shi-liu-zhang': ['Drei Standards für KI-Handys: großes Modell auf dem Gerät, NPU-Leistung in TOPS, AI Agent über Apps hinweg', 'KI-Strategien der Hersteller: Apple/Google/Huawei/Xiaomi/OPPO/vivo, jeder mit eigenen Stärken', 'Satellit: BeiDou-Kurznachrichten sind in der Mittelklasse angekommen, Tiantong-Anrufe bleiben den Flaggschiffen vorbehalten', 'Faltbare: Hardware ausgereift, Apps zu rund 70 % angepasst, Hover/Split-Screen ist das Alleinstellungsmerkmal', '6G ist noch unterwegs, WLAN 7 ist da, Bluetooth LE Audio beginnt sich zu verbreiten', 'Silizium-Kohlenstoff-Anoden machen 5000-6000mAh zum Standard bei Flaggschiffen'],
 'di-er-shi-qi-zhang': ['Zuerst den einfachen Modus einschalten oder Schrift/Symbole vergrößern: passt die Umgebung, halbiert das die Probleme', 'Drei eiserne Regeln mit Älteren: nicht drängen, mit Analogien erklären, aufschreiben', 'Sechs häufige Betrugsmaschen, die man immer wieder warnen muss; drei Verteidigungslinien stoppen 90 % des Betrugs', 'Fernhilfe erlaubt es, das Handy der Eltern auch aus einer anderen Stadt zu reparieren', 'WeChat-Fürsorgemodus + Spracheingabe: die zwei nützlichsten Funktionen für Ältere', 'SOS-Notruf und Sturzerkennung: Einstellungen, die im entscheidenden Moment Leben retten'],
 'di-er-shi-ba-zhang': ['Handywahl in drei Schritten: erst die Bedürfnisse → dann das Budget → zuletzt das Modell', 'Nur fünf Kernparameter: Prozessor, Display, Kamera, Akku und Laden, Update-Versprechen', '¥1500-3500 ist die günstigste und empfehlenswerteste „Sweet Spot“-Zone', 'Letztjahres-Flaggschiff schlägt diesjähriges Mittelklasse beim Preis-Leistungs-Verhältnis', 'Fünf Fallen: Multikamera-Schein, Megapixel-Kult, Netzbetreiber-Versionen, Curved-Display-Glaube, KI-Gimmicks', '618 und Double 11 sind die zwei besten Kauf-Zeitfenster des Jahres für ein Handy'],
 'di-er-shi-jiu-zhang': ['Zuerst die Bildschirmzeit-Daten ansehen: die Lage klar sehen ist der erste Schritt zur Änderung', 'Unterhaltungs-Apps begrenzen, Zeiten für Nicht stören setzen - und die Aufmerksamkeit zurückholen', 'Die 20-20-20-Regel ist die einfachste wirksame Gewohnheit für müde Augen', 'Beim Blick aufs Handy trägt der Nacken das 5-6-fache Kopfgewicht; Handy höher halten und Nacken bewegen', 'Die Stunde vor dem Schlafen ohne Handy; das Ladegerät außer Reichweite legen', 'Das Gegenmittel gegen Informationsangst ist „aktiv blockieren“, nicht „mehr bekommen“'],
 'di-san-shi-zhang': ['Drei Lager des drahtlosen Streamens: AirPlay (Apple), Miracast (Android), DLNA (plattformübergreifender Medienversand)', 'Kabelgebundenes Streamen ist stabiler und ohne Latenz; im Konferenzraum gehört der HDMI-Adapter zur Grundausstattung', 'Samsung DeX/Huawei-Desktopmodus machen aus dem Handy einen leichten Büro-PC', 'Auto-Anbindung: vier Lösungen - CarPlay/Android Auto/HiCar/CarLife', 'Regeln fürs Besprechen im Konferenzraum: vorher testen, Plan B bereithalten, Benachrichtigungsvorschau ausblenden'],
 'di-san-shi-yi-zhang': ['Vor dem Dreh klären: Wer ist das Publikum, welchen Wert liefert ihr, auf welcher Plattform postet ihr', 'Fünf Dinge vor dem Dreh: 1080P/30fps, Linse reinigen, Fokus und Belichtung fixieren, Ausrichtung wählen, Raster einschalten', 'Fünf Kamerafahrten: heranzoomen, herauszoomen, schwenken, verschieben, folgen - Stabilität zuerst', 'Schnitt mit CapCut: Zuschnitt → Übergänge → Untertitel → BGM → Export, in sechs Schritten', 'Die ersten 3 Sekunden entscheiden alles; ein Video, eine Botschaft; Beharrlichkeit schlägt Talent'],
 'di-san-shi-er-zhang': ['Handy verloren, goldene 30 Minuten: Leihhandy nehmen und sich selbst anrufen → Fernsperre → SIM sperren → Zahlungen einfrieren → Angehörige informieren → Anzeige erstatten', '72 Stunden nach dem Betrug: Überweisungen stoppen → Beweise sichern → 96110 anrufen → Anzeige erstatten → Bank kontaktieren → Passwörter ändern', 'Handy infiziert: abgesicherter Modus → verdächtige Apps deinstallieren → Sicherheitsscan → Werkseinstellung (letzter Ausweg)', 'Konto gestohlen: Passwort ändern → Geräte abmelden → Login-Verlauf prüfen → 2FA aktivieren → Verknüpfungen prüfen → Zahlungen prüfen', '99,9 % der Lösegeldforderungen sind Betrug: nicht antworten, nicht zahlen, Screenshot und Block', 'Betrug mit geklontem Gesicht/gespeicherter Stimme: Achte auf Schwächen bei Blinzeln, Mund, Kanten und Licht; bitte um Kopfdrehen, verdecktes Gesicht, stelle persönliche Fragen, ruf über eine bekannte Nummer zurück', 'SIM-Hijacking: Zeigt das Handy plötzlich „Kein Dienst“, ist Alarm angesagt; SIM-PIN setzen, Zweitprüfung des Anbieters aktivieren, zentrale Konten auf Authenticator-Apps umstellen', 'Fünf tägliche Gewohnheiten: Displaysperre + 2FA, Handy suchen, SIM-PIN, keine unbekannten Apps, regelmäßige Backups', 'Erdbeben/Extremwetter: erst in der Nähe in Sicherheit, dann evakuieren; eine SMS spart mehr Akku als ein langes Telefonat', 'Ohne Signal zuerst SOS per Satellit (sofern das Modell es unterstützt); Warnungen und Einstellungen in Kapitel 13'],
 'di-san-shi-san-zhang': ['Vision Pro und AR-Brillen sind neue Rechnereingänge jenseits des Handys, aber sie ersetzen es nicht so bald', 'Gehirn-Computer-Schnittstellen sind noch 10-20 Jahre vom Verbraucher entfernt; die Ethik reift vor der Technik', 'Das Handy entwickelt sich zur „Unsichtbarkeit“: vom Geräte-Zentrum zum Identitäts-Zentrum', 'KI-Ethik, Datensouveränität und digitale Kluft sind die Kernthemen des nächsten Jahrzehnts', 'Verbunden bleiben und unabhängig bleiben: die unveränderliche Philosophie des Digitallebens'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // Kapitel mit eingebautem Merkzettel überspringen, um Duplikate zu vermeiden
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== Kopier-Schaltfläche (an kbd-Elemente angehängt) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'Kopieren');
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

 // ===== Einklappbarer langer Inhalt (h4-Ebene) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // Nur lange h4-Abschnitte einklappen
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // Einklapp-Kopfzeile hinzufügen
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

 // ===== Lern-Dashboard: Lesefortschritt + Handy-Gesundheitscheck =====
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
 // Lesefortschritt
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // Lesezeichen-Zähler
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // Letztes Kapitel
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // Gesundheitscheck
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'Volle Punktzahl! Die Sicherheit deines Handys ist top';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'Gut! ' + (totalChecks - checked) + ' Punkte noch zu verbessern';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'Ausreichend: zuerst die ungehakten Sicherheitspunkte angehen';
 else healthMsgEl.innerHTML = 'Dein Handy hat Sicherheitslücken - bitte bald schließen';
 }
 }

 // Häkchen-Zustände wiederherstellen
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // Aktualisiert alle 3 Sekunden (erfasst Kapitel-Häkchen)
 setInterval(updateDashboard, 3000);

 // ===== Sprachausgabe (TTS) =====
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
 // Klonen und Elemente entfernen, die nicht vorgelesen werden sollen
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // Eingeklappte Körper entfernen, ihren Text behalten
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('Entschuldigung, dein Browser unterstützt keine Sprachausgabe. Nimm Chrome oder Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'Kapitel ohne Titel';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'de-DE';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // Versucht, eine natürlichere deutsche Stimme zu nutzen
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('de'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // Nächstes Kapitel automatisch vorlesen
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
 // Das gerade sichtbare Kapitel finden
 if (ttsSectionIndex < 0) {
 // Startet am Anfang oder beim Kapitel, das der Scrollposition am nächsten ist
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
 ttsLabel.textContent = 'Nicht begonnen';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // Ereignisse verknüpfen
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
 // Aktuelle Sektion neu erzeugen und abspielen
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

 // Tastenkürzel: R schaltet die Sprachausgabe um
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

 // ===== Initialisierung =====
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

