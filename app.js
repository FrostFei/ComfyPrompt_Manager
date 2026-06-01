"use strict";

const STORAGE_KEY = "comfyPromptOrganizer.v1";
const DEFAULT_SETTINGS = {
  provider: "deepseek",
  model: "deepseek-v4-flash",
  apiKey: "",
  endpoint: "https://api.deepseek.com",
  showAiProcess: true,
  enableDeepSeekThinking: true
};

const state = loadState();
let toastTimer = null;

const el = {
  exportDataBtn: document.getElementById("exportDataBtn"),
  importDataInput: document.getElementById("importDataInput"),
  resetAllBtn: document.getElementById("resetAllBtn"),
  saveStatus: document.getElementById("saveStatus"),
  toast: document.getElementById("toast"),

  positiveInput: document.getElementById("positiveInput"),
  negativeInput: document.getElementById("negativeInput"),
  positiveOutput: document.getElementById("positiveOutput"),
  negativeOutput: document.getElementById("negativeOutput"),
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
  showAiProcess: document.getElementById("showAiProcess"),
  enableDeepSeekThinking: document.getElementById("enableDeepSeekThinking"),
  aiProcessOutput: document.getElementById("aiProcessOutput"),

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
  libraryChinese: document.getElementById("libraryChinese"),
  libraryEnglish: document.getElementById("libraryEnglish"),
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
  dictionarySearch: document.getElementById("dictionarySearch"),
  dictionaryCategoryFilter: document.getElementById("dictionaryCategoryFilter"),
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
}

function showSaveStatus() {
  el.saveStatus.textContent = "已自动保存 " + new Date().toLocaleTimeString();
}

function bindCoreEvents() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
  document.querySelectorAll(".prompt-tab-button").forEach((button) => {
    button.addEventListener("click", () => switchPromptTab(button.dataset.promptTab));
  });

  document.getElementById("parsePositiveBtn").addEventListener("click", () => parsePromptFromInput("positive"));
  document.getElementById("parseNegativeBtn").addEventListener("click", () => parsePromptFromInput("negative"));
  document.getElementById("copyPositiveBtn").addEventListener("click", () => copyPrompt("positive"));
  document.getElementById("copyNegativeBtn").addEventListener("click", () => copyPrompt("negative"));
  document.getElementById("clearPositiveBtn").addEventListener("click", () => clearPrompt("positive"));
  document.getElementById("clearNegativeBtn").addEventListener("click", () => clearPrompt("negative"));

  el.positiveSegments.addEventListener("click", (event) => handleSegmentClick(event, "positive"));
  el.negativeSegments.addEventListener("click", (event) => handleSegmentClick(event, "negative"));
  el.positiveSegments.addEventListener("focusin", (event) => handleSegmentFocus(event, "positive"));
  el.negativeSegments.addEventListener("focusin", (event) => handleSegmentFocus(event, "negative"));
  el.positiveSegments.addEventListener("input", (event) => handleSegmentInput(event, "positive"));
  el.negativeSegments.addEventListener("input", (event) => handleSegmentInput(event, "negative"));
  document.querySelectorAll(".segment-toolbar").forEach((toolbar) => {
    toolbar.addEventListener("click", handleSegmentToolbarClick);
  });

  el.selectedDetail.addEventListener("input", handleDetailInput);
  el.selectedDetail.addEventListener("click", handleDetailClick);

  el.exportDataBtn.addEventListener("click", exportData);
  el.importDataInput.addEventListener("change", importData);
  el.resetAllBtn.addEventListener("click", resetAllData);

  el.translateBtn.addEventListener("click", translateCurrentInput);
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
  el.dictionarySearch.addEventListener("input", renderDictionary);
  el.dictionaryCategoryFilter.addEventListener("change", renderDictionary);
  el.dictionaryList.addEventListener("click", handleDictionaryClick);
}

