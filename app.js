const STORAGE_KEY = "goal_manager_template_v2";
const LEGACY_STORAGE_KEY = "goal_manager_template_v1";
const ACTIVE_TAB_KEY = `${STORAGE_KEY}_active_tab`;
const TOAST_DURATION_MS = 2200;

const STATUS_COLUMNS = [
  { key: "not_started", label: "Not Started" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" }
];

const PRIORITY_OPTIONS = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" }
];

const tabConfig = [
  { id: "intro", label: "Mission Control" },
  { id: "main-1", label: "Main Goal" },
  { id: "secondary", label: "Secondary Goals" },
  { id: "notes", label: "Logs & Evidence" }
];

const setupScreen = document.getElementById("setupScreen");
const setupForm = document.getElementById("setupForm");
const appShell = document.getElementById("appShell");
const importFileInput = document.getElementById("importFileInput");

let state = loadState();
let activeTab = loadActiveTab();
let activeSecondaryIndex = 0;
let activeTaskContext = null;
let activeEvidenceContext = null;

init();

function init() {
  ensureToastHost();
  ensureTaskContextMenu();
  ensureEvidenceLightbox();
  bindSetupForm();
  bindHeaderActions();
  bindGlobalUiDismissals();

  if (!state) {
    showSetup();
    return;
  }

  showApp();
  renderHeader();
  renderTabs();
  activateTab(activeTab, { save: false });
  renderAll();
}

function bindSetupForm() {
  if (!setupForm || setupForm.dataset.bound === "true") return;
  setupForm.dataset.bound = "true";

  setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const plan = buildStateFromForm();

    if (!plan) {
      showToast("Please complete all required fields", "warning");
      return;
    }

    state = plan;
    activeTab = tabConfig[0].id;
    saveState();
    saveActiveTab(activeTab);
    init();
    showToast("Flight deck created", "success");
  });
}

function bindHeaderActions() {
  const resetBtn = document.getElementById("resetBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const setupImportBtn = document.getElementById("setupImportBtn");

  if (resetBtn && resetBtn.dataset.bound !== "true") {
    resetBtn.dataset.bound = "true";
    resetBtn.onclick = () => {
      if (!confirm("This will clear the tracker and return to the blank setup form. Continue?")) return;

      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_TAB_KEY);
      state = null;
      activeTab = tabConfig[0].id;
      if (setupForm) setupForm.reset();
      showSetup();
      showToast("Tracker cleared", "success");
    };
  }

  if (exportBtn && exportBtn.dataset.bound !== "true") {
    exportBtn.dataset.bound = "true";
    exportBtn.onclick = exportState;
  }

  if (importBtn && importFileInput && importBtn.dataset.bound !== "true") {
    importBtn.dataset.bound = "true";
    importBtn.onclick = () => importFileInput.click();
    importFileInput.onchange = importState;
  }

  if (setupImportBtn && importFileInput && setupImportBtn.dataset.bound !== "true") {
    setupImportBtn.dataset.bound = "true";
    setupImportBtn.onclick = () => importFileInput.click();
    importFileInput.onchange = importState;
  }
}

function buildStateFromForm() {
  const name = valueOf("nameInput");
  const role = valueOf("roleInput");
  const schedule = valueOf("scheduleInput");
  const overview = valueOf("overviewInput");
  const theme = valueOf("themeInput");
  const northStar = valueOf("northStarInput");
  const q1 = valueOf("q1Input");
  const midYear = valueOf("midYearInput");
  const q3 = valueOf("q3Input");
  const q4 = valueOf("q4Input");
  const mainGoalTitle = valueOf("mainGoalTitleInput");
  const mainGoalObjective = valueOf("mainGoalObjectiveInput");
  const secondaryGoalTitle = valueOf("secondaryGoalTitleInput");
  const secondaryGoalObjective = valueOf("secondaryGoalObjectiveInput");

  const required = [
    name,
    role,
    overview,
    theme,
    northStar,
    q1,
    midYear,
    q3,
    q4,
    mainGoalTitle,
    mainGoalObjective,
    secondaryGoalTitle,
    secondaryGoalObjective
  ];

  if (required.some((entry) => !entry)) return null;

  return {
    version: 2,
    meta: {
      name,
      role,
      schedule,
      theme,
      northStar,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    intro: { overview },
    timeline: { q1, midYear, q3, q4 },
    mainGoals: [createGoal({ id: "mg1", title: mainGoalTitle, objective: mainGoalObjective })],
    secondaryGoals: [createGoal({ id: "sg1", title: secondaryGoalTitle, objective: secondaryGoalObjective })],
    notes: "",
    noteEvidence: []
  };
}

function createGoal({ id, title, objective }) {
  return {
    id,
    title,
    objective,
    actionItems: [],
    evidence: []
  };
}

function valueOf(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function showSetup() {
  setupScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
}

function showApp() {
  setupScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
}

function renderAll() {
  renderIntro();
  renderMainGoal();
  renderSecondary();
  renderNotes();
}

function renderHeader() {
  const title = document.getElementById("planTitle");
  const subtitle = document.getElementById("planSubtitle");
  if (!title || !subtitle || !state) return;

  title.textContent = `${state.meta.name}'s Goal Flight Deck`;
  const metaLine = [
    state.meta.role,
    state.meta.schedule,
    state.meta.theme ? `Theme: ${state.meta.theme}` : "",
    state.meta.updatedAt ? `Updated ${formatDateTime(state.meta.updatedAt)}` : ""
  ].filter(Boolean);
  subtitle.textContent = metaLine.join(" | ");
}

function renderTabs() {
  const tabsEl = document.getElementById("tabs");
  if (!tabsEl) return;
  tabsEl.innerHTML = "";

  tabConfig.forEach((tab) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${tab.id === activeTab ? "active" : ""}`;
    btn.dataset.tab = tab.id;
    btn.type = "button";
    btn.textContent = tab.label;
    btn.addEventListener("click", () => activateTab(tab.id));
    tabsEl.appendChild(btn);
  });
}

function activateTab(id, { save = true } = {}) {
  const exists = tabConfig.some((tab) => tab.id === id);
  activeTab = exists ? id : tabConfig[0].id;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === activeTab);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${activeTab}`);
  });

  if (save) saveActiveTab(activeTab);
}

