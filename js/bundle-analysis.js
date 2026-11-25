/* 离线演示打包产物：由 build-demo.js 自动生成，请勿直接修改。 */
(function () {
  var defs = Object.create(null);
  var cache = Object.create(null);
  function __def(name, factory) { defs[name] = factory; }
  function __require(name) {
    if (cache[name]) return cache[name];
    if (!defs[name]) throw new Error("模块未找到: " + name);
    cache[name] = defs[name](__require) || {};
    return cache[name];
  }
__def("analysis.js", function (require) {
// 综合分析页：多数据集关注度 / 存在时间 / 标签 / 趋势的多角度可视化。
// 数据来自 /api/v1/analysis/*（服务端聚合），前端负责雷达图与趋势图渲染、
// 维度归一化与自动洞察，全部图表基于本地 vendor 的 ECharts，离线可用。
var __dep43 = require("api.js"); var api = __dep43["api"];
var __dep44 = require("components/dom.js"); var $ = __dep44["$"]; var action = __dep44["action"]; var message = __dep44["message"]; var node = __dep44["node"];
var __dep45 = require("components/theme.js"); var mountTheme = __dep45["mountTheme"];

const PALETTE = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];
const METRICS = [
  ["overall", "综合关注度"],
  ["view", "浏览量"],
  ["like", "点赞量"],
  ["bookmark", "收藏数"],
  ["comment", "评论数"],
];
const MAX_SELECTED = 8;

// 雷达维度：名称 + 从聚合结果取原始值的取值器；null 表示该数据集无此维度。
const RADAR_ACCESSORS = [
  ["浏览热度", (d) => (d.attention.view.available ? d.attention.view.avg : null)],
  ["点赞认可", (d) => (d.attention.like.available ? d.attention.like.avg : null)],
  ["收藏沉淀", (d) => (d.attention.bookmark.available ? d.attention.bookmark.avg : null)],
  ["评论讨论", (d) => (d.attention.comment.available ? d.attention.comment.avg : null)],
  ["AI 浓度", (d) => (d.ai_ratio == null ? null : d.ai_ratio * 100)],
  ["数据规模", (d) => (d.row_count || null)],
  ["存在时长", (d) => (d.existence.available ? d.existence.avg_seconds / 86400 : null)],
];

const state = {
  catalog: [],
  tagCatalog: [],
  tagLoaded: false,
  mode: "dataset",
  selections: { dataset: [], tag: [] },
  overview: null,
};
// 当前模式的勾选项：dataset 模式存数据集编号，tag 模式存词条文本。
const selected = () => state.selections[state.mode];
const modeLabel = () => (state.mode === "tag" ? "词条分组" : "数据集");

const fmtInt = (value) => (value == null ? "—" : Math.round(value).toLocaleString("zh-CN"));
const fmtCompact = (value) => {
  if (value == null) return "—";
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value * 10) / 10);
};
const humanDuration = (seconds) => {
  if (seconds == null) return "—";
  const days = seconds / 86400;
  if (days >= 1) return `${days >= 100 ? Math.round(days) : (Math.round(days * 10) / 10)} 天`;
  const hours = seconds / 3600;
  if (hours >= 1) return `${Math.round(hours)} 小时`;
  return `${Math.round(seconds / 60)} 分钟`;
};
const shortName = (dataset) => {
  const tags = dataset.collection_tags || [];
  if (tags.length) return tags.length > 1 ? `${tags[0]} 等${tags.length}个` : tags[0];
  return dataset.dataset_id.slice(0, 12);
};
const colorOf = (datasetId) => PALETTE[Math.max(selected().indexOf(datasetId), 0) % PALETTE.length];
// 图表 series 的取色键：tag 模式下 dataset_id 带 "tag:" 前缀，需换回裸词条匹配勾选顺序。
const seriesColorOf = (ds) => colorOf(state.mode === "tag" ? ds.collection_tags[0] : ds.dataset_id);

// 主题 / 深浅色下的图表文字与线条颜色：实时读语义化 CSS 变量。
const cssVar = (name, fallback) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};
const chartInk = () => ({
  text: cssVar("--text-2", "#334155"),
  muted: cssVar("--muted", "#6b7a90"),
  line: cssVar("--line", "#c9d3e0"),
  surface: cssVar("--surface", "#fff"),
});

const charts = {};
function initCharts() {
  if (!window.echarts) return; // vendor 加载失败时保留占位提示，页面其余功能可用
  for (const key of ["trend", "radar", "tag", "exist"]) {
    charts[key] = window.echarts.init($(`${key}Chart`));
  }
  window.addEventListener("resize", () => Object.values(charts).forEach((chart) => chart.resize()));
}

const emptyOption = (text) => ({
  title: {
    text,
    left: "center",
    top: "middle",
    textStyle: { color: chartInk().muted, fontSize: 13, fontWeight: 400 },
  },
});

function setChart(key, option) {
  if (!charts[key]) return;
  charts[key].clear();
  charts[key].setOption(option);
}

/* ---------------- 数据集 / 词条选择器 ---------------- */
function renderCatalog() {
  const keyword = $("datasetSearch").value.trim().toLowerCase();
  const list = $("datasetList");
  list.replaceChildren();
  const visible = state.mode === "dataset"
    ? state.catalog.filter((item) => {
        const name = (item.collection_tags || []).join("、");
        return !keyword
          || name.toLowerCase().includes(keyword)
          || item.dataset_id.toLowerCase().includes(keyword);
      })
    : state.tagCatalog.filter((item) => !keyword || item.tag.toLowerCase().includes(keyword));
  if (!visible.length) {
    list.append(node("p",
      state.mode === "tag" && !state.tagLoaded ? "词条加载中…" : "没有匹配的项",
      "dataset-empty"));
    return;
  }
  for (const item of visible) {
    if (state.mode === "tag") {
      renderTagRow(list, item, selected().includes(item.tag));
      continue;
    }
    const checked = selected().includes(item.dataset_id);
    const row = node("label", undefined, `dataset-item${checked ? " checked" : ""}`);
    const checkbox = node("input");
    checkbox.type = "checkbox";
    checkbox.checked = checked;
    checkbox.dataset.id = item.dataset_id;
    checkbox.setAttribute("aria-label", `选择数据集 ${shortName(item)}`);
    const dot = node("span", undefined, "dot");
    if (checked) dot.style.background = colorOf(item.dataset_id);
    const nameBox = node("span", undefined, "picker-name");
    nameBox.append(node("b", shortName(item)));
    const cleaned = item.cleaned_at ? `已清洗 ${item.cleaned_at.slice(0, 10)}` : "未清洗";
    nameBox.append(node("span", `${item.row_count} 条 · ${item.platform === "xhs" ? "小红书" : "Pixiv"} · ${cleaned}`, "picker-meta"));
    row.append(checkbox, dot, nameBox);
    list.append(row);
  }
}

function renderTagRow(list, item, checked) {
  const row = node("label", undefined, `dataset-item${checked ? " checked" : ""}`);
  const checkbox = node("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.dataset.id = item.tag;
  checkbox.setAttribute("aria-label", `选择词条 ${item.tag}`);
  const dot = node("span", undefined, "dot");
  if (checked) dot.style.background = colorOf(item.tag);
  const nameBox = node("span", undefined, "picker-name");
  nameBox.append(node("b", item.tag));
  const platforms = (item.platforms || []).map((p) => (p === "xhs" ? "小红书" : "Pixiv")).join("、") || "—";
  nameBox.append(node("span", `${item.count} 次 · ${platforms} · AI ${item.ai_count}`, "picker-meta"));
  row.append(checkbox, dot, nameBox);
  list.append(row);
}

function toggleDataset(datasetId, checked) {
  if (checked) {
    if (selected().length >= MAX_SELECTED) {
      message(`最多同时对比 ${MAX_SELECTED} 个${modeLabel()}`, true);
      renderCatalog();
      return;
    }
    state.selections[state.mode].push(datasetId);
  } else {
    state.selections[state.mode] = selected().filter((id) => id !== datasetId);
  }
  renderCatalog();
  scheduleLoad();
}

function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  $("modeDataset").setAttribute("aria-selected", String(mode === "dataset"));
  $("modeTag").setAttribute("aria-selected", String(mode === "tag"));
  $("datasetSearch").value = "";
  $("importBox").hidden = mode !== "dataset";
  $("pickerHint").textContent = mode === "dataset"
    ? "最多同时对比 8 个数据集；雷达图各维度按所选数据集的最大值归一化。"
    : "词条来自已清洗的附加标签（跨数据集聚合）；最多同时对比 8 个词条。";
  if (mode === "tag") loadTagCatalog().then(renderCatalog);
  renderCatalog();
  loadOverview();
}

async function loadTagCatalog(force = false) {
  if (state.tagLoaded && !force) return;
  try {
    const data = await api.analysisTags();
    state.tagCatalog = data.items || [];
    state.tagLoaded = true;
  } catch (error) {
    message(error.message, true);
  }
}

/* ---------------- 数据加载 ---------------- */
let loadTimer = 0;
const scheduleLoad = () => {
  window.clearTimeout(loadTimer);
  loadTimer = window.setTimeout(loadOverview, 250);
};

// 请求版本号：快速切换勾选/口径时，慢的旧响应不得覆盖新结果。
let overviewRequest = 0;

async function loadOverview() {
  const status = $("analysisStatus");
  if (!selected().length) {
    status.textContent = state.mode === "tag"
      ? "请勾选词条开始分析。"
      : "请勾选左侧数据集开始分析。";
    state.overview = null;
    renderAll();
    return;
  }
  status.textContent = "聚合中…";
  const params = {
    bucket: $("bucketSel").value,
    top_tags: Math.min(30, Math.max(5, Number($("topTags").value) || 12)),
  };
  if (state.mode === "dataset") {
    params.ids = selected().join(",");
  } else {
    params.mode = "tag";
    params.tags = JSON.stringify(selected());
  }
  const requestId = ++overviewRequest;
  try {
    const data = await api.analysisOverview(params);
    if (requestId !== overviewRequest) return;
    state.overview = data;
    syncMetricOptions();
    const rows = state.overview.datasets.reduce((sum, ds) => sum + ds.row_count, 0);
    status.textContent = `已选 ${state.overview.datasets.length} 个${modeLabel()} · 共 ${fmtInt(rows)} 条作品 · 聚合于 ${new Date().toLocaleTimeString("zh-CN")}`;
    renderAll();
  } catch (error) {
    if (requestId !== overviewRequest) return;
    status.textContent = error.message;
    message(error.message, true);
  }
}

/* 趋势指标下拉按当前数据可用性重建；原选择仍可用时保持不变。 */
function syncMetricOptions() {
  const select = $("metricSel");
  const datasets = state.overview?.datasets || [];
  const available = METRICS.filter(([key]) =>
    key === "overall" || datasets.some((ds) => ds.attention[key]?.available));
  if (available.length === select.options.length
      && available.every(([key], index) => select.options[index].value === key)) {
    return;
  }
  const current = select.value;
  select.replaceChildren(...available.map(([key, label]) => new Option(label, key)));
  select.value = available.some(([key]) => key === current) ? current : "overall";
}

/* ---------------- KPI 概览 ---------------- */
function renderKpis(datasets) {
  const row = $("kpiRow");
  row.replaceChildren();
  if (!datasets.length) {
    row.append(kpi(modeLabel(), "—", "勾选后展示"));
    return;
  }
  const totalRows = datasets.reduce((sum, ds) => sum + ds.row_count, 0);
  const sumOf = (key) => datasets.reduce((sum, ds) => sum + (ds.attention[key].total || 0), 0);
  const overallAvg = totalRows ? (sumOf("view") + sumOf("like") + sumOf("bookmark") + sumOf("comment")) / totalRows : null;
  const aiRows = datasets.reduce((sum, ds) => sum + (ds.ai_count || 0), 0);
  const aiBase = datasets.reduce((sum, ds) => sum + (ds.ai_count == null ? 0 : ds.row_count), 0);
  const existence = datasets.filter((ds) => ds.existence.available);
  const avgExistence = existence.length
    ? existence.reduce((sum, ds) => sum + ds.existence.avg_seconds * ds.row_count, 0)
      / existence.reduce((sum, ds) => sum + ds.row_count, 0)
    : null;
  const tagCounter = new Map();
  for (const ds of datasets) {
    for (const item of ds.tags.top) {
      tagCounter.set(item.tag, (tagCounter.get(item.tag) || 0) + item.count);
    }
  }
  const topTag = [...tagCounter.entries()].sort((a, b) => b[1] - a[1])[0];
  row.append(
    kpi(`${modeLabel()}数`, String(datasets.length), `作品共 ${fmtInt(totalRows)} 条`),
    kpi("平均综合关注度", fmtInt(overallAvg), "浏览+点赞+收藏+评论"),
    kpi("AI 作品占比", aiBase ? `${Math.round((aiRows / aiBase) * 100)}%` : "—", `${fmtInt(aiRows)} 条 AI 作品`),
    kpi("平均存在时间", humanDuration(avgExistence), existence.length ? "按作品数加权" : "所选数据集无时间数据"),
    kpi("最高频标签", topTag ? topTag[0] : "—", topTag ? `出现 ${fmtInt(topTag[1])} 次` : "暂无标签"),
  );
}

const kpi = (label, value, sub) => {
  const card = node("div", undefined, "kpi");
  card.append(node("span", label, "kpi-label"), node("b", value, "kpi-value"), node("span", sub, "kpi-sub"));
  return card;
};

/* ---------------- 趋势图 ---------------- */
function renderTrend(datasets) {
  const ink = chartInk();
  if (!datasets.length || !datasets.some((ds) => ds.trend.length)) {
    setChart("trend", emptyOption(`选择${modeLabel()}后展示关注度趋势`));
    return;
  }
  const metric = $("metricSel").value;
  const stat = $("statSel").value;
  const periods = [...new Set(datasets.flatMap((ds) => ds.trend.map((t) => t.period)))].sort();
  const series = datasets.map((ds) => {
    const byPeriod = new Map(ds.trend.map((t) => [t.period, t]));
    return {
      name: shortName(ds),
      type: "line",
      smooth: true,
      symbolSize: 5,
      data: periods.map((p) => byPeriod.get(p)?.[metric]?.[stat] ?? null),
      itemStyle: { color: seriesColorOf(ds) },
      lineStyle: { color: seriesColorOf(ds) },
    };
  });
  // 整体均值：同一周期内有值的数据集取平均，作为整体趋势基线。
  series.push({
    name: "整体均值",
    type: "line",
    smooth: true,
    symbol: "none",
    data: periods.map((p) => {
      const values = datasets
        .map((ds) => ds.trend.find((t) => t.period === p)?.[metric]?.[stat])
        .filter((v) => v != null);
      return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null;
    }),
    lineStyle: { type: "dashed", color: ink.muted },
    itemStyle: { color: ink.muted },
  });
  setChart("trend", {
    color: PALETTE,
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : fmtInt(v)) },
    legend: { top: 0, textStyle: { color: ink.text }, type: "scroll" },
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: periods, boundaryGap: false,
             axisLine: { lineStyle: { color: ink.line } }, axisLabel: { color: ink.muted } },
    yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: ink.line } },
             axisLabel: { color: ink.muted, formatter: fmtCompact } },
    series,
  });
}

/* ---------------- 雷达图 ---------------- */
function renderRadar(datasets) {
  const ink = chartInk();
  if (!datasets.length) {
    setChart("radar", emptyOption(`选择${modeLabel()}后展示设计倾向`));
    return;
  }
  const indicators = RADAR_ACCESSORS.map(([name, accessor]) => {
    const values = datasets.map(accessor).filter((v) => v != null);
    const rawMax = Math.max(...values, 0);
    // AI 浓度天然上限 100%；其余维度留 15% 余量并取整，保证最大值不贴边。
    const max = name === "AI 浓度" ? 100 : niceCeil(rawMax * 1.15);
    return { name, max: max || 1 };
  });
  const series = datasets.map((ds) => ({
    name: shortName(ds),
    value: RADAR_ACCESSORS.map(([, accessor]) => {
      const value = accessor(ds);
      return value == null ? "-" : Math.round(value * 100) / 100;
    }),
    areaStyle: { opacity: 0.12 },
    lineStyle: { color: seriesColorOf(ds), width: 2 },
    itemStyle: { color: seriesColorOf(ds) },
  }));
  setChart("radar", {
    tooltip: { trigger: "item" },
    legend: { top: 0, textStyle: { color: ink.text }, type: "scroll" },
    radar: {
      indicator: indicators,
      radius: "62%",
      center: ["50%", "56%"],
      axisName: { color: ink.text, fontSize: 12 },
      splitLine: { lineStyle: { color: ink.line } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: ink.line } },
    },
    series: [{ type: "radar", data: series }],
  });
}

const niceCeil = (value) => {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
};

