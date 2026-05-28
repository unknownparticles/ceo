/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini Client with compliant options
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const CONSTANT_SYSTEM_INSTRUCTION = `
你是一个无情、幽默、充满荒诞现实主义的"一分钟商业模拟游戏"的游戏导演 (Game Director)。你的名字叫“AI商界导师”。
本游戏的目标：给你 60 秒，通过一系列极度离谱、胡说八道却套上高端商业术语的决策，让玩家要么拯救这家公司，要么光荣破产。
你生成的内容核心风格：
1. 严肃且充满黑话 (Buzzwords)：使用黑话如“协同效应、价值引爆、降本增效、重合度穿透、GMV指数破壁、高维矩阵覆盖、闭环增长、底层逻辑”。
2. 极端荒谬的现实：方案极度离谱（例如：把员工换成电子仓鼠，用椰子汁做运载火箭燃料，拿老板的私房钱做空美联储）。
3. 即时报应 (Direct Consequences)：玩家做的没脑子决定会立刻引发连锁滑稽恶果。
4. 语言：必须以 **简体中文** 提供所有内容。风格具有嘲讽性质、一针见血，但要保持顶级商业咨询公司报告的庄重形式。
5. 每次事件提供刚好 3 个选择（选项 A, 选项 B, 选项 C）。选择必须有不同的风险程度和偏向：
   - 偏向稳健降本但极其敷衍滑稽。
   - 偏向疯狂高风险扩张但异想天开。
   - 偏向直接放弃、骚操作转移债务或逃避责任。
`;

// Helper: safe JSON parsing for Gemini text output
function cleanAndParseJSON(jsonText: string) {
  try {
    // Strip markdown JSON quotes if exists
    let sanitized = jsonText.trim();
    if (sanitized.startsWith("```json")) {
      sanitized = sanitized.slice(7);
    }
    if (sanitized.startsWith("```")) {
      sanitized = sanitized.slice(3);
    }
    if (sanitized.endsWith("```")) {
      sanitized = sanitized.slice(0, -3);
    }
    return JSON.parse(sanitized.trim());
  } catch (error) {
    console.error("Failed to parse JSON from AI response:", jsonText, error);
    throw new Error("AI未能输出标准格式数据，请重试一局！");
  }
}