function renderIntro() {
  const panel = document.getElementById("tab-intro");
  if (!panel || !state) return;

  const allGoals = [...state.mainGoals, ...state.secondaryGoals];
  const allItems = allGoals.flatMap((goal) => goal.actionItems);
  const completion = computeProgress(allItems);
  const doneItems = allItems.filter((item) => item.status === "done").length;
  const inProgressItems = allItems.filter((item) => item.status === "in_progress").length;
  const highPriority = allItems.filter((item) => item.priority === "high" && item.status !== "done").length;
  const focusGoals = summarizeGoals(allGoals).slice(0, 3);
  const totalEvidence = allGoals.reduce((total, goal) => total + goal.evidence.length, 0) + state.noteEvidence.length;

  panel.innerHTML = `
    <div class="dashboard-grid dashboard-grid-wide">
      <article class="card hero-card">
        <p class="eyebrow">Mission Control</p>
        <h2>${escapeHtml(state.meta.theme)}</h2>
        <p>${escapeHtml(state.intro.overview)}</p>
        <div class="mission-metrics">
          <div class="score-ring" style="--progress:${completion}">
            <div class="score-ring-content">
              <strong>${completion}%</strong>
              <span>completion</span>
            </div>
          </div>
          <div class="meta-list">
            <div class="meta-item"><span>North star</span><strong>${escapeHtml(state.meta.northStar)}</strong></div>
            <div class="meta-item"><span>Total action items</span><strong>${allItems.length}</strong></div>
            <div class="meta-item"><span>Evidence captured</span><strong>${totalEvidence}</strong></div>
            <div class="meta-item"><span>Highest pressure zone</span><strong>${highPriority ? `${highPriority} high-priority tasks` : "Stable"}</strong></div>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>Execution Signals</h2>
        <div class="kpis">
          <div class="kpi"><span>Done</span><strong>${doneItems}</strong></div>
          <div class="kpi"><span>In Progress</span><strong>${inProgressItems}</strong></div>
          <div class="kpi"><span>High Priority</span><strong>${highPriority}</strong></div>
        </div>
        <div class="signal-list">
          <div class="signal-item"><span>Main goal progress</span><strong>${computeProgress(state.mainGoals[0].actionItems)}%</strong></div>
          <div class="signal-item"><span>Secondary goal progress</span><strong>${averageProgress(state.secondaryGoals)}%</strong></div>
          <div class="signal-item"><span>Total goals</span><strong>${allGoals.length}</strong></div>
        </div>
      </article>
    </div>

    <div class="dashboard-grid">
      <article class="card">
        <h3>Focus Radar</h3>
        ${focusGoals.length ? `
          <div class="focus-list">
            ${focusGoals.map((goal) => `
              <div class="focus-item">
                <span>${escapeHtml(goal.title)}</span>
                <strong>${goal.progress}% complete</strong>
              </div>
            `).join("")}
          </div>
        ` : `<div class="empty-state">Add a few action items to see momentum by goal.</div>`}
      </article>

      <article class="card">
        <h3>Priority Focus</h3>
        ${allItems.filter((item) => item.status !== "done" && item.priority === "high").length ? `
          <div class="focus-list">
            ${allItems.filter((item) => item.status !== "done" && item.priority === "high").slice(0, 4).map((item) => `
              <div class="focus-item">
                <span>${escapeHtml(item.text)}</span>
                <strong>${labelForPriority(item.priority)}</strong>
              </div>
            `).join("")}
          </div>
        ` : `<div class="empty-state">No high-priority items right now.</div>`}
      </article>
    </div>

    <div class="dashboard-grid">
      <article class="card">
        <h3>In Motion</h3>
        ${allItems.filter((item) => item.status === "in_progress").length ? `
          <div class="focus-list">
            ${allItems.filter((item) => item.status === "in_progress").slice(0, 4).map((item) => `
              <div class="focus-item">
                <span>${escapeHtml(item.text)}</span>
                <strong>${labelForPriority(item.priority)}</strong>
              </div>
            `).join("")}
          </div>
        ` : `<div class="empty-state">No tasks in progress right now.</div>`}
      </article>

      <article class="card">
        <h3>Role Snapshot</h3>
        <div class="meta-list">
          <div class="meta-item"><span>Name</span><strong>${escapeHtml(state.meta.name)}</strong></div>
          <div class="meta-item"><span>Role</span><strong>${escapeHtml(state.meta.role)}</strong></div>
          <div class="meta-item"><span>Work model</span><strong>${escapeHtml(state.meta.schedule || "Not specified")}</strong></div>
          <div class="meta-item"><span>Saved status</span><strong>Local auto-save active</strong></div>
        </div>
      </article>
    </div>

    <h3>Execution Arc</h3>
    <div class="timeline">
      <article class="card">
        <h4>Q1 - Setup</h4>
        <p>${escapeHtml(state.timeline.q1)}</p>
      </article>
      <article class="card">
        <h4>Mid-Year Check</h4>
        <p>${escapeHtml(state.timeline.midYear)}</p>
      </article>
      <article class="card">
        <h4>Q3 - Execution</h4>
        <p>${escapeHtml(state.timeline.q3)}</p>
      </article>
      <article class="card">
        <h4>Q4 - Consolidation</h4>
        <p>${escapeHtml(state.timeline.q4)}</p>
      </article>
    </div>
  `;
}

