
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
 const nextLabel = isDark ? 'Tukar ke mod cerah' : 'Tukar ke mod gelap';
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

 // ===== Tatalan: kemajuan + bayang + kembali ke atas + kemajuan isi kandungan + cincin kemajuan =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} bab`;

 // Parameter cincin kemajuan
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

 // Kemas kini cincin kemajuan
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

 // Sudah baca sampai bab mana
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} bab`;
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

 // ===== Ingatan kedudukan bacaan =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // Terlalu awal untuk simpan
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // Cari nama bab semasa
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

 // Pulihkan kedudukan semasa halaman dimuat
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
 restoreToastText.textContent = `Bacaan terakhir: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // Sorok automatik selepas 10 saat
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

 // ===== Animasi masuk semasa tatalan =====
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
 // Kandungan skrin pertama terus ditanda kelihatan
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== Buka/tutup bar sisi =====
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

 // Perkakas pantas: buka isi kandungan
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== Navigasi sauh global: mengimbangi anjakan bar tetap =====
 // Wajib guna scrollIntoView, bukan mengira koordinat sendiri: .content-section ditetapkan
 // content-visibility:auto + contain-intrinsic-size(0 800px): bab di luar skrin
 // menggunakan pemegang tempat 800px, getBoundingClientRect memulangkan koordinat pemegang tempat, dan scrollTo terus
 // akan mendarat di posisi salah (makin ke belakang bab, makin besar sisihan terkumpul). scrollIntoView menyerahkan kepada pelayar
 // memaparkan sasaran atas permintaan dan meletakkan posisinya, dan html{scroll-padding-top:5rem} mengimbangi bar tetap
 // tetap.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // Langkah 1: mod instant memaksa paparan bab sasaran dan meletakkan posisinya dahulu, supaya content-visibility tidak
 // sisihan semasa tatalan halus akibat paparan tertunda.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // Langkah 2: selepas sasaran dipaparkan dan koordinat stabil, barulah picu tatalan halus untuk pengalaman lancar.
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

 // ===== Melipat isi kandungan =====
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

 // ===== Menapis isi kandungan =====
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

 // ===== Menonjolkan dalam isi kandungan =====
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

 // ===== Sistem penanda =====
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

 // Tambah butang penanda pada setiap bab
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'Dalam penanda' : 'Penanda') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'Buang daripada penanda' : 'Tambahkan bab ini ke penanda');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'Dalam penanda' : 'Penanda';
 btn.setAttribute('aria-label', added ? 'Buang daripada penanda' : 'Tambahkan bab ini ke penanda');
 // Kemas kini tanda dalam bar sisi
 updateTocBookmark(id, added);
 });
 // Sisip selepas h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // Mulakan tanda penanda dalam bar sisi
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== Tanda semak bab selesai dibaca =====
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
 // Cari baris meta atau elemen sebelum h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'Sudah dibaca' : 'Sudah dibaca') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'Batalkan tanda dibaca' : 'Tanda sebagai sudah dibaca');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'Sudah dibaca' : 'Sudah dibaca';
 check.setAttribute('aria-label', done ? 'Batalkan tanda dibaca' : 'Tanda sebagai sudah dibaca');
 // Kemas kini bar sisi
 updateTocCompleted(id, done);
 // Kemas kini kemajuan bacaan
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
 // Kemas kini pengira bab selesai juga
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} bab`;
 }
 }

 // ===== Carian (ditingkatkan: navigasi papan kekunci + pengira hasil) =====
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
 renderSearchPlaceholder('Taip kata kunci untuk mula mencari');
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
 renderSearchPlaceholder('Tiada hasil sepadan');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">${results.length} hasil ditemui</div>`;
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
 renderSearchPlaceholder('Taip kata kunci untuk mula mencari');
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

 // Navigasi carian dengan kekunci
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

 // ===== Saiz fon =====
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

 // ===== Menutup bar sisi dengan leretan =====
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

 // ===== Navigasi antara bab =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'Bab sebelumnya'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'Bab seterusnya'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== Cetak =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== Pintasan papan kekunci sejagat =====
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

 // Tutup tetingkap apabila menekan tabir
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
 // Pencetakan sudah diurus pelayar
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

 // ===== Penjejakan hari bacaan berturutan =====
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

 // Papar pemberitahuan hari berturutan
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 Hari ' + streak + ' bacaan berturutan. Teruskan usaha!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage mungkin tidak tersedia */ }
 }
 updateStreak();

 // ===== Sandaran/pemulihan =====
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
 // Kumpul status semakan kesihatan
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // Kumpul status bab selesai dibaca
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // Kumpul penanda
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // Kumpul penilaian
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'Sandaran-Bacaan-PhoneClass_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('Eksport sandaran gagal: ' + e.message);
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
 // Pulihkan status semakan kesihatan
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // Pulihkan status bab selesai dibaca
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
 // Pulihkan penanda
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('Pemulihan berjaya! Halaman akan dimuat semula untuk menggunakan semua data.');
 location.reload();
 } catch(err) {
 alert('Pemulihan gagal: format fail tidak sah. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('Padam semua data bacaan? Tidak boleh dibatalkan! Eksport sandaran dahulu.')) return;
 if (!confirm('Sahkan sekali lagi: semua kemajuan bacaan, penanda dan penilaian akan dipadam. Teruskan?')) return;
 localStorage.clear();
 alert('Semua data dipadam. Halaman akan dimuat semula.');
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

 // ===== Sistem penilaian bab =====
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
 // Sisip selepas h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== Pengoptimuman anti-debounce tatalan =====
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

 // ===== Mengikut mod gelap sistem =====
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

 // ===== Tambah roti serbuk dan label tahap kesukaran pada tajuk bab secara automatik =====
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
 
 ${level === 'beginner' ? 'Pemula' : level === 'intermediate' ? 'Pertengahan' : 'Lanjutan'}
 </span>
 <span class="reading-time">
 baca ~${minutes} minit
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== Tambah blok "Ringkasan" pada bab =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">Ringkasan bab</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['Boleh lipat sudah matang tetapi belum arus perdana: peranti "hiasan", bukan "penyelamat"', 'Lipat melintang = telefon + tablet; lipat memanjang = muat saku + intaian skrin luar', 'Sesuai untuk: membaca berat/urgan/kerja kreatif ketika lipat gantung/wanita yang mengutamakan mudah alih', 'Enam semakan semasa membeli: jenis engsel, skrin dalaman UTG, kesan lipatan, saiz skrin luar, berat dan tebal, harga pembaikan selepas jaminan', 'Trik eksklusif: pelbagai tugas skrin berbelah, lipat gantung 90 darjah, intai skrin luar, mod PC', 'Teras penjagaan: jangan buka-tutup dalam sejuk, jaga daripada habuk dan pasir, jangan tampal filem biasa pada skrin dalam, engsel bebas habuk', 'Jangkaan: kesan lipatan kekal, lebih berat dan tebal, hayat bateri sederhana, nilai jual semula rendah, pembaikan mahal', 'Falsafah membeli: dibeli kerana bentuknya unik, bukan kerana "lebih maju"'],
 'di-ling-zhang': ['Fahami kedudukan buku ini: sains digital yang jelas tuturnya dan boleh terus dipraktikkan', 'Kuasai sistem simbol: maksud [butang], >, tebal dan condong', 'Mengapa kapasiti telefon "mengecut": punca utamanya', 'Bina tabiat mencatat spesifikasi telefon sendiri', 'Telefon = peti besi aset digital; pencegahan dahulu ialah idea teras', 'Data seringkali lebih bernilai daripada perkakasannya sendiri'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + modem dan modul lain dalam satu cip', 'Teras besar dan kecil CPU bekerja bersama: keseimbangan prestasi dan bateri', 'Skrin: OLED/LCD, kadar segar semula, kecerahan automatik', 'Teras sistem imej: saiz sensor lebih penting daripada bilangan piksel', 'Evolusi port: Micro USB → Lightning → disatukan pada USB-C', '5G-A membawa keupayaan baharu "penyatuan komunikasi dan penderiaan"'],
 'di-yi-zhang-harmony': ['HarmonyOS = sistem pengendalian teragih, direka untuk pelbagai peranti sejak awal', 'HarmonyOS 4.3 serasi dengan AOSP dan boleh menjalankan aplikasi Android', 'HarmonyOS NEXT sepenuhnya berdikari dan tidak lagi menyokong aplikasi Android', 'Sebelum naik taraf, pastikan aplikasi kerapan sudah punya versi natif'],
 'di-er-zhang': ['Storan tiga lapis: peranti / kad SD / awan', 'Maksud folder biasa di Android (DCIM, Download dan lain-lain)', 'Sandaran data = sandaran awan + sandaran setempat, perlindungan berganda', 'Padam bukan memusnahkan; hanya "menimpa" yang benar-benar memadam', 'Panduan pantas format fail biasa (imej/audio/video/dokumen)', 'Penamaan "tarikh + peristiwa" ialah konvensyen asas', 'Pembersihan automatik 72 jam menyelesaikan penumpukan cache aplikasi sosial', 'Perlindungan berganda gambar: kaburkan + tanggalkan EXIF'],
 'di-san-zhang': ['4G/5G masing-masing ada peranan; 5G-A ialah versi dipertingkat', 'Perbezaan teknikal utama Wi-Fi 6/6E/7', 'Wi-Fi awam menuntut keberhatan: jangan taip maklumat sensitif', 'Bluetooth 5.x terus berkembang, LE Audio mula meluas', 'NFC berfungsi dalam 10cm: kedekatan fizikal itu sendiri ialah jaminannya'],
 'di-si-zhang': ['Pasang aplikasi terutamanya daripada kedai rasmi', 'Pakej APK = sijil + sumber + konfigurasi + perduaan', 'Berhati-hati dengan aplikasi "pembersih-pemecut"; aplikasi kekal di latar belakang boleh jadi munasabah', 'Pengesahan tandatangan aplikasi menghalang pemutohan: perlindungan aras sistem', 'Mod tulen = pemasangan hanya dari kedai rasmi: tembok pertama melawan perisian berniat jahat', '"Parasit digital" merujuk kepada aplikasi rompak yang ditanam kuda trojan', 'Mekanisme semakan kedai aplikasi: imbasan virus + semakan kebenaran + pengesahan pembangun'],
 'di-wu-zhang': ['Skrin: resolusi, kadar segar semula, kecerahan automatik', 'Bunyi: volum dering/media/pemberitahuan diurus berasingan', 'Storan: bersihkan cache dan fail tidak perlu secara berkala', 'Biometrik: cap jari lawan wajah; 3D lebih selamat daripada 2D', 'Pembaca skrin: VoiceOver pada iOS / TalkBack pada Android ialah mata pengguna cacat penglihatan', 'Pembesaran: kontras tinggi, teks tebal, dan penapis warna - trio', 'Perihalan imej AI: biar AI membacakan imej, menu dan captcha untuk anda', 'Sari kata langsung: penyelamat pengguna kurang dengar dan persekitaran bising', 'RTT/TTY: yang hilang suara atau pendengaran tetap boleh menelefon'],
 'di-liu-zhang': ['Kata laluan skrin kunci + pengesahan dua faktor ialah garis pertahanan asas', 'Kebenaran aplikasi: aktifkan mengikut keperluan, prinsip kebenaran minimum', 'Tiada bayaran atau log masuk akaun melalui Wi-Fi awam', 'Di era AI, melihat bukan bermakna percaya: wajah dan suara palsu, menyamar sebagai pihak berkuasa, pelaburan palsu ialah helah paling biasa', 'Pelan keluar: pengesahan melalui gerakan + kata kunci bersama + pengesahan kedua', 'Anonimkan sebelum berkongsi: matikan lokasi dan maklumat peranti dalam EXIF', 'Peranti IoT: tukar kata laluan lalai', 'Jika tertipu ingat: jangan mudah percaya, jangan mendedahkan, jangan pindahkan'],
 'di-qi-zhang-jichu': ['Satelit: "tali penyelamat" dalam kecemasan', 'Berhubung tanpa rangkaian: radio jarak jauh walaupun tanpa liputan', 'Pengesanan kemalangan: gabungan sensor mengenali perlanggaran teruk', 'StarFlash: sambungan tanpa wayar kelewatan rendah dengan potensi besar'],
 'di-ba-zhang': ['Rakaman panggilan: perhatikan sisi undang-undangnya', 'iMessage/RCS menaikkan SMS tradisional kepada media kaya', 'Sejarah sembang WeChat perlukan fungsi sandaran terbina WeChat sendiri', 'Aplikasi mel mengurus berbilang akaun secara bersepadu', 'Sekatan gangguan: pengenalan sistem + senarai hitam/putih + penapis kata kunci SMS', '"Senyak Pemanggil Tidak Dikenali" di iOS menyekat gangguan, tetapi berhati-hati dengan panggilan tertinggal', 'Penandaan spam yang salah boleh dirayu melalui Dianhua Bang/360/Tencent dan saluran pengendali'],
 'di-jiu-zhang': ['WPS Office paling selesa di China, Microsoft 365 paling serasi', 'Nota tiga fasa: dicatat → dibaca kemudian → sistem pengetahuan', 'Imbas dengan telefon: Nota/Mic Lens/Baimiao/CamScanner', 'Awan mengikut keperluan: iCloud/OneDrive/Baidu/Aliyun Drive, setiap satu ada senarionya sendiri'],
 'di-shi-zhang': ['Siapa melihat kod bayaran dialah yang menerima wang: jangan sesekali hantar tangkapan skrinnya kepada sesiapa', 'Pemeriksaan keselamatan 5 minit: bayaran biometrik + kunci keselamatan + semak bayaran tanpa kata laluan + pengurusan peranti', 'Di LRT dan bas, lebih baik guna kad pengangkutan maya dalam dompet telefon: berfungsi walaupun luar talian', 'Sijil elektronik insurans kesihatan, semakan pencen, pengisian cukai: semuanya boleh dari telefon', 'Empat jangan lawan penipuan: jangan pindahkan ke "akaun selamat", jangan hantar kod bayaran, jangan sentuh pautan asing, jangan beri nombor kad bank'],
 'di-shi-yi-zhang': ['Empat kesilapan biasa: kanta kotor, dedahan tidak dilaras, lampu kilat berlebihan, zum digital salah guna', 'Mod malam menggabungkan banyak bingkai; tangan stabil 2-4 saat', 'Mod pro: ISO rendah imej bersih, shutter mengawal cahaya', 'Rantaian pascapengeluaran: betulkan → pelarasan asas → kemasan tempatan → gayakan', 'Carian pintar + pembersihan berkala + album manual = trio pengurusan gambar'],
 'di-shi-yi-zhang-advanced': ['Tiga tunjang video: resolusi, kadar bingkai, bitrate', 'H.265 memampatkan 50% lebih baik daripada H.264', 'ProRes ialah codec profesional Apple: failnya gergasi', 'HDR10/10+/Dolby Vision: setiap satu ada ceruknya sendiri'],
 'di-shi-er-zhang': ['NetEase Cloud Music terkuat dalam senarai main dan komuniti, QQ Music katalog paling luas, Apple Music bersih dan tanpa kehilangan, Spotify hebat dalam cadangan', 'Xiaoyuzhou pilihan pertama podcast bahasa Mandarin; manfaatkan pecutan dan pembersihan automatik', 'Video setempat: VLC (semua format) atau nPlayer (kawalan gerak isyarat)', 'Garis bawah dalam WeChat Read bersifat sosial + segerak Kindle; mod perlindungan mata mesti sentiasa hidup', 'Mod game utamakan kadar bingkai lancar dahulu; bila panas, kipas klip membantu'],
 'di-shi-san-zhang': ['Perkakas produktiviti: tugasan + pomodoro + kalendar', 'Kesihatan dan sukan: Apple Health/Google Fit sebagai hab data', 'Pelayar: Edge dahulu, dengan Copilot untuk meningkatkan produktiviti', 'Cari kebenaran: percayai domain rasmi, elak akhiran murah seperti .xyz', 'Utamakan pembersih terbina dalam; pihak ketiga seperti Qingzhuo hanya pelengkap, jangan sekali tekan bersihkan semuanya', 'Aplikasi anti-gangguan: Pusat Antipenipuan Kebangsaan + pengawal jenama + sekatan pengendali', 'Sekatan terbina dalam: iOS hidupkan Senyak Pemanggil Tidak Dikenali; Android hidupkan dalam aplikasi telefon setiap jenama', 'Tiga lapisan digabung: sekatan sistem + pengendali + pusat antipenipuan; jaga senarai putih supaya tidak menyekat orang sendiri', 'Amaran cuaca: aplikasi cuaca sistem + saluran meteorologi rasmi; bertindak mengikut tahap biru/kuning/oren/merah', 'Amaran bencana alam: meteorologi + saluran kesiapsiagaan; hujan lebat dan taufan jauhi kawasan rendah dan papan iklan', 'Amaran awal gempa bukan ramalan: beberapa saat hingga puluhan saat lebih awal; pada Android biasanya dalam tetapan keselamatan', 'TickTick: senarai + kalendar + pomodoro, penjadualan bahasa semula jadi', 'Imbas kertas: kamera sistem/Mic Lens/Baimiao/CamScanner; rakam tajam kemudian OCR', 'Kawalan jauh PC: Sunflower/ToDesk; orang asing menyuruh pasang kawalan jauh = penipuan', 'AI untuk pejabat: Trae dan lain-lain; kerja berat di komputer, dari telefon dipantau jarak jauh', 'Pindah pantas dalam rangkaian setempat: LocalSend/AirDrop/Feige; papan keratan: KDE Connect/perkakas jenama', 'Kod sekali guna 2FA: Aegis/Microsoft Authenticator, salinan kertas kod sandaran di dua tempat'],
 'di-shi-si-zhang': ['Dengan pengurus kata laluan cukup ingat satu kata laluan utama', 'Bitwarden sumber terbuka dan percuma, 1Password pengalaman terbaik', 'Kata laluan utama mestilah panjang dan rumit, dengan 2FA diaktifkan', 'Audit keselamatan kata laluan secara berkala', 'Seni bina pengetahuan-sifar: malah penyedia tidak melihat kata laluan anda; penyulitan berlaku di setempat', 'AES-256 + terbitan kunci PBKDF2/Argon2 ialah asas keamanan peti besi kata laluan', 'Pengajaran daripada insiden LastPass 2022: yang paling terancam pengguna dengan kata laluan utama lemah', 'Kekuatan kata laluan ada pada "entropi": panjang + rawak mengalahkan simbol rumit', 'HaveIBeenPwned memeriksa kebocoran, 1Password Watchtower memantau insiden', 'Passkey dibina di atas FIDO2/WebAuthn: tahan pancingan data, tiada kata laluan dihantar', 'Segerak Passkey merentas peranti: Rantai Kunci iCloud/Pengurus Kata Laluan Google sudah menyokongnya', 'Kunci perkakasan (YubiKey/Titan) tahan pancingan data dan rampasan SIM - sesuai untuk yang paling terdedah', 'Bilik besi kongsi 1Password + akses kecemasan Bitwarden menjadikan perkongsian keluarga dan pasukan lebih selamat'],
 'di-shi-wu-zhang': ['Bateri litium: cas ikut guna, benci panas, menua', 'Di bawah 80% kesihatan bateri, masa guna merosot ketara', 'Protokol pengecasan pantas: PD/QC/VOOC/SuperCharge tidak boleh saling dipakai', 'Pengecasan tanpa wayar Qi2 menambah penjajaran magnet', 'Teras jimat bateri: turunkan kecerahan + tutup latar belakang + tukar ke 4G'],
 'di-shi-liu-zhang': ['Akaun ialah pendaftaran penduduk kehidupan digital anda: mengaitkan kenalan, gambar, pembelian dan Cari Telefon', 'Tiga wajib: aktifkan 2FA, tetapkan kunci pemulihan, sahkan Cari Telefon dihidupkan', 'iCloud 5GB tidak cukup: kemas atau naik ke 50GB kira-kira ¥1/bulan', 'Segerakan dua hala (padam di sini, hilang di semua tempat), sandaran potret satu hala (padam di sini, kekal di sana)', 'Pengguna Android, semak berasingan: sandaran awan jenama, sandaran Google, sandaran WeChat'],
 'di-shi-qi-zhang': ['Kerja merentas peranti: AirDrop Apple/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/Pautkan ke Windows', 'Hantar ke TV: iPhone guna Screen Mirroring, Android guna penghantaran tanpa wayar; jika gagal, pastikan berada dalam Wi-Fi yang sama', 'Jam pintar = penapis pemberitahuan + pos kesihatan + bayar dari pergelangan tangan; untuk ibu bapa mungkin menyelamatkan keadaan', 'Rumah pintar dipilih mengikut ekosistem: Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'Keselamatan sambungan: semasa menghantar di tempat awam jaga privasi, dan nyahpaut peranti lama pada waktunya'],
 'di-shi-ba-zhang': ['Sandaran penuh: setempat dalam komputer (paling dipercayai) + awan (paling tenang), perlindungan berganda', 'Sejarah sembang WeChat paling istimewa: hanya sandaran dalam WeChat sendiri boleh membawanya, alat alih tidak mampu', 'Peraturan 3-2-1: 3 salinan, 2 jenis media, 1 di luar rumah', 'Tukar telefon: jenama sama guna aplikasi migrasi rasmi; merentas jenama sediakan laluan perantara data dahulu'],
 'di-shi-jiu-zhang': ['Lenguh dan panas empat langkah: ingat perubahan baru-baru ini → semak storan → semak penggunaan kuasa → semak isyarat', 'Rutin aplikasi ranap: tutup dan buka semula → kemas kini → semak kebenaran → kosongkan cache → pasang semula', 'Tidak mengecas: bersihkan port dahulu, kemudian silang tukar kabel dan pengecas untuk mengesan punca', 'Tiada rangkaian: modkapal terbang off/on → lupakan Wi-Fi dan sambung semula → mulakan semula penghala', 'Mulakan semula sejagat menyelesaikan kebanyakan masalah pelik; untuk pembaikan pilih pusat sah, sebelum serah: sandar + log keluar akaun'],
 'di-er-shi-zhang-jinjie': ['Mod pembangun: tekan nombor binaan 7 kali untuk hidupkan', 'Kunci BL: perlindungan pengilang; buka dengan berhati-hati', 'Root: risiko melebihi manfaat; tidak disyorkan untuk pengguna biasa', 'Magisk masih perlu BL terbuka, tetapi boleh menyembunyikan status root'],
 'di-er-shi-yi-zhang': ['VPN = terowong tersulit; VPN percuma pula mungkin dialah yang mencuri data anda', 'Pertahanan daripada lelaki-pertengahan pada Wi-Fi awam: percayai HTTPS, matikan sambungan automatik, urusan sensitif guna data mudah alih', 'Jabat tangan HTTPS menyulitkan dalam empat pusingan, tetapi laman pancingan data juga boleh guna HTTPS', 'DoH/DoT menyulitkan pertanyaan DNS: pengendali tidak boleh mengintip pelayaran web anda', 'Mod inkognito = pemadam setempat, bukan jubah halimunan: penyedia dan laman tetap melihat anda', 'Senarai semak keselamatan: matikan sambungan Wi-Fi automatik, tukar ke DNS tersulit, aktifkan 2FA, semak kebenaran aplikasi, dan sekat Juice Jacking'],
 'di-er-shi-er-zhang': ['Kamera AI: kenal pasti adegan → gabungkan banyak bingkai → optimum secara bijak', 'Pembantu suara: dengar → faham → laksana, tiga langkah', 'AI pada peranti: pantas, mesra privasi, berfungsi luar talian', 'Model besar AI meliputi senario sembang/penulisan/terjemahan/imej/pembelajaran', 'Kegunaan lazim: terjemahan langsung, pemadam AI, suntingan imej AI, pengurusan dokumen, carian imej AI', 'Kerangka arahan CRISPE: peranan + permintaan + konteks + output + nada + contoh', 'Dengan AI, berhati-hati dengan halusinasi dan kebocoran privasi', '"Peranan-Konteks-Tugas-Batasan" ialah pintu masuk penulisan arahan yang lebih mudah', 'Ciri arahan yang baik: khusus, ada konteks, ada format, ada batasan, boleh disahkan'],
 'di-er-shi-san-zhang': ['Unsur automasi: pencetus + tindakan + logik keputusan pilihan', 'Pintasan iOS: rutin pagi satu sentuhan, penjimat tenaga automatik, catatan perbelanjaan melalui imbasan', 'Android: penekan automatik (makro skrin), Tasker (automasi paling berkuasa), MacroDroid (mesra pemula)', 'Perangkap: pencetus lokasi kurang tepat, iOS tidak berjalan automatik tanpa pengesahan manual, Tasker perlukan kebenaran kebolehcapaian', 'Cara fikir automasi: ubah kerja berulang menjadi syarat → tindakan, telefon menjadi pembantu peribadi anda'],
 'di-er-shi-si-zhang': ['Bootloader pengawal gerbang semasa but; pengesahan tandatangan menghalang pemutohan', 'Polisi buka BL berbeza ikut jenama (Xiaomi benarkan/Huawei kunci)', 'Pilihan root: Magisk/KernelSU/SuperSU', 'Tiga jenis flash: ROM rasmi/Recovery pihak ketiga/ROM pihak ketiga'],
 'di-er-shi-wu-zhang': ['Jual telefon lama: sandar dahulu → log keluar → padam tersulit → isi dan padam semula', 'Warisan digital: Kenalan Warisan iCloud/Akaun Tidak Aktif Google', 'Kitar semula: utamakan program pertukaran rasmi; telefon lama masih boleh jadi kamera atau navigasi'],
 'di-er-shi-liu-zhang': ['Tiga standard telefon AI: model besar pada peranti, kuasa NPU dalam TOPS, AI Agent merentas aplikasi', 'Strategi AI pengeluar: Apple/Google/Huawei/Xiaomi/OPPO/vivo, setiap satu ada kekuatannya', 'Satelit: mesej pendek BeiDou sudah turun ke pertengahan, panggilan Tiantong masih eksklusif bendera', 'Boleh lipat: perkakasan matang, aplikasi menyesuaikan kira-kira tujuh puluh peratus, lipat gantung dan skrin berbelah ialah pengalaman istimewa', '6G masih dalam perjalanan, Wi-Fi 7 sudah tiba, Bluetooth LE Audio mula tersebar', 'Bateri anod silikon-karbon menjadikan 5000-6000mAh standard telefon bendera'],
 'di-er-shi-qi-zhang': ['Hidupkan mod mudah atau besarkan fon/ikon dahulu: persekitaran sesuai menghilangkan separuh masalah', 'Tiga peraturan besi bersama warga emas: jangan tergesa, guna analogi, tuliskan', 'Enam penipuan biasa yang perlu diingatkan berulang kali; tiga garis pertahanan menahan 90% penipuan', 'Bantuan jarak jauh membolehkan anda membaiki telefon ibu bapa walaupun dari bandar lain', 'Mod peduli WeChat + masukan suara ialah dua fungsi paling berguna buat warga emas', 'Panggilan SOS dan pengesanan jatuh: tetapan yang menyelamatkan nyawa di detik genting'],
 'di-er-shi-ba-zhang': ['Pilih telefon tiga langkah: keperluan dahulu → bajet kemudian → model akhirnya', 'Hanya lima parameter utama: pemproses, skrin, kamera, bateri dan pengecasan, janji kemas kini', '¥1500-3500 ialah julat paling berbaloi dan paling disyorkan', 'Telefon bendera tahun lepas lebih berbaloi daripada pertengahan tahun ini', 'Lima perangkap: mitra kamera berbilang, pemujaan megapiksel, versi pengendali, pemujaan skrin melengkung, gimmik AI', '618 dan Double 11 ialah dua tetingkap masa terbaik setahun untuk membeli telefon'],
 'di-er-shi-jiu-zhang': ['Lihat dahulu data masa skrin; melihat keadaan dengan jelas ialah langkah pertama untuk berubah', 'Tetapkan had untuk aplikasi hiburan dan masa untuk Jangan Ganggu, dan kembali mengawal tumpuan anda', 'Peraturan 20-20-20 ialah tabiat penjagaan mata paling ringkas dan berkesan', 'Menunduk melihat telefon membebankan leher 5-6 kali berat kepala; angkat telefon dan regangkan leher berkala', 'Satu jam sebelum tidur tanpa telefon; letak pengecas di luar jangkauan tangan', 'Penawar kebimbangan maklumat ialah "menyekat secara aktif", bukan "menerima lebih"'],
 'di-san-shi-zhang': ['Tiga kem penghantaran tanpa wayar: AirPlay (Apple), Miracast (Android), DLNA (dorongan media merentas platform)', 'Penghantaran berkabel lebih stabil tanpa lengah; bilik mesyuarat wajib ada penyesuai HDMI', 'Samsung DeX/mod desktop Huawei mengubah telefon menjadi PC pejabat ringan', 'Sambungan dalam kereta: empat penyelesaian - CarPlay/Android Auto/HiCar/CarLife', 'Peraturan penghantaran di bilik mesyuarat: uji lebih awal, sediakan pelan B, sorok pratonton pemberitahuan'],
 'di-san-shi-yi-zhang': ['Sebelum merakam, jelas: siapa penonton, nilai apa yang diberikan, platform mana untuk memuat naik', 'Lima perkara sebelum merakam: 1080P/30fps, lap kanta, kunci fokus dan dedahan, pilih orientasi, hidupkan grid', 'Lima pergerakan kamera: tolak, tarik, goyang, alih, ikut - kestabilan diutamakan', 'Sunting dengan CapCut: potong → peralihan → sari kata → BGM → eksport, enam langkah', 'Tiga saat pertama menentukan segala-galanya; satu video satu mesej; ketekunan mengalahkan bakat'],
 'di-san-shi-er-zhang': ['Telefon hilang, 30 minit emas: pinjam telefon orang lain dan hubungi diri sendiri → kunci jarak jauh → sekat SIM → bekukan pembayaran → maklumkan keluarga dan sahabat → lapor polis', '72 jam selepas tertipu: hentikan pemindahan → simpan bukti → hubungi 96110 → lapor polis → hubungi bank → tukar kata laluan', 'Telefon dijangkiti: mod selamat → nyahpasang aplikasi mencurigakan → imbasan keselamatan → tetapan semula kilang (jalan terakhir)', 'Akaun dicuri: tukar kata laluan → log keluar peranti → semak sejarah log masuk → aktifkan 2FA → semak pemautan → semak pembayaran', '99.9% mesej tebusan ialah penipuan: jangan balas, jangan bayar, tangkap skrin dan sekat', 'Tipu wajah/suara klon: cari kecacatan pada kedipan, bibir, garis luar dan cahaya; minta mereka menoleh atau menutup wajah, ajuk soalan peribadi, dan hubungi semula nombor yang dikenali', 'Pembajakan SIM swap: jika telefon tiba-tiba papar "Tiada perkhidmatan" itu isyarat kecemasan; pasang PIN SIM, aktifkan pengesahan kedua dari pengendali, dan pindahkan akaun penting ke aplikasi pengesah', 'Lima tabiat harian: skrin kunci + 2FA, Cari Telefon, PIN SIM, jangan pasang aplikasi asing, sandaran berkala', 'Gempa/cuaca melampau: berlindung berdekatan dahulu, kemudian berpindah; SMS menjimatkan bateri lebih daripada panggilan panjang', 'Tiada isyarat, keutamakan SOS satelit (jika model menyokong); amaran dan tetapan ada di Bab 13'],
 'di-san-shi-san-zhang': ['Vision Pro dan cermin mata AR ialah pintu masuk pengkomputeran baharu di luar telefon, tetapi tidak akan menggantikannya dalam masa terdekat', 'Antara muka otak-komputer masih 10-20 tahun daripada pengguna; etika matang lebih awal daripada teknologi', 'Telefon berevolusi ke arah "menghilang": daripada berpusat peranti kepada berpusat identiti', 'Etika AI, kedaulatan data dan jurang digital ialah isu teras dekad akan datang', 'Tetap bersambung dan tetap berdikari: falsafah kekal kehidupan digital'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // Langkau bab yang sudah ada ringkasan sebenar dalam, elak berganda
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== Butang salin (ditambah pada elemen kbd) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'Salin');
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

 // ===== Kandungan panjang boleh lipat (peringkat h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // Lipat hanya bahagian h4 yang panjang
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // Tambah kepala lipatan
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

 // ===== Papan pemuka pembelajaran: kemajuan bacaan + semakan kesihatan telefon =====
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
 // Kemajuan bacaan
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // Bilangan penanda
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // Bab terakhir
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // Semakan kesihatan
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'Markah penuh! Keselamatan telefon anda dalam keadaan cemerlang';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'Bagus! ' + (totalChecks - checked) + ' butir masih boleh ditambah baik';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'Lulus saja - keutamakan butir keselamatan yang belum ditanda';
 else healthMsgEl.innerHTML = 'Telefon anda masih ada lompang keselamatan - segera baiki';
 }
 }

 // Pulihkan status tanda semak
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // Segar semula setiap 3 saat (menangkap tanda semak bab)
 setInterval(updateDashboard, 3000);

 // ===== Bacaan bersuara (TTS) =====
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
 // Menggandakan dan mengalih keluar elemen yang tidak perlu dibacakan
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // Mengalih keluar badan terlipat tetapi simpan teksnya
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('Maaf, pelayar anda tidak menyokong bacaan bersuara. Cuba Chrome atau Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'Bab tanpa tajuk';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'ms-MY';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // Cuba gunakan suara bahasa Melayu yang lebih semula jadi
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('ms') || v.lang.startsWith('id'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // Bacakan bab seterusnya secara automatik
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
 // Cari bab yang sedang kelihatan
 if (ttsSectionIndex < 0) {
 // Bermula dari awal atau daripada bab paling hampir dengan kedudukan tatalan
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
 ttsLabel.textContent = 'Belum mula';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // Mengikat peristiwa
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
 // Cipta semula bahagian semasa kemudian mainkan
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

 // Pintasan: kekunci R menghidupkan/mematikan bacaan bersuara
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

 // ===== Permulaan =====
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

