// assets/js/admin-include.js

window.loadAdminHeader = async function(session) {
    const container = document.getElementById('admin-header-container');
    if (!container) return;

    try {
        // 1. Calculate the absolute site root path dynamically for GitHub Pages compatibility
        const siteRoot = getAdminSiteRoot();
        const partialsPath = siteRoot + "partials/";

        // Fetch using the absolute root path to avoid relative directory errors
        const response = await fetch(partialsPath + 'admin-header.html?v=20260614c', { cache: 'no-store' });
        const html = await response.text();
        container.innerHTML = html;

        // 2. Scan and repair all links/images inside the layout fragment to work on GitHub Pages
        fixAdminInjectedPaths(container, siteRoot);

        // 3. SET PAGE TITLE
        const titleEl = document.getElementById('nav-page-title');
        if (titleEl) titleEl.textContent = window.adminPageTitle || "Admin";

        // 3b. WEBSITE MANAGEMENT CHILD NAV
        renderWebsiteManagementNav();

        // 4. SET USER DATA & AVATAR
        if (session && session.user) {
            const meta = session.user.user_metadata;
            const nameEl = document.getElementById('nav-display-name');
            const imgEl = document.getElementById('nav-avatar-img');
            
            if (nameEl) nameEl.textContent = meta.display_name || "Admin";
            
            if (imgEl) {
                // Ensure the avatar path honors the GitHub Pages siteRoot directory subfolder
                let avatarUrl = meta.avatar_url || "assets/images/avatar-default.avif";
                if (!avatarUrl.startsWith('http')) {
                    const cleanAvatar = avatarUrl.replace(/^(\.\.\/|\.\/|\/)+/, '');
                    imgEl.src = siteRoot + cleanAvatar;
                } else {
                    imgEl.src = avatarUrl;
                }
            }
        }

        // 5. DROPDOWN TOGGLE
        const trigger = document.getElementById('nav-drop-trigger');
        const menu = document.getElementById('nav-drop-menu');
        if (trigger && menu) {
            trigger.onclick = (e) => {
                e.stopPropagation();
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            };
            document.addEventListener('click', () => menu.style.display = 'none');
        }

        // 6. LOGOUT BUTTON
        const logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                if (typeof window.isAppOnline !== 'undefined' && !window.isAppOnline) {
                    alert("⚠️ You cannot log out while in Offline Mode. Please reconnect to the internet first.");
                    return;
                }

                if (window.db) {
                    await window.db.auth.signOut();
                    window.location.href = getAdminUrl('login.html');
                }
            };
        }
    } catch (err) {
        console.error("Critical Nav Error:", err);
    }
};

// --- Load Admin Footer ---
window.loadAdminFooter = async function() {
    const container = document.getElementById('admin-footer-container');
    if (!container) return; 

    try {
        const siteRoot = getAdminSiteRoot();
        const partialsPath = siteRoot + "partials/";

        const response = await fetch(partialsPath + 'admin-footer.html?v=20260614c', { cache: 'no-store' });
        const html = await response.text();
        container.innerHTML = html;

        // Scan and repair footer links/images
        fixAdminInjectedPaths(container, siteRoot);
    } catch (err) {
        console.error("Critical Footer Error:", err);
    }
};

// --- PATH CONVERTER UTILITY ---
// Strips relative markers and forces structural absolute directory maps
function fixAdminInjectedPaths(container, root) {
    container.querySelectorAll('a, img').forEach(el => {
        const attr = el.tagName === 'A' ? 'href' : 'src';
        let val = el.getAttribute(attr);
        if (val && !val.startsWith('http') && !val.startsWith('tel:') && !val.startsWith('mailto:') && !val.startsWith('#')) {
            const cleanVal = val.replace(/^(\.\.\/|\.\/|\/)+/, '');
            el.setAttribute(attr, root + cleanVal);
        }
    });
}

function getAdminSiteRoot() {
    return window.location.hostname.includes("github.io") ? "/warm/" : "/";
}

function getAdminUrl(page) {
    return getAdminSiteRoot() + "admin/" + page;
}

async function waitForAdminDb(maxAttempts = 40) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (window.db && window.db.auth) return window.db;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return null;
}

window.getCurrentUserRole = async function() {
    const db = await waitForAdminDb();
    if (!db) return null;

    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user) {
        console.error("Unable to resolve current user for role lookup.", userError);
        return null;
    }

    const { data, error } = await db
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error("Unable to resolve user role from user_roles.", error);
        return null;
    }

    return data?.role || null;
};

function renderWebsiteManagementNav() {
    const pages = [
        { file: 'rates.html', label: 'Manage Rates' },
        { file: 'offers-admin.html', label: 'Manage Offers' },
        { file: 'content-cards-admin.html', label: 'Content Cards' },
        { file: 'hero-admin.html', label: 'Hero Pictures' },
        { file: 'testimonials-admin.html', label: 'Testimonials' },
        { file: 'site-management.html', label: 'Pages & Carousels' },
        { file: 'coverage-admin.html', label: 'Coverage Map' },
        { file: 'website-file-explorer.html', label: 'File Explorer' },
        { file: 'analytics-admin.html', label: 'Insights' }
    ];
    const currentFile = window.location.pathname.split('/').pop();
    if (!pages.some(page => page.file === currentFile)) return;
    if (document.getElementById('website-management-nav')) return;

    const titleEl = document.getElementById('nav-page-title');
    if (titleEl) titleEl.textContent = 'WarmHub - Website Management';

    const nav = document.createElement('nav');
    nav.id = 'website-management-nav';
    nav.className = 'website-management-nav admin-tab-strip';
    nav.setAttribute('aria-label', 'Website management tools');
    nav.innerHTML = `
        <a class="admin-tab-link admin-tab-back" href="${getAdminUrl('admin-landed.html')}#tab-website">&lt; Back</a>
        ${pages.map(page => `
            <a class="admin-tab-link ${page.file === currentFile ? 'is-active' : ''}" href="${getAdminUrl(page.file)}">${page.label}</a>
        `).join('')}
    `;

    const header = document.getElementById('admin-header-container');
    if (header) header.appendChild(nav);
}

// Function to protect pages based on role
window.requireRole = async function(allowedRoles) {
    const db = await waitForAdminDb();
    if (!db) {
        console.error("Admin database client was not ready for role check.");
        window.location.replace(getAdminUrl('login.html'));
        return false;
    }

    // 1. Get the current session
   const { data: { session } } = await db.auth.getSession();
    
    // 2. If they aren't logged in at all, kick them to login
    if (!session) {
        window.location.replace(getAdminUrl('login.html'));
        return false;
    }

    const userRole = await window.getCurrentUserRole();
    if (!userRole) {
        console.error("No role mapping was found for the current user.");
        window.location.replace(getAdminUrl('login.html'));
        return false;
    }

    if (!allowedRoles.includes(userRole)) {
        console.warn(`Access denied. User role '${userRole}' not in allowed list:`, allowedRoles);
        alert("You do not have permission to view this page.");
        window.location.replace(getAdminUrl('admin-landed.html'));
        return false;
    }

    return true;
};
