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
    if (/^(https?:|data:|blob:|\/|#)/i.test(url)) return url;
    const isGitHub = window.location.hostname.includes('github.io');
    const siteRoot = isGitHub ? '/Warm-Right-Website/' : '/';
    return siteRoot + url.replace(/^(\.\/|\.\.\/|\/)+/, '');
  }

  const FALLBACK_HEROES = {
    home: [
      { title:'Welcome to Warm Right', subtitle:'Reliable heating & plumbing across Kent, South East London & East Sussex.', image_url:'assets/images/home-hero.jpg' },
      { title:"It's easy to book a visit", subtitle:'Book a visit with one of our expert engineers through our online booking page.', image_url:'assets/images/book-2.png', link_url:'book-a-visit.html', link_label:'Book a Visit' },
      { title:'24/7 Support', subtitle:'Dependable service, right when you need it most.', image_url:'assets/images/support.jpg' }
    ],
    about: [{ title:'About Warm Right', subtitle:'Family-run heating and plumbing support with clear advice and safe workmanship.', image_url:'assets/images/values.png' }],
    breakdowns: [{ title:'Boiler Breakdowns', subtitle:'Fast, practical support when your heating or hot water stops working.', image_url:'assets/images/breakdowns.jpg' }],
    repairs: [{ title:'Boiler Repairs', subtitle:'Straightforward repairs and clear advice from Gas Safe registered engineers.', image_url:'assets/images/boiler-repair-hero.jpg' }],
    'annual-servicing': [{ title:'Annual Servicing', subtitle:'Keep your boiler running safely, efficiently, and reliably.', image_url:'assets/images/annual-servicing.jpg' }],
    'landlords-certificates': [{ title:'Landlord Certificates', subtitle:'Gas safety certificates and landlord support without the fuss.', image_url:'assets/images/landlord-cp12.jpg' }],
    'boiler-installation': [{ title:'Boiler Installations', subtitle:'Helping you choose and fit the right heating system for your home.', image_url:'assets/images/install-hero.jpg' }],
    'general-maintenance': [{ title:'Plumbing', subtitle:'Reliable plumbing help for everyday problems and planned improvements.', image_url:'assets/images/plumbing.jpg' }],
    'kitchens-bathrooms': [{ title:'Kitchens and Bathrooms', subtitle:'Practical heating and plumbing support for kitchen and bathroom projects.', image_url:'assets/images/kitchen-bathrooms.jpg' }],
    'powerflushing-descaling': [{ title:'Powerflushing and Descaling', subtitle:'Improve flow, efficiency, and system performance.', image_url:'assets/images/powerflushing.jpg' }],
    'second-opinion': [{ title:'Second Opinions', subtitle:'Clear, independent advice before you commit to expensive work.', image_url:'assets/images/second-opinion.jpg' }],
    'unvented-cylinders': [{ title:'Unvented Cylinders', subtitle:'High-pressure hot water systems installed and maintained safely.', image_url:'assets/images/unvented-cylinders.jpg' }],
    'common-faults': [{ title:'Common Faults', subtitle:'Simple guidance for common heating and hot water problems.', image_url:'assets/images/common-faults.jpg' }],
    'boiler-fault-codes': [{ title:'Boiler Fault Codes', subtitle:'Find out what your boiler is trying to tell you.', image_url:'assets/images/fault-boiler.gif' }],
    manuals: [{ title:'Boiler Manuals', subtitle:'Find manuals for common boiler brands or ask us for help.', image_url:'assets/images/manuals-hero.png' }],
    offers: [{ title:'Offers', subtitle:'Current Warm Right offers and packages.', image_url:'assets/images/offers.png' }],
    'schedule-of-rates': [{ title:'Our Rates', subtitle:'Clear prices for common heating and plumbing visits.', image_url:'assets/images/boiler-repair.jpg' }],
    'book-a-visit': [{ title:'Book A Visit', subtitle:'Book a visit with one of our expert engineers through our online booking page.', image_url:'assets/images/book-2.png' }],
    contact: [{ title:'Contact Us', subtitle:'Choose how you would like to contact the Warm Right team.', image_url:'assets/images/contact.jpg' }],
    testimonals: [{ title:'Customer Testimonials', subtitle:'See what our customers have to say about Warm Right.', image_url:'assets/images/testimonials.jpg' }],
    'testimonial-submit': [{ title:'Send A Testimonial', subtitle:'Share your feedback and photos from your Warm Right visit.', image_url:'assets/images/testimonials.jpg' }]
  };

  function fallbackRows(pageKey) {
    return (FALLBACK_HEROES[pageKey] || []).map((row, index) => ({
      hero_key: `fallback-${index + 1}`,
      sort_order: index,
      image_position_x: 50,
      image_position_y: 50,
      image_zoom: 100,
      mobile_image_position_x: 50,
      mobile_image_position_y: 50,
      mobile_image_zoom: 100,
      is_active: true,
      ...row
    }));
  }

  function slideMarkup(row, index) {
    const imageUrl = resolveUrl(row.image_url || 'assets/images/home-hero.jpg');
    const linkUrl = row.link_url ? resolveUrl(row.link_url) : '';
    const contentTag = linkUrl ? 'a' : 'div';
    const href = linkUrl ? ` href="${escapeHtml(linkUrl)}"` : '';
    const aria = linkUrl ? ` aria-label="${escapeHtml(row.link_label || row.title || 'Open hero link')}"` : '';
    return `
      <div class="slide${index === 0 ? ' active' : ''}" style="background-image:url('${escapeHtml(imageUrl)}'); background-repeat:no-repeat; --hero-image-position:${row.image_position_x ?? 50}% ${row.image_position_y ?? 50}%; --hero-image-size:${row.image_zoom ?? 100}%; --hero-mobile-image-position:${row.mobile_image_position_x ?? row.image_position_x ?? 50}% ${row.mobile_image_position_y ?? row.image_position_y ?? 50}%; --hero-mobile-image-size:${row.mobile_image_zoom ?? row.image_zoom ?? 100}%;">
        <${contentTag} class="slide-content"${href}${aria}>
          ${row.title ? `<h1>${escapeHtml(row.title)}</h1>` : ''}
          ${row.subtitle ? `<p>${escapeHtml(row.subtitle)}</p>` : ''}
        </${contentTag}>
      </div>
    `;
  }

  async function loadHeroes() {
    const heroEl = document.querySelector('.hero');
    if (!heroEl) return;
    const pageKey = pageKeyFromPath();
    const renderRows = rows => {
      if (!rows.length) {
        heroEl.classList.add('is-hero-ready', 'hero-empty');
        return;
      }
      heroEl.innerHTML = rows.map(slideMarkup).join('');
      heroEl.classList.add('is-hero-ready');
    };
    for (let attempt = 0; attempt < 20 && !window.db; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!window.db) {
      renderRows(fallbackRows(pageKey));
      return;
    }

    const { data, error } = await window.db
      .from('site_heroes')
      .select('*')
      .eq('page_key', pageKey)
      .order('sort_order', { ascending: true });

    if (error || !data || !data.length) {
      renderRows(fallbackRows(pageKey));
      return;
    }
    renderRows(data.filter(row => row.is_active !== false));
  }

  document.addEventListener('includesLoaded', loadHeroes);
  if (document.readyState !== 'loading') loadHeroes();
})();
