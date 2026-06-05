"use strict";

const STORAGE_KEY = "comfyPromptOrganizer.v1";
const HISTORY_LIMIT = 20;
const DEFAULT_SETTINGS = {
  provider: "deepseek",
  model: "deepseek-v4-flash",
  apiKey: "",
  endpoint: "https://api.deepseek.com",
  showAiProcess: false,
  enableDeepSeekThinking: true
};

const state = loadState();
const undoStack = [];
let toastTimer = null;
let selectedDictionaryId = null;
let selectedDictionaryIds = new Set();
let dictionarySelectionAnchorId = null;
let dictionaryPointerActive = false;
let segmentDragState = null;
let groupedUndoKey = null;

const SEGMENT_DRAG_DELAY = 420;
const SEGMENT_DRAG_TOLERANCE = 8;
const DICTIONARY_DRAG_MIME = "application/x-comfy-dictionary-id";
const DICTIONARY_CLASSIFY_BATCH_SIZE = 20;
const DICTIONARY_CLASSIFY_RETRY_BATCH_SIZE = 5;
const DICTIONARY_CLASSIFY_MAX_RETRY_DEPTH = 4;
const OPENAI_COMPATIBLE_PROVIDERS = ["deepseek", "openai-compatible", "custom"];
const DEFAULT_DICTIONARY_CATEGORIES = ["外观", "发型", "表情", "姿势", "服装", "身体", "场景", "光影", "镜头", "画风", "质量", "负面", "其他"];

const el = {
  undoBtn: document.getElementById("undoBtn"),
  exportDataBtn: document.getElementById("exportDataBtn"),
  importDataInput: document.getElementById("importDataInput"),
  resetAllBtn: document.getElementById("resetAllBtn"),
  saveStatus: document.getElementById("saveStatus"),
  toast: document.getElementById("toast"),

  positiveInput: document.getElementById("positiveInput"),
  negativeInput: document.getElementById("negativeInput"),
  positiveOutput: document.getElementById("positiveOutput"),
  negativeOutput: document.getElementById("negativeOutput"),
  positiveChineseOutput: document.getElementById("positiveChineseOutput"),
  negativeChineseOutput: document.getElementById("negativeChineseOutput"),
  positiveSegments: document.getElementById("positiveSegments"),
  negativeSegments: document.getElementById("negativeSegments"),
  positiveCount: document.getElementById("positiveCount"),
  negativeCount: document.getElementById("negativeCount"),
  positiveTabCount: document.getElementById("positiveTabCount"),
  negativeTabCount: document.getElementById("negativeTabCount"),
  positiveSelectedHint: document.getElementById("positiveSelectedHint"),
  negativeSelectedHint: document.getElementById("negativeSelectedHint"),

  selectedDetail: document.getElementById("selectedDetail"),
  translateInput: document.getElementById("translateInput"),
  translateOutput: document.getElementById("translateOutput"),
  translateDirection: document.getElementById("translateDirection"),
  translateBtn: document.getElementById("translateBtn"),
  retranslateBtn: document.getElementById("retranslateBtn"),
  showAiProcess: document.getElementById("showAiProcess"),
  enableDeepSeekThinking: document.getElementById("enableDeepSeekThinking"),
  aiProcessOutput: document.getElementById("aiProcessOutput"),
  aiProcessBlock: document.getElementById("aiProcessBlock"),

  aiProvider: document.getElementById("aiProvider"),
  aiModel: document.getElementById("aiModel"),
  aiApiKey: document.getElementById("aiApiKey"),
  aiEndpoint: document.getElementById("aiEndpoint"),
  promptApiKeyBtn: document.getElementById("promptApiKeyBtn"),
  useDeepSeekDefaultsBtn: document.getElementById("useDeepSeekDefaultsBtn"),
  testAiBtn: document.getElementById("testAiBtn"),
  aiTestResult: document.getElementById("aiTestResult"),

  libraryForm: document.getElementById("libraryForm"),
  libraryEditId: document.getElementById("libraryEditId"),
  libraryTitle: document.getElementById("libraryTitle"),
  libraryPrompt: document.getElementById("libraryPrompt"),
  libraryCategory: document.getElementById("libraryCategory"),
  libraryTags: document.getElementById("libraryTags"),
  libraryNote: document.getElementById("libraryNote"),
  libraryCancelBtn: document.getElementById("libraryCancelBtn"),
  librarySearch: document.getElementById("librarySearch"),
  libraryCategoryFilter: document.getElementById("libraryCategoryFilter"),
  libraryList: document.getElementById("libraryList"),

  templateForm: document.getElementById("templateForm"),
  templateEditId: document.getElementById("templateEditId"),
  templateName: document.getElementById("templateName"),
  templateTags: document.getElementById("templateTags"),
  templateNote: document.getElementById("templateNote"),
  templatePositive: document.getElementById("templatePositive"),
  templateNegative: document.getElementById("templateNegative"),
  fillTemplateFromCurrentBtn: document.getElementById("fillTemplateFromCurrentBtn"),
  templateCancelBtn: document.getElementById("templateCancelBtn"),
  templateSearch: document.getElementById("templateSearch"),
  templateList: document.getElementById("templateList"),

  dictionaryForm: document.getElementById("dictionaryForm"),
  dictionaryEditId: document.getElementById("dictionaryEditId"),
  dictionaryChinese: document.getElementById("dictionaryChinese"),
  dictionaryEnglish: document.getElementById("dictionaryEnglish"),
  dictionaryCategory: document.getElementById("dictionaryCategory"),
  dictionaryAliases: document.getElementById("dictionaryAliases"),
  dictionaryNote: document.getElementById("dictionaryNote"),
  dictionaryCancelBtn: document.getElementById("dictionaryCancelBtn"),
  addSelectedToDictionaryBtn: document.getElementById("addSelectedToDictionaryBtn"),
  autoClassifyDictionaryBtn: document.getElementById("autoClassifyDictionaryBtn"),
  reclassifyDictionaryBtn: document.getElementById("reclassifyDictionaryBtn"),
  dictionarySearch: document.getElementById("dictionarySearch"),
  dictionaryCategoryFilter: document.getElementById("dictionaryCategoryFilter"),
  dictionaryToolbar: document.getElementById("dictionaryToolbar"),
  dictionarySelectedHint: document.getElementById("dictionarySelectedHint"),
  dictionaryList: document.getElementById("dictionaryList")
};

init();

function init() {
  bindCoreEvents();
  bindLibraryEvents();
  bindTemplateEvents();
  bindDictionaryEvents();
  bindSettingsEvents();
  renderAll();
}

function createEmptyState() {
  return {
    prompts: {
      positive: [],
      negative: []
    },
    selected: {
      kind: "positive",
      id: null
    },
    library: [],
    templates: [],
    dictionary: [],
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: new Date().toISOString()
  };
}

function loadState() {
  const fallback = createEmptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return normalizeImportedState(parsed);
  } catch (error) {
    console.warn("LocalStorage 数据读取失败，已使用空数据。", error);
    return fallback;
  }
}

function normalizeImportedState(data) {
  const empty = createEmptyState();
  const next = {
    ...empty,
    ...data,
    prompts: {
      positive: Array.isArray(data?.prompts?.positive) ? data.prompts.positive : [],
      negative: Array.isArray(data?.prompts?.negative) ? data.prompts.negative : []
    },
    selected: {
      kind: data?.selected?.kind === "negative" ? "negative" : "positive",
      id: data?.selected?.id || null
    },
    library: Array.isArray(data?.library) ? data.library : [],
    templates: Array.isArray(data?.templates) ? data.templates : [],
    dictionary: Array.isArray(data?.dictionary) ? data.dictionary : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(data?.settings || {})
    }
  };

  next.prompts.positive = next.prompts.positive.map(normalizeSegment).filter(Boolean);
  next.prompts.negative = next.prompts.negative.map(normalizeSegment).filter(Boolean);
  next.library = next.library.map(normalizeLibraryItem).filter(Boolean);
  next.templates = next.templates.map(normalizeTemplate).filter(Boolean);
  next.dictionary = next.dictionary.map(normalizeDictionaryItem).filter(Boolean);

  if (!segmentExistsInState(next, next.selected.kind, next.selected.id)) {
    const firstPositive = next.prompts.positive[0];
    const firstNegative = next.prompts.negative[0];
    if (firstPositive) {
      next.selected = { kind: "positive", id: firstPositive.id };
    } else if (firstNegative) {
      next.selected = { kind: "negative", id: firstNegative.id };
    } else {
      next.selected = { kind: "positive", id: null };
    }
  }

  return next;
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  showSaveStatus();
  updateUndoControl();
}

function showSaveStatus() {
  el.saveStatus.textContent = "已自动保存 " + new Date().toLocaleTimeString();
}

function createHistorySnapshot(source = state) {
  return JSON.parse(
    JSON.stringify({
      prompts: source.prompts,
      selected: source.selected,
      library: source.library,
      templates: source.templates,
      dictionary: source.dictionary,
      settings: source.settings
    })
  );
}

function captureUndoStep(groupKey = null) {
  if (groupKey && groupedUndoKey === groupKey) return false;

  const snapshot = createHistorySnapshot();
  const previous = undoStack[undoStack.length - 1];
  const changedFromPrevious = !previous || JSON.stringify(previous) !== JSON.stringify(snapshot);

  if (changedFromPrevious) {
    undoStack.push(snapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  }

  groupedUndoKey = groupKey;
  updateUndoControl();
  return changedFromPrevious;
}

function finishUndoGroup(groupKey = null) {
  if (!groupKey || groupedUndoKey === groupKey) groupedUndoKey = null;
}

function undoLastStep() {
  const snapshot = undoStack.pop();
  if (!snapshot) {
    updateUndoControl();
    showToast("暂无可撤回步骤");
    return;
  }

  finishUndoGroup();
  restoreStateSnapshot(snapshot);
  showToast(`已撤回上一步，还可撤回 ${undoStack.length} 步`);
}

function restoreStateSnapshot(snapshot) {
  const restored = normalizeImportedState(snapshot);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, restored);
  syncDictionarySelectionWithState();
  saveState();
  renderAll();
}

function updateUndoControl() {
  if (!el.undoBtn) return;
  const count = undoStack.length;
  el.undoBtn.disabled = count === 0;
  el.undoBtn.textContent = count > 0 ? `撤回 (${count})` : "撤回";
  el.undoBtn.title =
    count > 0 ? `撤回上一步，可撤回 ${count} 步，最多保留 ${HISTORY_LIMIT} 步` : `暂无可撤回步骤，最多保留 ${HISTORY_LIMIT} 步`;
}

