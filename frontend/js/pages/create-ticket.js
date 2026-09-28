/* Create ticket page (customers only, enforced by the router and the backend).

   The form has exactly the three fields accepted by POST /tickets:
   subject, description and message. Category and priority are decided by the
   backend AI, so they are not part of the form. */

const CreateTicketPage = {
  async render({ outlet }) {
    outlet.innerHTML = `
      ${UI.pageHeader(
        "Create a ticket",
        "Describe your problem and the AI assistant will classify it automatically."
      )}

      <div class="row g-4">
        <div class="col-12 col-lg-8">
          <div class="card border-0 shadow-sm">
            <div class="card-body p-4">
              <div class="alert alert-danger d-none" data-error role="alert"></div>

              <form novalidate>
                <div class="mb-3">
                  <label for="ticket-subject" class="form-label">Subject</label>
                  <input type="text" id="ticket-subject" name="subject" class="form-control"
                         maxlength="255" required placeholder="Short summary of the problem">
                </div>

                <div class="mb-3">
                  <label for="ticket-description" class="form-label">Description</label>
                  <textarea id="ticket-description" name="description" class="form-control"
                            rows="5" required
                            placeholder="What happened? Include any error message you saw."></textarea>
                  <div class="form-text">This text is what the AI reads to detect the category.</div>
                </div>

                <div class="mb-4">
                  <label for="ticket-message" class="form-label">First message</label>
                  <textarea id="ticket-message" name="message" class="form-control"
                            rows="4" required
                            placeholder="Anything else the support team should know?"></textarea>
                  <div class="form-text">This becomes the first message of the conversation.</div>
                </div>

                <div class="d-flex gap-2">
                  <button type="submit" class="btn btn-primary" data-submit>Create ticket</button>
                  <a href="/tickets" data-link class="btn btn-outline-secondary">Cancel</a>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-4">
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <h2 class="h6"><i class="bi bi-stars me-1"></i>How classification works</h2>
              <p class="text-body-secondary small mb-0">
                When you submit the form, the backend sends your subject and description
                to the AI. The AI decides the category, the priority and writes a short
                summary, then a support agent picks the ticket up.
              </p>
            </div>
          </div>
        </div>
      </div>`;

    const form = outlet.querySelector("form");
    const errorBox = outlet.querySelector("[data-error]");
    const submitButton = outlet.querySelector("[data-submit]");

    const showError = (message) => {
      errorBox.textContent = message;
      errorBox.classList.remove("d-none");
      errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.classList.add("d-none");

      const subject = form.subject.value.trim();
      const description = form.description.value.trim();
      const message = form.message.value.trim();

      if (!subject || !description || !message) {
        showError("Please fill in the subject, the description and the first message.");
        return;
      }

      UI.setBusy(submitButton, true, "Creating ticket...");

      try {
        const ticket = await Api.tickets.create(subject, description, message);
        UI.toast(`Ticket #${ticket.id} created.`, "success");
        Router.navigate(`/tickets/${ticket.id}`);
      } catch (error) {
        /* The backend rolls the whole ticket back if the AI classification
           fails, so a 500 here means no ticket was saved. */
        UI.setBusy(submitButton, false);
        showError(
          error.status === 500
            ? `${error.message} — the ticket was not created, because the backend needs the AI to classify it. Please try again.`
            : error.message
        );
      }
    });
  },
};
