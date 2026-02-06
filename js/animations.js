/**
 * Site animations: Lenis smooth scroll, GSAP hero reveal,
 * scroll-triggered reveals, horizontal work gallery, DNA marquee,
 * contrast toggle, and active nav tracking.
 */

(function () {
    gsap.registerPlugin(ScrollTrigger);

    // --- Lenis smooth scroll ---
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // --- Hero word-by-word reveal ---
    function initHeroReveal() {
        const heroWords = document.querySelectorAll('.hero-word');
        const heroStar = document.querySelector('.hero-star');

        if (heroStar) {
            gsap.to(heroStar, {
                opacity: 1,
                duration: 0.6,
                delay: 0.2,
                ease: 'power2.out',
            });
        }

        gsap.to(heroWords, {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.04,
            delay: 0.4,
            ease: 'power3.out',
        });
    }

    // --- Scroll-triggered reveals ---
    function initScrollReveals() {
        const elements = document.querySelectorAll('.reveal-element');

        elements.forEach((el) => {
            gsap.to(el, {
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                    toggleActions: 'play none none none',
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: 'power2.out',
            });
        });
    }

    // --- Horizontal work gallery (desktop) ---
    function initWorkGallery() {
        const gallery = document.querySelector('.work-gallery');
        const track = document.querySelector('.work-track');
        if (!gallery || !track) return;

        const mm = gsap.matchMedia();

        mm.add('(min-width: 768px)', () => {
            const totalScroll = track.scrollWidth - gallery.clientWidth;

            gsap.to(track, {
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

            return () => {
                gsap.set(track, { x: 0 });
            };
        });

        // Mobile: stagger reveal for cards
        mm.add('(max-width: 767px)', () => {
            const cards = track.querySelectorAll('.work-card');
            cards.forEach((card, i) => {
                gsap.to(card, {
                    scrollTrigger: {
                        trigger: card,
                        start: 'top 85%',
                        toggleActions: 'play none none none',
                    },
                    opacity: 1,
                    y: 0,
                    duration: 0.6,
                    delay: i * 0.05,
                    ease: 'power2.out',
                });
            });
        });
    }

    // --- DNA marquee ---
    function initDnaMarquee() {
        const track = document.querySelector('.dna-track');
        if (!track) return;

        const spans = track.querySelectorAll('span');
        if (spans.length < 2) return;

        const width = spans[0].offsetWidth;

        gsap.to(track, {
            x: -width,
            duration: 30,
            ease: 'none',
            repeat: -1,
            modifiers: {
                x: gsap.utils.unitize((x) => parseFloat(x) % width),
            },
        });
    }

    // --- Contrast toggle ---
    function initContrastToggle() {
        const btn = document.querySelector('.contrast-toggle');
        if (!btn) return;

        const stored = localStorage.getItem('high-contrast');
        if (stored === 'true') {
            document.documentElement.classList.add('high-contrast');
        }

        btn.addEventListener('click', () => {
            document.documentElement.classList.toggle('high-contrast');
            const isHC = document.documentElement.classList.contains('high-contrast');
            localStorage.setItem('high-contrast', isHC);
        });
    }

    // --- Active nav tracking ---
    function initNavTracking() {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('section[id]');

        function update() {
            const scrollPos = window.scrollY + 120;

            sections.forEach((section) => {
                const top = section.offsetTop;
                const height = section.offsetHeight;
                const id = section.getAttribute('id');

                if (scrollPos >= top && scrollPos < top + height) {
                    navItems.forEach((item) => {
                        item.classList.toggle(
                            'active',
                            item.getAttribute('href') === `#${id}`
                        );
                    });
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
        initHeroReveal();
        initScrollReveals();
        initWorkGallery();
        initDnaMarquee();
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
