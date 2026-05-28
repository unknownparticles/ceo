/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanyStats, GameEvent } from "./types";

export type AiProviderId = "deepseek" | "minimax" | "glm" | "kimi" | "gemini";

export interface AiProviderConfig {
  id: AiProviderId;
  label: string;
  model: string;
  endpoint: string;
  apiKeyHelp: string;
}

export interface ApiKeySettings {
  activeProviderId: AiProviderId | "auto";
  keys: Record<AiProviderId, string>;
}

export const AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    model: "deepseek-chat",
    endpoint: "https://api.deepseek.com/chat/completions",
    apiKeyHelp: "DeepSeek API Key",
  },
  {
    id: "minimax",
    label: "MiniMax",
    model: "MiniMax-M1",
    endpoint: "https://api.minimax.io/v1/text/chatcompletion_v2",
    apiKeyHelp: "MiniMax API Key",
  },
  {
    id: "glm",
    label: "GLM / 智谱",
    model: "glm-4-flash",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    apiKeyHelp: "智谱 GLM API Key",
  },
  {
    id: "kimi",
    label: "Kimi / Moonshot",
    model: "moonshot-v1-8k",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    apiKeyHelp: "Moonshot API Key",
  },
  {
    id: "gemini",
    label: "Gemini",
    model: "gemini-2.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    apiKeyHelp: "Google Gemini API Key",
  },
];

const SETTINGS_STORAGE_KEY = "one_min_boss_api_settings";

export const emptyApiKeySettings = (): ApiKeySettings => ({
  activeProviderId: "auto",
  keys: AI_PROVIDERS.reduce((acc, provider) => {
    acc[provider.id] = "";
    return acc;
  }, {} as Record<AiProviderId, string>),
});

export const loadApiKeySettings = (): ApiKeySettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return emptyApiKeySettings();
    const parsed = JSON.parse(raw) as Partial<ApiKeySettings>;
    return {
      activeProviderId: parsed.activeProviderId || "auto",
      keys: {
        ...emptyApiKeySettings().keys,
        ...(parsed.keys || {}),
      },
    };
  } catch (error) {
    console.error("Failed to load API settings", error);
    return emptyApiKeySettings();
  }
};

export const saveApiKeySettings = (settings: ApiKeySettings) => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

export const getProviderLabel = (providerId: AiProviderId | "auto") => {
  if (providerId === "auto") return "自动选择";
  return AI_PROVIDERS.find((provider) => provider.id === providerId)?.label || providerId;
};

export const resolveActiveProvider = (settings: ApiKeySettings) => {
  const filledProviders = AI_PROVIDERS.filter((provider) => settings.keys[provider.id]?.trim());
  if (filledProviders.length === 0) return null;

  if (settings.activeProviderId !== "auto") {
    const preferred = AI_PROVIDERS.find((provider) => provider.id === settings.activeProviderId);
    if (preferred && settings.keys[preferred.id]?.trim()) return preferred;
  }

  return filledProviders[0];
};

const CONSTANT_SYSTEM_INSTRUCTION = `
你是一个无情、幽默、充满荒诞现实主义的"一分钟商业模拟游戏"的游戏导演 (Game Director)。你的名字叫“AI商界导师”。
本游戏的目标：给你 60 秒，通过一系列极度离谱、胡说八道却套上高端商业术语的决策，让玩家要么拯救这家公司，要么光荣破产。
你生成的内容核心风格：
1. 严肃且充满黑话 (Buzzwords)：使用黑话如“协同效应、价值引爆、降本增效、重合度穿透、GMV指数破壁、高维矩阵覆盖、闭环增长、底层逻辑”。
2. 极端荒谬的现实：方案极度离谱（例如：把员工换成电子仓鼠，用椰子汁做运载火箭燃料，拿老板的私房钱做空美联储）。
3. 即时报应 (Direct Consequences)：玩家做的没脑子决定会立刻引发连锁滑稽恶果。
4. 语言：必须以 **简体中文** 提供所有内容。风格具有嘲讽性质、一针见血，但要保持顶级商业咨询公司报告的庄重形式。
5. 每次事件提供刚好 3 个选择（选项 A, B, 选项 C）。选择必须有不同的风险程度和偏向：稳健降本、疯狂高风险扩张、转移债务或逃避责任。
6. 每个问题的 3 个选项答案必须互不相同：不得复用相同句式、相同核心行动、相同后果，不得让 A/B/C 只是换词重复。
7. 只返回严格 JSON，不要输出 Markdown 代码块或解释文字。
`;