function handleUndoShortcut(event) {
  const key = String(event.key || "").toLowerCase();
  if (key !== "z" || event.shiftKey || event.altKey || (!event.ctrlKey && !event.metaKey)) return;
  if (isEditableTarget(event.target)) return;

  event.preventDefault();
  undoLastStep();
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function bindCoreEvents() {
  el.undoBtn.addEventListener("click", undoLastStep);
  document.addEventListener("keydown", handleUndoShortcut);
  document.addEventListener("focusout", () => finishUndoGroup());

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
  document.querySelectorAll(".prompt-tab-button").forEach((button) => {
    button.addEventListener("click", () => switchPromptTab(button.dataset.promptTab));
  });

  document.getElementById("parsePositiveBtn").addEventListener("click", () => parsePromptFromInput("positive"));
  document.getElementById("parseNegativeBtn").addEventListener("click", () => parsePromptFromInput("negative"));
  document.getElementById("prependPositiveBtn").addEventListener("click", () => appendPromptFromInput("positive", "top"));
  document.getElementById("prependNegativeBtn").addEventListener("click", () => appendPromptFromInput("negative", "top"));
  document.getElementById("appendPositiveBtn").addEventListener("click", () => appendPromptFromInput("positive", "bottom"));
  document.getElementById("appendNegativeBtn").addEventListener("click", () => appendPromptFromInput("negative", "bottom"));
  document.getElementById("copyPositiveMergedBtn").addEventListener("click", () => copyPrompt("positive"));
  document.getElementById("copyNegativeMergedBtn").addEventListener("click", () => copyPrompt("negative"));
  document.getElementById("copyPositiveChineseBtn").addEventListener("click", () => copyChineseReference("positive"));
  document.getElementById("copyNegativeChineseBtn").addEventListener("click", () => copyChineseReference("negative"));
  document.getElementById("clearPositiveBtn").addEventListener("click", () => clearPrompt("positive"));
  document.getElementById("clearNegativeBtn").addEventListener("click", () => clearPrompt("negative"));

  el.positiveSegments.addEventListener("click", (event) => handleSegmentClick(event, "positive"));
  el.negativeSegments.addEventListener("click", (event) => handleSegmentClick(event, "negative"));
  el.positiveSegments.addEventListener("focusin", (event) => handleSegmentFocus(event, "positive"));
  el.negativeSegments.addEventListener("focusin", (event) => handleSegmentFocus(event, "negative"));
  el.positiveSegments.addEventListener("input", (event) => handleSegmentInput(event, "positive"));
  el.negativeSegments.addEventListener("input", (event) => handleSegmentInput(event, "negative"));
  el.positiveSegments.addEventListener("pointerdown", (event) => handleSegmentPointerDown(event, "positive"));
  el.negativeSegments.addEventListener("pointerdown", (event) => handleSegmentPointerDown(event, "negative"));
  el.positiveSegments.addEventListener("dragover", (event) => handleDictionaryDragOverSegmentList(event, "positive"));
  el.negativeSegments.addEventListener("dragover", (event) => handleDictionaryDragOverSegmentList(event, "negative"));
  el.positiveSegments.addEventListener("dragleave", handleDictionaryDragLeaveSegmentList);
  el.negativeSegments.addEventListener("dragleave", handleDictionaryDragLeaveSegmentList);
  el.positiveSegments.addEventListener("drop", (event) => handleDictionaryDropOnSegmentList(event, "positive"));
  el.negativeSegments.addEventListener("drop", (event) => handleDictionaryDropOnSegmentList(event, "negative"));
  document.querySelectorAll(".editor-panel[data-kind] .segment-region").forEach((region) => {
    const kind = region.closest(".editor-panel[data-kind]")?.dataset.kind;
    if (!kind) return;
    region.addEventListener("dragover", (event) => handleDictionaryDragOverSegmentList(event, kind));
    region.addEventListener("dragleave", handleDictionaryDragLeaveSegmentList);
    region.addEventListener("drop", (event) => handleDictionaryDropOnSegmentList(event, kind));
  });
  document.addEventListener("pointermove", handleSegmentPointerMove);
  document.addEventListener("pointerup", handleSegmentPointerEnd);
  document.addEventListener("pointercancel", handleSegmentPointerEnd);
  document.querySelectorAll(".segment-toolbar").forEach((toolbar) => {
    toolbar.addEventListener("click", handleSegmentToolbarClick);
  });

  el.selectedDetail.addEventListener("input", handleDetailInput);
  el.selectedDetail.addEventListener("click", handleDetailClick);

  el.exportDataBtn.addEventListener("click", exportData);
  el.importDataInput.addEventListener("change", importData);
  el.resetAllBtn.addEventListener("click", resetAllData);

  el.translateBtn.addEventListener("click", () => translateCurrentInput());
  el.retranslateBtn.addEventListener("click", () => translateCurrentInput({ forceAi: true, overwriteDictionary: true }));
}

function bindLibraryEvents() {
  el.libraryForm.addEventListener("submit", saveLibraryItem);
  el.libraryCancelBtn.addEventListener("click", resetLibraryForm);
  el.librarySearch.addEventListener("input", renderLibrary);
  el.libraryCategoryFilter.addEventListener("change", renderLibrary);
  el.libraryList.addEventListener("click", handleLibraryClick);
}

function bindTemplateEvents() {
  el.templateForm.addEventListener("submit", saveTemplate);
  el.templateCancelBtn.addEventListener("click", resetTemplateForm);
  el.fillTemplateFromCurrentBtn.addEventListener("click", fillTemplateFromCurrent);
  el.templateSearch.addEventListener("input", renderTemplates);
  el.templateList.addEventListener("click", handleTemplateClick);
}

function bindDictionaryEvents() {
  el.dictionaryForm.addEventListener("submit", saveDictionaryItem);
  el.dictionaryCancelBtn.addEventListener("click", resetDictionaryForm);
  el.addSelectedToDictionaryBtn.addEventListener("click", addSelectedSegmentToDictionary);
  el.autoClassifyDictionaryBtn.addEventListener("click", autoClassifyUncategorizedDictionary);
  el.reclassifyDictionaryBtn.addEventListener("click", reclassifyAllDictionary);
  el.dictionarySearch.addEventListener("input", renderDictionary);
  el.dictionaryCategoryFilter.addEventListener("change", renderDictionary);
  el.dictionaryList.addEventListener("pointerdown", handleDictionaryPointerDown);
  el.dictionaryList.addEventListener("click", handleDictionaryClick);
  el.dictionaryList.addEventListener("focusin", handleDictionaryFocus);
  el.dictionaryList.addEventListener("dragstart", handleDictionaryDragStart);
  el.dictionaryList.addEventListener("dragend", handleDictionaryDragEnd);
  el.dictionaryToolbar.addEventListener("click", handleDictionaryToolbarClick);
}

function bindSettingsEvents() {
  [el.aiProvider, el.aiModel, el.aiApiKey, el.aiEndpoint, el.showAiProcess, el.enableDeepSeekThinking].forEach((input) => {
    const eventName = input.type === "checkbox" ? "change" : "input";
    input.addEventListener(eventName, () => {
      if (input === el.aiProvider && el.aiProvider.value === "deepseek") {
        applyDeepSeekDefaults({ keepApiKey: true, onlyFillEmpty: true });
      }
      syncSettingsFromInputs();
      updateAiProcessVisibility();
    });
  });

  el.promptApiKeyBtn.addEventListener("click", promptForApiKey);
  el.useDeepSeekDefaultsBtn.addEventListener("click", () => {
    applyDeepSeekDefaults({ keepApiKey: true, onlyFillEmpty: false });
    syncSettingsFromInputs();
    showToast("已填入 DeepSeek 默认设置");
  });
  el.testAiBtn.addEventListener("click", testAiConnection);
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabName + "Tab");
  });
}

function switchPromptTab(kind) {
  document.querySelectorAll(".prompt-tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.promptTab === kind);
  });
  document.querySelectorAll(".editor-panel[data-kind]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.kind === kind);
  });
}

function renderAll() {
  renderSettings();
  renderPromptArea("positive");
  renderPromptArea("negative");
  renderSelectedDetail();
  renderCategoryFilters();
  renderLibrary();
  renderTemplates();
  renderDictionary();
  updateUndoControl();
}

function renderSettings() {
  el.aiProvider.value = state.settings.provider || "mock";
  el.aiModel.value = state.settings.model || "";
  el.aiApiKey.value = state.settings.apiKey || "";
  el.aiEndpoint.value = state.settings.endpoint || "";
  el.showAiProcess.checked = state.settings.showAiProcess !== false;
  el.enableDeepSeekThinking.checked = state.settings.enableDeepSeekThinking !== false;
  updateAiProcessVisibility();
}

function syncSettingsFromInputs() {
  const nextSettings = getSettingsFromInputs();
  if (JSON.stringify(state.settings) === JSON.stringify(nextSettings)) return;

  captureUndoStep("settings");
  state.settings = nextSettings;
  saveState();
}

function getSettingsFromInputs() {
  return {
    provider: el.aiProvider.value,
    model: el.aiModel.value.trim(),
    apiKey: el.aiApiKey.value,
    endpoint: el.aiEndpoint.value.trim(),
    showAiProcess: el.showAiProcess.checked,
    enableDeepSeekThinking: el.enableDeepSeekThinking.checked
  };
}

function updateAiProcessVisibility() {
  if (!el.aiProcessBlock) return;
  el.aiProcessBlock.hidden = !el.showAiProcess.checked;
}

function applyDeepSeekDefaults(options = {}) {
  const keepApiKey = options.keepApiKey !== false;
  const onlyFillEmpty = Boolean(options.onlyFillEmpty);
  el.aiProvider.value = "deepseek";
  if (!onlyFillEmpty || !el.aiModel.value.trim()) el.aiModel.value = "deepseek-v4-flash";
  if (!onlyFillEmpty || !el.aiEndpoint.value.trim()) el.aiEndpoint.value = "https://api.deepseek.com";
  if (!keepApiKey) el.aiApiKey.value = "";
}

function promptForApiKey() {
  const key = window.prompt("请输入 DeepSeek API Key。它只会保存在当前浏览器中，不会随 JSON 导入或导出：", "");
  if (key === null) return;
  const trimmed = key.trim();
  if (!trimmed) {
    showToast("API Key 未修改");
    return;
  }
  el.aiApiKey.value = trimmed;
  if (el.aiProvider.value === "mock") applyDeepSeekDefaults({ keepApiKey: true, onlyFillEmpty: true });
  syncSettingsFromInputs();
  showToast("API Key 已保存到本地浏览器");
}

function renderPromptArea(kind) {
  const segments = state.prompts[kind];
  const list = kind === "positive" ? el.positiveSegments : el.negativeSegments;
  const count = kind === "positive" ? el.positiveCount : el.negativeCount;
  const output = kind === "positive" ? el.positiveOutput : el.negativeOutput;
  const chineseOutput = kind === "positive" ? el.positiveChineseOutput : el.negativeChineseOutput;
  const hint = kind === "positive" ? el.positiveSelectedHint : el.negativeSelectedHint;

  list.innerHTML = "";
  segments.forEach((segment, index) => {
    const item = document.createElement("li");
    const isSelected = state.selected.kind === kind && state.selected.id === segment.id;
    const translation = getDictionaryChineseTranslation(segment.text);
    item.className = [
      "segment-item",
      isSelected ? "selected" : "",
      index > 0 && segment.lineBreakBefore ? "line-break-before" : ""
    ]
      .filter(Boolean)
      .join(" ");
    item.dataset.id = segment.id;
    item.innerHTML = `
      <span class="segment-break-marker">↵ 换行</span>
      <span class="segment-index">${index + 1}</span>
      <input class="segment-text" type="text" value="${escapeAttr(segment.text)}" placeholder="待输入" aria-label="分段文本" />
      <span class="segment-translation${translation ? "" : " empty"}" title="${translation ? `中文翻译：${escapeAttr(translation)}` : ""}">${translation ? `译：${escapeHtml(translation)}` : ""}</span>
      <input class="segment-weight weight-input" type="number" min="0.1" step="0.1" value="${formatWeight(segment.weight)}" aria-label="权重" />
    `;
    list.appendChild(item);
  });

  count.textContent = `${segments.length} 段`;
  if (kind === "positive") {
    el.positiveTabCount.textContent = String(segments.length);
  } else {
    el.negativeTabCount.textContent = String(segments.length);
  }
  output.value = buildPrompt(kind);
  chineseOutput.value = buildChineseReference(kind);
  const selectedIndex = state.selected.kind === kind ? segments.findIndex((segment) => segment.id === state.selected.id) : -1;
  hint.textContent = selectedIndex >= 0 ? `选中第 ${selectedIndex + 1} 段` : "未选中：先点击分段";
}

function renderSelectedDetail() {
  const selected = getSelectedSegment();
  if (!selected) {
    el.selectedDetail.className = "detail-box empty-state";
    el.selectedDetail.innerHTML = "请选择一个分段";
    return;
  }

  el.selectedDetail.className = "detail-box";
  el.selectedDetail.innerHTML = `
    <div class="item-meta">${state.selected.kind === "positive" ? "正向分段" : "负向分段"}</div>
    <label>
      文本
      <textarea id="detailText" rows="4">${escapeHtml(selected.text)}</textarea>
    </label>
    <label>
      权重
      <input id="detailWeight" type="number" min="0.1" step="0.1" value="${formatWeight(selected.weight)}" />
    </label>
    <div class="button-row">
      <button type="button" class="secondary" data-action="detail-weight-down">降低</button>
      <button type="button" class="secondary" data-action="detail-weight-up">增加</button>
    </div>
    <div class="button-row">
      <button type="button" data-action="detail-to-translate">放入翻译</button>
      <button type="button" class="secondary" data-action="detail-add-dictionary">加入字典</button>
      <button type="button" class="danger" data-action="detail-delete">删除</button>
    </div>
  `;
}

function parsePromptFromInput(kind) {
  const input = kind === "positive" ? el.positiveInput : el.negativeInput;
  const segments = splitPrompt(input.value);
  const label = kind === "positive" ? "正向提示词" : "负向提示词";

  if (!segments.length) {
    showToast("草稿里没有可分段的内容");
    return;
  }

  if (!confirm(`替换分段会用草稿中的 ${segments.length} 个分段覆盖当前${label}的 ${state.prompts[kind].length} 个分段。\n\n确定继续吗？`)) {
    return;
  }

  captureUndoStep();
  state.prompts[kind] = segments;
  state.selected = segments[0] ? { kind, id: segments[0].id } : { kind, id: null };
  saveState();
  renderAll();
  showToast(`已替换为 ${segments.length} 段`);
}