/* ---------------- 高频标签构成 ---------------- */
function renderTags(datasets) {
  const ink = chartInk();
  if (!datasets.length || !datasets.some((ds) => ds.tags.top.length)) {
    setChart("tag", emptyOption(`选择${modeLabel()}后展示标签构成`));
    return;
  }
  const limit = Math.min(30, Math.max(5, Number($("topTags").value) || 12));
  const totals = new Map();
  for (const ds of datasets) {
    for (const item of ds.tags.top) totals.set(item.tag, (totals.get(item.tag) || 0) + item.count);
  }
  const tags = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
  const series = datasets.map((ds) => {
    const byTag = new Map(ds.tags.top.map((item) => [item.tag, item.count]));
    return {
      name: shortName(ds),
      type: "bar",
      stack: "tags",
      barMaxWidth: 18,
      data: tags.map((tag) => byTag.get(tag) || 0),
      itemStyle: { color: seriesColorOf(ds) },
    };
  });
  setChart("tag", {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: fmtInt },
    legend: { top: 0, textStyle: { color: ink.text }, type: "scroll" },
    grid: { left: 8, right: 24, top: 32, bottom: 8, containLabel: true },
    xAxis: { type: "value", splitLine: { lineStyle: { color: ink.line } },
             axisLabel: { color: ink.muted, formatter: fmtCompact } },
    // tags 按总量降序；inverse: true 让最大值显示在最上方。
    // 不能对 tags 做 reverse：series 数值已按降序生成，反转轴标签会整体错位。
    yAxis: { type: "category", data: tags, inverse: true,
             axisLabel: { color: ink.muted, width: 90, overflow: "truncate" },
             axisLine: { lineStyle: { color: ink.line } } },
    series,
  });
}

/* ---------------- 存在时间分布 ---------------- */
function renderExistence(datasets) {
  const ink = chartInk();
  const withBuckets = datasets.filter((ds) => ds.existence.available);
  if (!withBuckets.length) {
    setChart("exist", emptyOption(datasets.length ? "所选内容缺少时间字段，无法展示存在时间" : `选择${modeLabel()}后展示`));
    return;
  }
  const labels = withBuckets[0].existence.buckets.map((b) => b.label);
  const series = withBuckets.map((ds) => ({
    name: shortName(ds),
    type: "bar",
    barMaxWidth: 22,
    data: ds.existence.buckets.map((b) => b.count),
    itemStyle: { color: seriesColorOf(ds) },
  }));
  setChart("exist", {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: fmtInt },
    legend: { top: 0, textStyle: { color: ink.text }, type: "scroll" },
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: labels, axisLabel: { color: ink.muted, interval: 0, rotate: 24 },
             axisLine: { lineStyle: { color: ink.line } } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: ink.line } },
             axisLabel: { color: ink.muted } },
    series,
  });
}

/* ---------------- 自动洞察 ---------------- */
function renderInsights(datasets) {
  const list = $("insightList");
  list.replaceChildren();
  const items = [];
  if (!datasets.length) {
    list.append(node("li", "勾选数据集后，这里会给出跨数据集的对比结论。"));
    return;
  }
  const totalRows = datasets.reduce((sum, ds) => sum + ds.row_count, 0);
  items.push(`已对比 ${datasets.length} 个${modeLabel()}、共 ${fmtInt(totalRows)} 条作品；对比维度：关注度、互动结构、AI 浓度、数据规模与存在时间。`);

  // 雷达领先维度：该数据集某维度达到全体最大值。
  for (const ds of datasets) {
    const leading = RADAR_ACCESSORS.filter(([, accessor]) => {
      const value = accessor(ds);
      if (value == null) return false;
      const all = datasets.map(accessor).filter((v) => v != null);
      return all.length > 1 && value > 0 && value >= Math.max(...all) - 1e-9;
    }).map(([name]) => name);
    if (leading.length) {
      items.push(`「${shortName(ds)}」在 ${leading.join("、")} 维度领先全部所选数据集。`);
    }
  }

  // 综合关注度相对整体均值的高低。
  const totals = datasets.map((ds) => ({ ds, avg: ds.attention.overall.available ? ds.attention.overall.avg : null }));
  const mean = totals.filter((t) => t.avg != null);
  if (mean.length > 1) {
    const overall = mean.reduce((sum, t) => sum + t.avg * t.ds.row_count, 0) / mean.reduce((sum, t) => sum + t.ds.row_count, 0);
    const sorted = [...mean].sort((a, b) => b.avg - a.avg);
    const high = sorted[0];
    const low = sorted[sorted.length - 1];
    if (overall > 0) {
      items.push(`「${shortName(high.ds)}」平均综合关注度最高（${fmtInt(high.avg)}），约为整体加权均值（${fmtInt(overall)}）的 ${Math.round((high.avg / overall) * 100)}%；最低为「${shortName(low.ds)}」（${fmtInt(low.avg)}）。`);
    }
  }

  // AI 浓度最高的数据集。
  const aiSet = datasets.filter((ds) => ds.ai_ratio != null);
  if (aiSet.length > 1) {
    const top = [...aiSet].sort((a, b) => b.ai_ratio - a.ai_ratio)[0];
    items.push(`「${shortName(top)}」AI 作品占比最高（${Math.round(top.ai_ratio * 100)}%），内容自动化程度最明显。`);
  }

  // 整体趋势方向：最后一个周期 vs 上一周期（综合关注度均值）。
  const periods = [...new Set(datasets.flatMap((ds) => ds.trend.map((t) => t.period)))].sort();
  if (periods.length >= 2) {
    const avgAt = (p) => {
      const values = datasets
        .map((ds) => ds.trend.find((t) => t.period === p)?.overall?.avg)
        .filter((v) => v != null);
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };
    const current = avgAt(periods.at(-1));
    const previous = avgAt(periods.at(-2));
    if (current != null && previous) {
      const delta = Math.round(((current - previous) / previous) * 100);
      items.push(`最近周期（${periods.at(-1)}）平均综合关注度较上一周期${delta > 0 ? "上升" : delta < 0 ? "下降" : "持平"} ${Math.abs(delta)}%。`);
    }
  }

  // 标签与存在时间倾向。
  const tagTotals = new Map();
  for (const ds of datasets) {
    for (const item of ds.tags.top) tagTotals.set(item.tag, (tagTotals.get(item.tag) || 0) + item.count);
  }
  const topTag = [...tagTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topTag) items.push(`「${topTag[0]}」以 ${fmtInt(topTag[1])} 次成为整体最主要内容标签，反映所选数据集的共同题材倾向。`);
  const existence = datasets.filter((ds) => ds.existence.available);
  if (existence.length > 1) {
    const sorted = [...existence].sort((a, b) => b.existence.avg_seconds - a.existence.avg_seconds);
    items.push(`「${shortName(sorted[0])}」平均存在时间最长（${humanDuration(sorted[0].existence.avg_seconds)}），内容沉淀更久；「${shortName(sorted.at(-1))}」最短（${humanDuration(sorted.at(-1).existence.avg_seconds)}），以新近内容为主。`);
  }

  list.replaceChildren(...items.slice(0, 9).map((text) => node("li", text)));
}

function renderAll() {
  const datasets = state.overview?.datasets || [];
  renderKpis(datasets);
  renderTrend(datasets);
  renderRadar(datasets);
  renderTags(datasets);
  renderExistence(datasets);
  renderInsights(datasets);
}

/* ---------------- 事件绑定与启动 ---------------- */
/* ---------------- 导入数据集 ---------------- */
function bindImport() {
  const fileInput = $("importFile");
  const nameInput = $("importName");
  const submit = $("importSubmit");
  const sync = () => {
    submit.disabled = !(fileInput.files.length && nameInput.value.trim());
  };
  fileInput.addEventListener("change", sync);
  nameInput.addEventListener("input", sync);
  submit.addEventListener("click", () => action(submit, async () => {
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("name", nameInput.value.trim());
    const result = await api.importDataset(formData);
    if (result.reused) {
      message("该文件与主词条此前已导入，沿用既有任务。");
    } else {
      message(`已创建导入清洗任务（${fmtInt(result.row_count)} 条，跳过 ${fmtInt(result.skipped)} 条空行），后台清洗中…`);
    }
    $("importBox").open = false;
    nameInput.value = "";
    fileInput.value = "";
    sync();
    // 轮询独立于按钮忙态：上传即恢复可用，清洗进度在后台跟踪。
    pollImportTask(result.task_id);
  }));
}

async function pollImportTask(taskId) {
  // 轮询清洗任务至终态后刷新目录；容忍偶发网络抖动（连续 3 次失败才放弃），
  // 上限 5 分钟，超时则提示去任务记录查看。
  let failures = 0;
  for (let round = 0; round < 120; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    let task;
    try {
      task = await api.task(taskId);
      failures = 0;
    } catch (error) {
      failures += 1;
      if (failures >= 3) {
        message(`导入任务状态查询失败：${error.message}`, true);
        return;
      }
      continue;
    }
    if (["succeeded", "partial_success"].includes(task.status)) {
      message("导入数据集清洗完成，已加入分析目录。");
      await loadCatalog();
      return;
    }
    if (["failed", "canceled"].includes(task.status)) {
      message(`导入清洗任务${task.status === "failed" ? "失败" : "已取消"}：${task.error?.message || "请查看任务记录。"}`, true);
      await loadCatalog();
      return;
    }
  }
  message("导入清洗仍在进行，可稍后刷新查看。", true);
}

function bind() {
  $("datasetSearch").addEventListener("input", renderCatalog);
  $("datasetList").addEventListener("change", (event) => {
    const checkbox = event.target;
    if (checkbox instanceof HTMLInputElement) {
      toggleDataset(checkbox.dataset.id, checkbox.checked);
    }
  });
  $("modeDataset").addEventListener("click", () => setMode("dataset"));
  $("modeTag").addEventListener("click", () => setMode("tag"));
  $("pickAll").addEventListener("click", () => {
    if (state.mode === "dataset") {
      state.selections.dataset = state.catalog
        .filter((item) => item.row_count > 0)
        .slice(0, MAX_SELECTED)
        .map((item) => item.dataset_id);
    } else {
      state.selections.tag = state.tagCatalog.slice(0, MAX_SELECTED).map((item) => item.tag);
    }
    renderCatalog();
    loadOverview();
  });
  $("pickNone").addEventListener("click", () => {
    state.selections[state.mode] = [];
    renderCatalog();
    loadOverview();
  });
  $("refreshBtn").addEventListener("click", async () => {
    if (state.mode === "dataset") await loadCatalog();
    else await loadTagCatalog(true);
    renderCatalog();
    loadOverview();
  });
  bindImport();
  for (const id of ["bucketSel", "metricSel", "statSel", "topTags"]) {
    $(id).addEventListener("change", scheduleLoad);
  }
  // 主题切换后按新配色重绘图表（KPI 与文字颜色由 CSS 变量自动生效）。
  new MutationObserver(renderAll)
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

async function loadCatalog() {
  try {
    const data = await api.analysisDatasets();
    state.catalog = data.items || [];
  } catch (error) {
    state.catalog = [];
    $("analysisStatus").textContent = error.message;
    message(error.message, true);
  }
  renderCatalog();
}

mountTheme();
initCharts();
bind();
loadCatalog().then(() => {
  // 默认勾选前两个有数据的数据集，打开页面即有图可看。
  state.selections.dataset = state.catalog.filter((item) => item.row_count > 0)
    .slice(0, 2).map((item) => item.dataset_id);
  renderCatalog();
  loadOverview();
});

return {  };
});

__def("api.js", function (require) {
// 所有 HTTP 请求集中管理；页面与 FastAPI 同源，不需要写死端口。
const client = window.axios.create({ baseURL: "/api/v1", timeout: 20000 });
client.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        /* 非 JSON 下载错误沿用 HTTP 提示。 */
      }
    }
    const detail = error.response?.data?.error;
    const missingTaskRoute =
      error.response?.status === 404 &&
      (detail?.message === "Not Found" ||
        error.response?.data?.detail === "Not Found") &&
      /\/tasks\/[^/]+\/(csv|delete)$/.test(error.config?.url || "");
    const validation = detail?.details
      ?.map?.((item) => item.message)
      .join("；");
    return Promise.reject(
      new Error(
        [
          (error.response?.status === 404 && /\/xhs\/auth\//.test(error.config?.url || '')
            ? '当前服务尚未加载小红书登录接口，请重启 FastAPI 后刷新页面。'
            : missingTaskRoute
            ? "当前服务尚未加载下载或删除接口，请重启 FastAPI 后重试。"
            : detail?.message) ||
            (error.response?.status === 503 ? "服务尚未就绪" : error.message),
          validation,
        ]
          .filter(Boolean)
          .join("："),
      ),
    );
  },
);
const id = encodeURIComponent;
const platform = new URLSearchParams(window.location.search).get('platform') === 'xhs' ? 'xhs' : 'pixiv';
const api = {
  xhsAuthStatus: () => client.get('/xhs/auth/status'),
  xhsLogin: () => client.post('/xhs/auth/login'),
  xhsLogout: () => client.post('/xhs/auth/logout'),
  xhsRefreshQr: () => client.post('/xhs/auth/refresh'),
  xhsCancelLogin: () => client.post('/xhs/auth/cancel'),
  retryMedia: (task) => client.post(`/tasks/${id(task)}/retry-media`),
  downloadMedia: (url) => client.get(url, { baseURL: '', responseType: 'blob' }),
  datasets: (page) =>
    client.get("/datasets", { params: { page, page_size: 20, platform } }),
  dataset: (dataset) => client.get(`/datasets/${id(dataset)}/stats`),
  stats: (dataset) => client.get(`/datasets/${id(dataset)}/stats`),
  openDatasetFolder: (dataset) => client.post(`/datasets/${id(dataset)}/open-folder`),
  columns: (dataset) => client.get(`/datasets/${id(dataset)}/columns`),
  artworks: (dataset, params, signal) =>
    client.get(`/datasets/${id(dataset)}/artworks`, { params, signal }),
  tasks: (page) => client.get("/tasks", { params: { page, page_size: 10, platform } }),
  notes: (dataset, params, signal) => client.get(`/datasets/${id(dataset)}/notes`, { params, signal }),
  note: (dataset, note) => client.get(`/datasets/${id(dataset)}/notes/${id(note)}`),
  task: (task) => client.get(`/tasks/${id(task)}`),
  collect: (body, key) =>
    client.post("/collection-tasks", body, {
      headers: { "Idempotency-Key": key },
    }),
  clean: (dataset, formulas) =>
    client.post("/cleaning-tasks", {
      dataset_id: dataset,
      ...(formulas?.length ? { formulas } : {}),
    }),
  aiTranslate: (dataset) =>
    client.post("/ai-translation-tasks", { dataset_id: dataset }),
  translationStatus: () => client.get("/translation/status"),
  applyFormulas: (dataset, formulas) =>
    client.post(`/datasets/${id(dataset)}/formulas`, { formulas }),
  deleteFormulas: (dataset, names, all = false) =>
    client.post(`/datasets/${id(dataset)}/formulas/delete`, { names, all }),
  cancel: (task) => client.post(`/tasks/${id(task)}/cancel`),
  resume: (task) => client.post(`/tasks/${id(task)}/resume`),
  removeTask: (task) => client.post(`/tasks/${id(task)}/delete`),
  analysisDatasets: () => client.get("/analysis/datasets"),
  analysisTags: (limit) => client.get("/analysis/tags", { params: limit ? { limit } : {} }),
  analysisOverview: (params) => client.get("/analysis/overview", { params }),
  importDataset: (formData) =>
    client.post("/analysis/import", formData, { timeout: 120000 }),
  downloadCsv: (task, kind) =>
    client.get(`/tasks/${id(task)}/csv`, { responseType: "blob", params: kind ? { kind } : {} }),
  health: () => client.get("/health", { baseURL: "" }),
  ready: () => client.get("/ready", { baseURL: "" }),
  settings: () => client.get("/settings"),
  revealSetting: (key) => client.post("/settings/reveal", { key }),
  saveSettings: (fields) => client.put("/settings", { fields }),
  aiModels: (payload) => client.post("/ai/models", payload, { timeout: 30000 }),
};

return { "platform": platform, "api": api };
});