function stripCodeFence(jsonText: string) {
  let sanitized = jsonText.trim();
  if (sanitized.startsWith("```json")) sanitized = sanitized.slice(7);
  if (sanitized.startsWith("```")) sanitized = sanitized.slice(3);
  if (sanitized.endsWith("```")) sanitized = sanitized.slice(0, -3);
  return sanitized.trim();
}

function cleanAndParseJSON(jsonText: string) {
  try {
    return JSON.parse(stripCodeFence(jsonText));
  } catch (error) {
    console.error("Failed to parse JSON from AI response:", jsonText, error);
    throw new Error("AI未能输出标准JSON格式数据，请切换模型或重试！");
  }
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function normalizeUniqueOptions(event: Partial<GameEvent>, fallbackRound: number): GameEvent {
  const seen = new Set<string>();
  const rawOptions = Array.isArray(event.options) ? event.options : [];
  const fallbackOptions = [
    { text: "召开全员降本大会，把会议室空调外包给两只电风扇并发行节能白皮书。", consequence: "财务小幅回暖，但员工开始用离职信折纸飞机" },
    { text: "宣布高风险资本跃迁，把所有预算砸向一台会喊口号的概念样机。", consequence: "完成度可能暴涨，但合规风险像火箭尾焰一样升空" },
    { text: "把锅转让给隔壁临时孵化器，用一份玄学并购协议重新包装责任主体。", consequence: "舆论短暂混乱，但后续追责链条变得更加魔幻" },
  ];

  const options = [...rawOptions, ...fallbackOptions]
    .filter((option) => option && typeof option.text === "string")
    .map((option) => ({
      text: option.text.trim(),
      consequence: (option.consequence || "后果尚未披露，但董事会已经开始冒汗").trim(),
    }))
    .filter((option) => {
      const key = `${option.text}|${option.consequence}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);

  while (options.length < 3) {
    options.push(fallbackOptions[options.length]);
  }

  return {
    id: event.id || `evt_${fallbackRound}`,
    roundNum: event.roundNum || fallbackRound,
    storySegment: event.storySegment || "公司董事会突然发现商业闭环缺少一个能解释亏损的高维概念，现场陷入庄严且昂贵的沉默。",
    options,
    newsHeadline: event.newsHeadline || "突发！某公司用战略沉默完成新一轮资本叙事升级",
    commentBox: event.commentBox || {
      source: "netizen",
      author: "路过的审计网友",
      text: "这已经不是商业模式了，这是商业玄学行为艺术。",
    },
    isClimax: Boolean(event.isClimax),
  };
}

async function requestJson(settings: ApiKeySettings, prompt: string) {
  const provider = resolveActiveProvider(settings);
  if (!provider) {
    throw new Error("请先在右上角【API设置】中填写 DeepSeek、MiniMax、GLM、Kimi 或 Gemini 的任意一个 API Key。未填写前不能开始游戏。");
  }

  const apiKey = settings.keys[provider.id].trim();

  if (provider.id === "gemini") {
    const response = await fetch(`${provider.endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: CONSTANT_SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `${provider.label} 调用失败`);
    const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "{}";
    return cleanAndParseJSON(text);
  }

  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: CONSTANT_SYSTEM_INSTRUCTION },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      response_format: { type: "json_object" },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || data.base_resp?.status_msg || `${provider.label} 调用失败`);
  const text = data.choices?.[0]?.message?.content || data.reply || data.output_text || "{}";
  return cleanAndParseJSON(text);
}

export async function analyzeBusinessPlan(settings: ApiKeySettings, targetGoal: string, planSummary: string) {
  const prompt = `
请解析以下玩家提交的离谱商业策划，并为他注册一家空壳公司、分析老板人格，并给出第 1 轮商业随机事件：
【玩家的宏伟目标】：${targetGoal}
【他的离谱实现规划】：${planSummary || "暂无具体方案，纯靠底气和自信！"}

请返回 JSON：
{
  "companyName": "6-12字公司名",
  "personality": "4字以内老板人格",
  "type": "核心商业领域",
  "hiddenThreat": "一句隐藏危机警言",
  "initialEvent": {
    "storySegment": "第1轮事件描述，100-150字",
    "options": [
      {"text": "疯狂高风险扩张方案", "consequence": "独特后果"},
      {"text": "敷衍降本增效方案", "consequence": "独特后果"},
      {"text": "跑路/转嫁责任方案", "consequence": "独特后果"}
    ],
    "newsHeadline": "搞笑热搜标题",
    "commentBox": {"source": "employee", "author": "技术部小张", "text": "搞笑吐槽"}
  }
}
重要：options 中 3 个 text 和 3 个 consequence 必须各不相同，不能同义复读。`;

  const data = await requestJson(settings, prompt);
  const initialEvent = normalizeUniqueOptions(data.initialEvent || {}, 1);
  initialEvent.id = "evt_1";
  initialEvent.roundNum = 1;
  initialEvent.isClimax = false;
  return { ...data, initialEvent };
}

