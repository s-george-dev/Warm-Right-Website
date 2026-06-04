console.log("MAIN JS VERSION", 4);

document.addEventListener("DOMContentLoaded", () => {

  updateTileImages();
  initTestimonials();

  /* ================================
      REVEAL ANIMATIONS
  ================================== */
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.card').forEach((c, i) => {
    c.style.transitionDelay = `${i * 100}ms`;
    observer.observe(c);
  });

  /* ================================
      SCROLL ANIMATIONS
  ================================== */
  let backToTop = document.querySelector('.back-to-top');
  if (!backToTop) {
    backToTop = document.createElement('a');
    backToTop.href = "#";
    backToTop.className = "back-to-top";
    backToTop.textContent = "↑";
    document.body.appendChild(backToTop);
  }

  document.body.addEventListener('scroll', () => {
    if (document.body.scrollTop > 400) {
      backToTop.classList.add('show');
    } else {
      backToTop.classList.remove('show');
    }
	const mobileToggle = document.querySelector('.menu-toggle');
  if (mobileToggle) {
    
    if (document.body.scrollTop > 60) {
      mobileToggle.classList.add('scrolled');
    } else {
      mobileToggle.classList.remove('scrolled');
    }
  }
  });

  backToTop.addEventListener('click', (e) => {
    e.preventDefault();
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ================================
      SLIDESHOW ROTATION
  ================================== */
  const slides = document.querySelectorAll('.slide');
  let current = 0;
  if (slides.length > 0) {
    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 6000);
  }

  /* ================================
       CAROUSEL AUTO-SCROLL
  ================================== */
  document.querySelectorAll('.carousel-container').forEach(container => {
    const track = container.querySelector('.carousel-track');
    if (!track) return;

    const tiles = Array.from(track.querySelectorAll('.info-tile'));
    const prevBtn = container.querySelector('.carousel-btn.left');
    const nextBtn = container.querySelector('.carousel-btn.right');

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Carousel speed is pixels per second. Try 3-8 for a slow drift, 15-25 for faster movement.
    const carouselSpeed = 25;
    const hoverSeekMultiplier = 2.75;
    const clickTileJump = 3;
    const clickGlideMs = 650;
    let isPaused = false;
    let isVisible = true;
    let scrollDirection = 1;
    let seekDirection = 0;
    let scrollPosition = track.scrollLeft;
    let lastFrameTime;
    let resumeTimeout;
    let clickAnimation;

    function pauseBriefly(delay = 1200) {
      isPaused = true;
      clearTimeout(resumeTimeout);
      resumeTimeout = setTimeout(() => {
        isPaused = false;
        lastFrameTime = undefined;
      }, delay);
    }

    if ('IntersectionObserver' in window) {
      const carouselObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          isVisible = entry.isIntersecting;
          if (isVisible) lastFrameTime = undefined;
        });
      }, { threshold: 0.15 });

      carouselObserver.observe(container);
    }

    function animateScroll(timestamp) {
      if (prefersReducedMotion || (isPaused && seekDirection === 0) || !isVisible || !track) {
        lastFrameTime = timestamp;
        requestAnimationFrame(animateScroll);
        return;
      }

      if (lastFrameTime === undefined) lastFrameTime = timestamp;
      const elapsedSeconds = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
      lastFrameTime = timestamp;

      const activeDirection = seekDirection || scrollDirection;
      const activeSpeed = seekDirection ? carouselSpeed * hoverSeekMultiplier : carouselSpeed;

      scrollPosition += activeSpeed * elapsedSeconds * activeDirection;
      track.scrollLeft = scrollPosition;

      const maxScroll = track.scrollWidth - track.clientWidth;

      if (activeDirection === 1 && track.scrollLeft >= maxScroll - 5) {
        scrollDirection = -1;
        scrollPosition = maxScroll;
        track.scrollLeft = scrollPosition;
      } else if (activeDirection === -1 && track.scrollLeft <= 5) {
        scrollDirection = 1;
        scrollPosition = 0;
        track.scrollLeft = scrollPosition;
      }

      requestAnimationFrame(animateScroll);
    }

    // User interaction handling
    if (track) {
      track.addEventListener('wheel', () => pauseBriefly(), { passive: true });
      track.addEventListener('touchstart', () => {
        isPaused = true;
        clearTimeout(resumeTimeout);
      }, { passive: true });
      track.addEventListener('touchend', () => pauseBriefly(900), { passive: true });

      // Hover + Touch pause
      container.addEventListener('mouseenter', () => {
        if (seekDirection === 0) isPaused = true;
      });
      container.addEventListener('mouseleave', () => {
        isPaused = false;
        seekDirection = 0;
        lastFrameTime = undefined;
      });
    }

    // Buttons
    function startSeek(dir) {
      cancelAnimationFrame(clickAnimation);
      seekDirection = dir;
      isPaused = false;
      scrollPosition = track.scrollLeft;
      lastFrameTime = undefined;
    }

    function stopSeek() {
      seekDirection = 0;
      isPaused = true;
      scrollPosition = track.scrollLeft;
      lastFrameTime = undefined;
    }

    function scrollByTile(dir = 1) {
      const tileWidth = tiles[0]?.offsetWidth + 24 || 280;
      const maxScroll = track.scrollWidth - track.clientWidth;
      const start = track.scrollLeft;
      const target = Math.max(0, Math.min(maxScroll, start + (dir * tileWidth * clickTileJump)));
      const startTime = performance.now();

      cancelAnimationFrame(clickAnimation);
      isPaused = true;
      seekDirection = 0;

      function glide(now) {
        const progress = Math.min((now - startTime) / clickGlideMs, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        scrollPosition = start + ((target - start) * eased);
        track.scrollLeft = scrollPosition;

        if (progress < 1) {
          clickAnimation = requestAnimationFrame(glide);
          return;
        }

        scrollPosition = target;
        track.scrollLeft = target;
        lastFrameTime = undefined;
      }

      clickAnimation = requestAnimationFrame(glide);
    }

    if (nextBtn) {
      nextBtn.addEventListener('mouseenter', () => startSeek(2));
      nextBtn.addEventListener('mouseleave', stopSeek);
      nextBtn.addEventListener('click', () => { scrollByTile(6); pauseBriefly(1400); });
    }
    if (prevBtn) {
      prevBtn.addEventListener('mouseenter', () => startSeek(-2));
      prevBtn.addEventListener('mouseleave', stopSeek);
      prevBtn.addEventListener('click', () => { scrollByTile(-6); pauseBriefly(1400); });
    }

    // Start animation
    requestAnimationFrame(animateScroll);
  });

}); // end DOMContentLoaded