function renderMainGoal() {
  const panel = document.getElementById("tab-main-1");
  if (!panel || !state) return;
  const goal = state.mainGoals[0];
  panel.innerHTML = buildGoalSection(goal, "main", 0);
  wireGoalInteractions("main", 0, panel);
}

function renderSecondary() {
  const panel = document.getElementById("tab-secondary");
  if (!panel || !state) return;
  activeSecondaryIndex = clampIndex(activeSecondaryIndex, state.secondaryGoals.length);
  const currentGoal = state.secondaryGoals[activeSecondaryIndex];
  panel.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Secondary Goals</h2>
        <p class="microcopy">Keep a flexible stack of supporting goals and rebalance them as the year evolves.</p>
      </div>
      <button type="button" class="primary-btn" id="addSecondaryGoalBtn">Add Secondary Goal</button>
    </div>
    <div class="secondary-carousel-nav">
      ${state.secondaryGoals.map((goal, index) => `
        <button
          type="button"
          class="secondary-nav-btn ${index === activeSecondaryIndex ? "active" : ""}"
          data-secondary-index="${index}"
        >
          ${escapeHtml(goal.title)}
        </button>
      `).join("")}
    </div>
    <div id="secondary-container" class="secondary-carousel-card"></div>
  `;

  const addBtn = panel.querySelector("#addSecondaryGoalBtn");
  if (addBtn) addBtn.onclick = addNewGoal;

  panel.querySelectorAll("[data-secondary-index]").forEach((btn) => {
    btn.onclick = () => {
      activeSecondaryIndex = Number(btn.dataset.secondaryIndex);
      renderSecondary();
    };
  });

  const container = panel.querySelector("#secondary-container");
  const wrap = document.createElement("article");
  wrap.className = "card";
  wrap.innerHTML = buildGoalSection(currentGoal, "secondary", activeSecondaryIndex, {
    showDeleteGoalButton: state.secondaryGoals.length > 1
  });
  container.appendChild(wrap);
  wireGoalInteractions("secondary", activeSecondaryIndex, wrap);
}

function renderNotes() {
  const panel = document.getElementById("tab-notes");
  if (!panel || !state) return;

  const words = countWords(state.notes);
  panel.innerHTML = `
    <div class="notes-header">
      <h2>Logs and Evidence</h2>
      <p>Capture reflections, feedback, screenshots, and proof points that support your story across the year. You can also paste images with Ctrl+V.</p>
    </div>
    <div class="notes-toolbar">
      <p class="notes-hint" id="notesHint">Auto-save active</p>
      <div class="goal-progress-chip">Word count: ${words}</div>
    </div>
    <textarea id="notesArea" class="note-box" placeholder="Write your notes here...">${escapeHtml(state.notes)}</textarea>
    <div class="add-row">
      <input type="file" id="notesEvidenceInput" accept="image/*" multiple />
      <div></div>
      <div></div>
      <button type="button" id="saveNotesBtn" class="primary-btn">Save Notes</button>
    </div>
    <div id="noteEvidenceGrid" class="evidence-grid"></div>
  `;

  const notesArea = document.getElementById("notesArea");
  const notesHint = document.getElementById("notesHint");
  let noteTimer;

  notesArea.addEventListener("input", () => {
    clearTimeout(noteTimer);
    notesHint.textContent = "Saving...";
    noteTimer = setTimeout(() => {
      state.notes = notesArea.value;
      persistState();
      notesHint.textContent = "Auto-saved";
      renderHeader();
    }, 350);
  });

  document.getElementById("saveNotesBtn").onclick = () => {
    state.notes = notesArea.value;
    persistState();
    notesHint.textContent = "Saved";
    renderNotes();
    renderHeader();
    showToast("Notes saved", "success");
  };

  document.getElementById("notesEvidenceInput").onchange = async (event) => {
    const files = [...event.target.files];
    if (!files.length) return;
    const images = await toDataUrls(files);
    state.noteEvidence.push(...images.map((src) => ({ id: uid(), src, createdAt: new Date().toISOString() })));
    persistState();
    renderNotes();
    renderIntro();
    renderHeader();
    showToast(`${images.length} evidence item${images.length > 1 ? "s" : ""} added`, "success");
  };

  panel.onpaste = async (event) => {
    const files = getClipboardImageFiles(event);
    if (!files.length) return;
    event.preventDefault();
    const images = await toDataUrls(files);
    state.noteEvidence.push(...images.map((src) => ({ id: uid(), src, createdAt: new Date().toISOString() })));
    persistState();
    renderNotes();
    renderIntro();
    renderHeader();
    showToast(`${images.length} pasted into notes evidence`, "success");
  };

  renderEvidenceGrid(
    panel.querySelector("#noteEvidenceGrid"),
    state.noteEvidence,
    (id) => {
      state.noteEvidence = state.noteEvidence.filter((img) => img.id !== id);
      persistState();
      renderNotes();
      renderIntro();
      renderHeader();
      showToast("Evidence removed", "info");
    },
    "No notes evidence yet. Upload screenshots, visuals, or references."
  );
}

function buildGoalSection(goal, group, index, options = {}) {
  const progress = computeProgress(goal.actionItems);
  const metrics = summarizeItems(goal.actionItems);
  const key = `${group}-${index}`;

  return `
    <div class="goal-head">
      <div>
        <p class="eyebrow">${group === "main" ? "Primary Objective" : "Supporting Objective"}</p>
        <h3>${escapeHtml(goal.title)}</h3>
      </div>
      <div class="goal-progress-chip">${progress}% complete</div>
    </div>
    <p>${escapeHtml(goal.objective)}</p>

    <div class="goal-summary">
      <div class="summary-pill"><span>Total Tasks</span><strong>${metrics.total}</strong></div>
      <div class="summary-pill"><span>In Progress</span><strong>${metrics.inProgress}</strong></div>
      <div class="summary-pill"><span>Done</span><strong>${metrics.done}</strong></div>
      <div class="summary-pill"><span>High Priority</span><strong>${goal.actionItems.filter((item) => item.priority === "high" && item.status !== "done").length}</strong></div>
    </div>

    <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>

    <div class="goal-actions">
      <p class="microcopy">Add structured tasks with a due date and priority so the board can surface what matters next.</p>
      ${options.showDeleteGoalButton ? `<button type="button" class="danger goal-delete-btn" data-delete-goal="${key}" aria-label="Delete goal">X</button>` : ""}
    </div>

    <div class="add-row">
      <input type="text" placeholder="New action item..." data-new-text="${key}" />
      <select data-new-priority="${key}">
        ${PRIORITY_OPTIONS.map((priority) => `<option value="${priority.key}" ${priority.key === "medium" ? "selected" : ""}>${priority.label} priority</option>`).join("")}
      </select>
      <button type="button" class="primary-btn" data-add-item="${key}">Add Task</button>
    </div>

    ${buildKanban(goal.actionItems, key)}

    <div class="section-head">
      <div>
        <h4>Evidence Vault</h4>
        <p class="microcopy">Upload images or paste with Ctrl+V.</p>
      </div>
      <label class="ghost-btn">
        Upload Evidence
        <input type="file" accept="image/*" multiple data-evidence-input="${key}" class="hidden-input" />
      </label>
    </div>
    <div id="evidence-grid-${key}" class="evidence-grid"></div>
  `;
}

function buildKanban(items, key) {
  return `
    <section class="kanban" data-board="${key}">
      ${STATUS_COLUMNS.map((column) => buildKanbanColumn(items, column, key)).join("")}
    </section>
  `;
}

function buildKanbanColumn(items, column, key) {
  const columnItems = items.filter((item) => item.status === column.key);
  return `
    <article class="kanban-column" data-column-status="${column.key}" data-board-column="${key}">
      <div class="column-head">
        <strong>${column.label}</strong>
        <span class="column-badge">${columnItems.length}</span>
      </div>
      <div class="task-list">
        ${columnItems.length ? columnItems.map((item) => taskCardMarkup(item)).join("") : `<div class="empty-state">No tasks here yet.</div>`}
      </div>
    </article>
  `;
}

function taskCardMarkup(item) {
  return `
    <article class="task-card" draggable="true" data-item-id="${item.id}" data-priority="${item.priority}">
      <div class="item-text-display">${escapeHtml(item.text)}</div>
      <input class="item-text hidden" type="text" value="${escapeHtml(item.text)}" placeholder="Task description" />
    </article>
  `;
}

function wireGoalInteractions(group, index, hostEl) {
  const key = `${group}-${index}`;
  const textEl = hostEl.querySelector(`[data-new-text="${key}"]`);
  const priorityEl = hostEl.querySelector(`[data-new-priority="${key}"]`);
  const addBtn = hostEl.querySelector(`[data-add-item="${key}"]`);

  if (addBtn) {
    addBtn.onclick = () => {
      const text = textEl.value.trim();
      if (!text) {
        showToast("Write a task before adding it", "warning");
        return;
      }

      const targetGoal = getGoal(group, index);
      targetGoal.actionItems.push({
        id: uid(),
        text,
        status: "not_started",
        priority: priorityEl.value || "medium",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      textEl.value = "";
      priorityEl.value = "medium";
      saveAndRerender(group);
      showToast("Action item added", "success");
    };
  }

  if (textEl && addBtn) {
    textEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addBtn.click();
      }
    });
  }

  const deleteGoalBtn = hostEl.querySelector(`[data-delete-goal="${key}"]`);
  if (deleteGoalBtn) deleteGoalBtn.onclick = () => removeGoal(group, index);

  hostEl.querySelectorAll("[data-item-id]").forEach((card) => {
    const itemId = card.dataset.itemId;
    const taskTextDisplay = card.querySelector(".item-text-display");
    const taskText = card.querySelector(".item-text");

    const saveTaskText = () => {
      const value = taskText.value.trim();
      if (!value) {
        showToast("Task text cannot be empty", "warning");
        taskText.value = taskTextDisplay.textContent;
        return;
      }
      updateItem(group, index, itemId, { text: value });
    };

    taskText.onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveTaskText();
      }

      if (event.key === "Escape") {
        taskText.value = taskTextDisplay.textContent;
        saveAndRerender(group);
      }
    };

    taskText.onblur = () => {
      if (!taskText.classList.contains("hidden")) saveTaskText();
    };

    card.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openTaskContextMenu(event.clientX, event.clientY, { group, index, itemId });
    });

    card.addEventListener("mousedown", (event) => {
      const rect = card.getBoundingClientRect();
      const dragZoneWidth = 14;
      card.dataset.dragReady = rect.right - event.clientX <= dragZoneWidth ? "true" : "false";
    });

    card.addEventListener("dragstart", (event) => {
      if (card.dataset.dragReady !== "true") {
        event.preventDefault();
        return;
      }
      card.classList.add("dragging");
      event.dataTransfer.setData("text/plain", itemId);
      event.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      card.dataset.dragReady = "false";
    });
  });

  hostEl.querySelectorAll(`[data-board-column="${key}"]`).forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("drag-over");
    });

    column.addEventListener("dragleave", () => {
      column.classList.remove("drag-over");
    });

    column.addEventListener("drop", (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      const itemId = event.dataTransfer.getData("text/plain");
      updateItem(group, index, itemId, { status: column.dataset.columnStatus });
    });
  });

  const evidenceInput = hostEl.querySelector(`[data-evidence-input="${key}"]`);
  if (evidenceInput) {
    evidenceInput.onchange = async (event) => {
      const files = [...event.target.files];
      if (!files.length) return;
      const images = await toDataUrls(files);
      const goal = getGoal(group, index);
      goal.evidence.push(...images.map((src) => ({ id: uid(), src, createdAt: new Date().toISOString() })));
      persistState();
      renderHeader();
      renderIntro();
      if (group === "main") renderMainGoal();
      else renderSecondary();
      showToast(`${images.length} evidence item${images.length > 1 ? "s" : ""} added`, "success");
    };
  }

  hostEl.onpaste = async (event) => {
    const files = getClipboardImageFiles(event);
    if (!files.length) return;
    event.preventDefault();
    const images = await toDataUrls(files);
    const goal = getGoal(group, index);
    goal.evidence.push(...images.map((src) => ({ id: uid(), src, createdAt: new Date().toISOString() })));
    persistState();
    renderHeader();
    renderIntro();
    if (group === "main") renderMainGoal();
    else renderSecondary();
    showToast(`${images.length} pasted into evidence vault`, "success");
  };

  renderEvidenceGrid(
    hostEl.querySelector(`#evidence-grid-${key}`),
    getGoal(group, index).evidence,
    (id) => {
      const goal = getGoal(group, index);
      goal.evidence = goal.evidence.filter((img) => img.id !== id);
      persistState();
      renderHeader();
      renderIntro();
      if (group === "main") renderMainGoal();
      else renderSecondary();
      showToast("Evidence removed", "info");
    },
    "No evidence yet. Add screenshots, charts, or visual proof points."
  );
}