function appendPromptFromInput(kind, position = "bottom") {
  const input = kind === "positive" ? el.positiveInput : el.negativeInput;
  const segments = splitPrompt(input.value);
  const label = kind === "positive" ? "正向提示词" : "负向提示词";
  const isTop = position === "top";
  const positionLabel = isTop ? "顶部" : "底部";

  if (!segments.length) {
    showToast("草稿里没有可追加的分段");
    return;
  }

  if (!confirm(`追加到${positionLabel}会保留当前${label}的 ${state.prompts[kind].length} 个分段，并在${isTop ? "开头" : "末尾"}加入草稿中的 ${segments.length} 个分段。\n\n确定继续吗？`)) {
    return;
  }

  captureUndoStep();
  if (isTop) {
    state.prompts[kind].unshift(...segments);
  } else {
    state.prompts[kind].push(...segments);
  }
  state.selected = { kind, id: segments[0].id };
  saveState();
  renderAll();
  showToast(`已追加到${positionLabel}：${segments.length} 段`);
}

function splitPrompt(text) {
  const segments = [];
  let pendingLineBreak = false;

  String(text || "")
    .split(/[，,]/)
    .forEach((part, index) => {
      const hasBreakBefore = index > 0 && (pendingLineBreak || hasLeadingLineBreak(part));
      const parsed = parseSegment(part);

      if (parsed) {
        parsed.lineBreakBefore = segments.length > 0 && hasBreakBefore;
        segments.push(parsed);
        pendingLineBreak = hasTrailingLineBreak(part);
        return;
      }

      pendingLineBreak = pendingLineBreak || hasAnyLineBreak(part);
    });

  return segments;
}

function parseSegment(rawText) {
  const raw = rawText.trim();
  if (!raw) return null;

  // 识别 Stable Diffusion 常见权重写法，例如：(white hair:1.3)。
  const weighted = raw.match(/^\((.*):\s*([0-9]+(?:\.[0-9]+)?)\)$/);
  if (weighted) {
    const text = weighted[1].trim();
    const weight = Number.parseFloat(weighted[2]);
    if (text && Number.isFinite(weight)) {
      return createSegment(text, weight);
    }
  }

  return createSegment(raw, 1);
}

function createSegment(text, weight = 1, options = {}) {
  return {
    id: uid("seg"),
    text: text.trim(),
    weight: normalizeWeight(weight),
    lineBreakBefore: Boolean(options.lineBreakBefore)
  };
}

function normalizeSegment(segment) {
  if (!segment) return null;
  const text = String(segment.text || "").trim();
  return {
    id: segment.id || uid("seg"),
    text,
    weight: normalizeWeight(segment.weight),
    lineBreakBefore: Boolean(segment.lineBreakBefore)
  };
}

function normalizeWeight(weight) {
  const numeric = Number.parseFloat(weight);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(0.1, Math.round(numeric * 100) / 100);
}

function formatWeight(weight) {
  const rounded = normalizeWeight(weight);
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

function formatSegment(segment) {
  const text = String(segment.text || "").trim();
  if (!text) return "";
  const weight = normalizeWeight(segment.weight);
  if (Math.abs(weight - 1) < 0.001) return text;
  return `(${text}:${formatWeight(weight)})`;
}

function buildPrompt(kind) {
  return joinSegmentTexts(state.prompts[kind], formatSegment, ",\n", ", ");
}

function buildChineseReference(kind) {
  return joinSegmentTexts(
    state.prompts[kind],
    (segment) => {
      if (!String(segment.text || "").trim()) return "";
      if (hasChineseText(segment.text)) return segment.text;
      return getDictionaryChineseTranslation(segment.text) || segment.text;
    },
    "，\n",
    "，"
  );
}

function joinSegmentTexts(segments, formatter, lineBreakSeparator, inlineSeparator) {
  let output = "";

  segments.forEach((segment) => {
    const text = formatter(segment);
    if (!text) return;

    if (!output) {
      output = text;
      return;
    }

    output += `${segment.lineBreakBefore ? lineBreakSeparator : inlineSeparator}${text}`;
  });

  return output;
}

function hasAnyLineBreak(value) {
  return /[\r\n]/.test(String(value || ""));
}

function hasLeadingLineBreak(value) {
  const leadingWhitespace = String(value || "").match(/^\s*/)?.[0] || "";
  return hasAnyLineBreak(leadingWhitespace);
}

function hasTrailingLineBreak(value) {
  const trailingWhitespace = String(value || "").match(/\s*$/)?.[0] || "";
  return hasAnyLineBreak(trailingWhitespace);
}

function updatePromptOutput(kind) {
  const output = kind === "positive" ? el.positiveOutput : el.negativeOutput;
  const chineseOutput = kind === "positive" ? el.positiveChineseOutput : el.negativeChineseOutput;
  const count = kind === "positive" ? el.positiveCount : el.negativeCount;
  output.value = buildPrompt(kind);
  chineseOutput.value = buildChineseReference(kind);
  count.textContent = `${state.prompts[kind].length} 段`;
  if (kind === "positive") {
    el.positiveTabCount.textContent = String(state.prompts[kind].length);
  } else {
    el.negativeTabCount.textContent = String(state.prompts[kind].length);
  }
}

function handleSegmentClick(event, kind) {
  const item = event.target.closest(".segment-item");
  if (!item) return;

  const segment = findSegment(kind, item.dataset.id);
  if (!segment) return;

  state.selected = { kind, id: segment.id };

  updateSegmentSelectionUi();
  renderSelectedDetail();
}

function handleSegmentFocus(event, kind) {
  const item = event.target.closest(".segment-item");
  if (!item) return;

  const segment = findSegment(kind, item.dataset.id);
  if (!segment) return;

  state.selected = { kind, id: segment.id };
  updateSegmentSelectionUi();
  renderSelectedDetail();
}

function handleSegmentToolbarClick(event) {
  const button = event.target.closest("button[data-action]");
  const toolbar = event.target.closest(".segment-toolbar");
  if (!button || !toolbar) return;

  const kind = toolbar.dataset.kind;
  if (state.selected.kind !== kind || !state.selected.id) {
    showToast("请先点击一个分段，再使用工具栏");
    return;
  }

  runSegmentAction(kind, state.selected.id, button.dataset.action);
}

function updateSegmentSelectionUi() {
  [
    { kind: "positive", list: el.positiveSegments, hint: el.positiveSelectedHint },
    { kind: "negative", list: el.negativeSegments, hint: el.negativeSelectedHint }
  ].forEach(({ kind, list, hint }) => {
    const segments = state.prompts[kind];
    const selectedIndex = state.selected.kind === kind ? segments.findIndex((segment) => segment.id === state.selected.id) : -1;
    hint.textContent = selectedIndex >= 0 ? `选中第 ${selectedIndex + 1} 段` : "未选中：先点击分段";

    list.querySelectorAll(".segment-item").forEach((item) => {
      item.classList.toggle("selected", state.selected.kind === kind && item.dataset.id === state.selected.id);
    });
  });
}

function handleSegmentInput(event, kind) {
  const item = event.target.closest(".segment-item");
  if (!item) return;
  const segment = findSegment(kind, item.dataset.id);
  if (!segment) return;

  if (event.target.classList.contains("segment-text")) {
    captureUndoStep(`segment:${kind}:${segment.id}:text`);
    segment.text = event.target.value.trimStart();
    updateSegmentTranslationCell(item, segment.text);
  }

  if (event.target.classList.contains("segment-weight")) {
    captureUndoStep(`segment:${kind}:${segment.id}:weight`);
    segment.weight = normalizeWeight(event.target.value);
  }

  state.selected = { kind, id: segment.id };
  saveState();
  updatePromptOutput(kind);
}

function handleSegmentPointerDown(event, kind) {
  if (event.button !== undefined && event.button !== 0) return;

  const item = event.target.closest(".segment-item");
  if (!item) return;

  const segment = findSegment(kind, item.dataset.id);
  if (!segment) return;

  clearSegmentDragTimer();
  segmentDragState = {
    kind,
    id: segment.id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
    changed: false,
    timer: window.setTimeout(startSegmentDrag, SEGMENT_DRAG_DELAY)
  };
}

function handleSegmentPointerMove(event) {
  if (!segmentDragState || event.pointerId !== segmentDragState.pointerId) return;

  const distance = Math.hypot(event.clientX - segmentDragState.startX, event.clientY - segmentDragState.startY);
  if (!segmentDragState.started) {
    if (distance > SEGMENT_DRAG_TOLERANCE) cancelSegmentDrag();
    return;
  }

  event.preventDefault();
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".segment-item");
  if (!target) return;

  const list = getSegmentList(segmentDragState.kind);
  if (!list.contains(target)) return;

  reorderSegmentByDrag(segmentDragState.kind, segmentDragState.id, target.dataset.id);
}

function handleSegmentPointerEnd(event) {
  if (!segmentDragState || event.pointerId !== segmentDragState.pointerId) return;

  const wasDragging = segmentDragState.started;
  const changed = segmentDragState.changed;
  clearSegmentDragTimer();
  clearSegmentDragClasses();
  segmentDragState = null;

  if (wasDragging) {
    event.preventDefault();
    if (changed) {
      saveState();
      renderAll();
      finishUndoGroup("segment-drag");
      showToast("已调整分段顺序");
    } else {
      updateSegmentSelectionUi();
    }
  } else {
    updateSegmentSelectionUi();
  }
}

function startSegmentDrag() {
  if (!segmentDragState) return;
  const item = getSegmentItem(segmentDragState.kind, segmentDragState.id);
  if (!item) {
    cancelSegmentDrag();
    return;
  }

  segmentDragState.started = true;
  state.selected = { kind: segmentDragState.kind, id: segmentDragState.id };
  document.body.classList.add("is-segment-dragging");
  getSegmentList(segmentDragState.kind).classList.add("drag-active");
  item.classList.add("dragging");
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  updateSegmentSelectionUi();
  renderSelectedDetail();
}