__def("app.js", function (require) {
var __dep46 = require("api.js"); var api = __dep46["api"]; var platform = __dep46["platform"];
var __dep47 = require("components/dom.js"); var $ = __dep47["$"]; var message = __dep47["message"]; var node = __dep47["node"];
var __dep48 = require("components/collection.js"); var mountCollection = __dep48["mountCollection"];
var __dep49 = require("components/tasks.js"); var mountTasks = __dep49["mountTasks"];
var __dep50 = require("components/datasets.js"); var mountDatasets = __dep50["mountDatasets"];
var __dep51 = require("components/artworks.js"); var mountArtworks = __dep51["mountArtworks"];
var __dep52 = require("components/xhs-page.js"); var configureXhsPage = __dep52["configureXhsPage"]; var mountNotes = __dep52["mountNotes"]; var mountXhsDatasets = __dep52["mountXhsDatasets"];
var __dep53 = require("components/xhs-auth.js"); var mountXhsAuth = __dep53["mountXhsAuth"];
var __dep54 = require("components/settings.js"); var mountSettings = __dep54["mountSettings"];
var __dep55 = require("components/theme.js"); var mountTheme = __dep55["mountTheme"];

const xhsAuth = mountXhsAuth();
mountTheme();
mountSettings();

$('platformPixiv').setAttribute('aria-current', platform === 'pixiv' ? 'page' : 'false');
$('platformXhs').setAttribute('aria-current', platform === 'xhs' ? 'page' : 'false');
if (platform === 'xhs') configureXhsPage();
const artworks = platform === 'xhs' ? mountNotes() : mountArtworks();
let lastDatasetRefresh = 0;
const tasks = mountTasks(
  () => datasets.refresh(),
  async (items) => {
    if (
      items.some(
        (task) =>
          task.status === "running" || task.status === "cancel_requested",
      ) &&
      Date.now() - lastDatasetRefresh >= 9000
    ) {
      lastDatasetRefresh = Date.now();
      await datasets.refresh();
    }
  },
);
const datasets = platform === 'xhs' ? mountXhsDatasets(artworks) : mountDatasets(artworks, (task) => tasks.track(task));
mountCollection((task) => tasks.track(task));

async function health() {
  const [service, database] = await Promise.allSettled([api.health(), api.ready()]);
  // 正常连接（在线 / 已连接）显示绿色，异常显示红色，便于一眼判断服务可用性。
  const serviceOk = service.status === "fulfilled";
  const databaseOk = database.status === "fulfilled";
  $("status").replaceChildren(
    node("span", `服务 ${serviceOk ? "在线" : "不可达"}`, serviceOk ? "status-ok" : "status-bad"),
    node("span", " · "),
    node("span", `数据库 ${databaseOk ? "已连接" : "未连接"}`, databaseOk ? "status-ok" : "status-bad"),
  );
}

$("healthRefresh").onclick = () => Promise.all([health(), xhsAuth.refresh()]);
Promise.all([health(), tasks.refresh(), datasets.refresh()]).catch((error) =>
  message(error.message, true),
);

return {  };
});

__def("components/artwork-details.js", function (require) {
var __dep56 = require("components/dom.js"); var $ = __dep56["$"]; var node = __dep56["node"];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("zh-CN", { hour12: false });
}

function safeLink(value, label) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol))
      return node("span", "链接格式不可用");
    const link = node("a", label || url.href);
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  } catch {
    return node("span", "链接格式不可用");
  }
}

function renderDetails(row) {
  const box = $("artworkDetails");
  box.replaceChildren();
  if (!row) return;
  const list = node("dl", undefined, "artwork-details");
  for (const [name, value] of [
    ["作品标题", row.title],
    ["作品 ID", row.id],
    ["作者", row.author_name],
    ["作者 ID", row.author_id],
    ["平台", row.platform],
    ["采集标签", row.search_tag],
    ["作品标签", row.tags.join(" / ")],
    ["AI 标记", row.is_ai],
    ["发布时间", formatDate(row.create_date)],
    ["采集时间", formatDate(row.crawl_time)],
    ["本地图片目录", row.image_dir || "尚未下载"],
  ])
    list.append(node("dt", name), node("dd", value || "—"));
  list.append(node("dt", "来源链接"));
  const source = node("dd");
  source.append(row.page_url ? safeLink(row.page_url) : node("span", "—"));
  list.append(source);
  box.append(list);
}

return { "formatDate": formatDate, "renderDetails": renderDetails };
});

__def("components/artworks.js", function (require) {
var __dep57 = require("api.js"); var api = __dep57["api"];
var __dep58 = require("components/dom.js"); var $ = __dep58["$"]; var node = __dep58["node"];
var __dep59 = require("components/artwork-details.js"); var renderDetails = __dep59["renderDetails"]; var formatDate = __dep59["formatDate"];
var __dep60 = require("components/image-tools.js"); var mountImageTools = __dep60["mountImageTools"];

const BUILTIN_CLEANED = [
  "存在时间",
  "存在秒数",
];

const HIDDEN_CLEANED = new Set([
  "平台", "来源平台",
  "采集使用tag", "搜索标签",
  "作品标题", "作品id", "作品ID", "id",
  "作者昵称", "作者id", "作者ID",
  "作品发布时间", "采集时间",
  "帖子附带的tag", "作品标签", "标签",
  "来源链接", "page_url",
  "本地图片名称/目录", "图片目录",
  "原图url", "original_urls",
  "是否ai", "是否AI", "is_ai",
  "主标签", "标签版本",
  "浏览数", "浏览量", "view_count",
  "点赞数", "点赞量", "like_count",
  "收藏数", "收藏量", "bookmark_count",
  "评论数", "评论量", "comment_count",
]);

// 「当前数据集高频标签」的可排序表头：作品数与 AI 率，同时只有一列处于排序状态。
const TAG_SORTS = {
  count: { field: "count", header: "tagCountSort", arrow: "tagCountArrow" },
  ai: { field: "ai_rate", header: "tagAiSort", arrow: "tagAiArrow" },
};

function formatMetric(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const fixed = Number(number.toFixed(4));
  return Number.isInteger(fixed)
    ? fixed.toLocaleString("zh-CN")
    : fixed.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
}

function getAiFilter() {
  const active = $("aiFilter").querySelector('button[aria-pressed="true"]');
  return active?.dataset.value ?? "";
}

// 作品显示处的「全部 / AI / 非 AI」按钮组与排行区的 AI 筛选下拉框双向绑定，
// 两处始终呈现同一筛选值。
function setAiFilter(value) {
  for (const button of $("aiFilter").querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.value === value));
  }
  $("rankAi").value = value;
}

function mountArtworks() {
  let dataset = "",
    page = 1,
    rows = [],
    cursor = 0,
    imageIndex = 0,
    requestVersion = 0,
    loadAbort = null,
    tagRows = [],
    tagSortKey = "",
    tagSortDir = "";
  mountImageTools(() => ({ dataset, row: rows[cursor], index: imageIndex }));

  // 「当前数据集高频标签」渲染：标签列上行显示对照表译文、下行灰色小字显示采集到的
  // 原文（无译文时只显示原文）。
  function renderTags() {
    const list = [...tagRows];
    if (tagSortKey) {
      const { field } = TAG_SORTS[tagSortKey];
      list.sort((a, b) => {
        const delta =
          tagSortDir === "desc" ? b[field] - a[field] : a[field] - b[field];
        return delta || b.count - a.count;
      });
    }
    $("tags").replaceChildren(
      ...list.map((t) => {
        const tr = node("tr");
        const td = node("td");
        const label = node("button", t.tag_zh || t.tag, "work-link");
        label.title = "按该标签筛选作品";
        label.onclick = () => {
          $("qSub").value = t.tag;
          page = 1;
          load();
        };
        td.append(label);
        if (t.tag_zh) td.append(node("div", t.tag, "muted"));
        const rate = node(
          "td",
          typeof t.ai_rate === "number"
            ? `${(t.ai_rate * 100).toFixed(1)}%`
            : "—",
        );
        rate.title = `AI 作品 ${t.ai_count ?? "—"} / 全部作品 ${t.count}；按该标签独立计算`;
        tr.append(td, node("td", t.count), rate);
        return tr;
      }),
    );
  }

  function paintTagSort() {
    for (const [name, config] of Object.entries(TAG_SORTS)) {
      const active = name === tagSortKey;
      $(config.header).setAttribute(
        "aria-sort",
        active ? (tagSortDir === "desc" ? "descending" : "ascending") : "none",
      );
      $(config.arrow).textContent = active
        ? tagSortDir === "desc"
          ? " ▼"
          : " ▲"
        : "";
    }
  }

  // 点击「作品数」或「AI 率」表头：在 Top 50 高频标签内切换 高→低 / 低→高，不重新请求后端。
  function setTagSort(key) {
    tagSortDir = tagSortKey === key && tagSortDir === "desc" ? "asc" : "desc";
    tagSortKey = key;
    paintTagSort();
    renderTags();
  }

  function resetTagSort() {
    tagSortKey = "";
    tagSortDir = "";
    paintTagSort();
    renderTags();
  }

  function show() {
    const row = rows[cursor];
    renderDetails(row);
    for (const button of $("filters").querySelectorAll(
      "button[data-artwork]",
    )) {
      const selected = button.dataset.artwork === row?.id;
      button.setAttribute("aria-pressed", String(selected));
      button.closest("tr").classList.toggle("selected-work", selected);
    }

    const images = row?.images || [];
    $("downloadImage").disabled = !images.length;

    $("keyword").textContent = row?.title || "暂无作品";
    // 标题下方的小字：作品 ID（未选中作品时留空）
    $("keywordId").textContent = row ? `作品 ID：${row.id}` : "";
    $("imgCount").textContent = images.length;
    $("preview").hidden = !images.length;
    $("imageEmpty").hidden = Boolean(images.length);
    $("imageEmpty").textContent = row
      ? "没有已下载图片；仅抓取模式仍可查看作品数据和来源。"
      : "选择数据集查看作品";

    if (row && !images.length) {
      const details = node("div", undefined, "artwork-summary");
      details.append(
        node("h3", row.title || `作品 ${row.id}`),
        node(
          "p",
          `作者：${row.author_name || row.author_id || "未知"} · ${row.is_ai === "是" ? "AI" : "非 AI"}`,
        ),
        node("p", `标签：${row.tags.join(" / ") || "无"}`),
        node(
          "p",
          `浏览 ${row.view_count ?? 0} · 点赞 ${row.like_count ?? 0} · 收藏 ${row.bookmark_count ?? 0}`,
        ),
        node("p", "暂无已下载图片，可通过下方链接查看 Pixiv 原作。", "muted"),
      );
      $("imageEmpty").replaceChildren(details);
    }

    if (!images.length) $("preview").removeAttribute("src");
    else if ($("preview").getAttribute("src") !== images[imageIndex])
      $("preview").src = images[imageIndex];
    $("preview").onerror = () => {
      $("preview").hidden = true;
      $("imageEmpty").hidden = false;
      $("imageEmpty").textContent = "图片文件无法读取";
    };

    $("prevImage").disabled = imageIndex <= 0;
    $("nextImage").disabled = imageIndex >= images.length - 1;
    $("prevBtn").disabled = cursor <= 0;
    $("nextBtn").disabled = cursor >= rows.length - 1;
    $("caption").textContent = row
      ? `本页作品 ${cursor + 1}/${rows.length} · 图片 ${images.length ? imageIndex + 1 : 0}/${images.length}`
      : "";

    const link = $("sourceLink");
    link.hidden = !row || !/^\d+$/.test(row.id);
    link.href = row
      ? `https://www.pixiv.net/artworks/${encodeURIComponent(row.id)}`
      : "#";

    const box = $("bars");
    box.replaceChildren();
    if (!row) {
      box.append(node("p", "暂无作品数据", "muted"));
      return;
    }

    const fields = [
      ["浏览量", row.view_count],
      ["点赞数", row.like_count],
      ["收藏数", row.bookmark_count],
      ["评论数", row.comment_count],
    ];

    const cleaned = row.cleaned || {};
    for (const name of BUILTIN_CLEANED) {
      if (cleaned[name] != null) fields.push([name, cleaned[name]]);
    }
    const customNames = Object.keys(cleaned)
      .filter(
        (name) =>
          !BUILTIN_CLEANED.includes(name) && !HIDDEN_CLEANED.has(name),
      )
      .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    for (const name of customNames) {
      const value = cleaned[name];
      if (value == null || value === "") continue;
      fields.push([name, value]);
    }

    for (const [label, value] of fields) {
      const item = node("div", undefined, "bar-item");
      const head = node("div", undefined, "bar-head");
      head.append(
        node("span", label, "bar-name"),
        node("span", formatMetric(value), "bar-val"),
      );
      item.append(head);

      const countField = {
        浏览量: "view_count",
        点赞数: "like_count",
        收藏数: "bookmark_count",
        评论数: "comment_count",
      }[label];
      if (countField) {
        const maximum = Math.max(
          1,
          ...rows.map((r) => Number(r[countField]) || 0),
        );
        const track = node("div", undefined, "bar-track");
        const fill = node("div", undefined, "bar-fill");
        track.title = "相对于本页作品的最高值";
        fill.style.width = `${Math.max(0, Math.min(100, (Number(value || 0) / maximum) * 100))}%`;
        fill.style.background = "linear-gradient(90deg, #1d4ed8, #60a5fa)";
        track.append(fill);
        item.append(track);
      }
      box.append(item);
    }

    if (!row.cleaned)
      box.append(node("p", "尚未清洗，清洗后显示派生列。", "muted"));
  }

  async function load(quiet = false) {
    // 取消上一次仍未返回的请求，避免快速翻页/筛选时堆积请求。
    loadAbort?.abort();
    const controller = loadAbort = new AbortController();
    const version = ++requestVersion;
    const selectedId = rows[cursor]?.id;
    if (!quiet) {
      rows = [];
      cursor = imageIndex = 0;
      tagRows = [];
      show();
      $("filters").replaceChildren();
      $("tags").replaceChildren();
    }
    if (!dataset) {
      $("searchInfo").textContent = "暂无数据集";
      $("artPage").textContent = "/ 0 页";
      $("artPageInput").disabled = $("artJumpBtn").disabled = true;
      $("tagTotal").textContent = "总数：0个";
      $("artPrev").disabled = $("artNext").disabled = true;
      return;
    }
    $("searchInfo").textContent = "加载作品中…";
    try {
      const result = await api.artworks(dataset, {
        page,
        page_size: 20,
        q: $("qMain").value.trim(),
        tag: $("qSub").value.trim(),
        ai: getAiFilter(),
        sort_by: $("rankSort").value,
        order: $("rankOrder").value,
      }, controller.signal);
      if (version !== requestVersion) return;
      rows = result.items;
      const pages = Math.ceil(result.total / 20);
      $("artPage").textContent = `/ ${pages} 页`;
      $("artPageInput").max = Math.max(1, pages);
      if (document.activeElement !== $("artPageInput"))
        $("artPageInput").value = page;
      $("artPageInput").disabled = $("artJumpBtn").disabled = !pages;
      $("tagTotal").textContent =
        `总数：${result.tag_total ?? result.tags.length}个`;
      $("tagTotal").title =
        `全部去重标签数量；列表显示频次最高的 ${result.tags.length} 个`;
      if (quiet) {
        cursor = Math.max(
          0,
          rows.findIndex((row) => row.id === selectedId),
        );
        imageIndex = Math.min(
          imageIndex,
          Math.max(0, (rows[cursor]?.images?.length || 0) - 1),
        );
      }
      $("searchInfo").textContent =
        `共 ${result.total} 个作品 · 第 ${page} 页 · AI ${result.ai_counts["是"]} / 非 AI ${result.ai_counts["否"]}（数据集总数）`;
      $("artPrev").disabled = page <= 1;
      $("artNext").disabled = page * 20 >= result.total;
      $("filters").replaceChildren(
        ...rows.map((r, index) => {
          const tr = node("tr");
          const td = node("td");
          const button = node("button", r.title || r.id, "work-link");
          button.dataset.artwork = r.id;
          button.title = "查看作品完整信息、原图链接与统计数据";
          button.onclick = () => {
            cursor = index;
            imageIndex = 0;
            show();
            $("artworkDetails").scrollIntoView({
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
              block: "nearest",
            });
          };
          td.append(
            button,
            node("div", `画师 ${r.author_name || r.author_id}`, "muted"),
          );
          const field = $("rankSort").value;
          const value = ["create_date", "crawl_time"].includes(field)
            ? formatDate(r[field])
            : (r[field] ?? 0).toLocaleString("zh-CN");
          tr.append(td, node("td", value));
          return tr;
        }),
      );
      tagRows = result.tags || [];
      renderTags();
      show();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (version === requestVersion)
        $("searchInfo").textContent = error.message;
    }
  }

  $("searchForm").onsubmit = (event) => {
    event.preventDefault();
    page = 1;
    load();
  };
  for (const id of ["rankSort", "rankOrder"])
    $(id).onchange = () => {
      $("rankColumn").textContent =
        $("rankSort").selectedOptions[0].textContent;
      page = 1;
      load();
    };
  $("rankAi").onchange = () => {
    setAiFilter($("rankAi").value);
    page = 1;
    load();
  };
  for (const [name, config] of Object.entries(TAG_SORTS)) {
    $(config.header).querySelector("button").onclick = () => setTagSort(name);
  }
  $("qReset").onclick = () => {
    $("qMain").value = "";
    $("qSub").value = "";
    setAiFilter("");
    page = 1;
    load();
  };
  $("artJump").onsubmit = (event) => {
    event.preventDefault();
    const target = Number($("artPageInput").value);
    if (
      !Number.isInteger(target) ||
      target < 1 ||
      target > Number($("artPageInput").max)
    )
      return;
    page = target;
    load();
  };
  $("artPrev").onclick = () => {
    page--;
    load();
  };
  $("artNext").onclick = () => {
    page++;
    load();
  };
  $("prevBtn").onclick = () => {
    cursor--;
    imageIndex = 0;
    show();
  };
  $("nextBtn").onclick = () => {
    cursor++;
    imageIndex = 0;
    show();
  };
  $("prevImage").onclick = () => {
    imageIndex--;
    show();
  };
  $("nextImage").onclick = () => {
    imageIndex++;
    show();
  };
  $("aiFilter").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    setAiFilter(button.dataset.value);
    page = 1;
    load();
  });

  setAiFilter("");
  show();
  return {
    select: (id) => {
      dataset = id;
      page = 1;
      $("qMain").value = $("qSub").value = "";
      setAiFilter("");
      resetTagSort();
      return load();
    },
    refresh: () => load(true),
  };
}
return { "mountArtworks": mountArtworks };
});