function addNewGoal() {
  const title = prompt("Write the secondary goal title:");
  if (!title || !title.trim()) return;
  const objective = prompt("Write a short objective for this goal:");
  if (!objective || !objective.trim()) return;

  state.secondaryGoals.push(
    createGoal({
      id: `secondary_${uid()}`,
      title: title.trim(),
      objective: objective.trim()
    })
  );
  activeSecondaryIndex = state.secondaryGoals.length - 1;

  persistState();
  renderHeader();
  renderAll();
  showToast("Secondary goal added", "success");
}

function removeGoal(group, index) {
  const list = group === "main" ? state.mainGoals : state.secondaryGoals;
  if (list.length <= 1) {
    showToast(`At least one ${group} goal is required`, "warning");
    return;
  }

  list.splice(index, 1);
  if (group === "secondary") {
    activeSecondaryIndex = clampIndex(activeSecondaryIndex, list.length);
  }
  persistState();
  renderHeader();
  renderAll();
}

function getGoal(group, index) {
  return group === "main" ? state.mainGoals[index] : state.secondaryGoals[index];
}

function updateItem(group, index, itemId, patch) {
  const goal = getGoal(group, index);
  const item = goal.actionItems.find((entry) => entry.id === itemId);
  if (!item) return;

  if (typeof patch.text === "string" && !patch.text.trim()) {
    showToast("Task text cannot be empty", "warning");
    saveAndRerender(group);
    return;
  }

  Object.assign(item, patch, { updatedAt: new Date().toISOString() });
  saveAndRerender(group);
}

