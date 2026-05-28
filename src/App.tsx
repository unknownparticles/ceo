/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Briefcase, 
  Coins, 
  Users, 
  Globe, 
  TrendingUp, 
  AlertTriangle, 
  Play, 
  HelpCircle, 
  Sparkles, 
  RefreshCw, 
  Award, 
  Share2, 
  BookOpen, 
  ChevronRight, 
  CheckCircle, 
  Flame, 
  Hourglass, 
  Newspaper,
  Terminal,
  Volume2,
  VolumeX,
  History,
  Trash2,
  Settings
} from "lucide-react";
import { CompanyStats, GameEvent, GameSetup, GameSettlement, HistoryItem } from "./types";
import { PRESET_GOALS, FUN_LOADING_MESSAGES } from "./data";
import { playSound } from "./utils/audio";
import { AI_PROVIDERS, ApiKeySettings, analyzeBusinessPlan, emptyApiKeySettings, executeDecision, getProviderLabel, loadApiKeySettings, resolveActiveProvider, saveApiKeySettings, settleGame } from "./ai";

export default function App() {
  // Game screens: 'intro' | 'loading' | 'playing' | 'settlement'
  const [screen, setScreen] = useState<'intro' | 'loading' | 'playing' | 'settlement'>('intro');
  
  // In-app premium modal dialog replacement for window.alert
  const [activeModal, setActiveModal] = useState<{
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'error' | 'success';
  } | null>(null);

  const showAlert = (message: string, title = "企业内务提示", type: 'info' | 'warning' | 'error' | 'success' = "warning") => {
    setActiveModal({ title, message, type });
  };

  // Game volume configuration
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Setup inputs
  const [customGoal, setCustomGoal] = useState("");
  const [customPlan, setCustomPlan] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Active game session state
  const [setup, setSetup] = useState<GameSetup | null>(null);
  const [stats, setStats] = useState<CompanyStats>({
    finance: 60,
    employee: 60,
    reputation: 60,
    progress: 10,
    risk: 15
  });
  const [statsHistory, setStatsHistory] = useState<CompanyStats[]>([{
    finance: 60,
    employee: 60,
    reputation: 60,
    progress: 10,
    risk: 15
  }]);
  
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null);
  const [roundHistory, setRoundHistory] = useState<Array<{
    roundNum: number;
    story: string;
    chosenOption: string;
    feedback: string;
  }>>([]);
  
  const [latestFeedback, setLatestFeedback] = useState<string | null>(null);
  const [latestDeltas, setLatestDeltas] = useState<{
    finance: number;
    employee: number;
    reputation: number;
    progress: number;
    risk: number;
  } | null>(null);

  // Overall 60-second ticker & round specific timers
  const [totalSecondsLeft, setTotalSecondsLeft] = useState(60);
  const [roundSecondsLeft, setRoundSecondsLeft] = useState(12);

  // Settlement results back from Server API
  const [settlement, setSettlement] = useState<GameSettlement | null>(null);
  const [isFinishingSettle, setIsFinishingSettle] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Play records history (Stored in LocalStorage)
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [apiSettings, setApiSettings] = useState<ApiKeySettings>(() => emptyApiKeySettings());

  // Rotation text loader
  const [currentLoaderText, setCurrentLoaderText] = useState(FUN_LOADING_MESSAGES[0]);

  // Alert threshold states for warning sound effects & glowing alerts
  const isFinanceLow = stats.finance < 25;
  const isEmployeeLow = stats.employee < 25;
  const isReputationLow = stats.reputation < 25;
  const isRiskHigh = stats.risk > 75;

  // Audio helper
  const triggerSound = (type: 'success' | 'failure' | 'click' | 'tick' | 'startup') => {
    if (!soundEnabled) return;
    if (type === 'success') playSound.success();
    if (type === 'failure') playSound.failure();
    if (type === 'click') playSound.click();
    if (type === 'tick') playSound.tick();
    if (type === 'startup') playSound.startupFanfare();
  };

  // On mount: read previous histories
  useEffect(() => {
    try {
      const stored = localStorage.getItem("one_min_boss_history");
      if (stored) {
        setHistoryList(JSON.parse(stored));
      }
      setApiSettings(loadApiKeySettings());
    } catch (e) {
      console.error(e);
    }
  }, []);


  useEffect(() => {
    saveApiKeySettings(apiSettings);
  }, [apiSettings]);

  const updateApiKey = (providerId: keyof ApiKeySettings["keys"], value: string) => {
    setApiSettings(prev => ({
      ...prev,
      keys: {
        ...prev.keys,
        [providerId]: value
      }
    }));
  };

  const activeAiProvider = resolveActiveProvider(apiSettings);

  // Set default initial goal text
  useEffect(() => {
    if (PRESET_GOALS.length > 0) {
      loadPreset(PRESET_GOALS[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer intervals for gameplay mode
  useEffect(() => {
    if (screen !== 'playing') return;

    const gameInterval = setInterval(() => {
      setTotalSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(gameInterval);
          // Force Timeout Game Over
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });

      setRoundSecondsLeft(prev => {
        if (prev <= 1) {
          // Play tick or warning sound
          triggerSound('tick');
          // Auto select a random choice when current timer expires
          autoChooseOnTimeout();
          return 12;
        }
        // Play tick sound when timer is very low
        if (prev <= 4) {
          triggerSound('tick');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(gameInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, currentEvent]);

  // Loading rotation text interval
  useEffect(() => {
    if (screen !== 'loading') return;
    let idx = 0;
    const loadInterval = setInterval(() => {
      idx = (idx + 1) % FUN_LOADING_MESSAGES.length;
      setCurrentLoaderText(FUN_LOADING_MESSAGES[idx]);
    }, 1800);
    return () => clearInterval(loadInterval);
  }, [screen]);

  const loadPreset = (preset: typeof PRESET_GOALS[0]) => {
    triggerSound('click');
    setCustomGoal(preset.targetGoal);
    setCustomPlan(preset.planSummary);
    setActivePresetId(preset.id);
  };

  const randomizeGoal = () => {
    triggerSound('click');
    const randomIndex = Math.floor(Math.random() * PRESET_GOALS.length);
    const randomized = PRESET_GOALS[randomIndex];
    setCustomGoal(randomized.targetGoal);
    setCustomPlan(randomized.planSummary);
    setActivePresetId(randomized.id);
  };

  const clearPresets = () => {
    triggerSound('click');
    setCustomGoal("");
    setCustomPlan("");
    setActivePresetId(null);
  };

  // Launch analysis
  const startBusinessSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoal.trim()) {
      showAlert("请输入你的荒诞商业目标！这是伟业的起点！", "策划审核未通过", "warning");
      return;
    }

    if (!resolveActiveProvider(apiSettings)) {
      showAlert("开始游戏前必须至少填写 DeepSeek、MiniMax、GLM、Kimi、Gemini 中任意一个 API Key。系统会默认调用第一个有值的供应商，也可以在设置里手动切换。", "请先配置API设置", "warning");
      setShowSettingsPanel(true);
      return;
    }

    triggerSound('startup');
    setScreen('loading');
    setLatestFeedback(null);
    setLatestDeltas(null);
    setRoundHistory([]);
    setTotalSecondsLeft(60);
    setRoundSecondsLeft(12);
    setStats({
      finance: 60,
      employee: 60,
      reputation: 60,
      progress: 10,
      risk: 15
    });
    setStatsHistory([{
      finance: 60,
      employee: 60,
      reputation: 60,
      progress: 10,
      risk: 15
    }]);

    try {
      const data = await analyzeBusinessPlan(apiSettings, customGoal, customPlan);

      setSetup({
        companyName: data.companyName,
        targetGoal: customGoal,
        planSummary: customPlan || "纯靠口号和老板个人直觉",
        personality: data.personality,
        type: data.type,
        hiddenThreat: data.hiddenThreat,
        initialEvent: data.initialEvent
      });
      setCurrentEvent(data.initialEvent);
      setScreen('playing');
    } catch (err: any) {
      showAlert(err.message || "连接AI顾问失败，难道被工商局查封了？请重试！", "智能推演故障", "error");
      setScreen('intro');
    }
  };

  // Make a decision
  const handleOptionSelect = async (chosenOption: string, optionTeaser: string) => {
    if (!setup || !currentEvent) return;
    triggerSound('click');

    // Display temporary loading block
    setRoundSecondsLeft(12); // reset timer
    
    const previousHistorySimp = roundHistory.map(h => `第${h.roundNum}轮事件: ${h.story}。玩家选择了: ${h.chosenOption}. 结果是: ${h.feedback}`);
    
    // Lock screen slightly / optimistic loading
    const payload = {
      companyName: setup.companyName,
      targetGoal: setup.targetGoal,
      personality: setup.personality,
      roundNum: currentEvent.roundNum,
      chosenOptionText: chosenOption,
      stats: stats,
      previousHistory: previousHistorySimp
    };

    try {
      const data = await executeDecision(apiSettings, payload);

      // Track statistic deltas relative to previous stats
      const diffFinance = data.stats.finance - stats.finance;
      const diffEmployee = data.stats.employee - stats.employee;
      const diffReputation = data.stats.reputation - stats.reputation;
      const diffProgress = data.stats.progress - stats.progress;
      const diffRisk = data.stats.risk - stats.risk;

      setLatestDeltas({
        finance: diffFinance,
        employee: diffEmployee,
        reputation: diffReputation,
        progress: diffProgress,
        risk: diffRisk
      });

      setStats(data.stats);
      setStatsHistory(prev => [...prev, data.stats]);
      setLatestFeedback(data.consequenceFeedback);
      
      // Play dynamic sound depending on whether state is deteriorating
      if (diffFinance < 0 || diffReputation < 0 || diffEmployee < 0 || diffRisk > 15) {
        triggerSound('failure');
      } else {
        triggerSound('success');
      }

      // Save history summary
      const updatedHistory = [
        ...roundHistory,
        {
          roundNum: currentEvent.roundNum,
          story: currentEvent.storySegment,
          chosenOption: chosenOption,
          feedback: data.consequenceFeedback
        }
      ];
      setRoundHistory(updatedHistory);

      if (data.isGameOver || !data.nextEvent) {
        // Trigger settlement sequence
        triggerSettleSequence(data.stats, updatedHistory, data.gameOverReason || "completed");
      } else {
        setCurrentEvent(data.nextEvent);
      }
    } catch (err: any) {
      showAlert(err.message || "推演网络卡顿，请重试选项！", "决策执行受阻", "error");
    }
  };

  // Automatically select a random option on timer exhaustion
  const autoChooseOnTimeout = () => {
    if (!currentEvent) return;
    const randomIndex = Math.floor(Math.random() * currentEvent.options.length);
    const fallbackOption = currentEvent.options[randomIndex];
    handleOptionSelect(fallbackOption.text, fallbackOption.consequence);
  };

  // Timeout failure
  const handleTimeOut = () => {
    triggerSound('failure');
    triggerSettleSequence(stats, roundHistory, "timeout");
  };

  // Settle Sequence API Request
  const triggerSettleSequence = async (finalStats: CompanyStats, finalHistory: typeof roundHistory, reason: string) => {
    if (!setup) return;
    setIsFinishingSettle(true);
    setScreen('loading');
    setCurrentLoaderText("召开董事会紧急弹劾会议 / 准备PPT分红大会中...");

    try {
      const data = await settleGame(apiSettings, {
        companyName: setup.companyName,
        targetGoal: setup.targetGoal,
        personality: setup.personality,
        stats: finalStats,
        history: finalHistory,
        gameOverReason: reason
      });

      setSettlement({
        ...data,
        finalStats: finalStats,
        statsHistory: statsHistory
      });

      // Save to localStorage history
      const newHistoryItem: HistoryItem = {
        id: `hist_${Date.now()}`,
        companyName: setup.companyName,
        targetGoal: setup.targetGoal,
        title: data.title,
        grade: data.grade,
        timestamp: new Date().toLocaleDateString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }),
        outcomeSummary: data.summary
      };

      const updatedHistoryList = [newHistoryItem, ...historyList].slice(0, 30); // limit to 30 histories
      setHistoryList(updatedHistoryList);
      localStorage.setItem("one_min_boss_history", JSON.stringify(updatedHistoryList));

      setIsFinishingSettle(false);
      setScreen('settlement');
      triggerSound('success');
    } catch (err: any) {
      showAlert(err.message || "清算系统崩溃，难道你卷款跑路成功了？请重试！", "审计系统清盘错误", "error");
      setIsFinishingSettle(false);
      setScreen('intro');
    }
  };

  const copyShareText = () => {
    if (!settlement) return;
    try {
      navigator.clipboard.writeText(settlement.shareMarkdown);
      setCopiedText(true);
      triggerSound('success');
      setTimeout(() => setCopiedText(false), 2000);
    } catch (e) {
      showAlert("您的浏览器不支持一键复制，请手动截屏分享！", "剪贴板授权失败", "info");
    }
  };

  const deleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = historyList.filter(h => h.id !== id);
    setHistoryList(updated);
    localStorage.setItem("one_min_boss_history", JSON.stringify(updated));
  };

  const loadPastGameDetails = (item: HistoryItem) => {
    showAlert(
      `评级: ${item.grade}\n成就称号: ${item.title}\n\n执行汇报: ${item.outcomeSummary}`,
      `【${item.companyName}の历史遗失解密档案】`,
      "success"
    );
  };

  // Re-start another simulation round
  const restartRun = () => {
    triggerSound('startup');
    setScreen('intro');
    setSetup(null);
    setCurrentEvent(null);
    setSettlement(null);
    setRoundHistory([]);
    setTotalSecondsLeft(60);
    setRoundSecondsLeft(12);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Visual background lights for serious cyberpunk look but with clean layout */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-rose-950/10 rounded-full blur-3xl pointer-events-none" />

      {/* Corporate Header Bar resembling high-end trading systems */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-20" id="main_header">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500 text-slate-950 p-1.5 rounded font-mono font-bold text-xs tracking-wider flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Briefcase className="w-4 h-4 mr-1" />
            <span>BOSS</span>
          </div>
          <div>
            <h1 className="text-sm md:text-base font-display font-bold text-slate-100 tracking-wider flex items-center">
              一分钟老板 <span className="text-emerald-400 ml-1 text-xs font-mono uppercase bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/60 font-medium">ONE MINUTE BOSS</span>
            </h1>
            <p className="text-[10px] text-slate-400 hidden md:block">企业模拟推演与高危商业资本流变核心系统 v2.5</p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center space-x-2 md:space-x-3">
          <button
            onClick={() => {
              triggerSound('click');
              setShowSettingsPanel(!showSettingsPanel);
            }}
            className={`p-2 rounded border transition text-xs flex items-center ${
              activeAiProvider ? "border-cyan-800 text-cyan-300 bg-cyan-950/20" : "border-rose-800 text-rose-300 bg-rose-950/20 animate-pulse"
            }`}
            title="API设置"
          >
            <Settings className="w-4 h-4" />
            <span className="ml-1 hidden md:inline">API：{activeAiProvider ? getProviderLabel(activeAiProvider.id) : "未配置"}</span>
          </button>

          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded border transition text-xs flex items-center ${
              soundEnabled ? "border-emerald-800 text-emerald-400 bg-emerald-950/20" : "border-slate-800 text-slate-500 hover:text-slate-400"
            }`}
            title={soundEnabled ? "静音" : "开启音效"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="ml-1 hidden md:inline">{soundEnabled ? "音效开" : "静音"}</span>
          </button>

          <button 
            onClick={() => {
              triggerSound('click');
              setShowHistorySidebar(!showHistorySidebar);
            }}
            className="p-2 rounded border border-slate-800 hover:border-slate-700 hover:bg-slate-800 transition text-xs flex items-center text-slate-300"
          >
            <History className="w-4 h-4" />
            <span className="ml-1 hidden sm:inline">执政履历 ({historyList.length})</span>
          </button>
        </div>
      </header>

      {showSettingsPanel && (
        <div className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center p-4 pt-20" onClick={() => setShowSettingsPanel(false)}>
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-display font-bold text-slate-100 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-cyan-300" />
                  API 设置 / GitHub Pages 静态版
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  所有 Key 仅保存在当前浏览器 LocalStorage 中。开始游戏前必须至少填写一个 Key；自动模式会按 DeepSeek → MiniMax → GLM → Kimi → Gemini 的顺序调用第一个有值的供应商。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsPanel(false)}
                className="text-slate-500 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-1 text-xs font-mono"
              >
                关闭
              </button>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 mb-4">
              <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">当前调用供应商</label>
              <select
                value={apiSettings.activeProviderId}
                onChange={(e) => setApiSettings(prev => ({ ...prev, activeProviderId: e.target.value as ApiKeySettings["activeProviderId"] }))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
              >
                <option value="auto">自动选择第一个有值的 Key（推荐）</option>
                {AI_PROVIDERS.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}{apiSettings.keys[provider.id]?.trim() ? " · 已填写" : " · 未填写"}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-2 font-mono">
                实际将调用：<span className={activeAiProvider ? "text-cyan-300" : "text-rose-300"}>{activeAiProvider ? getProviderLabel(activeAiProvider.id) : "尚未配置任何 Key"}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AI_PROVIDERS.map(provider => (
                <div key={provider.id} className="bg-slate-950/45 border border-slate-800 rounded-xl p-3">
                  <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
                    <span>{provider.label}</span>
                    <span className="text-[10px] text-slate-500">{provider.model}</span>
                  </label>
                  <input
                    type="password"
                    value={apiSettings.keys[provider.id]}
                    onChange={(e) => updateApiKey(provider.id, e.target.value)}
                    placeholder={provider.apiKeyHelp}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none"
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-[11px] text-slate-500 font-mono">
              <span>提示：如果某供应商浏览器跨域受限，请切换到其他支持 Web 调用的供应商。</span>
              <button
                type="button"
                onClick={() => {
                  setApiSettings(emptyApiKeySettings());
                  triggerSound('click');
                }}
                className="text-rose-300 hover:text-rose-200 border border-rose-900/60 hover:border-rose-700 rounded-lg px-3 py-2"
              >
                清空全部 Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-start max-w-7xl w-full mx-auto p-4 md:p-6 relative z-10">
        
        {/* ==================== 1. INTRO SCREEN ==================== */}
        {screen === 'intro' && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-2" id="intro_dashboard">
            
            {/* Left Big Panel: Form / Setup */}
            <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-5 md:p-7 shadow-2xl backdrop-blur-md" id="setup_form_panel">
              <div className="mb-6">
                <span className="text-[10px] uppercase font-mono font-semibold tracking-widest text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded border border-emerald-900/60">
                  ⚡ 给你60秒，暴富或坐牢
                </span>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-50 mt-3 tracking-tight">
                  写下你最疯狂、最离谱的商业幻想！
                </h2>
                <p className="text-slate-400 text-xs md:text-sm mt-2 leading-relaxed">
                  你将拥有60秒，通过一系列由AI商界导演用严密严肃的高维商业逻辑解构的荒唐决策事件。你要在这场资本狂乱的蝴蝶效应中带领船员通向不可思议的奇迹，或者优雅破产离场！
                </p>
              </div>

              <form onSubmit={startBusinessSimulation} className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">
                      🎯 公司宏伟商业目标
                    </label>
                    <span className="text-[10.5px] text-slate-500 font-mono">必填 · 企业愿景</span>
                  </div>
                  <input 
                    type="text"
                    required
                    maxLength={100}
                    value={customGoal}
                    onChange={(e) => {
                      setCustomGoal(e.target.value);
                      if (activePresetId) setActivePresetId(null);
                    }}
                    placeholder="例如：用一家全天候太空奶茶统治火星的二氧化碳排碳税"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-3 text-slate-200 text-sm placeholder-slate-600 transition outline-none block"
                    id="input_target_goal"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">
                      🛠️ 离谱实现方案与路径（选填）
                    </label>
                    <span className="text-[10.5px] text-slate-500 font-mono">写得越荒唐，结果越奇葩</span>
                  </div>
                  <textarea 
                    rows={3}
                    maxLength={300}
                    value={customPlan}
                    onChange={(e) => {
                      setCustomPlan(e.target.value);
                      if (activePresetId) setActivePresetId(null);
                    }}
                    placeholder="例如：强制所有火星飞船将发动机椰子汁化、用高能珍珠当作外壳物理防御陨石，用广场舞大妈歌声给变轨续航..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-3 text-slate-200 text-sm placeholder-slate-600 transition outline-none block resize-none"
                    id="input_plan_summary"
                  />
                </div>

                <div className="pt-2 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={randomizeGoal}
                    className="flex-1 min-w-[120px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-lg text-xs font-medium font-mono border border-slate-700 hover:border-slate-600 transition flex items-center justify-center space-x-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>随机脑洞大开</span>
                  </button>

                  {customGoal && (
                    <button
                      type="button"
                      onClick={clearPresets}
                      className="bg-slate-950 hover:bg-slate-900 text-slate-400 px-3 py-3 rounded-lg text-xs font-mono border border-slate-800 hover:border-slate-700 transition"
                      title="重置"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="submit"
                    className="flex-[2] min-w-[200px] bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 text-slate-950 px-5 py-3 rounded-lg text-xs font-bold font-mono tracking-wider transition shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 border-t border-emerald-300"
                  >
                    <Play className="w-4.5 h-4.5 fill-current" />
                    <span>疯狂创业 · 一分钟拯救公司</span>
                  </button>
                </div>
              </form>

              {/* Technical disclaimer */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span className="flex items-center text-emerald-500/80">
                  <Terminal className="w-3.5 h-3.5 mr-1" />
                  AI 严肃现实主义引擎：{activeAiProvider ? getProviderLabel(activeAiProvider.id) : "待配置"}
                </span>
                <span>响应速度：&lt;3.5秒</span>
              </div>
            </div>

            {/* Right Panel: Preloaded Presets List */}
            <div className="lg:col-span-5 flex flex-col space-y-4" id="presets_panel">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md">
                <div className="flex items-center space-x-2 mb-4">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-mono font-bold text-slate-200 tracking-wider">今日特邀离谱商业企划案</h3>
                </div>

                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1" id="preset_list_container">
                  {PRESET_GOALS.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => loadPreset(preset)}
                        className={`p-3.5 rounded-lg border cursor-pointer transition text-left group ${
                          isActive
                            ? "bg-slate-800/85 border-emerald-500 text-slate-100"
                            : "bg-slate-950/45 border-slate-800/80 hover:bg-slate-900/40 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                            preset.riskRating === "稳健型" 
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60" 
                              : preset.riskRating === "狂暴型" 
                              ? "bg-amber-950/40 text-amber-400 border-amber-900/60" 
                              : "bg-rose-950/40 text-rose-400 border-rose-900/60"
                          }`}>
                            {preset.badge} · {preset.riskRating}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono italic group-hover:text-emerald-400 transition flex items-center">
                            一键拉载 <ChevronRight className="w-3 h-3 ml-0.5" />
                          </span>
                        </div>
                        <h4 className="text-xs font-mono font-bold text-slate-200 group-hover:text-amber-400 transition">
                          {preset.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed truncate-2-lines">
                          {preset.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Instructions Callout Box */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex items-start space-x-3 text-xs text-slate-400 leading-relaxed font-mono">
                <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-200 font-semibold mb-1">🎮 商业规则简述</p>
                  <p>1. 60秒大盘倒计时，每步限时12秒，无决策则随机判定执行。</p>
                  <p className="mt-1">2. 监控右侧核心资本审计盘。任意极化状态（如财务赤字、员工大罢工、极高被捕指数）或倒计时清零都将触发悲壮而荒诞的资本清盘！</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ==================== 2. LOADING SPIN SCREEN ==================== */}
        {screen === 'loading' && (
          <div className="w-full max-w-md py-16 flex flex-col items-center justify-center text-center space-y-6 bg-slate-900/55 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-lg my-12" id="loading_terminal">
            
            {/* Spinning stylized gear indicator */}
            <div className="relative flex items-center justify-center w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
              <div className="absolute w-12 h-12 rounded-full border-4 border-transparent border-t-amber-400 border-b-amber-400 animate-spin duration-75" />
              <Briefcase className="w-6 h-6 text-slate-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-mono font-bold text-slate-200 tracking-widest animate-pulse uppercase">
                {isFinishingSettle ? "💼 CORPORATE AUDITING..." : "🛸 AI PROPOSING WORLD..."}
              </h3>
              <div className="h-6 flex items-center justify-center">
                <p className="text-xs text-slate-400 font-mono italic px-4 py-1 bg-slate-950/40 rounded border border-slate-800/60 select-all font-light">
                  {currentLoaderText}
                </p>
              </div>
            </div>

            <div className="w-full bg-slate-950 h-2 border border-slate-800 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-amber-500 h-full w-[70%] animate-[pulse_2s_infinite]" />
            </div>

            <p className="text-[10px] text-slate-500 font-mono tracking-tighter">
              系统正在使用 GPT-Advisory 模型解构您的不可观测商业行为...
            </p>
          </div>
        )}

        {/* ==================== 3. GAMEPLAY SCREEN ==================== */}
        {screen === 'playing' && (
          <div className="w-full flex flex-col space-y-5" id="gameplay_container">
            
            {/* Top Status Indicators (Company Header + Universal Tickers) */}
            <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center space-x-3.5 self-start md:self-auto">
                <div className="h-10 w-10 bg-gradient-to-tr from-amber-600 to-rose-500 rounded-lg flex items-center justify-center shadow-md font-mono text-slate-950 font-black text-sm uppercase">
                  {(setup?.personality || "BOSS").slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-display font-bold text-slate-100 tracking-wide">
                      {setup?.companyName}
                    </h2>
                    <span className="text-[10px] font-mono bg-violet-950 text-violet-300 border border-violet-800 px-2 py-0.5 rounded font-medium">
                      {setup?.personality}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate max-w-sm md:max-w-xl">
                    🎯 商业使命：{setup?.targetGoal}
                  </p>
                </div>
              </div>

              {/* Ticking Timers block */}
              <div className="flex items-center space-x-4 w-full md:w-auto justify-end border-t border-slate-850 pt-3 md:pt-0 md:border-0">
                
                {/* Step Limit Timer */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-1.5 flex items-center space-x-2 text-right">
                  <div className="leading-3">
                    <span className="text-[9px] font-mono text-slate-500 block">回合思考</span>
                    <span className={`text-sm font-mono font-bold tracking-tight ${roundSecondsLeft <= 4 ? "text-rose-500 animate-pulse" : "text-amber-400"}`}>
                      {roundSecondsLeft} 秒
                    </span>
                  </div>
                  <Hourglass className={`w-4 h-4 ${roundSecondsLeft <= 4 ? "text-rose-500 animate-spin" : "text-amber-400"}`} />
                </div>

                {/* Total Tenure clock */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-1.5 flex items-center space-x-2 text-right">
                  <div className="leading-3">
                    <span className="text-[9px] font-mono text-slate-500 block">大盘崩溃倒计时</span>
                    <span className={`text-sm font-mono font-bold tracking-tight ${totalSecondsLeft <= 15 ? "text-rose-500 animate-pulse" : "text-emerald-400"}`}>
                      {totalSecondsLeft} 秒
                    </span>
                  </div>
                  <Flame className={`w-4 h-4 ${totalSecondsLeft <= 15 ? "text-rose-500 animate-bounce" : "text-emerald-400"}`} />
                </div>

              </div>
            </div>

            {/* Main Game Grid: Left Event Chronicle, Right capital audit Panel */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* LEFT COLUMN: Narrative flow & options (Total 7 cols) */}
              <div className="lg:col-span-7 flex flex-col space-y-4" id="chronicle_column">
                
                {/* Preceding Action Impact Banner (if exists) */}
                {latestFeedback && (
                  <div className="bg-slate-900 border-l-4 border-amber-500 text-slate-200 p-4 rounded-r-xl shadow-lg relative overflow-hidden animate-fade-in">
                    <div className="absolute top-1 right-2 font-mono text-[9px] text-slate-600">PREVIOUS IMPACT</div>
                    <h4 className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center" id="previous_feedback_label">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      上一轮决策执行纪要：
                    </h4>
                    <p className="text-xs text-slate-300 font-mono leading-relaxed" id="previous_feedback_text">
                      {latestFeedback}
                    </p>

                    {/* Numeric deltas display with arrows */}
                    {latestDeltas && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-x-3 gap-y-1.5 text-[10.5px] font-mono text-slate-400">
                        {latestDeltas.finance !== 0 && (
                          <span className={latestDeltas.finance > 0 ? "text-emerald-400" : "text-rose-500"}>
                            财务资金 {latestDeltas.finance > 0 ? `+${latestDeltas.finance}` : latestDeltas.finance}%
                          </span>
                        )}
                        {latestDeltas.employee !== 0 && (
                          <span className={latestDeltas.employee > 0 ? "text-emerald-400" : "text-rose-500"}>
                            员工支持 {latestDeltas.employee > 0 ? `+${latestDeltas.employee}` : latestDeltas.employee}%
                          </span>
                        )}
                        {latestDeltas.reputation !== 0 && (
                          <span className={latestDeltas.reputation > 0 ? "text-emerald-400" : "text-rose-500"}>
                            社会舆论 {latestDeltas.reputation > 0 ? `+${latestDeltas.reputation}` : latestDeltas.reputation}%
                          </span>
                        )}
                        {latestDeltas.progress !== 0 && (
                          <span className={latestDeltas.progress > 0 ? "text-indigo-400" : "text-rose-500"}>
                            目标大胜 {latestDeltas.progress > 0 ? `+${latestDeltas.progress}` : latestDeltas.progress}%
                          </span>
                        )}
                        {latestDeltas.risk !== 0 && (
                          <span className={latestDeltas.risk > 0 ? "text-amber-500" : "text-emerald-400"}>
                            合规风险 {latestDeltas.risk > 0 ? `+${latestDeltas.risk}` : latestDeltas.risk}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Primary Narrative Event Card */}
                {currentEvent && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-2xl relative overflow-hidden" id="current_event_card">
                    
                    {/* Climax Visual Warning Grid */}
                    {currentEvent.isClimax && (
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
                    )}

                    {/* Top status bar describing round progression */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          currentEvent.isClimax 
                            ? "bg-rose-950 font-bold text-rose-400 border-rose-800 animate-pulse" 
                            : "bg-slate-950 text-slate-400 border-slate-850"
                        }`}>
                          {currentEvent.isClimax ? "🔥 终局暴风·高潮降临" : `⏱️ 商业博弈 第 ${currentEvent.roundNum} 阶段`}
                        </span>
                        {currentEvent.newsHeadline && (
                          <span className="text-slate-600 hidden md:inline">|</span>
                        )}
                        <span className="text-slate-400 text-xs truncate max-w-xs font-mono hidden md:inline">
                          运营风险代偿评级
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {currentEvent.roundNum}/5 回合
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Story prompt text from AI */}
                      <div>
                        <h3 className="text-slate-100 text-xs uppercase tracking-widest font-semibold font-mono text-emerald-400/80 mb-1.5">
                          💼 随机商业事件爆发
                        </h3>
                        <p className="text-sm md:text-base text-slate-200 leading-relaxed font-sans" id="event_story_segment">
                          {currentEvent.storySegment}
                        </p>
                      </div>

                      {/* Simulated PR Hotline Strip */}
                      {currentEvent.newsHeadline && (
                        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 flex items-center space-x-2.5 shadow-inner">
                          <Newspaper className="w-5 h-5 text-amber-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-mono font-bold tracking-widest text-amber-500 block uppercase">
                              🔥 PR 热搜快报 / 舆论舆情风暴
                            </span>
                            <p className="text-xs text-slate-300 truncate font-mono italic" id="event_news_headline">
                              “{currentEvent.newsHeadline}”
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Internal/External Comment box */}
                      {currentEvent.commentBox && (
                        <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-2.5 flex items-center justify-between text-[11px] font-mono">
                          <div className="text-slate-400">
                            <span className="font-semibold text-slate-300">
                              @{currentEvent.commentBox.author}
                            </span> 
                            <span className="text-slate-500 mx-1">({
                              currentEvent.commentBox.source === 'employee' ? '内部员工' :
                              currentEvent.commentBox.source === 'shareholder' ? '骨灰级股东' :
                              currentEvent.commentBox.source === 'netizen' ? '吃瓜网民' : '商业死敌'
                            })</span>：
                            <span className="text-slate-300 font-light italic">“{currentEvent.commentBox.text}”</span>
                          </div>
                          <span className="indicator inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping shrink-0 ml-1" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* DECISION BUTTONS BOARD (Options A, B, C) */}
                {currentEvent && (
                  <div className="space-y-2.5" id="decision_button_container">
                    <span className="text-[10px] font-mono uppercase font-semibold text-slate-500 tracking-wider block mb-1">
                      👇 请在倒计时结束前做出执政决断（选项）：
                    </span>

                    {currentEvent.options.map((option, index) => {
                      const optAbc = ["A", "B", "C"][index];
                      return (
                        <button
                          key={index}
                          onClick={() => handleOptionSelect(option.text, option.consequence)}
                          className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700/80 active:translate-y-0.5 rounded-xl p-4 text-left font-mono transition group relative overflow-hidden flex items-start space-x-3.5 focus:outline-none"
                        >
                          {/* Option Prefix Letter badge */}
                          <div className="h-7 w-7 rounded bg-slate-950 border border-slate-800 text-amber-400 group-hover:text-slate-950 group-hover:bg-amber-400 font-bold flex items-center justify-center shrink-0 transition text-sm">
                            {optAbc}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-200 group-hover:text-slate-50 font-sans leading-relaxed font-semibold">
                              {option.text}
                            </p>
                            <span className="text-[10.5px] text-slate-500 font-light block mt-1 leading-normal italic text-slate-400 truncate-2-lines">
                              🎯 潜在代偿后果：{option.consequence}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* RIGHT COLUMN: Capital audit panel, financial indicators, real-time gauges (Total 5 cols) */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-5 sticky top-20" id="audit_column">
                
                <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-widest">
                      企业实时间谍大盘
                    </h3>
                  </div>
                  <span className="text-[10px] uppercase font-mono text-slate-500">
                    REALTIME TELEMETRY
                  </span>
                </div>

                {/* Audit state parameters */}
                <div className="space-y-4">
                  
                  {/* Gauge 1: FINANCE FUNDS (财务状况) */}
                  <div className="bg-slate-950/80 border border-slate-850 rounded-lg p-3 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <Coins className={`w-4 .h-4 ${isFinanceLow ? "text-rose-500 animate-bounce" : "text-emerald-400"}`} />
                        <span className="text-xs font-mono font-semibold text-slate-300">
                          财务可用盈余 (Finance)
                        </span>
                      </div>
                      <span className={`text-sm font-mono font-bold ${
                        isFinanceLow ? "text-rose-500 glow-red animate-pulse" : stats.finance > 70 ? "text-emerald-400 glow-green" : "text-amber-400"
                      }`}>
                        ${stats.finance} / 100 万
                      </span>
                    </div>
                    {/* Raw Slider */}
                    <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFinanceLow ? "bg-rose-500 animate-pulse" : stats.finance > 70 ? "bg-emerald-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${stats.finance}%` }}
                      />
                    </div>
                    {/* Status hint text */}
                    <span className="text-[9.5px] font-mono text-slate-500 block mt-1">
                      {isFinanceLow ? "⚠️ 现金流严重穿透，濒临无偿负债暴死！" : "🟢 资本底盘良好，开支可以继续狂野运作。"}
                    </span>
                  </div>

                  {/* Gauge 2: EMPLOYEE LOYALTY (员工满意度) */}
                  <div className="bg-slate-950/80 border border-slate-850 rounded-lg p-3 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <Users className={`w-4 h-4 ${isEmployeeLow ? "text-rose-500 animate-spin" : "text-cyan-400"}`} />
                        <span className="text-xs font-mono font-semibold text-slate-300">
                          员工执政忠诚 (Employees)
                        </span>
                      </div>
                      <span className={`text-sm font-mono font-bold ${
                        isEmployeeLow ? "text-rose-500 glow-red animate-pulse" : "text-cyan-400"
                      }`}>
                        {stats.employee} / 100
                      </span>
                    </div>
                    {/* Raw Slider */}
                    <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isEmployeeLow ? "bg-rose-500 animate-[pulse_1s_infinite]" : "bg-cyan-500"
                        }`}
                        style={{ width: `${stats.employee}%` }}
                      />
                    </div>
                    <span className="text-[9.5px] font-mono text-slate-500 block mt-1">
                      {
                        stats.employee < 20 ? "⚠️ 极限危机！员工在打印机里灌胶水，高声筹备全盘抗暴..." :
                        stats.employee < 45 ? "⚠️ 积极摆烂并准点下班，写字楼卫生纸卷正在神秘减少..." :
                        "🟢 年休假和零食车暂时买断了大家的灵魂与斗志。"
                      }
                    </span>
                  </div>

                  {/* Gauge 3: REPUTATION / PUBLIC RELATIONS (社会公誉舆论) */}
                  <div className="bg-slate-950/80 border border-slate-850 rounded-lg p-3 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <Globe className={`w-4 h-4 ${isReputationLow ? "text-rose-500 animate-bounce" : "text-indigo-400"}`} />
                        <span className="text-xs font-mono font-semibold text-slate-300">
                          公共舆论公信力 (Reputation)
                        </span>
                      </div>
                      <span className={`text-sm font-mono font-bold ${
                        isReputationLow ? "text-rose-500 glow-red animate-pulse" : "text-indigo-400"
                      }`}>
                        {stats.reputation} / 100
                      </span>
                    </div>
                    {/* Raw Slider */}
                    <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isReputationLow ? "bg-rose-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${stats.reputation}%` }}
                      />
                    </div>
                    <span className="text-[9.5px] font-mono text-slate-500 block mt-1">
                      {isReputationLow ? "⚠️ 反垄断听证会高定西装已烫好，各大纸媒将你定性为纯恶资本..." : "🟢 当前舆情中性偏赞叹，PPT画饼仍可以吹上微博热搜一。"}
                    </span>
                  </div>

                  {/* Gauge 4: TARGET HARVEST PROGRESS (宏伟目标完成度) */}
                  <div className="bg-slate-950/80 border border-slate-850 rounded-lg p-3 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-mono font-semibold text-slate-300">
                          宏愿图景统治度 (Progress)
                        </span>
                      </div>
                      <span className="text-sm font-mono font-bold text-amber-400 glow-yellow animate-[pulse_1.5s_infinite]">
                        {stats.progress}%
                      </span>
                    </div>
                    {/* Raw Slider */}
                    <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div 
                        className="h-full rounded-full transition-all duration-500 bg-amber-500"
                        style={{ width: `${stats.progress}%` }}
                      />
                    </div>
                    <span className="text-[9.5px] font-mono text-slate-400 block mt-1">
                      当达到 100% 后，你将彻底完成终极宏图并拯救公司！
                    </span>
                  </div>

                  {/* Gauge 5: COMPLIANCE RISKS (暴雷违规与合规风险) */}
                  <div className="bg-slate-950/80 border border-slate-850 rounded-lg p-3 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className={`w-4 h-4 ${isRiskHigh ? "text-rose-500 animate-ping" : "text-amber-500"}`} />
                        <span className="text-xs font-mono font-semibold text-slate-300">
                          违规暴雷受审险度 (Risk)
                        </span>
                      </div>
                      <span className={`text-sm font-mono font-bold ${
                        isRiskHigh ? "text-rose-500 glow-red" : "text-amber-500"
                      }`}>
                        {stats.risk} %
                      </span>
                    </div>
                    {/* Raw Slider */}
                    <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isRiskHigh ? "bg-rose-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${stats.risk}%` }}
                      />
                    </div>
                    <span className="text-[9.5px] font-mono text-slate-500 block mt-1">
                      {isRiskHigh ? "⚠️ 已经触发经侦大队和合规法务联合重武器制裁，请谨防下轮直接坐牢！" : "🟢 合规隐蔽工作极强，目前没有明显的违宪指控。"}
                    </span>
                  </div>

                </div>

                {/* Corporate Threat Warning Box */}
                <div className="rounded-lg p-3 bg-red-950/20 border border-red-900/60 text-[11.5px] font-mono text-rose-300">
                  <span className="font-bold uppercase tracking-wider block mb-1 flex items-center text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                    🚨 隐藏企业终焉危机警报：
                  </span>
                  “{setup?.hiddenThreat || "暂未排查到秘密炸弹因子"}”
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ==================== 4. SETTLEMENT SCREEN ==================== */}
        {screen === 'settlement' && settlement && (
          <div className="w-full max-w-3xl mt-2 animate-scale-up" id="settlement_board">
            
            {/* The Ultimate Certificate */}
            <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden" id="certificate_panel">
              
              {/* Retro decorative framing elements */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-500 via-amber-400 to-rose-500" />
              <div className="absolute bottom-2 right-3 font-mono text-[9px] text-slate-600">CONFIDENTIAL REPORT @ONE_MIN_BOSS</div>

              {/* Certificate Heading */}
              <div className="text-center space-y-2 mb-6">
                <span className="text-[10px] uppercase font-mono tracking-widest bg-amber-950/60 text-amber-400 px-3 py-1 rounded border border-amber-900/60 inline-block font-semibold">
                  👑 最终终极大盘审计清算特许证书
                </span>
                <h2 className="text-xl md:text-2xl font-mono font-bold tracking-tight text-slate-100 mt-2">
                  经由世界商业协会联合终审评定，您的企业身份为：
                </h2>
                <div className="inline-block px-5 py-2.5 bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-700/80 rounded-xl mt-3 shadow-lg">
                  <h3 className="text-lg md:text-xl font-display font-black text-amber-400 tracking-wide flex items-center justify-center space-x-2">
                    <Award className="w-6 h-6 text-amber-400 animate-pulse" />
                    <span>{settlement.title}</span>
                  </h3>
                </div>
              </div>

              {/* Big Grade and Outcome Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch mb-6">
                
                {/* Big Grade Box */}
                <div className="md:col-span-4 bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col items-center justify-center text-center shadow-inner">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">
                    主核审计评级
                  </span>
                  
                  {/* Grade typography */}
                  <span className={`text-6xl md:text-7xl font-display font-black tracking-tight leading-none ${
                    ["A+", "A"].includes(settlement.grade) ? "text-emerald-400 glow-green" :
                    ["B", "C"].includes(settlement.grade) ? "text-amber-400 glow-yellow" : "text-rose-500 glow-red"
                  }`}>
                    {settlement.grade}
                  </span>

                  <span className="text-xs font-mono text-slate-400 mt-3 font-medium">
                    {
                      settlement.grade === "A+" ? "🏆 傲视群雄·万亿割韭仙" :
                      settlement.grade === "A" ? "🥇 惊世骇俗·资本寡头高层" :
                      settlement.grade === "B" ? "🥈 差旅费勉强报销者" :
                      settlement.grade === "C" ? "🥉 中产韭菜·勉强苟活" :
                      settlement.grade === "D" ? "⚠️ 底层逻辑被识破" : "💀 劳动法执行犯/光荣赤字破产"
                    }
                  </span>
                </div>

                {/* Financial Summary Breakdown text */}
                <div className="md:col-span-8 bg-slate-950/40 border border-slate-850 p-5 rounded-xl flex flex-col justify-between">
                  <div>
                    <h4 className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center">
                      <Newspaper className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      📰 年度破产讣告 / 辉煌执政报告：
                    </h4>
                    <p className="text-xs md:text-sm text-slate-300 font-mono leading-relaxed italic pr-1">
                      “{settlement.summary}”
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-850/80 flex justify-between text-[11px] font-mono text-slate-500">
                    <span>目标最终实现率: <span className="text-amber-400 font-bold">{settlement.finalStats.progress}%</span></span>
                    <span>财务余额: <span className="text-emerald-400 font-bold">${settlement.finalStats.finance}万</span></span>
                    <span>合规风险: <span className="text-rose-400 font-bold">{settlement.finalStats.risk}%</span></span>
                  </div>
                </div>

              </div>

              {/* Unlocked Achievements list & Suggested Challenge */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                
                {/* Achievements block */}
                <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-4">
                  <h4 className="text-[10.5px] font-mono font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-400" />
                    🏆 已解锁的荒谬商业里程碑：
                  </h4>
                  <ul className="space-y-2 text-xs font-mono text-slate-400">
                    {settlement.achievements && settlement.achievements.map((ach, idx) => (
                      <li key={idx} className="flex items-center space-x-2 bg-slate-900/40 p-1.5 rounded border border-slate-850">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-300 pr-1 truncate">{ach}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggested Challenge box */}
                <div className="bg-slate-950/80 border border-slate-850 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10.5px] font-mono font-bold text-slate-300 uppercase tracking-widest mb-2 flex items-center">
                      <HelpCircle className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                      🔮 AI导师开出的下一局脑洞建议：
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-mono">
                      {settlement.suggestedChallenge}
                    </p>
                  </div>

                  <div className="pt-2">
                    <span className="text-[10px] font-mono uppercase text-slate-500">
                      永久成长奖励：老板履历值已增加 +100xp
                    </span>
                  </div>
                </div>

              </div>

              {/* Action Buttons: retry or copy certificate */}
              <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={copyShareText}
                  className={`flex-1 ${
                    copiedText ? "bg-emerald-600 text-slate-950 border-emerald-400" : "bg-indigo-600 hover:bg-indigo-500 text-slate-50 border-indigo-500"
                  } border px-5 py-3.5 rounded-xl text-xs font-bold font-mono tracking-wider transition flex items-center justify-center space-x-2`}
                >
                  <Share2 className="w-4 h-4 fill-current" />
                  <span>{copiedText ? "💥 大盘报告密档已复制到剪贴板！" : "📤 复制并截图分享朋友圈/脑洞记录"}</span>
                </button>

                <button
                  onClick={restartRun}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 px-5 py-3.5 rounded-xl text-xs font-bold font-mono tracking-wider transition shadow-lg shadow-emerald-500/10 flex items-center justify-center space-x-1.5"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-slow text-slate-950" />
                  <span>不服再开一局（换个脑洞）</span>
                </button>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* ==================== 5. HISTORY SIDEBAR DRAWER ==================== */}
      {showHistorySidebar && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex justify-end animate-fade-in" onClick={() => setShowHistorySidebar(false)}>
          <div 
            className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-5 md:p-6 shadow-2xl relative flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Sidebar Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-mono font-bold text-slate-100 tracking-wide">
                    老板历史执政机密档案
                  </h3>
                </div>
                <button 
                  onClick={() => setShowHistorySidebar(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 font-mono border border-slate-800 px-2 py-1 rounded"
                >
                  关闭
                </button>
              </div>

              {/* History list content */}
              {historyList.length === 0 ? (
                <div className="text-center py-16 space-y-4 font-mono text-slate-500">
                  <History className="w-12 h-12 mx-auto stroke-1" />
                  <p className="text-xs">
                    暂无已审核的老板执政履历。<br />
                    快去提交你的第一局神级策划方案吧！
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                  {historyList.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => loadPastGameDetails(item)}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-700 transition cursor-pointer relative group text-left"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded border ${
                          ["A+", "A"].includes(item.grade) ? "bg-emerald-950/50 text-emerald-400 border-emerald-900/60" : "bg-rose-955 text-rose-400 border-rose-900"
                        }`}>
                          评分 {item.grade}
                        </span>
                        <span className="text-[9.5px] text-slate-600 font-mono">{item.timestamp}</span>
                      </div>
                      
                      <h4 className="text-xs font-mono font-bold text-slate-200 truncate pr-6 group-hover:text-amber-400 transition">
                        {item.companyName}
                      </h4>
                      <p className="text-[10.5px] text-slate-400 mt-1 truncate">
                        🎯 {item.targetGoal}
                      </p>
                      
                      <span className="text-[11px] font-mono text-emerald-400 block mt-2 font-medium">
                        🏆 荣获称号：{item.title}
                      </span>

                      {/* Delete archive btn */}
                      <button
                        onClick={(e) => deleteHistory(item.id, e)}
                        className="absolute bottom-3 right-3 text-slate-600 hover:text-rose-400 transition"
                        title="销毁档案"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="pt-4 border-t border-slate-800 text-[10.5px] font-mono text-slate-500 text-center">
              <span>* 数据采用本地 LocalStorage 加密持久存储</span>
            </div>
          </div>
        </div>
      )}

      {/* Corporate bottom credit */}
      <footer className="py-4 border-t border-slate-900 bg-slate-950/20 text-center text-[10.5px] font-mono text-slate-600 mt-auto">
        <p>© 2026 一分钟老板 商业黑话与荒诞现实联合委员会保留所有权利</p>
        <p className="mt-1">
          本软件所有故事均为 AI 基于荒诞算法推演，切勿在现实任一初创公司擅自操刀。
        </p>
      </footer>

      {/* In-app custom elegant alert dialog overlay */}
      {activeModal && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setActiveModal(null)}
          id="custom-app-modal"
        >
          <div 
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative animate-scale-up space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top color tag based on type */}
            <div className={`absolute top-0 inset-x-0 h-1.5 rounded-t-2xl ${
              activeModal.type === 'error' ? 'bg-rose-500' :
              activeModal.type === 'success' ? 'bg-emerald-400' :
              activeModal.type === 'info' ? 'bg-indigo-400' : 'bg-amber-400'
            }`} />

            <div className="flex items-start space-x-3.5 pt-2">
              <div className={`p-2 rounded-lg shrink-0 ${
                activeModal.type === 'error' ? 'bg-rose-950/50 text-rose-400 border border-rose-900/60' :
                activeModal.type === 'success' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/60' :
                activeModal.type === 'info' ? 'bg-indigo-950/50 text-indigo-400 border border-indigo-900/60' : 'bg-amber-950/50 text-amber-400 border border-amber-900/60'
              }`}>
                {activeModal.type === 'error' ? <AlertTriangle className="w-5 h-5 animate-pulse" /> :
                 activeModal.type === 'success' ? <Award className="w-5 h-5" /> :
                 activeModal.type === 'info' ? <HelpCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5 animate-spin-slow" />}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-mono font-bold text-slate-100 tracking-wide uppercase">
                  {activeModal.title}
                </h3>
                <p className="text-xs text-slate-350 font-mono leading-relaxed mt-2.5 whitespace-pre-line text-left">
                  {activeModal.message}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/60 flex justify-end">
              <button
                onClick={() => {
                  triggerSound('click');
                  setActiveModal(null);
                }}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-xs font-mono font-bold text-slate-200 px-4 py-2.5 rounded-xl transition shadow-lg shrink-0"
              >
                关闭窗格
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
