
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

 // ===== 테마 =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? '라이트 모드로 전환' : '다크 모드로 전환';
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

 // ===== 스크롤: 진행률 + 그림자 + 맨 위로 + 목차 진행률 + 진행 링 =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters}장`;

 // 진행 링 매개변수
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

 // 진행 링 갱신
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

 // 몇 장까지 읽었는지
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters}장`;
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

 // ===== 읽던 위치 기억 =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // 너무 앞이면 저장 안 함
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // 현재 챕터 이름 찾기
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

 // 페이지 로드 시 위치 복원
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
 restoreToastText.textContent = `마지막으로 읽은 곳: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // 10초 후 자동 숨김
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

 // ===== 스크롤 등장 애니메이션 =====
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
 // 첫 화면 내용은 바로 표시
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== 사이드바 열기/닫기 =====
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

 // 빠른 도구: 목차 열기
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== 전체 앵커 내비게이션: 고정 내비 바 오프셋 보정 =====
 // 수동 좌표 계산 대신 scrollIntoView 사용: .content-section에
 // content-visibility:auto + contain-intrinsic-size(0 800px), 화면 밖 챕터는
 // 800px 자리표시자이므로 getBoundingClientRect는 자리표시 좌표를 반환, 바로 scrollTo
 // 잘못된 위치에 도달함(뒤쪽 챕터일수록 오차 누적). scrollIntoView는 브라우저가
 // 대상을 필요 시 렌더링해 위치 지정, html{scroll-padding-top:5rem}로 고정
 // 내비 바 높이.
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // 1단계: instant 모드로 대상 챕터를 강제 렌더링해 위치 지정, content-visibility의
 // smooth 스크롤 중 지연 렌더링으로 인한 위치 밀림 방지.
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // 2단계: 대상 렌더링과 좌표가 안정되면 smooth 스크롤을 한 번 더 실행해 부드럽게.
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

 // ===== 목차 접기 =====
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

 // ===== 목차 필터 =====
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

 // ===== 목차 강조 =====
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

 // ===== 즐겨찾기 시스템 =====
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

 // 각 챕터에 즐겨찾기 버튼 추가
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? '즐겨찾기 됨' : '즐겨찾기') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? '즐겨찾기 취소' : '이 챕터 즐겨찾기');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? '즐겨찾기 됨' : '즐겨찾기';
 btn.setAttribute('aria-label', added ? '즐겨찾기 취소' : '이 챕터 즐겨찾기');
 // 사이드바 표시 갱신
 updateTocBookmark(id, added);
 });
 // h3 뒤에 삽입
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // 사이드바 즐겨찾기 표시 초기화
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== 챕터 완료 체크 =====
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
 // meta 바 또는 h3 앞의 요소 찾기
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? '읽음' : '읽음 표시') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? '읽음 취소' : '읽음으로 표시');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? '읽음' : '읽음 표시';
 check.setAttribute('aria-label', done ? '읽음 취소' : '읽음으로 표시');
 // 사이드바 갱신
 updateTocCompleted(id, done);
 // 완료 진행률 갱신
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
 // 완료 수 표시도 갱신
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters}장`;
 }
 }

 // ===== 검색(강화: 키보드 내비게이션 + 결과 개수) =====
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
 renderSearchPlaceholder('키워드를 입력해 검색하세요');
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
 renderSearchPlaceholder('관련 내용을 찾지 못했어요');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">${results.length}개 결과를 찾았어요</div>`;
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
 renderSearchPlaceholder('키워드를 입력해 검색하세요');
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

 // 검색 키보드 내비게이션
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

 // ===== 글자 크기 =====
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

 // ===== 터치 스와이프로 사이드바 닫기 =====
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

 // ===== 챕터 내비게이션 =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || '이전 장'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || '다음 장'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== 인쇄 =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== 전체 키보드 단축키 =====
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

 // 오버레이 클릭으로 팝업 닫기
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
 // 브라우저가 이미 인쇄 처리함
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

 // ===== 연속 독서 일수 추적 =====
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

 // 연속 일수 알림 표시
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 연속 독서 ' + streak + '일! 계속 이어가요!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage를 사용할 수 없을 수 있음 */ }
 }
 updateStreak();

 // ===== 백업/복원 기능 =====
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
 // 건강 자가 점검 상태 수집
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // 챕터 완료 상태 수집
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // 즐겨찾기 수집
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // 평점 수집
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = '스마트폰교실_읽기백업_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('백업 내보내기 실패:' + e.message);
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
 // 건강 자가 점검 복원
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // 챕터 완료 상태 복원
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
 // 즐겨찾기 복원
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('복원 성공! 모든 데이터를 적용하려면 페이지를 새로 고칩니다.');
 location.reload();
 } catch(err) {
 alert('복원 실패: 파일 형식이 올바르지 않아요.' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('모든 읽기 데이터를 지울까요? 이 작업은 되돌릴 수 없어요! 먼저 백업을 내보내길 권장해요.')) return;
 if (!confirm('다시 확인: 모든 읽기 진행률, 즐겨찾기, 평점이 삭제돼요. 계속할까요?')) return;
 localStorage.clear();
 alert('모든 데이터가 삭제됐어요. 페이지를 새로 고칩니다.');
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

 // ===== 챕터 평점 시스템 =====
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
 // h3 뒤에 삽입
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== scroll 디바운스 최적화 =====
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

 // ===== 시스템 다크 모드 따라가기 =====
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

 // ===== 각 챕터 제목에 브레드크럼과 난이도 라벨 자동 추가 =====
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
 
 ${level === 'beginner' ? '입문' : level === 'intermediate' ? '중급' : '고급'}
 </span>
 <span class="reading-time">
 약 ${minutes}분
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== 챕터에 "요약" 블록 추가 =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">이 장 요약</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['폴더블은 성숙했으나 주류가 아니에요, "화룡점정"이지 "눈 속의 숯"이 아니에요', '가로 접기 = 폰+태블릿, 세로 접기 = 휴대성 + 외부 화면 훑기', '적합: 고독서/비즈니스/접기 창작/휴대성 중시 여성 사용자', '구매 6확인: 힌지 방식, UTG 내부 화면, 접힘 자국, 외부 화면 크기, 무게·두께, 수리 비용', '고유 활용법: 분할 멀티태스킹, 90도 접기, 외부 화면 훑기, PC 모드', '관리 핵심: 저온에서 개폐 금지, 이물 끼임 방지, 내부 화면에 일반 필름 부착 금지, 힌지 방진', '심리 기대: 접힌 자국은 남고, 더 무겁고 두껍고, 배터리는 보통, 잔존가치 낮음, 수리 비쌈', '구매 철학: 사는 이유는 독특한 형태가 필요해서지 "더 앞선" 것 때문이 아니에요'],
 'di-ling-zhang': ['이 책의 위치: 말도 하고 직접 해볼 수 있는 디지털 해설서', '기호 체계 익히기: [버튼], >, 굵게, 기울임의 의미', '휴대폰 용량이 "줄어드는" 주요 원인 이해하기', '자기 휴대폰 사양을 직접 기록하는 습관 들이기', '휴대폰 = 디지털 자산 보관소, 예방 우선이 핵심 개념', '데이터의 가치는 하드웨어 자체를 넘을 때가 많아요'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + 베이스밴드 등 모듈의 집적', 'CPU 빅리틀 코어 협업: 성능과 배터리 효율 동시 확보', '화면 OLED/LCD, 주사율, HDR의 차이', '카메라 시스템 핵심: 센서 크기 > 화소 수', '포트 진화: Micro USB → Lightning → USB-C 통일', '5G-A는 "통신·감지 일체"의 새로운 기능을 가져와요'],
 'di-yi-zhang-harmony': ['하모니OS = 분산형 OS, 설계부터 다기기를 고려', '하모니OS 4.3은 AOSP 호환, 안드로이드 앱 실행 가능', '하모니OS NEXT는 완전 자체 개발, 안드로이드 앱 미지원', '업그레이드 전에 자주 쓰는 앱의 네이티브 버전 확인 필수'],
 'di-er-zhang': ['3층 저장 체계: 본체 / SD 카드 / 클라우드', '안드로이드 흔한 폴더의 의미(DCIM, Download 등)', '데이터 백업 = 클라우드 백업 + 로컬 백업 이중 보험', '삭제는 파기가 아니에요, "덮어쓰기"해야 진짜 지워져요', '흔한 파일 형식 빠른 참조(사진/오디오/영상/문서)', '"날짜+내용" 명명법이 기본 규범이에요', '72시간 자동 정리로 SNS 앱 캐시 축적을 해결해요', '사진 이중 보호: 모자이크 + EXIF 제거'],
 'di-san-zhang': ['4G/5G는 각자의 역할이 있고 5G-A는 강화판이에요', 'Wi-Fi 6/6E/7의 핵심 기술 차이', '공용 Wi-Fi는 경계 필수, 민감 정보 입력 피하기', '블루투스 5.x는 계속 발전, LE Audio는 보급 시작', 'NFC 작동 거리는 10cm 이내, 본질은 물리적 보안이에요'],
 'di-si-zhang': ['앱 설치는 공식 스토어가 우선이에요', 'APK 설치 패키지 = 인증서 + 리소스 + 설정 파일 + 바이너리', '"정리·가속"류 앱은 신중히, 상주 백그라운드는 정상', '앱 서명 검증으로 변조 방지, 시스템 수준 보호예요', '순정 모드 = 공식 스토어에서만 설치 허용, 악성 소프트웨어 방지의 첫 벽', '"전자 기생충"은 악성코드가 심어진 크랙 버전 앱을 가리켜요', '앱 스토어 심사 체계: 바이러스 검사 + 권한 심사 + 개발자 인증'],
 'di-wu-zhang': ['디스플레이: 해상도, 주사율, 자동 밝기 조절', '소리: 벨소리/미디어/알림 음량 개별 관리', '저장 공간: 캐시와 불필요 파일 주기적 정리', '생체 인식: 지문 vs 얼굴, 보안은 3D > 2D', '화면 낭독기: iOS VoiceOver / 안드로이드 TalkBack이 시각장애인의 눈이에요', '확대: 고대비, 굵은 글씨, 색상 필터 3종 세트', 'AI 이미지 설명: AI가 그림 읽기, 메뉴 판별, 인증번호 식별을 도와줘요', '실시간 자막: 청각 장애 사용자와 시끄러운 환경의 구세주', 'RTT/TTY: 발성·청각 장애가 있어도 전화할 수 있어요'],
 'di-liu-zhang': ['화면 잠금 비밀번호 + 2단계 인증이 기본 방어선', '앱 권한은 필요할 때만, 최소 권한 원칙', '공용 Wi-Fi에서는 결제/로그인하지 않기', 'AI 시대엔 눈으로 본 게 다가 아니에요: 얼굴 교체·목소리 모방·권위 사칭·가짜 투자가 가장 흔한 수법', '돌파구: 동작 검증 + 암호 확인 + 2차 확인', '사진 공유 전에 민감정보 가리기, EXIF의 위치와 기기 정보 끄기', 'IoT 기기는 반드시 기본 비밀번호를 바꾸세요', '사기 만나면 명심: 쉽게 믿지 않기, 유출하지 않기, 송금하지 않기'],
 'di-qi-zhang-jichu': ['위성 통신: 비상시의 "생명줄"', '무네트 통신: 원거리 무전, 네트워크 없이도 통신', '교통사고 감지: 센서 융합으로 심각한 충돌 식별', '슝링(NearLink): 저지연 무선 연결, 잠재력이 커요'],
 'di-ba-zhang': ['통화 녹음은 법령 준수 주의', 'iMessage/RCS로 기존 문자가 리치 미디어로 업그레이드돼요', '위챗 채팅 기록은 자체 백업 기능을 쓰세요', '메일 계정은 다계정 통합 관리 지원', '괴롭힘 차단: 시스템 식별 + 블랙·화이트리스트 + 문자 키워드 필터', 'iOS 발신자 음소거로 낯선 괴통화를 막지만 놓치는 전화도 주의하세요', '오표시는 전화방/360/텐센트 및 통신사 채널로 이의 제기 가능'],
 'di-jiu-zhang': ['WPS Office는 중국 내 경험이 최고, Microsoft 365는 호환성이 가장 좋아요', '노트 3단계 전략: 즉시 기록 → 나중에 읽기 → 지식 체계화', '휴대폰 스캔: 메모/Microsoft Lens/바이먀오/스캔왕', '클라우드 드라이브는 필요별 조합: iCloud/OneDrive/바이두/알리윈판 각자 용도가 있어요'],
 'di-shi-zhang': ['결제 코드는 보는 사람이 돈을 받아요, 절대 캡처해서 보내지 마세요', '5분 보안 점검: 생체 결제 + 보안 잠금 + 비밀번호 없는 결제 확인 + 기기 관리', '버스·지하철은 휴대폰 지갑 가상 교통카드 우선, 오프라인에서도 사용 가능해요', '의보 전자증권, 사보 조회, 개인 소득세 정산도 휴대폰으로 해결돼요', '사기 방지 4불: ‘안전 계좌’ 송금 금지, 결제 코드 전송 금지, 낯선 링크 클릭 금지, 카드번호 제공 금지'],
 'di-shi-yi-zhang': ['흔한 실수 4가지: 렌즈 오염, 노출 미조정, 플래시 남용, 디지털 줌 오용', '야경 모드는 다중 프레임 합성, 2-4초 안정 유지', '전문 모드: ISO가 낮을수록 화질이 좋고, 셔터로 빛을 조절해요', '후반 작업 흐름: 보정 → 기본 조정 → 부분 정밀 수정 → 스타일화', '스마트 검색 + 주기적 정리 + 수동 앨범 만들기 = 사진 관리 3종 세트'],
 'di-shi-yi-zhang-advanced': ['영상 3요소: 해상도, 프레임률, 비트률', 'H.265는 H.264보다 압축률이 50% 향상돼요', 'ProRes는 Apple의 전문 코덱, 파일이 매우 커요', 'HDR10/10+/Dolby Vision은 각자의 위치가 있어요'],
 'di-shi-er-zhang': ['왕이윈은 플레이리스트 커뮤니티, QQ음악은 저작권 최다, Apple Music은 간결·무손실, Spotify는 추천 알고리즘이 강해요', '샤오위저우는 중국어 팟캐스트 첫 선택, 배속+자동 정리 활용', '로컬 영상은 VLC(전 형식) 또는 nPlayer(제스처 조작)', '위챗 독서 밑줄 소셜 + Kindle 동기화, 눈 보호 모드 필수', '게임 모드는 프레임 안정 우선, 휴대폰이 뜨거우면 냉각 부착식 팬 사용'],
 'di-shi-san-zhang': ['생산성 도구: 할 일 + 뽀모도로 + 캘린더', '건강·운동: Apple 건강/Google Fit이 데이터 허브예요', '브라우저는 Edge 우선, Copilot과 함께 효율 상승', '검색으로 진위 판별: 공식 도메인 확인, .xyz 등 저가 TLD 피하기', '정리는 시스템 내장 우선, 칭좀 같은 서드파티는 보조로, 원탭 전체 삭제는 금물', '괴롭힘 방지 앱: 국가 반사기 센터 + 브랜드 관리자 + 통신사 차단', '휴대폰 자체 차단: iOS는 모르는 발신자 음소거, 안드로이드는 각 브랜드 전화 앱에서 켜기', '3중 방어: 시스템 차단 + 통신사 + 반사기 센터, 화이트리스트로 오탈 차단 주의', '기상 경보: 시스템 날씨 앱 + 공식 기상 채널, 파랑·노랑·주황·빨강 4단계 대응', '자연재해 경보: 기상 + 비상 다중 채널, 폭우·태풍 시 저지대와 간판에서 멀리', '지진 경보≠지진 예보: 몇 초~수십 초 앞섬. 안드로이드는 대개 보안 설정에서 켜요', 'TickTick: 할 일 + 캘린더 + 뽀모도로, 자연어로 일정 생성', '종이 스캔: 시스템 카메라/스캔왕/Lens, 선명하게 찍은 뒤 OCR', 'PC 원격 제어: 썬플라워/ToDesk. 모르는 사람이 원격 앱 설치를 요구하면 사기', 'AI 업무: Trae 등. 무거운 작업은 PC에서, 휴대폰으로 원격 확인', 'LAN 빠른 전송: LocalSend/AirDrop/비둘기 전송; 클립보드: KDE Connect/브랜드 상호 전송', '2FA 동적 코드: Aegis/Microsoft Authenticator, 백업 코드는 종이로 2부'],
 'di-shi-si-zhang': ['비밀번호 관리자는 마스터 비밀번호 하나만 기억하면 돼요', 'Bitwarden은 오픈소스 무료, 1Password는 사용 경험이 좋아요', '마스터 비밀번호는 길고 복잡하게, 2단계 인증도 켜세요', '비밀번호 보안 감사 주기적으로 하기', '제로 지식 아키텍처: 제공사도 비밀번호를 볼 수 없음, 암호화는 로컬에서 완료', 'AES-256 + PBKDF2/Argon2 키 유도 함수가 비밀번호 보관소 보안의 초석이에요', 'LastPass 2022 사건의 교훈: 약한 마스터 비밀번호 사용자가 가장 위험해요', '비밀번호 강도는 "엔트로피": 길이+무작위성 > 복잡한 기호', 'HaveIBeenPwned로 유출 확인, 1Password Watchtower로 이상 감시', 'Passkey는 FIDO2/WebAuthn 기반, 피싱 저항 및 비밀번호 전송이 필요 없어요', 'Passkey 기기 간 동기화: iCloud 키체인/Google 비밀번호 관리자가 지원해요', '하드웨어 키(YubiKey/Titan)는 피싱·SIM 하이재킹에 강해 고민감층에 적합', '1Password 공유 볼트 + Bitwarden 긴급 접근으로 가족 공유가 더 안전해요'],
 'di-shi-wu-zhang': ['리튬 배터리: 수시 충전 OK, 열에 약함, 노화됨', '건강도가 80% 미만이면 사용 시간이 뚜렷이 줄어들어요', '고속 충전 규격: PD/QC/VOOC/SuperCharge 상호 비호환', '무선 충전 Qi2는 자석 정렬을 도입했어요', '절전 핵심: 화면 밝기 낮추기 + 백그라운드 끄기 + 4G 전환'],
 'di-shi-liu-zhang': ['계정은 디지털 생활의 호적부, 연락처·사진·구매 기록·기기 찾기를 묶어요', '3대 필수: 2단계 인증 켜기, 복구 키 설정, 기기 찾기 켜짐 확인', 'iCloud 5GB는 부족해요, 정리하거나 50GB(월 6위안)로 업그레이드', '동기화는 양방향(삭제하면 둘 다 삭제), 백업은 일방향 스냅샷(삭제해도 남아요)', '안드로이드 사용자는 각각 확인: 브랜드 클라우드 백업, 구글 백업, 위챗 백업'],
 'di-shi-qi-zhang': ['기기 간 협업: Apple AirDrop/화웨이 멀티스크린/샤오미 먀오샹/Windows 연결', 'TV로 화면 투사: iPhone은 화면 미러링, 안드로이드는 무선 투사, 실패 시 같은 Wi-Fi 확인', '스마트워치 = 알림 필터 + 건강 스테이션 + 손목 결제, 부모님께 하나 사두면 위기에 도움', '스마트홈은 생태계로 선택: Apple HomeKit/샤오미 미지아/화웨이 하모니', '연동 보안: 공공장소 화면 투사 시 개인정보 주의, 오래된 기기는 빨리 해제'],
 'di-shi-ba-zhang': ['전체 기기 백업: PC 로컬(가장 확실) + 클라우드(가장 편함) 이중 보험', '위챗 채팅 기록이 가장 특별: 위챗 자체 백업 필수, 기기 변경 도구로는 이전 불가', '3-2-1 백업 법칙: 데이터 3부, 저장 매체 2종, 외부 장소 1곳', '기기 변경: 같은 브랜드는 공식 앱, 다른 브랜드는 미리 데이터 중계 준비'],
 'di-shi-jiu-zhang': ['버벅임·발열 4단계: 관련 조작 회상 → 저장 공간 확인 → 전력 소모 확인 → 신호 확인', '앱 강제종료 표준 처리 흐름: 껐다 켜기 → 업데이트 → 권한 확인 → 캐시 정리 → 재설치', '충전이 안 되면 먼저 충전 포트 청소, 케이블/어댑터 교차 테스트로 원인 파악', '네트워크 연결 안 됨: 비행 모드 토글 → Wi-Fi 재연결 → 라우터 재시작', '재부팅 만능 해법으로 이상한 문제 대부분 해결, 수리는 공식 서비스센터로, 보내기 전 백업+계정 로그아웃'],
 'di-er-shi-zhang-jinjie': ['개발자 모드: 빌드 번호 7회 연타로 활성화', 'BL 잠금: 제조사 보호 장치, 해제는 신중하게', 'Root는 위험이 이득보다 커서 일반 사용자에게는 비추천이에요', 'Magisk도 BL 해제가 필요하지만 Root 상태를 숨길 수 있어요'],
 'di-er-shi-yi-zhang': ['VPN = 암호화 터널, 무료 VPN은 오히려 데이터를 훔칠 수 있어요', '공용 Wi-Fi 중간자 공격 방지: HTTPS 확인, 자동 연결 끄기, 민감한 작업은 모바일 데이터로', 'HTTPS는 4번의 핸드셰이크로 암호화되지만 피싱 사이트도 HTTPS를 쓸 수 있어요', 'DoH/DoT로 DNS 조회를 암호화해 통신사의 열람을 막아요', '시크릿 모드 = 로컬 삭제기일 뿐, 네트워크 은신책이 아니에요, ISP와 사이트는 여전히 보여요', '보안 체크리스트: Wi-Fi 자동 연결 끄기, 암호화 DNS 변경, 2FA 켜기, 앱 권한 확인, Juice Jacking 금지'],
 'di-er-shi-er-zhang': ['AI 카메라: 장면 인식 → 다중 프레임 합성 → 지능형 최적화', '음성 비서: 잘 듣기 → 이해하기 → 실행하기 3단계', '온디바이스 AI: 빠르고, 개인정보에 좋고, 오프라인 가능', 'AI 대형 모델은 범용 대화/작성/번역/이미지/학습 용도로 나뉘어요', '대표 활용 예: 실시간 번역, AI 지우기, AI 보정, 문서 처리, AI 이미지 검색', 'CRISPE 프롬프트 프레임워크: 역할+요청+배경+출력+어조+예시', 'AI 사용 시 환각과 개인정보 유출 주의', '"역할-배경-과제-제약"은 더 쉽게 시작하는 프롬프트 소통 방식이에요', '좋은 프롬프트의 특징: 구체적, 배경 포함, 형식 있음, 제약 있음, 검증 가능'],
 'di-er-shi-san-zhang': ['자동화 요소: 트리거 조건 + 실행 동작 + 선택적 판단 로직', 'iOS 단축어: 원탭 아침 루틴, 자동 절전 모드, QR 스캔 가계 기록', '안드로이드: 자동 클리커(화면 매크로), Tasker(최강 자동화), MacroDroid(초보자 친화)', '함정: 위치 트리거 부정확, iOS는 자동 실행이 안 돼 수동 확인 필요, Tasker는 접근성 권한 필요', '자동화 사고: 반복 작업을 조건→동작으로, 휴대폰이 곧 당신의 비서'],
 'di-er-shi-si-zhang': ['Bootloader는 부팅의 문지기, 서명 검증으로 변조를 막아요', 'BL 해제는 브랜드별 정책이 달라요(샤오미 가능/화웨이 잠금)', 'Root 방법: Magisk/KernelSU/SuperSU', '롬 변경 3유형: 공식 ROM/서드파티 Recovery/서드파티 ROM'],
 'di-er-shi-wu-zhang': ['오래된 휴대폰 판매: 백업 → 계정 로그아웃 → 암호화 지우기 → 더미 채운 뒤 재삭제', '디지털 유산: iCloud 유산 연락처/Google 비활성 계정', '회수는 공식 중고 교환 우선, 남은 가치는 모니터/내비로 재사용'],
 'di-er-shi-liu-zhang': ['AI 휴대폰 3대 기준: 온디바이스 대형 모델, NPU 연산 TOPS, AI Agent 앱 연동', '제조사별 AI 전략: Apple/Google/화웨이/샤오미/OPPO/vivo 각자 강점이 있어요', '위성 통신: 베이더우 단문은 중급형에도, 톈퉁 통화는 플래그십 전용', '폴더블: 하드웨어 성숙, 앱 대응 70%, 접기/분할 화면이 고유 경험', '6G는 아직 멀었고 Wi-Fi 7은 상용화됐으며 블루투스 LE Audio가 보급되기 시작했어요', '실리콘 카본 음극 배터리로 5000-6000mAh가 플래그십 표준으로'],
 'di-er-shi-qi-zhang': ['먼저 쉬운 모드를 켜거나 글자/아이콘을 키우면, 환경만 잘 맞춰도 문제 대부분이 사라져요', '어르신 휴대폰 지도 3철칙: 재촉 금지, 비유 사용, 적어주기', '6대 흔한 사기는 반복해서 일깨우고, 3중 방어선으로 90% 사기를 막을 수 있어요', '원격 지원으로 멀리 있어도 부모님 휴대폰을 고쳐드릴 수 있어요', '위챗 케어 모드 + 음성 입력이 어르신에게 가장 실용적인 두 기능', 'SOS 긴급 구조 요청과 낙상 감지, 위기 순간 생명을 구하는 설정이에요'],
 'di-er-shi-ba-zhang': ['기기 선택 3단계: 먼저 필요 → 다음 예산 → 마지막 기종', '핵심 스펙은 5가지만: 프로세서, 화면, 카메라, 배터리 충전, OS 업데이트 보증', '1500-3500위안은 가성비가 가장 좋은 추천 구간이에요', '작년 플래그십이 올해 미들레인지보다 더 알뜰해요', '5대 함정: 다중 렌즈 사기, 고화소 함정, 통신사 전용, 곡면 화면 맹신, AI 홍보성', '618과 광군제는 1년 중 휴대폰 구매에 가장 좋은 두 시기예요'],
 'di-er-shi-jiu-zhang': ['먼저 화면 사용 시간 데이터 확인, 현황 파악이 변화의 첫걸음이에요', '오락 앱에 한도 설정, 방해 금지 모드에 예약 설정, 주도권 되찾기', '20-20-20 법칙이 가장 간단하고 효과적인 눈 보호 습관이에요', '고개 숙여 휴대폰 보면 목에 5-6배 하중, 휴대폰 높이 들기+목 주기적으로 움직이기', '자기 1시간 전엔 휴대폰 보지 않기, 충전기는 손이 닿지 않는 곳에', '정보 불안의 해독제는 ‘능동적으로 차단’하는 것이지 ‘더 많이 얻는’ 것이 아니에요'],
 'di-san-shi-zhang': ['무선 화면 투사 3진영: AirPlay(Apple), Miracast(안드로이드), DLNA(크로스플랫폼 미디어)', '유선 화면 투사가 더 안정하고 지연 없음, 회의실엔 HDMI 어댑터 필수', 'Samsung DeX/화웨이 데스크톱 모드로 휴대폰이 경량 업무 PC로 변신해요', '차량 연동: CarPlay/Android Auto/HiCar/CarLife 4대 방식', '회의실 화면 투사 철칙: 사전 테스트, 플랜 B 준비, 알림 미리보기 끄기'],
 'di-san-shi-yi-zhang': ['찍기 전에 정리: 시청자가 누구인지, 어떤 가치를 줄지, 어느 플랫폼에 올릴지', '촬영 시작 5가지: 1080P/30fps, 렌즈 닦기, 초점·노출 잠금, 가로세로 결정, 그리드 켜기', '카메라 워킹 5기법: 푸시, 풀, 팬, 이동, 팔로우 - 안정이 최우선', '편집은 캡컷: 자르기→전환→자막→BGM→내보내기, 6단계', '처음 3초가 판가름, 영상 하나엔 한 가지만, 꾸준함이 재능보다 중요해요'],
 'di-san-shi-er-zhang': ['휴대폰 분실 골든 30분: 빌린 폰으로 발신 → 원격 잠금 → SIM 정지 → 결제 동결 → 지인 통보 → 경찰 신고', '사기 피해 후 72시간: 송금 중지 → 증거 보존 → 96110 전화 → 경찰 신고 → 은행 연락 → 비밀번호 변경', '휴대폰 바이러스: 안전 모드 → 의심 앱 제거 → 보안 검사 → 초기화(최후 수단)', '계정 도용: 비밀번호 변경 → 기기 강제 로그아웃 → 로그인 기록 확인 → 2단계 인증 켜기 → 연동 확인 → 결제 확인', '협박 메시지 99.9%는 사기, 답장·송금 하지 말고 캡처 후 차단', 'AI 얼굴/목소리 도용 사기: 깜빡임/입모양/가장자리/빛 그림자 파단 확인, 상대에게 고개 돌려 얼굴 가리기, 사적인 질문, 아는 번호로 회신 요구', 'SIM 스왑 하이재킹: 갑자기 ‘서비스 없음’이면 경계. SIM 카드 PIN 설정, 통신사 2차 인증, 중요 계정은 인증 앱으로', '일상 예방 5가지: 화면 잠금+2FA, 기기 찾기, SIM PIN, 출처 불명 앱 설치 금지, 주기적 백업', '지진/극단적 기상: 먼저 가까이 피신 후 대피, 안전 알림은 장통화보다 문자가 절전', '신호 없을 때 위성 SOS 우선(지원 기종); 경보와 설정은 제13장 참조'],
 'di-san-shi-san-zhang': ['Vision Pro와 AR 글래스는 휴대폰 외의 새로운 컴퓨팅 진입로지만 단기간에 대체하기 어려워요', '브레인-컴퓨터 인터페이스는 소비자용까지 10-20년, 윤리 문제가 기술 성숙에 선행', '휴대폰은 "모습 감춤"으로 진화 중, 기기 중심에서 신원 중심으로', 'AI 윤리, 데이터 주권, 디지털 격차는 향후 10년의 핵심 과제예요', '연결하되 독립도 유지, 디지털 생활의 변하지 않는 철학이에요'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // 인라인 요약이 있는 챕터는 건너뛰어 중복 방지
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== 복사 버튼(kbd 요소에 추가) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', '복사');
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

 // ===== 접을 수 있는 긴 내용(h4 수준) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // 내용이 긴 h4 단락에만 접기 추가
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // 접기 헤더 추가
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

 // ===== 학습 대시보드: 읽기 진행률 + 휴대폰 건강 자가 점검 =====
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
 // 읽기 진행률
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // 즐겨찾기 수
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // 지난 챕터
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // 건강 자가 점검
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = '만점! 휴대폰 보안 상태가 아주 좋아요';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = '좋아요! 아직 ' + (totalChecks - checked) + '개 항목을 보완할 수 있어요';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = '합격, 체크 안 한 보안 항목부터 처리 권장';
 else healthMsgEl.innerHTML = '휴대폰에 보안 위험이 있어요. 빨리 보완하세요';
 }
 }

 // 자가 점검 상태 복원
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // 3초마다 갱신(챕터 완료 체크 변화 감지)
 setInterval(updateDashboard, 3000);

 // ===== 음성 읽기(TTS) =====
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
 // 읽을 필요 없는 요소를 복제해 제거
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // 접힌 본체는 제거하되 텍스트는 유지
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('죄송해요, 이 브라우저는 음성 읽기를 지원하지 않아요. Chrome이나 Edge를 권장해요.');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : '제목 없는 챕터';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'ko-KR';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // 더 자연스러운 한국어 음성 사용
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('ko'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // 다음 챕터 자동 재생
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
 // 현재 보이는 챕터 찾기
 if (ttsSectionIndex < 0) {
 // 처음부터 또는 현재 스크롤 위치에서 가장 가까운 챕터부터 시작
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
 ttsLabel.textContent = '재생 전';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // 이벤트 바인딩
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
 // 현재 구간을 다시 만들어 재생
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

 // 키보드 단축키: R 키로 읽기 전환
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

 // ===== 초기화 =====
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

