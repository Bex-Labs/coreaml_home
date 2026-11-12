const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".header nav");

function setMenu(open) {
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  navigation.classList.toggle("open", open);
  menuButton.querySelector(".lucide-menu").toggleAttribute("hidden", open);
  menuButton.querySelector(".lucide-x").toggleAttribute("hidden", !open);
}

menuButton.addEventListener("click", () => {
  setMenu(menuButton.getAttribute("aria-expanded") !== "true");
});
navigation.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

const tourTabs = document.querySelectorAll(".tour-tabs [role=tab]");
const tourPanel = document.querySelector("#product-screen");
const tourImage = tourPanel.querySelector("img");
const tourCaption = tourPanel.querySelector("p");

tourTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tourTabs.forEach((item) => {
      item.setAttribute("aria-selected", String(item === tab));
    });
    tourPanel.setAttribute("aria-labelledby", tab.id);
    tourImage.src = tab.dataset.image;
    tourImage.alt = tab.dataset.alt;
    tourCaption.textContent = tab.dataset.caption;
  });
});

const signals = document.querySelector("#signals");
const amount = document.querySelector("#amount");
const signalCount = document.querySelector("label[for=signals] strong");
const exposureTotal = document.querySelector(".calc-total strong");

function updateExposure() {
  signalCount.textContent = signals.value;
  exposureTotal.textContent =
    "₦" +
    (signals.valueAsNumber * Number(amount.value)).toLocaleString("en-NG");
}

signals.addEventListener("input", updateExposure);
amount.addEventListener("change", updateExposure);
updateExposure();

const demoForm = document.querySelector(".demo-form");
const fields = demoForm.querySelector("fieldset");
const submitButton = demoForm.querySelector("button[type=submit]");
const editButton = demoForm.querySelector(".edit-request");
const statusMessage = demoForm.querySelector(".form-status");
const buttonTemplates = {
  ready: document.querySelector("#submit-ready"),
  busy: document.querySelector("#submit-busy"),
  received: document.querySelector("#submit-received"),
  retry: document.querySelector("#submit-retry"),
};

let pendingRequest = null;
let busy = false;
let reference = "";

document
  .querySelector("[data-demo-topic]")
  .addEventListener("click", (event) => {
    demoForm.elements.topic.value = event.currentTarget.dataset.demoTopic;
  });

function updateForm(message) {
  fields.disabled = busy || Boolean(reference || pendingRequest);
  submitButton.disabled = busy || Boolean(reference);
  editButton.hidden = busy || !pendingRequest || Boolean(reference);

  const state = busy
    ? "busy"
    : reference
      ? "received"
      : pendingRequest
        ? "retry"
        : "ready";
  submitButton.replaceChildren(buttonTemplates[state].content.cloneNode(true));
  statusMessage.classList.toggle("success", Boolean(reference));
  statusMessage.textContent = message;
  if (reference) {
    const referenceLine = document.createElement("strong");
    referenceLine.textContent = "Reference: " + reference;
    statusMessage.append(document.createElement("br"), referenceLine);
  }
}

editButton.addEventListener("click", () => {
  pendingRequest = null;
  updateForm(
    "You can edit your details. A previous attempt may already have been received.",
  );
});

demoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || reference) return;

  if (!pendingRequest) {
    const formData = new FormData(demoForm);
    pendingRequest = {
      requestId: crypto.randomUUID(),
      name: formData.get("name"),
      email: formData.get("email"),
      institution: formData.get("institution"),
      role: formData.get("role"),
      country: formData.get("country"),
      topic: formData.get("topic"),
      notes: formData.get("notes"),
      consent: formData.get("consent") === "on",
      website: formData.get("website"),
    };
  }

  busy = true;
  updateForm("Submitting your request…");
  let message;
  try {
    const response = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingRequest),
      signal: AbortSignal.timeout(15000),
    });

    if (
      response.status === 404 ||
      response.status === 405 ||
      response.status === 501
    ) {
      pendingRequest = null;
      throw new Error("Demo requests are unavailable on this server.");
    }

    const result = await response.json();
    if (!response.ok) {
      if (response.status < 500) pendingRequest = null;
      throw new Error(
        result.error || "We could not confirm your request. Please retry.",
      );
    }

    if (typeof result.reference !== "string" || !result.reference) {
      throw new Error(
        "We could not confirm your request. Retry to confirm the same submission.",
      );
    }

    reference = result.reference;
    message = "Your demo request has been received.";
    demoForm.reset();
  } catch (error) {
    message =
      error instanceof Error
        ? error.message
        : "We could not confirm your request. Retry to confirm the same submission.";
  } finally {
    busy = false;
    updateForm(message);
  }
});

document.querySelector("[data-current-year]").textContent =
  new Date().getFullYear();
