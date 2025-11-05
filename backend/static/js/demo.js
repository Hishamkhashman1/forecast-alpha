const state = {
  user: null,
  connectionId: null,
  tables: [],
};

function parseOptions(raw) {
  if (!raw) return undefined;
  const options = {};
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key || rest.length === 0) continue;
    options[key.trim()] = rest.join("=").trim();
  }
  return Object.keys(options).length ? options : undefined;
}

function setStatus(element, message, variant = "info") {
  if (!element) return;
  element.textContent = message || "";
  element.classList.remove("success", "error");
  if (variant === "success") {
    element.classList.add("success");
  } else if (variant === "error") {
    element.classList.add("error");
  }
}

function toggleStep(stepElement, enabled) {
  if (!stepElement) return;
  stepElement.classList.toggle("disabled", !enabled);
}

function populateSelect(selectElement, values, { emptyLabel = "Select" } = {}) {
  if (!selectElement) return;
  selectElement.innerHTML = "";
  if (emptyLabel !== null) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyLabel;
    selectElement.appendChild(option);
  }
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
}

function populateMultiSelect(selectElement, values) {
  if (!selectElement) return;
  selectElement.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
}

function renderPipelineSteps(listElement, steps) {
  if (!listElement) return;
  listElement.innerHTML = "";
  if (!steps || steps.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No cleaning steps recorded.";
    listElement.appendChild(li);
    return;
  }
  steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    listElement.appendChild(li);
  });
}

function renderAnomalies(tableElement, emptyElement, anomalies) {
  if (!tableElement || !emptyElement) return;
  const body = tableElement.querySelector("tbody");
  if (!body) return;
  body.innerHTML = "";

  if (!anomalies || anomalies.length === 0) {
    tableElement.classList.add("hidden");
    emptyElement.classList.remove("hidden");
    return;
  }

  anomalies.forEach((anomaly) => {
    const row = document.createElement("tr");
    const timestamp = document.createElement("td");
    timestamp.textContent = anomaly.timestamp;
    const value = document.createElement("td");
    value.textContent = anomaly.value != null ? Number(anomaly.value).toFixed(2) : "-";
    const severity = document.createElement("td");
    const badge = document.createElement("span");
    badge.classList.add("badge", anomaly.severity || "medium");
    badge.textContent = anomaly.severity || "medium";
    severity.appendChild(badge);
    const score = document.createElement("td");
    if (typeof anomaly.z_score === "number") {
      score.textContent = anomaly.z_score.toFixed(2);
    } else if (typeof anomaly.score === "number") {
      score.textContent = anomaly.score.toFixed(3);
    } else {
      score.textContent = "-";
    }
    row.append(timestamp, value, severity, score);
    body.appendChild(row);
  });

  emptyElement.classList.add("hidden");
  tableElement.classList.remove("hidden");
}

function renderForecast(tableElement, emptyElement, forecast) {
  if (!tableElement || !emptyElement) return;
  const body = tableElement.querySelector("tbody");
  if (!body) return;
  body.innerHTML = "";

  if (!forecast || forecast.length === 0) {
    tableElement.classList.add("hidden");
    emptyElement.classList.remove("hidden");
    return;
  }

  forecast.forEach((point) => {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    dateCell.textContent = point.date;
    const predictionCell = document.createElement("td");
    predictionCell.textContent = point.prediction != null ? Number(point.prediction).toFixed(2) : "-";
    row.append(dateCell, predictionCell);
    body.appendChild(row);
  });

  emptyElement.classList.add("hidden");
  tableElement.classList.remove("hidden");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok || data.status === "error") {
    const message = data.message || response.statusText || "Request failed";
    const detail = data.detail ? `: ${data.detail}` : "";
    throw new Error(`${message}${detail}`);
  }
  return data;
}

