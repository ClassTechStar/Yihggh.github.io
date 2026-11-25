
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

 // ===== テーマ =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
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

 // ===== スクロール：進捗＋影＋トップへ戻る＋目次進捗＋プログレスリング =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} 章`;

 // プログレスリングのパラメータ
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

 // プログレスリングの更新
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

 // 何章まで読んだか
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

 // ===== 読書位置の記憶 =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // 先頭付近は保存しない
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // 現在の章名を取得
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

 // ページ読み込み時に位置を復元
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
 restoreToastText.textContent = `前回読んだところ：${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // 10秒後に自動的に隠す
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

 // ===== スクロール出現アニメーション =====
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
 // ファーストビューの内容は最初から表示
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== サイドバーの開閉 =====
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

 // クイックツール：目次を開く
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== グローバルアンカーナビゲーション：固定ナビバーのオフセット補正 =====
 // 手動で座標計算せず scrollIntoView を使う：.content-section に
 // content-visibility:auto + contain-intrinsic-size(0 800px) のため、画面外の章は
 // 800px のプレースホルダーになり、getBoundingClientRect はその座標を返すため、直接 scrollTo
 // 誤った位置に落ちる（後ろの章ほどズレが累積）。scrollIntoView はブラウザが
 // 対象を必要に応じてレンダリングして位置決めし、html{scroll-padding-top:5rem} で固定
 // ナビバーの高さ。
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // 第一段階：instant モードで対象の章を強制レンダリングして位置決めし、content-visibility による
 // smooth スクロール中の遅延レンダリングによる位置ズレを防ぐ。
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // 第二段階：対象のレンダリングと座標が安定した後、smooth スクロールを再度実行して滑らかにする。
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

 // ===== 目次の折りたたみ =====
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

 // ===== 目次のフィルター =====
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

 // ===== 目次のハイライト =====
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

 // ===== ブックマーク機能 =====
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

 // 各章にブックマークボタンを追加
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'ブックマーク済み' : 'ブックマーク') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'ブックマーク解除' : 'この章をブックマーク');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'ブックマーク済み' : 'ブックマーク';
 btn.setAttribute('aria-label', added ? 'ブックマーク解除' : 'この章をブックマーク');
 // サイドバーの表示を更新
 updateTocBookmark(id, added);
 });
 // h3 の後に挿入
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // サイドバーのブックマーク表示を初期化
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== 章の完了チェック =====
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
 // meta バーまたは h3 の前の要素を見つける
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? '読了' : '読了にする') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? '未読に戻す' : '読了としてマーク');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? '読了' : '読了にする';
 check.setAttribute('aria-label', done ? '未読に戻す' : '読了としてマーク');
 // サイドバーを更新
 updateTocCompleted(id, done);
 // 完了進捗を更新
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
 // 完了数の表示も更新
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} 章`;
 }
 }

 // ===== 検索（強化：キーボードナビゲーション＋結果カウント） =====
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
 renderSearchPlaceholder('キーワードを入力して検索');
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
 renderSearchPlaceholder('関連する内容が見つかりません');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">${results.length} 件見つかりました</div>`;
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
 renderSearchPlaceholder('キーワードを入力して検索');
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

 // 検索のキーボードナビゲーション
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

 // ===== 文字サイズ =====
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

 // ===== スワイプでサイドバーを閉じる =====
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

 // ===== 章ナビゲーション =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || '前の章'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || '次の章'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== 印刷 =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== グローバルキーボードショートカット =====
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

 // オーバーレイをクリックでモーダルを閉じる
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
 // ブラウザが印刷を処理済み
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

 // ===== 連続読書日数のトラッキング =====
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

 // 連続日数のトーストを表示
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 連続読書 ' + streak + ' 日目！この調子で！';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage が利用できない場合がある */ }
 }
 updateStreak();

 // ===== バックアップ/復元機能 =====
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
 // 健康セルフチェック状態を収集
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // 章の完了状態を収集
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // ブックマークを収集
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // 評価を収集
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'スマホ教室_読書バックアップ_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('バックアップの書き出しに失敗：' + e.message);
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
 // 健康セルフチェックを復元
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // 章の完了状態を復元
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
 // ブックマークを復元
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('復元成功！ページを再読み込みしてすべてのデータを適用します。');
 location.reload();
 } catch(err) {
 alert('復元に失敗：ファイル形式が正しくありません。' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('すべての読書データを消去しますか？この操作は元に戻せません！先にバックアップを書き出すのをおすすめします。')) return;
 if (!confirm('再確認：すべての読書進捗、ブックマーク、評価が削除されます。続行しますか？')) return;
 localStorage.clear();
 alert('すべてのデータを消去しました。ページを再読み込みします。');
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

 // ===== 章の評価システム =====
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
 // h3 の後に挿入
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== scroll デバウンス最適化 =====
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

 // ===== システムのダークモード追従 =====
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

 // ===== 各章見出しにパンくずリストと難易度ラベルを自動追加 =====
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
 
 ${level === 'beginner' ? '入門' : level === 'intermediate' ? '応用' : '上級'}
 </span>
 <span class="reading-time">
 約 ${minutes} 分
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== 章に「まとめ」ブロックを追加 =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">この章のまとめ</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['フォルダブルは成熟したが主流ではなく、「上積み」であって「困った時の救い」ではない', '横開き＝スマホ＋タブレット、縦開き＝携帯性＋外ディスプレイクイックビュー', '向いている人：ヘビーリーダー/ビジネス/ハーフオープン創作/携帯性重視の女性ユーザー', '選び方の6ポイント：ヒンジ方式、UTG内ディスプレイ、折り目、外ディスプレイサイズ、重量厚み、修理価格', '独自の使い方：分割マルチウィンドウ、90度ハーフオープン、外ディスプレイクイックビュー、デスクトップモード', '保守の要旨：低温で開閉しない、異物挟み込み防止、内側ディスプレイに普通フィルムを貼らない、ヒンジの防塵', '心の準備：折り目は残る、より重く厚い、バッテリーは並み、下取り額は低い、修理は高い', '選択哲学：買うのは独自のフォームファクターが必要だからで、「より先進」だからではない'],
 'di-ling-zhang': ['本書の位置づけ：話せて手も動かせるデジタル解説書', '記号システムを理解：[ボタン]、>、太字、斜体の意味', 'スマホ容量が「目減り」する主な理由を知る', '自分のスマホ構成を自分でメモする習慣をつける', 'スマホ＝デジタル資産庫、予防第一が核心の考え方', 'データの価値はハードウェア本体を上回ることが多い'],
 'di-yi-zhang': ['SoC＝CPU＋GPU＋NPU＋ISP＋モデムなどの集積', 'CPUのビッグ・リトルコア連携：性能とバッテリー持ちの両立', 'ディスプレイ OLED/LCD、リフレッシュレート、HDRの違い', 'カメラ系統の核心：センサーサイズ＞画素数', '端子の進化：Micro USB → Lightning → USB-C へ統一', '5G-Aは「通信・センシング融合」の新機能をもたらす'],
 'di-yi-zhang-harmony': ['HarmonyOS＝分散型OS、設計段階から複数デバイスを考慮', 'HarmonyOS 4.3はAOSP互換、Androidアプリが動く', 'HarmonyOS NEXTは完全に独自、Androidアプリは非対応', 'アップグレード前に常用アプリのネイティブ版の有無を必ず確認'],
 'di-er-zhang': ['3層ストレージ体系：本体/SDカード/クラウド', 'Androidのよくあるフォルダの意味（DCIM、Downloadなど）', 'データバックアップ＝クラウド＋ローカルの二重対策', '削除は消滅ではない、「上書き」して初めて本当に消える', 'よくあるファイル形式クイックリファレンス（画像/音声/動画/文書）', '「日時+イベント」の命名規則が基本', '72時間の自動クリアでSNSアプリのキャッシュ滞積を解消', '写真の二重保護：モザイク＋EXIF削除'],
 'di-san-zhang': ['4G/5Gはそれぞれ役割があり、5G-Aは強化版', 'Wi-Fi 6/6E/7の主要な技術差', '公衆Wi-Fiは要注意、機密情報の入力を避ける', 'Bluetooth 5.xは継続進化、LE Audioが普及し始めた', 'NFCの通信距離は10cm以内、本質は物理的なセキュリティ'],
 'di-si-zhang': ['アプリは公式ストアから入れるのが第一', 'APKパッケージ＝証明書＋リソース＋設定ファイル＋バイナリ', '「クリーンアップ/高速化」系アプリは要注意、常駐は正常な動作', 'アプリ署名検証による改ざん防止はシステムレベルの保護', 'ピュアモード＝公式ストアからのみインストール許可、マルウェア対策の最初の壁', '「電子寄生虫」とは、マルウェアを仕込まれた改造版アプリのこと', 'アプリストアの審査体制：ウイルススキャン＋権限審査＋開発者認証'],
 'di-wu-zhang': ['ディスプレイ：解像度、リフレッシュレート、自動明るさ調整', 'サウンド：着信音/メディア/通知の音量を別々に管理', 'ストレージ：キャッシュと不要ファイルを定期的に整理', '生体認証：指紋 vs 顔、安全性は3D＞2D', 'スクリーンリーダー：iOSのVoiceOver/AndroidのTalkBackが視覚障害者の目になる', '拡大：高コントラスト、太字、カラーフィルターの3点セット', 'AI画像説明：AIが画像読み上げ、メニュー判読、認証コード判別を支援', 'リアルタイム字幕：聴覚障害ユーザーと騒がしい環境の救世主', 'RTT/TTY：声を失った人や聴覚障害のある人も電話ができる'],
 'di-liu-zhang': ['ロック画面パスワード＋二要素認証が基本の防衛線', 'アプリ権限は必要な分だけ、最小権限の原則', '公衆Wi-Fiでは決済/ログインをしない', 'AI時代は見ても信じられない：顔すり替え・声真似・権威詐称・投資詐欺が横行', '打開策：動作確認＋合言葉検証＋二次確認', '写真共有前に個人情報をマスク、EXIFの位置と端末情報をオフに', 'IoT機器は初期パスワードを必ず変更', '詐欺に遭ったら覚える：うのみにしない、情報を出さない、送金しない'],
 'di-qi-zhang-jichu': ['衛星通信：緊急時の「命綱」', '電波なし通信：遠距離トランシーバー、ネットなしでも通信可能', '車両事故検知：センサーフュージョンで重大な衝突を識別', 'NearLink（星閃）：低遅延ワイヤレス接続、可能性は大きい'],
 'di-ba-zhang': ['通話録音は法令遵守に注意', 'iMessage/RCSで従来のSMSがリッチメッセージに進化', 'WeChatのチャット履歴は公式バックアップ機能を使う', 'メールアカウントは複数の一元管理に対応', '迷惑ブロック：システム判定＋ブラック/ホワイトリスト＋SMSキーワードフィルター', 'iOSの不明な発信者を消音で迷惑電話を防げるが、取りこぼしに注意', '誤表示は電話邦/360/騰訊やキャリアの窓口で申し立て可能'],
 'di-jiu-zhang': ['WPS Officeは中国国内で最高の体験、Microsoft 365は互換性が最良', 'ノート3段階戦略：とりあえず記録→あとで読む→知識体系化', 'スマホスキャン：メモ/Microsoft Lens/白描/全能掃描王', 'クラウドストレージは目的別に組み合わせ：iCloud/OneDrive/百度/阿里雲盤、それぞれ得意な用途'],
 'di-shi-zhang': ['支払いQRは見せた人に金が入る、絶対にスクショして送らない', '5分のセキュリティチェック：生体認証決済＋安全ロック＋パスワードレス決済確認＋デバイス管理', 'バス・地下鉄はスマホウォレットの仮想交通カード優先、オフラインでも使える', '医保電子証憑、社保照会、個税確定申告もスマホで完結', '詐欺防止の4つのしない：「安全口座」に送らない、支払いQRを見せない、知らないリンクを押さない、カード番号を教えない'],
 'di-shi-yi-zhang': ['あるある4つ：レンズの汚れ、露出調整なし、フラッシュの乱用、デジタルズームの誤用', 'ナイトモードはマルチフレーム合成、2〜4秒しっかり保持', 'プロモード：ISOは低いほど画質が良く、シャッターで光を制御', '現像ワークフロー：補正→基本調整→部分仕上げ→スタイル化', 'スマート検索＋定期整理＋手動アルバム作成＝写真管理の3点セット'],
 'di-shi-yi-zhang-advanced': ['動画の3要素：解像度、フレームレート、ビットレート', 'H.265はH.264より圧縮率が50%向上', 'ProResはAppleのプロ用コーデック、ファイルは巨大', 'HDR10/10+/Dolby Visionはそれぞれ役割が違う'],
 'di-shi-er-zhang': ['網易雲はプレイリストコミュニティ、QQ音楽は楽曲ラインナップ最大、Apple Musicはシンプルでロスレス、Spotifyはレコメンドが強い', '小宇宙は中国語Podcastの第一選、倍速＋自動クリアを活用', 'ローカル動画はVLC（全形式）かnPlayer（ジェスチャー操作）', 'WeChat読書はハイライト共有＋Kindle同期、目保護モードは必ずオン', 'ゲームモードはフレームレートの安定を優先、本体が熱くなったら冷却ファンを'],
 'di-shi-san-zhang': ['生産性ツール：TODO＋ポモドーロ＋カレンダー', '健康・運動：Appleヘルス/Google Fitがデータのハブ', 'ブラウザーはEdgeが第一、Copilotと併用で効率アップ', '検索で真偽を見分ける：公式ドメインを確認、.xyzなどの安価なTLDを避ける', 'クリーンアップは標準機能優先、Qingzhuoなどサードパーティは補助に、一括全消去は避ける', '迷惑対策アプリ：国家反詐欺センター＋ブランド管理アプリ＋キャリアの迷惑防止', 'スマホ標準の迷惑ブロック：iOSは不明な発信者を消音、Androidは各ブランドの電話アプリで有効化', '3層の重ね掛け：システムブロック＋キャリア＋反詐欺センター、誤ブロック防止にホワイトリスト', '気象警報：標準天気アプリ＋公式気象窓口、青黄橙赤の4段階で対応', '自然災害警報：気象＋防災の複数経路、豪雨・台風時は低地と看板から離れる', '地震警報≠地震予報：数秒〜数十秒の猶予。Androidは多くセキュリティ設定で有効化', 'TickTick（滴答清單）：TODO＋カレンダー＋ポモドーロ、自然言語で予定作成', '紙のスキャン：標準カメラ/スキャン王/Lens、はっきり撮ってからOCR', 'PCリモート操作：向日葵/ToDesk。知らない人にリモート操作アプリを入れろと言われたら詐欺', 'AI仕事術：Traeなど。重い作業はPCで、スマホから遠隔フォロー', 'LAN高速転送：LocalSend/AirDrop/飛鴿伝書；クリップボード：KDE Connect/ブランド間転送', '2FAワンタイムコード：Aegis/Microsoft Authenticator、バックアップコードは紙で2部'],
 'di-shi-si-zhang': ['パスワードマネージャーなら覚えるのはマスターパスワード1つだけ', 'Bitwardenはオープンソース無料、1Passwordは使い心地が良い', 'マスターパスワードは長く複雑にし、二要素認証も有効に', 'パスワードのセキュリティ監査を定期的に', 'ゼロ知識アーキテクチャ：提供元にもパスワードは見えず、暗号化はローカルで完結', 'AES-256＋PBKDF2/Argon2 の鍵導出関数がパスワード管理の安全の要', 'LastPassの2022年事件の教訓：弱いマスターパスワードの利用者が最も危険', 'パスワード強度は「エントロピー」：長さ＋無作為性＞複雑な記号', 'HaveIBeenPwnedで流出を確認、1Password Watchtowerで異常を監視', 'PasskeyはFIDO2/WebAuthn準拠、フィッシング耐性がありパスワード送信も不要', 'Passkeyのデバイス間同期：iCloudキーチェーン/Googleパスワードマネージャーが対応済み', 'ハードウェアキー（YubiKey/Titan）はフィッシングとSIM乗っ取りに強く、高リスク層に最適', '1Passwordの共有ボールト＋Bitwardenの緊急アクセスで家族共有がより安全'],
 'di-shi-wu-zhang': ['リチウム電池：こまめな充電OK、熱に弱く、経年劣化する', '健康状態が80%を下回るとバッテリー持ちが明らかに短くなる', '急速充電規格：PD/QC/VOOC/SuperChargeは互換なし', 'ワイヤレス充電Qi2は磁石アライメントを導入', '省電力の要：画面輝度を下げる＋バックグラウンド停止＋4Gへ切替'],
 'di-shi-liu-zhang': ['アカウントはデジタル生活の戸籍簿、連絡先・写真・購入履歴・端末探しを束ねる', '3つの必須：二要素認証を有効化、回復キーを設定、「探す」が有効か確認', 'iCloud 5GBでは足りない、整理するか50GB（月6元）へアップグレード', '同期は双方向（削除したら両方消える）、バックアップは一方向のスナップショット（消しても残る）', 'Androidユーザーは個別に確認：ブランドクラウドバックアップ、Googleバックアップ、WeChatバックアップ'],
 'di-shi-qi-zhang': ['デバイス間連携：Apple AirDrop/Huaweiマルチスクリーン連携/Xiaomi妙享/Windowsへの接続', 'TVへキャスト：iPhoneは画面ミラーリング、Androidは無線キャスト、失敗したら同じWi-Fiか確認', 'スマートウォッチ＝通知フィルタ＋健康ステーション＋手首で決済、ご両親への贈り物がいざという時に役立つ', 'スマートホームはエコシステムで選ぶ：Apple HomeKit/Xiaomi Mi Home/Huawei HarmonyOS Connect', '連携のセキュリティ：公共の場での画面出しはプライバシーに注意、古い端末は早めに解除'],
 'di-shi-ba-zhang': ['端末全体のバックアップ：PCローカル（最も確実）＋クラウド（手間いらず）の二重対策', 'WeChatのチャット履歴が最も特別：公式バックアップ必須、機種変更ツールでは移せない', '3-2-1バックアップ法：データ3部、保存媒体2種類、遠隔地1か所', '機種変更：同じブランドは公式アプリ、別ブランドは事前にデータ中継の準備'],
 'di-shi-jiu-zhang': ['動作重い・発熱の4ステップ：関連操作を思い出す→ストレージ確認→電力消費確認→電波確認', 'アプリ強制終了の標準フロー：再起動→更新→権限確認→キャッシュ削除→再インストール', '充電できない場合はまず充電ポートを掃除、ケーブル/アダプター交換でクロステストして原因特定', 'ネットにつながらない：機内モード切替→Wi-Fiを再接続→ルーター再起動', '再起動は大抵の奇妙な不具合を解決。修理は正規サービス窓口を選び、持込前にバックアップ＋アカウントをログアウト'],
 'di-er-shi-zhang-jinjie': ['開発者モード：ビルド番号を7回連続タップで有効化', 'BLロック：メーカーの保護機能、解除は慎重に', 'Rootはリスクが利益を上回る、一般ユーザーには非推奨', 'MagiskもBL解除は必要だが、Root状態を隠せる'],
 'di-er-shi-yi-zhang': ['VPN＝暗号化トンネル。無料VPNはかえってデータを盗む恐れ', '公衆Wi-Fiの中間者攻撃対策：HTTPS確認、自動接続オフ、重要操作はモバイル回線', 'HTTPSは4回のハンドシェイクで暗号化するが、フィッシングサイトもHTTPSを使える', 'DoH/DoTでDNS問い合わせを暗号化し、キャリアからの閲覧を防ぐ', 'シークレットモード＝ローカル消去のみ、ネット上の隠れ蓑ではない、ISPとサイトには見えている', 'セキュリティチェックリスト：Wi-Fi自動接続オフ、暗号化DNSへ変更、2FA有効化、アプリ権限確認、Juice Jacking対策'],
 'di-er-shi-er-zhang': ['AIカメラ：シーン認識→マルチフレーム合成→AI最適化', '音声アシスタント：聞き取る→理解する→実行するの3段階', 'オンデバイスAI：速い、プライバシーに強い、オフライン対応', 'AI大規模モデルは汎用対話/執筆/翻訳/画像/学習に分かれる', '代表的な活用例：リアルタイム翻訳、AI消去、AI写真補正、文書処理、AI画像検索', 'CRISPEプロンプト框架：役割＋要望＋背景＋出力＋口調＋例', 'AIの利用ではハルシネーションとプライバシー流出に注意', '「役割-背景-タスク-制約」は取り組みやすいプロンプトの考え方', '良いプロンプトの特徴：具体的、背景あり、形式あり、制約あり、検証可能'],
 'di-er-shi-san-zhang': ['自動化の要素：トリガー条件＋実行アクション＋任意の判断ロジック', 'iOSショートカット：ワンタップおはようフロー、自動省電力モード、QRコードで記帳', 'Android：自動タップ（画面マクロ）、Tasker（最強の自動化）、MacroDroid（初心者向け）', '落とし穴：位置トリガーの精度、iOSは手動確認が必要で自動実行されない、Taskerはアクセシビリティ権限が必要', '自動化の考え方：繰り返しの作業を条件→動作に、スマホがあなたの秘書に'],
 'di-er-shi-si-zhang': ['Bootloaderは起動の門番、署名検証で改ざんを防ぐ', 'BL解除はブランドごとに方針が異なる（Xiaomi可/Huawei不可）', 'Rootの方法：Magisk/KernelSU/SuperSU', 'ROM書き換えの3類型：公式ROM/サードパーティRecovery/サードパーティROM'],
 'di-er-shi-wu-zhang': ['古いスマホを売る：バックアップ→アカウントログアウト→暗号化消去→ダミーデータ充填後再消去', 'デジタル遺産：iCloudの遺産連絡先/Googleの非利用アカウント', '回収は公式の下取り優先、古い端末は監視カメラ/ナビとして再利用も'],
 'di-er-shi-liu-zhang': ['AIスマホの3条件：オンデバイス大規模モデル、NPU性能TOPS、AI Agentのアプリ横断', '各社のAI戦略：Apple/Google/Huawei/Xiaomi/OPPO/vivo、それぞれ得意分野あり', '衛星通信：北斗短メッセージはミドル帯にも、天通通話はフラッグシップのまま', 'フォルダブル：ハードは成熟、アプリ対応は7割、ハーフオープン/分割表示が独自体験', '6Gはまだ先、Wi-Fi 7は実用化、Bluetooth LE Audioが普及し始めた', 'シリコンカーボン負極バッテリーで5000〜6000mAhがフラッグシップの標準に'],
 'di-er-shi-qi-zhang': ['まずイージーモードか手動で文字/アイコンを大きく、環境を整えるだけで問題の大半は消える', '高齢者とスマホの3鉄則：急かさない、たとえ話、書き留める', '6大よくある詐欺は繰り返し注意、3つの防衛線で9割の詐欺を防げる', 'リモートサポートで遠くにいてもご両親のスマホをお助け', 'WeChatの介護モード＋音声入力が高齢者に最も実用的な2機能', 'SOS緊急通報と転倒検知、いざという時に命を救う設定'],
 'di-er-shi-ba-zhang': ['機種選びの3段階：まずニーズ→次に予算→最後に機種', '見るべき核心スペックは5つ：SoC、ディスプレイ、カメラ、バッテリー充電、OSアップデート保証', '1500〜3500元はコスパ最高の狙い目ゾーン', '昨年のフラッグシップの方が今年のミドルレンジよりお得', '5つの罠：多レンズ詐欺、高画素の落とし穴、キャリア版、曲面ディスプレイ信仰、AI看板', '618とダブル11は1年でスマホ購入に最適な2つのタイミング'],
 'di-er-shi-jiu-zhang': ['まずスクリーンタイムのデータを見る、現状把握が変化の第一歩', '娯楽アプリに使用制限、おやすみモードにタイマー設定、注意力を取り戻す', '20-20-20ルールが最も簡単で効果的な目の保護習慣', 'うつむいてスマホを見ると首に5〜6倍の負担、スマホを高く持ち＋定期的に首を動かす', '寝る1時間前からスマホを見ない、充電器は手の届かない所へ', '情報過多の不安の解消は「能動的に遮断」すること、「多く得る」ことではない'],
 'di-san-shi-zhang': ['無線キャストの3勢力：AirPlay（Apple）、Miracast（Android）、DLNA（クロスプラットフォーム）', '有線キャストはより安定で遅延ゼロ、会議室にはHDMI変換ケーブル必携', 'Samsung DeX/Huaweiのデスクトップモードでスマホが軽オフィスPCに', '車載接続：CarPlay/Android Auto/HiCar/CarLifeの4方式', '会議室での画面出しの鉄則：事前テスト、プランB準備、通知プレビューをオフ'],
 'di-san-shi-yi-zhang': ['撮る前に整理：誰が見るか、どんな価値を届けるか、どのプラットフォームに載せるか', '撮り始めの5つ：1080P/30fps、レンズを拭く、フォーカス露出ロック、縦横決め、グリッド線オン', 'カメラワーク5種：プッシュ、プル、パン、トラック、フォロー——安定が最優先', '編集は剪映（CapCut）：トリミング→トランジション→テロップ→BGM→書き出しの6ステップ', '最初の3秒で命運が決まる、1本の動画で伝えるのは1つのこと、続けることが才能より大事'],
 'di-san-shi-er-zhang': ['スマホ紛失のゴールデン30分：他人のスマホで発信→リモートロック→SIM停止→決済凍結→知人へ連絡→警察届出', '詐欺被害後72時間：送金停止→証拠保全→96110に電話→警察届出→銀行連絡→パスワード変更', 'スマホのウイルス感染：セーフモード→怪しいアプリ削除→セキュリティスキャン→初期化（最終手段）', 'アカウント乗っ取り：パスワード変更→端末を強制ログアウト→ログイン履歴確認→二要素認証有効化→連携確認→決済確認', '脅迫メッセージの99.9%は詐欺、返信せず払わず、スクショしてブロック', 'AI顔偽造/音声偽造詐欺：まばたき・口の形・輪郭・光影の違和感をチェックし、顔を背けさせたり、プライベートな質問や既知の番号へのコールバックで確認', 'SIMスワップ乗っ取り：急に「圏外」になったら警戒。SIMカードPIN設定、キャリアの二段階認証、重要アカウントは認証アプリへ', '日常予防の5つ：ロック+2FA、端末を探す、SIM PIN、出所不明アプリを入れない、定期バックアップ', '地震・極端な天気：まず近くで避難、その後避離。安否は長電話よりSMSが省電力', '電波がない時は衛星SOSを優先（対応機種のみ）；警報と設定は第13章参照'],
 'di-san-shi-san-zhang': ['Vision ProとARグラスはスマホ以外の新しいコンピューティング入口だが、短期間でスマホを置き換えるのは難しい', 'ブレイン・マシン・インターフェースは消費者向けまで10〜20年、倫理問題が技術成熟に先行', 'スマホは「不可視」化へ進化、デバイス中心からアイデンティティ中心へ', 'AI倫理、データ主権、デジタル格差は今後10年の核心課題', 'つながりつつ自立も保つ、デジタル生活の変わらぬ哲学'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // インラインまとめのある章はスキップし重複を避ける
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== コピーボタン（kbd 要素に追加） =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'コピー');
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

 // ===== 折りたたみ可能な長文（h4 レベル） =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // 内容の長い h4 段落にのみ折りたたみを追加
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // 折りたたみヘッダーを追加
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

 // ===== ラーニングダッシュボード：読書進捗＋スマホ健康セルフチェック =====
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
 // 読書の進捗
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // ブックマーク数
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // 前回の章
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // 健康セルフチェック
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = '満点！スマホのセキュリティ状況は優秀です';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'いいですね！あと ' + (totalChecks - checked) + ' 項を改善できます';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = '及第点、未チェックのセキュリティ項目を優先的に対応を';
 else healthMsgEl.innerHTML = 'スマホにセキュリティリスクがあります。早めに対処しましょう';
 }
 }

 // セルフチェック状態を復元
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // 3秒ごとに更新（章の完了チェックの変化を検出）
 setInterval(updateDashboard, 3000);

 // ===== 音声読み上げ（TTS）=====
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
 // 読み上げ不要の要素を複製して削除
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // 折りたたみ本体を削除しつつテキストは残す
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('申し訳ありません、このブラウザーは音声読み上げに対応していません。ChromeかEdgeをおすすめします。');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'タイトルなしの章';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'ja-JP';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // より自然な日本語音声を使用する
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('ja'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // 次の章を自動再生
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
 // 現在表示中の章を見つける
 if (ttsSectionIndex < 0) {
 // 先頭、または現在のスクロール位置に最も近い章から開始
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
 ttsLabel.textContent = '未再生';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // イベントのバインド
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
 // 現在のセグメントを作り直して再生
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

 // キーボードショートカット：R キーで読み上げ切替
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

 // ===== 初期化 =====
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