__def("components/collection.js", function (require) {
var __dep61 = require("api.js"); var api = __dep61["api"]; var platform = __dep61["platform"];
var __dep62 = require("components/dom.js"); var $ = __dep62["$"]; var action = __dep62["action"]; var message = __dep62["message"];
var __dep63 = require("components/request-id.js"); var createRequestId = __dep63["createRequestId"];

function mountCollection(onCreated) {
  let pending = null;
  $("collectionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    action($("tagBtn"), async () => {
      const tags = [
        ...new Set(
          $("tagInput")
            .value.split(/[,，\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
      if (platform === 'pixiv' && (!tags.length || tags.length > 20 || tags.some((s) => s.length > 100)))
        throw new Error("请输入 1～20 个标签，每个不超过 100 字符");
      const keyword = $('tagInput').value.trim();
      if (platform === 'xhs' && (!keyword || keyword.length > 100 || /[\x00-\x1f]/.test(keyword)))
        throw new Error('请输入 1～100 字符的单个搜索关键词');
      const body = platform === 'xhs' ? {
        platform: 'xhs', keyword, target_count: Number($('targetCount').value),
        content_type: $('countScope').value, download_media: $('mode').value === 'with_media',
      } : {
        platform: "pixiv",
        tags,
        target_count: Number($("targetCount").value),
        count_scope: $("countScope").value,
        mode: $("mode").value,
      };
      const signature = JSON.stringify(body);
      if (pending?.signature !== signature)
        pending = { signature, key: createRequestId() };
      const task = await api.collect(body, pending.key);
      pending = null;
      message(`采集任务已提交：${task.task_id}`);
      await onCreated(task);
    });
  });
}

return { "mountCollection": mountCollection };
});

__def("components/dataset-carousel.js", function (require) {
var __dep64 = require("components/dom.js"); var $ = __dep64["$"]; var node = __dep64["node"];

function mountDatasetCarousel(onSelect) {
  const track = $("filtersTag");
  let signature = "";
  function updateArrows() {
    const end = track.scrollWidth - track.clientWidth;
    $("tagsPrev").disabled = track.scrollLeft <= 1;
    $("tagsNext").disabled = track.scrollLeft >= end - 1;
  }
  for (const [id, direction] of [
    ["tagsPrev", -1],
    ["tagsNext", 1],
  ]) {
    $(id).onclick = () =>
      track.scrollBy({
        left: direction * Math.max(100, track.clientWidth * 0.8),
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  }
  track.addEventListener("scroll", updateArrows, { passive: true });
  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      track.scrollBy({ left: event.key === "ArrowLeft" ? -140 : 140 });
    }
  });
  const observer = new ResizeObserver(updateArrows);
  observer.observe(track);
  window.addEventListener("pagehide", () => observer.disconnect());
  return (items, current) => {
    const nextSignature = JSON.stringify(
      items.map((item) => [item.dataset_id, item.tags]),
    );
    if (nextSignature !== signature) {
      signature = nextSignature;
      track.replaceChildren(
        ...items.flatMap((item) =>
          (item.tags?.length ? item.tags : ["数据集"]).map((tag) => {
            const button = node("button", tag, "dataset-chip");
            button.dataset.id = item.dataset_id;
            button.title = `${tag} · ${item.dataset_id}`;
            button.onclick = () => onSelect(item.dataset_id);
            return button;
          }),
        ),
      );
      if (!items.length) track.append(node("span", "暂无采集标签", "muted"));
    }
    for (const button of track.querySelectorAll("button")) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.id === current),
      );
    }
    requestAnimationFrame(updateArrows);
  };
}

return { "mountDatasetCarousel": mountDatasetCarousel };
});

__def("components/datasets.js", function (require) {
var __dep65 = require("api.js"); var api = __dep65["api"];
var __dep66 = require("components/dom.js"); var $ = __dep66["$"]; var node = __dep66["node"]; var action = __dep66["action"]; var message = __dep66["message"];
var __dep67 = require("components/dataset-carousel.js"); var mountDatasetCarousel = __dep67["mountDatasetCarousel"];

// 全角 → 半角 映射（括号、四则运算符、百分号）
const WIDE_TO_HALF = {
  "（": "(",
  "）": ")",
  "＋": "+",
  "－": "-",
  "＊": "*",
  "／": "/",
  "％": "%",
};

function normalizeFormula(text) {
  if (!text) return "";
  return text.replace(/[（）＋－＊／％]/g, (c) => WIDE_TO_HALF[c] || c);
}

function mountDatasets(artworks, onTask) {
  let carouselItems = [];
  const renderCarousel = mountDatasetCarousel((id) => {
    $("docSelect").value = id;
    select(id);
  });
  let page = 1,
    current = "",
    currentStatus = "",
    version = 0;
  // 列表刷新版本号：并发刷新时旧响应不得覆盖新结果（与 xhs-page 对齐）。
  let listVersion = 0;
  // 防止快速连续点击翻页时叠加出多笔无效请求。
  let turning = false;
  let availableColumns = [];
  let derivedColumns = [];
  // 由后端 /columns 接口下发，避免前后端两处硬编码
  let PROTECTED = new Set();
  // 当前数据集的物理表名（清洗后才有）
  let physicalTables = {};
  // 固定的一行公式
  let currentFormula = { name: "", expression: "" };

  // 固定一个输入框：列名 / 表达式 / 插入字段
  function renderFormulaInput() {
    const box = $("formulaList");
    if (!box) return;
    box.replaceChildren();

    const row = node("div", undefined, "formula-card");

    // 列名
    const nameGroup = node("label", undefined, "formula-field");
    nameGroup.append(node("span", "列名", "formula-label"));
    const name = node("input");
    name.id = "formulaName";
    name.placeholder = "例：收藏占比";
    name.maxLength = 50;
    name.value = currentFormula.name;
    name.autocomplete = "off";
    name.oninput = () => {
      currentFormula.name = name.value;
    };
    nameGroup.append(name);
    row.append(nameGroup);

    // 表达式（全角自动转半角，且不破坏 IME / 光标位置）
    const exprGroup = node("label", undefined, "formula-field");
    exprGroup.append(node("span", "表达式", "formula-label"));
    const expression = node("input");
    expression.id = "formulaExpression";
    expression.placeholder = "例：(点赞数 + 收藏数) / (浏览数 + 1)";
    expression.maxLength = 500;
    expression.value = currentFormula.expression;
    expression.autocomplete = "off";

    // 统一的"全角转半角 + 光标保持"处理：
    // - oninput：跳过 IME 组合，避免打断输入法
    // - compositionend：IME 组合结束后统一转换
    // - onchange：兜底（浏览器自动填充等场景）
    function syncExpression() {
      const before = expression.value;
      const after = normalizeFormula(before);
      if (after === before) {
        currentFormula.expression = after;
        return;
      }
      const start = expression.selectionStart ?? after.length;
      const end = expression.selectionEnd ?? after.length;
      expression.value = after;
      try {
        expression.setSelectionRange(start, end);
      } catch {
        /* 某些浏览器极端情况下会抛异常，忽略。 */
      }
      currentFormula.expression = after;
    }

    expression.oninput = (event) => {
      // IME 组合期间不改写，避免打断输入法。
      if (event.isComposing) {
        currentFormula.expression = expression.value;
        return;
      }
      syncExpression();
    };
    expression.addEventListener("compositionend", syncExpression);
    expression.onchange = syncExpression;

    exprGroup.append(expression);
    row.append(exprGroup);

    // 插入字段
    const insertGroup = node("label", undefined, "formula-field");
    insertGroup.append(node("span", "插入字段", "formula-label"));
    const insert = node("select");
    insert.setAttribute("aria-label", "插入字段名");
    const placeholder = node("option", "选择要插入的字段…");
    placeholder.value = "";
    insert.append(placeholder);
    insert.onchange = () => {
      if (!insert.value) return;
      const start = expression.selectionStart ?? expression.value.length;
      const end = expression.selectionEnd ?? start;
      const next =
        expression.value.slice(0, start) +
        insert.value +
        expression.value.slice(end);
      expression.value = next;
      currentFormula.expression = next;
      expression.focus();
      const caret = start + insert.value.length;
      expression.setSelectionRange(caret, caret);
      insert.value = "";
    };
    insert.dataset.role = "column-insert";
    insertGroup.append(insert);
    row.append(insertGroup);

    box.append(row);
    refreshColumnOptions(row);
  }

  function refreshColumnOptions(scope = document) {
    for (const select of scope.querySelectorAll(
      'select[data-role="column-insert"]',
    )) {
      const currentValue = select.value;
      const first = select.firstElementChild;
      select.replaceChildren(
        first,
        ...availableColumns.map((col) => {
          const option = node("option", col);
          option.value = col;
          return option;
        }),
      );
      if (availableColumns.includes(currentValue)) select.value = currentValue;
    }
  }

  function renderDerivedColumns() {
    const box = $("derivedList");
    if (!box) return;
    box.replaceChildren();
    if (!derivedColumns.length) {
      box.append(node("span", "暂无派生列", "muted"));
      return;
    }

    const select = node("select");
    select.setAttribute("aria-label", "选择要删除的派生列");
    select.className = "derived-select";
    const placeholder = node("option", "选择要删除的派生列…");
    placeholder.value = "";
    select.append(placeholder);
    for (const name of derivedColumns) {
      const option = node("option", name);
      option.value = name;
      select.append(option);
    }

    const del = node("button", "删除所选列", "ghost");
    del.type = "button";
    del.onclick = () =>
      action(del, async () => {
        const name = select.value;
        if (!name) {
          message("请先选择要删除的派生列。", true);
          return;
        }
        if (!current) return;
        if (
          !confirm(
            `确定删除派生列「${name}」？此操作会更新数据库与清洗 CSV。`,
          )
        )
          return;
        const res = await api.deleteFormulas(current, [name], false);
        message(`已删除：${res.deleted.join("、")}`);
        await loadColumns(current);
        await artworks.refresh();
      });

    box.append(select, del);
  }

  // 只读取固定那一行
  function readFormulas() {
    const name = (currentFormula.name || "").trim();
    const expression = normalizeFormula(currentFormula.expression || "").trim();
    if (!name && !expression) return [];
    if (!name || !expression)
      throw new Error("公式需要同时填写列名和表达式。");
    return [{ name, expression, round_digits: 2 }];
  }

  // 在 datasetInfo 里追加/替换"物理表"提示行。
  function renderPhysicalTables() {
    const info = $("datasetInfo");
    const old = info.querySelector(".physical-tables");
    if (old) old.remove();
    const t = physicalTables;
    if (!t || !t.cleaned) return;
    const line = node(
      "div",
      `PostgreSQL 物理表：${t.cleaned}（全量）· ${t.ai}（AI）· ${t.noai}（非 AI）`,
      "physical-tables",
    );
    info.append(line);
  }

  async function loadColumns(datasetId) {
    availableColumns = [];
    derivedColumns = [];
    physicalTables = {};
    try {
      const result = await api.columns(datasetId);
      availableColumns = result.columns || [];
      PROTECTED = new Set(result.protected_columns || []);
      derivedColumns = availableColumns.filter((c) => !PROTECTED.has(c));
      physicalTables = result.physical_tables || {};
    } catch {
      /* 未清洗时会 409，静默处理 */
    }
    refreshColumnOptions();
    renderDerivedColumns();
    renderPhysicalTables();
  }

  async function select(id) {
    const same = id === current;
    current = id;
    renderCarousel(carouselItems, id);
    const stamp = ++version;
    $("cleanBtn").disabled = true;
    $("aiTranslateBtn").disabled = true;
    $("openDatasetFolder").disabled = true;
    $("formulaApply").disabled = true;
    $("formulaInfo").textContent = "";
    $("datasetInfo").textContent = id
      ? "加载数据集…"
      : "暂无数据集，采集完成后会自动显示。";
    const view = same ? artworks.refresh() : artworks.select(id);
    if (!id) return view;
    try {
      const result = await api.stats(id);
      if (stamp !== version) return;
      currentStatus = result.status;
      physicalTables = {};
      const info = $("datasetInfo");
      info.replaceChildren();
      const created = result.created_at
        ? new Date(result.created_at).toLocaleString()
        : "—";
      info.append(
        node(
          "div",
          `${result.row_count} 条作品 · AI ${result.ai_count ?? "未清洗"} · 非 AI ${result.noai_count ?? "未清洗"} · 创建 ${created}`,
        ),
      );
      $("openDatasetFolder").disabled = false;
      $("cleanBtn").disabled =
        !["published", "canceled"].includes(result.status) || !result.row_count;
      $("cleanBtn").textContent =
        result.status === "cleaned"
          ? "重新清洗"
          : result.status === "collecting"
            ? "采集中，完成后清洗"
            : "清洗此数据集";
      $("aiTranslateBtn").disabled =
        !["published", "cleaned", "canceled"].includes(result.status) || !result.row_count;
      if (result.status === "collecting")
        info.prepend(
          node(
            "div",
            "采集中 · 已入库作品实时可查，合并 CSV 在采集结束后生成。",
          ),
        );
      $("formulaApply").disabled = result.status !== "cleaned";
      if (result.status !== "cleaned")
        $("formulaInfo").textContent =
          result.status === "collecting"
            ? "采集完成后可对清洗结果追加公式。"
            : "首次清洗完成后可对结果追加公式。";

      if (result.status === "cleaned") await loadColumns(id);
      else {
        availableColumns = [];
        derivedColumns = [];
        PROTECTED = new Set();
        physicalTables = {};
        renderDerivedColumns();
      }
    } catch (error) {
      if (stamp === version) infoError(error);
    }
    await view;
  }

  function infoError(error) {
    $("datasetInfo").textContent = error.message;
  }

  async function refresh() {
    const stamp = ++listVersion;
    let result = await api.datasets(page);
    const lastPage = Math.max(1, Math.ceil(result.total / 20));
    if (page > lastPage) {
      page = lastPage;
      result = await api.datasets(page);
    }
    if (stamp !== listVersion) return;
    carouselItems = result.items;
    // 保持用户当前选中的数据集：仅当它不在列表里（已删除/翻页）才回退到第一个。
    const selected =
      result.items.find((item) => item.dataset_id === current) ||
      result.items[0];
    $("docSelect").replaceChildren(
      ...result.items.map((item) => {
        const option = node(
          "option",
          `${(item.tags || []).join(" / ") || "数据集"} · ${item.dataset_id.slice(-8)} · ${item.row_count} 条`,
        );
        option.value = item.dataset_id;
        return option;
      }),
    );
    $("docSelect").value = selected?.dataset_id || "";
    $("datasetPage").textContent =
      `第 ${page} 页 · 共 ${result.total} 个数据集`;
    $("datasetPrev").disabled = page <= 1;
    $("datasetNext").disabled = page * 20 >= result.total;
    if (stamp !== listVersion) return;
    await select(selected?.dataset_id || "");
  }

  async function turn(delta) {
    if (turning) return;
    turning = true;
    $("datasetPrev").disabled = $("datasetNext").disabled = true;
    page += delta;
    try {
      await refresh();
    } catch (error) {
      page -= delta;
      infoError(error);
    } finally {
      turning = false;
    }
  }

  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return console.warn(`[datasets] 缺少 #${id}`);
    el.onclick = null;
    el.addEventListener("click", fn);
  };

  bind("datasetPrev", () => turn(-1));
  bind("datasetNext", () => turn(1));
  bind("datasetRefresh", () => action($("datasetRefresh"), refresh));
  // 下拉框切换数据集：此前漏绑 change，导致 current 永远停留在初始的
  // 第一个数据集——AI 翻译/清洗只作用于它，且自动刷新会把下拉框重置回去。
  $("docSelect").addEventListener("change", () =>
    select($("docSelect").value),
  );
  bind("openDatasetFolder", () =>
    action($("openDatasetFolder"), async () => {
      if (!current) return;
      await api.openDatasetFolder(current);
    }));

  bind("cleanBtn", () =>
    action($("cleanBtn"), async () => {
      if (!current) return;
      let formulas = [];
      try {
        formulas = readFormulas();
      } catch (error) {
        message(error.message, true);
        return;
      }
      const task = await api.clean(current, formulas);
      message(`清洗任务：${task.task_id}`);
      await onTask(task);
    }),
  );

  bind("aiTranslateBtn", () =>
    action($("aiTranslateBtn"), async () => {
      if (!current) return;
      const st = await api.translationStatus();
      if (st.latest_untranslated && !st.ai_configured) {
        message(
          "检测到未命中标签但尚未配置 AI，请先在「设置 → AI 标签翻译」中选择服务商并填写接口地址、密钥和模型。",
          true,
        );
        return;
      }
      const tip = st.latest_untranslated
        ? `将对最新未命中文件 ${st.latest_untranslated}（约 ${st.latest_untranslated_tags} 个标签）调用 AI 翻译，`
          + `重建对照表（当前 ${st.table_version}，${st.table_records} 条），并用新表重洗当前数据集。是否继续？`
        : "未发现未命中导出文件，将直接用当前对照表重洗当前数据集。是否继续？";
      if (!confirm(tip)) return;
      const task = await api.aiTranslate(current);
      message(`AI 翻译任务：${task.task_id}`);
      await onTask(task);
    }),
  );

  bind("formulaApply", () =>
    action($("formulaApply"), async () => {
      if (!current) return;
      if (currentStatus !== "cleaned")
        throw new Error("仅已清洗的数据集可以追加公式。");
      let formulas = [];
      try {
        formulas = readFormulas();
      } catch (error) {
        message(error.message, true);
        return;
      }
      if (!formulas.length) throw new Error("请先填写列名和表达式。");
      try {
        await api.applyFormulas(current, formulas);
      } catch (error) {
        message(`公式应用失败：${error.message}`, true);
        return;
      }
      message(`已对 ${current.slice(-8)} 应用 1 条公式`);
      $("formulaInfo").textContent = "已应用 1 条公式，重新打开作品详情查看结果。";
      await loadColumns(current);
      await artworks.refresh();
    }),
  );

  renderFormulaInput();
  renderDerivedColumns();

  return { refresh };
}
return { "mountDatasets": mountDatasets };
});

