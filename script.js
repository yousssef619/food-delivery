/**
 * FoodRush – script.js
 * Vanilla JavaScript: no frameworks, no libraries
 * Features: Navbar, Mobile Menu, Category Filter, Cart, Toast,
 *           Scroll Reveal, Sticky Nav, Testimonial Slider, Scroll Top, Favourites
 */

'use strict';

/* ============================================================
   UTILITY HELPERS
   ============================================================ */

/**
 * Shorthand query selectors
 */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/**
 * Show a toast notification
 * @param {string} message - Text to display
 * @param {string} [type=''] - Optional CSS modifier class
 */
function showToast(message, type = '') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = 'toast is-visible' + (type ? ' toast--' + type : '');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 3000);
}

/**
 * Format a number as currency string
 */
function formatPrice(num) {
  return '$' + Number(num).toFixed(2);
}


/* ============================================================
   NAVBAR – Sticky on scroll + transparent/opaque toggle
   ============================================================ */
(function initNavbar() {
  const navbar = $('#navbar');
  if (!navbar) return;

  const SCROLL_THRESHOLD = 60;

  function onScroll() {
    if (window.scrollY > SCROLL_THRESHOLD) {
      navbar.classList.add('navbar--scrolled');
    } else {
      navbar.classList.remove('navbar--scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run on init
})();


/* ============================================================
   MOBILE MENU – Toggle open/close + close on link click
   ============================================================ */
(function initMobileMenu() {
  const hamburger = $('#hamburgerBtn');
  const menu      = $('#mobileMenu');
  if (!hamburger || !menu) return;

  function openMenu() {
    hamburger.classList.add('is-open');
    menu.classList.add('is-open');
    hamburger.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    hamburger.classList.remove('is-open');
    menu.classList.remove('is-open');
    hamburger.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.contains('is-open');
    isOpen ? closeMenu() : openMenu();
  });

  // Close on any link click inside mobile menu
  $$('.mobile-menu__link', menu).forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
  });
})();


/* ============================================================
   ACTIVE NAV LINK – Highlight link based on scroll position
   ============================================================ */
(function initActiveNav() {
  const sections  = $$('section[id]');
  const navLinks  = $$('.navbar__link');
  if (!sections.length || !navLinks.length) return;

  function updateActiveLink() {
    const scrollY = window.scrollY + 120;

    sections.forEach(section => {
      const top    = section.offsetTop;
      const height = section.offsetHeight;
      const id     = section.getAttribute('id');

      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach(link => {
          link.classList.toggle(
            'navbar__link--active',
            link.getAttribute('href') === '#' + id
          );
        });
      }
    });
  }

  window.addEventListener('scroll', updateActiveLink, { passive: true });
})();


/* ============================================================
   CATEGORY FILTER – Show/hide dish cards
   ============================================================ */
(function initCategoryFilter() {
  const buttons  = $$('.category-card');
  const cards    = $$('.dish-card');
  if (!buttons.length || !cards.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const selected = btn.dataset.category;

      // Update button states
      buttons.forEach(b => {
        b.classList.remove('category-card--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('category-card--active');
      btn.setAttribute('aria-pressed', 'true');

      // Show/hide cards with a small stagger
      cards.forEach((card, i) => {
        const match = selected === 'all' || card.dataset.category === selected;

        if (match) {
          card.removeAttribute('aria-hidden');
          card.style.animation = 'none';
          card.style.opacity   = '0';
          card.style.transform = 'translateY(20px)';

          // Force reflow then animate in
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              card.style.transition = `opacity 0.4s ease ${i * 60}ms, transform 0.4s ease ${i * 60}ms`;
              card.style.opacity   = '1';
              card.style.transform = 'translateY(0)';
            });
          });
        } else {
          card.setAttribute('aria-hidden', 'true');
          card.style.opacity   = '';
          card.style.transform = '';
          card.style.transition = '';
        }
      });
    });
  });
})();


/* ============================================================
   FAVOURITES – Toggle heart button on dish cards
   ============================================================ */
