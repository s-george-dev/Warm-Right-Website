(function () {
  const PHONE_DISPLAY = '0800 756 6748';
  const PHONE_TEL = 'tel:08007566748';
  const EMERGENCY_TEL = 'tel:08007566748,0';
  const TEXT_TEL = 'sms:07985292527';
  const EMAIL = 'mailto:info@warmright.uk';
  const WHATSAPP = 'https://wa.me/+448007566748';

  const actions = {
    emergency: {
      title: 'Emergencies',
      body: 'For urgent assistance, call 0800 756 6748. On connection, press 0.',
      button: 'Call Emergency Line',
      href: EMERGENCY_TEL
    },
    text: {
      title: 'Text Us',
      body: 'Send us a text message and we will respond as soon as we can during office hours.',
      button: 'Text 07985 292527',
      href: TEXT_TEL
    },
    whatsapp: {
      title: 'WhatsApp Us',
      body: 'Send us a WhatsApp message at +44 800 756 6748.',
      button: 'Open WhatsApp',
      href: WHATSAPP,
      logo: 'assets/images/WhatsApp Logos.svg'
    },
    email: {
      title: 'Email Us',
      body: 'Email us at info@warmright.uk and we will reply by the next working day.',
      button: 'Email info@warmright.uk',
      href: EMAIL
    },
    fax: {
      title: 'Fax',
      body: 'You can send faxes to 0870 705 24 32.',
      button: 'Close',
      href: null
    },
    general: {
      title: 'General Enquiries',
      body: `Contact us on ${PHONE_DISPLAY}.`,
      button: `Call ${PHONE_DISPLAY}`,
      href: PHONE_TEL
    }
  };

  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function ensureModal() {
    let modal = document.getElementById('contact-action-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'contact-action-modal';
    modal.className = 'contact-action-modal';
    modal.innerHTML = `
      <div class="contact-action-modal-content">
        <button class="contact-action-close" type="button" aria-label="Close">&times;</button>
        <div id="contact-action-logo"></div>
        <h2 id="contact-action-title"></h2>
        <p id="contact-action-body"></p>
        <div class="contact-action-buttons">
          <a id="contact-action-link" class="btn primary" href="#"></a>
          <button id="contact-action-dismiss" class="btn secondary" type="button">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (
        event.target === modal ||
        event.target.classList.contains('contact-action-close') ||
        event.target.id === 'contact-action-dismiss'
      ) {
        closeModal();
      }
    });
    return modal;
  }

  function openActionModal(actionKey) {
    const action = actions[actionKey];
    if (!action) return;

    const modal = ensureModal();
    const logo = modal.querySelector('#contact-action-logo');
    const link = modal.querySelector('#contact-action-link');

    modal.querySelector('#contact-action-title').textContent = action.title;
    modal.querySelector('#contact-action-body').textContent = action.body;
    logo.innerHTML = action.logo ? `<img src="${action.logo}" alt="" class="contact-action-logo">` : '';

    if (action.href) {
      link.hidden = false;
      link.href = action.href;
      link.textContent = action.button;
    } else {
      link.hidden = true;
      link.removeAttribute('href');
    }

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    const modal = document.getElementById('contact-action-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  async function initContactActions() {
    if (window.contactActionsReady) return;
    window.contactActionsReady = true;
    const status = window.getOpeningStatus ? await window.getOpeningStatus() : { isOpen: true };

    document.querySelectorAll('[data-contact-action]').forEach(tile => {
      const actionKey = tile.dataset.contactAction;
      const action = actions[actionKey];
      if (!action) return;

      if (isMobile() && ['emergency', 'text', 'whatsapp', 'email'].includes(actionKey)) {
        tile.href = action.href;
        return;
      }

      if (actionKey === 'general') {
        if (status.isOpen) {
          tile.href = PHONE_TEL;
          tile.addEventListener('click', event => {
            if (isMobile()) return;
            event.preventDefault();
            openActionModal('general');
          });
        }
        return;
      }

      tile.href = action.href || 'javascript:void(0)';
      tile.addEventListener('click', event => {
        event.preventDefault();
        openActionModal(actionKey);
      });
    });
  }

  function scheduleInit() {
    const waitForHours = setInterval(() => {
      if (window.getOpeningStatus) {
        clearInterval(waitForHours);
        initContactActions();
      }
    }, 50);
  }

  document.addEventListener('includesLoaded', scheduleInit);
  if (document.readyState !== 'loading') {
    setTimeout(scheduleInit, 0);
  }
})();
