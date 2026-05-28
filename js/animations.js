/**
 * Frederik Schulz — Lab Monochrome
 * Refined Swiss-style motion: minimal counter loader, masked headline
 * reveals, a quiet drifting dot-field (a network the cursor "discovers"),
 * theme toggle, live Berkeley clock, custom crosshair cursor.
 *
 * Design intent: restraint. Motion is slow, intentional, and respects
 * prefers-reduced-motion. No color, ever.
 */

(function () {
    'use strict';

    const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

    const state = { dotRGB: [10, 10, 10] };
    let lenis = null;

    const debounce = (fn, ms) => {
        let t;
        return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    };

    // Icosahedron (12 vertices, 30 edges) — the giant-virus capsid form.
    // Built once from golden-ratio coordinates, normalized to a unit radius.
    const ICO = (() => {
        const p = (1 + Math.sqrt(5)) / 2;
        const raw = [
            [0, 1, p], [0, -1, p], [0, 1, -p], [0, -1, -p],
            [1, p, 0], [-1, p, 0], [1, -p, 0], [-1, -p, 0],
            [p, 0, 1], [-p, 0, 1], [p, 0, -1], [-p, 0, -1],
        ];
        const verts = raw.map((v) => {
            const m = Math.hypot(v[0], v[1], v[2]);
            return [v[0] / m, v[1] / m, v[2] / m];
        });
        const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        let min = Infinity;
        for (let i = 0; i < verts.length; i++)
            for (let j = i + 1; j < verts.length; j++) min = Math.min(min, dist(verts[i], verts[j]));
        const edges = [];
        for (let i = 0; i < verts.length; i++)
            for (let j = i + 1; j < verts.length; j++)
                if (dist(verts[i], verts[j]) <= min * 1.05) edges.push([i, j]);
        return { verts, edges };
    })();

    /* ---- Theme ---- */
    function readDotColor() {
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--dot');
        const parts = raw.split(',').map((s) => parseInt(s.trim(), 10));
        if (parts.length === 3 && parts.every((n) => !isNaN(n))) state.dotRGB = parts;
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const isDark = theme === 'dark';
        const label = document.querySelector('.theme-toggle-label');
        if (label) label.textContent = isDark ? 'Light' : 'Dark';
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', isDark ? '#0a0a0a' : '#ffffff');
        readDotColor();
    }

    function initTheme() {
        applyTheme(localStorage.getItem('theme') || 'light');
        const btn = document.querySelector('.theme-toggle');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const next =
                document.documentElement.getAttribute('data-theme') === 'dark'
                    ? 'light'
                    : 'dark';
            applyTheme(next);
            localStorage.setItem('theme', next);
        });
    }

    /* ---- Live Berkeley clock ---- */
    function initClock() {
        const el = document.querySelector('.nav-clock');
        if (!el) return;
        const fmt = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/Los_Angeles',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZoneName: 'short',
        });
        const tick = () => {
            const p = fmt.formatToParts(new Date());
            const v = (t) => (p.find((x) => x.type === t) || {}).value || '';
            el.textContent = `Berkeley ${v('hour')}:${v('minute')} ${v('timeZoneName')}`;
        };
        tick();
        setInterval(tick, 30000);
    }

    /* ---- Faint 12-column grid guides ---- */
    function initGridGuides() {
        const wrap = document.querySelector('.grid-guides');
        if (!wrap) return;
        const inner = document.createElement('div');
        inner.className = 'guide-inner';
        for (let i = 0; i < 12; i++) inner.appendChild(document.createElement('span'));
        wrap.appendChild(inner);
        requestAnimationFrame(() => wrap.classList.add('is-on'));
    }

    /* ---- Navigation: active tracking + smooth anchors ---- */
    function initNav() {
        const links = [...document.querySelectorAll('.nav-link')];
        const sections = ['profile', 'work', 'connect']
            .map((id) => document.getElementById(id))
            .filter(Boolean);

        const onScroll = () => {
            const y = window.scrollY + 90;
            let current = '';
            sections.forEach((s) => { if (y >= s.offsetTop) current = s.id; });
            links.forEach((l) => l.classList.toggle('is-active', l.dataset.section === current));
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        document.querySelectorAll('a[href^="#"]').forEach((a) => {
            a.addEventListener('click', (e) => {
                const href = a.getAttribute('href');
                if (!href || href === '#') return;
                const target = document.querySelector(href);
                if (!target) return;
                e.preventDefault();
                if (lenis) lenis.scrollTo(target, { offset: -60 });
                else target.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });
            });
        });
    }

    /* ---- Lenis smooth scroll ---- */
    function initLenis() {
        lenis = new Lenis({
            duration: 1.15,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
    }

    /* ---- Loader: counter + hairline, then slide away ---- */
    function initLoader(done) {
        const loader = document.querySelector('.loader');
        const count = document.querySelector('.loader-count');
        const fill = document.querySelector('.loader-bar-fill');
        if (!loader) { done(); return; }

        const c = { v: 0 };
        // done() first: it applies the headline's hidden start (fromTo
        // immediateRender) while the loader still covers the screen, so the
        // reveal can't flash its final position before animating.
        gsap.timeline({ onComplete: () => { done(); loader.remove(); } })
            .to(fill, { scaleX: 1, duration: 1.0, ease: 'power2.inOut' }, 0)
            .to(c, {
                v: 100,
                duration: 1.0,
                ease: 'power2.inOut',
                onUpdate: () => {
                    if (count) count.textContent = String(Math.round(c.v)).padStart(3, '0');
                },
            }, 0)
            .to(loader, { yPercent: -100, duration: 0.8, ease: 'expo.inOut' }, '+=0.15');
    }

    /* ---- Masthead reveal (masked headline + rise) ---- */
    function revealMasthead() {
        // fromTo with an explicit percentage start: GSAP can't read a CSS
        // translateY(%) back as yPercent (it lands in the px channel), so we
        // own both endpoints here or the headline never leaves its mask.
        gsap.timeline({ defaults: { ease: 'expo.out' } })
            .fromTo('.masthead-title .line-in',
                { yPercent: 110 },
                { yPercent: 0, duration: 1.1, stagger: 0.12 })
            .to('.masthead-rule', { scaleX: 1, duration: 1.0, ease: 'power3.inOut' }, '-=0.7')
            .to('.masthead [data-reveal="rise"]',
                { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, '-=0.8');
    }

    /* ---- Scroll-triggered reveals (sections) ---- */
    function initScrollReveals() {
        gsap.utils
            .toArray('[data-reveal="rise"]')
            .filter((el) => !el.closest('.masthead'))
            .forEach((el) => {
                gsap.to(el, {
                    opacity: 1,
                    y: 0,
                    duration: 0.9,
                    ease: 'expo.out',
                    scrollTrigger: { trigger: el, start: 'top 88%', once: true },
                });
            });
    }

    /* ---- Capsid field: icosahedral virus particles; click to assemble ----
       Giant-virus capsids are icosahedra, so the masthead motif is a field of
       them. A few drift at rest; every left click seeds one that stays. */
    function initCapsidField() {
        const canvas = document.querySelector('.dotfield');
        const host = document.querySelector('.masthead');
        if (!canvas || !host) return;

        const ctx = canvas.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const MAX_PLACED = 140;       // soft cap; oldest fades out beyond it
        const REVEAL = 200;           // cursor "illuminates" nearby capsids
        let w = 0, h = 0, now = 0, paused = false;
        const mouse = { x: -9999, y: -9999 };
        const shapes = [];

        function makeShape(x, y, r, drift) {
            return {
                x, y, r, drift, born: now, fade: 1, dying: false,
                vx: drift ? (Math.random() - 0.5) * 0.16 : 0,
                vy: drift ? (Math.random() - 0.5) * 0.16 : 0,
                px: Math.random() * Math.PI * 2,        // rotation phase
                py: Math.random() * Math.PI * 2,
                sx: 0.08 + Math.random() * 0.22,        // spin (rad/sec)
                sy: 0.08 + Math.random() * 0.22,
                base: drift ? 0.09 : 0.2,               // edge opacity
            };
        }

        function resize() {
            w = host.offsetWidth;
            h = host.offsetHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function seedAmbient() {
            const n = w < 700 ? 2 : 4;
            for (let i = 0; i < n; i++) {
                shapes.push(makeShape(Math.random() * w, Math.random() * h, 28 + Math.random() * 24, true));
            }
        }

        function project(s, rad, ax, ay) {
            const cax = Math.cos(ax), sax = Math.sin(ax);
            const cay = Math.cos(ay), say = Math.sin(ay);
            return ICO.verts.map((v) => {
                const y1 = v[1] * cax - v[2] * sax;
                const z1 = v[1] * sax + v[2] * cax;
                const x2 = v[0] * cay + z1 * say;
                const z2 = -v[0] * say + z1 * cay;
                return [s.x + x2 * rad, s.y + y1 * rad, z2];
            });
        }

        function drawShape(s, r, g, b) {
            const enter = Math.min((now - s.born) / 0.5, 1);
            const grow = 1 - Math.pow(1 - enter, 3);     // easeOutCubic
            const near = Math.hypot(s.x - mouse.x, s.y - mouse.y) < REVEAL + s.r;
            const aMul = s.fade * enter * (near ? 1.8 : 1);
            const p = project(s, s.r * grow, s.px + now * s.sx, s.py + now * s.sy);
            for (const [i, j] of ICO.edges) {
                const depth = 0.4 + 0.6 * ((p[i][2] + p[j][2]) / 4 + 0.5);
                ctx.strokeStyle = `rgba(${r},${g},${b},${s.base * depth * aMul})`;
                ctx.beginPath();
                ctx.moveTo(p[i][0], p[i][1]);
                ctx.lineTo(p[j][0], p[j][1]);
                ctx.stroke();
            }
            for (const v of p) {
                ctx.fillStyle = `rgba(${r},${g},${b},${(s.base + 0.12) * (0.4 + 0.6 * ((v[2] + 1) / 2)) * aMul})`;
                ctx.beginPath();
                ctx.arc(v[0], v[1], 1.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function step(time) {
            if (paused) return;
            now = time;
            ctx.clearRect(0, 0, w, h);
            ctx.lineWidth = 1;
            const [r, g, b] = state.dotRGB;
            for (let i = shapes.length - 1; i >= 0; i--) {
                const s = shapes[i];
                if (s.drift) {
                    s.x += s.vx; s.y += s.vy;
                    if (s.x < -s.r) s.x = w + s.r; else if (s.x > w + s.r) s.x = -s.r;
                    if (s.y < -s.r) s.y = h + s.r; else if (s.y > h + s.r) s.y = -s.r;
                }
                if (s.dying && (s.fade -= 0.02) <= 0) { shapes.splice(i, 1); continue; }
                drawShape(s, r, g, b);
            }
        }

        function spawn(x, y) {
            shapes.push(makeShape(x, y, 34 + Math.random() * 30, false));
            const placed = shapes.filter((s) => !s.drift && !s.dying);
            if (placed.length > MAX_PLACED) placed[0].dying = true;
            const hint = document.querySelector('.capsid-hint');
            if (hint) hint.classList.add('is-hidden');
        }

        resize();
        seedAmbient();
        window.addEventListener('resize', debounce(resize, 200));
        host.addEventListener('mousemove', (e) => {
            const rect = host.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });
        host.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });
        host.addEventListener('click', (e) => {
            if (e.target.closest('a, button')) return;
            const rect = host.getBoundingClientRect();
            spawn(e.clientX - rect.left, e.clientY - rect.top);
        });
        gsap.ticker.add(step);
        new IntersectionObserver(
            ([e]) => { paused = !e.isIntersecting; },
            { threshold: 0 }
        ).observe(host);
    }

    /* ---- Custom crosshair cursor ---- */
    function initCursor() {
        const dot = document.querySelector('.cursor');
        if (!dot) return;
        document.documentElement.classList.add('has-cursor');
        dot.style.display = 'block';
        gsap.set(dot, { xPercent: -50, yPercent: -50 });
        const xTo = gsap.quickTo(dot, 'x', { duration: 0.22, ease: 'power3' });
        const yTo = gsap.quickTo(dot, 'y', { duration: 0.22, ease: 'power3' });

        window.addEventListener('mousemove', (e) => {
            xTo(e.clientX);
            yTo(e.clientY);
            dot.classList.add('is-active');
        });
        const sel = 'a, button, .index-link, .theme-toggle';
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest(sel)) dot.classList.add('is-hover');
        });
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest(sel)) dot.classList.remove('is-hover');
        });
    }

    /* ---- Boot ---- */
    function init() {
        if (!window.gsap) {
            document.documentElement.classList.remove('js');
            const l = document.querySelector('.loader');
            if (l) l.remove();
            return;
        }
        gsap.registerPlugin(ScrollTrigger);

        initTheme();
        initClock();
        initGridGuides();
        initNav();

        if (REDUCE) {
            const l = document.querySelector('.loader');
            if (l) l.remove();
            return;
        }

        initLenis();
        if (FINE) {
            initCursor();
            initCapsidField();
        }
        initLoader(revealMasthead);
        initScrollReveals();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
