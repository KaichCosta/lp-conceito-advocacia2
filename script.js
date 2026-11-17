/**
 * ROBERT ADVOCACIA & SOLUÇÕES JURÍDICAS — script.js (v2)
 *
 * Correções em relação à versão anterior:
 * - Ordem de inicialização: a versão antiga chamava updateScrollDynamics() antes de
 *   declarar `const sections`. Isso gerava ReferenceError (TDZ) e interrompia todo o
 *   restante do script: menu mobile, carrossel, timeline, formulário e modal.
 * - Carrossel com arrasto real (Pointer Events), wrap suave e rotação automática pausável.
 * - Timeline desenhada a partir da posição real dos cards, então a curva sempre passa pelos nós.
 * - Código morto removido (classes sem CSS correspondente, listeners duplicados).
 */
(() => {
  'use strict';

  /* ==========================================================================
     CONFIGURAÇÃO
     ========================================================================== */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const AUTOPLAY_MS = 6000;     // 0 desativa a rotação automática do carrossel
  const FORM_ENDPOINT = null;   // ex.: 'https://formspree.io/f/SEU_ID' ou webhook do n8n/CRM
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================================
     REFERÊNCIAS DO DOM (declaradas antes de qualquer chamada)
     ========================================================================== */
  const root = document.documentElement;
  const navbar = document.getElementById('navbar');
  const heroSection = document.getElementById('hero');
  const heroScales = document.getElementById('heroScales');
  const heroText = document.getElementById('heroText');
  const heroLawyerWrapper = document.getElementById('heroLawyerWrapper');
  const heroCard = document.getElementById('heroCard');
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link');

  /* ==========================================================================
     1. SCROLL: PARALLAX DA HERO, NAVBAR E LINK ATIVO
     ========================================================================== */
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateScrollDynamics(window.scrollY);
      ticking = false;
    });
  }

  function updateScrollDynamics(scrollY) {
    root.style.setProperty('--scroll-y', `${scrollY}px`);
    navbar?.classList.toggle('is-scrolled', scrollY > 40);
    if (!reduceMotion) updateHeroParallax(scrollY);
    updateActiveNavLink(scrollY);
  }

  function updateHeroParallax(scrollY) {
    if (!heroSection) return;
    const heroHeight = heroSection.offsetHeight;
    if (scrollY > heroHeight + 150) return;

    const progress = Math.min(scrollY / heroHeight, 1);
    const opacity = Math.max(0, 1 - progress * 1.35);
    root.style.setProperty('--hero-opacity', opacity.toFixed(3));

    // Velocidades diferentes por camada: balança (fundo) mais lenta, card (frente) mais rápido
    if (heroScales) {
      heroScales.style.transform = `translate(-50%, calc(-50% + ${scrollY * 0.35}px))`;
    }
    if (heroLawyerWrapper) {
      heroLawyerWrapper.style.transform = `translateY(${scrollY * 0.16}px) scale(${1 + progress * 0.03})`;
    }
    if (heroText) {
      heroText.style.transform = `translateY(${scrollY * 0.25}px)`;
      heroText.style.opacity = opacity;
    }
    if (heroCard) {
      heroCard.style.transform = `translateY(${-scrollY * 0.15}px)`;
    }
  }

  function updateActiveNavLink(scrollY) {
    const probe = scrollY + 160;
    let current = null;

    sections.forEach((section) => {
      if (probe >= section.offsetTop && probe < section.offsetTop + section.offsetHeight) {
        current = section.id;
      }
    });

    if (!current) return;
    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
  }

  /* ==========================================================================
     2. MÉTRICAS (CONTADOR AO ENTRAR NA TELA)
     ========================================================================== */
  function setupMetrics() {
    const ribbon = document.getElementById('heroMetrics');
    if (!ribbon || reduceMotion) return;

    const numbers = ribbon.querySelectorAll('.metric-number');
    const DURATION = 1800;

    const animate = (el) => {
      const target = parseInt(el.dataset.target, 10);
      const suffix = el.textContent.replace(/\d/g, ''); // '+', '%' ou ''
      const start = performance.now();
      el.textContent = `0${suffix}`;

      const frame = (now) => {
        const p = Math.min((now - start) / DURATION, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = `${Math.round(target * eased)}${suffix}`;
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };

    const observer = new IntersectionObserver((entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) {
        numbers.forEach(animate);
        obs.disconnect();
      }
    }, { threshold: 0.25 });

    observer.observe(ribbon);
  }

  /* ==========================================================================
     3. MENU MOBILE
     ========================================================================== */
  function setupMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.header__nav');
    if (!toggle || !nav) return;

    const close = () => {
      nav.classList.remove('is-mobile-open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-mobile-open', open);
    });

    nav.querySelectorAll('.nav__link').forEach((link) => link.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* ==========================================================================
     4. CARROSSEL DE SERVIÇOS (BOTÕES, ARRASTO COM MOUSE, ROTAÇÃO AUTOMÁTICA)
     ========================================================================== */
  function setupCarousel() {
    const track = document.getElementById('servicesTrack');
    if (!track) return;

    const carousel = document.getElementById('servicesCarousel');
    const prevBtn = document.getElementById('prevServiceBtn');
    const nextBtn = document.getElementById('nextServiceBtn');

    // Largura de um passo = largura do card + gap real (lido do CSS, não fixo)
    const stepSize = () => {
      const card = track.querySelector('.service-card');
      const gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      return card ? card.offsetWidth + gap : 330;
    };
    const maxScroll = () => track.scrollWidth - track.clientWidth;

    const next = () => {
      if (track.scrollLeft >= maxScroll() - 10) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: stepSize(), behavior: 'smooth' });
      }
    };

    const prev = () => {
      if (track.scrollLeft <= 10) {
        track.scrollTo({ left: maxScroll(), behavior: 'smooth' });
      } else {
        track.scrollBy({ left: -stepSize(), behavior: 'smooth' });
      }
    };

    prevBtn?.addEventListener('click', prev);
    nextBtn?.addEventListener('click', next);

    // Arrasto com mouse. Touch continua usando o scroll nativo do navegador.
    let isDown = false;
    let moved = false;
    let startX = 0;
    let startScroll = 0;

    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      isDown = true;
      moved = false;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.classList.add('is-dragging');
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) moved = true;
      track.scrollLeft = startScroll - dx;
    });

    const endDrag = () => {
      if (!isDown) return;
      isDown = false;
      track.classList.remove('is-dragging');
      // Encaixa no card mais próximo ao soltar
      const step = stepSize();
      track.scrollTo({ left: Math.round(track.scrollLeft / step) * step, behavior: 'smooth' });
    };

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // Soltar um arrasto não pode disparar o link do card
    track.addEventListener('click', (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // Evita o "fantasma" nativo de arrastar imagem/link
    track.addEventListener('dragstart', (e) => e.preventDefault());

    // Rotação automática: pausa com mouse/toque sobre o carrossel e com foco de teclado
    let paused = false;
    carousel?.addEventListener('pointerenter', () => { paused = true; });
    carousel?.addEventListener('pointerleave', () => { paused = false; });
    carousel?.addEventListener('focusin', () => { paused = true; });
    carousel?.addEventListener('focusout', () => { paused = false; });

    if (AUTOPLAY_MS > 0 && !reduceMotion) {
      setInterval(() => {
        if (!paused && !isDown && !document.hidden) next();
      }, AUTOPLAY_MS);
    }
  }

  /* ==========================================================================
     5. TIMELINE: CURVA DOURADA DESENHADA A PARTIR DOS CARDS
     Os nós são calculados com offsets (ignoram transforms de hover), então a curva
     continua encostando nos cards em qualquer largura de tela.
     ========================================================================== */
  function setupTimeline() {
    const wrap = document.querySelector('.timeline-wrapper');
    const svg = wrap?.querySelector('.timeline-wavy-line');
    const cluster = wrap?.querySelector('.timeline-cards-cluster');
    if (!wrap || !svg || !cluster) return;

    const cards = [...cluster.querySelectorAll('.timeline-card')];
    if (cards.length < 2) return;

    // Toque: abre/fecha a descrição (no mobile não existe hover)
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const wasActive = card.classList.contains('is-touch-active');
        cards.forEach((c) => c.classList.remove('is-touch-active'));
        if (!wasActive) card.classList.add('is-touch-active');
      });
    });

    let frame = 0;
    const draw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => drawTimelinePath(wrap, svg, cluster, cards));
    };

    if ('ResizeObserver' in window) {
      new ResizeObserver(draw).observe(wrap);
    } else {
      window.addEventListener('resize', draw);
    }
    draw();
  }

  function el(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  // Curva Catmull-Rom convertida em Bézier: passa exatamente pelos pontos, sem quinas
  function smoothPath(points) {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  function drawTimelinePath(wrap, svg, cluster, cards) {
    const desktop = window.matchMedia('(min-width: 1101px)').matches;
    svg.style.display = desktop ? '' : 'none';
    if (!desktop) return;

    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();

    // Nó = centro do topo de cada card, levemente acima dele
    const nodes = cards.map((card) => ({
      x: cluster.offsetLeft + card.offsetLeft + card.offsetWidth / 2,
      y: cluster.offsetTop + card.offsetTop - 22,
    }));

    // Curva entra pela esquerda (embaixo) e sai pela direita (em cima), como na referência
    const points = [
      { x: 0, y: nodes[0].y + 90 },
      ...nodes,
      { x: W, y: nodes[nodes.length - 1].y - 60 },
    ];

    const defs = el('defs');
    const gradient = el('linearGradient', {
      id: 'timelineGoldGradient',
      gradientUnits: 'userSpaceOnUse',
      x1: 0, y1: 0, x2: W, y2: 0,
    });
    [['0%', '#ECC06C'], ['50%', '#D8A649'], ['100%', '#B58428']].forEach(([offset, color]) => {
      gradient.append(el('stop', { offset, 'stop-color': color }));
    });
    defs.append(gradient);
    svg.append(defs);

    svg.append(el('path', {
      class: 'wavy-path',
      d: smoothPath(points),
      fill: 'none',
      stroke: 'url(#timelineGoldGradient)',
      'stroke-width': 3.5,
      'stroke-linecap': 'round',
    }));

    nodes.forEach((n, i) => {
      const g = el('g', { class: `timeline-node node-${i + 1}`, transform: `translate(${n.x} ${n.y})` });
      g.append(el('circle', { r: 14, fill: '#0C1521', stroke: '#D8A649', 'stroke-width': 2.5 }));
      g.append(el('circle', { r: 6, fill: '#D8A649' }));
      svg.append(g);
    });
  }

  /* ==========================================================================
     6. FORMULÁRIO DE CONTATO
     ========================================================================== */
  function setupForm() {
    const form = document.getElementById('mainContactForm');
    if (!form) return;

    const feedback = document.getElementById('formFeedback');
    const submitBtn = document.getElementById('submitFormBtn');
    const confirmCheck = document.getElementById('confirmData');
    const checkGroup = confirmCheck.closest('.form-checkbox-group');

    const fields = [
      { el: document.getElementById('name'), ok: (v) => v.trim().length >= 3 },
      { el: document.getElementById('email'), ok: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) },
      { el: document.getElementById('phone'), ok: (v) => v.trim().length >= 8 },
      { el: document.getElementById('service'), ok: (v) => v !== '' },
    ];

    const validate = () => {
      let valid = true;
      fields.forEach(({ el: input, ok }) => {
        const good = ok(input.value);
        input.closest('.form-group')?.classList.toggle('has-error', !good);
        if (!good) valid = false;
      });
      checkGroup.classList.toggle('has-error', !confirmCheck.checked);
      if (!confirmCheck.checked) valid = false;
      return valid;
    };

    let clearTimer = null;
    const showFeedback = (type, message) => {
      if (!feedback) return;
      clearTimeout(clearTimer);
      feedback.className = `form-feedback is-${type}`;
      feedback.textContent = message;
      clearTimer = setTimeout(() => {
        feedback.textContent = '';
        feedback.className = 'form-feedback';
      }, 7000);
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validate()) {
        showFeedback('error', 'Por favor, preencha todos os campos obrigatórios corretamente.');
        return;
      }

      const originalHTML = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Enviando solicitação...</span>';

      try {
        if (FORM_ENDPOINT) {
          const res = await fetch(FORM_ENDPOINT, {
            method: 'POST',
            body: new FormData(form),
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else {
          // Simulação enquanto FORM_ENDPOINT não estiver configurado
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        form.reset();
        showFeedback('success', 'Solicitação enviada com sucesso! O Dr. Robert entrará em contato em até 24 horas.');
      } catch (err) {
        console.error('Falha ao enviar formulário:', err);
        showFeedback('error', 'Não foi possível enviar agora. Tente novamente ou chame no WhatsApp.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
      }
    });
  }

  /* ==========================================================================
     7. MODAL DE VÍDEO INSTITUCIONAL
     ========================================================================== */
  function setupVideoModal() {
    const modal = document.getElementById('videoModal');
    if (!modal) return;

    const card = document.getElementById('profileVideoCard');
    const closeBtn = document.getElementById('videoModalClose');
    const backdrop = document.getElementById('videoModalBackdrop');
    let lastFocus = null;

    const open = () => {
      lastFocus = document.activeElement;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      closeBtn?.focus();
    };

    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      lastFocus?.focus?.();
    };

    card?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });
  }

  /* ==========================================================================
     INICIALIZAÇÃO — tudo acima já está declarado quando isto roda
     ========================================================================== */
  function init() {
    window.addEventListener('scroll', onScroll, { passive: true });
    updateScrollDynamics(window.scrollY);

    setupMetrics();
    setupMobileMenu();
    setupCarousel();
    setupTimeline();
    setupForm();
    setupVideoModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