function bindSettingsEvents() {
  [el.aiProvider, el.aiModel, el.aiApiKey, el.aiEndpoint, el.showAiProcess, el.enableDeepSeekThinking].forEach((input) => {
    const eventName = input.type === "checkbox" ? "change" : "input";
    input.addEventListener(eventName, () => {
      if (input === el.aiProvider && el.aiProvider.value === "deepseek") {
        applyDeepSeekDefaults({ keepApiKey: true, onlyFillEmpty: true });
      }
      syncSettingsFromInputs();
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
}

function renderSettings() {
  el.aiProvider.value = state.settings.provider || "mock";
  el.aiModel.value = state.settings.model || "";
  el.aiApiKey.value = state.settings.apiKey || "";
  el.aiEndpoint.value = state.settings.endpoint || "";
  el.showAiProcess.checked = state.settings.showAiProcess !== false;
  el.enableDeepSeekThinking.checked = state.settings.enableDeepSeekThinking !== false;
}

function syncSettingsFromInputs() {
  state.settings.provider = el.aiProvider.value;
  state.settings.model = el.aiModel.value.trim();
  state.settings.apiKey = el.aiApiKey.value;
  state.settings.endpoint = el.aiEndpoint.value.trim();
  state.settings.showAiProcess = el.showAiProcess.checked;
  state.settings.enableDeepSeekThinking = el.enableDeepSeekThinking.checked;
  saveState();
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
  const key = window.prompt("请输入 DeepSeek API Key。它只会保存在当前浏览器 LocalStorage 中：", "");
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
  const hint = kind === "positive" ? el.positiveSelectedHint : el.negativeSelectedHint;

  list.innerHTML = "";
  segments.forEach((segment, index) => {
    const item = document.createElement("li");
    const isSelected = state.selected.kind === kind && state.selected.id === segment.id;
    const translation = getDictionaryChineseTranslation(segment.text);
    item.className = "segment-item" + (isSelected ? " selected" : "");
    item.dataset.id = segment.id;
    item.innerHTML = `
      <span class="segment-index">${index + 1}</span>
      <input class="segment-text" type="text" value="${escapeAttr(segment.text)}" aria-label="分段文本" />
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
  const selectedIndex = state.selected.kind === kind ? segments.findIndex((segment) => segment.id === state.selected.id) : -1;
  hint.textContent = selectedIndex >= 0 ? `选中第 ${selectedIndex + 1} 段` : "未选中分段";
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
    <div class="item-meta">${state.selected.kind === "positive" ? "正向提示词" : "负向提示词"}</div>
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
  state.prompts[kind] = segments;
  state.selected = segments[0] ? { kind, id: segments[0].id } : { kind, id: null };
  saveState();
  renderAll();
  showToast(`已分成 ${segments.length} 段`);
}

function splitPrompt(text) {
  return text
    .split(/[，,]/)
    .map((part) => parseSegment(part))
    .filter(Boolean);
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

function createSegment(text, weight = 1) {
  return {
    id: uid("seg"),
    text: text.trim(),
    weight: normalizeWeight(weight)
  };
}

function normalizeSegment(segment) {
  if (!segment) return null;
  const text = String(segment.text || "").trim();
  if (!text) return null;
  return {
    id: segment.id || uid("seg"),
    text,
    weight: normalizeWeight(segment.weight)
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
  const weight = normalizeWeight(segment.weight);
  if (Math.abs(weight - 1) < 0.001) return segment.text;
  return `(${segment.text}:${formatWeight(weight)})`;
}

function buildPrompt(kind) {
  return state.prompts[kind].map(formatSegment).join(", ");
}

function updatePromptOutput(kind) {
  const output = kind === "positive" ? el.positiveOutput : el.negativeOutput;
  const count = kind === "positive" ? el.positiveCount : el.negativeCount;
  output.value = buildPrompt(kind);
  count.textContent = `${state.prompts[kind].length} 段`;
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
    showToast("请先选中这一栏里的分段");
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
    hint.textContent = selectedIndex >= 0 ? `选中第 ${selectedIndex + 1} 段` : "未选中分段";

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
    segment.text = event.target.value.trimStart();
    updateSegmentTranslationCell(item, segment.text);
  }

  if (event.target.classList.contains("segment-weight")) {
    segment.weight = normalizeWeight(event.target.value);
  }

  state.selected = { kind, id: segment.id };
  saveState();
  updatePromptOutput(kind);
}

function runSegmentAction(kind, id, action) {
  const segments = state.prompts[kind];
  const index = segments.findIndex((segment) => segment.id === id);
  if (index === -1) return;

  if (action === "weight-up") {
    segments[index].weight = normalizeWeight(segments[index].weight + 0.1);
  }

  if (action === "weight-down") {
    segments[index].weight = normalizeWeight(segments[index].weight - 0.1);
  }

  if (action === "move-up" && index > 0) {
    [segments[index - 1], segments[index]] = [segments[index], segments[index - 1]];
  }

  if (action === "move-down" && index < segments.length - 1) {
    [segments[index + 1], segments[index]] = [segments[index], segments[index + 1]];
  }

  if (action === "delete") {
    segments.splice(index, 1);
    const next = segments[index] || segments[index - 1] || null;
    state.selected = next ? { kind, id: next.id } : { kind, id: null };
  }

  if (action === "add-dictionary") {
    addSegmentToDictionary(segments[index]);
  }

  saveState();
  renderAll();
}

function handleDetailInput(event) {
  const selected = getSelectedSegment();
  if (!selected) return;

  if (event.target.id === "detailText") {
    selected.text = event.target.value.trimStart();
  }

  if (event.target.id === "detailWeight") {
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

  if (action === "detail-weight-up") {
    selected.weight = normalizeWeight(selected.weight + 0.1);
  }

  if (action === "detail-weight-down") {
    selected.weight = normalizeWeight(selected.weight - 0.1);
  }

  if (action === "detail-to-translate") {
    el.translateInput.value = selected.text;
    showToast("已放入翻译输入");
    return;
  }

  if (action === "detail-add-dictionary") {
    addSegmentToDictionary(selected);
  }

  if (action === "detail-delete") {
    deleteSelectedSegment();
  }

  saveState();
  renderAll();
}

function deleteSelectedSegment() {
  const { kind, id } = state.selected;
  const segments = state.prompts[kind];
  const index = segments.findIndex((segment) => segment.id === id);
  if (index === -1) return;
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

function saveLibraryItem(event) {
  event.preventDefault();
  const id = el.libraryEditId.value || uid("lib");
  const item = normalizeLibraryItem({
    id,
    chinese: el.libraryChinese.value,
    english: el.libraryEnglish.value,
    category: el.libraryCategory.value,
    tags: el.libraryTags.value,
    note: el.libraryNote.value
  });

  if (!item) {
    showToast("请填写中文或英文提示词");
    return;
  }

  upsertById(state.library, item);
  resetLibraryForm();
  saveState();
  renderCategoryFilters();
  renderLibrary();
  showToast("提示词已保存");
}

function normalizeLibraryItem(item) {
  if (!item) return null;
  const chinese = String(item.chinese || "").trim();
  const english = String(item.english || "").trim();
  if (!chinese && !english) return null;

  return {
    id: item.id || uid("lib"),
    chinese,
    english,
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
    const haystack = normalizeSearch([item.chinese, item.english, item.category, item.tags, item.note].join(" "));
    return matchesCategory && (!query || haystack.includes(query));
  });

  el.libraryList.innerHTML = "";
  if (!items.length) {
    el.libraryList.innerHTML = `<div class="empty-state">暂无提示词</div>`;
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "library-item";
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="item-title">
        <strong>${escapeHtml(item.english || item.chinese)}</strong>
        <span class="item-meta">${escapeHtml(item.category || "未分类")}</span>
      </div>
      <div class="item-meta">${escapeHtml(item.chinese)}${item.chinese && item.english ? " / " : ""}${escapeHtml(item.english)}</div>
      ${renderTags(item.tags)}
      ${item.note ? `<p class="item-meta">${escapeHtml(item.note)}</p>` : ""}
      <div class="button-row">
        <button type="button" data-action="insert-positive">插入正向</button>
        <button type="button" data-action="insert-negative" class="secondary">插入负向</button>
        <button type="button" data-action="edit" class="secondary">编辑</button>
        <button type="button" data-action="delete" class="danger">删除</button>
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
  const text = item.english || item.chinese;
  const segment = createSegment(text, 1);
  state.prompts[kind].push(segment);
  state.selected = { kind, id: segment.id };
  saveState();
  renderAll();
  showToast(kind === "positive" ? "已插入正向提示词" : "已插入负向提示词");
}

function editLibraryItem(item) {
  el.libraryEditId.value = item.id;
  el.libraryChinese.value = item.chinese;
  el.libraryEnglish.value = item.english;
  el.libraryCategory.value = item.category;
  el.libraryTags.value = item.tags;
  el.libraryNote.value = item.note;
}

function deleteLibraryItem(id) {
  if (!confirm("确定删除这条提示词？")) return;
  state.library = state.library.filter((item) => item.id !== id);
  saveState();
  renderCategoryFilters();
  renderLibrary();
}

function resetLibraryForm() {
  el.libraryForm.reset();
  el.libraryEditId.value = "";
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
      <div class="button-row">
        <button type="button" data-action="load">加载</button>
        <button type="button" data-action="edit" class="secondary">编辑</button>
        <button type="button" data-action="delete" class="danger">删除</button>
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
  showToast("模板已加载");
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

  upsertById(state.dictionary, item);
  resetDictionaryForm();
  saveState();
  renderCategoryFilters();
  renderDictionary();
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
  const query = normalizeSearch(el.dictionarySearch.value);
  const category = el.dictionaryCategoryFilter.value;
  const items = state.dictionary.filter((item) => {
    const matchesCategory = !category || item.category === category;
    const haystack = normalizeSearch([item.chinese, item.english, item.category, item.aliases, item.note].join(" "));
    return matchesCategory && (!query || haystack.includes(query));
  });

  el.dictionaryList.innerHTML = "";
  if (!items.length) {
    el.dictionaryList.innerHTML = `<div class="empty-state">暂无词条</div>`;
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "dictionary-item";
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="item-title">
        <strong>${escapeHtml(item.chinese || item.english)}</strong>
        <span class="item-meta">${escapeHtml(item.category || "未分类")}</span>
      </div>
      <div class="item-meta">${escapeHtml(item.chinese)}${item.chinese && item.english ? " / " : ""}${escapeHtml(item.english)}</div>
      ${item.aliases ? `<p class="item-meta">别名：${escapeHtml(item.aliases)}</p>` : ""}
      ${item.note ? `<p class="item-meta">${escapeHtml(item.note)}</p>` : ""}
      <div class="button-row">
        <button type="button" data-action="edit" class="secondary">编辑</button>
        <button type="button" data-action="delete" class="danger">删除</button>
      </div>
    `;
    el.dictionaryList.appendChild(card);
  });
}

function handleDictionaryClick(event) {
  const action = event.target.dataset.action;
  const card = event.target.closest(".dictionary-item");
  if (!action || !card) return;

  const item = state.dictionary.find((entry) => entry.id === card.dataset.id);
  if (!item) return;

  if (action === "edit") editDictionaryItem(item);
  if (action === "delete") deleteDictionaryItem(item.id);
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
  if (!confirm("确定删除这个词条？")) return;
  state.dictionary = state.dictionary.filter((item) => item.id !== id);
  saveState();
  renderCategoryFilters();
  renderDictionary();
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
  saveState();
  renderCategoryFilters();
  renderDictionary();
}

function addSegmentToDictionary(segment) {
  if (!segment?.text) return;
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
    return;
  }

  state.dictionary.unshift(item);
  saveState();
  renderCategoryFilters();
  renderDictionary();
  showToast("已加入字典");
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

async function translateCurrentInput() {
  const text = el.translateInput.value.trim();
  if (!text) {
    showToast("请输入要翻译的文本");
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

  appendProcessLine(`开始翻译：${getDirectionLabel(resolvedDirection)}${direction === "auto" ? "（自动识别）" : ""}`);
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
          el.translateOutput.value = [...translated, liveText].filter(Boolean).join(", ");
        }
      });
      translated.push(translatedUnit);
      el.translateOutput.value = translated.join(", ");
      if (state.settings.provider !== "mock") {
        cacheTranslationPair(unit, translatedUnit, resolvedDirection, { onLog: appendProcessLine });
      }
    }
    saveState();
    renderCategoryFilters();
    renderDictionary();
    renderPromptArea("positive");
    renderPromptArea("negative");
    appendProcessLine("翻译完成。");
  } catch (error) {
    console.error(error);
    el.translateOutput.value = getFriendlyErrorMessage(error);
    showToast("翻译失败");
  }
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

async function translateText(text, direction, callbacks = {}) {
  if (isAlreadyTargetLanguage(text, direction)) {
    callbacks.onLog?.("该分段已是目标语言，直接保留。");
    callbacks.onContent?.(text);
    return text;
  }

  callbacks.onLog?.("正在查找本地字典...");
  const local = lookupDictionary(text, direction);
  if (local) {
    callbacks.onLog?.(`字典命中：${local}`);
    callbacks.onContent?.(local);
    return local;
  }
  callbacks.onLog?.("字典未命中，准备调用 AI。");
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

function cacheTranslationPair(sourceText, translatedText, direction, callbacks = {}) {
  const source = String(sourceText || "").trim();
  const translated = String(translatedText || "").trim();
  if (!source || !translated || source === translated) return false;

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
    category: "翻译缓存",
    aliases: "",
    note: "由翻译功能自动保存"
  });

  const changed = upsertDictionaryPair(item);
  if (changed) {
    saveState();
    callbacks.onLog?.(`已写入字典：${item.chinese} / ${item.english}`);
  } else {
    callbacks.onLog?.("字典已有相同对照，跳过保存。");
  }
  return changed;
}

function upsertDictionaryPair(item) {
  if (!item) return false;
  const chineseKey = normalizeSearch(item.chinese);
  const englishKey = normalizeSearch(item.english);

  const existing = state.dictionary.find((entry) => {
    const sameChinese = chineseKey && normalizeSearch(entry.chinese) === chineseKey;
    const sameEnglish = englishKey && normalizeSearch(entry.english) === englishKey;
    return sameChinese || sameEnglish;
  });

  if (!existing) {
    state.dictionary.unshift(item);
    return true;
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
  if (["deepseek", "openai-compatible", "custom"].includes(settings.provider)) {
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
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comfy-prompt-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("JSON 已导出");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeImportedState(JSON.parse(String(reader.result)));
      Object.assign(state, imported);
      saveState();
      renderAll();
      showToast("JSON 已导入");
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
  if (!confirm("确定清空所有本地数据？此操作不可撤销。")) return;
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
