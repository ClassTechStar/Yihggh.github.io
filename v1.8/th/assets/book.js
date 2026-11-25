
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

 // ===== ธีม =====
 function syncThemeControls() {
 const isDark = html.classList.contains('dark');
 const nextLabel = isDark ? 'สลับไปโหมดสว่าง' : 'สลับไปโหมดมืด';
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

 // ===== การเลื่อน: ความคืบหน้า + เงา + กลับขึ้นด้านบน + ความคืบหน้าสารบัญ + วงแหวนความคืบหน้า =====
 const sections = $$('.content-section');
 const totalChapters = sections.length;
 if (readingProgressText) readingProgressText.textContent = `0 / ${totalChapters} บท`;

 // พารามิเตอร์วงแหวนความคืบหน้า
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

 // อัปเดตวงแหวนความคืบหน้า
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

 // อ่านถึงบทไหนแล้ว
 let passedChapters = 0;
 const viewportTop = scrollY + 100;
 sections.forEach(sec => {
 if (sec.offsetTop <= viewportTop) passedChapters++;
 });
 if (readingProgressText) {
 const passed = Math.max(0, Math.min(totalChapters, passedChapters));
 readingProgressText.textContent = `${passed} / ${totalChapters} บท`;
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

 // ===== จำตำแหน่งการอ่าน =====
 const POSITION_KEY = 'phoneCourse_scrollPos';
 const POSITION_CHAPTER_KEY = 'phoneCourse_lastChapter';
 const POSITION_SECTION_KEY = 'phoneCourse_lastSection';
 const POSITION_OFFSET_KEY = 'phoneCourse_lastOffset';
 let savePosTimer = null;
 function saveReadingPosition() {
 const scrollY = window.scrollY;
 if (scrollY < 200) return; // ยังเร็วเกินไป ไม่บันทึก
 localStorage.setItem(POSITION_KEY, scrollY.toString());
 // หาชื่อบทปัจจุบัน
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

 // กู้ตำแหน่งตอนโหลดหน้า
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
 restoreToastText.textContent = `อ่านครั้งล่าสุด: ${savedChapter}`;
 setTimeout(() => restoreToast.classList.add('show'), 800);
 // ซ่อนอัตโนมัติหลัง 10 วินาที
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

 // ===== แอนิเมชันเข้าจอตอนเลื่อน =====
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
 // เนื้อหาในจอแรกให้แสดงทันที
 sections.forEach((sec, i) => {
 const rect = sec.getBoundingClientRect();
 if (!visibleObserver || rect.top < window.innerHeight) {
 sec.classList.add('visible');
 } else {
 visibleObserver.observe(sec);
 }
 });

 // ===== เปิด/ปิดแถบข้าง =====
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

 // เครื่องมือด่วน: เปิดสารบัญ
 if (quickToc) quickToc.addEventListener('click', () => {
 if (window.innerWidth < 1024) openSidebar();
 else window.scrollTo({ top: 0, behavior: 'smooth' });
 });

 // ===== การนำทางแองเคอร์ทั่วโลก: ชดเชยระยะเหลื่อมของแถบคงที่ =====
 // ต้องใช้ scrollIntoView ไม่ใช่คำนวณพิกัดเอง: .content-section ตั้งค่าไว้
 // content-visibility:auto + contain-intrinsic-size(0 800px): บทที่อยู่นอกจอ
 // ใช้พื้นที่ placeholder ขนาด 800px, getBoundingClientRect คืนพิกัดของ placeholder และ scrollTo ตรง ๆ
 // จะไปผิดตำแหน่ง (ยิ่งบทอยู่ท้ายยิ่งเหลื่อมสะสมมาก) scrollIntoView ยกให้เบราว์เซอร์
 // เรนเดอร์เป้าหมายตามต้องการและจัดตำแหน่งให้ และ html{scroll-padding-top:5rem} ชดเชยแถบคงที่
 // คงที่
 function scrollToAnchor(id) {
 const el = document.getElementById(id);
 if (!el) return;
 // ขั้น 1: โหมด instant บังคับเรนเดอร์บทเป้าหมายและจัดตำแหน่งก่อน ป้องกันไม่ให้ content-visibility
 // การเหลื่อมระหว่างการเลื่อนแบบ smooth ที่เกิดจากการเรนเดอร์ช้ากว่ากำหนด
 el.scrollIntoView({ behavior: 'instant', block: 'start' });
 // ขั้น 2: เมื่อเป้าหมายเรนเดอร์แล้วและพิกัดนิ่ง ค่อยสั่งเลื่อนแบบ smooth เพื่อสัมผัสที่ลื่นไหล
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

 // ===== ยุบสารบัญ =====
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

 // ===== กรองสารบัญ =====
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

 // ===== ไฮไลต์ในสารบัญ =====
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

 // ===== ระบบรายการโปรด =====
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

 // เพิ่มปุ่มรายการโปรดให้ทุกบท
 sections.forEach(sec => {
 const id = sec.id;
 if (!id) return;
 const h3 = sec.querySelector('h3');
 if (!h3) return;
 const btn = document.createElement('button');
 btn.className = 'bookmark-btn' + (isBookmarked(id) ? ' active' : '');
 btn.innerHTML = '<span>' + (isBookmarked(id) ? 'ในรายการโปรด' : 'รายการโปรด') + '</span>';
 btn.setAttribute('aria-label', isBookmarked(id) ? 'เอาออกจากรายการโปรด' : 'เพิ่มบทนี้เป็นรายการโปรด');
 btn.addEventListener('click', () => {
 const added = toggleBookmark(id);
 btn.classList.toggle('active', added);
 btn.querySelector('span').textContent = added ? 'ในรายการโปรด' : 'รายการโปรด';
 btn.setAttribute('aria-label', added ? 'เอาออกจากรายการโปรด' : 'เพิ่มบทนี้เป็นรายการโปรด');
 // อัปเดตสัญลักษณ์ในแถบข้าง
 updateTocBookmark(id, added);
 });
 // แทรกต่อจาก h3
 h3.parentNode.insertBefore(btn, h3.nextSibling);
 });

 function updateTocBookmark(id, isBookmarked) {
 const tocLink = tocLinkMap.get(id);
 if (tocLink) {
 tocLink.classList.toggle('bookmarked', isBookmarked);
 }
 }
 // เริ่มต้นสัญลักษณ์รายการโปรดในแถบข้าง
 getBookmarks().forEach(id => updateTocBookmark(id, true));

 // ===== ติ๊กว่าอ่านบทแล้ว =====
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
 // หาแถวเมตาหรือองค์ประกอบก่อนหน้า h3
 const metaDiv = h3.previousElementSibling;
 const check = document.createElement('button');
 check.className = 'chapter-check' + (isCompleted(id) ? ' checked' : '');
 check.innerHTML = '<span class="check-icon"></span><span>' + (isCompleted(id) ? 'อ่านแล้ว' : 'อ่านแล้ว') + '</span>';
 check.setAttribute('aria-label', isCompleted(id) ? 'ยกเลิกเครื่องหมายอ่านแล้ว' : 'ทำเครื่องหมายว่าอ่านแล้ว');
 check.addEventListener('click', () => {
 const done = toggleCompleted(id);
 check.classList.toggle('checked', done);
 check.querySelector('span:last-child').textContent = done ? 'อ่านแล้ว' : 'อ่านแล้ว';
 check.setAttribute('aria-label', done ? 'ยกเลิกเครื่องหมายอ่านแล้ว' : 'ทำเครื่องหมายว่าอ่านแล้ว');
 // อัปเดตแถบข้าง
 updateTocCompleted(id, done);
 // อัปเดตความคืบหน้าการอ่าน
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
 // อัปเดตตัวนับบทที่อ่านแล้วด้วย
 const passed = parseInt(readingProgressText.textContent) || 0;
 readingProgressText.textContent = `${passed} / ${totalChapters} บท`;
 }
 }

 // ===== ค้นหา (อัปเกรด: นำทางด้วยคีย์บอร์ด + นับผลลัพธ์) =====
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
 renderSearchPlaceholder('พิมพ์คำสำคัญเพื่อเริ่มค้นหา');
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
 renderSearchPlaceholder('ไม่พบเนื้อหาที่เกี่ยวข้อง');
 searchSelectedIdx = -1;
 searchResultItems = [];
 return;
 }

 const countHtml = `<div class="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">พบ ${results.length} ผลลัพธ์</div>`;
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
 renderSearchPlaceholder('พิมพ์คำสำคัญเพื่อเริ่มค้นหา');
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

 // นำทางการค้นหาด้วยคีย์บอร์ด
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

 // ===== ขนาดฟอนต์ =====
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

 // ===== ปิดแถบข้างด้วยการปัด =====
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

 // ===== นำทางระหว่างบท =====
 const sectionIds = sections.map(s => s.id);
 sections.forEach((section, i) => {
 const nav = document.createElement('div');
 nav.className = 'chapter-nav';
 let navHtml = '';
 if (i > 0) {
 navHtml += `<a href="#${sectionIds[i-1]}" class="prev"><span class="truncate">${sections[i-1].querySelector('h3')?.textContent || 'บทก่อนหน้า'}</span></a>`;
 } else {
 navHtml += '<span></span>';
 }
 if (i < sections.length - 1) {
 navHtml += `<a href="#${sectionIds[i+1]}" class="next"><span class="truncate">${sections[i+1].querySelector('h3')?.textContent || 'บทถัดไป'}</span></a>`;
 }
 nav.innerHTML = navHtml;
 section.appendChild(nav);
 });

 // ===== พิมพ์ =====
 function doPrint() { window.print(); }
 if (printBtn) printBtn.addEventListener('click', doPrint);
 if (quickPrint) quickPrint.addEventListener('click', doPrint);

 // ===== ปุ่มลัดทั่วไป =====
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

 // ปิดหน้าต่างเมื่อคลิกที่ฉากหลัง
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
 // การพิมพ์เบราว์เซอร์จัดการเองแล้ว
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

 // ===== ติดตามวันอ่านต่อเนื่อง =====
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

 // แสดงแจ้งเตือนวันต่อเนื่อง
 if (streak >= 2 && streakToast && streakToastText) {
 streakToastText.textContent = '🔥 วันที่ ' + streak + ' ของการอ่านต่อเนื่อง สู้ ๆ!';
 streakToast.classList.add('show');
 setTimeout(() => streakToast.classList.remove('show'), 5000);
 }
 }
 } catch(e) { /* localStorage อาจใช้ไม่ได้ */ }
 }
 updateStreak();

 // ===== สำรอง/กู้คืน =====
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
 // รวบรวมสถานะเช็กสุขภาพ
 for (let i = 0; i < 8; i++) {
 data.healthChecks[i] = localStorage.getItem('health-check-' + i);
 }
 // รวบรวมสถานะการอ่านบท
 $$('.chapter-check.checked').forEach(c => {
 const sec = c.closest('.content-section');
 if (sec) data.chapterChecks[sec.id] = true;
 });
 // รวบรวมรายการโปรด
 $$('.toc-item.bookmarked').forEach(b => {
 data.bookmarks.push(b.getAttribute('href').replace('#', ''));
 });
 // รวบรวมคะแนน
 $$('.chapter-rating').forEach(r => {
 const sec = r.closest('.content-section');
 if (sec) data.ratings[sec.id] = r.dataset.rating || '0';
 });

 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'สำรองการอ่าน-PhoneClass_' + new Date().toISOString().slice(0,10) + '.json';
 a.click();
 URL.revokeObjectURL(url);
 } catch(e) {
 alert('ส่งออกสำรองข้อมูลล้มเหลว: ' + e.message);
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
 // กู้คืนสถานะเช็กสุขภาพ
 if (data.healthChecks) {
 Object.keys(data.healthChecks).forEach(i => {
 localStorage.setItem('health-check-' + i, data.healthChecks[i]);
 });
 }
 // กู้คืนสถานะการอ่านบท
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
 // กู้คืนรายการโปรด
 if (data.bookmarks) {
 data.bookmarks.forEach(id => {
 const tocItem = document.querySelector('.toc-item[href="#' + id + '"]');
 if (tocItem) tocItem.classList.add('bookmarked');
 });
 }
 alert('กู้คืนสำเร็จ! หน้าจะรีโหลดเพื่อใช้ข้อมูลทั้งหมด');
 location.reload();
 } catch(err) {
 alert('กู้คืนล้มเหลว: รูปแบบไฟล์ไม่ถูกต้อง ' + err.message);
 }
 };
 reader.readAsText(file);
 }

 function resetAllData() {
 if (!confirm('ล้างข้อมูลการอ่านทั้งหมด? ทำไม่ได้แล้ว! ส่งออกสำรองข้อมูลก่อน')) return;
 if (!confirm('ยืนยันอีกครั้ง: ความคืบหน้า รายการโปรด และคะแนนจะถูกลบทั้งหมด จะไปต่อหรือไม่?')) return;
 localStorage.clear();
 alert('ล้างข้อมูลทั้งหมดแล้ว หน้าจะรีโหลด');
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

 // ===== ระบบให้คะแนนบท =====
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
 // แทรกต่อจาก h3
 h3.parentNode.insertBefore(ratingDiv, h3.nextSibling);
 updateStars(ratingDiv);
 });

 function updateStars(container) {
 const rating = parseInt(container.dataset.rating, 10);
 container.querySelectorAll('.star').forEach(s => {
 s.classList.toggle('active', parseInt(s.dataset.value, 10) <= rating);
 });
 }

 // ===== ปรับดีเบานซ์การเลื่อน =====
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

 // ===== ตามโหมดมืดของระบบ =====
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

 // ===== เติม breadcrumb และป้ายระดับความยากให้หัวข้อบทโดยอัตโนมัติ =====
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
 
 ${level === 'beginner' ? 'เริ่มต้น' : level === 'intermediate' ? 'ระดับกลาง' : 'ขั้นสูง'}
 </span>
 <span class="reading-time">
 อ่าน ~${minutes} นาที
 </span>
 `;
 h3.parentNode.insertBefore(meta, h3);
 });

 // ===== เพิ่มบล็อก "สรุป" ให้บท =====
 function addChapterSummary(sec, points) {
 const div = document.createElement('div');
 div.className = 'chapter-summary';
 div.innerHTML = `<p class="font-semibold mb-1">สรุปประจำบท</p><ul class="list-disc pl-5 text-sm space-y-0.5">${points.map(p => `<li>${p}</li>`).join('')}</ul>`;
 const nav = sec.querySelector('.chapter-nav');
 if (nav) sec.insertBefore(div, nav);
 else sec.appendChild(div);
 }
 const summaries = {
 'fu-lu-f': ['จอพับสุกงอมแล้วแต่ยังไม่ใช่กระแสหลัก: เป็น "ของประดับ" ไม่ใช่ "ของช่วยชีวิต"', 'พับขวาง = โทรศัพท์ + แท็บเล็ต พับตาม = พกง่าย + แอบมองจอนอก', 'เหมาะกับ: อ่านหนัก/ธุรกิจ/สร้างสรรค์แบบพับค้าง/ผู้หญิงที่เน้นพกพา', 'หกจุดตรวจก่อนซื้อ: ชนิดบานพับ, จอใน UTG, รอยพับ, ขนาดจอนอก, น้ำหนักและความหนา, ราคาซ่อมหลังประกัน', 'ท่าเฉพาะตัว: ทำงานหลายอย่างบนจอแบ่งครึ่ง พับค้าง 90 องศา แอบดูจอนอก และโหมดคอมพิวเตอร์', 'หัวใจการดูแล: อย่าเปิด-ปิดในที่เย็นจัด กันเม็ดทรายเข้าจอ อย่าแปะฟิล์มธรรมดาบนจอใน และรักษาบานพับให้พ้นฝุ่น', 'คาดการณ์ไว้: รอยพับอยู่ตลอดไป หนักและหนาขึ้น แบตกลาง ๆ ราคาขายต่อต่ำ ซ่อมแพง', 'ปรัชญาการซื้อ: ซื้อเพราะรูปแบบเฉพาะตัว ไม่ใช่เพราะ "ล้ำกว่า"'],
 'di-ling-zhang': ['เข้าใจตำแหน่งของหนังสือ: วิทยาศาสตร์ดิจิทัลที่พูดเข้าใจง่ายและลงมือทำได้', 'เชี่ยวชาญระบบสัญลักษณ์: [ปุ่ม], >, ตัวหนา และตัวเอียง หมายความว่าอะไร', 'ทำไมความจุโทรศัพท์ "หด" สาเหตุหลักมีอะไรบ้าง', 'สร้างนิสัยจดสเปกโทรศัพท์ของตัวเอง', 'โทรศัพท์ = ตู้เซฟสินทรัพย์ดิจิทัล ป้องกันก่อนคือแนวคิดหลัก', 'ข้อมูลมักมีมูลค่ามากกว่าฮาร์ดแวร์ตัวเอง'],
 'di-yi-zhang': ['SoC = CPU + GPU + NPU + ISP + โมเด็มและโมดูลอื่นรวมในชิปเดียว', 'คอร์ใหญ่กับคอร์เล็กทำงานร่วมกัน: สมดุลประสิทธิภาพกับแบต', 'จอ: OLED/LCD อัตรารีเฟรช และความสว่างอัตโนมัติ', 'หัวใจระบบภาพ: ขนาดเซนเซอร์สำคัญกว่าจำนวนพิกเซล', 'วิวัฒนาการพอร์ต: Micro USB → Lightning → รวมเป็น USB-C', '5G-A นำความสามารถใหม่ "รวมการสื่อสารกับการรับรู้" มาให้'],
 'di-yi-zhang-harmony': ['HarmonyOS = ระบบปฏิบัติการแบบกระจาย ออกแบบให้หลายอุปกรณ์มาตั้งแต่แรก', 'HarmonyOS 4.3 เข้ากันได้กับ AOSP และรันแอป Android ได้', 'HarmonyOS NEXT เป็นอิสระสมบูรณ์ และไม่รองรับแอป Android อีกต่อไป', 'ก่อนอัปเกรดให้แน่ใจว่าแอปที่ใช้ประจำมีเวอร์ชันดั้งเดิมแล้ว'],
 'di-er-zhang': ['ที่เก็บสามชั้น: ตัวเครื่อง / การ์ด SD / คลาวด์', 'ความหมายของโฟลเดอร์ทั่วไปใน Android (DCIM, Download ฯลฯ)', 'สำรองข้อมูล = สำรองคลาวด์ + สำรองในเครื่อง กันสองชั้น', 'ลบไม่เท่าทำลาย ต้อง "เขียนทับ" จึงล้างจริง', 'สรุปสั้นฟอร์แมตไฟล์ที่พบบ่อย (ภาพ/เสียง/วิดีโอ/เอกสาร)', 'ตั้งชื่อแบบ "วันที่ + เหตุการณ์" เป็นธรรมเนียมพื้นฐาน', 'ล้างอัตโนมัติทุก 72 ชั่วโมง แก้ปัญหาแคชแอปโซเชียลสะสม', 'กันภัยรูปสองชั้น: ปิดบัง + ลบข้อมูล EXIF'],
 'di-san-zhang': ['4G/5G ต่างมีบทบาท 5G-A คือเวอร์ชันเสริมพลัง', 'ความต่างทางเทคนิคสำคัญของ Wi-Fi 6/6E/7', 'Wi-Fi สาธารณะต้องระวัง: อย่าพิมพ์ข้อมูลอ่อนไหว', 'Bluetooth 5.x พัฒนาต่อเนื่อง LE Audio เริ่มแพร่หลาย', 'NFC ทำงานในระยะ 10 ซม. ความใกล้ชิดทางกายภาพคือเกราะป้องกันเอง'],
 'di-si-zhang': ['ติดตั้งแอปจากร้านทางการก่อนเป็นอันดับแรก', 'แพ็กเกจ APK = ใบรับรอง + ทรัพยากร + ค่าตั้ง + ไบนารี', 'ระวังแอป "ทำความสะอาด-เร่งเครื่อง" แอปค้างพื้นหลังเป็นเรื่องสมเหตุสมผลได้', 'ตรวจลายเซ็นแอปกันการแก้กลับ: การป้องกันระดับระบบ', 'โหมดบริสุทธิ์ = ติดตั้งจากร้านทางการเท่านั้น กำแพงแรกสู้มัลแวร์', '"ปรสิตดิจิทัล" หมายถึงแอปแตกที่มีโทรจันฝังอยู่ข้างใน', 'กลไกตรวจร้านแอป: สแกนไวรัส + ตรวจสิทธิ์ + ยืนยันตัวนักพัฒนา'],
 'di-wu-zhang': ['จอ: ความละเอียด อัตรารีเฟรช ความสว่างอัตโนมัติ', 'เสียง: เสียงเรียก/สื่อ/แจ้งเตือน ปรับแยกกัน', 'พื้นที่จัดเก็บ: ล้างแคชกับไฟล์ไม่จำเป็นอย่างสม่ำเสมอ', 'ไบโอเมตริก: ลายนิ้วมือสู้ใบหน้า 3 มิติปลอดภัยกว่า 2 มิติ', 'โปรแกรมอ่านหน้าจอ: VoiceOver บน iOS / TalkBack บน Android คือดวงตาของผู้ใช้ที่สายตาพิการ', 'ขยาย: คอนทราสต์สูง ตัวหนา ฟิลเตอร์สี สามชุด', 'AI บรรยายภาพ: ให้ AI อ่านรูป เมนู และแคปช่าให้คุณ', 'คำบรรยายสด: ผู้พิทักษ์ของผู้ฟังบกพร่องและสถานที่เสียงดัง', 'RTT/TTY: คนที่พูดไม่ได้หรือหูหนวกก็โทรได้'],
 'di-liu-zhang': ['รหัสล็อกหน้าจอ + ยืนยันสองชั้น คือเส้นป้องกันพื้นฐาน', 'สิทธิ์แอป: เปิดตามความจำเป็น หลักการสิทธิน้อยที่สุด', 'ไม่ชำระเงิน ไม่ล็อกอินบน Wi-Fi สาธารณะ', 'ยุค AI เห็นแล้วไม่ควรเชื่อ: หน้าและเสียงปลอม แอบอ้างผู้มีอำนาจ และการลงทุนหลอกลวง คือแกล้งที่พบมากที่สุด', 'ทางรอด: ยืนยันด้วยการกระทำ + รหัสลับร่วมกัน + ยืนยันรอบสอง', 'ก่อนแชร์รูปให้เลิกระบุตัวตน: ปิดตำแหน่งและข้อมูลอุปกรณ์ใน EXIF', 'อุปกรณ์ IoT: เปลี่ยนรหัสผ่านเริ่มต้น', 'เจอการหลอกลวงให้จำ: ไม่เชื่อง่าย ไม่เปิดเผย ไม่โอน'],
 'di-qi-zhang-jichu': ['ดาวเทียม: "เชือกช่วยชีวิต" ในยามฉุกเฉิน', 'คุยได้แม้ไร้เน็ต: วิทยุสื่อสารระยะไกล', 'ตรวจจับอุบัติเหตุ: การหลอมรวมเซนเซอร์จับการชนรุนแรงได้', 'StarFlash: การเชื่อมต่อไร้สายความหน่วงต่ำที่มีศักยภาพมหาศาล'],
 'di-ba-zhang': ['อัดสาย: ระวังข้อกฎหมาย', 'iMessage/RCS ยกระดับ SMS เดิมเป็นสื่อสมบูรณ์', 'แชท WeChat ต้องใช้ฟังก์ชันสำรองในตัวของ WeChat', 'แอปเมลจัดการหลายบัญชีในที่เดียว', 'บล็อกการรบกวน: ระบบจับ + รายชื่อดำ/ขาว + กรองคำสำคัญใน SMS', 'เงียบสายไม่รู้จักบน iOS กันคนรบกวนได้ แต่ระวังสายที่พลาดไป', 'ถูกแจ้งผิดว่าเป็นสแปมขออุทธรณ์ผ่าน Dianhua Bang/360/เทนเซ็นต์ และช่องทางผู้ให้บริการ'],
 'di-jiu-zhang': ['WPS Office ใช้ดีที่สุดในจีน, Microsoft 365 เข้ากันได้ดีที่สุด', 'โน้ตสามขั้น: จดไว้ก่อน → ค่อยอ่าน → กลายเป็นระบบความรู้', 'สแกนด้วยโทรศัพท์: โน้ตของเครื่อง/Mic Lens/Baimiao/CamScanner', 'คลาวด์ตามความจำเป็น: iCloud/OneDrive/ไป๋ตู้/Aliyun Drive แต่ละตัวมีโอกาสใช้งานของตัวเอง'],
 'di-shi-zhang': ['ใครเห็นรหัสชำระเงิน คนนั้นได้เงิน อย่าส่งภาพหน้าจอให้ใครเด็ดขาด', 'เช็กสุขภาพความปลอดภัย 5 นาที: ชำระด้วยชีวมิติ + กุญแจความปลอดภัย + ตรวจการจ่ายแบบไม่ต้องใส่รหัส + จัดการอุปกรณ์', 'บนรถไฟฟ้าและรถเมล์ ใช้บัตรเดินทางเสมือนในกระเป๋าโทรศัพท์ดีกว่า ทำงานได้แม้ออฟไลน์', 'บัตรประกันสุขภาพอิเล็กทรอนิกส์ เช็กบำนาญ ยื่นภาษี ทำได้หมดบนมือถือ', 'สี่ไม่สู้โจร: ไม่โอนไป "บัญชีปลอดภัย", ไม่ส่งรหัสชำระเงิน, ไม่กดลิงก์แปลกปลอม, ไม่บอกเลขบัตร'],
 'di-shi-yi-zhang': ['สี่ข้อผิดพลาดที่พบบ่อย: เลนส์สกปรก ไม่ปรับรูแสง ใช้แฟลชเกินงาน ใช้ซูมดิจิทัลผิดที่', 'โหมดกลางคืนรวมหลายเฟรม จับนิ่ง 2-4 วินาที', 'โหมดโปร: ISO ต่ำภาพสะอาด ชัตเตอร์คุมแสง', 'สายงานหลังถ่าย: แก้เอียง → ปรับพื้นฐาน → เก็บรายละเอียด → ใส่สไตล์', 'ค้นหาอัจฉริยะ + เก็บกวาดสม่ำเสมอ + อัลบั้มจัดเอง = สามเสาการจัดรูปภาพ'],
 'di-shi-yi-zhang-advanced': ['สามเสาของวิดีโอ: ความละเอียด เฟรมเรต บิตเรต', 'H.265 บีบอัดได้ดีกว่า H.264 อีก 50%', 'ProRes คือโคเดกมืออาชีพของ Apple ไฟล์ใหญ่มาก', 'HDR10/10+/Dolby Vision แต่ละตัวมีจุดยืนของตัวเอง'],
 'di-shi-er-zhang': ['NetEase Cloud Music เด่นเรื่องเพลย์ลิสต์และชุมชน, QQ Music มีแคตตาล็อกกว้างสุด, Apple Music เรียบและไร้การสูญเสีย, Spotify แนะนำแม่นยำ', 'Xiaoyuzhou คือตัวเลือกแรกของพอดแคสต์ภาษาจีน ใช้ความเร็วกับการล้างอัตโนมัติให้เป็น', 'วิดีโอในเครื่อง: VLC (ทุกฟอร์แมต) หรือ nPlayer (ควบคุมด้วยท่าทาง)', 'การขีดเส้นใต้ใน WeChat Read มีมิติสังคม + ซิงก์ Kindle โหมดพักสายตาต้องเปิดทุกครั้ง', 'โหมดเกมมุ่งรักษาเฟรมให้ลื่นก่อน ร้อนจัดช่วยได้ด้วยพัดหลังเครื่อง'],
 'di-shi-san-zhang': ['เครื่องมือเพิ่มผลิตภาพ: สิ่งที่ต้องทำ + โพโมโดโร + ปฏิทิน', 'สุขภาพและออกกำลังกาย: Apple Health/Google Fit เป็นศูนย์กลางข้อมูล', 'เบราว์เซอร์: เริ่มที่ Edge คู่กับ Copilot เพิ่มประสิทธิภาพ', 'ค้นหาให้ออกของจริง: เชื่อโดเมนทางการ เลี่ยงส่วนท้ายราคาถูกอย่าง .xyz', 'ให้ระบบในเครื่องทำความสะอาดก่อน ตัวนอกอย่าง Qingzhuo เป็นเพียงเสริม ห้ามล้างทั้งหมดปุ่มเดียว', 'แอปกันรบกวน: ศูนย์ต่อต้านการหลอกลวงแห่งชาติ + ผู้พิทักษ์ของแบรนด์ + บล็อกจากผู้ให้บริการ', 'การบล็อกในตัว: iOS เปิด เงียบสายไม่รู้จัก, Android เปิดในแอปโทรศัพท์ของแต่ละแบรนด์', 'สามชั้นรวมกัน: บล็อกระบบ + ผู้ให้บริการ + ศูนย์ต่อต้านภัยคุกคาม ระวังรายชื่อขาวกันลบของตัวเอง', 'เตือนภัยอากาศ: แอปอากาศของระบบ + ช่องทางการอุตุนิยมวิทยาทางการ ลงมือตามระดับ น้ำเงิน/เหลือง/ส้ม/แดง', 'เตือนภัยธรรมชาติ: อุตุนิยมวิทยา + ช่องทางป้องกันภัย ฝนหนักพายุให้เลี่ยงที่ต่ำและป้ายโฆษณา', 'เตือนแผ่นดินไหวล่วงหน้าไม่ใช่การพยากรณ์: นำหน้าเป็นวินาทีถึงสิบวินาที บน Android มักอยู่ในการตั้งค่าความปลอดภัย', 'TickTick: ลิสต์ + ปฏิทิน + โพโมโดโร จดนัดด้วยภาษาธรรมชาติ', 'สแกนกระดาษ: กล้องของระบบ/Mic Lens/Baimiao/CamScanner ถ่ายให้คมแล้วค่อย OCR', 'ควบคุมคอมพิวเตอร์ระยะไกล: Sunflower/ToDesk ถ้าคนแปลกหน้าให้คุณติดตั้งโปรแกรมควบคุมระยะไกล = หลอกลวง', 'AI ทำงานสำนักงาน: Trae และอื่น ๆ งานหนักให้คอมทำ จากมือถือติดตามได้จากระยะไกล', 'ส่งไฟล์เร็วในเครือข่ายเฉพาะที่: LocalSend/AirDrop/Feige คลิปบอร์ด: KDE Connect/เครื่องมือของแบรนด์', 'รหัสใช้ครั้งเดียว 2FA: Aegis/Microsoft Authenticator และสำรองรหัสแบบกระดาษสองที่'],
 'di-shi-si-zhang': ['มีตัวจัดการรหัสผ่านแล้ว จำรหัสหลักรหัสเดียวพอ', 'Bitwarden โอเพนซอร์สและฟรี, 1Password ประสบการณ์ดีที่สุด', 'รหัสหลักต้องยาวและซับซ้อน พร้อมเปิด 2FA', 'ตรวจความปลอดภัยรหัสผ่านเป็นประจำ', 'สถาปัตยกรรมความรู้เป็นศูนย์: แม้ผู้ให้บริการก็ไม่เห็นรหัสผ่านของคุณ การเข้ารหัสเกิดในเครื่อง', 'AES-256 + การดึงกุญแจด้วย PBKDF2/Argon2 เป็นรากฐานความปลอดภัยของตู้เซฟรหัสผ่าน', 'บทเรียนจากเหตุการณ์ LastPass ปี 2022: คนที่เสี่ยงที่สุดคือผู้ใช้รหัสหลักอ่อน', 'ความแข็งแรงของรหัสผ่านคือ "เอนโทรปี": ยาว + สุ่ม ชนะสัญลักษณ์วิเศษ', 'HaveIBeenPwned เช็กข้อมูลรั่ว 1Password Watchtower เฝ้าดูเหตุการณ์', 'Passkey สร้างบน FIDO2/WebAuthn: ต้านฟิชชิง และไม่มีรหัสผ่านถูกส่งออกไป', 'การซิงก์ Passkey ข้ามอุปกรณ์: iCloud Keychain/Google Password Manager รองรับแล้ว', 'กุญแจฮาร์ดแวร์ (YubiKey/Titan) ทนฟิชชิงและการแฮ็กสลับซิม - เหมาะกับผู้ที่เสี่ยงสูง', 'ห้องนิรภัยใช้ร่วมของ 1Password + การเข้าถึงฉุกเฉินของ Bitwarden ทำให้แชร์ในครอบครัวและทีมปลอดภัยขึ้น'],
 'di-shi-wu-zhang': ['แบตลิเทียม: ชาร์จตามใช้ กลัวร้อน และเสื่อมตามเวลา', 'ต่ำกว่า 80% สุขภาพแบต ระยะใช้งานลดลงชัดเจน', 'โปรโตคอลชาร์จเร็ว: PD/QC/VOOC/SuperCharge ไม่ใช้ร่วมกันได้', 'ชาร์จไร้สาย Qi2 เพิ่มการจัดตำแหน่งแม่เหล็ก', 'หัวใจประหยัดแบต: ลดความสว่าง + ปิดพื้นหลัง + สลับไป 4G'],
 'di-shi-liu-zhang': ['บัญชีคือทะเบียนบ้านของชีวิตดิจิทัลคุณ: ผูกทั้งรายชื่อ รูป การซื้อ และค้นหาโทรศัพท์', 'สามต้อง: เปิด 2FA ตั้งกุญแจกู้คืน และยืนยันว่าค้นหาโทรศัพท์เปิดอยู่', 'iCloud 5GB ไม่พอ: เก็บกวาด หรืออัปเกรดเป็น 50GB ราว ¥1/เดือน', 'ซิงก์สองทาง (ลบแล้วหายทั้งระบบ) สำรองคือภาพหยุดทางเดียว (ลบแล้วยังอยู่)', 'ผู้ใช้ Android ต้องเช็กแยกกัน: สำรองคลาวด์ของแบรนด์ สำรองของ Google สำรองของ WeChat'],
 'di-shi-qi-zhang': ['ทำงานข้ามอุปกรณ์: AirDrop ของ Apple/Huawei Multi-Screen Collaboration/Xiaomi Mi Share/เชื่อมต่อกับ Windows', 'ส่งไปทีวี: ไอโฟนใช้ Screen Mirroring, แอนดรอยด์ใช้การส่งไร้สาย ถ้าไม่ได้ตรวจว่าอยู่ Wi-Fi เดียวกัน', 'สมาร์ทวอตช์ = กรองแจ้งเตือน + สถานีสุขภาพ + จ่ายจากข้อมือ ซื้อให้พ่อแม่อาจช่วยชีวิตได้', 'สมาร์ทโฮมเลือกตามระบบนิเวศ: Apple HomeKit/Xiaomi Mijia/Huawei HarmonyOS Connect', 'ความปลอดภัยของการเชื่อม: ฉายในที่สาธารณะระวังความเป็นส่วนตัว และยกเลิกผูกอุปกรณ์เก่าให้ทันเวลา'],
 'di-shi-ba-zhang': ['สำรองทั้งเครื่อง: ในคอม (เชื่อถือสุด) + คลาวด์ (สบายใจสุด) กันพลาดสองชั้น', 'แชท WeChat เป็นกรณีพิเศษสุด: ต้องใช้ระบบสำรองในตัวของ WeChat เท่านั้น เครื่องมือย้ายเครื่องช่วยไม่ได้', 'กฎ 3-2-1: สำรอง 3 สำเนา บนสื่อ 2 ชนิด และ 1 ชุดอยู่นอกบ้าน', 'ย้ายโทรศัพท์: แบรนด์เดียวกันใช้แอปย้ายของทางการ ข้ามแบรนด์ต้องเตรียมทางผ่านข้อมูลก่อน'],
 'di-shi-jiu-zhang': ['อืดร้อนสี่ขั้น: ย้อนนึกถึงสิ่งที่เปลี่ยน → เช็กพื้นที่เก็บ → เช็กการใช้แบต → เช็กสัญญาณ', 'ขั้นตอนแอปเดี้ยง: ปิดเปิดใหม่ → อัปเดต → เช็กสิทธิ์ → ล้างแคช → ติดตั้งใหม่', 'ไม่ชาร์จ: ทำความสะอาดพอร์ตก่อน แล้วสลับสายกับหัวชาร์จข้ามกันหาตัวการ', 'เน็ตไม่ได้: สลับโหมดเครื่องบิน → ลืม Wi-Fi แล้วเชื่อมใหม่ → รีสตาร์ทเราเตอร์', 'การรีสตาร์ทสากลแก้ปัญหาแปลก ๆ ได้เกือบทั้งหมด ซ่อมให้เลือกศูนย์ที่ได้รับอนุญาต ก่อนส่งสำรองข้อมูลและออกจากบัญชี'],
 'di-er-shi-zhang-jinjie': ['โหมดนักพัฒนา: แตะหมายเลขบิลด์ 7 ครั้งเพื่อเปิด', 'ล็อก BL: การป้องกันของผู้ผลิต ปลดด้วยความระมัดระวัง', 'Root: ความเสี่ยงมากกว่าประโยชน์ ผู้ใช้ทั่วไปไม่แนะนำ', 'Magisk ยังต้องปลด BL แต่ซ่อนสถานะ root ได้'],
 'di-er-shi-yi-zhang': ['VPN = อุโมงค์เข้ารหัส VPN ฟรีกลับอาจเป็นคนขโมยข้อมูลคุณ', 'ป้องกันคนบุกรุกกลางคันบน Wi-Fi สาธารณะ: เชื่อ HTTPS ปิดการเชื่อมต่ออัตโนมัติ งานสำคัญใช้เน็ตมือถือ', 'การจับมือ HTTPS เข้ารหัสภายในสี่รอบ แต่เว็บฟิชชิงก็ใช้ HTTPS ได้เหมือนกัน', 'DoH/DoT เข้ารหัสคำถาม DNS ผู้ให้บริการจึงแอบดูการท่องเว็บของคุณไม่ได้', 'โหมดไม่ระบุตัวตน = ยางลบในเครื่อง ไม่ใช่เสื้อคลุมล่องหน ผู้ให้บริการและเว็บยังมองเห็นคุณ', 'เช็กลิสต์ความปลอดภัย: ปิดเชื่อมต่อ Wi-Fi อัตโนมัติ เปลี่ยนไป DNS เข้ารหัส เปิด 2FA ตรวจสิทธิ์แอป และปิดกั้น Juice Jacking'],
 'di-er-shi-er-zhang': ['กล้อง AI: จับฉาก → รวมหลายเฟรม → ปรับแต่งอัจฉริยะ', 'ผู้ช่วยเสียง: ได้ยิน → เข้าใจ → ลงมือ สามขั้น', 'AI บนเครื่อง: เร็ว เป็นส่วนตัว ทำงานออฟไลน์ได้', 'โมเดลใหญ่ AI แยกเป็นงานสนทนา/เขียน/แปล/ภาพ/เรียนรู้', 'การใช้งานจริง: แปลสด, ยางลบ AI, แต่งภาพด้วย AI, จัดการเอกสาร, ค้นหารูปด้วย AI', 'เฟรมเวิร์กพรอมป์ CRISPE: บทบาท + คำขอ + บริบท + ผลลัพธ์ + น้ำเสียง + ตัวอย่าง', 'ใช้ AI ระวังอาการหลอนและการรั่วของความเป็นส่วนตัว', '"บทบาท-บริบท-งาน-ข้อจำกัด" คือทางเข้าเขียนพรอมป์ที่ง่ายกว่า', 'ลักษณะพรอมป์ดี: เจาะจง มีบริบท มีรูปแบบ มีข้อจำกัด ตรวจสอบได้'],
 'di-er-shi-san-zhang': ['องค์ประกอบอัตโนมัติ: ทริกเกอร์ + การกระทำ + ตรรกะตัดสินใจ (ถ้าต้องการ)', 'Shortcuts ของ iOS: พิธีเช้าปุ่มเดียว โหมดประหยัดอัตโนมัติ จดค่าใช้จ่ายด้วยการสแกน', 'Android: ตัวคลิกอัตโนมัติ (แมโครหน้าจอ), Tasker (ระบบอัตโนมัติที่ทรงพลังที่สุด), MacroDroid (เป็นมิตรกับมือใหม่)', 'หลุมพราง: ทริกเกอร์ตำแหน่งไม่แม่น, iOS ไม่รันอัตโนมัติเว้นแต่ยืนยันเอง, Tasker ต้องขอสิทธิ์การเข้าถึงพิเศษ', 'ความคิดแบบอัตโนมัติ: เปลี่ยนงานซ้ำ ๆ เป็น เงื่อนไข → การกระทำ โทรศัพท์ก็กลายเป็นผู้ช่วยส่วนตัวของคุณ'],
 'di-er-shi-si-zhang': ['Bootloader คือผู้เฝ้าประตูตอนบูต การตรวจลายเซ็นกันการแก้กลับ', 'นโยบายปลด BL ต่างกันแต่ละแบรนด์ (Xiaomi เปิดให้/Huawei ล็อก)', 'ทางเลือก Root: Magisk/KernelSU/SuperSU', 'สามแบบการแฟลช: ROM ทางการ/Recovery ของบุคคลที่สาม/ROM บุคคลที่สาม'],
 'di-er-shi-wu-zhang': ['ขายโทรศัพท์เก่า: สำรอง → ออกจากบัญชี → ลบแบบเข้ารหัส → ทับและลบซ้ำ', 'มรดกดิจิทัล: ผู้ติดต่อมรดกของ iCloud/บัญชี Google ที่ไม่ใช้งาน', 'รีไซเคิล: เริ่มจากโปรแกรมเปลี่ยนเครื่องทางการ เครื่องเก่ายังทำหน้าที่กล้องหรือนำทางได้'],
 'di-er-shi-liu-zhang': ['สามมาตรฐานของโทรศัพท์ AI: โมเดลใหญ่บนเครื่อง, พลัง NPU หน่วย TOPS, AI Agent คร่อมแอป', 'กลยุทธ์ AI ของผู้ผลิต: Apple/Google/Huawei/Xiaomi/OPPO/vivo ต่างก็มีจุดเด่น', 'ดาวเทียม: ข้อความสั้น BeiDou ลงมาถึงระดับกลางแล้ว ส่วนโทร Tiantong ยังเป็นของเรือธง', 'จอพับ: ฮาร์ดแวร์สุกงอม แอปรองรับราวเจ็ดสิบเปอร์เซ็นต์ การพับค้างและแบ่งจอคือประสบการณ์เฉพาะตัว', '6G ยังอยู่ระหว่างทาง, Wi-Fi 7 มาถึงแล้ว, Bluetooth LE Audio เริ่มแพร่หลาย', 'แบตอโนดซิลิกอน-คาร์บอนทำให้ 5000-6000mAh เป็นมาตรฐานเรือธง'],
 'di-er-shi-qi-zhang': ['เปิดโหมดง่ายหรือขยายฟอนต์/ไอคอนก่อน สิ่งแวดล้อมพร้อมแล้วปัญหาหายเกือบครึ่ง', 'กฎเหล็กสามข้อกับผู้สูงวัย: อย่าเร่ง ใช้การเปรียบเทียบ และจดให้', 'หกกลโกงที่ต้องเตือนซ้ำแล้วซ้ำเล่า สามแนวป้องกันกั้นการหลอกลวงได้ 90%', 'ช่วยเหลือระยะไกลให้คุณซ่อมโทรศัพท์ให้พ่อแม่ได้แม้อยู่ต่างเมือง', 'โหมดดูแลของ WeChat + พิมพ์ด้วยเสียง คือสองฟังก์ชันที่ใช้ประโยชน์สุดสำหรับผู้ใหญ่', 'SOS ฉุกเฉินและตรวจจับการล้ม คือการตั้งค่าที่ช่วยชีวิตในจังหวะวิกฤต'],
 'di-er-shi-ba-zhang': ['เลือกโทรศัพท์สามขั้น: ความต้องการก่อน → งบต่อ → รุ่นทีหลัง', 'พารามิเตอร์หลักมีแค่ห้า: ซีพียู จอ กล้อง แบตกับชาร์จ และคำสัญญาอัปเดต', '¥1500-3500 คือช่วงคุ้มสุดและแนะนำสุด', 'เรือธงปีที่แล้วคุ้มกว่าระดับกลางปีนี้', 'ห้ากับดัก: ตำนานกล้องหลายตัว, ลัทธิเมกะพิกเซล, เวอร์ชันผู้ให้บริการ, ลัทธิจอโค้ง, ขายความ AI หลอก ๆ', '618 กับ Double 11 คือสองช่วงเวลาซื้อโทรศัพท์ที่คุ้มที่สุดในปี'],
 'di-er-shi-jiu-zhang': ['ดูข้อมูลเวลาหน้าจอก่อน การเห็นสภาพจริงคือก้าวแรกของการเปลี่ยน', 'ตั้งขีดจำกัดแอปความบันเทิง ตั้งเวลาโหมดอย่ารบกวน คืนความสนใจกลับมาเป็นของคุณ', 'กฎ 20-20-20 คือนิสัยพักสายตาที่ง่ายและได้ผลที่สุด', 'ก้มดูโทรศัพท์ คอรับน้ำหนัก 5-6 เท่าของศีรษะ ยกโทรศัพท์สูงขึ้นและขยับคอเป็นระยะ', 'ชั่วโมงก่อนนอนไม่แตะโทรศัพท์ วางที่ชาร์จไว้ไกลกว่าเอื้อมมือ', 'ยาแก้ความวิตกข้อมูลคือ "บล็อกเชิงรุก" ไม่ใช่ "เอามาเพิ่ม"'],
 'di-san-shi-zhang': ['สามค่ายการส่งภาพไร้สาย: AirPlay (Apple), Miracast (Android), DLNA (ผลักสื่อข้ามแพลตฟอร์ม)', 'ฉายด้วยสายนิ่งกว่าและหน่วงเป็นศูนย์ ในห้องประชุมต้องมีแอดแปเตอร์ HDMI', 'Samsung DeX/โหมดเดสก์ท็อปของ Huawei เปลี่ยนโทรศัพท์เป็นพีซีสำนักงานเบา ๆ', 'เชื่อมต่อในรถ: สี่ทางเลือก - CarPlay/Android Auto/HiCar/CarLife', 'กฎเหล็กการฉายในห้องประชุม: ทดสอบก่อน เตรียมแผนสำรอง ซ่อนพรีวิวการแจ้งเตือน'],
 'di-san-shi-yi-zhang': ['ก่อนถ่ายให้ชัด: ผู้ชมคือใคร ให้คุณค่าอะไร ลงคลิปที่แพลตฟอร์มไหน', 'ห้าอย่างก่อนถ่าย: 1080P/30fps เช็ดเลนส์ ล็อกโฟกัสและรูแสง เลือกแนวนอนแนวตั้ง เปิดเส้นกริด', 'ห้าท่ากล้อง: ดัน ดึง แพน เลื่อน ตาม - นิ่งมาก่อน', 'ตัดต่อด้วย CapCut: ตัด → ทรานสิชัน → ซับไตเติล → เพลงประกอบ → ส่งออก หกขั้นตอน', 'สามวินาทีแรกตัดสินทุกอย่าง หนึ่งคลิปเล่าเรื่องเดียว ความต่อเนื่องชนะพรสวรรค์'],
 'di-san-shi-er-zhang': ['โทรศัพท์หาย 30 นาทีทอง: ยืมโทรศัพท์คนอื่นโทรหาตัวเอง → ล็อกระยะไกล → ระงับซิม → หยุดยั้งการชำระเงิน → แจ้งครอบครัวและเพื่อน → แจ้งความ', '72 ชั่วโมงหลังโดนกลโกง: หยุดโอน → เก็บหลักฐาน → โทร 96110 → แจ้งความ → ติดต่อธนาคาร → เปลี่ยนรหัสผ่าน', 'โทรศัพท์ติดมัลแวร์: เซฟโหมด → ถอนแอปที่น่าสงสัย → สแกนความปลอดภัย → รีเซ็ตโรงงาน (ทางสุดท้าย)', 'บัญชีถูกแฮ็ก: เปลี่ยนรหัสผ่าน → ออกจากอุปกรณ์ → เช็กประวัติล็อกอิน → เปิด 2FA → เช็กการผูก → เช็กการชำระเงิน', '99.9% ของข้อความเรียกค่าไถ่เป็นการหลอกลวง ไม่ตอบ ไม่จ่าย เก็บภาพแล้วบล็อก', 'กลอุบายสลับใบหน้า/เสียง: จับผิดจากการกะพริบตา รูปปาก ขอบภาพ และแสง ให้เขาหมุนหน้า เอามือปิดหน้า ตั้งคำถามส่วนตัว และโทรกลับไปยังเบอร์ที่รู้จัก', 'แฮ็กสลับซิม: ถ้าโทรศัพท์ขึ้น "ไม่มีสัญญาณ" ฉับพลัน ถือเป็นสัญญาณเตือน ตั้ง PIN ซิม เปิดการยืนยันสองชั้นกับผู้ให้บริการ และย้ายบัญชีสำคัญไปใช้แอปยืนยันตัวตน', 'ห้านิสัยรายวัน: ล็อกหน้าจอ + 2FA, ค้นหาโทรศัพท์, PIN ซิม, ไม่ติดแอปแปลกปลอม, สำรองข้อมูลสม่ำเสมอ', 'แผ่นดินไหว/อากาศสุดขั้ว: หลบใกล้ตัวก่อนแล้วค่อยอพยพ ส่งเอสเอ็มเอสบอกปลอดภัยประหยัดแบตกว่าโทรยาว', 'ไม่มีสัญญาณให้ใช้ SOS ดาวเทียมก่อน (ถ้ารุ่นรองรับ) การเตือนภัยและการตั้งค่าอยู่บทที่ 13'],
 'di-san-shi-san-zhang': ['Vision Pro และแว่น AR เป็นประตูคอมพิวเตอร์ใหม่นอกเหนือจากโทรศัพท์ แต่ยังไม่แทนที่เร็ว ๆ นี้', 'อินเทอร์เฟซสมอง-คอมพิวเตอร์ยังห่างผู้บริโภคอีก 10-20 ปี จริยธรรมก่อตัวก่อนเทคโนโลยี', 'โทรศัพท์กำลังวิวัฒน์ไปสู่ "การล่องหน": จากศูนย์กลางที่อุปกรณ์ สู่ศูนย์กลางที่ตัวตน', 'จริยธรรม AI อธิปไตยข้อมูล และช่องว่างดิจิทัล คือประเด็นหลักทศวรรษข้างหน้า', 'อยู่ในโลกออนไลน์โดยยังเป็นตัวของตัวเอง คือปรัชญาที่ไม่เปลี่ยนของชีวิตดิจิทัล'],
 };
 Object.keys(summaries).forEach(id => {
 const sec = document.getElementById(id);
 // ข้ามบทที่มีสรุปแทรกอยู่แล้ว กันซ้ำซ้อน
 if (sec && !sec.querySelector('.chapter-summary')) {
 addChapterSummary(sec, summaries[id]);
 }
 });

 // ===== ปุ่มคัดลอก (เพิ่มให้องค์ประกอบ kbd) =====
 $$('.kbd').forEach(kbd => {
 const btn = document.createElement('button');
 btn.className = 'copy-btn';
 btn.innerHTML = '';
 btn.setAttribute('aria-label', 'คัดลอก');
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

 // ===== เนื้อหายาวแบบยุบได้ (ระดับ h4) =====
 sections.forEach(sec => {
 const h4s = $$('h4', sec);
 h4s.forEach(h4 => {
 // ยุบเฉพาะส่วน h4 ที่ยาว
 let sibling = h4.nextElementSibling;
 let contentLength = 0;
 let elements = [];
 while (sibling && !sibling.matches('h4, h3, .chapter-nav, .chapter-summary')) {
 contentLength += (sibling.textContent || '').length;
 elements.push(sibling);
 sibling = sibling.nextElementSibling;
 }
 if (contentLength > 800) {
 // เพิ่มหัวยุบ
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

 // ===== แดชบอร์ดการเรียน: ความคืบหน้าการอ่าน + เช็กสุขภาพโทรศัพท์ =====
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
 // ความคืบหน้าการอ่าน
 const completed = $$('.chapter-check.checked').length;
 const total = sections.length;
 const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
 if (dashProgressRing) {
 dashProgressRing.style.strokeDashoffset = DASH_RING_CIRCUMFERENCE * (1 - pct / 100);
 }
 if (progressPercent) progressPercent.textContent = pct + '%';
 if (readCountEl) readCountEl.textContent = completed + ' / ' + total;

 // จำนวนรายการโปรด
 const bookmarks = $$('.toc-item.bookmarked').length;
 if (bookmarkCountEl) bookmarkCountEl.textContent = bookmarks;

 // บทล่าสุด
 const lastCh = localStorage.getItem(POSITION_CHAPTER_KEY) || '';
 if (lastChapterEl) lastChapterEl.textContent = lastCh || '—';

 // เช็กสุขภาพ
 const checked = checkInputs.filter(c => c.checked).length;
 const totalChecks = checkInputs.length;
 const healthPct = totalChecks > 0 ? Math.round((checked / totalChecks) * 100) : 0;
 if (healthScoreEl) healthScoreEl.textContent = checked + ' / ' + totalChecks;
 if (healthBarEl) healthBarEl.style.width = healthPct + '%';
 if (healthMsgEl) {
 if (checked === totalChecks) healthMsgEl.innerHTML = 'เต็มคะแนน! ความปลอดภัยของโทรศัพท์คุณอยู่ในสภาพดีเยี่ยม';
 else if (checked >= totalChecks * 0.7) healthMsgEl.textContent = 'ดีมาก! ' + (totalChecks - checked) + ' รายการที่พัฒนาต่อได้';
 else if (checked >= totalChecks * 0.4) healthMsgEl.textContent = 'พอผ่าน - ให้จัดลำดับรายการความปลอดภัยที่ยังไม่ได้ติ๊กก่อน';
 else healthMsgEl.innerHTML = 'โทรศัพท์ของคุณยังมีช่องโหว่ความปลอดภัย - รีบแก้โดยเร็ว';
 }
 }

 // กู้คืนสถานะการติ๊ก
 checkInputs.forEach((input, i) => {
 const saved = localStorage.getItem('health-check-' + i);
 if (saved === 'true') input.checked = true;
 input.addEventListener('change', () => {
 localStorage.setItem('health-check-' + i, input.checked);
 updateDashboard();
 });
 });

 updateDashboard();
 // รีเฟรชทุก 3 วินาที (จับการติ๊กของบท)
 setInterval(updateDashboard, 3000);

 // ===== อ่านออกเสียง (TTS) =====
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
 // โคลนและเอาองค์ประกอบที่ไม่ควรอ่านออกเสียงออก
 const clone = sec.cloneNode(true);
 const removes = clone.querySelectorAll('.chapter-nav, .chapter-summary, .practice-box, .bookmark-btn, .chapter-check, .copy-btn, .collapsible-header, .collapsible-body');
 removes.forEach(el => el.remove());
 // เอาเนื้อหาที่ยุบออก แต่เก็บข้อความของมันไว้
 const text = clone.textContent.replace(/\s+/g, ' ').trim();
 return text;
 }

 function speakSection(index) {
 if (!('speechSynthesis' in window)) {
 alert('ขออภัย เบราว์เซอร์ของคุณไม่รองรับการอ่านออกเสียง ลองใช้ Chrome หรือ Edge');
 return;
 }
 if (index < 0 || index >= sections.length) return;

 window.speechSynthesis.cancel();
 ttsSectionIndex = index;
 const sec = sections[index];
 const text = getSectionText(sec);
 if (!text) return;

 const h3 = sec.querySelector('h3');
 ttsLabel.textContent = h3 ? h3.textContent : 'บทไร้ชื่อ';

 ttsUtterance = new SpeechSynthesisUtterance(text);
 ttsUtterance.lang = 'th-TH';
 ttsUtterance.rate = ttsSpeed;
 ttsUtterance.pitch = 1.0;
 ttsUtterance.volume = 1.0;

 // พยายามเลือกเสียงภาษาไทยที่เป็นธรรมชาติกว่า
 const voices = window.speechSynthesis.getVoices();
 const zhVoice = voices.find(v => v.lang.startsWith('th'));
 if (zhVoice) ttsUtterance.voice = zhVoice;

 ttsUtterance.onstart = () => {
 ttsActive = true;
 ttsPlayBtn.classList.add('playing');
 ttsPlayBtn.querySelector('.tts-ico').textContent = '⏸';
 ttsControls.classList.add('active');
 if (quickTtsBtn) quickTtsBtn.classList.add('tts-active');
 };

 ttsUtterance.onend = () => {
 // อ่านบทถัดไปอัตโนมัติ
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
 // หาบทที่มองเห็นอยู่ขณะนี้
 if (ttsSectionIndex < 0) {
 // เริ่มจากต้นหรือจากบทที่ใกล้ตำแหน่งเลื่อนที่สุด
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
 ttsLabel.textContent = 'ยังไม่เริ่ม';
 if (quickTtsBtn) quickTtsBtn.classList.remove('tts-active');
 }

 // ผูกอีเวนต์
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
 // สร้างส่วนปัจจุบันใหม่แล้วเล่น
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

 // ปุ่มลัด: กด R สลับการอ่านออกเสียง
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

 // ===== เริ่มต้นระบบ =====
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