function reorderSegmentByDrag(kind, draggedId, targetId) {
  if (!targetId || draggedId === targetId) return;

  const segments = state.prompts[kind];
  const fromIndex = segments.findIndex((segment) => segment.id === draggedId);
  const toIndex = segments.findIndex((segment) => segment.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return;

  if (!segmentDragState.changed) captureUndoStep("segment-drag");
  const [dragged] = segments.splice(fromIndex, 1);
  segments.splice(toIndex, 0, dragged);
  segmentDragState.changed = true;
  state.selected = { kind, id: draggedId };
  renderPromptArea(kind);
  renderSelectedDetail();
  getSegmentList(kind).classList.add("drag-active");
  getSegmentItem(kind, draggedId)?.classList.add("dragging");
}

function cancelSegmentDrag() {
  clearSegmentDragTimer();
  clearSegmentDragClasses();
  segmentDragState = null;
}

function clearSegmentDragTimer() {
  if (segmentDragState?.timer) {
    window.clearTimeout(segmentDragState.timer);
    segmentDragState.timer = null;
  }
}

function clearSegmentDragClasses() {
  document.body.classList.remove("is-segment-dragging");
  el.positiveSegments.classList.remove("drag-active");
  el.negativeSegments.classList.remove("drag-active");
  document.querySelectorAll(".segment-item.dragging").forEach((item) => item.classList.remove("dragging"));
}

function handleDictionaryDragStart(event) {
  const card = event.target.closest(".dictionary-item");
  if (!card) return;

  const item = state.dictionary.find((entry) => entry.id === card.dataset.id);
  if (!item) return;

  if (!selectedDictionaryIds.has(item.id)) {
    selectedDictionaryIds = new Set([item.id]);
    dictionarySelectionAnchorId = item.id;
  }
  selectedDictionaryId = item.id;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(DICTIONARY_DRAG_MIME, item.id);
  event.dataTransfer.setData("text/plain", item.english || item.chinese);
  updateDictionarySelectionUi();
}

function handleDictionaryDragEnd() {
  clearDictionaryDragState();
}

function handleDictionaryDragOverSegmentList(event, kind) {
  if (!isDictionaryDragEvent(event)) return;

  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = "copy";
  const list = getSegmentList(kind);
  clearDictionaryDropTargets();
  list.classList.add("dictionary-drop-active");

  const target = event.target.closest(".segment-item");
  if (target && list.contains(target)) {
    target.classList.add("dictionary-drop-before");
  }
}

function handleDictionaryDragLeaveSegmentList(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  event.stopPropagation();
  event.currentTarget.classList.remove("dictionary-drop-active");
  clearDictionaryDropTargets();
}

function handleDictionaryDropOnSegmentList(event, kind) {
  if (!isDictionaryDragEvent(event)) return;

  event.preventDefault();
  event.stopPropagation();
  const itemId = event.dataTransfer.getData(DICTIONARY_DRAG_MIME);
  const item = state.dictionary.find((entry) => entry.id === itemId);
  const list = getSegmentList(kind);
  const target = event.target.closest(".segment-item");
  const targetId = target && list.contains(target) ? target.dataset.id : null;
  clearDictionaryDragState();
  if (!item) return;

  insertDictionaryItemAsSegment(item, kind, targetId);
}

function isDictionaryDragEvent(event) {
  return Array.from(event.dataTransfer?.types || []).includes(DICTIONARY_DRAG_MIME);
}

function clearDictionaryDragState() {
  el.positiveSegments.classList.remove("dictionary-drop-active");
  el.negativeSegments.classList.remove("dictionary-drop-active");
  el.dictionaryList.querySelectorAll(".dictionary-item.dragging").forEach((card) => card.classList.remove("dragging"));
  clearDictionaryDropTargets();
}

function clearDictionaryDropTargets() {
  document.querySelectorAll(".segment-item.dictionary-drop-before").forEach((item) => item.classList.remove("dictionary-drop-before"));
}

function getSegmentList(kind) {
  return kind === "positive" ? el.positiveSegments : el.negativeSegments;
}

function getSegmentItem(kind, id) {
  return Array.from(getSegmentList(kind).querySelectorAll(".segment-item")).find((item) => item.dataset.id === id) || null;
}

function focusSegmentText(kind, id) {
  window.requestAnimationFrame(() => {
    const item = getSegmentItem(kind, id);
    const input = item?.querySelector(".segment-text");
    if (!input) return;
    input.focus();
    input.select();
  });
}

function runSegmentAction(kind, id, action) {
  const segments = state.prompts[kind];
  const index = segments.findIndex((segment) => segment.id === id);
  if (index === -1) return;
  let changed = false;

  if (action === "weight-up") {
    captureUndoStep();
    segments[index].weight = normalizeWeight(segments[index].weight + 0.1);
    changed = true;
  }

  if (action === "weight-down") {
    captureUndoStep();
    segments[index].weight = normalizeWeight(segments[index].weight - 0.1);
    changed = true;
  }

  if (action === "move-up" && index > 0) {
    captureUndoStep();
    [segments[index - 1], segments[index]] = [segments[index], segments[index - 1]];
    changed = true;
  }

  if (action === "move-down" && index < segments.length - 1) {
    captureUndoStep();
    [segments[index + 1], segments[index]] = [segments[index], segments[index + 1]];
    changed = true;
  }

  if (action === "insert-after") {
    captureUndoStep();
    const blank = createSegment("", 1);
    segments.splice(index + 1, 0, blank);
    state.selected = { kind, id: blank.id };
    saveState();
    renderAll();
    focusSegmentText(kind, blank.id);
    showToast("已插入空白分段");
    return;
  }

  if (action === "line-break-before") {
    if (index === 0) {
      showToast("第一段前面没有可新增的行");
      return;
    }
    if (!segments[index].lineBreakBefore) {
      captureUndoStep();
      segments[index].lineBreakBefore = true;
      changed = true;
    }
  }

  if (action === "remove-line-break") {
    if (!segments[index].lineBreakBefore) {
      showToast("当前分段前没有换行");
      return;
    }
    captureUndoStep();
    segments[index].lineBreakBefore = false;
    changed = true;
  }

  if (action === "delete") {
    captureUndoStep();
    segments.splice(index, 1);
    const next = segments[index] || segments[index - 1] || null;
    state.selected = next ? { kind, id: next.id } : { kind, id: null };
    changed = true;
  }

  if (action === "add-dictionary") {
    addSegmentToDictionary(segments[index]);
    return;
  }

  if (!changed) return;
  saveState();
  renderAll();
}

function handleDetailInput(event) {
  const selected = getSelectedSegment();
  if (!selected) return;

  if (event.target.id === "detailText") {
    captureUndoStep(`detail:${state.selected.kind}:${selected.id}:text`);
    selected.text = event.target.value.trimStart();
  }

  if (event.target.id === "detailWeight") {
    captureUndoStep(`detail:${state.selected.kind}:${selected.id}:weight`);
    selected.weight = normalizeWeight(event.target.value);
  }

  saveState();
  renderPromptArea(state.selected.kind);
}

function handleDetailClick(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  const selected = getSelectedSegment();
  if (!selected) return;
  let changed = false;

  if (action === "detail-weight-up") {
    captureUndoStep();
    selected.weight = normalizeWeight(selected.weight + 0.1);
    changed = true;
  }

  if (action === "detail-weight-down") {
    captureUndoStep();
    selected.weight = normalizeWeight(selected.weight - 0.1);
    changed = true;
  }

  if (action === "detail-to-translate") {
    el.translateInput.value = selected.text;
    showToast("已放入翻译输入");
    return;
  }

  if (action === "detail-add-dictionary") {
    addSegmentToDictionary(selected);
    return;
  }

  if (action === "detail-delete") {
    deleteSelectedSegment();
    changed = true;
  }

  if (!changed) return;
  saveState();
  renderAll();
}

function deleteSelectedSegment() {
  const { kind, id } = state.selected;
  const segments = state.prompts[kind];
  const index = segments.findIndex((segment) => segment.id === id);
  if (index === -1) return;
  captureUndoStep();
  segments.splice(index, 1);
  const next = segments[index] || segments[index - 1] || null;
  state.selected = next ? { kind, id: next.id } : { kind, id: null };
}

function getSelectedSegment() {
  return findSegment(state.selected.kind, state.selected.id);
}

function findSegment(kind, id) {
  if (!id || !state.prompts?.[kind]) return null;
  return state.prompts[kind].find((segment) => segment.id === id) || null;
}

function segmentExistsInState(targetState, kind, id) {
  return Boolean(id && targetState.prompts?.[kind]?.some((segment) => segment.id === id));
}

function clearPrompt(kind) {
  const label = kind === "positive" ? "正向提示词" : "负向提示词";
  if (!confirm(`确定清空${label}？`)) return;
  captureUndoStep();
  state.prompts[kind] = [];
  if (state.selected.kind === kind) state.selected = { kind, id: null };
  saveState();
  renderAll();
}

async function copyPrompt(kind) {
  const text = buildPrompt(kind);
  if (!text) {
    showToast("没有可复制的提示词");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast(kind === "positive" ? "已复制正向提示词" : "已复制负向提示词");
  } catch (error) {
    const output = kind === "positive" ? el.positiveOutput : el.negativeOutput;
    output.select();
    document.execCommand("copy");
    showToast("已复制");
  }
}

async function copyChineseReference(kind) {
  const text = buildChineseReference(kind);
  if (!text) {
    showToast("没有可复制的中文对照");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast(kind === "positive" ? "已复制正向中文对照" : "已复制负向中文对照");
  } catch (error) {
    const output = kind === "positive" ? el.positiveChineseOutput : el.negativeChineseOutput;
    output.select();
    document.execCommand("copy");
    showToast("已复制中文对照");
  }
}

function saveLibraryItem(event) {
  event.preventDefault();
  const id = el.libraryEditId.value || uid("lib");
  const item = normalizeLibraryItem({
    id,
    title: el.libraryTitle.value,
    prompt: el.libraryPrompt.value,
    category: el.libraryCategory.value,
    tags: el.libraryTags.value,
    note: el.libraryNote.value
  });

  if (!item) {
    showToast("请填写提示词内容");
    return;
  }

  captureUndoStep();
  upsertById(state.library, item);
  resetLibraryForm();
  saveState();
  renderCategoryFilters();
  renderLibrary();
  showToast("提示词已保存");
}

function normalizeLibraryItem(item) {
  if (!item) return null;
  const legacyPrompt = String(item.english || item.chinese || "").trim();
  const prompt = String(item.prompt || legacyPrompt || "").trim();
  if (!prompt) return null;
  const title = String(item.title || item.chinese || item.english || prompt.slice(0, 32)).trim();

  return {
    id: item.id || uid("lib"),
    title: title || "未命名提示词组",
    prompt,
    category: String(item.category || "").trim(),
    tags: String(item.tags || "").trim(),
    note: String(item.note || "").trim()
  };
}

function renderLibrary() {
  const query = normalizeSearch(el.librarySearch.value);
  const category = el.libraryCategoryFilter.value;
  const items = state.library.filter((item) => {
    const matchesCategory = !category || item.category === category;
    const chineseReference = buildPromptTextChineseReference(item.prompt);
    const haystack = normalizeSearch([item.title, item.prompt, chineseReference, item.category, item.tags, item.note].join(" "));
    return matchesCategory && (!query || haystack.includes(query));
  });

  el.libraryList.innerHTML = "";
  if (!items.length) {
    el.libraryList.innerHTML = `<div class="empty-state">暂无提示词</div>`;
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    const chineseReference = buildPromptTextChineseReference(item.prompt);
    card.className = "library-item";
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="item-title">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="item-meta">${escapeHtml(item.category || "未分类")}</span>
      </div>
      <div class="item-meta">${escapeHtml(getPromptPreview(item.prompt))}</div>
      <div class="library-translation">译：${escapeHtml(getPromptPreview(chineseReference))}</div>
      <p class="item-meta">${splitPrompt(item.prompt).length} 段</p>
      ${renderTags(item.tags)}
      ${item.note ? `<p class="item-meta">${escapeHtml(item.note)}</p>` : ""}
      <div class="item-actions">
        <button type="button" data-action="insert-positive" title="追加到正向草稿">正向</button>
        <button type="button" data-action="insert-negative" class="secondary" title="追加到负向草稿">负向</button>
        <button type="button" data-action="edit" class="secondary" title="编辑">编</button>
        <button type="button" data-action="delete" class="danger" title="删除">删</button>
      </div>
    `;
    el.libraryList.appendChild(card);
  });
}

function handleLibraryClick(event) {
  const action = event.target.dataset.action;
  const card = event.target.closest(".library-item");
  if (!action || !card) return;

  const item = state.library.find((entry) => entry.id === card.dataset.id);
  if (!item) return;

  if (action === "insert-positive") insertLibraryItem(item, "positive");
  if (action === "insert-negative") insertLibraryItem(item, "negative");
  if (action === "edit") editLibraryItem(item);
  if (action === "delete") deleteLibraryItem(item.id);
}

function insertLibraryItem(item, kind) {
  const target = kind === "positive" ? el.positiveInput : el.negativeInput;
  appendTextToPromptInput(target, item.prompt);
  switchPromptTab(kind);
  target.focus();
  showToast(kind === "positive" ? "已追加到正向草稿" : "已追加到负向草稿");
}

function editLibraryItem(item) {
  el.libraryEditId.value = item.id;
  el.libraryTitle.value = item.title;
  el.libraryPrompt.value = item.prompt;
  el.libraryCategory.value = item.category;
  el.libraryTags.value = item.tags;
  el.libraryNote.value = item.note;
}

function deleteLibraryItem(id) {
  if (!confirm("确定删除这条提示词？")) return;
  captureUndoStep();
  state.library = state.library.filter((item) => item.id !== id);
  saveState();
  renderCategoryFilters();
  renderLibrary();
}

function resetLibraryForm() {
  el.libraryForm.reset();
  el.libraryEditId.value = "";
}

function appendTextToPromptInput(target, text) {
  const current = target.value.trimEnd();
  const addition = String(text || "").trim();
  if (!addition) return;
  target.value = current ? `${current}\n${addition}` : addition;
}

function getPromptPreview(prompt) {
  return String(prompt || "").replace(/\s+/g, " ").slice(0, 120);
}

function buildPromptTextChineseReference(prompt) {
  return joinSegmentTexts(
    splitPrompt(prompt),
    (segment) => {
      if (hasChineseText(segment.text)) return segment.text;
      return getDictionaryChineseTranslation(segment.text) || segment.text;
    },
    "，\n",
    "，"
  );
}

function saveTemplate(event) {
  event.preventDefault();
  const id = el.templateEditId.value || uid("tpl");
  const item = normalizeTemplate({
    id,
    name: el.templateName.value,
    positive: el.templatePositive.value,
    negative: el.templateNegative.value,
    tags: el.templateTags.value,
    note: el.templateNote.value
  });

  if (!item) {
    showToast("请填写模板名称");
    return;
  }

  captureUndoStep();
  upsertById(state.templates, item);
  resetTemplateForm();
  saveState();
  renderTemplates();
  showToast("模板已保存");
}

function normalizeTemplate(item) {
  if (!item) return null;
  const name = String(item.name || "").trim();
  if (!name) return null;
  return {
    id: item.id || uid("tpl"),
    name,
    positive: String(item.positive || "").trim(),
    negative: String(item.negative || "").trim(),
    tags: String(item.tags || "").trim(),
    note: String(item.note || "").trim()
  };
}

function fillTemplateFromCurrent() {
  el.templatePositive.value = buildPrompt("positive");
  el.templateNegative.value = buildPrompt("negative");
  showToast("已填入当前提示词");
}

function renderTemplates() {
  const query = normalizeSearch(el.templateSearch.value);
  const items = state.templates.filter((item) => {
    const haystack = normalizeSearch([item.name, item.positive, item.negative, item.tags, item.note].join(" "));
    return !query || haystack.includes(query);
  });

  el.templateList.innerHTML = "";
  if (!items.length) {
    el.templateList.innerHTML = `<div class="empty-state">暂无模板</div>`;
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "template-item";
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="item-title">
        <strong>${escapeHtml(item.name)}</strong>
      </div>
      ${renderTags(item.tags)}
      ${item.note ? `<p class="item-meta">${escapeHtml(item.note)}</p>` : ""}
      <p class="item-meta">正向 ${splitPrompt(item.positive).length} 段 · 负向 ${splitPrompt(item.negative).length} 段</p>
      <div class="item-actions template-actions">
        <button type="button" data-action="load" title="套用模板">套用</button>
        <button type="button" data-action="edit" class="secondary" title="编辑">编</button>
        <button type="button" data-action="delete" class="danger" title="删除">删</button>
      </div>
    `;
    el.templateList.appendChild(card);
  });
}