export async function executeDecision(settings: ApiKeySettings, payload: {
  companyName: string;
  targetGoal: string;
  personality: string;
  roundNum: number;
  chosenOptionText: string;
  stats: CompanyStats;
  previousHistory: string[];
}) {
  const nextRoundNum = (payload.roundNum || 1) + 1;
  const isClimax = nextRoundNum === 5;
  const prompt = `
玩家公司【${payload.companyName}】（老板人格：${payload.personality}）正在追求：【${payload.targetGoal}】。
上一轮选择：【${payload.chosenOptionText}】。
当前状态：${JSON.stringify(payload.stats)}。
过去历史：${JSON.stringify(payload.previousHistory || [])}。

请计算决策后果并生成第 ${nextRoundNum} 轮${isClimax ? "高潮终局" : "商业风暴"}事件，返回 JSON：
{
  "consequenceFeedback": "100字左右讽刺总结",
  "financeChange": -15,
  "employeeChange": 10,
  "reputationChange": -5,
  "progressChange": 15,
  "riskChange": 20,
  "nextEvent": {
    "storySegment": "新事件描述约100字",
    "options": [
      {"text": "极端激进/疯狂选项", "consequence": "唯一后果"},
      {"text": "猥琐保命/省钱选项", "consequence": "唯一后果"},
      {"text": "金蝉脱壳/黑锅转让选项", "consequence": "唯一后果"}
    ],
    "newsHeadline": "热点新闻",
    "commentBox": {"source": "shareholder", "author": "华尔街韭菜", "text": "辣评"}
  }
}
重要：每个问题的三个选项必须是不同答案，行动、风险、后果都不能一样。`;

  const data = await requestJson(settings, prompt);
  const newStats: CompanyStats = {
    finance: clampScore(payload.stats.finance + Number(data.financeChange || 0)),
    employee: clampScore(payload.stats.employee + Number(data.employeeChange || 0)),
    reputation: clampScore(payload.stats.reputation + Number(data.reputationChange || 0)),
    progress: clampScore(payload.stats.progress + Number(data.progressChange || 0)),
    risk: clampScore(payload.stats.risk + Number(data.riskChange || 0)),
  };

  let isGameOver = false;
  let gameOverReason: "finance_ruin" | "strike" | "pr_disaster" | "jailed" | "completed" | undefined;
  if (newStats.finance <= 0) {
    isGameOver = true;
    gameOverReason = "finance_ruin";
  } else if (newStats.employee <= 0) {
    isGameOver = true;
    gameOverReason = "strike";
  } else if (newStats.reputation <= 0) {
    isGameOver = true;
    gameOverReason = "pr_disaster";
  } else if (newStats.risk >= 100) {
    isGameOver = true;
    gameOverReason = "jailed";
  } else if (newStats.progress >= 100 || nextRoundNum > 5) {
    isGameOver = true;
    gameOverReason = "completed";
  }

  return {
    stats: newStats,
    consequenceFeedback: data.consequenceFeedback || "董事会用三层PPT确认：你的操作已经成功把问题升级为跨部门灾难。",
    nextEvent: isGameOver ? null : normalizeUniqueOptions({ ...(data.nextEvent || {}), id: `evt_${nextRoundNum}`, roundNum: nextRoundNum, isClimax }, nextRoundNum),
    isGameOver,
    gameOverReason,
  };
}

export async function settleGame(settings: ApiKeySettings, payload: {
  companyName: string;
  targetGoal: string;
  personality: string;
  stats: CompanyStats;
  history: Array<{ roundNum: number; story: string; chosenOption: string; feedback: string }>;
  gameOverReason: string;
}) {
  const prompt = `
请为“一分钟老板执政局”进行最终清算：
公司：${payload.companyName}
老板风格：${payload.personality}
宏愿：${payload.targetGoal}
终局数据：${JSON.stringify(payload.stats)}
终结原因：${payload.gameOverReason}
游戏抉择：${JSON.stringify(payload.history || [])}

返回 JSON：
{
  "title": "搞笑终极称号",
  "grade": "A+|A|B|C|D|F",
  "summary": "150-200字荒诞年度执政报告",
  "achievements": ["4-8字成就一", "4-8字成就二", "4-8字成就三"],
  "suggestedChallenge": "下局推荐",
  "shareMarkdown": "可复制分享文案"
}`;

  return requestJson(settings, prompt);
}
