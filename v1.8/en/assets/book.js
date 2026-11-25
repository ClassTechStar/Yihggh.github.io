
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

 // ===== Theme =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';
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

 // ===== Scroll: progress + shadow + back-to-top + TOC progress + progress ring =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} chapters`;

 // Progress ring parameters
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

 // Progress ring update
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

 // Which chapter we have read to
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} chapters`;
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

 // ===== Reading position memory =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // Too early to save
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // Find the current chapter name
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

 // Restore position on page load
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
 restoreToastText.textContent = `Last read: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // Auto-hide after 10 seconds
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

 // ===== Scroll-in animation =====
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
 // Content in the first viewport is visible directly
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== Sidebar open/close =====
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

 // Quick tools: open the TOC
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== Global anchor navigation: compensate the fixed navbar offset =====
 // Must use scrollIntoView instead of manual coordinates: .content-section has
 // content-visibility:auto + contain-intrinsic-size(0 800px), so offscreen chapters
 // are laid out as 800px placeholders, getBoundingClientRect returns placeholder coordinates, and a direct scrollTo
 // would land at the wrong position (the later the chapter, the larger the drift). scrollIntoView lets the browser
 // renders the target on demand and positions it, and html{scroll-padding-top:5rem} offsets the fixed
 // navbar height.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // Step 1: instant mode first force-renders the target chapter and positions it, avoiding content-visibility
 // drift during smooth scrolling caused by deferred rendering.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // Step 2: once the target is rendered and coordinates are stable, fire a smooth scroll for a polished feel.
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

 // ===== TOC collapse =====
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

 // ===== TOC filter =====
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

 // ===== TOC highlight =====
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

 // ===== Bookmark system =====
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

 // Add a bookmark button to each chapter
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'Bookmarked' : 'Bookmark') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'Remove bookmark' : 'Bookmark this chapter');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'Bookmarked' : 'Bookmark';
 btn.setAttribute('aria-label', added ? 'Remove bookmark' : 'Bookmark this chapter');
 // Update the sidebar marks
 updateTocBookmark(id, added);
 });
 // Insert after the h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // Initialize sidebar bookmark marks
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== Chapter completion checks =====
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
 // Find the meta row or the element before the h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'Read' : 'Mark read') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'Mark unread' : 'Mark as read');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'Read' : 'Mark read';
 check.setAttribute('aria-label', done ? 'Mark unread' : 'Mark as read');
 // Update the sidebar
 updateTocCompleted(id, done);
 // Update the completed progress
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
 // Also update the completed count display
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} chapters`;
 }
 }

 // ===== Search (enhanced: keyboard navigation + result count) =====
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
 renderSearchPlaceholder('Type keywords to start searching');
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
 renderSearchPlaceholder('No matching content found');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">${results.length} results found</div>`;
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
 renderSearchPlaceholder('Type keywords to start searching');
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

 // Search keyboard navigation
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

 // ===== Font size =====
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

 // ===== Touch swipe to close the sidebar =====
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

 // ===== Chapter navigation =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'Previous chapter'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'Next chapter'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== Print =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== Global keyboard shortcuts =====
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

 // Close dialogs when clicking the backdrop
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
 // The browser already handles printing
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

 // ===== Reading streak tracking =====
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

 // Show the streak toast
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 Day ' + streak + ' of a reading streak. Keep it up!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage may be unavailable */ }
 }
 updateStreak();

 // ===== Backup/restore =====
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
 // Collect health check states
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // Collect chapter completion states
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // Collect bookmarks
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // Collect ratings
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'PhoneClass-reading-backup_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('Backup export failed: ' + e.message);
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
 // Restore health check states
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // Restore chapter completion states
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
 // Restore bookmarks
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('Restore succeeded! The page will reload to apply all data.');
 location.reload();
 } catch(err) {
 alert('Restore failed: invalid file format. ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('Clear all reading data? This cannot be undone! Export a backup first.')) return;
 if (!confirm('Confirm again: all reading progress, bookmarks and ratings will be deleted. Continue?')) return;
 localStorage.clear();
 alert('All data cleared. The page will reload.');
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

 // ===== Chapter rating system =====
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
 // Insert after the h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== Scroll debounce optimization =====
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

 // ===== Follow system dark mode =====
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

 // ===== Auto-add breadcrumbs and difficulty tags to every chapter title =====
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
 
 ${level === 'beginner' ? 'Beginner' : level === 'intermediate' ? 'Intermediate' : 'Advanced'}
 </span>
 <span class="reading-time">
 ~${minutes} min read
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== Add a “summary” block to chapters =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">Chapter summary</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['Foldables are mature but not mainstream - a “nice to have”, not a “must have”', 'Folding across = phone + tablet; folding along = portability + cover-screen glance', 'Best for: heavy reading/business/hover creation/women who value portability', 'Six checks when buying: hinge type, UTG inner screen, crease, cover screen size, weight and thickness, after-sales repair price', 'Exclusive tricks: split-screen multitasking, 90-degree hover, cover-screen glance, PC mode', 'Care essentials: avoid opening and closing in low temperature, keep grit out of the screen, never put an ordinary film on the inner screen, keep the hinge dust-free', 'Set expectations: the crease is permanent, it is heavier and thicker, battery life is average, resale value is low, repairs are costly', 'Buying philosophy: you buy it for its unique form, not because it is “more advanced”'],
 'di-ling-zhang': ['Know this book’s position: a plain-spoken, hands-on tech guide', 'Learn the symbol system: what [buttons], >, bold and italic mean', 'Why phone capacity “shrinks”: the main reasons', 'Build the habit of writing down your own phone’s specs', 'Phone = a digital asset vault; prevention first is the core idea', 'Data is often worth more than the hardware itself'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + modem and other modules in one chip', 'CPU big and little cores work together: balanced performance and battery life', 'Screen: OLED/LCD, refresh rate, auto brightness', 'Imaging core: sensor size matters more than pixel count', 'Port evolution: Micro USB → Lightning → unified USB-C', '5G-A brings the new capability of “integrated sensing and communication”'],
 'di-yi-zhang-harmony': ['HarmonyOS = a distributed operating system, designed for many devices from day one', 'HarmonyOS 4.3 is AOSP-compatible and can run Android apps', 'HarmonyOS NEXT is fully independent and no longer supports Android apps', 'Before upgrading, make sure your frequently used apps have native versions'],
 'di-er-zhang': ['Three-tier storage: device / SD card / cloud', 'What common Android folders mean (DCIM, Download, etc.)', 'Data backup = cloud backup + local backup, double protection', 'Deleting is not destroying; only “overwriting” truly erases', 'Quick reference to common file formats (image/audio/video/document)', '“Date + event” naming is the baseline convention', '72-hour auto cleanup solves social app cache build-up', 'Double protection for photos: mosaic/masking + EXIF stripping'],
 'di-san-zhang': ['4G/5G each have their place; 5G-A is the enhanced version', 'Key technical differences of Wi-Fi 6/6E/7', 'Public Wi-Fi demands caution; avoid entering sensitive information', 'Bluetooth 5.x keeps improving, LE Audio has started to spread', 'NFC works within 10cm; physical proximity is the security guarantee'],
 'di-si-zhang': ['App installs: official app stores first', 'An APK package = certificate + resources + config + binary', 'Be careful with “cleaner/booster” apps; apps staying in the background can be reasonable', 'App signature verification prevents tampering: system-level protection', 'Pure mode = only official store installs allowed; the first wall against malware', '“Digital parasites” refers to cracked software with trojans planted inside', 'App store review mechanism: virus scan + permission review + developer verification'],
 'di-wu-zhang': ['Display: resolution, refresh rate, auto brightness', 'Sound: ringtone/media/notification volumes managed separately', 'Storage: regularly clean cache and unneeded files', 'Biometrics: fingerprint vs face; 3D beats 2D in security', 'Screen readers: iOS VoiceOver / Android TalkBack are the eyes of visually impaired users', 'Magnification: high contrast, bold text and color filters - the trio', 'AI image description: let AI read images, menus and captchas for you', 'Live Captions: a savior for hearing-impaired users and noisy environments', 'RTT/TTY: people who have lost their voice or hearing can still make calls'],
 'di-liu-zhang': ['Lock screen password + two-factor authentication are the baseline defense', 'App permissions: enable as needed, least-privilege principle', 'No payments or logins over public Wi-Fi', 'In the AI era seeing is not believing: face and voice clones, fake authority and fake investments are the most common tricks', 'Defense playbook: action verification + secret code check + second confirmation', 'Strip photos before sharing: turn off location and device info in EXIF', 'IoT devices: change the default password', 'When scammed, remember: do not trust easily, do not disclose, do not transfer'],
 'di-qi-zhang-jichu': ['Satellite messaging: the “lifeline” in emergencies', 'Off-network comms: long-distance walkie-talkie without any network', 'Crash detection: sensor fusion recognizes severe collisions', 'StarFlash: low-latency wireless connection with huge potential'],
 'di-ba-zhang': ['Call recording: mind legal compliance', 'iMessage/RCS upgrades ordinary SMS into rich media', 'WeChat chat history needs its built-in backup feature', 'Mail apps support unified multi-account management', 'Spam blocking: system detection + black/white lists + SMS keyword filtering', 'iOS Silence Unknown Callers blocks strange spam, but watch out for missed calls', 'Wrong spam labels can be appealed via Dianhua Bang/360/Tencent and carrier channels'],
 'di-jiu-zhang': ['WPS Office works best in China, Microsoft 365 has the best compatibility', 'Notes in three stages: jot down → read later → knowledge system', 'Phone scanning: Notes/Mic Lens/Baimiao/CamScanner', 'Cloud storage mix: iCloud/OneDrive/Baidu/Aliyun Drive each fit different needs'],
 'di-shi-zhang': ['Whoever sees the payment code gets the money - never screenshot it for anyone', '5-minute security checkup: biometric payment + security lock + password-free payment check + device management', 'On buses and subways, prefer a virtual transit card in your phone wallet; it works offline too', 'Medical insurance e-certificate, pension queries, annual tax filing - all doable on a phone', 'Four anti-scam rules: never transfer to a “safe account”, never send payment codes, never tap unknown links, never give bank card numbers'],
 'di-shi-yi-zhang': ['Four common mistakes: dirty lens, no exposure control, flash overuse, misused digital zoom', 'Night mode relies on multi-frame merging; hold steady for 2-4 seconds', 'Pro mode: lower ISO gives cleaner image quality; the shutter controls light', 'Post workflow: correct → basic adjustments → local retouch → stylize', 'Smart search + regular cleanup + manual albums = the photo management trio'],
 'di-shi-yi-zhang-advanced': ['The three elements of video: resolution, frame rate, bitrate', 'H.265 improves compression by 50% over H.264', 'ProRes is Apple’s professional codec; files are huge', 'HDR10/10+/Dolby Vision each serve their own niche'],
 'di-shi-er-zhang': ['NetEase Cloud Music leads for playlists, QQ Music has the widest catalog, Apple Music is clean and lossless, Spotify has strong recommendations', 'Xiaoyuzhou is the first choice for Chinese-language podcasts; make good use of speed boost + auto cleanup', 'Local video: VLC (all formats) or nPlayer (gesture control)', 'WeChat Read highlights are social + Kindle sync; always turn on eye-care mode', 'Game mode keeps the frame rate smooth first; a cooling clip helps an overheating phone'],
 'di-shi-san-zhang': ['Productivity tools: to-dos + pomodoro + calendar', 'Health and fitness: Apple Health/Google Fit as the data hub', 'Browser: Edge first, paired with Copilot to boost productivity', 'Search fact from fake: trust official domains, avoid cheap suffixes like .xyz', 'Prefer built-in cleanup; third-party apps like Qingzhuo are supplements only - never one-tap wipe all', 'Anti-harassment apps: National Anti-Fraud Center + brand guards + carrier blocking', 'Built-in blocking: iOS Silence Unknown Callers; enable it inside each Android brand’s phone app', 'Three layers combined: system blocking + carrier + anti-fraud center; mind the whitelist to avoid false positives', 'Weather alerts: system weather app + official meteorological channels; respond by the blue/yellow/orange/red levels', 'Natural disaster alerts: weather + emergency channels; in heavy rain or typhoon stay away from low-lying areas and billboards', 'Earthquake early warning is not prediction: seconds to tens of seconds ahead; on Android it is usually in security settings', 'TickTick: lists + calendar + pomodoro, natural-language scheduling', 'Paper scanning: system camera/Scan Genie/Lens; shoot sharp, then OCR', 'Remote PC control: Sunflower/ToDesk; a stranger asking you to install remote control = scam', 'AI office work: Trae and more; heavy work on the computer, follow up remotely from the phone', 'LAN fast transfer: LocalSend/AirDrop/Feige; clipboard: KDE Connect/brand tools', '2FA one-time codes: Aegis/Microsoft Authenticator, keep paper copies of backup codes'],
 'di-shi-si-zhang': ['A password manager means remembering only one master password', 'Bitwarden is open source and free, 1Password has the best experience', 'A master password must be long and complex, with two-factor authentication enabled', 'Run a password security audit regularly', 'Zero-knowledge architecture: even the provider cannot see your passwords; encryption happens locally', 'AES-256 + PBKDF2/Argon2 key derivation are the bedrock of password vault security', 'The LastPass 2022 incident is a warning: users with weak master passwords were at most risk', 'Password strength is about “entropy”: length + randomness beats complex symbols', 'HaveIBeenPwned checks leaks, 1Password Watchtower monitors breaches', 'Passkeys are built on FIDO2/WebAuthn: phishing-resistant, no password transmitted', 'Passkey cross-device sync: iCloud Keychain/Google Password Manager already support it', 'Hardware keys (YubiKey/Titan) resist phishing and SIM hijack - ideal for high-risk users', '1Password shared vaults + Bitwarden emergency access make family and team sharing safer'],
 'di-shi-wu-zhang': ['Lithium batteries: charge as you go, avoid heat, they age', 'Below 80% battery health, runtime drops noticeably', 'Fast-charge protocols: PD/QC/VOOC/SuperCharge are not interchangeable', 'Qi2 wireless charging introduces magnetic alignment', 'Battery-saving core: lower screen brightness + close background apps + switch to 4G'],
 'di-shi-liu-zhang': ['Your account is the household register of your digital life, tying together contacts, photos, purchases and Find My Phone', 'Three musts: turn on 2FA, set a recovery key, confirm Find My Phone is enabled', 'iCloud 5GB fills up fast: clean up, or upgrade to 50GB for about ¥1/month', 'Sync is two-way (delete here, gone everywhere), backup is a one-way snapshot (delete here, it stays)', 'Android users, check separately: brand cloud backup, Google backup, WeChat backup'],
 'di-shi-qi-zhang': ['Cross-device work: Apple AirDrop/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/Link to Windows', 'Cast to TV: iPhone uses Screen Mirroring, Android uses wireless casting; if it fails, check you are on the same Wi-Fi', 'Smartwatch = notification filter + health hub + wrist payments; one for your parents may save the day', 'Choose smart home by ecosystem: Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'Linkage safety: mind privacy when casting in public, and unbind old devices promptly'],
 'di-shi-ba-zhang': ['Full-device backup: computer local (most reliable) + cloud (least worry), double protection', 'WeChat chat history is the most special case: only WeChat’s own backup carries it over; migration tools cannot', 'The 3-2-1 backup rule: 3 copies, 2 kinds of media, 1 off-site', 'Phone switch: same brand uses the official migration app; across brands, prepare a data relay in advance'],
 'di-shi-jiu-zhang': ['Lag and overheating in four steps: recall recent changes → check storage → check power drain → check signal', 'App crash routine: close and reopen → update → check permissions → clear cache → reinstall', 'Will not charge: clean the port first, then swap cable and plug to locate the fault', 'No network: toggle airplane mode → forget the Wi-Fi and reconnect → reboot the router', 'The universal restart fixes most odd problems; choose authorized repair points, and back up plus sign out before handing it in'],
 'di-er-shi-zhang-jinjie': ['Developer mode: tap the build number 7 times to enable', 'BL lock: vendor security protection; unlock with caution', 'Root: the risk outweighs the benefit; not recommended for ordinary users', 'Magisk still needs BL unlocked, but can hide root status'],
 'di-er-shi-yi-zhang': ['VPN = an encrypted tunnel; a free VPN may instead steal your data', 'Public Wi-Fi man-in-the-middle defense: prefer HTTPS, turn off auto-connect, use mobile data for sensitive tasks', 'The HTTPS handshake encrypts in four round trips, but phishing sites can use HTTPS too', 'DoH/DoT encrypt DNS queries so your carrier cannot snoop on your browsing', 'Incognito mode = a local eraser, not an invisibility cloak; your ISP and websites still see you', 'Security checklist: turn off auto Wi-Fi connect, switch to encrypted DNS, enable 2FA, audit app permissions, block Juice Jacking'],
 'di-er-shi-er-zhang': ['AI camera: detect the scene → merge multiple frames → smart optimization', 'Voice assistants: hear clearly → understand → execute, three steps', 'On-device AI: fast, privacy-friendly, works offline', 'Large AI models span chat/writing/translation/image/study scenarios', 'Typical uses: live translation, AI eraser, AI photo editing, document processing, AI image search', 'CRISPE prompt framework: role + request + background + output + tone + examples', 'With AI, beware of hallucinations and privacy leaks', '“Role-Background-Task-Constraints” is an easier prompt-writing approach', 'Traits of a good prompt: specific, with context, with format, with constraints, verifiable'],
 'di-er-shi-san-zhang': ['Automation elements: trigger + action + optional decision logic', 'iOS Shortcuts: one-tap morning routine, auto low-power mode, scan-to-log expenses', 'Android: auto clickers (screen macros), Tasker (the most powerful automation), MacroDroid (beginner friendly)', 'Pitfalls: imprecise location triggers, iOS needs manual confirmation to auto-run, Tasker needs accessibility permission', 'Automation mindset: turn repetitive chores into condition → action, and the phone becomes your personal assistant'],
 'di-er-shi-si-zhang': ['The Bootloader is the gatekeeper at startup; signature verification prevents tampering', 'BL unlock policies differ by brand (Xiaomi allows it/Huawei locks it)', 'Root options: Magisk/KernelSU/SuperSU', 'Three flashing types: official ROM/third-party recovery/third-party ROM'],
 'di-er-shi-wu-zhang': ['Selling an old phone: back up first → sign out → encrypt and erase → fill and erase again', 'Digital legacy: iCloud Legacy Contact/Google Inactive Account Manager', 'Recycling: prefer official trade-in programs; old phones can serve as cameras or navigators'],
 'di-er-shi-liu-zhang': ['Three standards for AI phones: on-device large model, NPU TOPS, AI Agent across apps', 'Vendor AI strategies: Apple/Google/Huawei/Xiaomi/OPPO/vivo each have strengths', 'Satellite messaging: BeiDou short messages now reach mid-range phones; Tiantong calls remain flagship-only', 'Foldables: mature hardware, apps about 70% adapted, hover/split-screen is the unique experience', '6G is still on the way, Wi-Fi 7 has landed, Bluetooth LE Audio is spreading', 'Silicon-carbon anode batteries make 5000-6000mAh standard on flagships'],
 'di-er-shi-qi-zhang': ['Turn on easy mode or enlarge fonts/icons first; once the setup fits, most problems disappear', 'Three iron rules for teaching elders: never rush, use analogies, write it down', 'Six common scams to warn about again and again; three defense lines block 90% of fraud', 'Remote assistance lets you fix your parents’ phone even from another city', 'WeChat Care mode + voice input are the two most useful features for elders', 'SOS emergency call and fall detection: configurations that can save lives at the key moment'],
 'di-er-shi-ba-zhang': ['Three-step phone choice: define needs → set budget → pick the model', 'Only five core specs: processor, screen, camera, battery and charging, system update promise', '¥1500-3500 is the best value and the most recommended sweet spot', 'Last year’s flagship is a better deal than this year’s mid-range', 'Five traps: multi-camera hype, megapixel myth, carrier customization, curved-screen worship, AI gimmicks', '618 and Double 11 are the two best time windows of the year to buy a phone'],
 'di-er-shi-jiu-zhang': ['First look at screen-time data; seeing the status clearly is the first step to change', 'Set limits for entertainment apps and timers for Do Not Disturb, and take back your attention', 'The 20-20-20 rule is the simplest and most effective eye-care habit', 'Looking down at a phone puts 5-6 times head weight on the neck; raise the phone and stretch your neck regularly', 'No phone for 1 hour before bed; put the charger out of arm’s reach', 'The antidote to information anxiety is “active blocking”, not “getting more”'],
 'di-san-shi-zhang': ['Wireless casting camps: AirPlay (Apple), Miracast (Android), DLNA (cross-platform media push)', 'Wired casting is steadier with zero lag; keep an HDMI adapter for meeting rooms', 'Samsung DeX/Huawei Desktop mode turn a phone into a light office PC', 'Car connectivity: four options - CarPlay/Android Auto/HiCar/CarLife', 'Meeting-room casting rules: test in advance, prepare plan B, turn off notification previews'],
 'di-san-shi-yi-zhang': ['Before shooting, be clear: who is the audience, what value you offer, which platform you post on', 'Before filming: 1080P/30fps, clean the lens, lock focus and exposure, pick orientation, turn on the grid', 'Five camera moves: push, pull, pan, move, follow - stability comes first', 'Editing with CapCut: trim → transitions → captions → BGM → export, six steps', 'The first 3 seconds decide everything; one video tells one story; persistence beats talent'],
 'di-san-shi-er-zhang': ['Lost phone golden 30 minutes: borrow a phone to call it, remote lock, suspend the SIM, freeze payments, notify family and friends, report to police', '72 hours after a scam: stop transfers, keep evidence, call 96110, report to police, contact the bank, change passwords', 'Phone infected: safe mode → uninstall suspicious apps → security scan → factory reset (last resort)', 'Account stolen: change password → sign out devices → check login history → enable 2FA → review linked accounts → review payments', '99.9% of ransom messages are scams: do not reply, do not pay, screenshot and block', 'AI face/voice swap scams: watch for flaws in blinking, mouth shape, edges and lighting; ask them to turn their head, cover their face, ask private questions, call back a known number', 'SIM swap hijack: be alert if the phone suddenly shows “No service”; set a SIM PIN, enable carrier second-factor verification, move key accounts to authenticator apps', 'Five daily habits: lock screen + 2FA, Find My Phone, SIM PIN, no unknown apps, regular backups', 'Earthquake/extreme weather: shelter nearby first, then evacuate; a text message saves more battery than a long call', 'With no signal, prefer satellite SOS (if the model supports it); see Chapter 13 for alerts and settings'],
 'di-san-shi-san-zhang': ['Vision Pro and AR glasses are new computing entry points beyond the phone, but will not replace it soon', 'Brain-computer interfaces are still 10-20 years from consumers; ethics mature before technology', 'Phones are evolving toward “invisibility”, from device-centric to identity-centric', 'AI ethics, data sovereignty and the digital divide are the core issues of the next decade', 'Stay connected and stay independent - the unchanging philosophy of digital life'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // Skip chapters that already have an inline summary, to avoid duplicates
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== Copy button (added to kbd elements) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'Copy');
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

 // ===== Collapsible long content (h4 level) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // Only collapse long h4 sections
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // Add the collapse header
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

 // ===== Learning dashboard: reading progress + phone health self-check =====
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
 // Reading progress
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // Bookmark count
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // Last chapter
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // Health self-check
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'Full marks! Your phone security is in great shape';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'Nice! ' + (totalChecks - checked) + ' items left to polish';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'Passable - prioritize the unchecked security items';
 else healthMsgEl.innerHTML = 'Your phone has security gaps - fix them soon';
 }
 }

 // Restore check states
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // Refresh every 3 seconds (catches chapter check changes)
 setInterval(updateDashboard, 3000);

 // ===== Text-to-speech (TTS) =====
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
 // Clone and remove elements that should not be read aloud
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // Remove collapsed bodies but keep their text content
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('Sorry, your browser does not support text-to-speech. Try Chrome or Edge.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'Untitled chapter';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'en-US';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // Try to use a more natural English voice
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('en'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // Auto-play the next chapter
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
 // Find the currently visible chapter
 if (ttsSectionIndex < 0) {
 // Start from the beginning or from the chapter nearest the scroll position
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
 ttsLabel.textContent = 'Not started';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // Event bindings
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
 // Recreate and play the current section
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

 // Keyboard shortcut: press R to toggle read-aloud
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

 // ===== Initialization =====
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