function handleTemplateClick(event) {
  const action = event.target.dataset.action;
  const card = event.target.closest(".template-item");
  if (!action || !card) return;

  const item = state.templates.find((entry) => entry.id === card.dataset.id);
  if (!item) return;

  if (action === "load") loadTemplate(item);
  if (action === "edit") editTemplate(item);
  if (action === "delete") deleteTemplate(item.id);
}

function loadTemplate(item) {
  const currentCount = state.prompts.positive.length + state.prompts.negative.length;
  if (
    currentCount > 0 &&
    !confirm(`套用模板会替换当前正向和负向分段，可通过撤回恢复。\n\n确定套用“${item.name}”吗？`)
  ) {
    return;
  }

  captureUndoStep();
  state.prompts.positive = splitPrompt(item.positive);
  state.prompts.negative = splitPrompt(item.negative);
  el.positiveInput.value = item.positive;
  el.negativeInput.value = item.negative;

  const first = state.prompts.positive[0] || state.prompts.negative[0] || null;
  state.selected = first
    ? { kind: state.prompts.positive[0] ? "positive" : "negative", id: first.id }
    : { kind: "positive", id: null };

  saveState();
  renderAll();
  showToast("模板已套用");
}

function editTemplate(item) {
  el.templateEditId.value = item.id;
  el.templateName.value = item.name;
  el.templatePositive.value = item.positive;
  el.templateNegative.value = item.negative;
  el.templateTags.value = item.tags;
  el.templateNote.value = item.note;
}

function deleteTemplate(id) {
  if (!confirm("确定删除这个模板？")) return;
  captureUndoStep();
  state.templates = state.templates.filter((item) => item.id !== id);
  saveState();
  renderTemplates();
}

function resetTemplateForm() {
  el.templateForm.reset();
  el.templateEditId.value = "";
}

function saveDictionaryItem(event) {
  event.preventDefault();
  const id = el.dictionaryEditId.value || uid("dict");
  const item = normalizeDictionaryItem({
    id,
    chinese: el.dictionaryChinese.value,
    english: el.dictionaryEnglish.value,
    category: el.dictionaryCategory.value,
    aliases: el.dictionaryAliases.value,
    note: el.dictionaryNote.value
  });

  if (!item) {
    showToast("请填写中文或英文词条");
    return;
  }

  captureUndoStep();
  upsertById(state.dictionary, item);
  selectedDictionaryId = item.id;
  selectedDictionaryIds = new Set([item.id]);
  dictionarySelectionAnchorId = item.id;
  resetDictionaryForm();
  saveState();
  renderCategoryFilters();
  renderDictionary();
  renderPromptArea("positive");
  renderPromptArea("negative");
  showToast("词条已保存");
}

function normalizeDictionaryItem(item) {
  if (!item) return null;
  const chinese = String(item.chinese || "").trim();
  const english = String(item.english || "").trim();
  if (!chinese && !english) return null;

  return {
    id: item.id || uid("dict"),
    chinese,
    english,
    category: String(item.category || "").trim(),
    aliases: String(item.aliases || "").trim(),
    note: String(item.note || "").trim()
  };
}

function renderDictionary() {
  const items = getVisibleDictionaryItems();
  syncDictionarySelectionWithState(items);

  el.dictionaryList.innerHTML = "";
  if (!items.length) {
    el.dictionaryList.innerHTML = `<div class="empty-state">暂无词条</div>`;
    updateDictionarySelectionUi();
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    const isSelected = selectedDictionaryIds.has(item.id);
    card.className = "dictionary-item" + (isSelected ? " selected" : "");
    card.dataset.id = item.id;
    card.draggable = true;
    card.setAttribute("draggable", "true");
    card.tabIndex = 0;
    card.setAttribute("aria-selected", String(isSelected));
    card.setAttribute("title", "点击选中，Ctrl/Shift 或复选框可多选；拖到分段列表可加入为分段");
    card.innerHTML = `
      <input class="dictionary-select" type="checkbox" aria-label="选择词条" ${isSelected ? "checked" : ""} />
      <div class="dictionary-main">
        <strong title="${escapeAttr(item.chinese || item.english)}">${escapeHtml(item.chinese || item.english)}</strong>
        <span title="${escapeAttr(item.english || item.chinese)}">${escapeHtml(item.english || item.chinese)}</span>
      </div>
      <div class="dictionary-meta">
        <span>${escapeHtml(item.category || "未分类")}</span>
      </div>
    `;
    el.dictionaryList.appendChild(card);
  });

  updateDictionarySelectionUi();
}

function getVisibleDictionaryItems() {
  const query = normalizeSearch(el.dictionarySearch.value);
  const category = el.dictionaryCategoryFilter.value;
  return state.dictionary.filter((item) => {
    const matchesCategory = !category || item.category === category;
    const haystack = normalizeSearch([item.chinese, item.english, item.category, item.aliases, item.note].join(" "));
    return matchesCategory && (!query || haystack.includes(query));
  });
}

function handleDictionaryPointerDown() {
  dictionaryPointerActive = true;
  window.setTimeout(() => {
    dictionaryPointerActive = false;
  }, 0);
}

function handleDictionaryClick(event) {
  const card = event.target.closest(".dictionary-item");
  if (!card) return;

  const checkbox = event.target.closest(".dictionary-select");
  if (!checkbox) card.focus();

  const mode = event.shiftKey ? "range" : checkbox || event.ctrlKey || event.metaKey ? "toggle" : "replace";
  selectDictionaryItem(card.dataset.id, { mode });
}

function handleDictionaryFocus(event) {
  if (dictionaryPointerActive || event.target.closest(".dictionary-select")) return;
  const card = event.target.closest(".dictionary-item");
  if (!card) return;
  selectDictionaryItem(card.dataset.id, { mode: "replace" });
}

async function handleDictionaryToolbarClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const items = getSelectedDictionaryItems();
  if (!items.length) {
    showToast("请先选中一个词条");
    return;
  }

  const item = getSelectedDictionaryItem() || items[0];
  const action = button.dataset.action;
  if (action === "edit") editDictionaryItem(item);
  if (action === "delete") deleteDictionaryItems(items);
  if (action === "insert-positive") insertDictionaryItems(items, "positive");
  if (action === "insert-negative") insertDictionaryItems(items, "negative");
  if (action === "reclassify") await reclassifySelectedDictionaryItems(button);
}

function selectDictionaryItem(id, options = {}) {
  const item = state.dictionary.find((entry) => entry.id === id);
  if (!item) return;
  const mode = options.mode || "replace";

  if (mode === "range") {
    selectDictionaryRange(item.id);
  } else if (mode === "toggle") {
    if (selectedDictionaryIds.has(item.id)) {
      selectedDictionaryIds.delete(item.id);
      selectedDictionaryId = selectedDictionaryId === item.id ? firstSelectedDictionaryId() : selectedDictionaryId;
    } else {
      selectedDictionaryIds.add(item.id);
      selectedDictionaryId = item.id;
    }
    dictionarySelectionAnchorId = item.id;
  } else {
    selectedDictionaryIds = new Set([item.id]);
    selectedDictionaryId = item.id;
    dictionarySelectionAnchorId = item.id;
  }

  if (!selectedDictionaryIds.size) selectedDictionaryId = null;
  if (!selectedDictionaryId && selectedDictionaryIds.size) selectedDictionaryId = firstSelectedDictionaryId();
  updateDictionarySelectionUi();
  const selectedItem = getSelectedDictionaryItem();
  if (options.edit !== false && selectedItem) editDictionaryItem(selectedItem);
  if (options.edit !== false && !selectedItem) resetDictionaryForm();
}

function getSelectedDictionaryItem() {
  return state.dictionary.find((entry) => entry.id === selectedDictionaryId) || null;
}

function getSelectedDictionaryItems() {
  return state.dictionary.filter((entry) => selectedDictionaryIds.has(entry.id));
}

function firstSelectedDictionaryId() {
  return selectedDictionaryIds.values().next().value || null;
}

function selectDictionaryRange(id) {
  const visibleIds = getVisibleDictionaryItems().map((item) => item.id);
  const anchor = dictionarySelectionAnchorId && visibleIds.includes(dictionarySelectionAnchorId) ? dictionarySelectionAnchorId : selectedDictionaryId;
  if (!anchor || !visibleIds.includes(anchor)) {
    selectedDictionaryIds = new Set([id]);
    selectedDictionaryId = id;
    dictionarySelectionAnchorId = id;
    return;
  }

  const start = visibleIds.indexOf(anchor);
  const end = visibleIds.indexOf(id);
  const [from, to] = start <= end ? [start, end] : [end, start];
  visibleIds.slice(from, to + 1).forEach((entryId) => selectedDictionaryIds.add(entryId));
  selectedDictionaryId = id;
}

function syncDictionarySelectionWithState(visibleItems = state.dictionary) {
  const validIds = new Set(visibleItems.map((item) => item.id));
  selectedDictionaryIds = new Set([...selectedDictionaryIds].filter((id) => validIds.has(id)));
  if (selectedDictionaryId && !validIds.has(selectedDictionaryId)) selectedDictionaryId = firstSelectedDictionaryId();
  if (!selectedDictionaryId && selectedDictionaryIds.size) selectedDictionaryId = firstSelectedDictionaryId();
  if (dictionarySelectionAnchorId && !validIds.has(dictionarySelectionAnchorId)) dictionarySelectionAnchorId = selectedDictionaryId;
  if (!state.dictionary.some((item) => item.id === selectedDictionaryId)) selectedDictionaryId = null;
}

function updateDictionarySelectionUi() {
  syncDictionarySelectionWithState();
  const selectedItems = getSelectedDictionaryItems();
  const selectedItem = getSelectedDictionaryItem();
  const selectedLabel = selectedItem ? selectedItem.chinese || selectedItem.english : "";
  el.dictionarySelectedHint.textContent = selectedItems.length > 1 ? `已选 ${selectedItems.length} 个词条` : selectedItem ? `选中：${selectedLabel}` : "未选中词条";
  el.dictionaryToolbar.classList.toggle("active", selectedItems.length > 0);

  el.dictionaryList.querySelectorAll(".dictionary-item").forEach((card) => {
    const isSelected = selectedDictionaryIds.has(card.dataset.id);
    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-selected", String(isSelected));
    const checkbox = card.querySelector(".dictionary-select");
    if (checkbox) checkbox.checked = isSelected;
  });
}

function editDictionaryItem(item) {
  el.dictionaryEditId.value = item.id;
  el.dictionaryChinese.value = item.chinese;
  el.dictionaryEnglish.value = item.english;
  el.dictionaryCategory.value = item.category;
  el.dictionaryAliases.value = item.aliases;
  el.dictionaryNote.value = item.note;
}

function deleteDictionaryItem(id) {
  const item = state.dictionary.find((entry) => entry.id === id);
  if (item) deleteDictionaryItems([item]);
}

