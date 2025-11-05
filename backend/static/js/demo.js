const state = {
  connectionId: null,
  tables: [],
};

function parseOptions(raw) {
  if (!raw) return undefined;
  const options = {};
  const lines = raw.split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const [key, ...rest] = trimmed.split("=");
    if (!key || rest.length === 0) return;
    options[key.trim()] = rest.join("=").trim();
  });
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
    value.textContent = anomaly.value != null ? anomaly.value.toFixed(2) : "-";
    const severity = document.createElement("td");
    const badge = document.createElement("span");
    badge.classList.add("badge", anomaly.severity || "medium");
    badge.textContent = anomaly.severity || "medium";
    severity.appendChild(badge);
    const score = document.createElement("td");
    const z = anomaly.z_score;
    const alt = anomaly.score;
    if (typeof z === "number") {
      score.textContent = z.toFixed(2);
    } else if (typeof alt === "number") {
      score.textContent = alt.toFixed(3);
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
    predictionCell.textContent = point.prediction != null ? point.prediction.toFixed(2) : "-";
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

function enableDemoScroll() {
  const launchButton = document.getElementById("launch-demo");
  const scrollButtons = document.querySelectorAll("[data-scroll]");
  const scrollToTarget = (target) => {
    if (!target) return;
    const section = document.querySelector(target);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };
  if (launchButton) {
    launchButton.addEventListener("click", (event) => {
      event.preventDefault();
      scrollToTarget("#demo");
    });
  }
  scrollButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const selector = button.getAttribute("data-scroll");
      if (selector) {
        event.preventDefault();
        scrollToTarget(selector);
      }
    });
  });
}

function hookForms() {
  const connectForm = document.getElementById("connect-form");
  const connectStatus = document.getElementById("connect-status");
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

  if (connectForm) {
    connectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus(connectStatus, "Validating credentials…");

      const formData = new FormData(connectForm);
      const payload = {
        host: formData.get("host")?.trim(),
        port: Number(formData.get("port")) || 3306,
        username: formData.get("username")?.trim(),
        password: formData.get("password") || "",
        database: formData.get("database")?.trim(),
        driver: formData.get("driver") || "mysql+pymysql",
        ssl: formData.get("ssl") === "on",
        engine_url: formData.get("engine_url")?.trim() || undefined,
        options: parseOptions(formData.get("options")),
      };

      try {
        const data = await fetchJson("/api/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        state.connectionId = data.connection_id;
        setStatus(connectStatus, "Connection saved. Tables loading…", "success");
        await loadTables(tableSelect, featureSelect, targetSelect, dateSelect, tableStep, analysisStatus);
      } catch (error) {
        console.error(error);
        setStatus(connectStatus, error.message || "Unable to connect", "error");
        state.connectionId = null;
        toggleStep(tableStep, false);
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
    const hasTables = state.tables.length > 0;
    if (!hasTables) {
      setStatus(document.getElementById("connect-status"), "Connection succeeded but no tables were returned.", "error");
      toggleStep(tableStep, false);
      return;
    }
    populateSelect(tableSelect, state.tables.map((item) => item.name), { emptyLabel: "Select a table" });
    populateMultiSelect(featureSelect, []);
    populateSelect(targetSelect, [], { emptyLabel: "Choose a target" });
    populateSelect(dateSelect, [""], { emptyLabel: "None" });
    toggleStep(tableStep, true);
    if (analysisStatus) {
      setStatus(analysisStatus, "Choose a table and configure your analysis.");
    }
  } catch (error) {
    console.error(error);
    setStatus(document.getElementById("connect-status"), error.message || "Unable to fetch tables.", "error");
    toggleStep(tableStep, false);
  }
}

(function init() {
  document.addEventListener("DOMContentLoaded", () => {
    hookForms();
  });
})();
