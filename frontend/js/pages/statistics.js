/* Statistics page (admin only).

   Uses GET /admin/statistics, GET /admin/support-activity and
   GET /admin/ai-usage. No charting library: the numbers are shown as Bootstrap
   cards and simple CSS bars, which is enough to present the data. */

const StatisticsPage = {
  async render({ outlet }) {
    UI.loading(outlet, "Loading statistics...");

    /* Each section loads on its own so one failure does not hide the others. */
    const [statistics, activity, usage] = await Promise.all([
      Api.admin.statistics().catch((error) => ({ error })),
      Api.admin.supportActivity().catch((error) => ({ error })),
      Api.admin.aiUsage().catch((error) => ({ error })),
    ]);

    outlet.innerHTML = `
      ${UI.pageHeader("Statistics", "Platform activity reported by the admin endpoints.")}
      <div data-statistics></div>
      <div class="row g-4 mt-0">
        <div class="col-12 col-xl-7" data-activity></div>
        <div class="col-12 col-xl-5" data-usage></div>
      </div>`;

    StatisticsPage.renderStatistics(outlet.querySelector("[data-statistics]"), statistics);
    StatisticsPage.renderActivity(outlet.querySelector("[data-activity]"), activity);
    StatisticsPage.renderUsage(outlet.querySelector("[data-usage]"), usage);
  },

  sectionError(container, error, label) {
    container.innerHTML = `
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body">
          <h2 class="h6">${UI.esc(label)}</h2>
          <div class="alert alert-danger small mb-0 mt-2">${UI.esc(error.message)}</div>
        </div>
      </div>`;
  },

  renderStatistics(container, result) {
    if (result.error) {
      return this.sectionError(container, result.error, "Ticket statistics");
    }

    const perCategory = result.tickets_per_category || {};
    const perAgent = result.tickets_per_agent || [];

    const categoryEntries = Object.entries(perCategory);
    const maxCategory = categoryEntries.reduce((max, [, count]) => Math.max(max, count), 0);

    container.innerHTML = `
      <div class="row g-3 mb-4">
        ${UI.statCard("Total tickets", result.total_tickets, "primary", "bi-ticket")}
        ${UI.statCard("Open", result.open_tickets, "primary", "bi-folder2-open")}
        ${UI.statCard("In progress", result.in_progress_tickets, "info", "bi-hourglass-split")}
        ${UI.statCard("Resolved", result.resolved_tickets, "success", "bi-check-circle")}
        ${UI.statCard("Critical", result.critical_tickets, "danger", "bi-exclamation-triangle")}
      </div>

      <div class="row g-4">
        <div class="col-12 col-xl-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-transparent"><h2 class="h6 mb-0">Tickets per category</h2></div>
            <div class="card-body pt-0">
              ${
                categoryEntries.length
                  ? categoryEntries
                      .map(([category, count]) => {
                        const width = maxCategory ? Math.round((count / maxCategory) * 100) : 0;
                        return `
                        <div class="mb-3">
                          <div class="d-flex justify-content-between small mb-1">
                            <span>${UI.esc(UI.categoryLabel(category))}</span>
                            <span class="text-body-secondary">${UI.esc(count)}</span>
                          </div>
                          <div class="progress" style="height: 8px;">
                            <div class="progress-bar" style="width: ${width}%"></div>
                          </div>
                        </div>`;
                      })
                      .join("")
                  : '<p class="text-body-secondary small mb-0">No ticket has been created yet.</p>'
              }
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-transparent"><h2 class="h6 mb-0">Tickets per support agent</h2></div>
            <div class="table-responsive">
              ${
                perAgent.length
                  ? `<table class="table table-hover align-middle mb-0">
                       <thead><tr><th scope="col">Agent</th><th scope="col" class="text-end">Tickets</th></tr></thead>
                       <tbody>
                         ${perAgent
                           .map(
                             (row) => `
                           <tr>
                             <td>${UI.esc(row.agent_name)}</td>
                             <td class="text-end">${UI.esc(row.ticket_count)}</td>
                           </tr>`
                           )
                           .join("")}
                       </tbody>
                     </table>`
                  : '<div class="card-body"><p class="text-body-secondary small mb-0">No ticket is assigned to an agent yet.</p></div>'
              }
            </div>
          </div>
        </div>
      </div>`;
  },

  renderActivity(container, result) {
    if (result.error) {
      return this.sectionError(container, result.error, "Support activity");
    }

    const rows = result || [];

    container.innerHTML = `
      <div class="card border-0 shadow-sm h-100">
        <div class="card-header bg-transparent"><h2 class="h6 mb-0">Support activity</h2></div>
        <div class="table-responsive">
          ${
            rows.length
              ? `<table class="table table-hover align-middle mb-0">
                   <thead>
                     <tr>
                       <th scope="col">Agent</th>
                       <th scope="col" class="text-end">Assigned</th>
                       <th scope="col" class="text-end">Resolved</th>
                       <th scope="col" class="text-end">Messages</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${rows
                       .map(
                         (row) => `
                       <tr>
                         <td>${UI.esc(row.agent_name)}</td>
                         <td class="text-end">${UI.esc(row.assigned_tickets)}</td>
                         <td class="text-end">${UI.esc(row.resolved_tickets)}</td>
                         <td class="text-end">${UI.esc(row.messages_sent)}</td>
                       </tr>`
                       )
                       .join("")}
                   </tbody>
                 </table>`
              : '<div class="card-body"><p class="text-body-secondary small mb-0">No support agent exists yet.</p></div>'
          }
        </div>
      </div>`;
  },

  renderUsage(container, result) {
    if (result.error) {
      return this.sectionError(container, result.error, "AI usage");
    }

    const rows = result || [];

    container.innerHTML = `
      <div class="card border-0 shadow-sm h-100">
        <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
          <h2 class="h6 mb-0">AI usage</h2>
          <span class="badge text-bg-light border">${rows.length} operation(s)</span>
        </div>
        <div class="table-responsive" style="max-height: 24rem; overflow-y: auto;">
          ${
            rows.length
              ? `<table class="table table-hover align-middle mb-0">
                   <thead>
                     <tr>
                       <th scope="col">User</th>
                       <th scope="col">Operation</th>
                       <th scope="col">Result</th>
                       <th scope="col" class="text-end">Date</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${rows
                       .map(
                         (row) => `
                       <tr>
                         <td>${UI.esc(row.user_name)}</td>
                         <td><code class="small">${UI.esc(row.operation)}</code></td>
                         <td>
                           <span class="badge text-bg-${row.success ? "success" : "danger"}">
                             ${row.success ? "Success" : "Failed"}
                           </span>
                         </td>
                         <td class="text-end text-body-secondary small">${UI.esc(
                           UI.formatDate(row.created_at)
                         )}</td>
                       </tr>`
                       )
                       .join("")}
                   </tbody>
                 </table>`
              : '<div class="card-body"><p class="text-body-secondary small mb-0">No AI operation has been recorded yet.</p></div>'
          }
        </div>
      </div>`;
  },
};