function deleteDictionaryItems(items) {
  const validItems = items.filter(Boolean);
  if (!validItems.length) {
    showToast("请先选中词条");
    return;
  }

  const confirmText = validItems.length === 1 ? "确定删除这个词条？" : `确定删除选中的 ${validItems.length} 个词条？`;
  if (!confirm(confirmText)) return;

  const ids = new Set(validItems.map((item) => item.id));
  captureUndoStep();
  state.dictionary = state.dictionary.filter((item) => !ids.has(item.id));
  selectedDictionaryIds = new Set([...selectedDictionaryIds].filter((id) => !ids.has(id)));
  if (selectedDictionaryId && ids.has(selectedDictionaryId)) selectedDictionaryId = firstSelectedDictionaryId();
  if (!selectedDictionaryIds.size) {
    selectedDictionaryId = null;
    dictionarySelectionAnchorId = null;
    resetDictionaryForm();
  }
  saveState();
  renderCategoryFilters();
  renderDictionary();
  renderPromptArea("positive");
  renderPromptArea("negative");
  showToast(validItems.length === 1 ? "词条已删除" : `已删除 ${validItems.length} 个词条`);
}

function insertDictionaryItem(item, kind) {
  insertDictionaryItems([item], kind);
}

function insertDictionaryItems(items, kind) {
  const texts = items.map((item) => item.english || item.chinese).map((text) => String(text || "").trim()).filter(Boolean);
  if (!texts.length) {
    showToast("选中词条没有可插入内容");
    return;
  }

  const target = kind === "positive" ? el.positiveInput : el.negativeInput;
  appendTextToPromptInput(target, texts.join(", "));
  switchPromptTab(kind);
  target.focus();
  const targetName = kind === "positive" ? "正向草稿" : "负向草稿";
  showToast(texts.length === 1 ? `已追加到${targetName}` : `已追加 ${texts.length} 个词条到${targetName}`);
}

function insertDictionaryItemAsSegment(item, kind, targetId = null) {
  const text = String(item.english || item.chinese || "").trim();
  if (!text) return;

  const segment = createSegment(text, 1);
  const segments = state.prompts[kind];
  const targetIndex = targetId ? segments.findIndex((entry) => entry.id === targetId) : -1;
  captureUndoStep();
  if (targetIndex >= 0) {
    segments.splice(targetIndex, 0, segment);
  } else {
    segments.push(segment);
  }
  state.selected = { kind, id: segment.id };
  saveState();
  switchPromptTab(kind);
  renderAll();
  showToast(kind === "positive" ? "词条已加入正向分段" : "词条已加入负向分段");
}

function resetDictionaryForm() {
  el.dictionaryForm.reset();
  el.dictionaryEditId.value = "";
}

function addSelectedSegmentToDictionary() {
  const selected = getSelectedSegment();
  if (!selected) {
    showToast("请先选择一个分段");
    return;
  }
  addSegmentToDictionary(selected);
}

function addSegmentToDictionary(segment) {
  if (!segment?.text) return false;
  const isChinese = /[\u4e00-\u9fff]/.test(segment.text);
  const item = normalizeDictionaryItem({
    chinese: isChinese ? segment.text : "",
    english: isChinese ? "" : segment.text,
    category: "来自提示词",
    aliases: "",
    note: "从当前提示词分段加入"
  });

  const duplicate = state.dictionary.some((entry) => {
    return normalizeSearch(entry.chinese) === normalizeSearch(item.chinese) && normalizeSearch(entry.english) === normalizeSearch(item.english);
  });

  if (duplicate) {
    showToast("字典中已有相同词条");
    return false;
  }

  captureUndoStep();
  state.dictionary.unshift(item);
  saveState();
  renderCategoryFilters();
  renderDictionary();
  renderPromptArea("positive");
  renderPromptArea("negative");
  showToast("已加入字典");
  return true;
}

async function autoClassifyUncategorizedDictionary() {
  const items = state.dictionary.filter(isUncategorizedDictionaryItem);
  await classifyDictionaryItems(items, {
    button: el.autoClassifyDictionaryBtn,
    loadingText: "分类中...",
    emptyMessage: "没有未分类词条",
    failMessage: "AI 自动分类失败",
    startMessage: (count) => `开始为 ${count} 个未分类词条自动分类。`,
    batchMessage: (batchIndex, count) => `分类批次 ${batchIndex}：${count} 个词条。`,
    confirm: (count) => confirm(`将用 AI 为 ${count} 个未分类词条自动分类。\n\n分类结果会写回字典，可通过撤回恢复。确定继续吗？`),
    shouldUpdate: isUncategorizedDictionaryItem,
    successProcessMessage: (updated, changed, failed) => `自动分类完成：已更新 ${updated} 个词条${failed ? `，${failed} 个失败` : ""}。`,
    successToast: (updated, changed, failed) => failed ? `已自动分类 ${updated} 个，${failed} 个失败` : `已自动分类 ${updated} 个词条`
  });
}

async function reclassifyAllDictionary() {
  await classifyDictionaryItems(state.dictionary, {
    button: el.reclassifyDictionaryBtn,
    loadingText: "重分中...",
    emptyMessage: "字典暂无词条",
    failMessage: "AI 重新分类失败",
    startMessage: (count) => `开始重新分类全部 ${count} 个词条，分类会覆盖原值。`,
    batchMessage: (batchIndex, count) => `重分批次 ${batchIndex}：${count} 个词条。`,
    confirm: (count) => {
      const firstConfirm = confirm(`将用 AI 重新分类全部 ${count} 个词条，并覆盖原本分类。\n\n此操作可通过撤回恢复。确定继续吗？`);
      if (!firstConfirm) return false;
      return confirm(`二次确认：即将覆盖全部 ${count} 个词条的分类。\n\n确定执行 AI 重新分类吗？`);
    },
    successProcessMessage: (updated, changed, failed) => `全部重新分类完成：已处理 ${updated} 个词条，其中 ${changed} 个分类发生变化${failed ? `，${failed} 个失败` : ""}。`,
    successToast: (updated, changed, failed) => failed ? `已重新分类 ${updated} 个，${failed} 个失败` : `已重新分类 ${updated} 个词条`
  });
}

async function reclassifySelectedDictionaryItems(button) {
  const items = getSelectedDictionaryItems();
  if (!items.length) {
    showToast("请先选中一个词条");
    return;
  }

  const selectedItem = getSelectedDictionaryItem() || items[0];
  editDictionaryItem(selectedItem);
  await classifyDictionaryItems(items, {
    button,
    loadingText: "重分中",
    emptyMessage: "请先选中一个词条",
    failMessage: "选中词条重新分类失败",
    startMessage: (count) => count === 1 ? `开始重新分类词条：${selectedItem.chinese || selectedItem.english}` : `开始重新分类选中的 ${count} 个词条。`,
    batchMessage: (batchIndex, count) => count === 1 ? "正在为当前词条生成分类。" : `选中词条重分批次 ${batchIndex}：${count} 个词条。`,
    confirm: (count) => count === 1 || confirm(`将用 AI 重新分类选中的 ${count} 个词条，并覆盖这些词条的原分类。确定继续吗？`),
    editSelectedAfter: true,
    successProcessMessage: (updated, changed, failed) => {
      const failedText = failed ? `，${failed} 个失败` : "";
      return `选中词条重新分类完成：${updated} 个已处理，${changed} 个分类发生变化${failedText}。`;
    },
    successToast: (updated, changed, failed) => failed ? `已重分 ${updated} 个，${failed} 个失败` : `已重新分类 ${updated} 个词条`
  });
}