(function initFavourites() {
  $$('.dish-card__fav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isFaved = btn.classList.toggle('is-faved');
      btn.textContent = isFaved ? '♥' : '♡';

      const cardName = btn.closest('.dish-card')
        ?.querySelector('.dish-card__name')
        ?.textContent || 'Item';

      showToast(isFaved ? `❤️ ${cardName} added to favourites!` : `💔 Removed from favourites`, 'success');
    });
  });
})();


/* ============================================================
   SHOPPING CART
   State is kept in memory (array of cart items)
   ============================================================ */
const Cart = (function () {
  /** @type {{ id: string, name: string, price: number, qty: number, emoji: string }[]} */
  let items = [];

  // Emoji map by dish id for visual display in cart
  const emojiMap = {
    '1': '🍔',
    '2': '🍕',
    '3': '🍣',
    '4': '🥗',
    '5': '🌮',
    '6': '🍜',
    '7': '🍰',
    '8': '🥙',
  };

  /* ---- DOM refs ---- */
  const drawerEl  = $('#cartDrawer');
  const overlayEl = $('#cartOverlay');
  const bodyEl    = $('#cartBody');
  const emptyEl   = $('#cartEmpty');
  const footerEl  = $('#cartFooter');
  const badgeEl   = $('#cartBadge');
  const subtotalEl = $('#cartSubtotal');
  const totalEl    = $('#cartTotal');

  /** Add item or increment quantity */
  function add(id, name, price) {
    const existing = items.find(i => i.id === id);
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({
        id,
        name,
        price: parseFloat(price),
        qty: 1,
        emoji: emojiMap[id] || '🍽️',
      });
    }
    render();
    animateBadge();
    showToast(`🛒 ${name} added to cart!`, 'success');
  }

  /** Change item quantity by delta (+1 or -1) */
  function changeQty(id, delta) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      items = items.filter(i => i.id !== id);
    }
    render();
  }

  /** Get total item count */
  function getCount() {
    return items.reduce((sum, i) => sum + i.qty, 0);
  }

  /** Get subtotal */
  function getSubtotal() {
    return items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  /** Animate badge on add */
  function animateBadge() {
    if (!badgeEl) return;
    badgeEl.classList.add('navbar__cart-badge--bump');
    setTimeout(() => badgeEl.classList.remove('navbar__cart-badge--bump'), 350);
  }

  /** Render cart UI */
  function render() {
    if (!bodyEl) return;

    const count     = getCount();
    const subtotal  = getSubtotal();
    const delivery  = items.length ? 2.99 : 0;
    const total     = subtotal + delivery;

    // Update badge
    if (badgeEl) badgeEl.textContent = count;

    // Update navbar cart aria-label
    const cartBtn = $('#cartBtn');
    if (cartBtn) cartBtn.setAttribute('aria-label', `Open cart (${count} items)`);

    // Toggle empty / footer
    if (emptyEl)  emptyEl.style.display  = items.length ? 'none' : 'flex';
    if (footerEl) footerEl.style.display = items.length ? 'block' : 'none';

    // Remove existing item elements
    $$('.cart-item', bodyEl).forEach(el => el.remove());

    // Render items
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.dataset.itemId = item.id;
      div.innerHTML = `
        <div class="cart-item__emoji" aria-hidden="true">${item.emoji}</div>
        <div class="cart-item__info">
          <p class="cart-item__name">${item.name}</p>
          <p class="cart-item__price">${formatPrice(item.price * item.qty)}</p>
        </div>
        <div class="cart-item__qty">
          <button class="cart-item__qty-btn" data-action="decrement" data-id="${item.id}" aria-label="Decrease quantity of ${item.name}">−</button>
          <span class="cart-item__qty-num" aria-label="${item.qty} of ${item.name}">${item.qty}</span>
          <button class="cart-item__qty-btn" data-action="increment" data-id="${item.id}" aria-label="Increase quantity of ${item.name}">+</button>
        </div>
      `;
      bodyEl.appendChild(div);
    });

    // Update totals
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (totalEl)    totalEl.textContent    = formatPrice(total);
  }

  /** Open cart drawer */
  function open() {
    if (!drawerEl || !overlayEl) return;
    drawerEl.classList.add('is-open');
    overlayEl.classList.add('is-open');
    drawerEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = getScrollbarWidth() + 'px';
  }

  /** Close cart drawer */
  function close() {
    if (!drawerEl || !overlayEl) return;
    drawerEl.classList.remove('is-open');
    overlayEl.classList.remove('is-open');
    drawerEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  /** Get scrollbar width to prevent layout shift */
  function getScrollbarWidth() {
    return window.innerWidth - document.documentElement.clientWidth;
  }

  /* ---- Event Listeners ---- */

  // Open cart
  const cartBtn = $('#cartBtn');
  if (cartBtn) cartBtn.addEventListener('click', open);

  // Close cart (button + overlay + Escape)
  const closeBtn = $('#cartClose');
  if (closeBtn)    closeBtn.addEventListener('click', close);
  if (overlayEl)   overlayEl.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerEl?.classList.contains('is-open')) close();
  });

  // Quantity buttons (delegated from cart body)
  if (bodyEl) {
    bodyEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.cart-item__qty-btn');
      if (!btn) return;
      const id     = btn.dataset.id;
      const action = btn.dataset.action;
      changeQty(id, action === 'increment' ? 1 : -1);
    });
  }

  // "Add to cart" buttons (delegated from document)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-cart');
    if (!btn) return;

    const { id, name, price } = btn.dataset;
    add(id, name, price);

    // Button micro-animation
    btn.textContent = '✓ Added';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = '+ Add';
      btn.disabled = false;
    }, 1400);
  });

  // Initialise render
  render();

  return { add, changeQty, open, close };
})();


