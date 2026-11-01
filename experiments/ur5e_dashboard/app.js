"use strict";

const byId = (id) => document.getElementById(id);
let runs = [];
let selectedId = null;
let currentRun = null;
let activeFilter = "all";
let requestVersion = 0;

/** Escape recorded text before inserting it into an HTML fragment. */
function escapeText(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

/** Identify the documented controlled-rejection trial by its recorded metadata. */
function isControlledRejection(name, createdUtc) {
  return name === "stack" && createdUtc === "2026-10-31T23:28:47.042595+00:00";
}

/** Return a readable experiment name without changing unknown names. */
function experimentName(name, createdUtc) {
  if (isControlledRejection(name, createdUtc))
    return "Controlled rejection test";
  return (
    {
      stack_four: "Four-brick stack",
      stack: "Three-brick stack",
      baseplate: "Baseplate assembly",
      transfer: "Brick transfer",
    }[name] ?? String(name || "Unnamed experiment").replaceAll("_", " ")
  );
}

/** Format recorded simulation seconds as minutes and seconds. */
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

/** Format a finite measurement, preserving missing values as unavailable. */
function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

/** Describe a recording's actual end record, including unfinished runs. */
function describeStatus(status) {
  return (
    {
      completed: ["Completed", "completed"],
      stopped: ["Stopped", "other"],
      interrupted_or_failed: ["Interrupted / failed", "other"],
      incomplete: ["Incomplete", "other"],
      invalid: ["Invalid log", "invalid"],
    }[status] ?? [String(status || "Unknown"), "other"]
  );
}

/** Display a timestamp in the viewer's local time zone. */
function formatDate(timestamp) {
  if (!timestamp) return "Date unavailable";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/** Filter and render the list of discovered recordings. */
function renderRuns() {
  const term = byId("search").value.trim().toLowerCase();
  const filtered = runs.filter((run) => {
    const category = run.status === "completed" ? "completed" : "other";
    const matchesFilter = activeFilter === "all" || activeFilter === category;
    const text =
      `${experimentName(run.experiment, run.created_utc)} ${run.filename} ${run.status} ${isControlledRejection(run.experiment, run.created_utc) ? "intentional test" : ""}`.toLowerCase();
    return matchesFilter && text.includes(term);
  });
  byId("run-count").textContent = String(runs.length);
  const list = byId("run-list");
  list.replaceChildren();
  if (!filtered.length) {
    const message = document.createElement("p");
    message.className = "side-message";
    message.textContent = runs.length
      ? "No runs match this filter."
      : "No runs found.";
    list.append(message);
    return;
  }
  for (const run of filtered) {
    const [label, category] = describeStatus(run.status);
    const intentional = isControlledRejection(run.experiment, run.created_utc);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `run${run.id === selectedId ? " active" : ""}`;
    button.setAttribute(
      "aria-current",
      run.id === selectedId ? "true" : "false",
    );
    button.setAttribute(
      "aria-label",
      `${experimentName(run.experiment, run.created_utc)}, ${intentional ? "intentional test, " : ""}${describeStatus(run.status)[0]}, ${formatDate(run.created_utc)}`,
    );
    button.innerHTML = `<span class="run-top"><span class="run-title">${escapeText(experimentName(run.experiment, run.created_utc))}</span></span>
      <span class="run-date">${escapeText(formatDate(run.created_utc))}</span>
      <span class="run-status"><i class="run-dot ${escapeText(category)}"></i>${escapeText(label)} <span>·</span> ${escapeText(formatTime(run.duration_s))}</span>
      ${intentional ? '<span class="run-purpose">Intentional test</span>' : ""}`;
    button.addEventListener("click", () => selectRun(run.id));
    list.append(button);
  }
}

/** Draw the selected signal against recorded simulation time. */
function drawChart() {
  if (!currentRun) return;
  const data = currentRun.chart || [];
  const signal = byId("signal").value;
  const colors = [
    "#111111",
    "#333333",
    "#555555",
    "#222222",
    "#444444",
    "#555555",
  ];
  const patterns = [[], [9, 4], [2, 3], [10, 3, 2, 3], [5, 3, 1, 3], [1, 3]];
  let names;
  let values;
  let unit;
  if (
    ["joints", "joint_commands", "joint_velocities", "joint_efforts"].includes(
      signal,
    )
  ) {
    names = currentRun.metadata?.robot_joint_names || [];
    if (!names.length)
      names = [
        "Joint 1",
        "Joint 2",
        "Joint 3",
        "Joint 4",
        "Joint 5",
        "Joint 6",
      ];
    values = (sample) => sample[signal] || [];
    unit =
      signal === "joint_velocities"
        ? "rad/s"
        : signal === "joint_efforts"
          ? "N·m"
          : "rad";
  } else if (signal === "tool" || signal === "tool_target") {
    names = ["World X", "World Y", "World Z"];
    values = (sample) => sample[signal] || [];
    unit = "m";
  } else if (signal === "gripper" || signal === "gripper_target") {
    names = ["Gripper joint"];
    values = (sample) => [sample[signal]];
    unit = "rad";
  } else if (signal === "force") {
    names = ["Peak compression"];
    values = (sample) => [sample.force];
    unit = "N";
  } else {
    names = ["Required force"];
    values = (sample) => [sample.required_force];
    unit = "N";
  }
  byId("chart-legend").innerHTML = names
    .map(
      (name, index) =>
        `<span class="legend-item"><svg class="legend-swatch" viewBox="0 0 28 10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="${colors[index % colors.length]}" stroke-width="2" stroke-dasharray="${patterns[index % patterns.length].join(" ")}"/></svg>${escapeText(name.replaceAll("_joint", "").replaceAll("_", " "))}</span>`,
    )
    .join("");
  const note =
    signal === "force"
      ? "Peak compression in recorded contact debug data; gaps mean no contact debug reading. "
      : "";
  byId("chart-note").textContent =
    `${note}Displayed every ${currentRun.chart_stride || 1} sample(s); events use every sample.`;
  const series = data.map((sample) => ({ t: sample.t, y: values(sample) }));
  const finite = series.flatMap((point) => point.y.filter(Number.isFinite));
  const empty =
    !finite.length || !series.some((point) => Number.isFinite(point.t));
  byId("chart-empty").hidden = !empty;
  const canvas = byId("chart");
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(bounds.width, 100);
  const height = Math.max(bounds.height, 100);
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);
  if (empty) return;
  const left = 54,
    right = 12,
    top = 10,
    bottom = 26;
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = Math.max(1, height - top - bottom);
  const minTime = Math.min(
    ...series.map((point) => (Number.isFinite(point.t) ? point.t : Infinity)),
  );
  const maxTime = Math.max(
    ...series.map((point) => (Number.isFinite(point.t) ? point.t : -Infinity)),
  );
  let minValue = Math.min(...finite),
    maxValue = Math.max(...finite);
  const padding =
    maxValue === minValue
      ? Math.max(Math.abs(maxValue) * 0.1, 0.1)
      : (maxValue - minValue) * 0.08;
  minValue -= padding;
  maxValue += padding;
  context.font = "12px system-ui, sans-serif";
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (let i = 0; i <= 4; i += 1) {
    const y = top + (plotHeight * i) / 4;
    const value = maxValue - ((maxValue - minValue) * i) / 4;
    context.beginPath();
    context.strokeStyle = "#e3e3e3";
    context.lineWidth = 1;
    context.moveTo(left, y);
    context.lineTo(left + plotWidth, y);
    context.stroke();
    context.fillStyle = "#555555";
    context.fillText(`${value.toFixed(2)}`, left - 7, y);
  }
  context.textAlign = "center";
  context.textBaseline = "top";
  for (let i = 0; i <= 4; i += 1) {
    const x = left + (plotWidth * i) / 4;
    context.fillStyle = "#555555";
    context.fillText(
      (minTime + ((maxTime - minTime) * i) / 4).toFixed(0),
      x,
      height - 17,
    );
  }
  names.forEach((_, index) => {
    context.beginPath();
    context.strokeStyle = colors[index % colors.length];
    context.lineWidth = 1.8;
    context.setLineDash(patterns[index % patterns.length]);
    let drawing = false;
    for (const point of series) {
      const value = point.y[index];
      if (!Number.isFinite(point.t) || !Number.isFinite(value)) {
        drawing = false;
        continue;
      }
      const x =
        left +
        ((point.t - minTime) / Math.max(maxTime - minTime, 1)) * plotWidth;
      const y = top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
      if (drawing) context.lineTo(x, y);
      else context.moveTo(x, y);
      drawing = true;
    }
    context.stroke();
  });
  context.setLineDash([]);
  context.fillStyle = "#555555";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(unit, 3, 0);
}

/** Load the selected recording, ignoring responses superseded by another selection. */
async function selectRun(id) {
  selectedId = id;
  renderRuns();
  const version = ++requestVersion;
  try {
    const response = await fetch(`/api/run?id=${encodeURIComponent(id)}`);
    if (!response.ok)
      throw new Error(`Unable to load the run (${response.status}).`);
    const run = await response.json();
    if (version === requestVersion) {
      currentRun = run;
      byId("loading").hidden = true;
      byId("empty").hidden = true;
      byId("error").hidden = true;
      byId("content").hidden = false;
      const metadata = run.metadata || {};
      const [status, category] = describeStatus(run.status);
      const name = experimentName(metadata.experiment, metadata.created_utc);
      const intentional = isControlledRejection(
        metadata.experiment,
        metadata.created_utc,
      );
      byId("experiment-name").textContent = name;
      byId("breadcrumb-name").textContent = name.toUpperCase();
      byId("run-date").textContent = formatDate(metadata.created_utc);
      byId("run-date").title = metadata.created_utc || "";
      byId("run-file").textContent = run.filename;
      byId("status").textContent = status;
      byId("status").className = `status ${category}`;
      byId("scenario-badge").hidden = !intentional;
      byId("scenario-notice").hidden = !intentional;
      byId("metric-outcome").textContent = status;
      byId("metric-outcome-note").textContent =
        run.error ||
        (intentional
          ? "Expected: brick 2 is rejected"
          : run.status === "completed"
            ? "Script reported completion"
            : "See run details");
      const placements = run.placements || [];
      const connected = placements.filter((item) => item.connected).length;
      byId("metric-connections").textContent = placements.length
        ? `${connected} / ${placements.length}`
        : "—";
      byId("metric-duration").textContent = formatTime(run.duration_s);
      byId("metric-samples").textContent = Number(
        run.samples || 0,
      ).toLocaleString();
      byId("download").href = `/download?id=${encodeURIComponent(run.id)}`;
      const video = byId("video");
      video.pause();
      if (run.video) {
        if (run.poster)
          video.poster = `/poster?id=${encodeURIComponent(run.id)}`;
        else video.removeAttribute("poster");
        video.src = `/video?id=${encodeURIComponent(run.id)}`;
        video.hidden = false;
        byId("video-empty").hidden = true;
        byId("video-note").textContent = run.video_label;
      } else {
        video.removeAttribute("src");
        video.removeAttribute("poster");
        video.load();
        video.hidden = true;
        byId("video-empty").hidden = false;
        byId("video-note").textContent = "";
      }
      const container = byId("connections");
      container.replaceChildren();
      byId("connections-badge").textContent = placements.length
        ? `${connected} / ${placements.length} CONNECTED`
        : "NOT TRACKED";
      if (!placements.length) {
        container.innerHTML =
          '<p class="no-data">No assembly connections were recorded for this experiment.</p>';
      } else
        placements.forEach((placement, index) => {
          const event = (run.events || [])
            .filter(
              (item) => item.type === "connected" && item.brick === index + 1,
            )
            .at(-1);
          const error = event?.error_m;
          const xy =
            Array.isArray(error) &&
            Number.isFinite(error[0]) &&
            Number.isFinite(error[1])
              ? `${formatNumber(Math.hypot(error[0], error[1]) * 1000, 3)} mm`
              : "—";
          const z =
            Array.isArray(error) && Number.isFinite(error[2])
              ? `${formatNumber(error[2] * 1000, 3)} mm`
              : "—";
          const offset = Array.isArray(placement.connected_offset_studs)
            ? `(${placement.connected_offset_studs.join(", ")})`
            : "—";
          const state = placement.connected
            ? `Connected${event && Number.isFinite(event.time_s) ? ` · ${formatTime(event.time_s)}` : ""}`
            : "Not connected";
          const card = document.createElement("div");
          card.className = "connection";
          card.innerHTML = `<div class="connection-header"><span class="connection-name">Brick ${index + 1}</span><span class="connection-state${placement.connected ? "" : " no"}">${state}</span></div>
          <div class="connection-detail"><div><span>XY before</span><strong>${escapeText(xy)}</strong></div><div><span>Z before</span><strong>${escapeText(z)}</strong></div><div><span>Offset · studs</span><strong>${escapeText(offset)}</strong></div></div>`;
          container.append(card);
        });
      const timeline = byId("timeline");
      timeline.replaceChildren();
      byId("phase-count").textContent = `${(run.phases || []).length} PHASES`;
      for (const phase of run.phases || []) {
        const item = document.createElement("div");
        item.className = "timeline-item";
        item.innerHTML = `<span class="timeline-time">${escapeText(formatTime(phase.time_s))}</span><span class="timeline-marker"><i></i></span><span class="timeline-name">${escapeText(String(phase.phase).replaceAll("_", " "))}${phase.brick ? `<small>· Brick ${escapeText(phase.brick)}</small>` : ""}</span>`;
        timeline.append(item);
      }
      if (!timeline.childElementCount)
        timeline.innerHTML =
          '<p class="no-data">No phase changes were recorded.</p>';
      const assembly = run.assembly_settings || {};
      const breaks = run.breakage_settings || {};
      const settings = [
        [
          "Assembly checking",
          assembly.enabled == null
            ? "—"
            : assembly.enabled
              ? "Enabled"
              : "Disabled",
        ],
        [
          "Required force",
          Number.isFinite(assembly.required_force_n)
            ? `${formatNumber(assembly.required_force_n, 2)} N`
            : "—",
        ],
        [
          "Distance tolerance",
          Number.isFinite(assembly.distance_tolerance_m)
            ? `${formatNumber(assembly.distance_tolerance_m * 1000, 2)} mm`
            : "—",
        ],
        [
          "Position tolerance",
          Number.isFinite(assembly.position_tolerance_m)
            ? `${formatNumber(assembly.position_tolerance_m * 1000, 2)} mm`
            : "—",
        ],
        [
          "Yaw tolerance",
          Number.isFinite(assembly.yaw_tolerance_rad)
            ? `${formatNumber((assembly.yaw_tolerance_rad * 180) / Math.PI, 1)}°`
            : "—",
        ],
        [
          "Breakage checking",
          breaks.enabled == null
            ? "—"
            : breaks.enabled
              ? "Enabled"
              : "Disabled",
        ],
      ];
      byId("settings").innerHTML = settings
        .map(
          ([label, value]) =>
            `<div class="settings-row"><dt>${escapeText(label)}</dt><dd>${escapeText(value)}</dd></div>`,
        )
        .join("");
      byId("metadata").textContent = JSON.stringify(
        {
          metadata: run.metadata,
          assembly_settings_at_last_sample: assembly,
          breakage_settings_at_last_sample: breaks,
          connection_events: run.events,
        },
        null,
        2,
      );
      drawChart();
    }
  } catch (error) {
    if (version !== requestVersion) return;
    byId("content").hidden = true;
    byId("loading").hidden = true;
    byId("error").hidden = false;
    byId("error-message").textContent = error.message;
  }
}

/** Refresh the discovered recordings while preserving the selected run. */
async function loadRuns() {
  byId("refresh").disabled = true;
  byId("error").hidden = true;
  if (!currentRun) byId("loading").hidden = false;
  try {
    const response = await fetch("/api/runs", { cache: "no-store" });
    if (!response.ok)
      throw new Error(`Unable to read the run library (${response.status}).`);
    runs = await response.json();
    renderRuns();
    byId("loading").hidden = true;
    if (!runs.length) {
      currentRun = null;
      byId("content").hidden = true;
      byId("empty").hidden = false;
      return;
    }
    byId("empty").hidden = true;
    const next = runs.find((run) => run.id === selectedId) || runs[0];
    await selectRun(next.id);
  } catch (error) {
    byId("loading").hidden = true;
    byId("content").hidden = true;
    byId("empty").hidden = true;
    byId("error").hidden = false;
    byId("error-message").textContent = error.message;
  } finally {
    byId("refresh").disabled = false;
  }
}

byId("search").addEventListener("input", renderRuns);
for (const button of document.querySelectorAll(".filter")) {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    for (const item of document.querySelectorAll(".filter")) {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", item === button ? "true" : "false");
    }
    renderRuns();
  });
}
byId("signal").addEventListener("change", drawChart);
byId("refresh").addEventListener("click", loadRuns);
byId("retry").addEventListener("click", loadRuns);
new ResizeObserver(drawChart).observe(byId("chart").parentElement);
loadRuns();