/* ================================
    SUPPORT FUNCTIONS
================================== */
async function updateTileImages() {
  const callTile = document.getElementById('call-to-book');
  if (!callTile) return;
  const img = callTile.querySelector('img');

  // 1. Fetch the real status from our new logic
  // (Assuming getOpeningStatus() is available in your global scope or helper file)
  const status = await getOpeningStatus(); 

  // 2. Update the image based on the DB, not a hardcoded number
  if (img) {
    img.src = status.isOpen 
      ? "assets/images/office-open.jpg" 
      : "assets/images/office-closed.jpg";
  }
  
  // 3. Bonus: Update the tile's visual state or link while we're here
  if (!status.isOpen) {
    callTile.classList.add('is-closed');
  } else {
    callTile.classList.remove('is-closed');
  }
}

function initTestimonials() {
  const cards = document.querySelectorAll('.review-card');
  cards.forEach(card => {
    const body = card.querySelector('.review-body');
    const btn = card.querySelector('.read-more-btn');
    if (!body || !btn) return;
    if (body.scrollHeight <= 80) btn.style.display = 'none';
    btn.addEventListener('click', () => {
      const isExpanded = card.classList.toggle('expanded');
      btn.innerText = isExpanded ? "Show less" : "Read more";
      if (!isExpanded) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

// Ensure map works even if loaded late
function initMapOverlay() {
  const mapOverlay = document.getElementById('mapOverlay');
  if (mapOverlay) {
    mapOverlay.addEventListener('click', function activateMap() {
      const container = this.parentElement;
      if (container) {
        container.classList.add('active');
        this.classList.add('hidden');
      }
    });
  }
}

//accessibility widget for text size adjustment, using CSS variable for dynamic font sizing
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("accessibility-toggle")) {
    const options = document.getElementById("accessibility-options");
    options.style.display = options.style.display === "none" ? "block" : "inline-block";
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "text-size") {
    document.documentElement.style.setProperty('--base-font-size', `${e.target.value}px`);
  }
  
});

document.addEventListener("DOMContentLoaded", initMapOverlay);
document.addEventListener("includesLoaded", initMapOverlay);
