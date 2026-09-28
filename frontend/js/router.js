/* Client-side router built on the History API.

   Why History API: the pages need real URLs (/tickets/15) so that refreshing a
   page and using the browser Back / Forward buttons work correctly.

   Each navigation renders into a NEW detached element. If a slow page finishes
   after the user already navigated away, its output goes to an element that is
   no longer on the page, so it can never overwrite the current view. */

const Router = {
  routes: [],

  /* options: { page, public, roles } */
  register(path, options) {
    this.routes.push({
      pattern: path,
      segments: path.split("/").filter(Boolean),
      page: options.page,
      isPublic: Boolean(options.public),
      roles: options.roles || null,
      title: options.title || "",
    });
  },

  /* app.js provides the guard that checks login state and role. */
  setGuard(guard) {
    this.guard = guard;
  },

  start(container) {
    this.container = container;

    window.addEventListener("popstate", () => {
      this.resolve();
    });

    this.resolve();
  },

  currentPath() {
    return window.location.pathname || "/";
  },

  currentQuery() {
    return new URLSearchParams(window.location.search);
  },

  navigate(path, options) {
    const replace = Boolean(options && options.replace);
    const current = this.currentPath() + window.location.search;

    if (path === current) return;

    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }

    this.resolve();
  },

  /* Redirect without adding a new history entry (used after login). */
  replace(path) {
    this.navigate(path, { replace: true });
  },

  match(path) {
    const parts = path.split("/").filter(Boolean);

    for (const route of this.routes) {
      if (route.segments.length !== parts.length) continue;

      const params = {};
      let matched = true;

      for (let i = 0; i < route.segments.length; i += 1) {
        const segment = route.segments[i];

        if (segment.startsWith(":")) {
          params[segment.slice(1)] = decodeURIComponent(parts[i]);
        } else if (segment !== parts[i]) {
          matched = false;
          break;
        }
      }

      if (matched) return { route, params };
    }

    return null;
  },

  async resolve() {
    const path = this.currentPath();
    const found = this.match(path);

    const outlet = document.createElement("div");
    outlet.className = "page-content";
    this.container.replaceChildren(outlet);
    window.scrollTo(0, 0);

    if (!found) {
      this.renderNotFound(outlet, path);
      return;
    }

    if (this.guard) {
      document.title = found.route.title
        ? `${found.route.title} · AI Support`
        : "AI Support";

      const allowed = await this.guard(found.route, found.params, path, outlet);
      if (allowed === false) return;
    }

    try {
      await found.route.page.render({ outlet, params: found.params, query: this.currentQuery() });
    } catch (error) {
      /* A page should handle its own API errors. This is the last safety net
         so the user is never left with a blank page. */
      console.error("Page failed to render:", error);
      outlet.innerHTML = `
        <div class="alert alert-danger">
          <h5 class="alert-heading">Something went wrong</h5>
          <p class="mb-0">This page could not be displayed. Please go back and try again.</p>
        </div>`;
    }
  },

  renderNotFound(outlet, path) {
    document.title = "Page not found · AI Support";
    outlet.innerHTML = `
      <div class="card border-0 shadow-sm">
        <div class="card-body text-center py-5">
          <div class="display-6 mb-2">404</div>
          <h1 class="h4">Page not found</h1>
          <p class="text-body-secondary">
            <code>${UI.esc(path)}</code> does not match any page.
          </p>
          <a class="btn btn-primary" href="/dashboard" data-link>Go to dashboard</a>
        </div>
      </div>`;
  },
};
