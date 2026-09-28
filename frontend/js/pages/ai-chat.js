/* AI assistant page.

   The normal experience uses POST /ai/chat, which is the endpoint that
   returns a real answer.

   Two extra backend endpoints are exposed on purpose:
   - POST /ai/chat/structured returns the answer with a confidence score
   - POST /ai/chat/stream is NOT a live stream. The backend runs the whole graph
     and returns every event in one JSON body, so it is shown as a static
     "agent steps" report and is never presented as streaming. */

const AiChatPage = {
  async render({ outlet }) {
    const role = Auth.role();

    outlet.innerHTML = `
      ${UI.pageHeader(
        "AI assistant",
        role === ROLES.CUSTOMER
          ? "Ask about your orders, your account, or a problem you are facing."
          : "Ask the AI anything about support. The agent only reads data belonging to your account."
      )}

      <div class="alert alert-info small">
        <i class="bi bi-info-circle me-1"></i>
        Answers come from the AI agent connected to the backend. The assistant can look up
        your own tickets, create one for you, and escalate to a human when needed.
      </div>

      <div class="row g-4">
        <div class="col-12 col-lg-8">
          <div class="card border-0 shadow-sm">
            <div class="card-body d-flex flex-column chat-window">
              <div class="message-list flex-grow-1" data-thread>
                <div class="message message-theirs">
                  <div class="message-meta"><span class="fw-semibold">AI assistant</span></div>
                  <div class="message-bubble">
                    Hello ${UI.esc(Auth.user.name)}. What can I help you with?
                  </div>
                </div>
              </div>

              <form class="mt-3" data-chat-form>
                <label for="chat-input" class="visually-hidden">Message</label>
                <textarea id="chat-input" class="form-control" rows="3"
                          placeholder="Type your question..." required></textarea>
                <div class="d-flex justify-content-between align-items-center mt-2 gap-2">
                  <div class="text-body-secondary small">Enter to send, Shift + Enter for a new line.</div>
                  <button type="submit" class="btn btn-primary" data-send>Send</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-4">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-transparent"><h2 class="h6 mb-0">Other AI endpoints</h2></div>
            <div class="card-body">
              <p class="text-body-secondary small">
                These are two extra endpoints the backend exposes. They each run the AI again,
                so they are not part of the normal conversation above.
              </p>

              <button type="button" class="btn btn-outline-primary btn-sm w-100 mb-2" data-structured>
                <i class="bi bi-clipboard-data me-1"></i>Get a structured answer
              </button>
              <div data-structured-result></div>

              <hr class="my-3">

              <button type="button" class="btn btn-outline-secondary btn-sm w-100" data-steps>
                <i class="bi bi-list-ol me-1"></i>Inspect agent steps
              </button>
              <p class="form-text mt-2">
                <code>/ai/chat/stream</code> is not a live stream. The backend waits for the
                whole agent run and returns every event at once.
              </p>
              <div data-steps-result></div>
            </div>
          </div>
        </div>
      </div>`;

    const thread = outlet.querySelector("[data-thread]");
    const form = outlet.querySelector("[data-chat-form]");
    const input = outlet.querySelector("#chat-input");
    const sendButton = outlet.querySelector("[data-send]");

    const appendMessage = (name, content, mine) => {
      const wrapper = document.createElement("div");
      wrapper.className = `message ${mine ? "message-mine" : "message-theirs"}`;
      wrapper.innerHTML = `
        <div class="message-meta"><span class="fw-semibold">${UI.esc(name)}</span></div>
        <div class="message-bubble">${UI.esc(content)}</div>`;
      thread.appendChild(wrapper);
      thread.scrollTop = thread.scrollHeight;
    };

    const appendPending = (label) => {
      const wrapper = document.createElement("div");
      wrapper.className = "message message-theirs";
      wrapper.innerHTML = `
        <div class="message-meta"><span class="fw-semibold">${UI.esc(label)}</span></div>
        <div class="message-bubble"><span class="spinner-border spinner-border-sm me-2"></span>Thinking...</div>`;
      thread.appendChild(wrapper);
      thread.scrollTop = thread.scrollHeight;
      return wrapper;
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const message = input.value.trim();
      if (!message) return;

      appendMessage("You", message, true);
      input.value = "";
      UI.setBusy(sendButton, true, "Sending...");
      const pending = appendPending("AI assistant");

      try {
        const result = await Api.ai.chat(message);
        pending.querySelector(".message-bubble").textContent = result.response;
      } catch (error) {
        pending.remove();
        appendMessage("System", error.message, false);
        UI.toast(error.message, "danger");
      } finally {
        UI.setBusy(sendButton, false);
        input.focus();
        thread.scrollTop = thread.scrollHeight;
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    /* ---------- /ai/chat/structured ---------- */

    const structuredButton = outlet.querySelector("[data-structured]");
    const structuredResult = outlet.querySelector("[data-structured-result]");

    structuredButton.addEventListener("click", async () => {
      const message = input.value.trim() || thread.querySelector(".message-mine .message-bubble")?.textContent;
      if (!message) {
        UI.toast("Type a question first.", "warning");
        return;
      }

      UI.setBusy(structuredButton, true, "Asking...");
      structuredResult.innerHTML = "";

      try {
        const result = await Api.ai.chatStructured(message);
        const percent = Math.round((result.confidence_score || 0) * 100);
        const sources = result.sources || [];

        structuredResult.innerHTML = `
          <div class="card mt-2">
            <div class="card-body">
              <p class="small mb-2">${UI.esc(result.response)}</p>
              <div class="d-flex align-items-center gap-2 mb-2">
                <div class="progress flex-grow-1" style="height: 6px;">
                  <div class="progress-bar" style="width: ${Math.max(0, Math.min(100, percent))}%"></div>
                </div>
                <span class="small text-body-secondary text-nowrap">${UI.esc(percent)}% confidence</span>
              </div>
              ${
                sources.length
                  ? `<div class="small text-body-secondary">Sources: ${UI.esc(sources.join(", "))}</div>`
                  : '<div class="small text-body-secondary">No source returned.</div>'
              }
            </div>
          </div>`;
      } catch (error) {
        structuredResult.innerHTML = `<div class="alert alert-danger mt-2 small">${UI.esc(error.message)}</div>`;
      } finally {
        UI.setBusy(structuredButton, false);
      }
    });

    /* ---------- /ai/chat/stream (not a real stream) ---------- */

    const stepsButton = outlet.querySelector("[data-steps]");
    const stepsResult = outlet.querySelector("[data-steps-result]");

    stepsButton.addEventListener("click", async () => {
      const message =
        input.value.trim() || thread.querySelector(".message-mine .message-bubble")?.textContent;
      if (!message) {
        UI.toast("Type a question first.", "warning");
        return;
      }

      UI.setBusy(stepsButton, true, "Running agent...");
      stepsResult.innerHTML = "";

      try {
        const result = await Api.ai.chatEvents(message);
        const events = result.events || [];

        stepsResult.innerHTML = `
          <div class="card mt-2">
            <div class="card-body">
              <div class="small text-body-secondary mb-2">
                Thread: <code>${UI.esc(result.thread_id)}</code> &middot;
                ${events.length} event(s), received in one response.
              </div>
              ${
                events.length
                  ? events
                      .map(
                        (item) => `
                    <details class="mb-1">
                      <summary class="small fw-semibold">${UI.esc(item.node)}</summary>
                      <pre class="small bg-body-tertiary p-2 rounded mt-1 mb-0 text-break">${UI.esc(
                        JSON.stringify(item.output, null, 2)
                      )}</pre>
                    </details>`
                      )
                      .join("")
                  : '<div class="small text-body-secondary">The agent returned no events.</div>'
              }
            </div>
          </div>`;
      } catch (error) {
        stepsResult.innerHTML = `<div class="alert alert-danger mt-2 small">${UI.esc(error.message)}</div>`;
      } finally {
        UI.setBusy(stepsButton, false);
      }
    });
  },
};