__def("components/dom.js", function (require) {
const $ = (id) => document.getElementById(id);
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function message(text, error = false) {
  $("toast").textContent = text;
  $("toast").classList.toggle("error", error);
}
async function action(button, operation) {
  // 重复点击拦截：上一次操作尚未结束时忽略新的点击。
  if (button.disabled) return;
  button.disabled = true;
  button.classList.add("is-busy");
  try {
    await operation();
  } catch (error) {
    message(error.message, true);
  } finally {
    button.classList.remove("is-busy");
    button.disabled = false;
  }
}
const terminal = (status) =>
  ["succeeded", "partial_success", "failed", "canceled"].includes(status);
const statuses = {
  queued: "排队中",
  running: "执行中",
  succeeded: "成功",
  partial_success: "部分成功",
  failed: "失败",
  canceled: "已取消",
  cancel_requested: "正在取消",
};
const stages = {
  queued: "排队",
  starting: "准备",
  waiting_login: '等待扫码登录',
  waiting_verification: '等待平台验证',
  downloading_media: '下载媒体',
  exporting: '导出',
  collecting: "采集",
  searching: '搜索笔记',
  fetching_detail: '获取笔记详情',
  saving_data: '保存任务数据',
  retrying: "重试",
  downloading_images: "下载图片",
  merging: "合并",
  cleaning: "清洗",
  translating: "AI 翻译",
  importing: "入库",
  recovering: "恢复",
  canceling: "取消中",
  finished: "结束",
};

return { "action": action, "node": node, "message": message, "$": $, "terminal": terminal, "statuses": statuses, "stages": stages };
});

__def("components/image-tools.js", function (require) {
var __dep68 = require("components/dom.js"); var $ = __dep68["$"]; var node = __dep68["node"]; var action = __dep68["action"];

function mountImageTools(current) {
  const choice = node('dialog', undefined, 'image-dialog');
  choice.setAttribute('aria-label', '选择图片下载范围');
  choice.append(node('h3', '下载作品图片'), node('p', '请选择下载当前图片，或逐张下载当前作品的全部已下载图片。'));
  const single = node('button', '当前图片'), all = node('button', '当前作品全部图片'), cancel = node('button', '取消', 'ghost');
  const options = node('div', undefined, 'image-tools'); options.append(single, all, cancel); choice.append(options);
  document.body.append(choice);
  let selection;
  async function save(url, filename) {
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || '图片下载失败，请确认服务已重启、图片仍存在。');
    }
    const blob = await response.blob(), link = node('a'), objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  async function download(value, batch) {
    const images = batch ? [...value.row.images] : [value.row.images[value.index]];
    const failures = [];
    for (const url of images) {
      const filename = decodeURIComponent(url.split('/').pop());
      try { await save(url, filename); }
      catch (error) { failures.push(`${filename}：${error.message}`); }
    }
    if (failures.length) throw new Error(`以下图片下载失败：${failures.join('；')}`);
  }
  $('downloadImage').onclick = () => {
    selection = current();
    if (!selection.row?.images?.length) return;
    if (selection.row.images.length > 1) choice.showModal();
    else action($('downloadImage'), () => download(selection, false));
  };
  single.onclick = () => { choice.close(); action($('downloadImage'), () => download(selection, false)); };
  all.onclick = () => { choice.close(); action($('downloadImage'), () => download(selection, true)); };
  cancel.onclick = () => choice.close();

  // 预览层：透明背景、无边框、无工具栏；单击图片放大，再次单击画面或按 Esc 关闭。
  const viewer = node('dialog', undefined, 'image-viewer'); viewer.setAttribute('aria-label', '图片细节预览');
  const stage = node('div', undefined, 'image-stage'), image = node('img'); image.alt = '当前作品图片预览'; image.draggable = false;
  stage.append(image); viewer.append(stage); document.body.append(viewer);
  let scale = 1, x = 0, y = 0, drag = null, moved = false;
  const render = () => { image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; };
  const fit = () => { scale = 1; x = y = 0; render(); };
  const zoom = (factor, px = 0, py = 0) => {
    const next = Math.max(.25, Math.min(12, scale * factor)), ratio = next / scale;
    x = px - (px - x) * ratio; y = py - (py - y) * ratio; scale = next; render();
  };
  $('preview').title = '单击放大预览';
  $('preview').onclick = () => { if (!$('preview').getAttribute('src')) return; image.src = $('preview').src; viewer.showModal(); fit(); };
  stage.onwheel = event => {
    event.preventDefault(); const rect = stage.getBoundingClientRect();
    zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2);
  };
  stage.onpointerdown = event => { if (event.button !== 0) return; drag = {id:event.pointerId, x:event.clientX, y:event.clientY}; moved = false; stage.setPointerCapture(event.pointerId); };
  stage.onpointermove = event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    x += dx; y += dy; drag.x = event.clientX; drag.y = event.clientY; render();
  };
  // 单击（未拖动）关闭预览；发生过拖动则忽略该次点击，避免拖动结束时误关。
  stage.onpointerup = stage.onpointercancel = stage.onlostpointercapture = () => { drag = null; };
  stage.onclick = () => {
    if (moved) { moved = false; return; }
    viewer.close();
  };
  viewer.onclose = () => { drag = null; moved = false; image.removeAttribute('src'); };
  viewer.onkeydown = event => { if (event.key === '+') zoom(1.25); if (event.key === '-') zoom(.8); if (event.key === '0') fit(); };
}

return { "mountImageTools": mountImageTools };
});