async function classifyDictionaryItems(items, options = {}) {
  if (!items.length) {
    showToast(options.emptyMessage || "没有需要分类的词条");
    return false;
  }

  syncSettingsFromInputs();
  if (OPENAI_COMPATIBLE_PROVIDERS.includes(state.settings.provider) && !String(state.settings.apiKey || "").trim()) {
    showToast("请先输入 AI API Key");
    return false;
  }

  if (options.confirm && !options.confirm(items.length)) return false;

  const button = options.button;
  const originalText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = options.loadingText || "分类中...";
  }

  resetAiProcess();
  appendProcessLine(typeof options.startMessage === "function" ? options.startMessage(items.length) : `开始为 ${items.length} 个词条分类。`);

  try {
    const categoryById = new Map();
    const failedIds = new Set();
    for (let index = 0; index < items.length; index += DICTIONARY_CLASSIFY_BATCH_SIZE) {
      const batch = items.slice(index, index + DICTIONARY_CLASSIFY_BATCH_SIZE);
      const batchIndex = Math.floor(index / DICTIONARY_CLASSIFY_BATCH_SIZE) + 1;
      appendProcessLine(typeof options.batchMessage === "function" ? options.batchMessage(batchIndex, batch.length) : `分类批次 ${batchIndex}：${batch.length} 个词条。`);
      const batchResult = await requestAiDictionaryCategoriesResilient(batch, { ...state.settings }, {
        onLog: appendProcessLine,
        onReasoning: appendReasoningToken
      }, 0);
      batchResult.categoryById.forEach((category, id) => categoryById.set(id, category));
      batchResult.failedItems.forEach((item) => failedIds.add(item.id));
    }

    if (!categoryById.size) {
      const failedCount = failedIds.size || items.length;
      showToast(`AI 未返回可用分类，${failedCount} 个词条未处理`);
      appendProcessLine(`AI 未返回可用分类，${failedCount} 个词条未处理。`);
      return false;
    }

    const targetIds = new Set(items.map((item) => item.id));
    captureUndoStep();
    let updated = 0;
    let changed = 0;
    const appliedIds = new Set();
    state.dictionary.forEach((item) => {
      if (!targetIds.has(item.id)) return;
      if (options.shouldUpdate && !options.shouldUpdate(item)) return;
      const category = categoryById.get(item.id);
      if (!category) return;
      if (item.category !== category) changed += 1;
      item.category = category;
      appliedIds.add(item.id);
      updated += 1;
    });
    appliedIds.forEach((id) => failedIds.delete(id));
    const failedCount = failedIds.size;

    if (!updated) {
      showToast("没有分类被更新");
      appendProcessLine("没有分类被更新。");
      return false;
    }

    saveState();
    renderCategoryFilters();
    renderDictionary();
    renderPromptArea("positive");
    renderPromptArea("negative");
    if (options.editSelectedAfter && targetIds.has(selectedDictionaryId)) {
      const selectedItem = getSelectedDictionaryItem();
      if (selectedItem) editDictionaryItem(selectedItem);
    }

    if (failedCount) appendProcessLine(`有 ${failedCount} 个词条未能完成分类，可再次点击重试。`);
    appendProcessLine(typeof options.successProcessMessage === "function" ? options.successProcessMessage(updated, changed, failedCount) : `分类完成：已更新 ${updated} 个词条${failedCount ? `，${failedCount} 个失败` : ""}。`);
    showToast(typeof options.successToast === "function" ? options.successToast(updated, changed, failedCount) : failedCount ? `已分类 ${updated} 个，${failedCount} 个失败` : `已分类 ${updated} 个词条`);
    return failedCount === 0;
  } catch (error) {
    console.error(error);
    appendProcessLine(getFriendlyErrorMessage(error));
    showToast(options.failMessage || "AI 分类失败");
    return false;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function isUncategorizedDictionaryItem(item) {
  const category = String(item?.category || "").trim();
  return !category || category === "未分类";
}

function renderCategoryFilters() {
  renderCategoryOptions(el.libraryCategoryFilter, state.library.map((item) => item.category));
  renderCategoryOptions(el.dictionaryCategoryFilter, state.dictionary.map((item) => item.category));
}

function renderCategoryOptions(select, categories) {
  const current = select.value;
  const unique = [...new Set(categories.map((item) => item.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  select.innerHTML = `<option value="">全部分类</option>`;
  unique.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
  select.value = unique.includes(current) ? current : "";
}

async function translateCurrentInput(options = {}) {
  const forceAi = Boolean(options.forceAi);
  const overwriteDictionary = Boolean(options.overwriteDictionary);
  const text = el.translateInput.value.trim();
  if (!text) {
    showToast("请输入要翻译的文本");
    return;
  }

  if (overwriteDictionary && !confirm("重新翻译会跳过本地字典，强制 AI 翻译所有分段，并用结果覆盖对应字典词条。\n\n确定继续吗？")) {
    return;
  }

  syncSettingsFromInputs();
  el.translateOutput.value = "";
  resetAiProcess();
  const direction = el.translateDirection.value;
  const resolvedDirection = resolveTranslationDirection(text, direction);
  const parts = splitPrompt(text);
  const units = parts.length > 1 ? parts.map((part) => part.text) : [text];
  const translated = [];
  const dictionaryGroupKey = overwriteDictionary ? "translation-overwrite" : "translation-cache";

  appendProcessLine(`开始${forceAi ? "重新" : ""}翻译：${getDirectionLabel(resolvedDirection)}${direction === "auto" ? "（自动识别）" : ""}`);
  if (forceAi) {
    appendProcessLine("重新翻译将跳过本地字典，所有分段都会交给 AI 处理。");
  }
  if (overwriteDictionary) {
    appendProcessLine("翻译结果会覆盖对应的字典词条。");
  }
  appendProcessLine(`共 ${units.length} 个分段。`);

  try {
    for (const [index, unit] of units.entries()) {
      let liveText = "";
      appendProcessLine(`分段 ${index + 1}：${unit}`);
      const translatedUnit = await translateText(unit, resolvedDirection, {
        onLog: appendProcessLine,
        onReasoning: (token) => appendReasoningToken(token),
        onContent: (token) => {
          liveText += token;
          el.translateOutput.value = joinTranslatedUnits(parts, [...translated, liveText]);
        }
      }, { forceAi });
      translated.push(translatedUnit);
      el.translateOutput.value = joinTranslatedUnits(parts, translated);
      if (overwriteDictionary || state.settings.provider !== "mock") {
        cacheTranslationPair(unit, translatedUnit, resolvedDirection, { onLog: appendProcessLine }, {
          groupKey: dictionaryGroupKey,
          overwrite: overwriteDictionary
        });
      }
    }
    saveState();
    renderCategoryFilters();
    renderDictionary();
    renderPromptArea("positive");
    renderPromptArea("negative");
    finishUndoGroup(dictionaryGroupKey);
    appendProcessLine(forceAi ? "重新翻译完成。" : "翻译完成。");
  } catch (error) {
    finishUndoGroup(dictionaryGroupKey);
    console.error(error);
    el.translateOutput.value = getFriendlyErrorMessage(error);
    showToast(forceAi ? "重新翻译失败" : "翻译失败");
  }
}

function joinTranslatedUnits(sourceSegments, translations) {
  if (sourceSegments.length <= 1) return translations.filter(Boolean).join(", ");

  return joinSegmentTexts(
    sourceSegments.map((segment, index) => ({
      ...segment,
      text: translations[index] || ""
    })),
    (segment) => segment.text,
    ",\n",
    ", "
  );
}

function resolveTranslationDirection(text, selectedDirection) {
  if (selectedDirection !== "auto") return selectedDirection;

  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  const hasEnglish = /[A-Za-z]/.test(text);

  // 中英混合时默认输出英文，避免把已有 SD 英文提示词翻回中文。
  if (hasChinese && hasEnglish) return "zh-en";
  if (hasChinese) return "zh-en";
  if (hasEnglish) return "en-zh";
  return "zh-en";
}

function getDirectionLabel(direction) {
  return direction === "zh-en" ? "中文 → 英文" : "英文 → 中文";
}

async function translateText(text, direction, callbacks = {}, options = {}) {
  const forceAi = Boolean(options.forceAi);
  if (!forceAi && isAlreadyTargetLanguage(text, direction)) {
    callbacks.onLog?.("该分段已是目标语言，直接保留。");
    callbacks.onContent?.(text);
    return text;
  }

  if (!forceAi) {
    callbacks.onLog?.("正在查找本地字典...");
    const local = lookupDictionary(text, direction);
    if (local) {
      callbacks.onLog?.(`字典命中：${local}`);
      callbacks.onContent?.(local);
      return local;
    }
    callbacks.onLog?.("字典未命中，准备调用 AI。");
  } else {
    callbacks.onLog?.("跳过本地字典，准备调用 AI。");
  }

  return requestAiTranslation(text, direction, { ...state.settings }, callbacks);
}

function lookupDictionary(text, direction) {
  const source = normalizeSearch(text);
  if (!source) return "";

  for (const item of state.dictionary) {
    const aliases = item.aliases
      .split(/[，,]/)
      .map((alias) => normalizeSearch(alias))
      .filter(Boolean);

    if (direction === "zh-en") {
      const matchesChinese = normalizeSearch(item.chinese) === source || aliases.includes(source);
      if (matchesChinese && item.english) return item.english;

      const matchesEnglish = normalizeSearch(item.english) === source;
      if (matchesEnglish && item.english && !hasChineseText(text)) return item.english;
    }

    if (direction === "en-zh") {
      const matchesEnglish = normalizeSearch(item.english) === source || aliases.includes(source);
      if (matchesEnglish && item.chinese) return item.chinese;

      const matchesChinese = normalizeSearch(item.chinese) === source;
      if (matchesChinese && item.chinese && !hasEnglishText(text)) return item.chinese;
    }
  }

  return "";
}

function getDictionaryChineseTranslation(text) {
  const source = normalizeSearch(text);
  if (!source || hasChineseText(text)) return "";

  for (const item of state.dictionary) {
    const aliases = item.aliases
      .split(/[，,]/)
      .map((alias) => normalizeSearch(alias))
      .filter(Boolean);
    const matchesEnglish = normalizeSearch(item.english) === source || aliases.includes(source);
    if (matchesEnglish && item.chinese) return item.chinese;
  }

  return "";
}

function updateSegmentTranslationCell(item, text) {
  const translation = getDictionaryChineseTranslation(text);
  const translationNode = item.querySelector(".segment-translation");
  if (!translationNode) return;

  translationNode.classList.toggle("empty", !translation);
  translationNode.textContent = translation ? `译：${translation}` : "";
  translationNode.title = translation ? `中文翻译：${translation}` : "";
}

function cacheTranslationPair(sourceText, translatedText, direction, callbacks = {}, options = {}) {
  const source = String(sourceText || "").trim();
  const translated = String(translatedText || "").trim();
  if (!source || !translated || source === translated) return false;
  const overwrite = Boolean(options.overwrite);
  const groupKey = options.groupKey || (overwrite ? "translation-overwrite" : "translation-cache");

  const pair =
    direction === "zh-en"
      ? {
          chinese: hasChineseText(source) ? source : "",
          english: translated
        }
      : {
          chinese: translated,
          english: hasEnglishText(source) ? source : ""
        };

  if (!pair.chinese || !pair.english) return false;

  const item = normalizeDictionaryItem({
    chinese: pair.chinese,
    english: pair.english,
    category: overwrite ? "重新翻译" : "翻译缓存",
    aliases: "",
    note: overwrite ? "由重新翻译功能覆盖保存" : "由翻译功能自动保存"
  });

  const undoLength = undoStack.length;
  const pushedUndo = captureUndoStep(groupKey);
  const changed = upsertDictionaryPair(item, { overwrite, direction });
  if (changed) {
    saveState();
    callbacks.onLog?.(`${overwrite ? "已覆盖" : "已写入"}字典：${item.chinese} / ${item.english}`);
  } else {
    if (pushedUndo && undoStack.length > undoLength) {
      undoStack.pop();
      finishUndoGroup(groupKey);
      updateUndoControl();
    }
    callbacks.onLog?.(overwrite ? "字典对照已是最新，跳过覆盖。" : "字典已有相同对照，跳过保存。");
  }
  return changed;
}

function upsertDictionaryPair(item, options = {}) {
  if (!item) return false;
  const overwrite = Boolean(options.overwrite);
  const existing = findDictionaryPair(item, options.direction);

  if (!existing) {
    state.dictionary.unshift(item);
    return true;
  }

  if (overwrite) {
    let changed = false;
    if (existing.chinese !== item.chinese) {
      existing.chinese = item.chinese;
      changed = true;
    }
    if (existing.english !== item.english) {
      existing.english = item.english;
      changed = true;
    }
    if (!existing.category && item.category) {
      existing.category = item.category;
      changed = true;
    }
    return changed;
  }

  let changed = false;
  if (!existing.chinese && item.chinese) {
    existing.chinese = item.chinese;
    changed = true;
  }
  if (!existing.english && item.english) {
    existing.english = item.english;
    changed = true;
  }
  if (!existing.category) {
    existing.category = item.category;
    changed = true;
  }
  if (!existing.note && item.note) {
    existing.note = item.note;
    changed = true;
  }
  return changed;
}

function findDictionaryPair(item, direction) {
  const chineseKey = normalizeSearch(item.chinese);
  const englishKey = normalizeSearch(item.english);

  const matchesChinese = (entry) => chineseKey && normalizeSearch(entry.chinese) === chineseKey;
  const matchesEnglish = (entry) => englishKey && normalizeSearch(entry.english) === englishKey;

  if (direction === "zh-en") {
    const bySource = state.dictionary.find(matchesChinese);
    if (bySource) return bySource;
  }

  if (direction === "en-zh") {
    const bySource = state.dictionary.find(matchesEnglish);
    if (bySource) return bySource;
  }

  return state.dictionary.find((entry) => {
    const sameChinese = chineseKey && normalizeSearch(entry.chinese) === chineseKey;
    const sameEnglish = englishKey && normalizeSearch(entry.english) === englishKey;
    return sameChinese || sameEnglish;
  });
}

function isAlreadyTargetLanguage(text, direction) {
  if (direction === "zh-en") return hasEnglishText(text) && !hasChineseText(text);
  if (direction === "en-zh") return hasChineseText(text) && !hasEnglishText(text);
  return false;
}

function hasChineseText(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ""));
}

function hasEnglishText(text) {
  return /[A-Za-z]/.test(String(text || ""));
}

async function requestAiTranslation(text, direction, settings, callbacks = {}) {
  if (OPENAI_COMPATIBLE_PROVIDERS.includes(settings.provider)) {
    return requestOpenAiCompatibleTranslation(text, direction, settings, callbacks);
  }

  await new Promise((resolve) => window.setTimeout(resolve, 240));
  const fromLocal = direction === "zh-en" ? "中文" : "英文";
  const toLocal = direction === "zh-en" ? "英文" : "中文";
  const provider = settings.provider || "mock";
  const result = `[${provider} mock ${fromLocal}→${toLocal}] ${text}`;
  callbacks.onLog?.("当前 Provider 是 Mock，未调用真实 API。");
  callbacks.onContent?.(result);
  return result;
}

async function requestAiDictionaryCategories(items, settings, callbacks = {}) {
  if (OPENAI_COMPATIBLE_PROVIDERS.includes(settings.provider)) {
    return requestOpenAiCompatibleDictionaryCategories(items, settings, callbacks);
  }

  await new Promise((resolve) => window.setTimeout(resolve, 180));
  callbacks.onLog?.("当前 Provider 是 Mock，使用本地模拟分类。");
  return Object.fromEntries(items.map((item) => [item.id, getMockDictionaryCategory(item)]));
}

async function requestAiDictionaryCategoriesResilient(items, settings, callbacks = {}, depth = 0) {
  const emptyResult = { categoryById: new Map(), failedItems: [] };
  if (!items.length) return emptyResult;

  try {
    const response = await requestAiDictionaryCategories(items, settings, callbacks);
    const categoryById = new Map();
    const missingItems = [];

    items.forEach((item) => {
      const category = normalizeDictionaryCategory(response[item.id]);
      if (category) {
        categoryById.set(item.id, category);
      } else {
        missingItems.push(item);
      }
    });

    if (!missingItems.length) return { categoryById, failedItems: [] };
    callbacks.onLog?.(`本段 JSON 缺少 ${missingItems.length} 个词条，继续拆分补齐。`);
    const retryResult = await retryDictionaryCategorySubBatches(missingItems, settings, callbacks, depth + 1);
    retryResult.categoryById.forEach((category, id) => categoryById.set(id, category));
    return { categoryById, failedItems: retryResult.failedItems };
  } catch (error) {
    callbacks.onLog?.(`分类分段失败：${getFriendlyErrorMessage(error)}`);
    return retryDictionaryCategorySubBatches(items, settings, callbacks, depth + 1);
  }
}

async function retryDictionaryCategorySubBatches(items, settings, callbacks = {}, depth = 0) {
  if (!items.length) return { categoryById: new Map(), failedItems: [] };
  if (items.length === 1 || depth > DICTIONARY_CLASSIFY_MAX_RETRY_DEPTH) {
    return { categoryById: new Map(), failedItems: items };
  }

  const categoryById = new Map();
  const failedItems = [];
  const chunkSize = getDictionaryRetryChunkSize(items.length);
  callbacks.onLog?.(`将 ${items.length} 个词条拆成每段最多 ${chunkSize} 个，重复请求 JSON 分类。`);

  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    const result = await requestAiDictionaryCategoriesResilient(chunk, settings, callbacks, depth);
    result.categoryById.forEach((category, id) => categoryById.set(id, category));
    failedItems.push(...result.failedItems);
  }

  return { categoryById, failedItems };
}

function getDictionaryRetryChunkSize(count) {
  if (count <= 2) return 1;
  if (count <= DICTIONARY_CLASSIFY_RETRY_BATCH_SIZE) return Math.ceil(count / 2);
  return DICTIONARY_CLASSIFY_RETRY_BATCH_SIZE;
}

async function requestOpenAiCompatibleTranslation(text, direction, settings, callbacks = {}) {
  const apiKey = String(settings.apiKey || "").trim();
  if (!apiKey) throw new Error("请先输入 DeepSeek API Key。");

  const endpoint = String(settings.endpoint || DEFAULT_SETTINGS.endpoint).trim();
  const model = String(settings.model || DEFAULT_SETTINGS.model).trim();
  const thinkingEnabled = settings.provider === "deepseek" && settings.enableDeepSeekThinking !== false;
  const targetLanguage = direction === "zh-en" ? "English" : "Chinese";
  const sourceLanguage = direction === "zh-en" ? "Chinese" : "English";
  const url = buildChatCompletionsUrl(endpoint);
  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a precise ComfyUI and Stable Diffusion prompt translator. Translate prompt fragments only. Preserve prompt style, commas, LoRA tags, embeddings, underscores, and weight syntax such as (text:1.2). Return only the translated prompt text without explanations."
      },
      {
        role: "user",
        content: `Translate this ${sourceLanguage} prompt text to ${targetLanguage}:\n${text}`
      }
    ],
    max_tokens: 1000,
    stream: true
  };

  if (settings.provider === "deepseek") {
    body.thinking = { type: thinkingEnabled ? "enabled" : "disabled" };
    if (thinkingEnabled) {
      body.reasoning_effort = "high";
      callbacks.onLog?.("DeepSeek 思考模式已开启，等待 reasoning_content...");
    } else {
      body.temperature = 0.2;
      callbacks.onLog?.("DeepSeek 思考模式已关闭，直接生成翻译。");
    }
  } else {
    body.temperature = 0.2;
  }

  callbacks.onLog?.(`请求：${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = await safeReadJson(response);
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    throw new Error(`DeepSeek 请求失败：${message}`);
  }

  const content = await readStreamingChatCompletion(response, callbacks);
  if (!content) throw new Error("DeepSeek 没有返回可用翻译结果。");
  return content;
}

async function requestOpenAiCompatibleDictionaryCategories(items, settings, callbacks = {}) {
  const apiKey = String(settings.apiKey || "").trim();
  if (!apiKey) throw new Error("请先输入 DeepSeek API Key。");

  const endpoint = String(settings.endpoint || DEFAULT_SETTINGS.endpoint).trim();
  const model = String(settings.model || DEFAULT_SETTINGS.model).trim();
  const categories = getDictionaryCategoryCandidates();
  const url = buildChatCompletionsUrl(endpoint);
  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          `You classify ComfyUI and Stable Diffusion prompt dictionary terms. Return only valid JSON for the current batch. Each key must exactly match a provided id and each value must be one short Chinese category name. Prefer these categories when suitable: ${categories.join("、")}. If uncertain, use "其他". Include every provided id. Do not return markdown, explanations, aliases, notes, or extra keys.`
      },
      {
        role: "user",
        content: `为以下本段词条分类，只根据中文、英文和别名判断。只返回 JSON 对象，格式为 {"词条id":"分类"}：\n${JSON.stringify(buildDictionaryCategoryRows(items), null, 2)}`
      }
    ],
    max_tokens: Math.max(600, Math.min(1800, 220 + items.length * 60)),
    stream: true,
    temperature: 0.1
  };

  if (settings.provider === "deepseek") {
    body.thinking = { type: "disabled" };
    callbacks.onLog?.("DeepSeek 字典分类使用快速模式，要求直接返回 JSON。");
  }

  callbacks.onLog?.(`请求：${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = await safeReadJson(response);
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    throw new Error(`AI 分类请求失败：${message}`);
  }

  const content = await readStreamingChatCompletion(response, callbacks);
  if (!content) throw new Error("AI 没有返回可用分类结果。");
  const parsed = parseDictionaryCategoryResponse(content);
  if (!Object.keys(parsed).length) throw new Error("AI 分类结果不是可识别的 JSON。");
  return parsed;
}

