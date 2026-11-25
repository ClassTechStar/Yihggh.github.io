
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
 const nextLabel = isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap';
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

 // ===== Gulir: progres + bayangan + kembali ke atas + progres daftar isi + cincin progres =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} bab`;

 // Parameter cincin progres
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

 // Pembaruan cincin progres
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

 // Sudah membaca sampai bab mana
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

 // ===== Ingatan posisi membaca =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // Terlalu awal untuk menyimpan
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // Menemukan nama bab saat ini
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

 // Memulihkan posisi saat halaman dimuat
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
 restoreToastText.textContent = `Terakhir dibaca: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // Tersembunyi otomatis setelah 10 detik
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

 // ===== Animasi muncul saat menggulir =====
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
 // Konten layar pertama langsung ditandai terlihat
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== Membuka/menutup bilah samping =====
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

 // Perkakas cepat: membuka daftar isi
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== Navigasi jangkar global: mengompensasi geser bilah tetap =====
 // Harus pakai scrollIntoView, bukan menghitung koordinat sendiri: .content-section memakai
 // content-visibility:auto + contain-intrinsic-size(0 800px): bab di luar layar
 // memakai placeholder 800px, getBoundingClientRect mengembalikan koordinat placeholder, dan scrollTo langsung
 // akan mendarat di posisi salah (makin ke belakang bab, makin besar deviasinya). scrollIntoView menyerahkan pada peramban
 // merender target sesuai permintaan dan memposisikannya, dan html{scroll-padding-top:5rem} mengompensasi bilah tetap
 // tetap.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // Langkah 1: mode instant memaksa render bab target dan memposisikannya lebih dulu, agar content-visibility tidak
 // pergeseran saat gulir halus yang diakibatkan render tertunda.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // Langkah 2: setelah target terrender dan koordinat stabil, baru picu gulir halus untuk pengalaman yang mulus.
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

 // ===== Melipat daftar isi =====
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

 // ===== Menyaring daftar isi =====
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

 // ===== Menyorot di daftar isi =====
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

 // Menambah tombol penanda ke tiap bab
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'Tersimpan' : 'Penanda') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'Hapus dari penanda' : 'Tambahkan bab ini ke penanda');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'Tersimpan' : 'Penanda';
 btn.setAttribute('aria-label', added ? 'Hapus dari penanda' : 'Tambahkan bab ini ke penanda');
 // Memperbarui tanda di bilah samping
 updateTocBookmark(id, added);
 });
 // Menyisipkan setelah h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // Menginisialisasi tanda penanda di bilah samping
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== Centang bab selesai dibaca =====
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
 check.setAttribute('aria-label', isCompleted(id) ? 'Batalkan tandai dibaca' : 'Tandai sudah dibaca');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'Sudah dibaca' : 'Sudah dibaca';
 check.setAttribute('aria-label', done ? 'Batalkan tandai dibaca' : 'Tandai sudah dibaca');
 // Memperbarui bilah samping
 updateTocCompleted(id, done);
 // Memperbarui progres membaca
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
 // Memperbarui penghitung bab selesai juga
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} bab`;
 }
 }

 // ===== Pencarian (ditingkatkan: navigasi papan tuts + penghitung hasil) =====
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
 renderSearchPlaceholder('Ketik kata kunci untuk mulai mencari');
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
 renderSearchPlaceholder('Tidak ada hasil yang cocok');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">${results.length} hasil ditemukan</div>`;
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
 renderSearchPlaceholder('Ketik kata kunci untuk mulai mencari');
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

 // Navigasi pencarian dengan tuts
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

 // ===== Ukuran huruf =====
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

 // ===== Menutup bilah samping dengan gesekan =====
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

 // ===== Navigasi antar bab =====
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
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'Bab berikutnya'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== Cetak =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== Pintasan papan tuts global =====
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

 // Menutup jendela saat mengeklik tirai
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
 // Pencetakan sudah diurus peramban
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

 // ===== Pelacakan hari membaca berturut-turut =====
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

 // Menampilkan pemberitahuan hari berturut-turut
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 Hari ' + streak + ' membaca berturut-turut. Terus semangat!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage mungkin tidak tersedia */ }
 }
 updateStreak();

 // ===== Cadangan/pemulihan =====
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
 // Mengumpulkan status pemeriksaan kesehatan
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // Mengumpulkan status bab selesai dibaca
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // Mengumpulkan penanda
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // Mengumpulkan penilaian
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'Cadangan-Membaca-PhoneClass_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('Ekspor cadangan gagal: ' + e.message);
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
 // Memulihkan status pemeriksaan kesehatan
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // Memulihkan status bab selesai dibaca
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
 // Memulihkan penanda
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('Pemulihan berhasil! Halaman akan dimuat ulang untuk menerapkan semua data.');
 location.reload();
 } catch(err) {
 alert('Pemulihan gagal: format berkas tidak valid. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('Hapus semua data membaca? Tidak bisa dibatalkan! Ekspor cadangan dulu.')) return;
 if (!confirm('Konfirmasi lagi: seluruh progres membaca, penanda, dan penilaian akan dihapus. Lanjutkan?')) return;
 localStorage.clear();
 alert('Semua data dihapus. Halaman akan dimuat ulang.');
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
 // Menyisipkan setelah h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== Optimasi anti-debounce gulir =====
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

 // ===== Mengikuti mode gelap sistem =====
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

 // ===== Menambah breadcrumb dan label kesulitan ke judul bab secara otomatis =====
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
 
 ${level === 'beginner' ? 'Pemula' : level === 'intermediate' ? 'Menengah' : 'Lanjutan'}
 </span>
 <span class="reading-time">
 baca ~${minutes} menit
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== Menambah blok "Ringkasan" ke bab =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">Ringkasan bab</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['Lipat sudah matang tapi belum arus utama: perangkat "pemanis", bukan "penyelamat"', 'Lipat melintang = ponsel + tablet; lipat memanjang = muat saku + lirik layar luar', 'Cocok untuk: membaca berat/bisnis/karya saat lipat gantung/perempuan yang menjaga portabilitas', 'Enam pemeriksaan saat membeli: jenis engsel, layar dalam UTG, bekas lipatan, ukuran layar luar, bobot dan tebal, harga perbaikan purna jual', 'Trik eksklusif: multitugas layar terbagi, lipat gantung 90 derajat, lirik layar luar, mode PC', 'Inti perawatan: jangan buka-tutup di dingin ekstrem, lindungi dari kotoran, jangan tempel pelindung biasa di layar dalam, jaga engsel bebas debu', 'Ekspektasi: lipatan permanen, lebih berat dan tebal, daya tahan baterai biasa, harga jual kembali rendah, perbaikan mahal', 'Filosofi membeli: dibeli karena bentuknya khas, bukan karena "lebih canggih"'],
 'di-ling-zhang': ['Pahami posisi buku ini: sains digital yang bicara lugas dan bisa langsung dipraktikkan', 'Kuasai sistem simbol: arti [tombol], >, tebal, dan miring', 'Mengapa kapasitas ponsel "menyusut": penyebab utamanya', 'Bangun kebiasaan mencatat spesifikasi ponselmu sendiri', 'Ponsel = brankas aset digital; pencegahan lebih dulu adalah gagasan inti', 'Data seringkali lebih berharga daripada perangkat kerasnya sendiri'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + modem dan modul lain dalam satu chip', 'Core besar dan kecil CPU bekerja bersama: keseimbangan performa dan baterai', 'Layar: OLED/LCD, laju pembaruan, kecerahan otomatis', 'Inti sistem citra: ukuran sensor lebih menentukan daripada jumlah piksel', 'Evolusi port: Micro USB → Lightning → terpadu di USB-C', '5G-A membawa kemampuan baru "penyatuan komunikasi dan sensorik"'],
 'di-yi-zhang-harmony': ['HarmonyOS = sistem operasi terdistribusi, dirancang untuk banyak perangkat sejak awal', 'HarmonyOS 4.3 kompatibel dengan AOSP dan dapat menjalankan aplikasi Android', 'HarmonyOS NEXT sepenuhnya mandiri dan tak lagi mendukung aplikasi Android', 'Sebelum memperbarui, pastikan aplikasi andalanmu sudah punya versi native'],
 'di-er-zhang': ['Penyimpanan tiga lapis: perangkat / kartu SD / cloud', 'Arti folder umum di Android (DCIM, Download, dll.)', 'Cadangan data = cadangan cloud + cadangan lokal, perlindungan ganda', 'Menghapus bukan memusnahkan; hanya "menimpa" yang benar-benar menghapus', 'Panduan cepat format berkas umum (gambar/audio/video/dokumen)', 'Penamaan "tanggal + peristiwa" adalah konvensi dasar', 'Pembersihan otomatis 72 jam menyelesaikan menumpuknya cache aplikasi sosial', 'Perlindungan ganda foto: penyamaran + pengupasan EXIF'],
 'di-san-zhang': ['4G/5G punya peran masing-masing; 5G-A adalah versi peningkatan', 'Perbedaan teknis kunci Wi-Fi 6/6E/7', 'Wi-Fi publik menuntut kewaspadaan: jangan mengetik data sensitif', 'Bluetooth 5.x terus berkembang, LE Audio mulai menyebar', 'NFC bekerja dalam 10 cm: kedekatan fisik itu sendiri adalah jaminannya'],
 'di-si-zhang': ['Pasang aplikasi terutama dari toko resmi', 'Paket APK = sertifikat + sumber daya + konfigurasi + biner', 'Hati-hati aplikasi "pembersih-pengakselerasi"; aplikasi bertahan di latar belakang bisa jadi wajar', 'Verifikasi tanda tangan aplikasi mencegah manipulasi: perlindungan di level sistem', 'Mode murni = pemasangan hanya dari toko resmi: tembok pertama melawan malware', '"Parasit digital" berarti aplikasi bajakan yang ditanami trojan', 'Mekanisme tinjauan toko aplikasi: pemindaian virus + tinjauan izin + verifikasi pengembang'],
 'di-wu-zhang': ['Layar: resolusi, laju pembaruan, kecerahan otomatis', 'Suara: volume dering/media/notifikasi diatur terpisah', 'Penyimpanan: bersihkan cache dan berkas tak perlu secara rutin', 'Biometrik: sidik jari lawan wajah; 3D lebih aman dari 2D', 'Pembaca layar: VoiceOver di iOS / TalkBack di Android adalah mata pengguna tunanetra', 'Pembesaran: kontras tinggi, teks tebal, dan filter warna - trio', 'Deskripsi gambar AI: biarkan AI membacakan gambar, menu, dan captcha untukmu', 'Takarir langsung: penyelamat pengguna kurang dengar dan lingkungan bising', 'RTT/TTY: yang kehilangan suara atau pendengaran tetap bisa menelepon'],
 'di-liu-zhang': ['Sandi layar kunci + autentikasi dua faktor adalah garis pertahanan dasar', 'Izin aplikasi: aktifkan sesuai kebutuhan, prinsip hak minimum', 'Tidak ada pembayaran atau masuk akun lewat Wi-Fi publik', 'Di era AI, melihat bukan berarti percaya: wajah dan suara gandaan, menyamar sebagai tokoh berwibawa, investasi palsu adalah trik terbanyak', 'Rencana keluar: verifikasi lewat gerakan + kata sandi bersama + konfirmasi kedua', 'Anonimkan sebelum berbagi: matikan lokasi dan info perangkat di EXIF', 'Perangkat IoT: ganti sandi bawaan', 'Jika tertipu, ingat: jangan mudah percaya, jangan membocorkan, jangan mentransfer'],
 'di-qi-zhang-jichu': ['Satelit: "tali penyelamat" dalam keadaan darurat', 'Berkomunikasi tanpa jaringan: radio jarak jauh walau tanpa sinyal', 'Deteksi kecelakaan: fusi sensor mengenali tabrakan berat', 'StarFlash: koneksi nirkabel latensi rendah dengan potensi besar'],
 'di-ba-zhang': ['Merekam panggilan: perhatikan sisi hukumnya', 'iMessage/RCS mengangkat SMS tradisional menjadi media kaya', 'Riwayat obrolan WeChat butuh fitur cadangan bawaan WeChat', 'Aplikasi surat mengelola banyak akun secara terpadu', 'Pemblokiran gangguan: pengenalan sistem + daftar hitam/putih + saring kata kunci SMS', '"Senyap panggilan tak dikenal" di iOS menahan gangguan, tapi waspadai panggilan yang terlewat', 'Penandaan spam yang salah bisa digugat lewat Dianhua Bang/360/Tencent dan kanal operator'],
 'di-jiu-zhang': ['WPS Office paling nyaman di Tiongkok, Microsoft 365 paling kompatibel', 'Catatan tiga tahap: tercatat → dibaca nanti → sistem pengetahuan', 'Memindai dengan ponsel: Catatan/Mic Lens/Baimiao/CamScanner', 'Cloud sesuai kebutuhan: iCloud/OneDrive/Baidu/Aliyun Drive, masing-masing punya skenario sendiri'],
 'di-shi-zhang': ['Siapa melihat kode pembayaran dialah yang menerima uang: jangan pernah kirim tangkapan layarnya kepada siapa pun', 'Pemeriksaan keamanan 5 menit: bayar biometrik + kunci keamanan + cek pembayaran tanpa sandi + kelola perangkat', 'Di MRT dan bus, lebih baik kartu transportasi virtual di dompet ponsel: tetap jalan walau luring', 'Sertifikat elektronik asuransi kesehatan, cek pensiun, lapor pajak tahunan: semua bisa dari ponsel', 'Empat jangan melawan penipuan: jangan transfer ke "rekening aman", jangan kirim kode pembayaran, jangan sentuh tautan asing, jangan beri nomor kartu'],
 'di-shi-yi-zhang': ['Empat kesalahan umum: lensa kotor, eksposur tak diatur, kelebihan pakai flash, zoom digital salah tempat', 'Mode malam menggabungkan banyak frame; tangan stabil 2-4 detik', 'Mode pro: ISO rendah gambar bersih, shutter mengendalikan cahaya', 'Alur pascaproduksi: luruskan → penyetelan dasar → poles lokal → beri gaya', 'Pencarian pintar + pembersihan rutin + album manual = trio pengelolaan foto'],
 'di-shi-yi-zhang-advanced': ['Tiga pilar video: resolusi, laju frame, bitrate', 'H.265 mengompresi 50% lebih baik daripada H.264', 'ProRes adalah codec profesional Apple: berkasnya raksasa', 'HDR10/10+/Dolby Vision: masing-masing punya ceruknya sendiri'],
 'di-shi-er-zhang': ['NetEase Cloud Music terkuat di playlist dan komunitas, QQ Music katalognya paling luas, Apple Music bersih dan tanpa penurunan kualitas, Spotify kuat dalam rekomendasi', 'Xiaoyuzhou pilihan pertama podcast berbahasa Mandarin; manfaatkan percepatan dan pembersihan otomatis', 'Video lokal: VLC (semua format) atau nPlayer (kontrol gestur)', 'Garis bawah di WeChat Read sosial + sinkron Kindle; mode pelindung mata wajib menyala', 'Mode game memprioritaskan frame rate mulus; saat panas, pendingin penjepit membantu'],
 'di-shi-san-zhang': ['Perkakas produktivitas: tugas + pomodoro + kalender', 'Kesehatan dan olahraga: Apple Health/Google Fit sebagai pusat data', 'Peramban: Edge dulu, berpasangan Copilot untuk produktivitas', 'Cari yang benar: percayai domain resmi, hindari akhiran murah seperti .xyz', 'Utamakan pembersih bawaan; pihak ketiga seperti Qingzhuo hanya pelengkap, jangan sekali ketuk bersihkan semua', 'Aplikasi anti-gangguan: Pusat Antipenipuan Nasional + penjaga merek + pemblokiran operator', 'Pemblokiran bawaan: iOS aktifkan Senyap Panggilan Tak Dikenal; Android aktifkan di aplikasi telepon masing-masing merek', 'Tiga lapis digabung: blokir sistem + operator + pusat antipenipuan; jaga daftar putih agar tidak memblokir milik sendiri', 'Peringatan cuaca: aplikasi cuaca sistem + kanal resmi meteorologi; bertindak sesuai tingkat biru/kuning/oranye/merah', 'Peringatan bencana alam: meteorologi + kanal tanggap darurat; hujan lebat dan badai, jauhi dataran rendah dan papan reklame', 'Peringatan dini gempa bukan ramalan: beberapa detik hingga puluhan detik lebih awal; di Android biasanya di pengaturan keamanan', 'TickTick: daftar + kalender + pomodoro, penjadwalan bahasa alami', 'Memindai kertas: kamera sistem/Mic Lens/Baimiao/CamScanner; jepret tajam lalu OCR', 'Kendali jarak jauh PC: Sunflower/ToDesk; orang asing menyuruh memasang kendali jarak jauh = penipuan', 'AI untuk kantor: Trae dan lainnya; pekerjaan berat di komputer, dari ponsel diawasi jarak jauh', 'Transfer cepat di jaringan lokal: LocalSend/AirDrop/Feige; papan klip: KDE Connect/perkakas merek', 'Kode sekali pakai 2FA: Aegis/Microsoft Authenticator, salinan kertas kode cadangan di dua tempat'],
 'di-shi-si-zhang': ['Dengan pengelola sandi cukup ingat satu sandi utama', 'Bitwarden sumber terbuka dan gratis, 1Password pengalamannya terbaik', 'Sandi utama harus panjang dan kompleks, dengan 2FA aktif', 'Lakukan audit keamanan sandi secara berkala', 'Arsitektur pengetahuan-nol: bahkan penyedianya pun tak melihat sandimu; enkripsi terjadi di lokal', 'AES-256 + derivasi kunci PBKDF2/Argon2 adalah batu fondasi keamanan brankas sandi', 'Pelajaran dari kasus LastPass 2022: yang paling berbahaya adalah pengguna dengan sandi utama lemah', 'Kekuatan sandi ada pada "entropi": panjang + keacakan mengalahkan simbol rumit', 'HaveIBeenPwned memeriksa kebocoran, 1Password Watchtower memantau insiden', 'Passkey dibangun di atas FIDO2/WebAuthn: tahan phishing, tanpa sandi yang dikirim', 'Sinkronisasi Passkey lintas perangkat: iCloud Keychain/Google Password Manager sudah mendukungnya', 'Kunci fisik (YubiKey/Titan) tahan phishing dan pembajakan SIM - ideal bagi yang paling terpapar risiko', 'Lemari besi bersama 1Password + akses darurat Bitwarden membuat berbagi dalam keluarga dan tim lebih aman'],
 'di-shi-wu-zhang': ['Baterai litium: isi sesuai pakai, benci panas, menua', 'Di bawah 80% kesehatan baterai, waktu pakai turun terasa', 'Protokol pengisian cepat: PD/QC/VOOC/SuperCharge tidak saling dipertukarkan', 'Pengisian nirkabel Qi2 menambah penyelarasan magnet', 'Inti hemat baterai: turunkan kecerahan + tutup latar belakang + pindah ke 4G'],
 'di-shi-liu-zhang': ['Akun adalah akta kelahiran kehidupan digitalmu: menyatukan kontak, foto, pembelian, dan Temukan Ponsel', 'Tiga wajib: aktifkan 2FA, tetapkan kunci pemulihan, pastikan Temukan Ponsel menyala', 'iCloud 5GB tidak cukup: rapikan atau naik ke 50GB sekitar ¥1/bulan', 'Sinkronisasi dua arah (hapus di sini, hilang di mana-mana), cadangan potret satu arah (hapus di sini, tetap ada di sana)', 'Pengguna Android, periksa terpisah: cadangan cloud merek, cadangan Google, cadangan WeChat'],
 'di-shi-qi-zhang': ['Kerja lintas perangkat: AirDrop Apple/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/Tautkan ke Windows', 'Transmisi ke TV: iPhone lewat Screen Mirroring, Android lewat transmisi nirkabel; bila gagal, pastikan di Wi-Fi yang sama', 'Smartwatch = penyaring notifikasi + pos kesehatan + bayar dari pergelangan; untuk orang tua bisa menyelamatkan situasi', 'Rumah pintar dipilih per ekosistem: Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'Keamanan keterkaitan: saat transmisi di tempat umum perhatikan privasi, dan lepas tautan perangkat lama tepat waktu'],
 'di-shi-ba-zhang': ['Cadangan penuh: lokal di komputer (paling andal) + cloud (paling tenang), perlindungan ganda', 'Riwayat obrolan WeChat paling istimewa: hanya cadangan bawaan WeChat yang membawanya, alat pindah tidak sanggup', 'Aturan 3-2-1: 3 salinan, 2 jenis media, 1 di luar rumah', 'Pindah ponsel: merek sama pakai aplikasi migrasi resmi; lintas merek siapkan jembatan data lebih dulu'],
 'di-shi-jiu-zhang': ['Lambat dan panas empat langkah: ingat apa yang berubah → cek penyimpanan → cek pemakaian daya → cek sinyal', 'Rutinitas aplikasi crash: tutup dan buka lagi → perbarui → cek izin → bersihkan cache → pasang ulang', 'Tidak terisi: bersihkan port dulu, lalu tukar silang kabel dan adaptor untuk menemukan pelakunya', 'Tidak ada jaringan: mode pesawat off/on → lupakan Wi-Fi dan sambung ulang → mulai ulang router', 'Restart universal menyelesaikan sebagian besar masalah aneh; untuk perbaikan pilih layanan resmi, sebelum diserahkan: cadangan + keluar dari akun'],
 'di-er-shi-zhang-jinjie': ['Mode pengembang: ketuk nomor build 7 kali untuk mengaktifkan', 'Kunci BL: perlindungan pabrikan; buka dengan hati-hati', 'Root: risikonya melebihi manfaat; tidak disarankan untuk pengguna biasa', 'Magisk tetap butuh BL terbuka, tetapi bisa menyembunyikan status root'],
 'di-er-shi-yi-zhang': ['VPN = terowongan terenkripsi; VPN gratis justru bisa mencuri datamu', 'Bertahan dari man-in-the-middle di Wi-Fi publik: percayai HTTPS, matikan koneksi otomatis, urusan sensitif pakai data seluler', 'Jabat tangan HTTPS mengenkripsi dalam empat putaran, tetapi situs phishing juga bisa HTTPS', 'DoH/DoT mengenkripsi kueri DNS: operator tak bisa mengintip penjelajahanmu', 'Mode samaran = penghapus lokal, bukan jubah tak kasat: ISP dan situs tetap melihatmu', 'Checklist keamanan: matikan koneksi Wi-Fi otomatis, pindah ke DNS terenkripsi, aktifkan 2FA, audit izin aplikasi, dan blokir Juice Jacking'],
 'di-er-shi-er-zhang': ['Kamera AI: kenali adegan → gabung banyak frame → optimasi cerdas', 'Asisten suara: mendengar → memahami → melaksanakan, tiga langkah', 'AI di perangkat: cepat, ramah privasi, bisa luring', 'Model besar AI terbagi skenario obrolan/menulis/menerjemahkan/gambar/belajar', 'Pemakaian khas: terjemahan langsung, penghapus AI, retouching AI, pengelolaan dokumen, pencarian gambar AI', 'Kerangka prompt CRISPE: peran + permintaan + konteks + keluaran + nada + contoh', 'Dengan AI, waspadai halusinasi dan kebocoran privasi', '"Peran-Konteks-Tugas-Batasan" adalah pintu masuk penulisan prompt yang lebih mudah', 'Ciri prompt bagus: spesifik, ada konteks, ada format, ada batasan, bisa diverifikasi'],
 'di-er-shi-san-zhang': ['Unsur otomatisasi: pemicu + tindakan + logika keputusan opsional', 'Pintasan iOS: rutinitas pagi satu ketukan, mode hemat otomatis, pencatatan belanja lewat pemindaian', 'Android: auto clicker (makro layar), Tasker (otomatisasi paling kuat), MacroDroid (ramah pemula)', 'Jebakan: pemicu lokasi tak presisi, iOS tidak berjalan otomatis tanpa konfirmasi manual, Tasker butuh izin aksesibilitas', 'Cara berpikir otomatisasi: ubah pekerjaan berulang menjadi kondisi → tindakan, dan ponsel menjadi asisten pribadimu'],
 'di-er-shi-si-zhang': ['Bootloader penjaga gerbang saat booting; verifikasi tanda tangan mencegah manipulasi', 'Kebijakan buka kunci BL berbeda per merek (Xiaomi mengizinkan/Huawei mengunci)', 'Pilihan root: Magisk/KernelSU/SuperSU', 'Tiga jenis flash: ROM resmi/Recovery pihak ketiga/ROM pihak ketiga'],
 'di-er-shi-wu-zhang': ['Menjual ponsel lama: cadangan dulu → keluar akun → hapus terenkripsi → isi dan hapus lagi', 'Warisan digital: Kontak Warisan iCloud/Akun Nonaktif Google', 'Daur ulang: utamakan program tukar tambah resmi; ponsel lama bisa jadi kamera atau navigator'],
 'di-er-shi-liu-zhang': ['Tiga standar ponsel AI: model besar di perangkat, tenaga NPU dalam TOPS, AI Agent lintas aplikasi', 'Strategi AI para pabrikan: Apple/Google/Huawei/Xiaomi/OPPO/vivo, masing-masing punya keunggulan', 'Satelit: pesan singkat BeiDou sudah turun ke kelas menengah, panggilan Tiantong tetap milik unggulan', 'Lipat: perangkat keras matang, aplikasi teradaptasi sekitar tujuh puluh persen, lipat gantung dan layar terbagi adalah pengalaman khasnya', '6G masih di perjalanan, Wi-Fi 7 sudah mendarat, Bluetooth LE Audio mulai menyebar', 'Baterai anoda silikon-karbon menjadikan 5000-6000mAh standar ponsel unggulan'],
 'di-er-shi-qi-zhang': ['Aktifkan dulu mode sederhana atau perbesar huruf/ikon: lingkungan yang pas menghapus separuh masalah', 'Tiga hukum besi mendampingi lansia: jangan buru-buru, pakai analogi, tuliskan', 'Enam penipuan umum yang perlu diingatkan berulang; tiga lini pertahanan menahan 90% penipuan', 'Bantuan jarak jauh membuatmu bisa memperbaiki ponsel orang tua walau dari kota lain', 'Mode perhatian WeChat + masukan suara adalah dua fitur paling berguna bagi lansia', 'Panggilan SOS dan deteksi jatuh: pengaturan yang menyelamatkan nyawa di saat genting'],
 'di-er-shi-ba-zhang': ['Memilih ponsel tiga langkah: dulu kebutuhan → lalu anggaran → akhirnya model', 'Hanya lima parameter inti: prosesor, layar, kamera, baterai dan pengisian, janji pembaruan', '¥1500-3500 adalah rentang paling menguntungkan dan paling direkomendasikan', 'Unggulan tahun lalu lebih untung daripada kelas menengah tahun ini', 'Lima perangkap: mitos multi-kamera, pemujaan megapiksel, versi operator, pemujaan layar melengkung, gimmick AI', '618 dan Double 11 adalah dua jendela waktu terbaik membeli ponsel dalam setahun'],
 'di-er-shi-jiu-zhang': ['Lihat dulu data waktu layar; melihat keadaan dengan jernih adalah langkah pertama berubah', 'Pasang batas untuk aplikasi hiburan dan jadwal untuk Jangan Ganggu, dan kembali menguasai atensimu', 'Aturan 20-20-20 adalah kebiasaan merawat mata paling sederhana dan efektif', 'Menunduk melihat ponsel membebani leher 5-6 kali berat kepala; angkat ponsel dan regangkan leher berkala', 'Satu jam sebelum tidur tanpa ponsel; letakkan pengisi daya di luar jangkauan tangan', 'Antidot kecemasan informasi adalah "memblokir aktif", bukan "menerima lebih banyak"'],
 'di-san-shi-zhang': ['Tiga kubu transmisi nirkabel: AirPlay (Apple), Miracast (Android), DLNA (dorong media lintas platform)', 'Transmisi berkabel lebih stabil dan tanpa jeda; ruang rapat wajib punya adaptor HDMI', 'Samsung DeX/mode desktop Huawei mengubah ponsel menjadi PC kantor ringan', 'Koneksi di mobil: empat solusi - CarPlay/Android Auto/HiCar/CarLife', 'Aturan transmisi di ruang rapat: uji lebih dulu, siapkan rencana B, sembunyikan pratinjau notifikasi'],
 'di-san-shi-yi-zhang': ['Sebelum merekam, pastikan: siapa audiensnya, nilai apa yang diberikan, di platform mana unggah', 'Lima hal sebelum merekam: 1080P/30fps, bersihkan lensa, kunci fokus dan eksposur, pilih orientasi, aktifkan grid', 'Lima gerakan kamera: maju, mundur, goyang, geser, ikuti - stabilitas utama', 'Menyunting dengan CapCut: potong → transisi → takarir → BGM → ekspor, enam langkah', 'Tiga detik pertama menentukan segalanya; satu video satu pesan; kegigihan mengalahkan bakat'],
 'di-san-shi-er-zhang': ['Ponsel hilang, 30 menit emas: pinjam ponsel orang dan telepon dirimu → kunci jarak jauh → blokir SIM → bekukan pembayaran → beri tahu keluarga dan teman → lapor polisi', '72 jam setelah tertipu: hentikan transfer → simpan bukti → telepon 96110 → lapor polisi → hubungi bank → ganti sandi', 'Ponsel terinfeksi: mode aman → hapus aplikasi mencurigakan → pemindaian keamanan → reset pabrik (upaya terakhir)', 'Akun dicuri: ganti sandi → keluar dari perangkat → periksa riwayat masuk → aktifkan 2FA → periksa tautan akun → periksa pembayaran', '99,9% pesan tebusan adalah penipuan: jangan balas, jangan bayar, tangkap layar dan blokir', 'Penipuan wajah/suara gandaan: cari cacat pada kedipan, mulut, tepi, dan cahaya; minta ia menoleh atau menutup wajah, ajukan pertanyaan pribadi, telepon balik ke nomor yang dikenal', 'Pembajakan SIM swap: jika ponsel tiba-tiba tampil "No service" itu alarm; pasang PIN SIM, aktifkan verifikasi kedua dari operator, dan pindahkan akun penting ke aplikasi authenticator', 'Lima kebiasaan harian: layar kunci + 2FA, Temukan Ponsel, PIN SIM, jangan pasang aplikasi asing, cadangan rutin', 'Gempa/cuaca ekstrem: berlindung di dekat dulu, lalu mengungsi; SMS menghemat baterai lebih dari panggilan panjang', 'Tanpa sinyal, utamakan SOS satelit (jika model mendukung); peringatan dan pengaturan ada di Bab 13'],
 'di-san-shi-san-zhang': ['Vision Pro dan kacamata AR adalah pintu masuk komputasi baru di luar ponsel, tetapi belum menggantikannya dalam waktu dekat', 'Antarmuka otak-komputer masih 10-20 tahun dari konsumen; etika matang lebih dulu daripada teknologi', 'Ponsel berevolusi ke arah "tak terlihat": dari berpusat pada perangkat ke berpusat pada identitas', 'Etika AI, kedaulatan data, dan kesenjangan digital adalah isu inti dekade berikutnya', 'Tetap terhubung dan tetap mandiri: filsafat abadi kehidupan digital'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // Lewati bab yang sudah punya ringkasan inline, agar tidak dobel
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== Tombol salin (ditambahkan ke elemen kbd) =====
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

 // ===== Konten panjang yang bisa dilipat (level h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // Lipat hanya bagian h4 yang panjang
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // Menambah kepala lipatan
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

 // ===== Dasbor belajar: progres membaca + pemeriksaan kesehatan ponsel =====
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
 // Progres membaca
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // Jumlah penanda
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // Bab terakhir
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // Pemeriksaan kesehatan
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'Nilai sempurna! Keamanan ponselmu dalam kondisi prima';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'Bagus! ' + (totalChecks - checked) + ' butir masih bisa disempurnakan';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'Cukup lulus - prioritaskan butir keamanan yang belum dicentang';
 else healthMsgEl.innerHTML = 'Ponselmu masih punya celah keamanan - segera perbaiki';
 }
 }

 // Memulihkan status centang
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // Menyegarkan tiap 3 detik (menangkap centang bab)
 setInterval(updateDashboard, 3000);

 // ===== Membaca bersuara (TTS) =====
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
 // Menggandakan dan menghapus elemen yang tak perlu dibacakan
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // Menghapus bagian terlipat namun menyimpan teksnya
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('Maaf, perambanmu tidak mendukung pembacaan suara. Coba Chrome atau Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'Bab tanpa judul';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'id-ID';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // Mencoba memakai suara bahasa Indonesia yang lebih natural
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('id'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // Membacakan bab berikutnya otomatis
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
 // Menemukan bab yang sedang terlihat
 if (ttsSectionIndex < 0) {
 // Mulai dari awal atau dari bab terdekat ke posisi gulir
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
 ttsLabel.textContent = 'Belum dimulai';
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
 // Membuat ulang bagian saat ini lalu memutarnya
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

 // Pintasan: tombol R menyalakan/mematikan pembacaan suara
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

 // ===== Inisialisasi =====
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