function removeItem(group, index, itemId) {
  const goal = getGoal(group, index);
  goal.actionItems = goal.actionItems.filter((entry) => entry.id !== itemId);
  saveAndRerender(group);
}

function saveAndRerender(group) {
  persistState();
  renderHeader();
  renderIntro();
  if (group === "main") renderMainGoal();
  else renderSecondary();
}

function renderEvidenceGrid(container, images, onDelete, emptyMessage = "No evidence yet.") {
  if (!container) return;
  container.innerHTML = "";

  if (!images.length) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  images.forEach((img) => {
    const card = document.createElement("article");
    card.className = "evidence-item";
    card.innerHTML = `
      <img src="${img.src}" alt="Evidence" />
    `;
    card.onclick = () => openEvidenceLightbox(img.src);
    card.oncontextmenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openEvidenceContextMenu(event.clientX, event.clientY, img, onDelete);
    };
    container.appendChild(card);
  });
}

function ensureTaskContextMenu() {
  if (document.getElementById("taskContextMenu")) return;
  const menu = document.createElement("div");
  menu.id = "taskContextMenu";
  menu.className = "task-context-menu hidden";
  document.body.appendChild(menu);
}

function ensureEvidenceLightbox() {
  if (document.getElementById("evidenceLightbox")) return;
  const lightbox = document.createElement("div");
  lightbox.id = "evidenceLightbox";
  lightbox.className = "evidence-lightbox hidden";
  lightbox.innerHTML = `
    <div class="evidence-lightbox-backdrop" data-lightbox-close="true"></div>
    <div class="evidence-lightbox-dialog">
      <button type="button" class="evidence-lightbox-close" aria-label="Close image">X</button>
      <img id="evidenceLightboxImage" src="" alt="Expanded evidence" />
    </div>
  `;
  lightbox.querySelector(".evidence-lightbox-close").onclick = closeEvidenceLightbox;
  lightbox.querySelector("[data-lightbox-close='true']").onclick = closeEvidenceLightbox;
  document.body.appendChild(lightbox);
}