/* ============================================================
   TESTIMONIALS SLIDER
   ============================================================ */
(function initTestimonialSlider() {
  const cards  = $$('.testimonial-card');
  const dots   = $$('.slider-dot');
  const prev   = $('#sliderPrev');
  const next   = $('#sliderNext');

  if (!cards.length || !dots.length) return;

  // Only activate as a true slider on mobile
  let currentIndex = 0;
  let autoplayTimer;

  function isMobile() {
    return window.innerWidth < 768;
  }

  function goTo(index) {
    if (!isMobile()) return; // Desktop shows all 3 as grid

    cards.forEach((card, i) => {
      card.style.display = i === index ? 'block' : 'none';
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle('slider-dot--active', i === index);
      dot.setAttribute('aria-selected', String(i === index));
    });

    currentIndex = index;
  }

  function initSlider() {
    if (isMobile()) {
      goTo(currentIndex);
    } else {
      // Reset: show all
      cards.forEach(card => { card.style.display = ''; });
      dots.forEach((dot, i) => {
        dot.classList.toggle('slider-dot--active', i === 0);
      });
    }
  }

  // Autoplay
  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(() => {
      if (isMobile()) {
        const nextIndex = (currentIndex + 1) % cards.length;
        goTo(nextIndex);
      }
    }, 4000);
  }

  function stopAutoplay() {
    clearInterval(autoplayTimer);
  }

  if (prev) {
    prev.addEventListener('click', () => {
      const idx = (currentIndex - 1 + cards.length) % cards.length;
      goTo(idx);
      stopAutoplay();
    });
  }

  if (next) {
    next.addEventListener('click', () => {
      const idx = (currentIndex + 1) % cards.length;
      goTo(idx);
      stopAutoplay();
    });
  }

  // Dot navigation
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      goTo(i);
      stopAutoplay();
    });
  });

  // Keyboard navigation on slider
  const slider = $('#testimonialSlider');
  if (slider) {
    slider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        goTo((currentIndex - 1 + cards.length) % cards.length);
        stopAutoplay();
      }
      if (e.key === 'ArrowRight') {
        goTo((currentIndex + 1) % cards.length);
        stopAutoplay();
      }
    });
  }

  // Touch/swipe support
  let touchStartX = 0;
  let touchEndX   = 0;

  if (slider) {
    slider.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          goTo((currentIndex + 1) % cards.length); // swipe left → next
        } else {
          goTo((currentIndex - 1 + cards.length) % cards.length); // swipe right → prev
        }
        stopAutoplay();
      }
    }, { passive: true });
  }

  // Respond to resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(initSlider, 150);
  });

  initSlider();
  startAutoplay();

  // Pause autoplay on hover
  if (slider) {
    slider.addEventListener('mouseenter', stopAutoplay);
    slider.addEventListener('mouseleave', startAutoplay);
  }
})();


