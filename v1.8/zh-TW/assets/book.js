
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

 // ===== 主題 =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? '切換到淺色模式' : '切換到深色模式';
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

 // ===== 捲動：進度 + 陰影 + 返回頂部 + 目錄進度 + 進度環 =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} 章`;

 // 進度環參數
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

 // 進度環更新
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

 // 閱讀到第幾章
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} 章`;
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

 // ===== 閱讀位置記憶 =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // 太靠前不儲存
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // 找到目前章節名
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

 // 頁面載入時還原位置
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
 restoreToastText.textContent = `上次讀到：${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // 10秒後自動隱藏
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

 // ===== 捲動入場動畫 =====
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
 // 第一屏的內容直接可見
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== 側邊欄開啟/關閉 =====
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

 // 快捷工具：開啟目錄
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== 全域錨點導覽：補償固定導覽列偏移 =====
 // 必須用 scrollIntoView 而非手動算座標：.content-section 設了
 // content-visibility:auto + contain-intrinsic-size(0 800px)，螢幕外章節
 // 按 800px 佔位，getBoundingClientRect 拿到的是佔位座標，直接 scrollTo
 // 會落到錯誤位置（越靠後的章節累計偏差越大）。scrollIntoView 由瀏覽器
 // 負責按需渲染目標並定位，配合 html{scroll-padding-top:5rem} 抵消固定
 // 導覽列高度。
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // 第一步：instant 模式先強制渲染目標章節並定位，避免 content-visibility
 // 在 smooth 捲動過程中因延遲渲染導致定位漂移。
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // 第二步：在目標已渲染、座標穩定後，再觸發一次 smooth 捲動以獲得平滑體驗。
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

 // ===== 目錄摺疊 =====
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

 // ===== 目錄篩選 =====
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

 // ===== 目錄高亮 =====
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

 // ===== 書籤系統 =====
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

 // 為每個章節加入書籤按鈕
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? '已收藏' : '收藏') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? '取消收藏' : '收藏此章節');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? '已收藏' : '收藏';
 btn.setAttribute('aria-label', added ? '取消收藏' : '收藏此章節');
 // 更新側邊欄標記
 updateTocBookmark(id, added);
 });
 // 插入到 h3 後面
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // 初始化側邊欄書籤標記
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== 章節完成勾選 =====
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
 // 找到 meta 列或 h3 前面的元素
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? '已讀' : '標記已讀') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? '取消已讀' : '標記為已讀');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? '已讀' : '標記已讀';
 check.setAttribute('aria-label', done ? '取消已讀' : '標記為已讀');
 // 更新側邊欄
 updateTocCompleted(id, done);
 // 更新完成進度
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
 // 也更新完成數顯示
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} 章`;
 }
 }

 // ===== 搜尋（強化：鍵盤導覽 + 結果計數） =====
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
 renderSearchPlaceholder('輸入關鍵詞開始搜尋');
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
 renderSearchPlaceholder('未找到相關內容');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">找到 ${results.length} 個結果</div>`;
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
 renderSearchPlaceholder('輸入關鍵詞開始搜尋');
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

 // 搜尋鍵盤導覽
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

 // ===== 字號 =====
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

 // ===== 觸控滑動關閉側邊欄 =====
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

 // ===== 章節導覽 =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || '上一章'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || '下一章'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== 列印 =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== 全域鍵盤快速鍵 =====
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

 // 點擊遮罩關閉彈窗
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
 // 瀏覽器已經處理列印
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

 // ===== 閱讀連續天數追蹤 =====
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

 // 顯示連續天數提示
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 連續閱讀第 ' + streak + ' 天！堅持下去！';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage 可能無法使用 */ }
 }
 updateStreak();

 // ===== 備份/還原功能 =====
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
 // 收集健康自我檢測狀態
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // 收集章節完成狀態
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // 收集書籤
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // 收集評分
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = '手機課閱讀備份_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('備份匯出失敗：' + e.message);
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
 // 還原健康自我檢測
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // 還原章節完成狀態
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
 // 還原書籤
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('還原成功！頁面將重新載入以套用所有資料。');
 location.reload();
 } catch(err) {
 alert('還原失敗：檔案格式不正確。' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('確定清除所有閱讀資料嗎？此操作不可復原！建議先匯出備份。')) return;
 if (!confirm('再次確認：所有閱讀進度、書籤、評分將被刪除。確定繼續嗎？')) return;
 localStorage.clear();
 alert('所有資料已清除。頁面將重新載入。');
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

 // ===== 章節評分系統 =====
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
 // 插入到 h3 後面
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== scroll 防抖最佳化 =====
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

 // ===== 跟隨系統深色模式 =====
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

 // ===== 自動為每個章節標題加上麵包屑與難度標籤 =====
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
 const cnChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
 const minutes = Math.max(2, Math.round(cnChars / 400));

 const meta = document.createElement('div');
 meta.className = 'flex flex-wrap items-center gap-2 mb-2 text-xs';
 meta.innerHTML = `
 <span class="difficulty-tag difficulty-${level}">
 
 ${level === 'beginner' ? '入門' : level === 'intermediate' ? '進階' : '高階'}
 </span>
 <span class="reading-time">
 約 ${minutes} 分鐘
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== 為章節新增「小結」區塊 =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">本章小結</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['摺疊螢幕已成熟但非主流，是「錦上添花」而非「雪中送炭」的裝置', '橫向摺疊=手機+平板，縱向摺疊=便攜+外屏速覽', '適合：重度閱讀/商務/懸停創作/追求便攜的女性使用者', '選購六看：鉸鏈類型、UTG 內屏、摺痕、外屏尺寸、重量厚度、售後維修價', '獨有玩法：分割螢幕多工、90 度懸停、外屏速覽、電腦模式', '保養核心：低溫別開合、防異物夾屏、內屏別貼普通膜、鉸鏈防塵', '心理預期：摺痕永存、更重更厚、續航一般、保值率低、維修貴', '選購哲學：買它是因為需要獨特形態，不是因為它「更先進」'],
 'di-ling-zhang': ['明確本書定位：會說話、能動手的數位科普', '掌握符號系統：[按鈕]、>、粗體、斜體的含義', '瞭解手機容量「縮水」的幾個主要原因', '養成動手記下自己手機配置的習慣', '手機 = 數位資產庫，預防為主的核心理念', '資料價值往往超過硬體本身'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + 基頻等模組的整合', 'CPU 大小核協同工作：效能與續航兼顧', '螢幕 OLED/LCD、更新率、HDR 的差異', '影像系統核心：感測器尺寸 > 畫素數', '介面演進：Micro USB → Lightning → USB-C 統一', '5G-A 帶來「通感一體」新能力'],
 'di-yi-zhang-harmony': ['鴻蒙 = 分散式作業系統，從設計就考慮多裝置', '鴻蒙 4.3 相容 AOSP，可執行安卓 App', '鴻蒙 NEXT 完全自主，不再支援安卓應用', '升級前務必確認常用 App 已有原生版本'],
 'di-er-zhang': ['三層儲存體系：機身 / SD 卡 / 雲端', '安卓常見資料夾的含義（DCIM、Download 等）', '資料備份 = 雲端備份 + 本機備份雙保險', '刪除不等於銷毀，要「覆寫」才能真正擦除', '常見檔案格式速查（圖片/音訊/影片/文件）', '「時間+事件」命名法是基本規範', '72小時自動清理解決社交 App 快取堆積', '圖片雙重保護：打碼 + EXIF 剝離'],
 'di-san-zhang': ['4G/5G 各有定位，5G-A 是增強版', 'Wi-Fi 6/6E/7 的關鍵技術差異', '公共 Wi-Fi 必須警惕，避免輸入敏感資訊', '藍牙 5.x 持續升級，LE Audio 已開始普及', 'NFC 工作距離 10cm 以內，本質是物理安全保障'],
 'di-si-zhang': ['App 安裝首選官方應用程式商店', 'APK 安裝包 = 憑證 + 資源 + 設定檔 + 二進位檔', '慎用「清理加速」類 App，常駐後台是合理的', '應用簽章驗證防竄改是系統級保護', '純淨模式 = 只允許官方商店安裝，是防惡意軟體第一道牆', '「電子寄生蟲」特指被植入木馬的破解版軟體', '應用程式商店審核機制：病毒掃描+權限審核+開發者認證'],
 'di-wu-zhang': ['顯示：解析度、更新率、自動亮度調節', '聲音：鈴聲/媒體/通知音量分開管理', '儲存：定期清理快取和不需要的檔案', '生物辨識：指紋 vs 臉部，安全性 3D > 2D', '螢幕閱讀器：iOS 旁白 / 安卓 TalkBack 是視障使用者的眼睛', '放大：高對比、粗體、色彩濾鏡三件套', 'AI 影像描述：讓 AI 幫忙讀圖、辨識菜單與驗證碼', '即時字幕：聽障使用者與嘈雜環境的救星', 'RTT/TTY：失聲+失聰使用者也能打電話'],
 'di-liu-zhang': ['鎖屏密碼 + 雙重認證是基礎防線', '應用權限按需開啟，最小化授權原則', '公共 Wi-Fi 不進行支付/登入操作', 'AI 時代眼見不為實：換臉擬聲、冒充權威、虛假投資是最常見的套路', '破局思路：動作驗證+暗號核驗+二次核實', '照片分享前先去敏，關閉 EXIF 中的位置與裝置資訊', 'IoT 裝置必須改預設密碼', '遇到詐騙牢記：不輕信、不洩漏、不轉帳'],
 'di-qi-zhang-jichu': ['衛星通訊：緊急情況下的「救命稻草」', '無網通：遠距離對講，無網路也可通訊', '車禍偵測：感測器融合識別嚴重碰撞', '星閃：低延遲無線連接，潛力巨大'],
 'di-ba-zhang': ['通話錄音注意法律合規', 'iMessage/RCS 讓傳統簡訊升級為富媒體', '微信聊天記錄需用自帶備份功能', '郵件帳戶支援多帳號統一管理', '騷擾攔截：系統識別 + 黑白名單 + 簡訊關鍵詞過濾', 'iOS 靜音未知來電可擋陌生騷擾，但需留意漏接', '誤標記可透過電話邦/360/騰訊及電信業者渠道申訴'],
 'di-jiu-zhang': ['WPS Office 在國內體驗最佳，Microsoft 365 相容性最好', '筆記三階段策略：隨手記→稍後讀→知識體系', '手機掃描：備忘錄/Mic Lens/白描/全能掃描王', '雲端硬碟按需組合：iCloud/OneDrive/百度/阿里雲盤各有適用場景'],
 'di-shi-zhang': ['付款碼誰看誰收錢，千萬別截圖發給任何人', '5分鐘安全體檢：生物支付+安全鎖+免密支付檢查+裝置管理', '公車地鐵優先用手機錢包虛擬交通卡，離線也能刷', '醫保電子憑證、社保查詢、個稅彙算手機上都能搞定', '防騙四不：不轉帳到安全帳戶、不發付款碼、不點陌生連結、不給銀行卡號'],
 'di-shi-yi-zhang': ['四個常見錯誤：鏡頭髒、不調曝光、濫用閃光燈、誤用數位變焦', '夜景模式靠多幀合成，手持要穩 2-4 秒', '專業模式：ISO 越低畫質越好，快門控光', '後製工作流：校正→基礎調整→局部精修→風格化', '智慧搜尋+定期清理+手動建相簿=照片管理三件套'],
 'di-shi-yi-zhang-advanced': ['影片三要素：解析度、幀率、位元率', 'H.265 比 H.264 壓縮率提升 50%', 'ProRes 是 Apple 專業編碼，檔案巨大', 'HDR10/10+/Dolby Vision 各有定位'],
 'di-shi-er-zhang': ['網易雲主打歌單社區，QQ 音樂版權最全，Apple Music 簡潔無損，Spotify 推薦演算法強', '小宇宙是中文播客首選，善用倍速+自動清理', '本機影片用 VLC（全格式）或 nPlayer（手勢控制）', '微信讀書劃線社交+Kindle 同步，護眼模式必開', '遊戲模式優先保證幀率流暢，手機發燙可用散熱背夾'],
 'di-shi-san-zhang': ['效率工具：待辦+番茄鐘+日曆', '健康運動：Apple 健康/Google Fit 是資料中樞', '瀏覽器首選 Edge，搭配 Copilot 提升效率', '搜尋辨真偽：認準官方網域，避免 .xyz 等廉價後綴', '清理優先系統自帶；清濁等第三方只作補充，勿一鍵全清', '防騷擾實用軟體：國家反詐中心 + 品牌管家 + 電信業者防騷擾', '手機自帶騷擾攔截：iOS 靜音未知來電；安卓各品牌電話 App 內開啟', '三層疊加：系統攔截 + 電信業者 + 反詐中心，注意白名單防誤殺', '天氣預警：系統天氣 App+官方氣象渠道，藍黃橙紅四級應對', '自然災害預警：氣象+應急多渠道，暴雨颱風遠離低窪與廣告牌', '地震預警≠地震預報：提前數秒到數十秒；安卓多在安全設定中開啟', '滴答清單：清單+日曆+番茄鐘，自然語言建日程', '紙本掃描：系統相機/掃描全能王/Lens，拍清再 OCR', '遠端控制電腦：向日葵/ToDesk；陌生人叫你裝遠控=詐騙', 'AI 辦公：Trae 等；重活在電腦，手機可遠端跟進', '區域網路快傳：LocalSend/隔空投送/飛鴿；剪貼簿：KDE Connect/品牌互傳', '2FA動態密碼：Aegis/Microsoft Authenticator，備用碼紙本雙份'],
 'di-shi-si-zhang': ['密碼管理員只需記一個主密碼', 'Bitwarden 開源免費，1Password 體驗好', '主密碼要長且複雜，並開啟雙重認證', '定期做密碼安全稽核', '零知識架構：服務商也看不到你的密碼，加密在本機完成', 'AES-256 + PBKDF2/Argon2 衍生函數是密碼庫的安全基石', 'LastPass 2022 事件警示：主密碼太弱的使用者最危險', '密碼強度看「熵」：長度+隨機性 > 複雜符號', 'HaveIBeenPwned 查洩漏，1Password Watchtower 監控異常', 'Passkey 基於 FIDO2/WebAuthn，抗釣魚且無需傳輸密碼', 'Passkey 跨裝置同步：iCloud 鑰匙圈/Google 密碼管理員已支援', '硬體金鑰（YubiKey/Titan）抗釣魚抗 SIM 劫持，適合高敏感人群', '1Password 共享保險庫 + Bitwarden 緊急存取，家庭團隊共享更安全'],
 'di-shi-wu-zhang': ['鋰電池：隨用隨充，怕熱，會老化', '健康度低於 80% 續航明顯變短', '快充協議：PD/QC/VOOC/SuperCharge 互不通用', '無線充電 Qi2 引入磁吸定位', '省電核心：調低螢幕亮度+關後台+切 4G'],
 'di-shi-liu-zhang': ['帳號是數位生活的戶口名簿，牽著通訊錄、照片、購買紀錄、尋找手機', '三個必須：開啟雙重認證、設復原金鑰、確認尋找手機已開啟', 'iCloud 5GB 不夠用，清理或升級 50GB/每月 6 元', '同步是雙向的（刪了都刪），備份是單向快照（刪了還在）', '安卓使用者要分別檢查：品牌雲端備份、Google 備份、微信備份'],
 'di-shi-qi-zhang': ['跨裝置協同：Apple AirDrop/華為多屏協同/小米妙享/連接至 Windows', '投放至電視：iPhone 用螢幕鏡像，安卓用無線投放，失敗時檢查同一 Wi-Fi', '智慧手錶 = 通知過濾+健康站+腕上支付，給爸媽買一個可能救急', '智慧家庭按生態選：Apple HomeKit/小米米家/華為鴻蒙智聯', '聯動安全：公共場合投放注意隱私，舊裝置及時解綁'],
 'di-shi-ba-zhang': ['整機備份：電腦本機（最可靠）+ 雲端（最省心）雙保險', '微信聊天記錄最特殊：必須用微信自帶備份，換機工具搬不了', '三二一備份法則：3 份資料、2 種儲存媒體、1 份異地', '換機：同品牌用官方換機 App，跨品牌提前做好資料中轉準備'],
 'di-shi-jiu-zhang': ['卡頓發熱四步走：關聯回想→查儲存→查耗電→看訊號', '應用閃退標準處理流程：關掉重開→更新→查權限→清快取→重新安裝', '充不進電先清潔充電口，換線/換頭交叉測試定位問題', '網路連不上：開關飛航模式→忘記 Wi-Fi 重連→重新啟動路由器', '萬能重啟大法解決大部分奇怪問題，維修選官方授權點，送修前備份+登出帳號'],
 'di-er-shi-zhang-jinjie': ['開發者模式：連點版本號 7 次開啟', 'BL 鎖：廠商安全保護，解鎖需謹慎', 'Root 風險大於收益，一般使用者不建議', 'Magisk 仍需解 BL，但可隱藏 Root 狀態'],
 'di-er-shi-yi-zhang': ['VPN = 加密隧道，免費 VPN 反而可能偷你的資料', '公共 Wi-Fi 防中間人攻擊：認 HTTPS、關自動連線、敏感事用行動數據', 'HTTPS 交握四次對話完成加密，但釣魚網站也能用 HTTPS', 'DoH/DoT 加密 DNS 查詢，防止電信業者偷看你的上網紀錄', '無痕模式 = 本機擦除器，不是網路隱身衣，ISP 和網站依然看得到你', '安全清單：關自動連 Wi-Fi、換加密 DNS、開 2FA、查 App 權限、防 Juice Jacking'],
 'di-er-shi-er-zhang': ['AI 相機：辨識場景→多幀合成→智慧最佳化', '語音助理：聽清→聽懂→執行三步', '裝置端 AI：速度快、隱私好、可離線', 'AI 大模型分通用對話/寫作/翻譯/影像/學習場景', '典型應用舉例：即時翻譯、AI 消除、AI 修圖、文件處理、AI 搜圖', 'CRISPE 提示詞框架：角色+請求+背景+輸出+語氣+示例', '使用 AI 要警惕幻覺與隱私洩漏', '「角色-背景-任務-限制」是更容易上手的提示詞溝通思路', '好提示詞的特徵：具體、含背景、有格式、有限制、可驗證'],
 'di-er-shi-san-zhang': ['自動化要素：觸發條件 + 執行動作 + 可選判斷邏輯', 'iOS 捷徑：一鍵早安流程、自動省電模式、掃碼記帳', '安卓：自動點擊器（螢幕巨集）、Tasker（最強自動化）、MacroDroid（新手友善）', '踩雷：位置觸發不準、iOS 不自動執行需手動確認、Tasker 需無障礙權限', '自動化思維：把重複勞動變成條件→動作，手機就是你的私人助理'],
 'di-er-shi-si-zhang': ['Bootloader 是啟動守門人，簽章驗證防竄改', 'BL 解鎖各品牌政策不同（小米可/華為鎖）', 'Root 方案：Magisk/KernelSU/SuperSU', '刷機三類型：官方 ROM/第三方 Recovery/第三方 ROM'],
 'di-er-shi-wu-zhang': ['賣舊手機：先備份→登出帳號→加密擦除→填充再擦除', '數位遺產：iCloud 遺產聯絡人/Google 非活躍帳戶', '回收優先官方以舊換新，舊機還可當監控/導航'],
 'di-er-shi-liu-zhang': ['AI 手機三標準：裝置端大模型、NPU 算力 TOPS、AI Agent 跨 App 場景', '各廠商 AI 戰略：Apple/Google/華為/小米/OPPO/vivo 各有所長', '衛星通訊：北斗短報文下放中階，天通通話仍屬旗艦', '摺疊螢幕：硬體成熟、App 適配七成、懸停/分割螢幕是獨有體驗', '6G還在發展中，Wi-Fi 7已落地，藍牙LE Audio開始普及', '矽碳負極電池讓 5000-6000mAh 成為旗艦標配'],
 'di-er-shi-qi-zhang': ['先開簡易模式或手動調大字體/圖示，環境調好大半問題就沒了', '帶長輩用手機三鐵律：別催、用類比、寫下來', '六大常見騙局要反覆提醒，三道防線能擋掉 90% 詐騙', '遠端協助讓你人在外地也能幫爸媽修手機', '微信關懷模式+語音輸入是長輩最實用的兩個功能', 'SOS 緊急求助與跌倒偵測，關鍵時刻救命的設定'],
 'di-er-shi-ba-zhang': ['選機三板斧：先想需求→再定預算→最後挑機型', '核心參數只看五項：處理器、螢幕、相機、電池充電、系統更新承諾', '1500-3500元是CP值最高、最推薦的甜點價位帶', '買去年的旗艦比買今年的中階更划算', '五大坑：多鏡頭騙局、高畫素陷阱、電信業者客製化、曲面螢幕迷信、AI 噱頭', '618和雙11是一年中最適合買手機的兩個時間窗口'],
 'di-er-shi-jiu-zhang': ['先看螢幕使用時間資料，認清現狀是改變的第一步', '給娛樂 App 設限額，給勿擾模式設定時，重新掌控注意力', '20-20-20法則是最簡單有效的護眼習慣', '低頭看手機時脖子承重 5-6 倍，舉高手機+定期活動脖子', '睡前 1 小時不看手機，充電器放到伸手搆不到的地方', '資訊焦慮的解藥是「主動屏蔽」，不是「獲取更多」'],
 'di-san-shi-zhang': ['無線投放三陣營：AirPlay（Apple）、Miracast（安卓）、DLNA（跨平台推媒體）', '有線投放更穩定零延遲，會議室場景必備轉 HDMI 線', 'Samsung DeX/華為桌面模式讓手機變身輕辦公電腦', '車載互聯：CarPlay/Android Auto/HiCar/CarLife 四大方案', '會議室投放鐵律：提前測試、準備 Plan B、關閉通知預覽'],
 'di-san-shi-yi-zhang': ['拍之前想清楚：觀眾是誰、提供什麼價值、在哪個平台發', '開拍 5 件事：1080P/30fps、擦鏡頭、鎖定對焦曝光、確定橫豎、開網格線', '運鏡五招：推、拉、搖、移、跟——穩是第一要務', '剪輯用剪映：裁剪→轉場→字幕→BGM→匯出，六步走', '前 3 秒定生死，一條影片只講一件事，堅持比天賦重要'],
 'di-san-shi-er-zhang': ['手機遺失黃金 30 分鐘：借手機撥打→遠端鎖定→掛失 SIM 卡→凍結支付→通知親友→報警', '被騙後 72 小時：停止轉帳→保留證據→撥 96110→報警→聯絡銀行→改密碼', '手機中毒：安全模式→解除安裝可疑 App→安全掃描→回復原廠設定（終極方案）', '帳號被盜：改密碼→踢除裝置→查登入紀錄→開雙重認證→查綁定→查支付', '勒索訊息 99.9% 是詐騙，不回覆不付錢，截圖封鎖', 'AI 換臉/擬聲詐騙：看眨眼/嘴型/邊緣/光影破綻，讓對方轉頭遮臉、問私密問題、回撥已知號碼', 'SIM swap 劫持：手機突然「無服務」即要警覺；設 SIM 卡 PIN、開電信業者二次驗證、重要帳號改用驗證器 App', '日常預防五件事：鎖屏+2FA、尋找手機、SIM 卡 PIN、不裝來歷不明 App、定期備份', '地震/極端天氣：先就近避險再撤離，簡訊報平安比長通話省電', '無訊號時優先衛星 SOS（機型支援）；預警與設定見第十三章'],
 'di-san-shi-san-zhang': ['Vision Pro 與 AR 眼鏡是手機之外的新運算入口，但短期難以取代手機', '腦機介面距離消費級還有 10-20 年，倫理問題先於技術成熟', '手機正向「隱身」方向進化，從裝置中心走向身分中心', 'AI 倫理、資料主權、數位鴻溝是未來 10 年的核心議題', '保持連線也保持獨立，是數位生活不變的哲學'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // 跳過已有內聯小結的章節，避免重複
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== 複製按鈕（加在 kbd 元素上） =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', '複製');
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

 // ===== 可摺疊長內容（h4 級別） =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // 只對內容較長的 h4 段落加入摺疊
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // 加入摺疊頭
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

 // ===== 學習儀表板：閱讀進度 + 手機健康自我檢測 =====
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
 // 閱讀進度
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // 書籤數
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // 上次章節
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // 健康自我檢測
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = '滿分！你的手機安全狀況優秀';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = '不錯！還有 ' + (totalChecks - checked) + ' 項可以完善';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = '及格，建議優先處理未勾選的安全項';
 else healthMsgEl.innerHTML = '你的手機存在安全隱患，請盡快完善';
 }
 }

 // 還原自我檢測狀態
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // 每 3 秒重新整理一次（捕捉章節完成勾選的變化）
 setInterval(updateDashboard, 3000);

 // ===== 語音朗讀（TTS）=====
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
 // 複製並移除不需朗讀的元素
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // 移除摺疊本體但保留其文字內容
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('抱歉，你的瀏覽器不支援語音朗讀功能。建議使用 Chrome 或 Edge 瀏覽器。');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : '未命名章節';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'zh-TW';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // 嘗試使用更自然的中文語音
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('zh-TW') || v.lang.startsWith('zh-HK') || v.lang.startsWith('zh-CN'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // 自動播放下一章節
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
 // 找到目前可見章節
 if (ttsSectionIndex < 0) {
 // 從頭開始或從目前捲動位置最近的章節開始
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
 ttsLabel.textContent = '未開始';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // 事件繫結
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
 // 重新建立並播放目前段落
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

 // 鍵盤快速鍵：按 R 鍵切換朗讀
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

 // ===== 初始化 =====
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

