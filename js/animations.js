/**
 * Animations: Loader, Lenis smooth scroll, per-character hero reveal,
 * 3D horizontal work gallery, separator marquees, fill-wipe hovers,
 * contrast toggle, nav tracking. Easing modeled on wodniack.dev.
 */

(function () {
    gsap.registerPlugin(ScrollTrigger);

    // --- Text splitting utilities ---

    function splitToChars(el) {
        const fragment = document.createDocumentFragment();
        const chars = [];
        const nodes = [...el.childNodes];

        nodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                fragment.appendChild(node.cloneNode(true));
                return;
            }
            if (node.nodeType !== Node.TEXT_NODE) return;

            [...node.textContent].forEach((ch) => {
                if (ch === ' ') {
                    fragment.appendChild(document.createTextNode(' '));
                    return;
                }
                const wrap = document.createElement('span');
                wrap.style.cssText =
                    'display:inline-block;clip-path:inset(-5% -3% -15% -3%)';
                const inner = document.createElement('span');
                inner.style.display = 'inline-block';
                inner.textContent = ch;
                wrap.appendChild(inner);
                fragment.appendChild(wrap);
                chars.push(inner);
            });
        });

        el.innerHTML = '';
        el.appendChild(fragment);
        return chars;
    }

    function splitToWords(el) {
        const text = el.textContent.trim();
        el.innerHTML = '';
        const words = [];

        text.split(/\s+/).forEach((word, i) => {
            if (i > 0) el.appendChild(document.createTextNode(' '));
            const wrap = document.createElement('span');
            wrap.style.cssText =
                'display:inline-block;clip-path:inset(-5% -5% -15% -5%);vertical-align:top';
            const inner = document.createElement('span');
            inner.style.display = 'inline-block';
            inner.textContent = word;
            wrap.appendChild(inner);
            el.appendChild(wrap);
            words.push(inner);
        });

        return words;
    }

    // --- Lenis smooth scroll ---
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // --- Directional patterns for char animation (top/right/bottom/left cycle) ---
    const DIRECTIONS = [
        { yPercent: -120, xPercent: 0 },
        { yPercent: 0, xPercent: 120 },
        { yPercent: 120, xPercent: 0 },
        { yPercent: 0, xPercent: -120 },
    ];

    // --- Master animation timeline ---
    function createMasterTimeline() {
        const tl = gsap.timeline();

        // Loader
        tl.to('.loader-inner', {
            opacity: 0,
            scale: 0.85,
            duration: 0.5,
            delay: 0.6,
            ease: 'expo.in',
        }).to('.loader', {
            yPercent: -100,
            duration: 0.9,
            ease: 'expo.inOut',
            onComplete: () => {
                const loader = document.querySelector('.loader');
                if (loader) loader.remove();
            },
        });

        // Hero character reveal
        const title = document.querySelector('.hero-title');
        const star = document.querySelector('.hero-star');

        if (title) {
            const chars = splitToChars(title);
            chars.forEach((c, i) => gsap.set(c, DIRECTIONS[i % 4]));

            tl.to(
                chars,
                {
                    yPercent: 0,
                    xPercent: 0,
                    duration: 1,
                    stagger: 0.025,
                    ease: 'expo.inOut',
                },
                '-=0.3'
            );
        }

        // Star spin-in
        if (star) {
            gsap.set(star, { scale: 0, rotation: -180 });
            tl.to(
                star,
                { scale: 1, rotation: 0, duration: 1, ease: 'expo.out' },
                '<0.4'
            );
            // Continuous rotation
            gsap.to(star, {
                rotation: 360,
                duration: 12,
                repeat: -1,
                ease: 'none',
            });
        }

        // Subtitle word reveal
        const subtitle = document.querySelector('.hero-subtitle');
        if (subtitle) {
            const words = splitToWords(subtitle);
            gsap.set(words, { yPercent: 110 });
            tl.to(
                words,
                {
                    yPercent: 0,
                    duration: 0.8,
                    stagger: 0.02,
                    ease: 'expo.out',
                },
                '-=0.6'
            );
        }

        // Role tags
        tl.from(
            '.role-tag',
            {
                yPercent: 100,
                opacity: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'expo.out',
            },
            '-=0.5'
        );

        return tl;
    }

    // --- Scroll-triggered reveals (aggressive easing) ---
    function initScrollReveals() {
        document.querySelectorAll('.reveal-el').forEach((el) => {
            gsap.to(el, {
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                    toggleActions: 'play none none none',
                },
                opacity: 1,
                y: 0,
                duration: 1,
                ease: 'expo.out',
            });
        });
    }

    // --- Horizontal work gallery with 3D card entrances ---
    function initWorkGallery() {
        const gallery = document.querySelector('.work-gallery');
        const track = document.querySelector('.work-track');
        if (!gallery || !track) return;

        const cards = track.querySelectorAll('.work-card');
        const mm = gsap.matchMedia();

        mm.add('(min-width: 768px)', () => {
            const totalScroll = track.scrollWidth - gallery.clientWidth;

            const scrollTween = gsap.to(track, {
                x: -totalScroll,
                ease: 'none',
                scrollTrigger: {
                    trigger: gallery,
                    start: 'top top',
                    end: () => `+=${totalScroll}`,
                    pin: true,
                    scrub: 1,
                    invalidateOnRefresh: true,
                },
            });

            // Per-card 3D entrance within horizontal scroll
            cards.forEach((card, i) => {
                gsap.from(card, {
                    rotateY: i % 2 === 0 ? 8 : -8,
                    scale: 0.9,
                    opacity: 0,
                    transformPerspective: 800,
                    immediateRender: false,
                    scrollTrigger: {
                        trigger: card,
                        containerAnimation: scrollTween,
                        start: 'left 95%',
                        end: 'left 65%',
                        scrub: 1,
                    },
                });
            });

            return () => {
                gsap.set(track, { x: 0 });
                cards.forEach((c) =>
                    gsap.set(c, { rotateY: 0, scale: 1, opacity: 1 })
                );
            };
        });

        // Mobile: stagger reveal
        mm.add('(max-width: 767px)', () => {
            cards.forEach((card) => {
                gsap.to(card, {
                    scrollTrigger: {
                        trigger: card,
                        start: 'top 85%',
                    },
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: 'expo.out',
                });
            });
        });
    }

    // --- Separator marquees ---
    function initSeparators() {
        document.querySelectorAll('.separator-track').forEach((track) => {
            const first = track.querySelector('span');
            if (!first) return;
            const w = first.offsetWidth;
            gsap.to(track, {
                x: -w,
                duration: 25,
                ease: 'none',
                repeat: -1,
                modifiers: {
                    x: gsap.utils.unitize((x) => parseFloat(x) % w),
                },
            });
        });
    }

    // --- Contrast toggle ---
    function initContrastToggle() {
        const btn = document.querySelector('.contrast-toggle');
        if (!btn) return;

        if (localStorage.getItem('high-contrast') === 'true') {
            document.documentElement.classList.add('high-contrast');
        }

        btn.addEventListener('click', () => {
            document.documentElement.classList.toggle('high-contrast');
            const isHC =
                document.documentElement.classList.contains('high-contrast');
            localStorage.setItem('high-contrast', isHC);
        });
    }

    // --- Active nav tracking ---
    function initNavTracking() {
        const links = document.querySelectorAll('.nav-link');
        const sections = document.querySelectorAll('section[id]');

        function update() {
            const y = window.scrollY + 120;
            sections.forEach((s) => {
                const top = s.offsetTop;
                const id = s.getAttribute('id');
                if (y >= top && y < top + s.offsetHeight) {
                    links.forEach((l) =>
                        l.classList.toggle(
                            'active',
                            l.getAttribute('href') === `#${id}`
                        )
                    );
                }
            });
        }

        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    // --- Nav smooth scroll via Lenis ---
    function initNavScroll() {
        document.querySelectorAll('a[href^="#"]').forEach((link) => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (!href || href === '#') return;
                const target = document.querySelector(href);
                if (!target) return;
                e.preventDefault();
                lenis.scrollTo(target, { offset: -56 });
            });
        });
    }

    // --- Mouse-reactive SVG grid on hero ---
    function initHeroGrid() {
        const hero = document.querySelector('.hero');
        if (!hero) return;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('hero-grid');
        svg.setAttribute('aria-hidden', 'true');
        hero.insertBefore(svg, hero.firstChild);

        const SPACING = 80;
        const MOUSE_RADIUS = 150;
        const SPRING = 0.005;
        const DAMPING = 0.925;
        const WAVE_AMP = 6;
        const MAX_DISP = 80;
        const isMobile = window.matchMedia('(max-width: 767px)').matches;

        let cols = 0;
        let rows = 0;
        let points = [];
        let rowPaths = [];
        let colPaths = [];
        let mouse = { x: -9999, y: -9999 };
        let smooth = { x: -9999, y: -9999 };
        let paused = false;

        function buildGrid() {
            const w = hero.offsetWidth;
            const h = hero.offsetHeight;
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
            svg.setAttribute('width', w);
            svg.setAttribute('height', h);

            cols = Math.ceil(w / SPACING) + 1;
            rows = Math.ceil(h / SPACING) + 1;
            points = [];

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    points.push({
                        ox: c * SPACING,
                        oy: r * SPACING,
                        cx: 0, cy: 0,
                        vx: 0, vy: 0,
                    });
                }
            }

            svg.innerHTML = '';
            rowPaths = [];
            colPaths = [];

            for (let r = 0; r < rows; r++) {
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                svg.appendChild(p);
                rowPaths.push(p);
            }
            for (let c = 0; c < cols; c++) {
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                svg.appendChild(p);
                colPaths.push(p);
            }
        }

        function tick(time) {
            if (paused) return;

            smooth.x += (mouse.x - smooth.x) * 0.1;
            smooth.y += (mouse.y - smooth.y) * 0.1;

            const t = time;

            for (let i = 0; i < points.length; i++) {
                const pt = points[i];
                let wx = Math.sin(pt.ox * 0.003 + t) * WAVE_AMP;
                let wy = Math.cos(pt.oy * 0.003 + t * 0.7) * WAVE_AMP;

                if (!isMobile) {
                    const dx = pt.ox + pt.cx - smooth.x;
                    const dy = pt.oy + pt.cy - smooth.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < MOUSE_RADIUS && dist > 0) {
                        const force = (1 - dist / MOUSE_RADIUS) * 20;
                        pt.vx += (dx / dist) * force * 0.15;
                        pt.vy += (dy / dist) * force * 0.15;
                    }
                }

                pt.vx += (0 - pt.cx) * SPRING;
                pt.vy += (0 - pt.cy) * SPRING;
                pt.vx *= DAMPING;
                pt.vy *= DAMPING;
                pt.cx += pt.vx;
                pt.cy += pt.vy;

                pt.cx = Math.max(-MAX_DISP, Math.min(MAX_DISP, pt.cx));
                pt.cy = Math.max(-MAX_DISP, Math.min(MAX_DISP, pt.cy));

                pt.fx = pt.ox + pt.cx + wx;
                pt.fy = pt.oy + pt.cy + wy;
            }

            for (let r = 0; r < rows; r++) {
                let d = '';
                for (let c = 0; c < cols; c++) {
                    const pt = points[r * cols + c];
                    d += (c === 0 ? 'M' : 'L') + pt.fx.toFixed(1) + ',' + pt.fy.toFixed(1);
                }
                rowPaths[r].setAttribute('d', d);
            }

            for (let c = 0; c < cols; c++) {
                let d = '';
                for (let r = 0; r < rows; r++) {
                    const pt = points[r * cols + c];
                    d += (r === 0 ? 'M' : 'L') + pt.fx.toFixed(1) + ',' + pt.fy.toFixed(1);
                }
                colPaths[c].setAttribute('d', d);
            }
        }

        buildGrid();
        window.addEventListener('resize', buildGrid);

        hero.addEventListener('mousemove', (e) => {
            const rect = hero.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });

        hero.addEventListener('mouseleave', () => {
            mouse.x = -9999;
            mouse.y = -9999;
        });

        gsap.ticker.add(tick);

        const observer = new IntersectionObserver(
            ([entry]) => { paused = !entry.isIntersecting; },
            { threshold: 0 }
        );
        observer.observe(hero);
    }

    // --- Magnetic letter hover on hero chars ---
    function initMagneticChars() {
        const hero = document.querySelector('.hero');
        const title = document.querySelector('.hero-title');
        if (!hero || !title) return;
        if (window.matchMedia('(max-width: 767px)').matches) return;

        const RADIUS = 120;
        const STRENGTH = 15;
        const wrappers = title.querySelectorAll('span > span');
        if (!wrappers.length) return;

        hero.addEventListener('mousemove', (e) => {
            const mx = e.clientX;
            const my = e.clientY;

            wrappers.forEach((el) => {
                const rect = el.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const dx = cx - mx;
                const dy = cy - my;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < RADIUS) {
                    const factor = (1 - dist / RADIUS) * STRENGTH;
                    gsap.to(el, {
                        x: (dx / dist) * factor,
                        y: (dy / dist) * factor,
                        duration: 0.3,
                        ease: 'power2.out',
                        overwrite: 'auto',
                    });
                } else {
                    gsap.to(el, {
                        x: 0,
                        y: 0,
                        duration: 0.5,
                        ease: 'power2.out',
                        overwrite: 'auto',
                    });
                }
            });
        });

        hero.addEventListener('mouseleave', () => {
            gsap.to(Array.from(wrappers), {
                x: 0,
                y: 0,
                duration: 0.5,
                ease: 'power2.out',
                overwrite: 'auto',
            });
        });
    }

    // --- Click hero to cycle accent color ---
    function initColorCycle() {
        const hero = document.querySelector('.hero');
        if (!hero) return;

        const PALETTE = [
            '#0d7377', '#4834d4', '#b71540',
            '#0c2461', '#6f1e51', '#1e8449',
        ];
        let idx = 0;

        hero.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            idx = (idx + 1) % PALETTE.length;
            document.documentElement.style.setProperty('--color-accent', PALETTE[idx]);
        });
    }

    // --- Init ---
    function init() {
        createMasterTimeline();
        initHeroGrid();
        initMagneticChars();
        initColorCycle();
        initScrollReveals();
        initWorkGallery();
        initSeparators();
        initContrastToggle();
        initNavTracking();
        initNavScroll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