/* ============================================================
   SCROLL REVEAL – Animate elements as they enter the viewport
   ============================================================ */
(function initScrollReveal() {
  const elements = $$('.reveal');
  if (!elements.length) return;

  // Use IntersectionObserver if available
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target); // only animate once
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    elements.forEach(el => observer.observe(el));
  } else {
    // Fallback: show all immediately
    elements.forEach(el => el.classList.add('is-visible'));
  }
})();


/* ============================================================
   SCROLL TO TOP BUTTON
   ============================================================ */
(function initScrollTop() {
  const btn = $('#scrollTop');
  if (!btn) return;

  function toggleVisibility() {
    const isVisible = window.scrollY > 400;
    btn.classList.toggle('is-visible', isVisible);
  }

  window.addEventListener('scroll', toggleVisibility, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();


/* ============================================================
   SEARCH BAR – Basic interaction
   ============================================================ */
(function initSearch() {
  const searchBtn = $('.search-bar__btn');
  const searchInput = $('.search-bar__input');
  if (!searchBtn || !searchInput) return;

  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (!query) {
      searchInput.focus();
      searchInput.placeholder = 'Please enter an address first...';
      setTimeout(() => {
        searchInput.placeholder = 'Enter your delivery address...';
      }, 2000);
      return;
    }
    showToast(`🔍 Searching for food near "${query}"...`);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchBtn.click();
  });
})();


/* ============================================================
   NEWSLETTER FORM
   ============================================================ */
(function initNewsletter() {
  const form  = $('.newsletter__form');
  const input = $('#newsletterEmail');
  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = input.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
      showToast('⚠️ Please enter a valid email address.');
      input.focus();
      return;
    }

    // Simulate subscription success
    showToast('🎉 You\'re subscribed! Check your inbox for deals.', 'success');
    input.value = '';

    const btn = form.querySelector('.newsletter__btn');
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✓ Subscribed!';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 3000);
    }
  });
})();


/* ============================================================
   PARTNERS MARQUEE – Pause on hover
   ============================================================ */
(function initMarquee() {
  const track = $('.partners__track');
  if (!track) return;

  const wrapper = track.parentElement;
  wrapper.addEventListener('mouseenter', () => {
    track.style.animationPlayState = 'paused';
  });
  wrapper.addEventListener('mouseleave', () => {
    track.style.animationPlayState = 'running';
  });
})();


/* ============================================================
   SMOOTH SCROLL – Handle all anchor href links
   ============================================================ */
(function initSmoothScroll() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const id = link.getAttribute('href').slice(1);
    if (!id) {
      // href="#" → scroll to top
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const target = document.getElementById(id);
    if (!target) return;

    e.preventDefault();
    const navbarHeight = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--navbar-height'));
    const top = target.getBoundingClientRect().top + window.scrollY - navbarHeight - 24;
    window.scrollTo({ top, behavior: 'smooth' });
  });
})();


/* ============================================================
   PROMO CODE COPY – Click to copy
   ============================================================ */
(function initPromoCopy() {
  const code = $('.promo__code');
  if (!code) return;

  code.style.cursor = 'pointer';
  code.title = 'Click to copy';

  code.addEventListener('click', () => {
    const text = code.textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(`📋 Code "${text}" copied to clipboard!`, 'success');
      });
    } else {
      showToast(`📋 Use code: ${text} at checkout!`);
    }
  });
})();


/* ============================================================
   PARALLAX EFFECT on Hero blob (subtle)
   ============================================================ */
(function initParallax() {
  const blob = $('.hero__blob');
  if (!blob || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    blob.style.transform = `translateY(${y * 0.15}px) rotate(${y * 0.02}deg)`;
  }, { passive: true });
})();


/* ============================================================
   INIT LOG
   ============================================================ */
console.log('%c🍕 FoodRush loaded successfully!', 'color: #FF6B35; font-size: 14px; font-weight: bold;');
