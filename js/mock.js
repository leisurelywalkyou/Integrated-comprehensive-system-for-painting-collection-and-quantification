/* 离线演示数据层：拦截 axios 请求，返回本地模拟数据，不访问任何网络资源。 */
(function () {
  "use strict";

  const DAY = 86400000;
  const IMG1 = "./assets/sample-01.jpg";
  const IMG2 = "./assets/sample-02.jpg";
  const now = () => new Date().toISOString();
  const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
  const day = (n) => daysAgo(n).slice(0, 10);

  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let a = seed >>> 0;
    return function random() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const TITLES = [
    "月下少年", "星海归途", "红莲之章", "白昼幻想", "薄雾清晨", "樱花飘落时",
    "永夜微光", "棱镜", "夏之彼岸", "时空裂缝", "风与誓言", "琉璃梦",
    "星辰绘卷", "逆光而行", "无名之章", "黄昏时分", "银翼少女", "孤帆远航",
    "花与剑", "破碎记忆", "重生之约", "彩虹桥", "墨染流年", "极光之下",
    "黎明之前", "深海之歌", "苍穹记", "命运齿轮", "最后的光", "千年一梦",
  ];
  const AUTHORS = [
    "星尘画师", "月见草", "夜行", "浅夏", "风屿", "墨白", "夏目", "琉璃",
    "逆光", "安澜", "半夏", "云岫", "清歌", "浮生", "惊鸿", "夜归人", "知夏", "未眠",
  ];
  const TAG_POOL = [
    "原神", "GenshinImpact", "原神同人", "明日方舟", "Arknights", "凹凸世界",
    "凹凸世界同人", "碧蓝航线", "AzurLane", "崩坏星穹铁道", "HonkaiStarRail",
    "咒术回战", "JujutsuKaisen", "二次元", "插画", "日系", "少女", "风景", "厚涂",
  ];

  function makeDataset(index, platform, tags, rowCount, aiCount, createdDays, cleanedDays) {
    const seed = hash(`dataset-${index}-${tags.join("-")}`);
    const random = rng(seed + 97);
    let hex = "";
    for (let i = 0; i < 32; i += 1) hex += "0123456789abcdef"[Math.floor(random() * 16)];
    return {
      dataset_id: `ds_${hex}`,
      platform,
      tags,
      row_count: rowCount,
      ai_count: aiCount,
      noai_count: aiCount == null ? null : rowCount - aiCount,
      status: "cleaned",
      created_at: daysAgo(createdDays),
      cleaned_at: daysAgo(cleanedDays),
      csv_path: "",
      csv_files: {},
    };
  }

  const state = {
    datasets: [
      makeDataset(1, "pixiv", ["原神"], 1000, 312, 1, 0),
      makeDataset(2, "pixiv", ["明日方舟"], 800, 256, 26, 25),
      makeDataset(3, "pixiv", ["凹凸世界"], 600, 180, 20, 19),
      makeDataset(4, "pixiv", ["碧蓝航线"], 500, 140, 16, 15),
      makeDataset(5, "pixiv", ["崩坏星穹铁道"], 450, 110, 11, 10),
      makeDataset(6, "pixiv", ["咒术回战"], 350, 98, 7, 6),
      makeDataset(7, "xhs", ["穿搭分享"], 400, null, 9, 8),
      makeDataset(8, "xhs", ["旅行手记"], 320, null, 4, 3),
    ],
    tasks: [
      {
        task_id: "col_demo001", task_type: "collection", platform: "pixiv",
        status: "succeeded", stage: "finished", tags: ["原神"],
        parameters: { target_count: 1000, mode: "with_images" },
        progress: { collected_count: 1000, written_count: 1000, image_file_count: 820, detail_failed_count: 0, media_failed_count: 0 },
        result: { dataset_id: null }, created_at: daysAgo(32), started_at: daysAgo(32),
        updated_at: daysAgo(31), finished_at: daysAgo(31), error: null,
      },
      {
        task_id: "cln_demo002", task_type: "cleaning", platform: "pixiv",
        status: "succeeded", stage: "finished", tags: [],
        parameters: { dataset_id: "ds_demo" },
        progress: { row_count: 1000 },
        result: null, created_at: daysAgo(31), started_at: daysAgo(31),
        updated_at: daysAgo(31), finished_at: daysAgo(31), error: null,
      },
      {
        task_id: "col_demo003", task_type: "collection", platform: "pixiv",
        status: "running", stage: "collecting", tags: ["明日方舟"],
        parameters: { target_count: 180, mode: "with_images" },
        progress: { collected_count: 45, written_count: 45, image_file_count: 36, detail_failed_count: 0, media_failed_count: 0 },
        result: null, created_at: daysAgo(0), started_at: daysAgo(0),
        updated_at: now(), finished_at: null, error: null,
      },
      {
        task_id: "col_demo004", task_type: "collection", platform: "pixiv",
        status: "canceled", stage: "finished", tags: ["碧蓝航线"],
        parameters: { target_count: 500, mode: "metadata_only" },
        progress: { collected_count: 120, written_count: 120, image_file_count: 0 },
        result: null, created_at: daysAgo(14), started_at: daysAgo(14),
        updated_at: daysAgo(14), finished_at: daysAgo(14), error: null,
      },
      {
        task_id: "ait_demo005", task_type: "ai_translation", platform: "pixiv",
        status: "succeeded", stage: "finished", tags: [],
        parameters: { dataset_id: "ds_demo" },
        progress: { ai_total: 620, ai_done: 620, written_count: 620, message: "标签翻译完成" },
        result: { message: "共翻译 620 个标签" }, created_at: daysAgo(28),
        started_at: daysAgo(28), updated_at: daysAgo(28), finished_at: daysAgo(28), error: null,
      },
      {
        task_id: "col_demo006", task_type: "collection", platform: "xhs",
        status: "succeeded", stage: "finished", tags: ["穿搭分享"],
        parameters: { target_count: 400, mode: "with_media" },
        progress: { saved_note_count: 400, written_count: 400, image_downloaded_count: 860, video_downloaded_count: 24, detail_failed_count: 0, media_failed_count: 0 },
        result: { dataset_id: null }, created_at: daysAgo(9), started_at: daysAgo(9),
        updated_at: daysAgo(8), finished_at: daysAgo(8), error: null,
      },
    ],
    counters: { collection: 3, cleaning: 2, translation: 5 },
  };

  state.tasks[0].result.dataset_id = state.datasets[0].dataset_id;
  state.tasks[5].result.dataset_id = state.datasets[6].dataset_id;

  /* ---------------- 作品 / 笔记 ---------------- */

  // 精选展示样例：标题 / 作者 / 互动数据与本地图片内容对应，首页图集可直接看出效果。
  const SHOWCASE = [
    { title: "月下少女", author: "月见草", images: [IMG1], view: 128400, like: 9860, bookmark: 5130, comment: 612, age: 12, ai: "否" },
    { title: "樱下剑客", author: "夏目", images: [IMG2], view: 96400, like: 7240, bookmark: 3860, comment: 428, age: 21, ai: "否" },
    { title: "星月与花道", author: "星尘画师", images: [IMG1, IMG2], view: 158200, like: 13260, bookmark: 7040, comment: 986, age: 8, ai: "是" },
  ];

  function artworkAt(ds, index) {
    const random = rng(hash(`${ds.dataset_id}#${index}`));
    const sample = ds.tags.includes("原神") ? SHOWCASE[index] : null;
    const title = sample ? sample.title : TITLES[Math.floor(random() * TITLES.length)];
    const author = sample ? sample.author : AUTHORS[Math.floor(random() * AUTHORS.length)];
    const view = sample ? sample.view : 800 + Math.floor(random() * 240000);
    const like = sample ? sample.like : Math.floor(view * (0.02 + random() * 0.06));
    const bookmark = sample ? sample.bookmark : Math.floor(like * (0.25 + random() * 0.5));
    const comment = sample ? sample.comment : Math.floor(like * (0.02 + random() * 0.08));
    const age = sample ? sample.age : 1 + Math.floor(random() * 680);
    const extras = [];
    const extraCount = 1 + Math.floor(random() * 3);
    for (let i = 0; i < extraCount; i += 1) {
      extras.push(TAG_POOL[Math.floor(random() * TAG_POOL.length)]);
    }
    const tags = Array.from(new Set(ds.tags.concat(extras)));
    const images = sample ? sample.images : [];
    const id = String(102400 + index + (hash(ds.dataset_id) % 500));
    return {
      id,
      title,
      author_name: author,
      author_id: `usr_${String(hash(author + title) % 9999).padStart(4, "0")}`,
      platform: ds.platform,
      view_count: view,
      like_count: like,
      bookmark_count: bookmark,
      comment_count: comment,
      tags,
      is_ai: sample ? sample.ai : random() < 0.31 ? "是" : "否",
      create_date: daysAgo(age),
      crawl_time: daysAgo(Math.max(0, age - 1)),
      images,
      image_dir: images.length ? `data/images/${ds.dataset_id.slice(3, 11)}/${id}` : "",
      page_url: `https://www.pixiv.net/artworks/${id}`,
      search_tag: ds.tags[0],
      cleaned: {
        "存在时间": `${age} 天`,
        "存在秒数": age * 86400,
        "浏览点赞比": Number((like / Math.max(view, 1)).toFixed(4)),
        "收藏点赞比": Number((bookmark / Math.max(like, 1)).toFixed(4)),
        "热度等级": like > 6000 ? "热门" : like > 2000 ? "中等" : "冷门",
      },
    };
  }

  const AI_COUNTS = { "是": 0, "否": 0 };

  function artworksPage(ds, params) {
    const pageSize = Number(params.page_size) || 20;
    const page = Math.max(1, Number(params.page) || 1);
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, ds.row_count);
    const items = [];
    for (let i = start; i < end; i += 1) items.push(artworkAt(ds, i));
    let total = ds.row_count;
    if (params.ai === "是") total = ds.ai_count || Math.round(ds.row_count * 0.31);
    if (params.ai === "否") total = ds.noai_count || Math.round(ds.row_count * 0.69);
    const tags = TAG_POOL.slice(0, 12).map((tag, i) => ({
      tag,
      count: Math.max(6, Math.round((ds.row_count / 60) * (12 - i) / 2)),
      ai_count: Math.round((ds.ai_count || ds.row_count * 0.31) / 40 * (12 - i)),
      ai_rate: Number(((ds.ai_count || ds.row_count * 0.31) / ds.row_count).toFixed(4)),
    }));
    return {
      items,
      total,
      tags,
      tag_total: TAG_POOL.length,
      ai_counts: {
        "是": ds.ai_count || Math.round(ds.row_count * 0.31),
        "否": ds.noai_count || Math.round(ds.row_count * 0.69),
      },
      page,
      page_size: pageSize,
    };
  }

  // 小红书精选样例：笔记标题 / 正文 / 图片组与本地图片内容对应。
  const NOTE_SHOWCASE = [
    {
      title: "月夜草坡氛围感机位分享", nickname: "夜行", liked: 4820, age: 3,
      desc: "城郊草坡的满月机位，蓝调时刻提前 20 分钟到，广角压低机位就能拍出星空与月亮同框。",
      media: [{ media_id: "img_01", media_type: "image", status: "downloaded", download_url: IMG1, local_path: "assets/sample-01.jpg" }],
    },
    {
      title: "樱花小路散步拍照路线", nickname: "浅夏", liked: 3610, age: 7,
      desc: "山间石板路 + 两侧樱花，逆光时花瓣会发光；顺路还能拍到远处的雪线与晨雾。",
      media: [
        { media_id: "img_02", media_type: "image", status: "downloaded", download_url: IMG2, local_path: "assets/sample-02.jpg" },
        { media_id: "img_03", media_type: "image", status: "downloaded", download_url: IMG1, local_path: "assets/sample-01.jpg" },
      ],
    },
  ];

  function noteAt(ds, index) {
    const random = rng(hash(`${ds.dataset_id}~${index}`));
    const sample = ds.platform === "xhs" ? NOTE_SHOWCASE[index] : null;
    const title = sample ? sample.title : ["初秋通勤穿搭合集", "周末咖啡馆打卡", "海边日落机位分享", "小个子显高配色",
      "旅行行李清单", "城市漫步路线", "一衣多穿灵感", "周末露营记录"][Math.floor(random() * 8)];
    const liked = sample ? sample.liked : 200 + Math.floor(random() * 9000);
    const age = sample ? sample.age : 1 + Math.floor(random() * 300);
    const media = sample ? sample.media : [];
    return {
      note_id: `6${String(hash(ds.dataset_id) % 900000 + index).padStart(6, "0")}`,
      title,
      nickname: sample ? sample.nickname : AUTHORS[Math.floor(random() * AUTHORS.length)],
      type: "image",
      desc: sample ? sample.desc : `离线演示笔记 #${index + 1}：记录${ds.tags[0]}相关的内容与配色灵感。`,
      liked_count: liked,
      collected_count: Math.floor(liked * (0.2 + random() * 0.4)),
      comment_count: Math.floor(liked * (0.02 + random() * 0.1)),
      share_count: Math.floor(liked * (0.01 + random() * 0.05)),
      tag_list: ds.tags.concat(["生活记录", "灵感"]),
      published_at: daysAgo(age),
      collected_at: daysAgo(Math.max(0, age - 1)),
      media,
      media_count: media.length,
    };
  }

  function notesPage(ds, params) {
    const pageSize = Number(params.page_size) || 20;
    const page = Math.max(1, Number(params.page) || 1);
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, ds.row_count);
    const items = [];
    for (let i = start; i < end; i += 1) items.push(noteAt(ds, i));
    const tags = ["穿搭分享", "旅行手记", "咖啡探店", "城市漫步", "露营", "配色灵感"]
      .map((tag, i) => ({ tag, count: Math.max(5, Math.round((ds.row_count / 40) * (6 - i))) }));
    return { items, total: ds.row_count, tags, tag_total: tags.length, page, page_size: pageSize };
  }

  /* ---------------- 任务推进 ---------------- */

  function currentDataset(ds, rowCount, tags, platform) {
    const id = `ds_${Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}`;
    const created = now();
    return {
      dataset_id: id,
      platform: platform || "pixiv",
      tags,
      row_count: rowCount,
      ai_count: null,
      noai_count: null,
      status: "published",
      created_at: created,
      cleaned_at: null,
      csv_path: "",
      csv_files: {},
    };
  }

  function finishTask(task, result) {
    task.status = "succeeded";
    task.stage = "finished";
    task.result = result || task.result || null;
    task.finished_at = now();
    task.updated_at = task.finished_at;
  }

  function advance(task) {
    if (task.status !== "queued" && task.status !== "running") return;
    if (task.status === "queued") {
      task.status = "running";
      task.started_at = now();
      task.stage = task.task_type === "collection" ? "collecting" : "preparing";
    }
    task.updated_at = now();
    task.__ticks = (task.__ticks || 0) + 1;
    const progress = task.progress || (task.progress = {});

    if (task.task_type === "collection") {
      const target = Number(task.parameters.target_count) || 100;
      const step = Math.max(1, Math.ceil(target / 5));
      const key = task.platform === "xhs" ? "saved_note_count" : "collected_count";
      progress[key] = Math.min(target, (progress[key] || 0) + step);
      progress.written_count = progress[key];
      if (task.platform === "xhs") {
        progress.image_downloaded_count = progress[key] * 2;
        progress.video_downloaded_count = Math.floor(progress[key] * 0.06);
      } else {
        progress.image_file_count = task.parameters.mode === "metadata_only" ? 0 : Math.floor(progress[key] * 0.8);
      }
      if (progress[key] >= target) {
        const ds = currentDataset(null, target, task.tags || ["演示采集"], task.platform);
        if (task.platform !== "xhs") {
          ds.ai_count = Math.round(target * 0.3);
          ds.noai_count = target - ds.ai_count;
        }
        state.datasets.unshift(ds);
        finishTask(task, { dataset_id: ds.dataset_id, message: `已完成 ${target} 条采集` });
      }
      return;
    }

    if (task.task_type === "cleaning") {
      task.stage = "cleaning";
      progress.row_count = progress.row_count || 0;
      const ds = state.datasets.find((item) => item.dataset_id === task.parameters.dataset_id) || state.datasets[0];
      progress.row_count = ds.row_count;
      if (task.__ticks >= 2) {
        ds.status = "cleaned";
        ds.cleaned_at = now();
        if (ds.ai_count == null) {
          ds.ai_count = Math.round(ds.row_count * 0.3);
          ds.noai_count = ds.row_count - ds.ai_count;
        }
        finishTask(task, { row_count: ds.row_count, message: "清洗完成，AI 已标注" });
      }
      return;
    }

    task.stage = "translating";
    const total = Number(progress.ai_total) || 600;
    progress.ai_total = total;
    progress.ai_done = Math.min(total, (progress.ai_done || 0) + Math.ceil(total / 4));
    progress.written_count = progress.ai_done;
    if (progress.ai_done >= total) {
      progress.message = "标签翻译完成";
      finishTask(task, { message: `共翻译 ${total} 个标签` });
    }
  }

  function tickTasks() {
    state.tasks.forEach(advance);
  }

  /* ---------------- 聚合分析 ---------------- */

  function aggregate(ds, topTags) {
    const random = rng(hash(`agg-${ds.dataset_id}`));
    const xhs = ds.platform === "xhs";
    const row = ds.row_count;
    const aiCount = ds.ai_count == null ? Math.round(row * 0.29) : ds.ai_count;
    const viewAvg = xhs ? 0 : 22000 + random() * 98000;
    const likeAvg = xhs ? 900 + random() * 2600 : viewAvg * (0.025 + random() * 0.035);
    const bookmarkAvg = likeAvg * (0.28 + random() * 0.3);
    const commentAvg = likeAvg * (0.03 + random() * 0.06);
    const shareAvg = xhs ? likeAvg * (0.02 + random() * 0.04) : 0;
    const overallAvg = viewAvg + likeAvg + bookmarkAvg + commentAvg;

    const periods = [];
    for (let m = 5; m >= 0; m -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - m);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const scale = 0.65 + random() * 0.7;
      const count = Math.max(3, Math.round((row / 6) * (0.8 + random() * 0.5)));
      periods.push({
        period,
        count,
        view: { avg: Number((viewAvg * scale).toFixed(2)), total: Math.round(viewAvg * scale * count) },
        like: { avg: Number((likeAvg * scale).toFixed(2)), total: Math.round(likeAvg * scale * count) },
        bookmark: { avg: Number((bookmarkAvg * scale).toFixed(2)), total: Math.round(bookmarkAvg * scale * count) },
        comment: { avg: Number((commentAvg * scale).toFixed(2)), total: Math.round(commentAvg * scale * count) },
        overall: { avg: Number((overallAvg * scale).toFixed(2)), total: Math.round(overallAvg * scale * count) },
      });
    }

    const bucketLabels = ["<7天", "7天~1月", "1~3月", "3~6月", "6~12月", "1~2年", "2年以上"];
    const shares = [0.13, 0.27, 0.24, 0.16, 0.11, 0.06, 0.03];
    const buckets = bucketLabels.map((label, i) => ({ label, count: Math.round(row * shares[i]) }));
    const avgSeconds = Math.round((30 + (hash(ds.dataset_id + "-life") % 320)) * 86400);

    return {
      dataset_id: ds.dataset_id,
      platform: ds.platform,
      collection_tags: ds.tags,
      row_count: row,
      ai_count: aiCount,
      ai_ratio: Number((aiCount / row).toFixed(4)),
      created_at: ds.created_at,
      cleaned_at: ds.cleaned_at,
      attention: {
        view: { available: !xhs, total: xhs ? null : Math.round(viewAvg * row), avg: xhs ? null : Number(viewAvg.toFixed(2)), max: xhs ? null : Math.round(viewAvg * 4.2) },
        like: { available: true, total: Math.round(likeAvg * row), avg: Number(likeAvg.toFixed(2)), max: Math.round(likeAvg * 4) },
        bookmark: { available: true, total: Math.round(bookmarkAvg * row), avg: Number(bookmarkAvg.toFixed(2)), max: Math.round(bookmarkAvg * 4) },
        comment: { available: true, total: Math.round(commentAvg * row), avg: Number(commentAvg.toFixed(2)), max: Math.round(commentAvg * 3.5) },
        share: { available: xhs, total: xhs ? Math.round(shareAvg * row) : null, avg: xhs ? Number(shareAvg.toFixed(2)) : null, max: xhs ? Math.round(shareAvg * 3) : null },
        overall: { available: true, total: Math.round(overallAvg * row), avg: Number(overallAvg.toFixed(2)), max: Math.round(overallAvg * 4) },
      },
      existence: {
        available: true,
        source: "mixed",
        avg_seconds: avgSeconds,
        median_seconds: Math.round(avgSeconds * 0.66),
        buckets,
      },
      tags: {
        distinct: 180 + Math.round(random() * 120),
        top: TAG_POOL.slice(0, Math.max(5, topTags || 12)).map((tag, i) => ({
          tag,
          count: Math.max(4, Math.round((row / 40) * (14 - i) * (0.6 + random() * 0.5))),
          ai_count: Math.max(0, Math.round(aiCount / 30 * (14 - i) * (0.4 + random() * 0.5))),
        })),
      },
      trend: periods,
    };
  }

  /* ---------------- 路由 ---------------- */

  function page(items, pageNumber, size) {
    const p = Math.max(1, Number(pageNumber) || 1);
    return { items: items.slice((p - 1) * size, p * size), total: items.length, page: p, page_size: size };
  }

  const SETTINGS_FIELDS = [
    { key: "POSTGRES_HOST", label: "主机", group: "postgres", groupLabel: "PostgreSQL", type: "text", value: "127.0.0.1", required: true, desc: "数据库主机地址" },
    { key: "POSTGRES_PORT", label: "端口", group: "postgres", groupLabel: "PostgreSQL", type: "number", value: "5432", required: true },
    { key: "POSTGRES_DB", label: "数据库名", group: "postgres", groupLabel: "PostgreSQL", type: "text", value: "art_platform_demo", required: true },
    { key: "POSTGRES_USER", label: "用户名", group: "postgres", groupLabel: "PostgreSQL", type: "text", value: "demo", required: true },
    { key: "POSTGRES_PASSWORD", label: "密码", group: "postgres", groupLabel: "PostgreSQL", type: "password", value: "********", secret: true },
    { key: "PIXIV_USER_ID", label: "Pixiv 账号", group: "pixiv", groupLabel: "Pixiv", type: "text", value: "demo_account", desc: "用于获取作品元数据" },
    { key: "PIXIV_PHPSESSID", label: "PHPSESSID", group: "pixiv", groupLabel: "Pixiv", type: "password", value: "********", secret: true, desc: "登录 Cookie，仅保存在本机配置" },
    { key: "AI_PROVIDER", label: "服务商", group: "ai", groupLabel: "AI 标签翻译", type: "select", value: "deepseek", options: [["deepseek", "DeepSeek"], ["openai", "OpenAI"], ["custom", "自定义"]] },
    { key: "AI_BASE_URL", label: "接口地址", group: "ai", groupLabel: "AI 标签翻译", type: "text", value: "https://api.deepseek.com/v1" },
    { key: "AI_API_KEY", label: "API Key", group: "ai", groupLabel: "AI 标签翻译", type: "password", value: "********", secret: true },
    { key: "AI_MODEL", label: "模型", group: "ai", groupLabel: "AI 标签翻译", type: "text", value: "deepseek-chat" },
    { key: "UI_BACKGROUND_IMAGE", label: "主背景图", group: "appearance", groupLabel: "界面外观", type: "select", value: "", options: [["", "无背景"], ["backdrop", "示例背景"]] },
    { key: "UI_MODULE_OPACITY", label: "模块不透明度", group: "appearance", groupLabel: "界面外观", type: "range", value: "0.92", min: 0.3, max: 1, step: 0.01 },
    { key: "API_HOST", label: "监听地址", group: "api", groupLabel: "服务参数", type: "text", value: "127.0.0.1" },
    { key: "API_PORT", label: "监听端口", group: "api", groupLabel: "服务参数", type: "number", value: "8000" },
    { key: "API_DATA_DIR", label: "数据目录", group: "api", groupLabel: "服务参数", type: "text", value: "./data" },
    { key: "API_DATABASE_URL", label: "数据库连接串", group: "api", groupLabel: "服务参数", type: "text", value: "postgresql://demo@127.0.0.1:5432/art_platform_demo" },
    { key: "API_CORS_ORIGINS", label: "跨域白名单", group: "api", groupLabel: "服务参数", type: "text", value: "*" },
    { key: "PIXIV_CONCURRENCY", label: "并发数", group: "advanced", groupLabel: "高级参数", type: "number", value: "3" },
    { key: "PIXIV_REQUEST_INTERVAL", label: "请求间隔（秒）", group: "advanced", groupLabel: "高级参数", type: "number", value: "1.5" },
    { key: "LOG_LEVEL", label: "日志级别", group: "advanced", groupLabel: "高级参数", type: "select", value: "info", options: [["debug", "DEBUG"], ["info", "INFO"], ["warning", "WARNING"], ["error", "ERROR"]] },
  ];

  function settingsPayload() {
    return { path: "config.json", fields: SETTINGS_FIELDS.map((field) => ({ ...field })) };
  }

  function findDataset(id) {
    return state.datasets.find((item) => item.dataset_id === id) || state.datasets[0];
  }

  function ok(data, status) {
    return { data, status: status || 200, statusText: "OK", headers: {}, config: {} };
  }

  function fail(status, payload) {
    return { data: payload, status, statusText: "Error", headers: {}, config: {} };
  }

  function route(config) {
    const raw = config.url || "";
    const url = raw.startsWith("http") || raw.startsWith("./") ? raw : (config.baseURL || "") + raw;
    const pathOnly = url.split("?")[0];
    const params = config.params || {};
    const body = typeof config.data === "string" ? (() => { try { return JSON.parse(config.data); } catch { return {}; } })() : (config.data || {});
    const method = (config.method || "get").toLowerCase();

    if (pathOnly.endsWith("/health")) return ok({ status: "ok", version: "demo-offline", database: "postgresql" });
    if (pathOnly.endsWith("/ready")) return ok({ status: "ready", database: "connected", tables: 14 });

    if (pathOnly.endsWith("/settings/reveal")) return ok({ value: "demo-secret-value" });
    if (pathOnly.endsWith("/settings")) {
      if (method === "put") {
        const fields = body.fields || {};
        for (const field of SETTINGS_FIELDS) {
          if (!(field.key in fields)) continue;
          const value = fields[field.key];
          field.value = field.secret && value && !value.includes("******") ? "********" : String(value);
        }
        return ok({ saved: true, fields: SETTINGS_FIELDS.map((field) => ({ ...field })) });
      }
      return ok(settingsPayload());
    }

    if (pathOnly.includes("/xhs/auth/")) {
      return ok({ status: "not_logged_in", phase: "idle", logged_in: false, qrcode: null, checked_at: now(), message: "离线演示环境未连接小红书账号" });
    }

    if (pathOnly.endsWith("/ai/models")) {
      return ok({ models: ["deepseek-chat", "deepseek-reasoner", "gpt-4o-mini"] });
    }

    if (pathOnly.endsWith("/analysis/datasets")) {
      return ok({
        items: state.datasets.map((ds) => ({
          dataset_id: ds.dataset_id,
          platform: ds.platform,
          collection_tags: ds.tags,
          row_count: ds.row_count,
          ai_count: ds.ai_count,
          status: ds.status,
          created_at: ds.created_at,
          cleaned_at: ds.cleaned_at,
        })),
        total: state.datasets.length,
      });
    }

    if (pathOnly.endsWith("/analysis/tags")) {
      return ok({
        items: TAG_POOL.slice(0, Number(params.limit) || TAG_POOL.length).map((tag, i) => ({
          tag,
          count: 4200 - i * 180,
          ai_count: 1300 - i * 55,
          platforms: i % 4 === 3 ? ["pixiv", "xhs"] : ["pixiv"],
        })),
        total: TAG_POOL.length,
      });
    }

    if (pathOnly.endsWith("/analysis/overview")) {
      const topTags = Number(params.top_tags) || 12;
      let selected = [];
      if (params.mode === "tag") {
        let tags = [];
        try { tags = JSON.parse(params.tags || "[]"); } catch { tags = []; }
        selected = state.datasets.filter((ds) => ds.tags.some((tag) => tags.includes(tag)));
      } else {
        const ids = String(params.ids || "").split(",").filter(Boolean);
        selected = state.datasets.filter((ds) => ids.includes(ds.dataset_id));
      }
      if (!selected.length) {
        return fail(422, { error: { message: "请至少选择一个数据集。" } });
      }
      return ok({
        generated_at: now(),
        bucket: params.bucket || "month",
        mode: params.mode === "tag" ? "tag" : "dataset",
        radar_dimensions: ["浏览热度", "点赞认可", "收藏沉淀", "评论讨论", "AI 浓度", "数据规模", "存在时长"],
        datasets: selected.map((ds) => aggregate(ds, topTags)),
      });
    }

    if (pathOnly.endsWith("/analysis/import")) {
      const form = config.data;
      let platform = "pixiv";
      let name = "本地导入示例";
      if (form && typeof form.get === "function") {
        platform = form.get("platform") || platform;
        name = form.get("name") || name;
      }
      const ds = currentDataset(null, 360, [name], platform);
      ds.status = "cleaned";
      ds.cleaned_at = now();
      ds.ai_count = platform === "pixiv" ? 108 : null;
      ds.noai_count = platform === "pixiv" ? 252 : null;
      state.datasets.unshift(ds);
      const task = {
        task_id: `cln_imp${Math.random().toString(36).slice(2, 8)}`,
        task_type: "cleaning", platform, status: "succeeded", stage: "finished", tags: [],
        parameters: { dataset_id: ds.dataset_id },
        progress: { row_count: 360 },
        result: { row_count: 360 },
        created_at: now(), started_at: now(), updated_at: now(), finished_at: now(), error: null,
      };
      state.tasks.unshift(task);
      return ok({ task_id: task.task_id, dataset_id: ds.dataset_id, row_count: 360, skipped: 0, reused: false }, 202);
    }

    if (pathOnly.endsWith("/translation/status")) {
      return ok({ ai_configured: true, latest_untranslated: null, table_version: 3, table_records: 1200 });
    }

    if (pathOnly.endsWith("/collection-tasks") && method === "post") {
      const tags = body.tags && body.tags.length ? body.tags : ["演示采集"];
      const task = {
        task_id: `col_${Math.random().toString(36).slice(2, 8)}`,
        task_type: "collection", platform: body.platform || "pixiv",
        status: "queued", stage: "queued", tags,
        parameters: {
          target_count: Number(body.target_count) || 100,
          mode: body.mode || "with_images",
          download_media: body.download_media !== false,
        },
        progress: body.platform === "xhs"
          ? { saved_note_count: 0, written_count: 0, image_downloaded_count: 0, video_downloaded_count: 0 }
          : { collected_count: 0, written_count: 0, image_file_count: 0 },
        result: null, created_at: now(), started_at: null, updated_at: now(), finished_at: null, error: null,
      };
      state.tasks.unshift(task);
      return ok(task, 202);
    }

    if (pathOnly.endsWith("/cleaning-tasks") && method === "post") {
      const ds = findDataset(body.dataset_id);
      const task = {
        task_id: `cln_${Math.random().toString(36).slice(2, 8)}`,
        task_type: "cleaning", platform: ds.platform, status: "queued", stage: "queued", tags: [],
        parameters: { dataset_id: ds.dataset_id },
        progress: { row_count: ds.row_count },
        result: null, created_at: now(), started_at: null, updated_at: now(), finished_at: null, error: null,
      };
      state.tasks.unshift(task);
      return ok(task, 202);
    }

    if (pathOnly.endsWith("/ai-translation-tasks") && method === "post") {
      const ds = findDataset(body.dataset_id);
      const task = {
        task_id: `ait_${Math.random().toString(36).slice(2, 8)}`,
        task_type: "ai_translation", platform: ds.platform, status: "queued", stage: "queued", tags: [],
        parameters: { dataset_id: ds.dataset_id },
        progress: { ai_total: 600, ai_done: 0, written_count: 0 },
        result: null, created_at: now(), started_at: null, updated_at: now(), finished_at: null, error: null,
      };
      state.tasks.unshift(task);
      return ok(task, 202);
    }

    const csvMatch = pathOnly.match(/\/tasks\/([^/]+)\/csv$/);
    if (csvMatch) {
      const csv = "作品ID,标题,作者,浏览数,点赞数,是否AI\n102401,月下少年,星尘画师,128000,5120,否\n102402,星海归途,月见草,96000,3840,是\n";
      return ok(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    }

    if (pathOnly.endsWith("/retry-media") || pathOnly.match(/\/tasks\/[^/]+\/(cancel|resume|delete)$/)) {
      const match = pathOnly.match(/\/tasks\/([^/]+)\/([a-z-]+)$/);
      const task = state.tasks.find((item) => item.task_id === (match && match[1]));
      const action = match ? match[2] : "";
      if (task) {
        if (action === "cancel") { task.status = "canceled"; task.stage = "finished"; task.finished_at = now(); task.updated_at = now(); }
        if (action === "resume") { task.status = "running"; task.stage = "collecting"; task.updated_at = now(); }
        if (action === "delete") state.tasks = state.tasks.filter((item) => item.task_id !== task.task_id);
        return ok(task || { status: "ok" });
      }
      return ok({ status: "ok" });
    }

    const taskMatch = pathOnly.match(/\/tasks\/([^/]+)$/);
    if (taskMatch && !pathOnly.endsWith("/tasks") && method === "get") {
      tickTasks();
      const task = state.tasks.find((item) => item.task_id === taskMatch[1]);
      return task ? ok(task) : fail(404, { error: { message: "任务不存在" } });
    }

    if (pathOnly.endsWith("/tasks")) {
      tickTasks();
      const list = state.tasks
        .filter((task) => !params.platform || task.platform === params.platform)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const result = page(list, params.page, 10);
      result.latest_task_updated_at = list.length ? list[0].updated_at : null;
      return ok(result);
    }

    const artMatch = pathOnly.match(/\/datasets\/([^/]+)\/artworks$/);
    if (artMatch) return ok(artworksPage(findDataset(artMatch[1]), params));

    const notesMatch = pathOnly.match(/\/datasets\/([^/]+)\/notes$/);
    if (notesMatch) return ok(notesPage(findDataset(notesMatch[1]), params));
    const noteMatch = pathOnly.match(/\/datasets\/([^/]+)\/notes\/([^/]+)$/);
    if (noteMatch) {
      const ds = findDataset(noteMatch[1]);
      const all = notesPage(ds, { page: 1, page_size: ds.row_count }).items;
      const note = all.find((item) => item.note_id === decodeURIComponent(noteMatch[2]));
      return note ? ok(note) : fail(404, { error: { message: "笔记不存在" } });
    }

    const statsMatch = pathOnly.match(/\/datasets\/([^/]+)\/stats$/);
    if (statsMatch) return ok(findDataset(statsMatch[1]));

    const colsMatch = pathOnly.match(/\/datasets\/([^/]+)\/columns$/);
    if (colsMatch) {
      const ds = findDataset(colsMatch[1]);
      const protectedColumns = ["作品ID", "作品标题", "作者昵称", "浏览数", "点赞数", "收藏数", "评论数", "发布时间", "采集时间", "作品标签", "是否AI", "来源链接", "存在秒数"];
      return ok({
        dataset_id: ds.dataset_id,
        columns: protectedColumns.concat(["浏览点赞比", "收藏点赞比", "存在时间", "热度等级"]),
        protected_columns: protectedColumns,
        physical_tables: { cleaned: `cleaned_${ds.dataset_id.slice(-8)}`, ai: `ai_${ds.dataset_id.slice(-8)}`, noai: `noai_${ds.dataset_id.slice(-8)}` },
        sample: { "作品ID": "102401", "作品标题": "月下少年", "浏览数": 128000, "点赞数": 5120, "浏览点赞比": 0.04, "存在秒数": 3888000 },
      });
    }

    const formulaMatch = pathOnly.match(/\/datasets\/([^/]+)\/formulas(\/delete)?$/);
    if (formulaMatch) {
      const ds = findDataset(formulaMatch[1]);
      if (formulaMatch[2]) return ok({ deleted: (body.names || []).length });
      return ok({ ...ds, formulas: body.formulas || [] });
    }

    const openMatch = pathOnly.match(/\/datasets\/([^/]+)\/open-folder$/);
    if (openMatch) return ok({ opened: false, reason: "离线演示环境不支持打开本地文件夹" });

    if (pathOnly.endsWith("/datasets")) {
      const list = state.datasets
        .filter((ds) => !params.platform || ds.platform === params.platform)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return ok(page(list, params.page, 20));
    }

    if (pathOnly.startsWith("./assets/")) {
      return ok(new Blob([], { type: pathOnly.endsWith(".png") ? "image/png" : "image/jpeg" }));
    }

    return fail(404, { error: { message: "离线演示未实现该接口：" + pathOnly } });
  }

  window.axios.defaults.adapter = function adapter(config) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const response = route(config);
          if (response.status >= 400) {
            const error = new Error(response.data && response.data.error ? response.data.error.message : "请求失败");
            error.response = response;
            error.config = config;
            reject(error);
            return;
          }
          resolve(response);
        } catch (error) {
          reject(error);
        }
      }, 90);
    });
  };

  window.__DEMO__ = { state };
})();
