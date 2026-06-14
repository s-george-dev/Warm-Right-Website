(function () {
  function pageKeyFromPath() {
    const parts = window.location.pathname.toLowerCase().split('/').filter(Boolean);
    const isGitHub = window.location.hostname.includes('github.io');
    const usableParts = isGitHub && parts.length > 1 ? parts.slice(1) : parts;
    const file = usableParts[usableParts.length - 1] || 'index.html';
    return file.replace(/\.html$/, '') === 'index' ? 'home' : file.replace(/\.html$/, '');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function resolveUrl(url) {
    if (!url) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(url)) return url;
    const isGitHub = window.location.hostname.includes('github.io');
    const siteRoot = isGitHub ? '/Warm-Right-Website/' : '/';
    return siteRoot + url.replace(/^(\.\/|\.\.\/|\/)+/, '');
  }

  const FALLBACK_CARDS = {
    'home:intro': {
      body_html: 'Your home deserves reliable heat, safe systems, and clear advice - and that is exactly what we deliver.<br><br>Whether you need a new installation, a system service, or a second opinion, you are in expert hands.',
      image_url: 'assets/images/professional.jpg',
      image_position_x: 50,
      image_position_y: 42,
      image_zoom: 118,
      mobile_image_position_x: 50,
      mobile_image_position_y: 50,
      mobile_image_zoom: 118,
      show_button: true,
      button_label: 'Book a Visit',
      button_url: 'book-a-visit.html'
    },
    'home:support': {
      body_html: 'We have created our own fault guides that are easy for anyone to navigate.<br><br>If you need assistance and want to chat, visit our Contact Us page or why not start a live web chat?',
      image_url: 'assets/images/fault-finder.png',
      show_button: true,
      button_label: 'Contact Us',
      button_url: 'contact.html'
    },
    'book-a-visit:card-1': {
      body_html: 'Choose the option that suits you best - whether you would like to call us, book online, or request a callback.',
      image_url: 'assets/images/book-2.png',
      show_button: false
    },
    'contact:card-1': {
      body_html: 'Choose the option that suits you best - whether you would like to call us, email, or send a message through our form.',
      image_url: 'assets/images/contact.jpg',
      show_button: false
    },
    'testimonals:card-1': {
      body_html: 'Read feedback from Warm Right customers, or send us your own testimonial after a visit.',
      image_url: 'assets/images/testimonials.jpg',
      show_button: true,
      button_label: 'Send Us Your Testimonial',
      button_url: 'testimonial-submit.html'
    }
  };

  function renderCard(el, card) {
    const imageUrl = resolveUrl(card.image_url);
    el.classList.toggle('content-card-no-image', !imageUrl);
    if (imageUrl) el.style.setProperty('--article-visual', `url("${imageUrl.replace(/"/g, '\\"')}")`);
    el.style.setProperty('--article-image-position', `${card.image_position_x ?? 50}% ${card.image_position_y ?? 50}%`);
    el.style.setProperty('--article-image-size', `${card.image_zoom ?? 115}%`);
    el.style.setProperty('--article-mobile-image-position', `${card.mobile_image_position_x ?? card.image_position_x ?? 50}% ${card.mobile_image_position_y ?? card.image_position_y ?? 50}%`);
    el.style.setProperty('--article-mobile-image-size', `${card.mobile_image_zoom ?? card.image_zoom ?? 115}%`);
    el.classList.add('is-managed-content');

    const showButton = card.show_button !== false && card.button_label && card.button_url;
    const button = showButton
      ? `<span class="content-card-actions"><a class="content-card-button" href="${escapeHtml(card.button_url)}">${escapeHtml(card.button_label)}</a></span>`
      : '';

    el.innerHTML = `<span class="content-card-body">${card.body_html || ''}</span>${button}`;
  }

  async function loadContentCards() {
    const pageKey = pageKeyFromPath();
    const targets = Array.from(document.querySelectorAll('p.article-gap.card'));
    if (!targets.length) return;

    targets.forEach((el, index) => {
      if (!el.dataset.contentCard) el.dataset.contentCard = `${pageKey}:card-${index + 1}`;
    });

    const keys = targets.map(el => el.dataset.contentCard).filter(Boolean);
    if (!keys.length) return;

    if (!window.db) {
      targets.forEach(el => {
        const fallback = FALLBACK_CARDS[el.dataset.contentCard];
        if (fallback) renderCard(el, fallback);
      });
      return;
    }

    const { data, error } = await window.db
      .from('site_content_cards')
      .select('*')
      .eq('page_key', pageKey)
      .in('card_key', keys);

    if (error || !data) return;
    const cards = new Map(data.map(card => [card.card_key, card]));
    targets.forEach(el => {
      const card = cards.get(el.dataset.contentCard);
      if (card && card.is_active !== false) renderCard(el, card);
      else if (card) el.classList.add('content-card-empty');
      else if (FALLBACK_CARDS[el.dataset.contentCard]) renderCard(el, FALLBACK_CARDS[el.dataset.contentCard]);
      else if (el.hasAttribute('data-content-card')) el.classList.add('content-card-empty');
    });
  }

  document.addEventListener('includesLoaded', loadContentCards);
  if (document.readyState !== 'loading') loadContentCards();
})();