__def("components/live-progress.js", function (require) {
var __dep69 = require("components/dom.js"); var node = __dep69["node"];

// 动画仅在两次真实统计之间过渡，不模拟新增作品。
const values = new Map();
function progressNumber(taskId, field, value) {
  const element = node("span", value ?? "—", "live-number");
  if (value == null || !Number.isFinite(Number(value))) return element;
  const key = `${taskId}:${field}`;
  const previous = values.get(key) ?? Number(value);
  const target = Number(value);
  values.set(key, target);
  if (values.size > 300) values.delete(values.keys().next().value);
  if (
    previous === target ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return element;
  const started = performance.now();
  function frame(now) {
    if (!element.isConnected) return;
    const portion = Math.min(1, (now - started) / 600);
    element.textContent = Math.round(
      previous + (target - previous) * (1 - (1 - portion) ** 3),
    );
    if (portion < 1) requestAnimationFrame(frame);
  }
  element.textContent = previous;
  requestAnimationFrame(frame);
  return element;
}

return { "progressNumber": progressNumber };
});

__def("components/request-id.js", function (require) {
// HTTP 部署也能生成幂等键；randomUUID 仅在安全上下文中可用。
function createRequestId(crypto = globalThis.crypto) {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

return { "createRequestId": createRequestId };
});

__def("components/settings.js", function (require) {
// 设置弹窗：读取并保存根目录 config.json 配置。
var __dep70 = require("components/dom.js"); var $ = __dep70["$"]; var message = __dep70["message"];
var __dep71 = require("api.js"); var api = __dep71["api"];
var __dep72 = require("components/theme.js"); var applyBackground = __dep72["applyBackground"]; var applyBackgroundConfig = __dep72["applyBackgroundConfig"]; var applyModuleOpacity = __dep72["applyModuleOpacity"];

// 分组展示顺序与元信息：collapsible 为真时可折叠、open 为默认展开态。
// 高频必填组始终展开；服务参数与高级项属低频配置，默认收起以降低视觉负担。
const GROUP_META = {
  postgres: { collapsible: false, open: true },
  pixiv: { collapsible: false, open: true },
  ai: { collapsible: false, open: true },
  appearance: { collapsible: false, open: true },
  api: { collapsible: true, open: false },
  advanced: { collapsible: true, open: false },
};
const GROUP_ORDER = Object.keys(GROUP_META);

// 长文本字段占满整行（窄屏下自动降为单列）。
const WIDE_KEYS = new Set([
  "AI_BASE_URL", "AI_API_KEY", "AI_MODEL",
  "API_DATABASE_URL", "API_DATA_DIR", "API_CORS_ORIGINS", "PIXIV_PHPSESSID",
  "UI_BACKGROUND_IMAGE",
]);

function mountSettings() {
  const dialog = $("settingsDialog");
  const form = $("settingsForm");
  const groupsEl = $("settingsGroups");
  const saveBtn = $("settingsSave");
  const errEl = $("settingsError");
  // 已保存的外观值：拖动滑块只做即时预览，取消/关闭时回滚到这里
  let savedImage = "";
  let savedOpacity = "0.92";
  function showError(text) {
    errEl.hidden = !text;
    errEl.textContent = text || "";
  }

  async function load() {
    showError("");
    const data = await api.settings();
    $("settingsPath").textContent = "配置文件：" + data.path;
    renderGroups(data.fields);
    const values = Object.fromEntries((data.fields || []).map((field) => [field.key, field.value]));
    savedImage = values.UI_BACKGROUND_IMAGE ?? "";
    savedOpacity = values.UI_MODULE_OPACITY ?? "0.92";
  }

  function renderGroups(fields) {
    groupsEl.textContent = "";
    const byGroup = new Map();
    for (const field of fields) {
      if (!byGroup.has(field.group)) byGroup.set(field.group, []);
      byGroup.get(field.group).push(field);
    }
    for (const group of GROUP_ORDER) {
      const list = byGroup.get(group);
      if (list) groupsEl.appendChild(groupSection(group, list));
    }
  }

  function groupSection(group, list) {
    const meta = GROUP_META[group] || { collapsible: false, open: true };
    const section = document.createElement("section");
    section.className = "settings-group" + (meta.collapsible ? " is-collapsible" : "");

    const body = document.createElement("div");
    body.className = "settings-group-body";
    body.id = "settingsGroupBody-" + group;
    for (const field of list) body.appendChild(fieldElement(field));

    let head;
    if (meta.collapsible) {
      head = document.createElement("button");
      head.type = "button";
      head.className = "settings-group-head";
      head.setAttribute("aria-controls", body.id);
      const expanded = meta.open !== false;
      head.setAttribute("aria-expanded", String(expanded));
      body.hidden = !expanded;
      head.addEventListener("click", () => toggleGroup(head, body));
    } else {
      head = document.createElement("div");
      head.className = "settings-group-head";
    }

    const title = document.createElement("span");
    title.className = "settings-group-title";
    title.textContent = list[0].groupLabel;
    head.appendChild(title);

    const count = document.createElement("span");
    count.className = "settings-group-count";
    count.textContent = list.length + " 项";
    head.appendChild(count);

    section.appendChild(head);
    section.appendChild(body);
    return section;
  }

  function toggleGroup(head, body) {
    const expanded = head.getAttribute("aria-expanded") !== "true";
    head.setAttribute("aria-expanded", String(expanded));
    body.hidden = !expanded;
  }

  function fieldElement(field) {
    const wrap = document.createElement("div");
    wrap.className = "settings-field" + (WIDE_KEYS.has(field.key) ? " is-wide" : "");

    const label = document.createElement("label");
    label.textContent = field.label + (field.required ? " *" : "");
    label.htmlFor = "setting-" + field.key;
    wrap.appendChild(label);

    const row = document.createElement("div");
    row.className = "field-row";
    let control;
    if (field.type === "select") {
      control = document.createElement("select");
      for (const opt of field.options || []) {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        control.appendChild(option);
      }
      control.value = field.value;
    } else if (field.type === "range") {
      // 横向拖拽条：拖动时即时预览功能模块背景透明度，保存后长期生效
      control = document.createElement("input");
      control.type = "range";
      control.min = String(field.min ?? 0);
      control.max = String(field.max ?? 1);
      control.step = String(field.step ?? 0.01);
      control.value = field.value;
      const output = document.createElement("output");
      output.className = "range-value";
      output.textContent = Number(control.value || 0).toFixed(2);
      control.oninput = () => {
        output.textContent = Number(control.value).toFixed(2);
        applyModuleOpacity(control.value);
      };
      row.appendChild(output);
    } else {
      control = document.createElement("input");
      control.type =
        field.type === "password"
          ? "password"
          : field.type === "number"
            ? "number"
            : "text";
      control.value = field.value;
      if (field.type === "number") {
        control.min = String(field.min ?? 1);
        if (field.max !== undefined && field.max !== null) control.max = String(field.max);
        control.step = String(field.step ?? 1);
      }
      control.autocomplete = "off";
    }
    control.id = "setting-" + field.key;
    control.dataset.key = field.key;
    if (field.required) {
      // 用 aria-required 替代原生 required：折叠分组内的必填项不应被浏览器静默拦截提交，
      // 统一交由 validate() 校验，并自动展开所在分组后聚焦提示。
      control.setAttribute("aria-required", "true");
      control.dataset.required = "1";
    }
    row.appendChild(control);

    // 全局背景图片：选项来自 backdrop 目录；切换时即时预览
    if (field.key === "UI_BACKGROUND_IMAGE") {
      const known = Array.from(control.options || []).some((opt) => opt.value === field.value);
      if (field.value && !known) {
        const legacy = document.createElement("option");
        legacy.value = field.value;
        legacy.textContent = field.value + "（旧配置，请重新选择）";
        control.appendChild(legacy);
        control.value = field.value;
      }
      control.onchange = () => {
        applyBackground(control.value);
      };
    }

    // AI 模型：按当前接口地址 + 密钥拉取服务商模型列表，填入下拉候选（仍可手输）
    if (field.key === "AI_MODEL") {
      const fetchBtn = document.createElement("button");
      fetchBtn.type = "button";
      fetchBtn.className = "ghost toggle";
      fetchBtn.textContent = "获取模型";
      fetchBtn.title = "按当前填写的接口地址与密钥拉取模型列表";
      fetchBtn.onclick = async () => {
        const baseInput = form.querySelector('[data-key="AI_BASE_URL"]');
        const keyInput = form.querySelector('[data-key="AI_API_KEY"]');
        if (!baseInput || !baseInput.value.trim()) {
          showError("请先填写 AI 接口地址。");
          return;
        }
        if (!keyInput || !keyInput.value.trim()) {
          showError("请先填写 AI 密钥。");
          return;
        }
        fetchBtn.disabled = true;
        fetchBtn.textContent = "获取中…";
        try {
          const data = await api.aiModels({
            base_url: baseInput.value.trim(),
            api_key: keyInput.value.trim(),
          });
          const models = data.models || [];
          if (!models.length) throw new Error("接口未返回模型列表。");
          let list = document.getElementById("aiModelOptions");
          if (!list) {
            list = document.createElement("datalist");
            list.id = "aiModelOptions";
            row.appendChild(list);
          }
          list.textContent = "";
          for (const name of models) {
            const option = document.createElement("option");
            option.value = name;
            list.appendChild(option);
          }
          control.setAttribute("list", "aiModelOptions");
          if (!control.value.trim()) control.value = models[0];
          showError("");
          message("已获取 " + models.length + " 个模型，可从输入框下拉选择。");
        } catch (error) {
          showError(error.message);
        } finally {
          fetchBtn.disabled = false;
          fetchBtn.textContent = "获取模型";
        }
      };
      row.appendChild(fetchBtn);
    }

    // 密钥字段「显示/隐藏」：显示 = 经 /settings/reveal 显式揭示已保存的旧密钥明文；
    // 隐藏 = 未改动时还原掩码。GET /settings 永远只回掩码，明文仅在按键时单键下发。
    // 提交语义不变：掩码/空值 = 保持原值，输入新值 = 覆盖。
    if (field.secret) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "ghost toggle";
      toggle.textContent = "显示";
      toggle.setAttribute("aria-label", field.label + " 显示或隐藏");
      let revealed = ""; // 已揭示的旧值（空串=未揭示）
      let revealedLoaded = false;
      toggle.onclick = async () => {
        const show = control.type === "password";
        if (!show) {
          // 隐藏：值仍等于旧值（未改动）→ 还原掩码；已改动 → 保留新值仅切换圆点
          control.type = "password";
          toggle.textContent = "显示";
          if (revealedLoaded && control.value === revealed) {
            control.value = revealed ? "********" : "";
          }
          return;
        }
        control.type = "text";
        toggle.textContent = "隐藏";
        if (control.value === "********") {
          // 首次从掩码态显示：拉取旧密钥明文
          toggle.disabled = true;
          try {
            const result = await api.revealSetting(field.key);
            revealed = result.value || "";
            revealedLoaded = true;
            control.value = revealed;
            control.placeholder = revealed ? "" : "未配置——输入新值后保存";
          } catch (error) {
            control.placeholder = "读取失败——可输入新值覆盖";
          } finally {
            toggle.disabled = false;
            control.focus();
          }
        }
      };
      control.dataset.secretField = "1";
      row.appendChild(toggle);
    }

    wrap.appendChild(row);

    if (field.desc) {
      const desc = document.createElement("div");
      desc.className = "field-desc";
      desc.textContent = field.desc;
      wrap.appendChild(desc);
    }
    return wrap;
  }

  function expandAncestor(control) {
    const body = control.closest(".settings-group-body");
    if (!body || !body.hidden) return;
    const head = body.parentElement.querySelector(".settings-group-head");
    if (head && head.getAttribute("aria-expanded") === "false") toggleGroup(head, body);
  }

  // 必填校验：为空则展开所在分组、聚焦并提示，避免折叠分组静默拦截提交。
  function validate() {
    for (const control of form.querySelectorAll("[data-required]")) {
      if (control.value.trim() !== "") continue;
      expandAncestor(control);
      control.focus();
      control.scrollIntoView({ block: "center" });
      const label = control.closest(".settings-field").querySelector("label");
      showError("「" + label.textContent.replace(/\s*\*$/, "") + "」不能为空。");
      return false;
    }
    return true;
  }

  form.onsubmit = async (event) => {
    event.preventDefault();
    showError("");
    if (!validate()) return;
    const fields = {};
    // 用 [data-key] 取全部控件：原生 input 与下拉 select 一并收集（旧实现只收集 input，会漏掉 AI 服务商）。
    for (const control of form.querySelectorAll("[data-key]")) {
      let value = control.value;
      // 密钥字段留空 = 保持原值（掩码语义），绝不把空值提交成“清空密钥”。
      if (control.dataset.secretField === "1" && value.trim() === "") {
        value = "********";
      }
      fields[control.dataset.key] = value;
    }
    saveBtn.disabled = true;
    saveBtn.classList.add("is-busy");
    saveBtn.setAttribute("aria-busy", "true");
    try {
      await api.saveSettings(fields);
      // 界面外观（主背景图片 / 模块不透明度）保存后即时生效，无需重启服务。
      applyBackgroundConfig(fields.UI_BACKGROUND_IMAGE, fields.UI_MODULE_OPACITY);
      savedImage = fields.UI_BACKGROUND_IMAGE ?? "";
      savedOpacity = fields.UI_MODULE_OPACITY ?? "0.92";
      message("配置已保存，重启服务后生效。");
      dialog.close();
    } catch (error) {
      showError(error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.classList.remove("is-busy");
      saveBtn.removeAttribute("aria-busy");
    }
  };

  $("settingsBtn").onclick = () => {
    load().then(() => dialog.showModal()).catch((error) => {
      message("读取配置失败：" + error.message, true);
    });
  };
  $("settingsClose").onclick = () => {
    applyBackground(savedImage);         // 放弃主背景预览
    applyModuleOpacity(savedOpacity);    // 放弃滑块预览
    dialog.close();
  };
  $("settingsCancel").onclick = () => {
    applyBackground(savedImage);
    applyModuleOpacity(savedOpacity);
    dialog.close();
  };
  // 仅允许通过「关闭 / 取消 / 保存」退出：屏蔽点击弹窗外区域与 Esc 的隐式关闭，
  // 避免误触丢失已填写的配置。
  dialog.addEventListener("cancel", (event) => event.preventDefault());
}

return { "mountSettings": mountSettings };
});

__def("components/tasks.js", function (require) {
var __dep73 = require("api.js"); var api = __dep73["api"]; var platform = __dep73["platform"];
var __dep74 = require("components/dom.js"); var $ = __dep74["$"]; var node = __dep74["node"]; var action = __dep74["action"]; var terminal = __dep74["terminal"]; var statuses = __dep74["statuses"]; var stages = __dep74["stages"]; var message = __dep74["message"];
var __dep75 = require("components/live-progress.js"); var progressNumber = __dep75["progressNumber"];
var __dep76 = require("components/artwork-details.js"); var formatDate = __dep76["formatDate"];

const TYPE_LABELS = { collection: "采集", cleaning: "清洗", ai_translation: "AI 翻译" };

// 当前任务面板的进度比例：采集按目标数，AI 翻译按标签进度；无法计算时返回 null。
function liveRatio(task) {
  const progress = task.progress || {};
  if (task.task_type === "ai_translation") {
    const total = Number(progress.ai_total);
    return total > 0 ? Math.min(1, Number(progress.ai_done || 0) / total) : null;
  }
  const target = Number(task.parameters?.target_count);
  const done = platform === "xhs" ? progress.saved_note_count : progress.collected_count;
  if (!(target > 0) || done == null) return null;
  return Math.min(1, Number(done) / target);
}

// 当前任务面板的计数摘要（比表格行更紧凑，便于在翻页时继续观察）。
function liveCounters(task) {
  const progress = task.progress || {};
  const items = [];
  if (task.task_type === "ai_translation") {
    if (progress.ai_total != null) items.push(`AI 翻译 ${progress.ai_done ?? 0} / ${progress.ai_total}`);
    if (progress.written_count != null) items.push(`重洗写入 ${progress.written_count}`);
  } else {
    const collected = platform === "xhs" ? progress.saved_note_count : progress.collected_count;
    const images = platform === "xhs" ? progress.image_downloaded_count : progress.image_file_count;
    items.push(
      `${platform === "xhs" ? "已保存笔记" : "采集"} ${collected ?? 0}`,
      `写入 ${progress.written_count ?? 0}`,
      `图片 ${images ?? 0} 张`,
    );
  }
  if (platform === "xhs") {
    items.push(`视频 ${progress.video_downloaded_count ?? 0} 个`, `目标 ${task.parameters?.target_count ?? 0}`);
    if (progress.detail_failed_count) items.push(`详情失败 ${progress.detail_failed_count}`);
    if (progress.media_failed_count) items.push(`媒体失败 ${progress.media_failed_count}`);
  }
  return items.join(" · ");
}

// 当前任务面板的补充说明：阶段提示、失败信息与下一步动作。
function liveNotes(task) {
  const progress = task.progress || {};
  const notes = [];
  if (task.task_type === "ai_translation") {
    if (progress.message) notes.push([progress.message, "muted"]);
    if (task.result?.message) notes.push([task.result.message, "muted"]);
  }
  if (platform === "xhs") {
    if (progress.action_message) notes.push([progress.action_message, "muted"]);
    if (task.parameters?.operation === "retry_media") notes.push(["失败媒体补下载（不重新搜索）", "muted"]);
    if (task.result?.stop_message) notes.push([task.result.stop_message, "muted"]);
    if (task.parameters?.download_media === false) notes.push(["本次未请求下载媒体", "muted"]);
    if (progress.failure_stage) {
      notes.push([`失败阶段：${stages[progress.failure_stage] || progress.failure_stage}`, "error"]);
    }
    if (progress.failure_message) notes.push([progress.failure_message, "error"]);
    const next = progress.next_action || task.result?.next_action;
    if (next) notes.push([`下一步：${next}`, "muted"]);
  }
  return notes;
}

function mountTasks(onFinished, onProgress = async () => {}) {
  let page = 1,
    timer,
    disposed = false,
    loading = false;
  const tracked = new Map();
  const operations = new Map();
  let currentItems = [];

  // 任务记录下方的小面板（#liveTask）：无论当前翻到第几页，
  // 都显示正在进行中的任务，便于持续观察其阶段、进度与内容。
  function renderLiveTask(items) {
    const box = $("liveTask");
    const active = [...items, ...tracked.values()]
      .filter((task) => !terminal(task.status))
      .sort((a, b) =>
        String(b.started_at || b.created_at).localeCompare(String(a.started_at || a.created_at)),
      )[0];
    if (!active) {
      box.classList.add("is-idle");
      box.replaceChildren(node("div", "当前没有进行中的任务。", "muted"));
      return;
    }
    box.classList.remove("is-idle");
    const ratio = liveRatio(active);
    const head = node("div", undefined, "live-task-head");
    head.append(
      node("strong", TYPE_LABELS[active.task_type] || "清洗"),
      node("span", (active.tags || active.parameters?.tags || []).join("、") || "暂无标签", "task-tags"),
      node("span", `${statuses[active.status] || active.status} · ${stages[active.stage] || active.stage}`, "muted"),
      node("span", active.task_id, "muted live-task-id"),
    );
    const parts = [head];
    if (ratio != null) {
      const percent = Math.round(ratio * 100);
      const bar = node("div", undefined, "live-task-bar");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-label", "任务进度");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
      bar.setAttribute("aria-valuenow", String(percent));
      const fill = node("span");
      fill.style.width = `${Math.max(2, percent)}%`;
      bar.append(fill);
      parts.push(bar);
    }
    const counters = node("div", undefined, "live-task-counters");
    if (ratio != null) {
      counters.append(node("strong", `${Math.round(ratio * 100)}%`, "live-task-percent"));
    }
    counters.append(node("span", liveCounters(active), "muted"));
    parts.push(counters);
    const note = node("div", undefined, "live-task-note");
    for (const [text, className] of liveNotes(active)) note.append(node("div", text, className));
    if (active.error) note.append(node("div", `${active.error.code}：${active.error.message}`, "error"));
    if (note.childNodes.length) parts.push(note);
    box.replaceChildren(...parts);
  }

  async function refresh() {
    if (loading || disposed) return;
    loading = true;
    clearTimeout(timer);
    try {
      let result = await api.tasks(page);
      const lastPage = Math.max(1, Math.ceil(result.total / 10));
      if (page > lastPage) {
        page = lastPage;
        result = await api.tasks(page);
      }
      const finished = [];
      $('latestTaskUpdate').textContent = `最近任务更新时间：${formatDate(result.latest_task_updated_at)}`;
      for (const task of result.items) {
        if (!terminal(task.status)) tracked.set(task.task_id, task);
      }
      // 跟踪的任务即使翻出当前页，也继续查询到终态。
      for (const [id] of tracked) {
        let task;
        try {
          task = result.items.find((t) => t.task_id === id) || (await api.task(id));
        } catch (error) {
          // 任务已被删除（软删后 404）：停止跟踪，否则每 3 秒必失败一次形成死循环。
          if (/任务不存在/.test(error.message)) {
            tracked.delete(id);
            continue;
          }
          throw error;
        }
        if (terminal(task.status)) {
          tracked.delete(id);
          finished.push(task);
        }
      }
      $("tasks").replaceChildren(
        ...result.items.map((task) => {
          const row = node("tr");
          const info = node("td");
          const typeLabel = TYPE_LABELS[task.task_type] || "清洗";
          info.append(
            node("strong", typeLabel),
            node('span', ` ${(task.tags || task.parameters?.tags || []).join('、') || '暂无标签'} `, 'task-tags'),
            node('time', formatDate(task.started_at || task.created_at), 'muted task-time'),
          );
          // 行内只保留「执行功能 / 标签 / 时间 / 数量 / 成功失败」；
          // 阶段与各类提示、错误改由下方 #liveTask 面板承载。
          const state = node("td", statuses[task.status] || task.status);
          const progress = task.progress || {};
          const counters = node("div", undefined, "muted");
          if (task.task_type === "ai_translation") {
            if (progress.ai_total != null) {
              counters.append(
                "AI 翻译 ",
                progressNumber(task.task_id, "ai_done", progress.ai_done),
                " / ",
                String(progress.ai_total),
              );
            }
            if (progress.written_count != null) {
              counters.append(" / 重洗写入 ", String(progress.written_count));
            }
          } else {
            counters.append(
              platform === 'xhs' ? '已保存笔记 ' : '采集 ',
              progressNumber(task.task_id, "collected", (platform === 'xhs' ? progress.saved_note_count : progress.collected_count)),
              " / 写入 ",
              progressNumber(task.task_id, "written", progress.written_count),
              " / 图片 ",
              progressNumber(task.task_id, "images", (platform === 'xhs' ? progress.image_downloaded_count : progress.image_file_count)),
              " 张",
            );
          }
          if (platform === 'xhs') {
            counters.append(' / 视频 ', progressNumber(task.task_id, 'videos', progress.video_downloaded_count),
              ' 个 / 详情失败 ', String(progress.detail_failed_count || 0), ' / 媒体失败 ', String(progress.media_failed_count || 0),
              ' / 目标 ', String(task.parameters?.target_count || 0));
          }
          state.append(counters);
          const controls = node("td");
          if (platform === 'xhs' && terminal(task.status) && progress.media_failed_count > 0) {
            const retry = node('button', '补下载失败媒体', 'ghost');
            retry.onclick = () => action(retry, async () => {
              const updated = await api.retryMedia(task.task_id); tracked.set(task.task_id, updated);
              await refresh();
            });
            controls.append(retry);
          }
          if (!terminal(task.status)) {
            const cancel = node(
              "button",
              task.status === "cancel_requested" ? "正在取消" : "取消",
              "ghost",
            );
            cancel.disabled = task.status === "cancel_requested";
            cancel.onclick = () =>
              action(cancel, async () => {
                await api.cancel(task.task_id);
                await refresh();
              });
            controls.append(cancel);
          } else {
            const group = node("div", undefined, "task-operation");
            const button = node("button", "下载");
            const menu = node("select");
            menu.setAttribute("aria-label", "切换任务操作");
            for (const [value, label] of [
              ["download", "下载 CSV"],
              ...(platform === 'xhs' ? [["images", "下载图片清单"]] : []),
              ["delete", "删除（保留数据）"],
            ]) {
              const option = node("option", label);
              option.value = value;
              menu.append(option);
            }
            menu.value = operations.get(task.task_id) || "download";
            const setLabel = () => {
              button.textContent = menu.value === "delete" ? "删除" : "下载";
              button.disabled =
                menu.value !== "delete" &&
                !(["succeeded", "partial_success"].includes(task.status) ||
                  (task.task_type === 'collection' && task.status === 'canceled' && progress.written_count > 0));
              operations.set(task.task_id, menu.value);
            };
            menu.onchange = () => {
              setLabel();
              if (platform === 'xhs' && menu.value !== 'delete' && !button.disabled) button.click();
            };
            setLabel();
            button.onclick = () =>
              action(button, async () => {
                if (menu.value === "delete") {
                  await api.removeTask(task.task_id);
                  operations.delete(task.task_id);
                  await onFinished([task]);
                  await refresh();
                } else {
                  const blob = await api.downloadCsv(task.task_id, platform === 'xhs' ? (menu.value === 'images' ? 'images' : 'notes') : undefined);
                  const url = URL.createObjectURL(blob);
                  const link = node("a");
                  link.href = url;
                  link.download = `${task.task_id}${menu.value === 'images' ? '_图片清单' : ''}.csv`;
                  document.body.append(link);
                  link.click();
                  link.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
              });
            group.append(button, menu);
            controls.append(group);
            if (task.task_type === 'collection' && task.status === 'canceled') {
              const resume = node('button', '继续采集', 'ghost');
              resume.onclick = () => action(resume, async () => {
                const resumed = await api.resume(task.task_id);
                tracked.set(task.task_id, resumed);
                await onFinished([resumed]);
                await refresh();
              });
              controls.append(resume);
            }
          }
          row.append(info, state, controls);
          return row;
        }),
      );
      if (!result.items.length)
        $("tasks").append(node("tr", "暂无任务，请先提交采集。"));
      currentItems = result.items;
      renderLiveTask(result.items);
      $("taskPage").textContent = `第 ${page} 页 · 共 ${result.total} 个任务`;
      $("taskPrev").disabled = page <= 1;
      $("taskNext").disabled = page * 10 >= result.total;
      $("taskError").textContent = "";
      if (finished.length) await onFinished(finished);
      else await onProgress(result.items);
    } catch (error) {
      $("taskError").textContent = error.message;
    } finally {
      loading = false;
      if (!disposed) timer = setTimeout(refresh, tracked.size ? 3000 : 15000);
    }
  }
  $("taskPrev").onclick = () => {
    if (loading) return;
    page--;
    refresh();
  };
  $("taskNext").onclick = () => {
    if (loading) return;
    page++;
    refresh();
  };
  $("taskRefresh").onclick = refresh;
  // 清理记录：清理当前页上已结束的记录（与行内「删除（保留数据）」同口径，磁盘 CSV 保留）。
  $("taskClean").onclick = () =>
    action($("taskClean"), async () => {
      const done = currentItems.filter((task) => terminal(task.status));
      if (!done.length) {
        message("当前页没有可清理的已结束记录。");
        return;
      }
      if (!confirm(`将清理当前页 ${done.length} 条已结束记录（进行中的任务不受影响，磁盘数据保留）。是否继续？`)) return;
      for (const task of done) {
        await api.removeTask(task.task_id);
        operations.delete(task.task_id);
        tracked.delete(task.task_id);
      }
      message(`已清理 ${done.length} 条记录。`);
      await onFinished(done);
      await refresh();
    });
  window.addEventListener("pagehide", () => {
    disposed = true;
    clearTimeout(timer);
  });
  return {
    refresh,
    track: async (task) => {
      tracked.set(task.task_id, task);
      page = 1;
      await refresh();
    },
  };
}

return { "mountTasks": mountTasks };
});

__def("components/theme.js", function (require) {
// 主题系统统一入口：深浅主题切换 + 主背景图片 + 功能模块背景透明度。
// - 主题（深色 / 浅色）属于浏览器本地偏好，存 localStorage；页面加载时由 <head> 内联脚本先行应用以避免闪烁。
// - 主背景图片固定以 0.2 不透明度作为底层；各功能模块（卡片）背景透明度可调。
// - 配置来自后端 config.json 的 ui 段，读取/保存后同步缓存到 localStorage，供下次加载即时生效。
var __dep77 = require("components/dom.js"); var $ = __dep77["$"];
var __dep78 = require("api.js"); var api = __dep78["api"];

const THEME_KEY = "theme";
const BG_IMAGE_KEY = "ui-background-image";
const CARD_OPACITY_KEY = "ui-card-opacity";
const THEMES = ["light", "dark"];
const DEFAULT_THEME = "light";
const MAIN_BG_OPACITY = 0.2;
const DEFAULT_MODULE_OPACITY = 0.92;
const MIN_OPACITY = 0.30;
const MAX_OPACITY = 1.00;

const LABELS = { light: "主题：浅色", dark: "主题：深色" };

// 非法值回退浅色：保证「现有界面」始终是默认主题。
function normalizeTheme(value) {
  return THEMES.includes(value) ? value : DEFAULT_THEME;
}

// 功能模块背景不透明度限制在 0.30~1.00，空值或非法值回退默认。
function normalizeModuleOpacity(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return DEFAULT_MODULE_OPACITY;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_MODULE_OPACITY;
  return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, num));
}

// 背景图地址：纯文件名视为 backdrop 目录中的图片，解析为 /backdrop/<文件名>；
// 带协议或已以 / 开头的地址按原样使用（兼容旧配置）。
function backgroundPath(image) {
  const text = String(image ?? "").trim();
  if (!text) return "";
  if (/^(https?:)?\/\//i.test(text) || text.startsWith("/")) return text;
  return "/backdrop/" + encodeURIComponent(text);
}

// 把配置里的图片转换为 CSS url()；留空表示不显示背景图片。
function backgroundUrl(image) {
  const path = backgroundPath(image);
  if (!path) return "none";
  return `url("${path.replace(/\\/g, "%5C").replace(/"/g, "%22")}")`;
}

function toggleTheme(current) {
  return normalizeTheme(current) === "dark" ? "light" : "dark";
}

// 切换根元素 data-theme，:root / [data-theme="dark"] 变量随之整体生效。
function applyTheme(theme) {
  const next = normalizeTheme(theme);
  document.documentElement.dataset.theme = next;
  return next;
}

// 应用主背景图片（遮罩固定 0.2，不随设置变化）。
function applyBackground(image) {
  const root = document.documentElement;
  root.style.setProperty("--bg-image", backgroundUrl(image));
  root.style.setProperty("--bg-opacity", String(MAIN_BG_OPACITY));
}

// 应用功能模块（卡片）背景不透明度。
function applyModuleOpacity(value) {
  document.documentElement.style.setProperty("--card-opacity", String(normalizeModuleOpacity(value)));
}

// 应用并缓存，供下次加载由内联脚本即时还原（缓存解析后的 URL，内联脚本可直接使用）。
function applyBackgroundConfig(image, moduleOpacity) {
  applyBackground(image);
  applyModuleOpacity(moduleOpacity);
  writeStore(BG_IMAGE_KEY, backgroundPath(image));
  writeStore(CARD_OPACITY_KEY, String(normalizeModuleOpacity(moduleOpacity)));
  // 旧版本缓存的主背景透明度已废弃，避免残留值影响内联脚本。
  try {
    window.localStorage.removeItem("ui-background-opacity");
  } catch {}
}

function readStore(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 浏览器禁用本地存储时忽略，仅影响下次加载的即时还原。 */
  }
}

function syncButton(theme) {
  const button = $("themeBtn");
  if (!button) return;
  button.textContent = LABELS[theme];
  button.setAttribute("aria-pressed", String(theme === "dark"));
}

async function loadBackground() {
  let data;
  try {
    data = await api.settings();
  } catch {
    return; // 服务未就绪时保留内联脚本还原的缓存值。
  }
  const fields = Object.fromEntries(
    (data.fields || []).map((field) => [field.key, field.value]),
  );
  applyBackgroundConfig(fields.UI_BACKGROUND_IMAGE ?? "", fields.UI_MODULE_OPACITY);
}

function mountTheme() {
  // 主题已由内联脚本应用，这里只同步按钮文案与无障碍状态。
  syncButton(normalizeTheme(document.documentElement.dataset.theme));

  const button = $("themeBtn");
  if (button) {
    button.addEventListener("click", () => {
      const next = toggleTheme(document.documentElement.dataset.theme);
      applyTheme(next);
      writeStore(THEME_KEY, next);
      syncButton(next);
    });
  }

  loadBackground();
}

return { "normalizeTheme": normalizeTheme, "normalizeModuleOpacity": normalizeModuleOpacity, "backgroundPath": backgroundPath, "backgroundUrl": backgroundUrl, "toggleTheme": toggleTheme, "applyTheme": applyTheme, "applyBackground": applyBackground, "applyModuleOpacity": applyModuleOpacity, "applyBackgroundConfig": applyBackgroundConfig, "mountTheme": mountTheme, "THEME_KEY": THEME_KEY, "BG_IMAGE_KEY": BG_IMAGE_KEY, "CARD_OPACITY_KEY": CARD_OPACITY_KEY, "THEMES": THEMES, "DEFAULT_THEME": DEFAULT_THEME, "MAIN_BG_OPACITY": MAIN_BG_OPACITY, "DEFAULT_MODULE_OPACITY": DEFAULT_MODULE_OPACITY, "MIN_OPACITY": MIN_OPACITY, "MAX_OPACITY": MAX_OPACITY };
});

__def("components/xhs-auth.js", function (require) {
var __dep79 = require("api.js"); var api = __dep79["api"];
var __dep80 = require("components/dom.js"); var $ = __dep80["$"]; var node = __dep80["node"];

function mountXhsAuth() {
  const menu = $('serviceMenu'), menuButton = $('serviceMenuBtn');
  function closeMenu() { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); }
  menuButton.onclick = () => {
    menu.hidden = !menu.hidden;
    menuButton.setAttribute('aria-expanded', String(!menu.hidden));
  };
  menu.addEventListener('click', event => { if (event.target.closest('button')) closeMenu(); });
  const onDocumentClick = event => { if (!event.target.closest('.service-menu')) closeMenu(); };
  const onDocumentKeydown = event => { if (event.key === 'Escape') closeMenu(); };
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);
  const dialog = node('dialog', undefined, 'xhs-login-dialog');
  const title = node('h2', '小红书登录');
  const info = node('p', '正在检查登录状态…');
  info.setAttribute('role', 'status');
  const image = node('img'); image.alt = '小红书登录二维码'; image.hidden = true;
  const retry = node('button', '重新登录', 'ghost'); retry.hidden = true;
  const close = node('button', '关闭', 'ghost');
  const cancel = node('button', '取消登录', 'ghost'); cancel.hidden = true;
  const countdown = node('p', undefined, 'muted');
  const closingHint = node('p', '关闭弹窗后仍会继续等待扫码；结束本次等待请点击“取消登录”。', 'muted');
  const actions = node('div', undefined, 'service-actions'); actions.append(retry, cancel, close);
  dialog.append(title, info, image, countdown, closingHint, actions); document.body.append(dialog);
  close.onclick = () => dialog.close();
  let pending = false;
  let version = 0;
  let lastState = null;
  function updateCountdown() {
    const remaining = lastState?.wait_deadline ? Math.max(0, Math.ceil((Date.parse(lastState.wait_deadline) - Date.now()) / 1000)) : null;
    countdown.textContent = remaining === null || ['idle', 'error', 'collecting'].includes(lastState?.phase)
      ? '' : remaining ? `本次登录等待剩余 ${remaining} 秒（二维码有效期以平台为准）` : '本次等待已到期，请刷新二维码。';
  }
  function render(state) {
    lastState = state; updateCountdown();
    const labels = { logged_in: '已登录', not_logged_in: '未登录', expired: '已失效' };
    $('xhsLoginStatus').textContent = `小红书：${labels[state.status] || '检查中…'}${state.phase === 'error' ? '（检查异常）' : ''}`;
    $('xhsLoginStatus').dataset.state = state.phase === 'error' ? 'error' : (state.status || '');
    $('xhsLoginStatus').title = state.message || (state.checked_at ? `最近检查：${new Date(state.checked_at).toLocaleString()}` : '正在验证登录状态');
    if (!dialog.open) return;
    const waiting = ['starting', 'checking'].includes(state.phase);
    info.textContent = waiting ? '正在检查登录状态，请稍候…' : state.phase === 'waiting_scan'
      ? '请用小红书扫描二维码，并在手机上确认登录。' : state.phase === 'waiting_verification'
      ? state.message : state.phase === 'waiting_confirmation' ? '已扫码，请在手机上确认登录。'
      : state.phase === 'confirming' ? '正在确认登录，请稍候…' : state.phase === 'collecting'
      ? '采集正在使用登录会话，请先停止采集再登录或换账号。' : state.phase === 'error'
      ? state.message || '登录检查失败，请重试。' : state.status === 'logged_in' ? '小红书已登录，可以开始采集。' : '小红书尚未登录，请点击重新登录。';
    image.hidden = !state.qr_url;
    if (state.qr_url) image.src = `${state.qr_url}?t=${Date.now()}`;
    else image.removeAttribute('src');
    retry.textContent = state.phase === 'waiting_scan' ? '刷新二维码' : '重新登录';
    retry.hidden = waiting || ['collecting', 'confirming', 'waiting_confirmation', 'waiting_verification'].includes(state.phase) || state.status === 'logged_in';
    cancel.hidden = !['starting', 'waiting_scan', 'waiting_confirmation', 'waiting_verification', 'confirming'].includes(state.phase);
    closingHint.hidden = cancel.hidden;
  }
  async function refresh() {
    if (pending) return;
    pending = true;
    const requestVersion = version;
    try { const state = await api.xhsAuthStatus(); if (requestVersion === version) render(state); }
    catch (error) {
      if (requestVersion !== version) return;
      $('xhsLoginStatus').title = error.message;
      $('xhsLoginStatus').dataset.state = 'error';
      if (dialog.open) { info.textContent = error.message; image.hidden = true; retry.hidden = false; }
    } finally { pending = false; }
  }
  async function login() {
    const requestVersion = ++version;
    if (!dialog.open) dialog.showModal();
    info.textContent = '正在检查登录状态，请稍候…'; image.hidden = true; retry.hidden = true;
    $('xhsLoginBtn').disabled = true; retry.disabled = true;
    try {
      const state = await (lastState?.phase === 'waiting_scan' ? api.xhsRefreshQr() : api.xhsLogin());
      if (requestVersion === version) render(state);
    }
    catch (error) { if (requestVersion === version) { info.textContent = error.message; retry.hidden = false; } }
    finally { $('xhsLoginBtn').disabled = false; retry.disabled = false; }
  }
  $('xhsLoginBtn').onclick = retry.onclick = login;
  cancel.onclick = async () => {
    const requestVersion = ++version; cancel.disabled = true;
    try {
      const state = await api.xhsCancelLogin();
      if (requestVersion !== version) return;
      render(state); info.textContent = '本次登录等待已取消。';
    }
    catch (error) { if (requestVersion === version) info.textContent = error.message; }
    finally { cancel.disabled = false; }
  };
  $('xhsLogoutBtn').onclick = async () => {
    const requestVersion = ++version;
    $('xhsLogoutBtn').disabled = true;
    try {
      const state = await api.xhsLogout();
      if (requestVersion !== version) return;
      if (!dialog.open) dialog.showModal();
      render(state);
      info.textContent = '已退出当前小红书账户，点击重新登录可扫码登录其他账户。';
    } catch (error) {
      if (requestVersion !== version) return;
      if (!dialog.open) dialog.showModal();
      info.textContent = error.message; image.hidden = true;
    } finally { $('xhsLogoutBtn').disabled = false; }
  };
  refresh();
  const timer = setInterval(refresh, 5000);
  const clock = setInterval(updateCountdown, 1000);
  window.addEventListener('pagehide', () => {
    clearInterval(timer);
    clearInterval(clock);
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onDocumentKeydown);
  }, { once: true });
  return { refresh };
}

