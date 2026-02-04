'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { trackDocView } from '@/lib/analytics';

interface DocSection {
  title: string;
  content: React.ReactNode;
}

const DOCS: Record<string, DocSection> = {
  introduction: {
    title: 'KinForge 简介',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">
          KinForge 是基于 BNB Chain 的非同质化智能体 (NFA) 平台，实现了 BAP-578 标准。
          每个智能体都是独特的、可交易的身份，拥有确定性特征、可验证成长和融合繁衍能力。
        </p>

        <h2>什么是非同质化智能体？</h2>
        <p>
          与传统静态收藏品 NFT 不同，非同质化智能体 (NFA) 是动态的数字身份，具备以下能力：
        </p>
        <ul>
          <li><strong>学习和成长</strong> — 积累经验，形成可验证的学习摘要</li>
          <li><strong>繁衍后代</strong> — 通过融合系统将两个智能体结合，创造新的身份</li>
          <li><strong>执行动作</strong> — 委托动作给授权操作员（符合 BAP-578 标准）</li>
          <li><strong>验证历史</strong> — 每次状态变更都通过链上哈希追踪</li>
        </ul>

        <h2>七大天气家族</h2>
        <p>
          每个智能体属于七大天气主题家族之一，每个家族都有独特的视觉特征和特征偏好：
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6 not-prose">
          {[
            { name: 'Clear', color: '#60A5FA', theme: '高压清澈' },
            { name: 'Monsoon', color: '#34D399', theme: '霓虹雨潮' },
            { name: 'Thunder', color: '#A78BFA', theme: '风暴警戒' },
            { name: 'Frost', color: '#93C5FD', theme: '静默稳定' },
            { name: 'Aurora', color: '#F472B6', theme: '磁漂极光' },
            { name: 'Sand', color: '#FBBF24', theme: '金噪适应' },
            { name: 'Eclipse', color: '#6B7280', theme: '黑日权威' },
          ].map(house => (
            <div key={house.name} className="p-3 bg-black/60 rounded-lg border border-amber-500/10">
              <div className="w-6 h-6 rounded-full mb-2" style={{ backgroundColor: house.color }} />
              <p className="font-medium text-sm text-white">{house.name}</p>
              <p className="text-gray-500 text-xs">{house.theme}</p>
            </div>
          ))}
        </div>

        <h2>创世收藏</h2>
        <p>
          创世收藏共有 2,100 个预生成的智能体，分布在七大家族中。
          每个创世智能体都是"第 0 代"代币，可作为融合繁衍的亲本。
        </p>
      </div>
    ),
  },

  quickstart: {
    title: '快速入门指南',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">几分钟内开始使用 KinForge。按照以下步骤铸造你的第一个智能体。</p>

        <h2>步骤 1：连接钱包</h2>
        <p>
          点击导航栏中的"连接钱包"按钮。KinForge 支持 MetaMask、WalletConnect 和其他流行钱包。
          请确保你已连接到 BNB Chain（主网或测试网）。
        </p>

        <h2>步骤 2：选择家族</h2>
        <p>
          前往 <Link href="/mint" className="text-amber-400">铸造页面</Link> 并选择七大家族之一。
          每个家族都有独特的视觉特征和特征偏好。
        </p>

        <h2>步骤 3：预览智能体</h2>
        <p>
          选择家族后，你将看到一个随机选择的智能体预览。你可以点击"换一个"浏览不同的智能体。
          预览不需要连接钱包！
        </p>

        <h2>步骤 4：预订并铸造</h2>
        <p>
          当你找到喜欢的智能体后，点击"预订此智能体"将其锁定。这会创建带有可验证哈希的保险库条目。
          然后点击"铸造智能体"完成交易。
        </p>

        <h2>步骤 5：查看你的智能体</h2>
        <p>
          铸造完成后，你的智能体将出现在图鉴和你的钱包中。你可以在智能体详情页查看详细特征、
          血脉信息和保险库数据。
        </p>
      </div>
    ),
  },

  faq: {
    title: '常见问题',
    content: (
      <div className="prose prose-invert max-w-none">
        <h2>基础问题</h2>

        <h3>什么是 KinForge？</h3>
        <p>
          KinForge 是一个非同质化智能体平台，在 BNB Chain 上创建具有可验证成长和繁衍能力的可交易数字身份。
        </p>

        <h3>NFA 与 NFT 有什么不同？</h3>
        <p>
          NFA 是动态身份，可以学习、繁衍和执行动作。与静态 NFT 不同，它们内置了状态管理、
          学习根和血脉追踪功能。
        </p>

        <h3>创世智能体有多少个？</h3>
        <p>2,100 个创世智能体均匀分布在七大家族中（每个家族 300 个）。</p>

        <h2>铸造问题</h2>

        <h3>不连接钱包可以预览智能体吗？</h3>
        <p>
          可以！你可以在不连接钱包的情况下浏览和预览任何家族的智能体。
          只有在预订和铸造时才需要连接钱包。
        </p>

        <h3>铸造价格是多少？</h3>
        <p>
          铸造价格显示在铸造页面上，直接从智能合约读取。
          价格可能会根据白名单状态和当前阶段有所不同。
        </p>

        <h3>可以选择特定的智能体吗？</h3>
        <p>
          可以。预览会显示你所选家族的随机智能体。继续点击"换一个"
          直到找到喜欢的，然后预订锁定用于铸造。
        </p>

        <h2>融合问题</h2>

        <h3>融合是如何工作的？</h3>
        <p>
          融合将两个智能体结合以创造后代。它使用提交-揭示机制确保公平。
          你可以选择销毁铸造模式（销毁亲本）或封印模式（保留但封印亲本）。
        </p>

        <h3>后代特征如何确定？</h3>
        <p>
          后代特征由亲本特征、跨家族奖励、世代奖励和融合种子的确定性随机数组合决定。
        </p>
      </div>
    ),
  },

  'how-genesis-works': {
    title: '创世铸造机制',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">
          创世铸造采用预生成方式，所有 2,100 个智能体的特征、保险库数据和渲染图像在铸造开始前就已创建完成。
        </p>

        <h2>预生成资产</h2>
        <p>每个创世智能体都有以下预计算数据：</p>
        <ul>
          <li><strong>元数据 JSON</strong> — 兼容 OpenSea 的元数据，包含所有特征</li>
          <li><strong>保险库条目</strong> — 包含完整特征详情的链下保险库</li>
          <li><strong>vaultHash</strong> — 保险库 JSON 稳定字符串化后的 keccak256 哈希</li>
          <li><strong>learningRoot</strong> — 结合 vaultHash 和初始学习摘要的哈希</li>
          <li><strong>traitsHash</strong> — 用于链上验证的特征对象哈希</li>
          <li><strong>渲染图像</strong> — 1024x1024 Blender Cycles 渲染</li>
        </ul>

        <h2>铸造流程（S3 策略）</h2>
        <p>
          KinForge 使用"S3"tokenURI 策略，所有元数据参数在铸造时传入：
        </p>
        <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto border border-amber-500/10">
{`mintGenesisPublic(
  houseId,          // 1-7 对应七大家族
  persona,          // JSON 人格数据
  experience,       // "Genesis S0"
  vaultURI,         // 保险库 API 端点
  vaultHash,        // keccak256(vaultJson)
  learningRoot,     // keccak256(vaultHash + summaryHash)
  traitsHash,       // keccak256(traits)
  rarityTier,       // 0-4 (普通到神话)
  merkleProof[]     // 白名单铸造证明
)`}</pre>

        <h2>验证</h2>
        <p>任何人都可以验证智能体的真实性：</p>
        <ol>
          <li>从 vaultURI 获取保险库数据</li>
          <li>计算稳定字符串化 JSON 的 keccak256</li>
          <li>与链上 vaultHash 比对</li>
          <li>重复以上步骤验证 learningRoot</li>
        </ol>

        <h2>为什么使用预生成？</h2>
        <ul>
          <li><strong>确定性</strong> — 特征在铸造前固定且可验证</li>
          <li><strong>预览</strong> — 用户可以准确看到将获得什么</li>
          <li><strong>质量</strong> — 高质量 Blender 渲染需要时间</li>
          <li><strong>公平</strong> — 铸造期间无法操纵特征</li>
        </ul>
      </div>
    ),
  },

  'preview-vs-mint': {
    title: '预览与铸造流程',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">
          KinForge 提供独特的两阶段流程：无钱包预览，然后钱包预订和铸造。
        </p>

        <h2>预览模式（无需钱包）</h2>
        <p>在预览模式下，你可以：</p>
        <ul>
          <li>浏览任何家族的智能体</li>
          <li>查看完整特征详情和渲染图像</li>
          <li>点击"换一个"查看不同智能体</li>
          <li>无 Gas 压力，从容选择</li>
        </ul>
        <p>
          预览模式调用 <code>GET /api/genesis/preview/:house</code>，返回指定家族中一个随机可用的智能体。
        </p>

        <h2>预订阶段（需连接钱包）</h2>
        <p>当你找到喜欢的智能体后：</p>
        <ol>
          <li>连接你的钱包</li>
          <li>点击"预订此智能体"</li>
          <li>调用 <code>POST /api/genesis/reserve</code></li>
          <li>服务器创建保险库条目并返回铸造参数</li>
        </ol>
        <p>
          预订是免费的，不需要交易。它准备铸造所需的所有数据。
        </p>

        <h2>铸造阶段</h2>
        <p>预订后：</p>
        <ol>
          <li>查看保险库哈希和铸造价格</li>
          <li>点击"铸造智能体"</li>
          <li>在钱包中确认交易</li>
          <li>等待确认</li>
          <li>你的智能体现已上链！</li>
        </ol>

        <h2>流程图</h2>
        <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto text-sm border border-amber-500/10">
{`┌─────────────────┐
│    选择家族      │ ← 无需钱包
└────────┬────────┘
         ▼
┌─────────────────┐
│   预览智能体     │ ← 自由浏览
│    "换一个"      │
└────────┬────────┘
         ▼
┌─────────────────┐
│    连接钱包      │ ← 后续步骤必需
└────────┬────────┘
         ▼
┌─────────────────┐
│   预订智能体     │ ← 创建保险库（免费）
└────────┬────────┘
         ▼
┌─────────────────┐
│   铸造智能体     │ ← 链上交易
└────────┬────────┘
         ▼
┌─────────────────┐
│  在钱包中查看    │ ← 成功！
└─────────────────┘`}</pre>

        <h2>这种方式的优势</h2>
        <ul>
          <li><strong>低门槛</strong> — 无需钱包即可浏览</li>
          <li><strong>知情决策</strong> — 付款前看到确切特征</li>
          <li><strong>无惊喜</strong> — 预览即所得</li>
          <li><strong>Gas 效率</strong> — 链下预订，只需一次链上交易</li>
        </ul>
      </div>
    ),
  },

  bap578: {
    title: 'BAP-578 标准',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">
          BAP-578（区块链智能体协议）定义了非同质化智能体的接口，具备状态管理、学习能力和动作执行功能。
        </p>

        <h2>核心概念</h2>
        <h3>智能体状态</h3>
        <ul>
          <li><strong>活跃 (Active)</strong> — 正常运行状态</li>
          <li><strong>暂停 (Paused)</strong> — 临时暂停（可重新激活）</li>
          <li><strong>终止 (Terminated)</strong> — 永久停用</li>
        </ul>

        <h3>智能体元数据</h3>
        <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto border border-amber-500/10">
{`struct AgentMetadata {
  string persona;      // 身份/人格 JSON
  string experience;   // 世代和历史
  string vaultURI;     // 链下保险库位置
  bytes32 vaultHash;   // 保险库内容哈希
}`}</pre>

        <h3>学习状态</h3>
        <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto border border-amber-500/10">
{`bytes32 learningRoot;       // 学习的 Merkle 根
uint256 learningVersion;    // 更新时递增
uint256 lastLearningUpdate; // 时间戳`}</pre>

        <h2>关键函数</h2>
        <ul>
          <li><code>getState(tokenId)</code> — 返回当前智能体状态</li>
          <li><code>getAgentMetadata(tokenId)</code> — 返回完整元数据结构</li>
          <li><code>getLearningRoot(tokenId)</code> — 返回当前学习根</li>
          <li><code>updateLearning(tokenId, newRoot, newVersion)</code> — 更新学习状态</li>
        </ul>
      </div>
    ),
  },

  contracts: {
    title: '智能合约',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">KinForge 由两个主要合约组成：HouseForgeAgent 和 FusionCore。</p>

        <h2>HouseForgeAgent.sol</h2>
        <p>实现 BAP-578 标准的主 ERC-721 合约。</p>
        <h3>主要功能</h3>
        <ul>
          <li>带元数据扩展的 ERC-721</li>
          <li>BAP-578 状态管理</li>
          <li>学习根追踪</li>
          <li>血脉追踪（亲本、世代、家族）</li>
          <li>稀有度等级存储</li>
        </ul>

        <h2>FusionCore.sol</h2>
        <p>处理提交-揭示繁衍机制。</p>
        <h3>融合模式</h3>
        <ul>
          <li><strong>销毁铸造 (BURN_TO_MINT - 0)</strong> — 销毁双亲，铸造后代</li>
          <li><strong>封印 (SEAL - 1)</strong> — 封印双亲（不可转让），铸造后代</li>
        </ul>
      </div>
    ),
  },

  verification: {
    title: '保险库验证',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">
          了解如何根据链上哈希验证智能体的保险库数据。
        </p>

        <h2>验证步骤</h2>
        <ol>
          <li>从合约获取 <code>vaultURI</code> 和 <code>vaultHash</code></li>
          <li>从 vaultURI 获取保险库 JSON</li>
          <li>稳定字符串化 JSON（确定性键排序）</li>
          <li>计算 keccak256 哈希</li>
          <li>与链上 vaultHash 比对</li>
        </ol>

        <h2>代码示例</h2>
        <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto border border-amber-500/10">
{`import { keccak256, toUtf8Bytes } from 'ethers';
import stableStringify from 'json-stable-stringify';

async function verifyVault(vaultJson, onChainHash) {
  const canonical = stableStringify(vaultJson);
  const computed = keccak256(toUtf8Bytes(canonical));
  return computed === onChainHash;
}`}</pre>
      </div>
    ),
  },

  houses: {
    title: '七大天气家族',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">
          每个家族代表一种天气现象，具有独特的视觉美学和特征偏好。
        </p>

        <div className="space-y-8 not-prose">
          {[
            { name: 'CLEAR', theme: '高压清澈', color: '#60A5FA', desc: '精准、洞察、透明。Clear 家族智能体偏好极简框架、干净氛围和冷色调。' },
            { name: 'MONSOON', theme: '霓虹雨潮', color: '#34D399', desc: '适应、流动、更新。Monsoon 智能体具有水系材质、动态氛围和有机几何。' },
            { name: 'THUNDER', theme: '风暴警戒', color: '#A78BFA', desc: '能量、颠覆、力量。Thunder 智能体展示电能特征、铬金属框架和离子光晕。' },
            { name: 'FROST', theme: '静默稳定', color: '#93C5FD', desc: '守护、耐心、沉静。Frost 智能体展现晶体材质、冰冷氛围和冷色调。' },
            { name: 'AURORA', theme: '磁漂极光', color: '#F472B6', desc: '创意、视野、奇迹。Aurora 智能体具有全息材质、空灵光效和冷暖渐变。' },
            { name: 'SAND', theme: '金噪适应', color: '#FBBF24', desc: '耐久、生存、韧性。Sand 智能体展示风化表面、暖色调和沙漠几何。' },
            { name: 'ECLIPSE', theme: '黑日权威', color: '#6B7280', desc: '神秘、变革、秘密。Eclipse 智能体偏好暗色材质、宇宙光效和神秘氛围。' },
          ].map(house => (
            <div key={house.name} className="p-6 bg-black/60 rounded-xl border-l-4" style={{ borderLeftColor: house.color }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: house.color }} />
                <h3 className="text-xl font-bold text-white">{house.name}</h3>
              </div>
              <p className="text-amber-400 text-sm mb-2">{house.theme}</p>
              <p className="text-gray-300">{house.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  fusion: {
    title: '融合机制',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">
          融合是一个提交-揭示繁衍系统，将两个智能体结合创造具有继承和变异特征的后代。
        </p>

        <h2>提交阶段</h2>
        <ol>
          <li>选择你拥有的两个亲本智能体</li>
          <li>选择融合模式（销毁或封印）</li>
          <li>生成随机盐值（客户端）</li>
          <li>提交带哈希的提交交易</li>
        </ol>

        <h2>揭示阶段</h2>
        <ol>
          <li>等待最小延迟（防止抢跑）</li>
          <li>提交带盐值的揭示交易</li>
          <li>服务器从种子计算后代特征</li>
          <li>后代铸造到你的钱包</li>
        </ol>

        <h2>融合模式</h2>
        <h3>销毁铸造</h3>
        <ul>
          <li>双亲被销毁（毁灭）</li>
          <li>创造 1 个后代</li>
          <li>亲本从供应中永久移除</li>
        </ul>

        <h3>封印</h3>
        <ul>
          <li>双亲被封印（不可转让）</li>
          <li>创造 1 个后代</li>
          <li>亲本保留在钱包中但无法交易</li>
        </ul>

        <h2>特征遗传</h2>
        <ul>
          <li><strong>家族</strong>：同家族 = 100% 继承，跨家族 = 根据种子 70/30</li>
          <li><strong>核心特征</strong>：50% 继承自亲本，50% 加权随机</li>
          <li><strong>其他特征</strong>：20% 继承，80% 加权随机</li>
          <li><strong>稀有度</strong>：亲本平均值 + 奖励</li>
        </ul>
      </div>
    ),
  },

  traits: {
    title: '特征系统',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">
          智能体有三类特征：身份特征、核心特征和视觉特征。
        </p>

        <h2>身份特征</h2>
        <ul>
          <li><strong>季节 (Season)</strong> — 创世为 S0，未来季节为 S1+</li>
          <li><strong>家族 (House)</strong> — 七大家族之一</li>
          <li><strong>稀有度 (RarityTier)</strong> — 普通、稀有、精良、史诗、神话</li>
          <li><strong>基因ID (WeatherID)</strong> — 唯一标识符 (S0-HOUSE-XXXX)</li>
        </ul>

        <h2>核心特征（4 个）</h2>
        <p>核心特征具有最大的视觉影响，在遗传中权重更高：</p>
        <ul>
          <li><strong>框架类型 (FrameType)</strong> — 外框材质和表面处理</li>
          <li><strong>核心材质 (CoreMaterial)</strong> — 中心材质/效果</li>
          <li><strong>光纹标识 (LightSignature)</strong> — 光效</li>
          <li><strong>器纹标记 (InstrumentMark)</strong> — 叠加标记和指示器</li>
        </ul>

        <h2>视觉特征（6 个）</h2>
        <ul>
          <li><strong>氛围 (Atmosphere)</strong> — 环境效果</li>
          <li><strong>场景几何 (DioramaGeometry)</strong> — 容器形状</li>
          <li><strong>色温 (PaletteTemperature)</strong> — 颜色温度</li>
          <li><strong>表面纹理 (SurfaceAging)</strong> — 磨损程度</li>
          <li><strong>微雕 (MicroEngraving)</strong> — 表面细节</li>
          <li><strong>光晕 (LensBloom)</strong> — 相机光晕效果</li>
        </ul>
      </div>
    ),
  },

  rendering: {
    title: '渲染管线',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">
          KinForge 使用 Blender Cycles 进行高质量 GPU 渲染智能体图像。
        </p>

        <h2>规格</h2>
        <ul>
          <li><strong>分辨率</strong>：1024x1024 像素</li>
          <li><strong>格式</strong>：带 Alpha 通道的 PNG</li>
          <li><strong>引擎</strong>：Blender Cycles（GPU 加速）</li>
          <li><strong>采样</strong>：256 采样，平衡质量与速度</li>
        </ul>

        <h2>配方系统</h2>
        <p>每个智能体都有一个渲染配方 JSON，将特征映射到 Blender 参数：</p>
        <ul>
          <li>材质配置</li>
          <li>灯光设置</li>
          <li>相机位置</li>
          <li>后期处理效果</li>
        </ul>
      </div>
    ),
  },

  api: {
    title: 'API 参考',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">保险库、元数据、图像和融合的服务器 API 端点。</p>

        <h2>创世端点</h2>
        <h3>GET /api/genesis/preview/:house</h3>
        <p>获取指定家族的随机预览智能体。</p>

        <h3>GET /api/genesis/available/:house</h3>
        <p>列出某家族可用（未铸造）的智能体。</p>

        <h3>POST /api/genesis/reserve</h3>
        <p>预订智能体用于铸造。创建保险库并返回铸造参数。</p>

        <h2>保险库端点</h2>
        <h3>POST /api/vault/create</h3>
        <p>创建新的保险库条目。返回 vaultId、vaultURI、vaultHash、learningRoot。</p>

        <h3>GET /api/vault/:id</h3>
        <p>根据 ID 获取保险库。</p>

        <h3>GET /api/vault/token/:tokenId</h3>
        <p>根据代币 ID 获取保险库。</p>

        <h2>元数据端点</h2>
        <h3>GET /api/metadata/:tokenId</h3>
        <p>获取代币的 OpenSea 兼容元数据。</p>

        <h3>GET /api/metadata/collection</h3>
        <p>获取收藏级别元数据。</p>

        <h2>图像端点</h2>
        <h3>GET /api/images/:tokenId.png</h3>
        <p>获取代币的渲染图像。</p>

        <h2>统计端点</h2>
        <h3>GET /api/stats</h3>
        <p>获取收藏统计（供应量、分布等）。</p>

        <h3>GET /api/health</h3>
        <p>健康检查端点。</p>
      </div>
    ),
  },

  integration: {
    title: '集成指南',
    content: (
      <div className="prose prose-invert max-w-none">
        <p className="lead">
          使用 wagmi 和 viem 基于 KinForge 进行构建。
        </p>

        <h2>安装</h2>
        <pre className="bg-black/60 p-4 rounded-lg border border-amber-500/10">
{`npm install wagmi viem @tanstack/react-query`}</pre>

        <h2>读取智能体数据</h2>
        <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto border border-amber-500/10">
{`import { useReadContract } from 'wagmi';
import { HOUSE_FORGE_AGENT_ABI } from '@/config/contracts';

function useAgentMetadata(tokenId: number) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'getMetadata',
    args: [BigInt(tokenId)],
  });
}`}</pre>

        <h2>铸造</h2>
        <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto border border-amber-500/10">
{`import { useWriteContract } from 'wagmi';

function useMintGenesis() {
  const { writeContract } = useWriteContract();

  return (params) => writeContract({
    address: CONTRACT_ADDRESS,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'mintGenesisPublic',
    args: [...params],
    value: mintPrice,
  });
}`}</pre>
      </div>
    ),
  },
};

export default function DocPage() {
  const params = useParams();
  const slug = params.slug as string;
  const doc = DOCS[slug];

  useEffect(() => {
    trackDocView(slug);
  }, [slug]);

  if (!doc) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold mb-4 text-white">文档未找到</h1>
        <p className="text-gray-400 mb-6">请求的文档页面不存在。</p>
        <Link href="/docs" className="btn-primary">返回文档</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/docs" className="text-gray-400 hover:text-amber-400 text-sm mb-6 inline-block">
        ← 返回文档中心
      </Link>
      <h1 className="text-3xl font-bold mb-8 text-white">{doc.title}</h1>
      <div className="text-gray-300 leading-relaxed">{doc.content}</div>
    </div>
  );
}