// Endpoint 1: Start proposal analyze & generate first round
app.post("/api/game/analyze", async (req, res) => {
  const { targetGoal, planSummary } = req.body;

  if (!targetGoal) {
    return res.status(400).json({ error: "请填写商业目标！" });
  }

  const prompt = `
请解析以下玩家提交的离谱商业策划，并为他注册一家空壳公司、分析老板人格，并给出第 1 轮商业随机事件：
【玩家的宏伟目标】：${targetGoal}
【他的离谱实现规划】：${planSummary || "暂无具体方案，纯靠底气和自信！"}

请根据以上构想推演并返回符合以下JSON格式的响应：
{
  "companyName": "给公司起个一本正经却暗示荒谬的名字（字数限6-12字，比如'火星椰乳重工科技'或'量子煎饼资本集团'）",
  "personality": "给玩家分析一波老板人格称号（4个字以内，比如'终极画饼侠'、'天降裁员官'、'PPT上市大师'或'疯狂赌徒'）",
  "type": "核心商业领域（如：太空奶茶、元宇宙煎饼、电子放牧、AI算命等）",
  "hiddenThreat": "一句搞笑的隐藏危机警言，暗示公司目前暗藏的致命破产隐患",
  "initialEvent": {
    "storySegment": "第1轮起步事件的描述：讲述公司在执行这个宏伟计划的第一天遇到的奇葩瓶颈或危机，富有冷幽默和商业黑话气息（约100-150字）。",
    "options": [
      {"text": "疯狂的高风险扩张方案：极其抓马、异想天开却吹得天花乱坠的冒险选项", "consequence": "暗示后果（比如：暴富概率5%，牢底坐穿95%）"},
      {"text": "敷衍搞笑的降本增效方案：极其小气、奇葩但看似省钱的低级操作", "consequence": "暗示后果（比如：省下10块电费，员工全部罢工）"},
      {"text": "跑路/骚操作抗债或奇特转嫁方案：转嫁风险、推卸责任、甚至用玄学或骗保来度过危机", "consequence": "暗示后果（比如：成功将黑锅甩给临时工或神秘邻居）"}
    ],
    "newsHeadline": "一句话搞笑新闻快讯/热搜标题，代表舆论风阻（比如：独家！某科技司疑似引进300只猴子代替算法工程师，股价暴涨12%）",
    "commentBox": {
      "source": "employee", 
      "author": "技术部小张",
      "text": "吐槽公司决策或夸赞老板画饼的搞笑内网吐槽或社交回复"
    }
  }
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: CONSTANT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const parsedData = cleanAndParseJSON(text);

    // Populate dynamic properties
    parsedData.initialEvent.id = "evt_1";
    parsedData.initialEvent.roundNum = 1;
    parsedData.initialEvent.isClimax = false;

    res.json(parsedData);
  } catch (error: any) {
    console.log("Using simulation fallback for /api/game/analyze (Gemini limits or network threshold)");
    
    const rawGoal = targetGoal || "量子造车";
    const goalKw = rawGoal.length > 6 ? rawGoal.substring(0, 6) : rawGoal;
    
    const randomSuffix = ["重工科技", "数智资本", "闭环产业", "无限动力", "黑话控股"][Math.floor(Math.random() * 5)];
    const companyName = `${goalKw}${randomSuffix}`.slice(0, 12);
    
    const personalities = ["终极画饼侠", "高维割韭师", "PPT上市大师", "疯狂降本帝", "擦边避税王"];
    const personality = personalities[Math.floor(Math.random() * personalities.length)];
    
    const types = ["赛博低维产品", "非碳基消费", "黑话增效闭环", "高端PPT重工业"];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const hiddenThreats = [
      "据传技术部正暗中用全自动仓鼠发电系统替换整个服务器集群",
      "公司的外包保洁阿姨其实是著名风险投资公司的特工卧底",
      "财务部的咖啡机每天消耗5000元的高端椰子原汁，已引起税务注意",
      "有人举报你昨晚把公司唯一的实体资产（一辆折叠自行车）抵押给了地下钱庄"
    ];
    const hiddenThreat = hiddenThreats[Math.floor(Math.random() * hiddenThreats.length)];
    
    const fallbackResponse: any = {
      companyName,
      personality,
      type,
      hiddenThreat,
      initialEvent: {
        storySegment: `在正式开启【${targetGoal}】的伟大项目第一天，写字楼一楼的大铁门突然被50多位声称来“追讨高能椰子汁押金”的广场舞大妈彻底堵死。前台接待在紧急群聊里发出了惊恐的预警，而隔壁的老板朋友圈里全是对你降本增效进度的尖锐调侃。公司现金流告急，人心浮躁，形势迫在眉睫。`,
        options: [
          {
            text: `出重拳！出让51%非核心股份给大妈联委会，强制将广场舞喇叭包装成最新“次世代低空强声能火箭”方案开展融资。`,
            consequence: "完成度大升，但被逮捕风险急剧飙高，极高合规隐患"
          },
          {
            text: `立刻裁掉30%前台和保洁，将所有照明灯换成手摇手电筒，声称这是贯彻“不插电零碳太空冷光源”的企业降本闭环。`,
            consequence: "节省大量开支，但员工满意度暴跌，有摆烂风险"
          },
          {
            text: `把公司财务里所有的公积金折现成果汁发给大妈当安抚金，同时将黑锅秘密甩给楼上已经宣布解散的区块链煎饼公司。`,
            consequence: "名誉与口碑大涨，但大笔财务流出，处于生死边缘"
          }
        ],
        newsHeadline: `重磅！${companyName}疑似雇佣社区大妈接管太空奶茶测试轨道，高维重合度穿透惊掉技术分析师眼球`,
        commentBox: {
          source: "employee",
          author: "技术部小张",
          text: "大白天的，服务器突然被拉去给大妈们的音响充电，我们写的登火星代码全烧掉了。"
        }
      }
    };
    
    fallbackResponse.initialEvent.id = "evt_1";
    fallbackResponse.initialEvent.roundNum = 1;
    fallbackResponse.initialEvent.isClimax = false;
    
    res.json(fallbackResponse);
  }
});

// Endpoint 2: Execute decision and load next event
app.post("/api/game/decision", async (req, res) => {
  const {
    companyName,
    targetGoal,
    personality,
    roundNum, // Current round finished (1 to 4)
    chosenOptionText,
    stats, // Current stats: { finance, employee, reputation, progress, risk }
    previousHistory, // Array of strings reporting past events
  } = req.body;

  // Decide if next round is climax
  const nextRoundNum = (roundNum || 1) + 1;
  const isClimax = nextRoundNum === 5; // 5th round will be the ultimate climax event!
  const isGameOverTriggered = 
    stats.finance <= 0 || stats.employee <= 0 || stats.reputation <= 0 || stats.risk >= 100 || stats.progress >= 100;

  if (isGameOverTriggered) {
    return res.json({
      stats,
      consequenceFeedback: "公司状态已经彻底爆表或暴雷，无法进行下一轮。请直接进入最终清算！",
      nextEvent: null,
      isGameOver: true,
      gameOverReason: stats.finance <= 0 ? "finance_ruin" : stats.employee <= 0 ? "strike" : stats.reputation <= 0 ? "pr_disaster" : stats.risk >= 100 ? "jailed" : "completed"
    });
  }

  const prompt = `
玩家控制的公司名字叫做【${companyName}】（定位为：${personality} 级别的掌舵人）。
目前他面临的宏伟目标是：【${targetGoal}】。
他在上一轮面对奇葩危机，做出了以下决策：【${chosenOptionText}】。
当前公司的运营状态（满分为100）：
- 财务状况 (finance): ${stats.finance}
- 员工满意度 (employee): ${stats.employee}
- 舆论舆情指数 (reputation): ${stats.reputation}
- 宏伟目标完成度 (progress): ${stats.progress}%
- 暴雷与合规风险值 (risk): ${stats.risk}%

过去历史简介：
${JSON.stringify(previousHistory || [])}

请进行AI模拟计算和推演：
1. 评估该决策的戏剧性后果。请用严肃的商业腔调描述荒诞的执行结果（约100字），并设定相应的属性增减量（deltas）。每一个属性的delta通常建议在 [-25, 25] 范围，特殊致命重灾可达 [-40, 40]：
   - financeChange: 财务变化值 (整数，正负均可)
   - employeeChange: 员工满意度变化 (整数，正负均可)
   - reputationChange: 舆情变化 (整数，正负均可)
   - progressChange: 宏伟目标完成度获得值 (正整数，通常在 +10 ~ +25 之间。越激进的目标完成度加得越多)
   - riskChange: 法律或爆炸风险变化 (整数，正负均可，越离谱的方案risk飙得越高)

2. 生成下一轮事件（第 ${nextRoundNum} 轮 ${isClimax ? "【极度紧张的大结局前夕·高潮暴击】" : "常规商业风暴"}）内容：
   - storySegment: 接下来发生的又一个荒谬事件。如果 isClimax 是 true，请将事件设计得极其宏伟、疯狂且绝望，就像所有的蝴蝶效应都在此时收束（例如：债主雇佣了一支由AI辩护律师组成的特遣队围堵了写字楼大门，或者股东宣布发现了你用椰汁造火箭的秘密）！
   - 提供刚好 3 个离谱的滑稽选择供玩家在倒计时中决出。
   - newsHeadline: 讽刺的新闻标题或微博热度榜。
   - commentBox: 相关的外部或网民辣评（source 可以是 employee, shareholder, netizen, competitor等之一）。

请务必返回以下 JSON 格式数据：
{
  "consequenceFeedback": "对上一次选择的讽刺总结和后果描述，用辛辣但极度专业学术的黑话表达（比如：'通过将产品包装虚无化，你成功稀释了碳税责任，让全体员工每天吃大白菜实现了完美降本，然而...'）",
  "financeChange": -15,
  "employeeChange": 10,
  "reputationChange": -5,
  "progressChange": 15,
  "riskChange": 20,
  "nextEvent": {
    "storySegment": "第${nextRoundNum}轮的新事件描述（约100字）",
    "options": [
      {"text": "极端激进/疯狂选项", "consequence": "后果幽默描述"},
      {"text": "猥琐保命/省钱选项", "consequence": "后果幽默描述"},
      {"text": "金蝉脱壳/黑锅转让选项", "consequence": "后果幽默描述"}
    ],
    "newsHeadline": "一条跟这个新事件相呼应的热点新闻",
    "commentBox": {
      "source": "shareholder",
      "author": "华尔街韭菜",
      "text": "一句切合主题的痛切或吹捧发言"
    }
  }
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: CONSTANT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const parsedData = cleanAndParseJSON(text);

    // Do mathematical consolidation
    const finance = Math.max(0, Math.min(100, stats.finance + (parsedData.financeChange || 0)));
    const employee = Math.max(0, Math.min(100, stats.employee + (parsedData.employeeChange || 0)));
    const reputation = Math.max(0, Math.min(100, stats.reputation + (parsedData.reputationChange || 0)));
    const progress = Math.max(0, Math.min(100, stats.progress + (parsedData.progressChange || 0)));
    const risk = Math.max(0, Math.min(100, stats.risk + (parsedData.riskChange || 0)));

    const newStats = { finance, employee, reputation, progress, risk };

    // Assess immediate game-over reasons after consolidation
    let isGameOver = false;
    let gameOverReason: "finance_ruin" | "strike" | "pr_disaster" | "jailed" | "completed" | "timeout" | undefined;

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
    } else if (newStats.progress >= 100) {
      isGameOver = true;
      gameOverReason = "completed";
    } else if (nextRoundNum > 5) {
      // Reached limit! Settle normally
      isGameOver = true;
      gameOverReason = "completed";
    }

    const nextEventResolved = isGameOver ? null : {
      ...parsedData.nextEvent,
      id: `evt_${nextRoundNum}`,
      roundNum: nextRoundNum,
      isClimax: nextRoundNum === 5,
    };

    res.json({
      stats: newStats,
      consequenceFeedback: parsedData.consequenceFeedback,
      nextEvent: nextEventResolved,
      isGameOver,
      gameOverReason,
    });
  } catch (error: any) {
    console.log("Using simulation fallback for /api/game/decision (Gemini limits or network threshold)");
    
    // Create pre-composed consequence and next event templates depending on choices or round
    const nextRoundNum = (roundNum || 1) + 1;
    const isClimax = nextRoundNum === 5;
    
    // Generate some reasonable changes based on the index or text of choice
    let financeChange = 0;
    let employeeChange = 0;
    let reputationChange = 0;
    let progressChange = 15;
    let riskChange = 5;
    let feedback = "";
    
    const choiceTextLower = (chosenOptionText || "").toLowerCase();
    
    if (choiceTextLower.includes("裁") || choiceTextLower.includes("省") || choiceTextLower.includes("降本") || choiceTextLower.includes("小气") || choiceTextLower.includes("手电")) {
      financeChange = 20;
      employeeChange = -20;
      reputationChange = -5;
      progressChange = 5;
      riskChange = -5;
      feedback = "你通过极其惨绝人寰的极客级算账手法，成功省下了大量高纯度碳税资金。然而，员工在茶水间给饮水机加自来水的画面流露，导致了极其严重的士气滑倒，大家纷纷在办公桌前秘密投递个人简历。";
    } else if (choiceTextLower.includes("股份") || choiceTextLower.includes("火箭") || choiceTextLower.includes("高风险") || choiceTextLower.includes("扩张") || choiceTextLower.includes("合并") || choiceTextLower.includes("重拳") || choiceTextLower.includes("融资")) {
      financeChange = -15;
      employeeChange = 10;
      reputationChange = 15;
      progressChange = 25;
      riskChange = 25;
      feedback = "你极其猖狂地发动了商业极限闪击战！虽然整个宇宙舆论对你这桩‘太空火箭与大妈音响联动融通’的世纪壮举顶礼膜拜，但由于合规资质严重不合常理，合规经侦风险值已经出现极度刺耳的蜂鸣警示！";
    } else {
      financeChange = -10;
      employeeChange = 5;
      reputationChange = 15;
      progressChange = 15;
      riskChange = -15;
      feedback = "你利用极其高超的企业责任稀释架构，成功将黑锅转嫁给已经被停牌查封的前友商，并在财务报表里完成了一次完美的合规闭环。外界媒体甚至发表了《论降维责任推卸法》的深度特写，大家对你的商业滑头赞不绝口。";
    }

    const storySegments = [
      "", // round 0
      "", // round 1
      `由于上期决策直接激活了公关界高维蝴蝶效应，公司的整个服务器群突然被指控“涉嫌用未注册的广场舞音响阵列挖掘元宇宙煎饼代币”。税务稽查和城管特遣队正手持纸质罚单，在公司大门前进行饱和式鸣笛。大伙儿全都眼巴巴地盯着财务，看看是要交钱息事，还是剑走偏锋！`, // round 2
      `到了第 3 天，海外合作代表表示他们愿意从贵公司采购一万吨“低空压缩椰奶能源火箭弹”，条件是包装上必须印有你的个人签名，并将其定性为“零热量科技保健奶茶”。研发主管表示这东西具有不稳定性，放久了可能导致轨道泄露，产生令人窒息的碳酸雾气！`, // round 3
      `公司在离宏伟重图大成仅剩一步之遥时，突然被技术爆料：我们前几天买的那批“高性能机械仓鼠服务器”由于工作压力过大发生群体性罢工，正在全网组建“反高科技剥削总工会”。它们要求获得每周三下午的椰奶分红权！技术体系瘫痪在即，你必须即刻出招！`, // round 4
      `【极度紧张的大结局前夕·高潮暴击】就在公司企划的最后一天，知名风投大鳄在直播中高调炮轰你的方案是“纯度过高的一分钟纸牌屋骗局”。大批持股散户将总部写字楼的所有求生通道围堵得水泄不通，高喊要求把他们的血汗钱全换成椰浆！各大媒体甚至已经提前排好了你和知名看守所同框的年度特刊！` // round 5
    ];

    const currentStoryForNext = storySegments[nextRoundNum] || `我们在推进宏观终极愿景的过程中，遇到了行业黑红危机。整个商办大楼的供电系统被切断，大家都吵着说要让老板亲自上台手摇电风扇才能维持空调运转。市场总监已经急得在黑板上画起了玄学太极图。`;

    const optionsForNext = [
      {
        text: `立刻在直播中大声痛哭并宣布：这是智能动力时代必须要接受的技术代偿痛点，散户可以凭借入场券换取我们的“极客定制电子仓鼠公仔”。`,
        consequence: "完成度提升20%，但舆论风向两极分化，情绪极度激动"
      },
      {
        text: `让全体核心人员将手机关机，伪装成“极密研发静默封锁测试”，并将所有空置工位改造成“共享太空椰乳试喝舱”赚取外快自救。`,
        consequence: "回充财务15万可用资金，但满意度走低，员工以为要跑路"
      },
      {
        text: `紧急发布公关PPT声明：本公司已完成全面向玄学及能量磁场维度的技术转移，将用喜马拉雅山冰川神泥重塑高维火箭底盘，甩锅给神秘太空电磁干扰。`,
        consequence: "风险暴跌15%，但极度考验名誉耐久度，降幅10%"
      }
    ];

    const headlines = [
      "",
      "",
      `惊闻！${companyName}疑似陷入“赛博音响挖掘重工案”，网民热议：这是真的煎饼，还是新型泡沫？`,
      `惊爆！${companyName}高管携一万吨高密度椰奶现身口岸，海外买家疯狂直呼：这东西居然还能当变轨推进剂？！`,
      `头条：仓鼠反水！${companyName}数万只高性能服务器仓鼠宣布独立，劳动法抗诉法庭已受理其全天候椰浆诉求`,
      `独家：大厦将倾？风投大鳄现场开箱拆解${companyName}火箭模型，里面居然有三包过期的榨菜与一瓶椰汁！`
    ];

    const commentAuthors = ["外包小刘", "商业观察员", "散户张阿姨", "竞争对手老板"];
    const commentTexts = [
      "老板每天画饼画到连仓鼠都受不了了，支持仓鼠维权！",
      "这桩把大妈广场舞、未注册音响和重合度闭环杂糅在一起的离谱操作，属实开创了黑话代偿先河。",
      "我存的老板私房椰奶信托基金要是打水漂了，我明天就带大妈去楼下跳三天三夜！",
      "不得不说，能把椰汁当太空燃料甚至还合理抵税的老板，全太阳系找不出第二个。"
    ];

    const nextEventTemplate = {
      storySegment: currentStoryForNext,
      options: optionsForNext,
      newsHeadline: headlines[nextRoundNum] || `突发！${companyName}商业操作引发巨大争议，社会各界高度赞美或彻底无语`,
      commentBox: {
        source: "netizen",
        author: commentAuthors[Math.floor(Math.random() * commentAuthors.length)],
        text: commentTexts[Math.floor(Math.random() * commentTexts.length)]
      }
    };

    const finance = Math.max(0, Math.min(100, stats.finance + financeChange));
    const employee = Math.max(0, Math.min(100, stats.employee + employeeChange));
    const reputation = Math.max(0, Math.min(100, stats.reputation + reputationChange));
    const progress = Math.max(0, Math.min(100, stats.progress + progressChange));
    const risk = Math.max(0, Math.min(100, stats.risk + riskChange));

    const newStats = { finance, employee, reputation, progress, risk };

    let isGameOver = false;
    let gameOverReason: "finance_ruin" | "strike" | "pr_disaster" | "jailed" | "completed" | "timeout" | undefined;

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
    } else if (newStats.progress >= 100) {
      isGameOver = true;
      gameOverReason = "completed";
    } else if (nextRoundNum > 5) {
      isGameOver = true;
      gameOverReason = "completed";
    }

    const nextEventResolved = isGameOver ? null : {
      ...nextEventTemplate,
      id: `evt_${nextRoundNum}`,
      roundNum: nextRoundNum,
      isClimax: nextRoundNum === 5,
    };

    res.json({
      stats: newStats,
      consequenceFeedback: feedback,
      nextEvent: nextEventResolved,
      isGameOver,
      gameOverReason,
    });
  }
});

