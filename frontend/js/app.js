/* Application entry point.

   Responsibilities:
   - register the routes
   - protect the routes: login required, then role check
   - build the sidebar depending on the role returned by the backend
   - handle a 401 coming from any API call
   - start the router */

const ALL_ROLES = [ROLES.CUSTOMER, ROLES.SUPPORT_AGENT, ROLES.ADMIN];

/* Sidebar entries. Each one is shown only to the roles listed here. */
const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: "bi-speedometer2", roles: ALL_ROLES },
  { path: "/tickets", label: "Tickets", icon: "bi-ticket-detailed", roles: ALL_ROLES },
  {
    path: "/tickets/create",
    label: "Create ticket",
    icon: "bi-plus-circle",
    roles: [ROLES.CUSTOMER],
  },
  { path: "/ai", label: "AI assistant", icon: "bi-stars", roles: ALL_ROLES },
  { path: "/users", label: "Users", icon: "bi-people", roles: [ROLES.ADMIN] },
  { path: "/statistics", label: "Statistics", icon: "bi-graph-up", roles: [ROLES.ADMIN] },
];

/* "/" only decides where to send the user. */
const HomePage = {
  render() {
    Router.replace(Auth.isAuthenticated() ? "/dashboard" : "/login");
  },
};

const App = {
  async start() {
    App.registerRoutes();
    App.bindShell();
    App.bindGlobalLinks();

    /* api.js calls this when the backend answers 401 to any request. */
    setUnauthorizedHandler(App.handleUnauthorized);

    await Auth.restore();
    App.renderShell();

    Router.start(document.getElementById("app-view"));
  },

  registerRoutes() {
    Router.register("/", { page: HomePage, title: "" });
    Router.register("/login", { page: LoginPage, public: true, title: "Sign in" });
    Router.register("/register", { page: RegisterPage, public: true, title: "Create account" });

    Router.register("/dashboard", { page: DashboardPage, title: "Dashboard" });
    Router.register("/tickets", { page: TicketsPage, title: "Tickets" });

    /* Registered before /tickets/:id so "create" is not read as a ticket id. */
    Router.register("/tickets/create", {
      page: CreateTicketPage,
      roles: [ROLES.CUSTOMER],
      title: "Create ticket",
    });

    Router.register("/tickets/:id", { page: TicketDetailsPage, title: "Ticket" });
    Router.register("/ai", { page: AiChatPage, title: "AI assistant" });
    Router.register("/users", { page: UsersPage, roles: [ROLES.ADMIN], title: "Users" });
    Router.register("/statistics", {
      page: StatisticsPage,
      roles: [ROLES.ADMIN],
      title: "Statistics",
    });

    Router.setGuard(App.guard);
  },

  /* Called by the router before every page render.
     Returns false when the router must stop, because this function already
     rendered something else or redirected. */
  async guard(route, params, path, outlet) {
    App.renderShell(path);

    if (route.isPublic) {
      /* A signed in user has no reason to see the login form again. */
      if (Auth.isAuthenticated()) {
        Router.replace("/dashboard");
        return false;
      }
      return true;
    }

    if (!Auth.isAuthenticated()) {
      Router.replace(`/login?next=${encodeURIComponent(path)}`);
      return false;
    }

    if (route.roles && !route.roles.includes(Auth.role())) {
      App.renderForbidden(outlet, route);
      return false;
    }

    return true;
  },

  renderForbidden(outlet, route) {
    const navItem = NAV_ITEMS.find((item) => item.path === route.pattern);
    const label = navItem ? navItem.label.toLowerCase() : "this page";

    outlet.innerHTML = `
      <div class="card border-0 shadow-sm">
        <div class="card-body text-center py-5">
          <div class="empty-icon text-danger mb-3"><i class="bi bi-shield-lock"></i></div>
          <h1 class="h4">Not available for your role</h1>
          <p class="text-body-secondary">
            Your account is registered as
            <strong>${UI.esc(UI.roleLabel(Auth.role()))}</strong>, and the ${UI.esc(label)}
            page is not part of your role. The backend refuses these requests as well.
          </p>
          <a href="/dashboard" data-link class="btn btn-primary">Back to dashboard</a>
        </div>
      </div>`;
  },

  handleUnauthorized() {
    Auth.signOut();
    App.renderShell();

    const next = Router.currentPath();
    UI.toast("Your session has expired. Please sign in again.", "warning");

    if (Router.currentPath() === "/login") return;
    Router.replace(`/login?next=${encodeURIComponent(next)}`);
  },

  /* ---------- shell ---------- */

  bindShell() {
    document.getElementById("logout-button").addEventListener("click", () => {
      Auth.signOut();
      App.renderShell();
      UI.toast("You have been signed out.", "info");
      Router.replace("/login");
    });

    const sidebar = document.getElementById("app-sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");

    const closeSidebar = () => {
      sidebar.classList.remove("is-open");
      backdrop.classList.remove("is-visible");
    };

    document.getElementById("sidebar-toggle").addEventListener("click", () => {
      sidebar.classList.add("is-open");
      backdrop.classList.add("is-visible");
    });

    backdrop.addEventListener("click", closeSidebar);
    sidebar.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeSidebar();
    });
  },

  renderShell(path) {
    const loggedIn = Auth.isAuthenticated();

    document.getElementById("app-sidebar").classList.toggle("d-none", !loggedIn);
    document.getElementById("app-topbar").classList.toggle("d-none", !loggedIn);

    if (!loggedIn) {
      document.getElementById("sidebar-nav").innerHTML = "";
      return;
    }

    const current = path || Router.currentPath();
    const role = Auth.role();

    const nav = document.getElementById("sidebar-nav");
    nav.innerHTML = NAV_ITEMS.filter((item) => item.roles.includes(role))
      .map(
        (item) => `
        <a href="${item.path}" data-link class="sidebar-link${App.isActive(item.path, current) ? " is-active" : ""}">
          <i class="bi ${item.icon}"></i>
          <span>${UI.esc(item.label)}</span>
        </a>`
      )
      .join("");

    document.getElementById("current-user-name").textContent = Auth.user.name;
    document.getElementById("current-user-role").textContent = UI.roleLabel(role);

    const active = NAV_ITEMS.find((item) => App.isActive(item.path, current));
    document.getElementById("topbar-title").textContent = active ? active.label : "AI Support";
  },

  isActive(itemPath, current) {
    if (itemPath === current) return true;
    if (itemPath === "/tickets") {
      return current.startsWith("/tickets/") && current !== "/tickets/create";
    }
    return false;
  },

  /* Every internal link uses data-link so navigation stays client side and the
     browser Back / Forward buttons keep working. */
  bindGlobalLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[data-link]");
      if (!link) return;

      /* Ignore modified clicks so "open in new tab" still works. */
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

      event.preventDefault();
      Router.navigate(link.getAttribute("href"));
    });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  App.start();
});
