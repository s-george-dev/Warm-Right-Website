(function () {
  const PAGE_TABLE = 'site_pages';
  const TILE_TABLE = 'site_carousel_tiles';

  function normalizePath(path) {
    if (!path) return '/';
    try {
      path = new URL(path, window.location.origin).pathname;
    } catch (_) {}
    return path.replace(/^\/warm\//, '/').replace(/\/+$/, '') || '/';
  }

  function byUrl(rows) {
    return new Map((rows || []).map(row => [normalizePath(row.url), row]));
  }

  function getSiteRoot() {
    return window.location.hostname.includes('github.io') ? '/warm/' : '/';
  }

  function publicUrl(url) {
    if (!url) return '#';
    if (/^(https?:|tel:|mailto:|#)/i.test(url)) return url;
    return getSiteRoot() + url.replace(/^(\.\.\/|\.\/|\/)+/, '');
  }

  function applyPageVisibility(pages) {
    const sortedPages = [...pages].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const pageMap = byUrl(sortedPages);

    reorderNavLinks(sortedPages);

    document.querySelectorAll('#header a[href], #header button[data-section]').forEach(el => {
      const href = el.getAttribute('href');
      if (!href || href === '#') return;
      const page = pageMap.get(normalizePath(href));
      if (!page || page.is_active) return;

      const mobileItem = el.closest('.mobile-item');
      const dropdownLink = el.closest('.dropdown-menu a');
      const navLink = el.closest('.nav > a');
      const target = mobileItem || dropdownLink || navLink || el;
      target.style.display = 'none';
    });

    document.querySelectorAll('#header .dropdown').forEach(dropdown => {
      const visibleLinks = [...dropdown.querySelectorAll('.dropdown-menu a')]
        .some(link => link.style.display !== 'none');
      if (!visibleLinks) dropdown.style.display = 'none';
    });

    document.querySelectorAll('#header .mobile-item').forEach(item => {
      const menu = item.querySelector('.mobile-dropdown-menu');
      if (!menu) return;
      const visibleLinks = [...menu.querySelectorAll('a')]
        .some(link => link.style.display !== 'none');
      if (!visibleLinks) item.style.display = 'none';
    });
  }

  function reorderNavLinks(pages) {
    const groups = pages.reduce((acc, page) => {
      acc[page.nav_group] = acc[page.nav_group] || [];
      acc[page.nav_group].push(page);
      return acc;
    }, {});

    reorderDesktopMain(groups.main || []);
    reorderDesktopDropdown('services', groups.services || []);
    reorderDesktopDropdown('support', groups.support || []);
    reorderMobileMain(groups.main || []);
    reorderMobileDropdown('services', groups.services || []);
    reorderMobileDropdown('support', groups.support || []);
  }

  function reorderDesktopMain(pages) {
    const nav = document.querySelector('#header #main-nav-bar .nav');
    if (!nav) return;

    const slots = [...nav.querySelectorAll(':scope > a')];
    const links = pages
      .map(page => findLinkByUrl(nav, page.url, ':scope > a'))
      .filter(Boolean);

    reorderExistingNodes(nav, slots, links);
  }

  function reorderDesktopDropdown(section, pages) {
    const menu = document
      .querySelector(`#header #main-nav-bar .dropdown a[data-section="${section}"]`)
      ?.closest('.dropdown')
      ?.querySelector('.dropdown-menu');
    if (!menu) return;

    pages.forEach(page => {
      const link = findLinkByUrl(menu, page.url, ':scope > a');
      if (link) menu.appendChild(link);
    });
  }

  function reorderMobileMain(pages) {
    const nav = document.querySelector('#header .mobile-nav');
    if (!nav) return;

    const slots = [...nav.querySelectorAll(':scope > .mobile-item')]
      .filter(item => item.querySelector(':scope > a'));
    const items = pages
      .map(page => findLinkByUrl(nav, page.url, '.mobile-item > a')?.closest('.mobile-item'))
      .filter(Boolean);

    reorderExistingNodes(nav, slots, items);
  }

  function reorderExistingNodes(parent, currentNodes, orderedNodes) {
    if (!currentNodes.length || !orderedNodes.length) return;

    const markers = currentNodes.map(node => {
      const marker = document.createComment('site-page-order');
      parent.insertBefore(marker, node);
      return marker;
    });

    orderedNodes.forEach((node, index) => {
      if (markers[index]) parent.insertBefore(node, markers[index]);
    });

    markers.forEach(marker => marker.remove());
  }

  function reorderMobileDropdown(section, pages) {
    const menu = document
      .querySelector(`#header .mobile-dropdown-button[data-section="${section}"]`)
      ?.closest('.mobile-item')
      ?.querySelector('.mobile-dropdown-menu');
    if (!menu) return;

    pages.forEach(page => {
      const link = findLinkByUrl(menu, page.url, ':scope > a');
      if (link) menu.appendChild(link);
    });
  }

  function findLinkByUrl(container, url, selector) {
    const targetPath = normalizePath(url);
    return [...container.querySelectorAll(selector)]
      .find(link => normalizePath(link.getAttribute('href')) === targetPath);
  }

  function createTile(tile) {
    const link = document.createElement('a');
    link.className = 'info-tile';
    link.href = publicUrl(tile.link_url);

    const img = document.createElement('img');
    img.src = publicUrl(tile.image_url);
    img.alt = tile.title || '';

    const title = document.createElement('h3');
    title.textContent = tile.title || '';

    const description = document.createElement('p');
    description.textContent = tile.description || '';

    link.append(img, title, description);
    return link;
  }

  function applyCarouselTiles(tiles) {
    const grouped = (tiles || []).reduce((acc, tile) => {
      acc[tile.carousel_key] = acc[tile.carousel_key] || [];
      acc[tile.carousel_key].push(tile);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([key, carouselTiles]) => {
      const container = document.querySelector(`.carousel-container[data-carousel-key="${key}"]`);
      const track = container?.querySelector('.carousel-track');
      if (!track) return;

      const activeTiles = carouselTiles
        .filter(tile => tile.is_active)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      if (activeTiles.length === 0) {
        const section = container.closest('section');
        if (section) section.style.display = 'none';
        return;
      }

      track.replaceChildren(...activeTiles.map(createTile));
    });
  }

  async function loadSiteManagement() {
    if (!window.db) return;

    try {
      const [{ data: pages, error: pageError }, { data: tiles, error: tileError }] = await Promise.all([
        window.db.from(PAGE_TABLE).select('title,url,is_active,sort_order,nav_group'),
        window.db.from(TILE_TABLE).select('carousel_key,title,description,image_url,link_url,sort_order,is_active')
      ]);

      if (!pageError && pages?.length) applyPageVisibility(pages);
      if (!tileError && tiles?.length) applyCarouselTiles(tiles);
    } catch (err) {
      console.warn('Site management data unavailable; using static content.', err);
    }
  }

  document.addEventListener('includesLoaded', loadSiteManagement);
})();