function bindGlobalUiDismissals() {
  if (document.body.dataset.uiDismissalsBound === "true") return;
  document.body.dataset.uiDismissalsBound = "true";

  document.addEventListener("click", () => closeTaskContextMenu());
  document.addEventListener("scroll", () => closeTaskContextMenu(), true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTaskContextMenu();
      closeEvidenceLightbox();
    }
  });
}

function openEvidenceLightbox(src) {
  const lightbox = document.getElementById("evidenceLightbox");
  const image = document.getElementById("evidenceLightboxImage");
  if (!lightbox || !image) return;
  image.src = src;
  lightbox.classList.remove("hidden");
}

function closeEvidenceLightbox() {
  const lightbox = document.getElementById("evidenceLightbox");
  const image = document.getElementById("evidenceLightboxImage");
  if (!lightbox || !image) return;
  lightbox.classList.add("hidden");
  image.src = "";
}

function openTaskContextMenu(x, y, context) {
  const menu = document.getElementById("taskContextMenu");
  const item = getGoal(context.group, context.index).actionItems.find((entry) => entry.id === context.itemId);
  if (!menu || !item) return;

  activeTaskContext = context;
  menu.innerHTML = `
    <button type="button" class="task-context-action" data-task-action="edit">Edit task</button>
    <div class="task-context-divider"></div>
    ${PRIORITY_OPTIONS.map((priority) => `
      <button
        type="button"
        class="task-context-action ${item.priority === priority.key ? "active" : ""}"
        data-task-action="priority"
        data-task-priority="${priority.key}"
      >
        ${priority.label} priority
      </button>
    `).join("")}
    <div class="task-context-divider"></div>
    <button type="button" class="task-context-action danger" data-task-action="delete">Delete task</button>
  `;

  menu.querySelectorAll("[data-task-action]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      handleTaskContextAction(button.dataset.taskAction, button.dataset.taskPriority);
    };
  });

  menu.classList.remove("hidden");
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 12);
  const top = Math.min(y, window.innerHeight - rect.height - 12);
  menu.style.left = `${Math.max(12, left)}px`;
  menu.style.top = `${Math.max(12, top)}px`;
}

