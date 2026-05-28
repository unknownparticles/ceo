/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PresetGoal {
  id: string;
  badge: string;
  title: string;
  targetGoal: string;
  planSummary: string;
  riskRating: '稳健型' | '狂暴型' | '通缉型';
  industry: string;
  description: string;
}

export const PRESET_GOALS: PresetGoal[] = [
  {
    id: "mars_tea",
    badge: "太空碳税",
    title: "用一家奶茶店统治火星",
    targetGoal: "用一家奶茶公司统治火星，强迫整个火星殖民地移民饮用高维浓缩糖浆",
    planSummary: "在火星奥林匹斯火山开设高压离心珍珠流，提取冰盖水，并强制把二氧化碳气泡化。建立珍珠霸权，使新移民必须购买我们的奶茶并按珍珠数量交纳火星排碳税。",
    riskRating: "狂暴型",
    industry: "太空餐饮与资源重整",
    description: "高糖绑定、二氧化碳强制气泡化，开辟太空肥宅水道！"
  },
  {
    id: "goose_valley",
    badge: "物理攻陷",
    title: "员工转化为电子大白鹅强占硅谷",
    targetGoal: "将全公司员工转化为“量子脑机大白鹅”，彻底霸占和控制整个硅谷科技园区",
    planSummary: "采购数万只脑机大白鹅头套进行物理级降本增效，用野生杂草代替工资和办公餐。发挥大白鹅自带的无差别的极高领地攻击性，让它们物理瘫痪竞品公司的服务器和机房大堂。",
    riskRating: "通缉型",
    industry: "脑机畜牧物理干扰",
    description: "无视反垄断法，用纯粹的物理公害和鹅鸣噪音淹没竞品厂商！"
  },
  {
    id: "chimp_model",
    badge: "零元算力",
    title: "黑猩猩敲键盘训练大模型",
    targetGoal: "雇佣10万只黑猩猩进行敲击反馈训练，开发纯天然‘香蕉算力式’LLM并上市",
    planSummary: "开发自动发放剥皮香蕉的物理外设，利用无限猴子定理配合自动化键盘产生Token。完全免去高昂的GPU成本和程序员股权激励，以此颠覆主流人工智能巨头。",
    riskRating: "稳健型",
    industry: "碳基生成式人工智能",
    description: "你甚至不需要支付电费和年终奖，只需要按季度进口成熟的高卡路里香蕉。"
  },
  {
    id: "scooter_rocket",
    badge: "中老年硬核",
    title: "太阳能老头乐速递登月",
    targetGoal: "用由中老年老头乐组装的磁浮运载飞船编队，提供地球到月球的零元包邮特快",
    planSummary: "强制收回周边社区广场舞大妈的低速代步老头乐，拼焊报废碱堆进推器。利用大妈们的广场舞伴奏重低音进行电磁震荡变轨，开辟一条不走寻常路的中老年火箭专线。",
    riskRating: "通缉型",
    industry: "低空极速拼焊重工",
    description: "不耗航天煤油，大妈的电音和老年车，就是全宇宙最高效的速度引擎！"
  },
  {
    id: "pancake_nobel",
    badge: "量能炒作",
    title: "申请诺贝尔物理学奖的元宇宙煎饼果子",
    targetGoal: "向喜马拉雅山及元宇宙抛售两千万张非欧几何双层量子煎饼果子，荣获诺奖",
    planSummary: "宣称煎饼中薄脆的松脆感与鸡蛋的凝固态处于量子纠缠，使用加密货币将其打包发行。由于无法进行物理观测（每吃一口便破坏了波函数），借由学术空气币疯狂在二级大熔炉炒作套现。",
    riskRating: "稳健型",
    industry: "高维玄学证券餐饮",
    description: "通过给碳水化合物穿上弦理论的学术盛装，割秃高净值精英的学术信仰。"
  }
];

export const FUN_LOADING_MESSAGES = [
  "正在联络开曼群岛信托幽灵代理人...",
  "正在将 PPT 宏伟目标用高能氦气充能...",
  "正在说服风投机构抵押他们连夜买入的黄金...",
  "正在重金贿赂AI商业模拟法官...",
  "正在将员工工资一键转化为空气期权币...",
  "正在向火星第一殖民地工商局提交逃税声明...",
  "公司合法避税信托账户开设成功！",
  "正在对写字楼内的绿植征收办公室碳排放税..."
];