function buildDictionaryCategoryRows(items) {
  return items.map((item) => ({
    id: item.id,
    chinese: item.chinese || "",
    english: item.english || "",
    aliases: item.aliases || ""
  }));
}

function getDictionaryCategoryCandidates() {
  const existing = state.dictionary
    .map((item) => String(item.category || "").trim())
    .filter((category) => category && category !== "未分类");
  return [...new Set([...DEFAULT_DICTIONARY_CATEGORIES, ...existing])].slice(0, 40);
}

function parseDictionaryCategoryResponse(content) {
  const text = String(content || "").trim();
  const withoutFence = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const payload = tryParseDictionaryCategoryJson(withoutFence) || tryParseDictionaryCategoryJson(extractJsonObject(withoutFence));
  const parsed = normalizeDictionaryCategoryPayload(payload);
  if (Object.keys(parsed).length) return parsed;

  return extractJsonObjects(withoutFence).reduce((merged, jsonText) => {
    Object.assign(merged, normalizeDictionaryCategoryPayload(tryParseDictionaryCategoryJson(jsonText)));
    return merged;
  }, {});
}

function normalizeDictionaryCategoryPayload(payload) {
  if (Array.isArray(payload)) {
    return Object.fromEntries(payload.map((item) => [item?.id, item?.category]).filter(([id, category]) => id && category));
  }

  if (!payload || typeof payload !== "object") return {};
  if (Array.isArray(payload.items)) {
    return Object.fromEntries(payload.items.map((item) => [item?.id, item?.category]).filter(([id, category]) => id && category));
  }
  if (payload.categories && typeof payload.categories === "object" && !Array.isArray(payload.categories)) return payload.categories;
  return payload;
}

function tryParseDictionaryCategoryJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return "";
  return text.slice(start, end + 1);
}

function extractJsonObjects(text) {
  const objects = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  const source = String(text || "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function normalizeDictionaryCategory(value) {
  let category = value && typeof value === "object" ? value.category || value.name || value.label : value;
  category = String(category || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(分类|类别|category)\s*[:：]\s*/i, "")
    .split(/[，,;；。.\n\r]/)[0]
    .trim();

  const aliasMap = {
    appearance: "外观",
    hair: "发型",
    expression: "表情",
    pose: "姿势",
    clothing: "服装",
    body: "身体",
    scene: "场景",
    lighting: "光影",
    camera: "镜头",
    style: "画风",
    quality: "质量",
    negative: "负面",
    other: "其他"
  };
  category = aliasMap[category.toLowerCase()] || category;
  if (!category || category === "未分类" || category === "无") return "其他";
  return category.slice(0, 12);
}

function getMockDictionaryCategory(item) {
  const text = normalizeSearch([item.chinese, item.english, item.aliases].filter(Boolean).join(" "));
  const rules = [
    ["负面", ["bad", "worst", "blurry", "low quality", "error", "extra", "mutated", "畸形", "错误", "低质量", "模糊"]],
    ["质量", ["masterpiece", "best quality", "high quality", "detailed", "sharp", "杰作", "高质量", "精细"]],
    ["发型", ["hair", "bangs", "ponytail", "braid", "twintails", "发", "头发", "刘海", "辫"]],
    ["表情", ["smile", "blush", "cry", "angry", "expression", "eyes", "mouth", "表情", "微笑", "脸红", "眼", "嘴"]],
    ["姿势", ["pose", "sitting", "standing", "lying", "kneeling", "hand up", "姿势", "坐", "站", "躺", "跪"]],
    ["服装", ["dress", "skirt", "shirt", "uniform", "socks", "panties", "bikini", "ribbon", "bow", "clothes", "裙", "衬衫", "制服", "袜", "内裤", "蝴蝶结"]],
    ["身体", ["body", "breast", "thigh", "leg", "arm", "hand", "foot", "feet", "tail", "ear", "groin", "身体", "胸", "腿", "手", "脚", "尾巴", "耳"]],
    ["场景", ["background", "room", "bed", "street", "forest", "sky", "water", "背景", "房间", "床", "街道", "森林", "天空"]],
    ["光影", ["light", "shadow", "glow", "backlight", "rim light", "光", "影", "发光", "逆光"]],
    ["镜头", ["camera", "close-up", "portrait", "angle", "view", "lens", "镜头", "特写", "视角", "构图"]],
    ["画风", ["style", "anime", "realistic", "watercolor", "sketch", "风格", "画风", "写实", "水彩"]]
  ];
  return rules.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] || "其他";
}

async function readStreamingChatCompletion(response, callbacks = {}) {
  if (!response.body) throw new Error("当前浏览器不支持读取流式响应。");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";
  let hasReasoning = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      let chunk = null;
      try {
        chunk = JSON.parse(data);
      } catch (error) {
        callbacks.onLog?.(`跳过无法解析的流式片段：${data.slice(0, 80)}`);
        continue;
      }

      const delta = chunk?.choices?.[0]?.delta || {};
      if (delta.reasoning_content) {
        if (!hasReasoning) {
          hasReasoning = true;
          callbacks.onLog?.("收到 DeepSeek reasoning_content：");
        }
        callbacks.onReasoning?.(delta.reasoning_content);
      }

      if (delta.content) {
        content += delta.content;
        callbacks.onContent?.(delta.content);
      }
    }
  }

  if (!hasReasoning) callbacks.onLog?.("本次响应没有 reasoning_content。");
  return content.trim();
}

function buildChatCompletionsUrl(endpoint) {
  const cleanEndpoint = String(endpoint || DEFAULT_SETTINGS.endpoint).trim().replace(/\/+$/, "");
  if (cleanEndpoint.endsWith("/chat/completions")) return cleanEndpoint;
  return `${cleanEndpoint}/chat/completions`;
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function testAiConnection() {
  syncSettingsFromInputs();
  el.aiTestResult.textContent = "测试中...";
  try {
    const translated = await requestAiTranslation("白发", "zh-en", { ...state.settings });
    el.aiTestResult.textContent = `连接成功：${translated}`;
    showToast("DeepSeek 连接成功");
  } catch (error) {
    console.error(error);
    el.aiTestResult.textContent = getFriendlyErrorMessage(error);
    showToast("DeepSeek 连接失败");
  }
}

function resetAiProcess() {
  el.aiProcessOutput.value = "";
}

function appendProcessLine(message) {
  if (state.settings.showAiProcess === false) return;
  const prefix = el.aiProcessOutput.value ? "\n" : "";
  el.aiProcessOutput.value += `${prefix}${new Date().toLocaleTimeString()} ${message}`;
  scrollAiProcessToEnd();
}

function appendReasoningToken(token) {
  if (state.settings.showAiProcess === false) return;
  el.aiProcessOutput.value += token;
  scrollAiProcessToEnd();
}

function scrollAiProcessToEnd() {
  el.aiProcessOutput.scrollTop = el.aiProcessOutput.scrollHeight;
}

function getFriendlyErrorMessage(error) {
  const message = error?.message || String(error);
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "请求失败：浏览器可能拦截了跨域请求，或网络/API 地址不可用。若 DeepSeek 不允许前端直连，需要后续加一个本地代理。";
  }
  return message;
}

function exportData() {
  const exportState = createExportState();
  const payload = JSON.stringify(exportState, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comfy-prompt-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("JSON 已导出（不含 API Key）");
}

function createExportState() {
  const exportState = JSON.parse(JSON.stringify(state));
  exportState.settings = {
    ...exportState.settings,
    apiKey: ""
  };
  return exportState;
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeImportedState(JSON.parse(String(reader.result)));
      imported.settings.apiKey = state.settings.apiKey || "";
      captureUndoStep();
      Object.assign(state, imported);
      saveState();
      renderAll();
      showToast("JSON 已导入（API Key 保持不变）");
    } catch (error) {
      console.error(error);
      showToast("导入失败：JSON 格式不正确");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!confirm("确定清空所有本地数据？清空后可通过撤回恢复。")) return;
  captureUndoStep();
  const empty = createEmptyState();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, empty);
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
  showToast("已清空本地数据");
}

function upsertById(list, item) {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    list[index] = item;
  } else {
    list.unshift(item);
  }
}

function renderTags(tags) {
  const parts = String(tags || "")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  return `<div class="tags">${parts.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.toast.classList.remove("show");
  }, 2200);
}