function closeTaskContextMenu() {
  const menu = document.getElementById("taskContextMenu");
  if (!menu) return;
  menu.classList.add("hidden");
  activeTaskContext = null;
  activeEvidenceContext = null;
}

function handleTaskContextAction(action, priority) {
  if (!activeTaskContext) return;
  const { group, index, itemId } = activeTaskContext;

  if (action === "delete") {
    removeItem(group, index, itemId);
    showToast("Action item deleted", "info");
    closeTaskContextMenu();
    return;
  }

  if (action === "priority" && priority) {
    updateItem(group, index, itemId, { priority });
    closeTaskContextMenu();
    return;
  }

  if (action === "edit") {
    closeTaskContextMenu();
    openTaskEditor(group, index, itemId);
  }
}

function openEvidenceContextMenu(x, y, image, onDelete) {
  const menu = document.getElementById("taskContextMenu");
  if (!menu || !image) return;

  activeTaskContext = null;
  activeEvidenceContext = { imageId: image.id, onDelete };
  menu.innerHTML = `
    <button type="button" class="task-context-action" data-evidence-action="open">Open image</button>
    <div class="task-context-divider"></div>
    <button type="button" class="task-context-action danger" data-evidence-action="delete">Delete evidence</button>
  `;

  menu.querySelectorAll("[data-evidence-action]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      handleEvidenceContextAction(button.dataset.evidenceAction, image);
    };
  });

  menu.classList.remove("hidden");
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 12);
  const top = Math.min(y, window.innerHeight - rect.height - 12);
  menu.style.left = `${Math.max(12, left)}px`;
  menu.style.top = `${Math.max(12, top)}px`;
}

function handleEvidenceContextAction(action, image) {
  if (!activeEvidenceContext) return;

  if (action === "open") {
    closeTaskContextMenu();
    openEvidenceLightbox(image.src);
    return;
  }

  if (action === "delete") {
    activeEvidenceContext.onDelete(image.id);
    closeTaskContextMenu();
  }
}

function openTaskEditor(group, index, itemId) {
  const card = document.querySelector(`[data-item-id="${itemId}"]`);
  if (!card) return;
  const taskText = card.querySelector(".item-text");
  const taskTextDisplay = card.querySelector(".item-text-display");
  if (!taskText || !taskTextDisplay) return;

  taskText.classList.remove("hidden");
  taskTextDisplay.classList.add("hidden");
  taskText.focus();
  taskText.select();
}

function summarizeGoals(goals) {
  return goals
    .map((goal) => ({
      title: goal.title,
      progress: computeProgress(goal.actionItems)
    }))
    .sort((a, b) => b.progress - a.progress);
}

function summarizeItems(items) {
  return {
    total: items.length,
    inProgress: items.filter((item) => item.status === "in_progress").length,
    done: items.filter((item) => item.status === "done").length
  };
}

function computeProgress(items) {
  if (!items.length) return 0;
  const score = items.reduce((acc, item) => {
    if (item.status === "done") return acc + 1;
    if (item.status === "in_progress") return acc + 0.5;
    return acc;
  }, 0);
  return Math.round((score / items.length) * 100);
}

