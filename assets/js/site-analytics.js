(function () {
  if (window.__warmRightAnalyticsLoaded || navigator.doNotTrack === '1') return;
  window.__warmRightAnalyticsLoaded = true;

  const functionUrl = 'https://axampuprcnauxbbijmmt.supabase.co/functions/v1/site-analytics?action=collect';
  const publicKey = 'sb_publishable_NFuFkO0tybTuMvYOQekQmA_62araOjM';
  const storageKey = 'warmright_analytics_session';

  function sessionId() {
    try {
      let id = sessionStorage.getItem(storageKey);
      if (!id) {
        id = typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID().replace(/-/g, '')
          : `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(storageKey, id);
      }
      return id;
    } catch {
      return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  }

  function deviceType() {
    const width = Math.max(window.innerWidth || 0, screen.width || 0);
    if (/tablet|ipad/i.test(navigator.userAgent) || (width >= 600 && width < 1024)) return 'tablet';
    if (/mobile|android|iphone/i.test(navigator.userAgent) || width < 600) return 'mobile';
    return 'desktop';
  }

  function externalReferrer() {
    if (!document.referrer) return '';
    try {
      const url = new URL(document.referrer);
      return url.hostname === window.location.hostname ? '' : url.toString();
    } catch {
      return '';
    }
  }

  function basePayload(eventName) {
    const params = new URLSearchParams(window.location.search);
    return {
      session_id: sessionId(),
      event_name: eventName,
      page_path: window.location.pathname || '/',
      page_title: document.title || '',
      referrer: externalReferrer(),
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      device_type: deviceType(),
    };
  }

  function send(eventName) {
    fetch(functionUrl, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${publicKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(basePayload(eventName)),
    }).catch(() => {});
  }

  function eventForLink(link) {
    const href = (link.getAttribute('href') || '').toLowerCase();
    if (href.includes('book-a-visit')) return 'book_visit_click';
    if (href.startsWith('tel:') || href.startsWith('mailto:') || href.includes('contact')) return 'contact_click';
    if (href.includes('testimonial-submit')) return 'testimonial_click';
    if (href.includes('offers')) return 'offer_click';
    return '';
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const eventName = eventForLink(link);
    if (eventName) send(eventName);
  }, { capture: true });

  send('page_view');
})();