return { "mountXhsAuth": mountXhsAuth };
});

__def("components/xhs-page.js", function (require) {
var __dep81 = require("api.js"); var api = __dep81["api"];
var __dep82 = require("components/dom.js"); var $ = __dep82["$"]; var node = __dep82["node"]; var action = __dep82["action"]; var message = __dep82["message"];
var __dep83 = require("components/artwork-details.js"); var formatDate = __dep83["formatDate"];
var __dep84 = require("components/dataset-carousel.js"); var mountDatasetCarousel = __dep84["mountDatasetCarousel"];

const metrics = {
  liked_count: '点赞数', collected_count: '收藏数', comment_count: '评论数',
  share_count: '分享数', published_at: '发布时间', collected_at: '采集时间',
};
const isDate = (key) => ['published_at', 'collected_at'].includes(key);
const valueText = (value) => value == null || value === '' ? '—' : String(value);
function viewState() {
  try { const state = JSON.parse(localStorage.getItem('xhs-dashboard-view') || '{}');
    return state && typeof state === 'object' && !Array.isArray(state) ? state : {}; }
  catch { return {}; }
}
function saveView(values) {
  try { localStorage.setItem('xhs-dashboard-view', JSON.stringify({ ...viewState(), ...values })); }
  catch { /* 存储不可用时仍可浏览。 */ }
}
function options(select, items) {
  select.replaceChildren(...items.map(([value, label]) => {
    const option = node('option', label); option.value = value; return option;
  }));
}

function configureXhsPage() {
  document.title = '数据综合分析评估平台';
  document.querySelector('.side h2').textContent = '笔记排行';
  $('filters').closest('table').querySelector('thead th').textContent = '笔记标题';
  document.querySelector('.tag-heading h2').textContent = '当前数据集高频话题';
  const topicHead = $('tags').closest('table').querySelector('thead tr');
  topicHead.replaceChildren(node('th', '话题'), node('th', '笔记数'));
  document.querySelector('label[for="tagInput"]').textContent = '搜索关键词';
  $('tagInput').placeholder = '例如：原神'; $('tagInput').maxLength = 100;
  $('targetCount').max = 1000; $('targetCount').value = 100;
  $('targetCount').closest('label').firstChild.textContent = '笔记数量';
  $('countScope').closest('label').firstChild.textContent = '内容类型';
  options($('countScope'), [['image', '仅图文'], ['video', '仅视频'], ['all', '图文和视频']]);
  options($('mode'), [['with_media', '抓取并下载图片 / 视频'], ['metadata_only', '仅抓取，不下载媒体']]);
  const hint = $('collectionForm').querySelector('.tools .muted');
  hint.textContent = '单次目标上限 1000 篇；首次需在服务电脑扫码登录';
  mountCleaningPlaceholder();
  document.querySelector('.split > .card:last-child h2').textContent = '笔记详情与核心数据';
  $('qMain').placeholder = '标题 / 正文 / ID / 昵称 / 搜索关键词';
  $('qMain').setAttribute('aria-label', '搜索笔记'); $('qSub').hidden = true;
  // 小红书接口没有 AI 维度筛选：隐藏筛选整行（连同外层占位）。
  // 高频话题表头已由本页开头整表重建为「话题 / 笔记数」，AI 率列与可排序的作品数列
  // 都不存在（相关元素已被 replaceChildren 移除），因此无需也不能再访问它们。
  $('aiFilter').closest('.ai-filter-bar').hidden = true;
  $('aiFilter').replaceChildren();
  $('rankAi').closest('label').hidden = true;
  options($('rankSort'), Object.entries(metrics));
  $('prevBtn').textContent = '上一笔记'; $('nextBtn').textContent = '下一笔记';
  $('sourceLink').textContent = '查看小红书来源';
  $('preview').alt = '当前笔记的已下载图片';
}

function mountCleaningPlaceholder() {
  const row = node('div', undefined, 'formula-card');
  for (const [id, label, placeholder, maxLength] of [
    ['formulaName', '列名', '例：收藏占比', 50],
    ['formulaExpression', '表达式', '例：收藏数 / (点赞数 + 1)', 500],
  ]) {
    const group = node('label', undefined, 'formula-field');
    const input = node('input');
    Object.assign(input, { id, placeholder, maxLength, autocomplete: 'off' });
    group.append(node('span', label, 'formula-label'), input);
    row.append(group);
  }
  const group = node('label', undefined, 'formula-field');
  const insert = node('select');
  insert.setAttribute('aria-label', '插入字段名');
  insert.dataset.role = 'column-insert';
  options(insert, [['', '选择要插入的字段…'], ...['点赞数', '收藏数', '评论数', '分享数'].map(name => [name, name])]);
  insert.onchange = () => {
    if (!insert.value) return;
    const expression = $('formulaExpression');
    const start = expression.selectionStart ?? expression.value.length;
    const end = expression.selectionEnd ?? start;
    expression.setRangeText(insert.value, start, end, 'end');
    expression.focus();
    insert.value = '';
  };
  group.append(node('span', '插入字段', 'formula-label'), insert);
  row.append(group);
  $('formulaList').replaceChildren(row);
  $('derivedList').replaceChildren(node('span', '暂无派生列', 'muted'));
  $('formulaInfo').textContent = '小红书清洗和派生列暂未接入。';
  for (const [id, text] of [['cleanBtn', '小红书数据清洗暂未接入。'], ['formulaApply', '小红书派生列公式暂未接入。']]) {
    $(id).disabled = false;
    $(id).onclick = () => message(text);
  }
}

function mountNotes() {
  const saved = viewState();
  for (const id of ['qMain', 'rankSort', 'rankOrder']) {
    if (typeof saved[id] === 'string' && ($(id).tagName !== 'SELECT' ||
        [...$(id).options].some(option => option.value === saved[id]))) $(id).value = saved[id];
  }
  let dataset = '', page = 1, total = 0, rows = [], cursor = 0, mediaIndex = 0;
  let requestVersion = 0, detailVersion = 0, detail = null;
  function remember() {
    saveView({ dataset, notePage: page, note: rows[cursor]?.note_id, mediaIndex,
      ...Object.fromEntries(['qMain', 'rankSort', 'rankOrder'].map(id => [id, $(id).value])) });
  }
  function clearMedia() {
    const video = $('videoPreview'); video.pause(); video.removeAttribute('src'); video.load(); video.hidden = true;
    $('preview').removeAttribute('src'); $('preview').hidden = true;
    $('imageEmpty').hidden = false;
  }
  function renderMedia() {
    if (!detail) {
      clearMedia(); $('imgCount').textContent = '0';
      $('downloadImage').disabled = $('prevImage').disabled = $('nextImage').disabled = true;
      return;
    }
    const media = (detail?.media || []).filter(item => item.status === 'downloaded' && item.download_url);
    mediaIndex = Math.max(0, Math.min(mediaIndex, media.length - 1));
    if (detail) remember();
    const selected = media[mediaIndex];
    const active = selected?.media_type === 'video' ? $('videoPreview') : $('preview');
    const keepPlaying = selected && !active.hidden && active.getAttribute('src') === selected.download_url;
    if (!keepPlaying) clearMedia();
    $('imgCount').textContent = media.filter(item => item.media_type === 'image').length;
    $('downloadImage').disabled = !selected;
    $('prevImage').disabled = mediaIndex <= 0;
    $('nextImage').disabled = mediaIndex >= media.length - 1;
    $('caption').textContent = detail ? `本页笔记 ${cursor + 1}/${rows.length} · 媒体 ${selected ? mediaIndex + 1 : 0}/${media.length}` : '';
    $('imageEmpty').textContent = detail ? '暂无已下载媒体，可查看笔记数据或小红书来源。' : '选择数据集查看笔记';
    if (!selected) return;
    if (keepPlaying) return;
    const element = selected.media_type === 'video' ? $('videoPreview') : $('preview');
    element.src = selected.download_url; element.hidden = false; $('imageEmpty').hidden = true;
    element.onerror = () => { element.hidden = true; $('imageEmpty').hidden = false; $('imageEmpty').textContent = '媒体文件无法读取'; };
  }
  function renderDetails() {
    const box = $('artworkDetails'); box.replaceChildren(); $('bars').replaceChildren();
    if (!detail) return;
    const list = node('dl', undefined, 'artwork-details');
    for (const [label, value] of [
      ['笔记标题', detail.title], ['笔记 ID', detail.note_id], ['笔记类型', detail.type === 'video' ? '视频' : '图文'],
      ['作者昵称（脱敏）', detail.nickname], ['作者匿名标识', detail.creator_hash], ['搜索关键词', detail.source_keyword],
      ['话题', (detail.tag_list || []).join(' / ')], ['发布时间', formatDate(detail.published_at)],
      ['更新时间', formatDate(detail.updated_at)], ['采集时间', formatDate(detail.collected_at)],
    ]) list.append(node('dt', label), node('dd', valueText(value)));
    list.append(node('dt', '笔记正文'), node('dd', detail.desc || '—', 'note-body'));
    box.append(list);
    for (const key of ['liked_count', 'collected_count', 'comment_count', 'share_count']) {
      const item = node('div', undefined, 'bar-item');
      const head = node('div', undefined, 'bar-head');
      head.append(node('span', metrics[key], 'bar-name'), node('span', valueText(detail[key]), 'bar-val'));
      item.append(head); $('bars').append(item);
    }
    const failed = (detail.media || []).filter(item => item.status === 'failed').length;
    if (failed) $('bars').append(node('p', `${failed} 个媒体下载失败，可查看任务进度。`, 'muted'));
  }
  async function show(quiet = false) {
    const stamp = ++detailVersion;
    const row = rows[cursor];
    const preserve = quiet && detail?.note_id === row?.note_id;
    if (!preserve) {
      const restored = viewState();
      detail = null; mediaIndex = restored.dataset === dataset && restored.note === row?.note_id ? Number(restored.mediaIndex) || 0 : 0;
    }
    $('keyword').textContent = row?.title || (row ? '无标题笔记' : '暂无笔记');
    $('keywordId').textContent = row ? `笔记 ID：${row.note_id}` : '';
    $('prevBtn').disabled = cursor <= 0; $('nextBtn').disabled = cursor >= rows.length - 1;
    const source = $('sourceLink'); source.hidden = !row;
    source.href = row ? `https://www.xiaohongshu.com/explore/${encodeURIComponent(row.note_id)}` : '#';
    for (const button of $('filters').querySelectorAll('button')) {
      const selected = button.dataset.note === row?.note_id;
      button.setAttribute('aria-pressed', String(selected)); button.closest('tr').classList.toggle('selected-work', selected);
    }
    if (row) remember();
    if (!preserve) { renderDetails(); renderMedia(); }
    if (!row) return;
    $('imageEmpty').textContent = '加载笔记详情…';
    try {
      const data = await api.note(dataset, row.note_id);
      if (stamp !== detailVersion) return;
      const mediaChanged = !preserve || JSON.stringify(detail?.media) !== JSON.stringify(data.media);
      detail = data; renderDetails(); if (mediaChanged) renderMedia();
    } catch (error) {
      if (stamp === detailVersion) $('imageEmpty').textContent = error.message;
    }
  }
  async function load(quiet = false) {
    const version = ++requestVersion, selectedId = rows[cursor]?.note_id || (saved.dataset === dataset ? saved.note : null);
    const selectedRow = rows[cursor];
    ++detailVersion;
    if (!quiet || !dataset) { rows = []; cursor = 0; await show(); }
    if (version !== requestVersion) return;
    if (!dataset) {
      total = 0; $('filters').replaceChildren(); $('tags').replaceChildren();
      $('tagTotal').textContent = '总数：0个'; updatePager(); $('searchInfo').textContent = '暂无数据集'; return;
    }
    $('searchInfo').textContent = '加载笔记中…';
    try {
      const result = await api.notes(dataset, { page, page_size: 20, q: $('qMain').value.trim(),
        sort_by: $('rankSort').value, order: $('rankOrder').value });
      if (version !== requestVersion) return;
      total = result.total;
      if (page > Math.max(1, Math.ceil(total / 20))) { page = Math.max(1, Math.ceil(total / 20)); return load(); }
      rows = result.items;
      if (quiet && selectedRow && !rows.some(row => row.note_id === selectedId)) rows.push(selectedRow);
      cursor = Math.max(0, rows.findIndex(row => row.note_id === selectedId));
      const key = $('rankSort').value; $('rankColumn').textContent = metrics[key];
      $('filters').replaceChildren(...rows.map((row, index) => {
        const tr = node('tr'), title = node('td'), button = node('button', row.title || row.note_id, 'ghost');
        button.dataset.note = row.note_id; button.onclick = () => { cursor = index; show(); };
        title.append(button); tr.append(title, node('td', isDate(key) ? formatDate(row[key]) : valueText(row[key]))); return tr;
      }));
      $('tags').replaceChildren(...(result.tags || []).map(topic => {
        const tr = node('tr'); tr.append(node('td', topic.tag), node('td', topic.count)); return tr;
      }));
      $('tagTotal').textContent = `总数：${result.tag_total || 0}个`;
      $('searchInfo').textContent = `共 ${total} 篇笔记`; updatePager(); await show(quiet);
    } catch (error) { if (version === requestVersion) $('searchInfo').textContent = error.message; }
  }
  function updatePager() {
    const pages = Math.ceil(total / 20); $('artPage').textContent = `/ ${pages} 页`;
    $('artPageInput').value = page; $('artPageInput').max = Math.max(1, pages);
    $('artPageInput').disabled = $('artJumpBtn').disabled = !total;
    $('artPrev').disabled = page <= 1 || !total; $('artNext').disabled = page >= pages;
  }
  $('prevBtn').onclick = () => { if (cursor > 0) { cursor--; show(); } };
  $('nextBtn').onclick = () => { if (cursor < rows.length - 1) { cursor++; show(); } };
  $('prevImage').onclick = () => { mediaIndex--; renderMedia(); };
  $('nextImage').onclick = () => { mediaIndex++; renderMedia(); };
  $('downloadImage').onclick = () => action($('downloadImage'), async () => {
    const item = (detail?.media || []).filter(media => media.status === 'downloaded' && media.download_url)[mediaIndex];
    if (!item) return;
    const noteId = detail.note_id;
    const blob = await api.downloadMedia(item.download_url);
    const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
      'image/gif': '.gif', 'image/avif': '.avif', 'video/mp4': '.mp4', 'video/webm': '.webm',
      'video/quicktime': '.mov', 'video/x-flv': '.flv' };
    const localExtension = /\.(jpg|jpeg|png|webp|gif|avif|mp4|webm|mov|flv|m4s)$/i.exec(item.local_path || '')?.[0];
    const extension = extensions[blob.type.split(';')[0].toLowerCase()] || localExtension || (item.media_type === 'video' ? '.mp4' : '.jpg');
    const url = URL.createObjectURL(blob);
    const link = node('a'); link.href = url; link.download = `${noteId}_${item.media_id}${extension}`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('artPrev').onclick = () => { if (page > 1) { page--; load(); } };
  $('artNext').onclick = () => { if (page * 20 < total) { page++; load(); } };
  $('artJump').onsubmit = event => { event.preventDefault(); const n = Number($('artPageInput').value);
    if (Number.isInteger(n) && n >= 1 && n <= Math.ceil(total / 20)) { page = n; load(); } };
  $('searchForm').onsubmit = event => { event.preventDefault(); page = 1; load(); };
  $('qReset').onclick = () => { $('qMain').value = ''; page = 1; load(); };
  for (const id of ['rankSort', 'rankOrder']) $(id).onchange = () => { page = 1; load(); };
  window.addEventListener('pagehide', () => { ++requestVersion; ++detailVersion; clearMedia(); });
  return { select: id => { dataset = id; page = saved.dataset === id ? Math.max(1, Number(saved.notePage) || 1) : 1; return load(); }, refresh: () => load(true) };
}

function mountXhsDatasets(notes) {
  const saved = viewState();
  let page = Math.max(1, Number(saved.datasetPage) || 1), current = saved.dataset || '', items = [], version = 0, listVersion = 0, mounted = false;
  const carousel = mountDatasetCarousel(id => { $('docSelect').value = id; select(id); });
  async function select(id) {
    const same = mounted && current === id; current = id; mounted = true;
    saveView({ dataset: id, datasetPage: page });
    const stamp = ++version; carousel(items, current);
    $('datasetInfo').textContent = id ? '加载数据集…' : '暂无数据集，提交采集后会自动显示。';
    $('openDatasetFolder').disabled = !id;
    const view = same ? notes.refresh() : notes.select(id);
    if (id) {
      try {
        const result = await api.dataset(id);
        if (stamp !== version) return;
        $('datasetInfo').textContent = `${result.row_count} 篇笔记 · ${result.status === 'collecting' ? '采集中' : '已保存'} · 创建 ${formatDate(result.created_at)}`;
      } catch (error) { if (stamp === version) $('datasetInfo').textContent = error.message; }
    }
    await view;
  }
  async function refresh() {
    const stamp = ++listVersion;
    let result = await api.datasets(page);
    if (stamp !== listVersion) return;
    const last = Math.max(1, Math.ceil(result.total / 20));
    if (page > last) { page = last; result = await api.datasets(page); }
    if (stamp !== listVersion) return;
    items = result.items;
    const selected = items.find(item => item.dataset_id === current) || items[0];
    $('docSelect').replaceChildren(...items.map(item => {
      const option = node('option', `${(item.tags || []).join(' / ')} · ${item.dataset_id.slice(-8)} · ${item.row_count} 篇`);
      option.value = item.dataset_id; return option;
    }));
    $('docSelect').value = selected?.dataset_id || '';
    $('datasetPage').textContent = `第 ${page} 页 · 共 ${result.total} 个数据集`;
    $('datasetPrev').disabled = page <= 1; $('datasetNext').disabled = page * 20 >= result.total;
    await select(selected?.dataset_id || '');
  }
  $('docSelect').onchange = () => select($('docSelect').value);
  $('datasetRefresh').onclick = () => action($('datasetRefresh'), refresh);
  $('openDatasetFolder').onclick = () => action($('openDatasetFolder'), async () => {
    if (!current) return;
    await api.openDatasetFolder(current);
  });
  for (const [id, delta] of [['datasetPrev', -1], ['datasetNext', 1]]) $(id).onclick = () => action($(id), async () => {
    page += delta; try { await refresh(); } catch (error) { page -= delta; throw error; }
  });
  return { refresh };
}
return { "configureXhsPage": configureXhsPage, "mountNotes": mountNotes, "mountXhsDatasets": mountXhsDatasets };
});

  __require("analysis.js");
})();