function hookForms() {
  const authSection = document.getElementById("auth-section");
  const portalSection = document.getElementById("portal-section");
  const welcomeCopy = document.getElementById("welcome-copy");
  const resetButton = document.getElementById("reset-demo");
  const authForm = document.getElementById("auth-form");
  const authStatus = document.getElementById("auth-status");
  const showSignup = document.getElementById("show-signup");
  const showSignin = document.getElementById("show-signin");

  const connectForm = document.getElementById("connect-form");
  const connectStatus = document.getElementById("connect-status");
  const connectStep = document.getElementById("connect-step");
  const tableStep = document.getElementById("table-step");
  const analysisForm = document.getElementById("analysis-setup-form");
  const analysisStatus = document.getElementById("analysis-status");
  const tableSelect = document.getElementById("table-select");
  const featureSelect = document.getElementById("feature-select");
  const targetSelect = document.getElementById("target-select");
  const dateSelect = document.getElementById("date-select");
  const resultStep = document.getElementById("result-step");
  const anomaliesTable = document.getElementById("anomalies-table");
  const anomaliesEmpty = document.getElementById("anomalies-empty");
  const forecastTable = document.getElementById("forecast-table");
  const forecastEmpty = document.getElementById("forecast-empty");
  const pipelineList = document.getElementById("pipeline-steps");
  const analyzeButton = document.getElementById("analyze-button");

  const toggleAuthMode = (mode) => {
    const isSignup = mode === "signup";
    if (authForm) {
      authForm.dataset.mode = mode;
    }
    if (showSignup && showSignin) {
      showSignup.setAttribute("aria-pressed", isSignup ? "true" : "false");
      showSignin.setAttribute("aria-pressed", isSignup ? "false" : "true");
    }
    if (authForm) {
      authForm.querySelectorAll("[data-signup-only]").forEach((el) => {
        el.classList.toggle("hidden", !isSignup);
        const input = el.querySelector("input");
        if (input) {
          input.required = isSignup;
          if (!isSignup) {
            if (input.type === "checkbox") {
              input.checked = false;
            } else {
              input.value = "";
            }
          }
        }
      });
      const submit = document.getElementById("auth-submit");
      if (submit) {
        submit.textContent = isSignup ? "Create account" : "Sign in";
      }
    }
  };

  if (showSignup && showSignin) {
    showSignup.addEventListener("click", () => toggleAuthMode("signup"));
    showSignin.addEventListener("click", () => toggleAuthMode("signin"));
  }

  if (authForm) {
    authForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(authForm);
      const mode = authForm.dataset.mode || "signup";
      const email = formData.get("email")?.toString().trim();
      const password = formData.get("password")?.toString();
      const name = mode === "signup" ? formData.get("name")?.toString().trim() : undefined;

      const emailPattern = /[^@\s]+@[^@\s]+\.[^@\s]+/;
      if (!email || !emailPattern.test(email)) {
        setStatus(authStatus, "Enter a valid email address.", "error");
        return;
      }

      if (!password || password.length < 6) {
        setStatus(authStatus, "Password must be at least 6 characters.", "error");
        return;
      }

      if (mode === "signup") {
        const consent = document.getElementById("auth-consent");
        if (consent && !consent.checked) {
          setStatus(authStatus, "Please accept the terms to continue.", "error");
          return;
        }
        if (!name) {
          setStatus(authStatus, "Tell us your name so we can personalise the demo.", "error");
          return;
        }
      }

      state.user = {
        name: name || email.split("@")[0],
        email,
        mode,
      };
      setStatus(authStatus, mode === "signup" ? "Account created for this session." : "Signed in for demo.", "success");
      if (welcomeCopy) {
        welcomeCopy.textContent = `Welcome, ${state.user.name}! Let’s connect to your data and surface insights.`;
      }
      if (authSection && portalSection) {
        authSection.classList.add("hidden");
        portalSection.classList.remove("hidden");
      }
      toggleStep(connectStep, true);
      toggleStep(tableStep, false);
      toggleStep(resultStep, false);
      setStatus(connectStatus, "Ready when you are—enter your database credentials.");
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      state.user = null;
      state.connectionId = null;
      state.tables = [];
      if (authForm) {
        authForm.reset();
        toggleAuthMode("signup");
      }
      setStatus(authStatus, "", "info");
      if (authSection && portalSection) {
        authSection.classList.remove("hidden");
        portalSection.classList.add("hidden");
      }
      toggleStep(connectStep, false);
      toggleStep(tableStep, false);
      toggleStep(resultStep, false);
      setStatus(connectStatus, "");
      setStatus(analysisStatus, "");
      renderPipelineSteps(pipelineList, []);
      renderAnomalies(anomaliesTable, anomaliesEmpty, []);
      renderForecast(forecastTable, forecastEmpty, []);
    });
  }

  if (connectForm) {
    connectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.user) {
        setStatus(connectStatus, "Please sign up or sign in to continue.", "error");
        toggleStep(connectStep, false);
        return;
      }

      setStatus(connectStatus, "Validating credentials…");

      const formData = new FormData(connectForm);
      const payload = {
        host: formData.get("host")?.toString().trim(),
        port: Number(formData.get("port")) || 3306,
        username: formData.get("username")?.toString().trim(),
        password: formData.get("password")?.toString() || "",
        database: formData.get("database")?.toString().trim(),
        driver: formData.get("driver")?.toString() || "mysql+pymysql",
        ssl: formData.get("ssl") === "on",
        engine_url: formData.get("engine_url")?.toString().trim() || undefined,
        options: parseOptions(formData.get("options")?.toString() || ""),
      };

      try {
        const data = await fetchJson("/api/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        state.connectionId = data.connection_id;
        setStatus(connectStatus, "Connection saved. Tables loading…", "success");
        await loadTables(
          tableSelect,
          featureSelect,
          targetSelect,
          dateSelect,
          tableStep,
          analysisStatus
        );
      } catch (error) {
        console.error(error);
        setStatus(connectStatus, error.message || "Unable to connect", "error");
        state.connectionId = null;
        toggleStep(tableStep, false);
        toggleStep(resultStep, false);
      }
    });
  }

  if (tableSelect) {
    tableSelect.addEventListener("change", () => {
      const selected = tableSelect.value;
      const table = state.tables.find((item) => item.name === selected);
      if (!table) {
        populateMultiSelect(featureSelect, []);
        populateSelect(targetSelect, [], { emptyLabel: "Choose a target" });
        populateSelect(dateSelect, [""], { emptyLabel: "None" });
        return;
      }
      populateMultiSelect(featureSelect, table.columns);
      populateSelect(targetSelect, table.columns, { emptyLabel: "Choose a target" });
      populateSelect(dateSelect, [""].concat(table.columns), { emptyLabel: "None" });
    });
  }

  if (analysisForm) {
    analysisForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.connectionId) {
        setStatus(analysisStatus, "Connect to a database first.", "error");
        return;
      }

      const selectedFeatures = Array.from(featureSelect.selectedOptions).map((option) => option.value);
      const payload = {
        connection_id: state.connectionId,
        table: tableSelect.value,
        feature_columns: selectedFeatures,
        target_column: targetSelect.value,
        date_column: dateSelect.value || null,
        anomaly_method: document.getElementById("anomaly-method").value,
        anomaly_threshold: Number(document.getElementById("anomaly-threshold").value) || 3.0,
        forecast_method: document.getElementById("forecast-method").value,
        forecast_periods: Number(document.getElementById("forecast-periods").value) || 3,
        limit: Number(document.getElementById("row-limit").value) || 10000,
        max_rows: Number(document.getElementById("max-rows").value) || 50000,
      };

      if (!payload.table || selectedFeatures.length === 0 || !payload.target_column) {
        setStatus(analysisStatus, "Select a table, feature columns, and target column.", "error");
        return;
      }

      if (analyzeButton) {
        analyzeButton.disabled = true;
        analyzeButton.textContent = "Running…";
      }
      setStatus(analysisStatus, "Processing analysis…");

      try {
        const data = await fetchJson("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        renderPipelineSteps(pipelineList, data.pipeline_steps);
        renderAnomalies(anomaliesTable, anomaliesEmpty, data.anomalies);
        renderForecast(forecastTable, forecastEmpty, data.forecast);
        toggleStep(resultStep, true);
        setStatus(analysisStatus, "Analysis complete.", "success");
      } catch (error) {
        console.error(error);
        setStatus(analysisStatus, error.message || "Unable to analyse dataset.", "error");
      } finally {
        if (analyzeButton) {
          analyzeButton.disabled = false;
          analyzeButton.textContent = "Run analysis";
        }
      }
    });
  }
}

