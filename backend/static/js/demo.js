const state = {
  user: null,
  connectionId: null,
  tables: [],
  watchlist: false,
};

const liveBuffer = [];
const liveAlerts = [];
let liveSource = null;

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

function normaliseDateString(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toISOString();
}

function parseOptions(raw) {
  if (!raw) return undefined;
  const options = {};
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length > 0) {
        options[key.trim()] = rest.join("=").trim();
      }
    });
  return Object.keys(options).length ? options : undefined;
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
  const records = steps && steps.length ? steps : ["No cleaning steps recorded."];
  records.forEach((step) => {
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

function updateKpis(metrics, { kpiRows, kpiAnomalies, kpiHorizon }) {
  if (!kpiRows || !kpiAnomalies || !kpiHorizon) return;
  if (!metrics) {
    kpiRows.textContent = "-";
    kpiAnomalies.textContent = "-";
    kpiHorizon.textContent = "-";
    return;
  }
  kpiRows.textContent = metrics.rows_processed?.toLocaleString() ?? "-";
  kpiAnomalies.textContent = metrics.anomalies_detected?.toLocaleString() ?? "-";
  const horizon = metrics.forecast_horizon ?? 0;
  kpiHorizon.textContent = horizon ? `${horizon} step${horizon > 1 ? "s" : ""}` : "-";
}

function setLiveIndicator(element, online) {
  if (!element) return;
  element.textContent = online ? "● Live" : "● Offline";
  element.classList.toggle("offline", !online);
}

function updateAlertFeed(payload, { alertList, alertHint }) {
  if (!alertList || !alertHint) return;
  if (!payload) {
    liveAlerts.length = 0;
    alertList.innerHTML = "";
    alertHint.textContent = "Awaiting anomalies…";
    return;
  }
  alertHint.textContent = "Latest anomaly events";
  liveAlerts.unshift(payload);
  if (liveAlerts.length > 12) {
    liveAlerts.pop();
  }
  alertList.innerHTML = "";
  liveAlerts.forEach((item) => {
    const li = document.createElement("li");
    li.className = `alert-item ${item.severity || "medium"}`;
    const severity = document.createElement("span");
    severity.textContent = `${item.severity || "medium"} anomaly`;
    const timestamp = document.createElement("div");
    timestamp.textContent = item.timestamp;
    const value = document.createElement("div");
    value.textContent = `Value: ${Number(item.value).toFixed(2)}`;
    li.append(severity, timestamp, value);
    alertList.appendChild(li);
  });
}

function prepareCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth * ratio;
  const height = (canvas.clientHeight || 280) * ratio;
  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return {
    ctx,
    width: canvas.clientWidth,
    height: canvas.clientHeight || 280,
  };
}

function drawAxes(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, height - 30);
  ctx.lineTo(width - 15, height - 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(40, height - 30);
  ctx.lineTo(40, 20);
  ctx.stroke();
  ctx.restore();
}

function toChartPoints(series, width, height) {
  if (!series || series.length === 0) return [];
  const values = series.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const plotWidth = width - 60;
  const plotHeight = height - 60;
  return series.map((point, index) => {
    const x = 40 + (plotWidth * index) / Math.max(series.length - 1, 1);
    const normalized = (point.value - minValue) / range;
    const y = height - 30 - normalized * plotHeight;
    return { x, y };
  });
}

function drawLine(ctx, points, color, options = {}) {
  if (!points.length) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = options.lineWidth || 2;
  ctx.setLineDash(options.dash || []);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPoints(ctx, points, options = {}) {
  if (!points.length) return;
  ctx.save();
  ctx.fillStyle = options.fillStyle || "#ef4444";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = options.lineWidth || 2;
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, options.radius || 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawAnomalyTimeline(canvas, historical, anomalies) {
  const recentHistorical = historical.slice(-60);
  const { ctx, width, height } = prepareCanvas(canvas);
  drawAxes(ctx, width, height);
  if (!recentHistorical.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Inter, sans-serif";
    ctx.fillText("Run an analysis to see anomaly timeline.", 50, height / 2);
    return;
  }
  const normalised = recentHistorical.map((entry) => ({
    date: normaliseDateString(entry.date),
    value: entry.value,
  }));
  const points = toChartPoints(normalised, width, height);
  drawLine(ctx, points, "#6366f1");
  if (anomalies && anomalies.length) {
    const map = new Map(anomalies.map((item) => [normaliseDateString(item.timestamp), item]));
    const anomalyPoints = normalised
      .map((entry, idx) => {
        const hit = map.get(entry.date);
        if (!hit) return null;
        return {
          x: points[idx].x,
          y: points[idx].y,
          severity: hit.severity || "medium",
        };
      })
      .filter(Boolean);
    anomalyPoints.forEach((point) => {
      ctx.beginPath();
      ctx.fillStyle = point.severity === "high" ? "rgba(239, 68, 68, 0.9)" : "rgba(245, 158, 11, 0.9)";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }
}

function drawForecastChart(canvas, historical, forecast) {
  const tail = historical.slice(-30);
  const { ctx, width, height } = prepareCanvas(canvas);
  drawAxes(ctx, width, height);
  if (!tail.length && !forecast.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Inter, sans-serif";
    ctx.fillText("Run an analysis to see forecasts.", 50, height / 2);
    return;
  }
  const historicalPoints = toChartPoints(
    tail.map((entry) => ({ date: normaliseDateString(entry.date), value: entry.value })),
    width,
    height
  );
  drawLine(ctx, historicalPoints, "#0ea5e9");
  if (forecast.length) {
    const forecastSeries = tail.slice(-1).map((entry) => ({
      date: normaliseDateString(entry.date),
      value: entry.value,
    }));
    forecast.forEach((point) => {
      forecastSeries.push({ date: normaliseDateString(point.date), value: point.prediction });
    });
    const forecastPoints = toChartPoints(forecastSeries, width, height);
    drawLine(ctx, forecastPoints, "#22c55e", { dash: [6, 4] });
    const futurePoints = forecastPoints.slice(1);
    drawPoints(ctx, futurePoints, { radius: 4, fillStyle: "#22c55e" });
  }
}

function drawLiveChart(series) {
  const canvas = document.getElementById("live-chart");
  if (!canvas) return;
  const { ctx, width, height } = prepareCanvas(canvas);
  drawAxes(ctx, width, height);
  if (!series.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Inter, sans-serif";
    ctx.fillText("Waiting for live data…", 50, height / 2);
    return;
  }
  const normalised = series.map((entry) => ({
    date: normaliseDateString(entry.date),
    value: entry.value,
  }));
  const points = toChartPoints(normalised, width, height);
  drawLine(ctx, points, "#2563eb");
  const lastPoint = points[points.length - 1];
  drawPoints(ctx, [lastPoint], { radius: 4, fillStyle: "#2563eb" });
}

function renderCharts(historical, anomalies, forecast) {
  drawAnomalyTimeline(document.getElementById("anomaly-chart"), historical, anomalies);
  drawForecastChart(document.getElementById("forecast-chart"), historical, forecast);
}

function ensureLiveStream({ liveIndicator, alertList, alertHint }) {
  if (liveSource) return;
  liveSource = new EventSource("/api/stream/live");
  liveSource.onopen = () => setLiveIndicator(liveIndicator, true);
  liveSource.onerror = () => setLiveIndicator(liveIndicator, false);
  liveSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      liveBuffer.push({ date: payload.timestamp, value: payload.value });
      if (liveBuffer.length > 180) {
        liveBuffer.shift();
      }
      drawLiveChart(liveBuffer);
      if (payload.is_anomaly) {
        updateAlertFeed(payload, { alertList, alertHint });
        if (state.watchlist) {
          setStatus(
            document.getElementById("watch-status"),
            `Anomaly detected at ${payload.timestamp}. Alert queued for delivery.`,
            "success"
          );
        }
      }
    } catch (error) {
      console.error("Unable to parse stream payload", error);
    }
  };
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
  const watchButton = document.getElementById("watch-button");
  const notifyButton = document.getElementById("notify-button");
  const watchStatus = document.getElementById("watch-status");
  const liveIndicator = document.getElementById("live-indicator");
  const alertHint = document.getElementById("alert-hint");
  const alertList = document.getElementById("alert-list");

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
  const kpiRows = document.getElementById("kpi-rows");
  const kpiAnomalies = document.getElementById("kpi-anomalies");
  const kpiHorizon = document.getElementById("kpi-horizon");

  const toggleAuthMode = (mode) => {
    const isSignup = mode === "signup";
    if (authForm) {
      authForm.dataset.mode = mode;
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
    if (showSignup && showSignin) {
      showSignup.setAttribute("aria-pressed", isSignup ? "true" : "false");
      showSignin.setAttribute("aria-pressed", isSignup ? "false" : "true");
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
      ensureLiveStream({ liveIndicator, alertList, alertHint });
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
      state.watchlist = false;
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
      updateKpis(null, { kpiRows, kpiAnomalies, kpiHorizon });
      updateAlertFeed(null, { alertList, alertHint });
      if (watchButton) {
        watchButton.textContent = "Watch this dataset";
        watchButton.classList.remove("watching");
      }
      if (notifyButton) {
        notifyButton.disabled = true;
      }
      setStatus(watchStatus, "");
    });
  }

  if (watchButton && notifyButton) {
    watchButton.addEventListener("click", () => {
      if (!state.connectionId) {
        setStatus(watchStatus, "Connect and analyse data first.", "error");
        return;
      }
      state.watchlist = !state.watchlist;
      if (state.watchlist) {
        watchButton.textContent = "Watching";
        watchButton.classList.add("watching");
        notifyButton.disabled = false;
        setStatus(watchStatus, "Monitoring enabled. You’ll receive anomaly alerts.", "success");
      } else {
        watchButton.textContent = "Watch this dataset";
        watchButton.classList.remove("watching");
        notifyButton.disabled = true;
        setStatus(watchStatus, "Alerts paused for this dataset.");
      }
    });

    notifyButton.addEventListener("click", () => {
      if (notifyButton.disabled) return;
      setStatus(watchStatus, "Notification preferences saved for this session.", "success");
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
        await loadTables(tableSelect, featureSelect, targetSelect, dateSelect, tableStep, analysisStatus);
      } catch (error) {
        console.error(error);
        setStatus(connectStatus, error.message || "Unable to connect", "error");
        state.connectionId = null;
        toggleStep(tableStep, false);
        toggleStep(resultStep, false);
        updateKpis(null, { kpiRows, kpiAnomalies, kpiHorizon });
        renderCharts([], [], []);
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
        updateKpis(data.metrics, { kpiRows, kpiAnomalies, kpiHorizon });
        renderCharts(data.historical, data.anomalies, data.forecast);
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
      setStatus(document.getElementById("connect-status"), "Connection succeeded but no tables were returned.", "error");
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
    setStatus(document.getElementById("connect-status"), error.message || "Unable to fetch tables.", "error");
    toggleStep(tableStep, false);
    toggleStep(document.getElementById("result-step"), false);
  }
}

(function init() {
  document.addEventListener("DOMContentLoaded", () => {
    hookForms();
    // kick off live stream for demo visitors who skip auth toggle
    const liveIndicator = document.getElementById("live-indicator");
    const alertHint = document.getElementById("alert-hint");
    const alertList = document.getElementById("alert-list");
    if (liveIndicator && alertHint && alertList) {
      ensureLiveStream({ liveIndicator, alertList, alertHint });
    }
  });
})();