function averageProgress(goals) {
  if (!goals.length) return 0;
  return Math.round(goals.reduce((total, goal) => total + computeProgress(goal.actionItems), 0) / goals.length);
}

function labelForPriority(priority) {
  return PRIORITY_OPTIONS.find((option) => option.key === priority)?.label || "Medium";
}

function clampIndex(index, length) {
  if (!length) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

function loadActiveTab() {
  const saved = localStorage.getItem(ACTIVE_TAB_KEY);
  return tabConfig.some((tab) => tab.id === saved) ? saved : tabConfig[0].id;
}

function saveActiveTab(id) {
  localStorage.setItem(ACTIVE_TAB_KEY, id);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const migrated = migrateState(parsed);
    if (migrated && localStorage.getItem(STORAGE_KEY) !== JSON.stringify(migrated)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return null;
  }
}

function migrateState(parsed) {
  if (!parsed || typeof parsed !== "object") return null;

  const meta = {
    name: parsed.meta?.name || "",
    role: parsed.meta?.role || "",
    schedule: parsed.meta?.schedule || "",
    theme: parsed.meta?.theme || "Build visible momentum",
    northStar: parsed.meta?.northStar || "Define your success metric",
    createdAt: parsed.meta?.createdAt || new Date().toISOString(),
    updatedAt: parsed.meta?.updatedAt || new Date().toISOString()
  };

  const intro = {
    overview: parsed.intro?.overview || ""
  };

  const timeline = {
    q1: parsed.timeline?.q1 || "",
    midYear: parsed.timeline?.midYear || "",
    q3: parsed.timeline?.q3 || "",
    q4: parsed.timeline?.q4 || ""
  };

  const mainGoals = Array.isArray(parsed.mainGoals) && parsed.mainGoals.length ? parsed.mainGoals : [];
  const secondaryGoals = Array.isArray(parsed.secondaryGoals) && parsed.secondaryGoals.length ? parsed.secondaryGoals : [];

  if (!meta.name || !meta.role || !intro.overview || !timeline.q1 || !timeline.midYear || !timeline.q3 || !timeline.q4) {
    return null;
  }

  if (!mainGoals.length || !secondaryGoals.length) return null;

  return {
    version: 2,
    meta,
    intro,
    timeline,
    mainGoals: mainGoals.map((goal, index) => sanitizeGoal(goal, `mg${index + 1}`)),
    secondaryGoals: secondaryGoals.map((goal, index) => sanitizeGoal(goal, `sg${index + 1}`)),
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
    noteEvidence: sanitizeEvidence(parsed.noteEvidence)
  };
}

function sanitizeGoal(goal, fallbackId) {
  return {
    id: goal?.id || fallbackId,
    title: goal?.title || "Untitled Goal",
    objective: goal?.objective || "",
    actionItems: sanitizeItems(goal?.actionItems),
    evidence: sanitizeEvidence(goal?.evidence)
  };
}

function sanitizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: item?.id || uid(),
      text: item?.text || "",
      status: STATUS_COLUMNS.some((col) => col.key === item?.status) ? item.status : "not_started",
      priority: PRIORITY_OPTIONS.some((option) => option.key === item?.priority) ? item.priority : "medium",
      createdAt: item?.createdAt || new Date().toISOString(),
      updatedAt: item?.updatedAt || new Date().toISOString()
    }))
    .filter((item) => item.text);
}

function sanitizeEvidence(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item.src === "string")
    .map((item) => ({
      id: item.id || uid(),
      src: item.src,
      createdAt: item.createdAt || new Date().toISOString()
    }));
}

function persistState() {
  if (!state) return;
  state.meta.updatedAt = new Date().toISOString();
  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function exportState() {
  if (!state) return;
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(state.meta.name || "goal-flight-deck")}-2026-plan.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Plan exported", "success");
}

async function importState(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const content = await file.text();
    const parsed = JSON.parse(content);
    const migrated = migrateState(parsed);
    if (!migrated) throw new Error("invalid");
    state = migrated;
    activeTab = tabConfig[0].id;
    persistState();
    saveActiveTab(activeTab);
    init();
    showToast("Plan imported", "success");
  } catch {
    showToast("That file is not a valid plan export", "warning");
  } finally {
    event.target.value = "";
  }
}

function ensureToastHost() {
  if (document.getElementById("toastHost")) return;
  const host = document.createElement("div");
  host.id = "toastHost";
  host.className = "toast-host";
  document.body.appendChild(host);
}

function showToast(message, tone = "info") {
  const host = document.getElementById("toastHost");
  if (!host) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  host.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 220);
  }, TOAST_DURATION_MS);
}

async function toDataUrls(files) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        })
    )
  );
}

function getClipboardImageFiles(event) {
  const items = [...(event.clipboardData?.items || [])];
  return items
    .filter((item) => item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