async function loadTables(tableSelect, featureSelect, targetSelect, dateSelect, tableStep, analysisStatus) {
  if (!state.connectionId) return;
  try {
    const data = await fetchJson(`/api/tables?connection_id=${encodeURIComponent(state.connectionId)}`);
    state.tables = data.tables || [];
    if (state.tables.length === 0) {
      setStatus(
        document.getElementById("connect-status"),
        "Connection succeeded but no tables were returned.",
        "error"
      );
      toggleStep(tableStep, false);
      toggleStep(document.getElementById("result-step"), false);
      return;
    }
    populateSelect(tableSelect, state.tables.map((item) => item.name), { emptyLabel: "Select a table" });
    populateMultiSelect(featureSelect, []);
    populateSelect(targetSelect, [], { emptyLabel: "Choose a target" });
    populateSelect(dateSelect, [""], { emptyLabel: "None" });
    toggleStep(tableStep, true);
    setStatus(analysisStatus, "Choose a table and configure your analysis.");
  } catch (error) {
    console.error(error);
    setStatus(
      document.getElementById("connect-status"),
      error.message || "Unable to fetch tables.",
      "error"
    );
    toggleStep(tableStep, false);
    toggleStep(document.getElementById("result-step"), false);
  }
}

(function init() {
  document.addEventListener("DOMContentLoaded", () => {
    hookForms();
  });
})();
