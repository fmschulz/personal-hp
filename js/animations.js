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

    // --- Init ---
    function init() {
        createMasterTimeline();
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