// Endpoint 3: Settle the entire tenure (Generate rich post-mortem)
app.post("/api/game/settle", async (req, res) => {
  const {
    companyName,
    targetGoal,
    personality,
    stats,
    history, // List of decisions & results
    gameOverReason, // e.g. "finance_ruin" | "strike" | "pr_disaster" | "jailed" | "completed" | "timeout"
  } = req.body;

  const prompt = `
请为这位玩家悲惨、疯狂而荣耀的“一分钟老板执政局”进行最终的大盘清算与年度总结评估：
【公司名称】：${companyName}
【老板风格】：${personality}
【当时追求的宏伟宏愿】：${targetGoal}
【终局结算核心数据】：
- 财务余额: ${stats.finance}/100
- 员工支持度: ${stats.employee}/100
- 商业名誉/公信力: ${stats.reputation}/100
- 目标宏伟蓝图成就度: ${stats.progress}/100 %
- 违规遭捕风险: ${stats.risk}/100 %
【终结致死成因】：${gameOverReason || "completed"}

游戏内抉择简报：
${JSON.stringify(history || [])}

请以此为历史数据，推演出令人捧腹、深刻讽刺，又特别让人忍不住截图发朋友圈的【商业终局总结】。
返回以下 JSON 格式的响应：
{
  "title": "给玩家颁发的一级搞笑终极大荣誉商业称号（比如：'马斯克编外亲传弟子'、'PPT造火箭欺诈界巨擘'、'劳动法法庭VIP受审人员'、'太阳系椰子汁垄断狂魔'）",
  "grade": "'A+' | 'A' | 'B' | 'C' | 'D' | 'F'（根据其财务和目标达成度，给予主观、讽刺却又合理的黑话评级。如果是因为由于零财务、零信誉或坐牢提前暴雷，建议给 F，如果目标完成度极其高，给 A+或A）",
  "summary": "撰写一段荒诞戏谑、结合其整个游戏全套愚蠢决策的搞笑年度执政报告（字数限150-200字）。像一位严肃高冷的金融时报特约撰稿人在给他写商业死因或成功讣告。",
  "achievements": [
    "解锁搞笑成就一（4-8字，如：'成功挑战劳动法底线'）",
    "解锁搞笑成就二（4-8字，如：'椰奶浓度突破宇宙法则'）",
    "解锁搞笑成就三（4-8字，如：'荣升华尔街避税活化石'）"
  ],
  "suggestedChallenge": "给他的下局推荐。一句极具脑洞诱惑的、带有不同离谱预设的挑衅式下局开盘建议。比如：'要不要试试看：通过向喜马拉雅山倾倒奶茶，强行建造全球最大的焦糖奶盖滑雪场？'",
  "shareMarkdown": "一段格式严整精美的、可以用作复制粘贴朋友圈/社交网络分享的大文案。可以用等宽符号、破折号来排版（比如：\\n🌟 【一分钟老板】大盘结算 🌟 \\n公司名称：XXXX... 等。要十分富有幽默感和炫耀度！）"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: CONSTANT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const parsedData = cleanAndParseJSON(text);

    res.json(parsedData);
  } catch (error: any) {
    console.log("Using simulation fallback for /api/game/settle (Gemini limits or network threshold)");
    
    let title = "商业闭环首席架构师";
    let grade = "C";
    let summary = "";
    let achievements = ["劳动法的尊贵挑战者", "黑话吹哨大师", "无辜椰子汁摧毁商"];
    let suggestedChallenge = "要不要挑战：全自动仓鼠奶茶速递，强行颠覆现有的太空美团配送模式？";
    
    if (gameOverReason === "finance_ruin") {
      title = "万亿亏空大空头";
      grade = "F";
      summary = `在推进伟大宏图【${targetGoal}】的过程中，【${companyName}】经历了极度壮烈的现金流瀑布式消融。在花光了最后一分钱去抵税和购买高端椰奶后，公司大楼被电力特警依法断电，股东在废墟里众筹了六毛钱作为给你的跑路津贴，宣布光荣破产。`;
    } else if (gameOverReason === "strike") {
      title = "劳动仲裁终身贵宾";
      grade = "D";
      summary = `由于过度榨取了高性能仓鼠和保洁大妈的最后余热，他们联合起草了一份长达400页的企业维权抗诉，甚至将你办公室里的老板沙发挂在二手拍卖网上当抗议资金。员工全体离职，只剩你一人在黑板前自言自语画饼。`;
    } else if (gameOverReason === "pr_disaster") {
      title = "公关绝缘体·人人喊打";
      grade = "D";
      summary = `你的荒谬商业闪击战在舆论界掀起了十级反垄断和反诈风暴。数万网民在微博和小红书发起了‘每天抵制${companyName}三分钟’活动，连你高薪聘请的代言仓鼠都紧急发声称与老板划清界限。名声扫地，寸步难行。`;
    } else if (gameOverReason === "jailed") {
      title = "华尔街编外法外狂徒";
      grade = "F";
      summary = `风险指数拉满！监视 and 调查尘埃落定，司法联委会出动无人机攻破了办公室的防盗纱窗，并当场没收了你签字的‘一万吨高密度椰汁合约’。你将在特种合规法庭展示长达三小时的上市PPT辩护，完成华丽的法庭封神。`;
    } else {
      grade = stats.progress >= 90 && stats.finance >= 50 ? "A+" : stats.progress >= 80 ? "A" : "B";
      title = stats.progress >= 90 ? "太阳系太空椰奶垄断大鳄" : "PPT上市及格大船长";
      summary = `奇迹诞生！你凭借着极度离谱、突破地心引力的疯狂大决策，强行拉载【${targetGoal}】跨越了100%的项目红网阶段！你甚至在华尔街和火星交易所顺利拿下了特批的碳排放豁免权，全体大妈、仓鼠与公募基金齐聚一堂为您加冕，太伟大了！`;
    }

    const shareMarkdown = `🌟 【一分钟老板】大盘审计清算 🌟\n--------------------------\n- 公司名称: ${companyName}\n- 老板风格: ${personality}\n- 宏伟理想: ${targetGoal}\n\n📊 终局资产负债表：\n- 项目完成度: ${stats.progress}%\n- 财务盈余: $${stats.finance}万\n- 被捕风险: ${stats.risk}%\n- 终极称号: 【${title}】\n- 综合审计评级: [ ${grade} ]\n--------------------------\n“年度清盘呈辞：${summary.substring(0, 70)}...” \n🎮 扫码体验：来写一分钟拯救公司的荒唐PPT！`;

    res.json({
      title,
      grade,
      summary,
      achievements,
      suggestedChallenge,
      shareMarkdown
    });
  }
});

// Serve frontend SPA static files or Hot-Reload in Development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[一分钟老板] Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
