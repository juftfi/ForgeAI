'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { trackDocView } from '@/lib/analytics';

export default function WhitepaperPage() {
  useEffect(() => {
    trackDocView('whitepaper');
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-block px-4 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium mb-4">
          技术文档
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gold-gradient">
          ForgeAI 白皮书
        </h1>
        <p className="text-gray-400 text-lg">
          BNB Chain 上具有可验证成长能力的非同质化智能体
        </p>
        <p className="text-gray-500 text-sm mt-2">版本 1.0 — 2026 年 2 月</p>
      </div>

      {/* Table of Contents */}
      <nav className="glass-card p-6 mb-12">
        <h2 className="text-lg font-semibold mb-4 text-amber-400">目录</h2>
        <ul className="space-y-2 text-gray-400">
          <li><a href="#abstract" className="hover:text-amber-400 transition-colors">1. 摘要</a></li>
          <li><a href="#introduction" className="hover:text-amber-400 transition-colors">2. 简介</a></li>
          <li><a href="#architecture" className="hover:text-amber-400 transition-colors">3. 技术架构</a></li>
          <li><a href="#bap578" className="hover:text-amber-400 transition-colors">4. BAP-578 标准</a></li>
          <li><a href="#houses" className="hover:text-amber-400 transition-colors">5. 七大家族</a></li>
          <li><a href="#fusion" className="hover:text-amber-400 transition-colors">6. 融合机制</a></li>
          <li><a href="#rendering" className="hover:text-amber-400 transition-colors">7. 视觉渲染管线</a></li>
          <li><a href="#economics" className="hover:text-amber-400 transition-colors">8. 代币经济学</a></li>
          <li><a href="#roadmap" className="hover:text-amber-400 transition-colors">9. 路线图</a></li>
          <li><a href="#disclaimer" className="hover:text-amber-400 transition-colors">10. 法律声明</a></li>
        </ul>
      </nav>

      {/* Content */}
      <article className="prose prose-invert max-w-none space-y-12">
        {/* Abstract */}
        <section id="abstract">
          <h2 className="text-2xl font-bold text-white mb-4">1. 摘要</h2>
          <div className="glass-card p-6">
            <p className="text-gray-300 leading-relaxed">
              ForgeAI 引入了非同质化智能体（NFA）— 代表具有可验证成长能力的自主数字身份的 ERC-721 代币。
              基于 BNB Chain 构建并实现 BAP-578 标准，每个智能体属于七大家族之一，携带确定性特征，
              并可参与融合繁殖以创造具有遗传和突变特征的后代。
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              与代表静态图像的传统 NFT 不同，ForgeAI 智能体在链上维护元数据摘要，
              同时在链下保险库中存储扩展学习数据。所有保险库内容都可通过存储在链上的加密哈希
              （vaultHash、learningRoot）进行不可篡改的验证。
            </p>
          </div>
        </section>

        {/* Introduction */}
        <section id="introduction">
          <h2 className="text-2xl font-bold text-white mb-4">2. 简介</h2>
          <h3 className="text-xl font-semibold text-gray-200 mb-3">2.1 问题</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            传统 NFT 缺乏代表进化数字实体的基础设施。它们无法：
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-2 mb-6">
            <li>存储和验证学习或经验数据</li>
            <li>通过委托逻辑执行自主操作</li>
            <li>参与有意义的繁殖或组合机制</li>
            <li>维护具有加密来源证明的血统关系</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-200 mb-3">2.2 解决方案</h3>
          <p className="text-gray-300 leading-relaxed">
            ForgeAI 实现了 BAP-578，一个区块链原生智能体的协议标准。每个智能体都是一个一等数字身份，
            可以成长、学习和繁殖 — 所有这些都有透明、可验证的规则。
          </p>
        </section>

        {/* Architecture */}
        <section id="architecture">
          <h2 className="text-2xl font-bold text-white mb-4">3. 技术架构</h2>

          <h3 className="text-xl font-semibold text-gray-200 mb-3">3.1 智能合约</h3>
          <div className="bg-black/60 rounded-xl p-4 border border-amber-500/20 mb-6">
            <code className="text-sm text-amber-400">
              ForgeAIAgent.sol — 带有 BAP-578 扩展的核心 ERC-721<br/>
              FusionCore.sol — 提交-揭示融合繁殖系统<br/>
              DemoLogic.sol — 委托操作执行示例
            </code>
          </div>

          <h3 className="text-xl font-semibold text-gray-200 mb-3">3.2 元数据结构</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            每个智能体维护两层元数据：
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-2 mb-6">
            <li><strong className="text-gray-200">链上摘要：</strong> 人格、经验等级、vaultURI、vaultHash、learningRoot</li>
            <li><strong className="text-gray-200">链下保险库：</strong> 完整特征数据、学习历史、融合血统、性格变化</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-200 mb-3">3.3 验证</h3>
          <div className="glass-card p-4">
            <p className="text-gray-300 text-sm font-mono">
              vaultHash = keccak256(stableStringify(vaultJSON))<br/>
              learningRoot = keccak256(vaultHash || keccak256(summary))
            </p>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            任何人都可以获取保险库、重新计算哈希并与链上值进行验证。
          </p>
        </section>

        {/* BAP-578 */}
        <section id="bap578">
          <h2 className="text-2xl font-bold text-white mb-4">4. BAP-578 标准</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            BAP-578（区块链智能体协议 578）定义了非同质化智能体的接口：
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="glass-card p-4">
              <h4 className="font-semibold text-white mb-2">状态管理</h4>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• 活跃 / 暂停 / 终止状态</li>
                <li>• 所有者控制的状态转换</li>
                <li>• 不可逆终止（销毁/封印）</li>
              </ul>
            </div>
            <div className="glass-card p-4">
              <h4 className="font-semibold text-white mb-2">操作执行</h4>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• 委托逻辑地址</li>
                <li>• Gas 上限执行（500k）</li>
                <li>• 所有操作的事件日志</li>
              </ul>
            </div>
            <div className="glass-card p-4">
              <h4 className="font-semibold text-white mb-2">学习更新</h4>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• 版本化学习根</li>
                <li>• 时间戳追踪</li>
                <li>• 保险库哈希验证</li>
              </ul>
            </div>
            <div className="glass-card p-4">
              <h4 className="font-semibold text-white mb-2">血统追踪</h4>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• 亲本代币 ID</li>
                <li>• 世代计数器</li>
                <li>• 家族继承</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Houses */}
        <section id="houses">
          <h2 className="text-2xl font-bold text-white mb-4">5. 七大家族</h2>
          <p className="text-gray-300 leading-relaxed mb-6">
            每个智能体属于七大家族之一，每个家族都有独特的视觉锚点和特征偏好：
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'Clear', theme: '高压清澈', traits: '精准、洞察、透明', color: '#60A5FA' },
              { name: 'Monsoon', theme: '霓虹雨潮', traits: '适应、流动、更新', color: '#34D399' },
              { name: 'Thunder', theme: '风暴警戒', traits: '能量、颠覆、力量', color: '#A78BFA' },
              { name: 'Frost', theme: '静默稳定', traits: '守护、耐心、沉静', color: '#93C5FD' },
              { name: 'Aurora', theme: '磁漂极光', traits: '创意、视野、奇迹', color: '#F472B6' },
              { name: 'Sand', theme: '金噪适应', traits: '耐久、生存、韧性', color: '#FBBF24' },
              { name: 'Eclipse', theme: '黑日权威', traits: '神秘、变革、秘密', color: '#6B7280' },
            ].map(house => (
              <div key={house.name} className="glass-card overflow-hidden">
                <div className="h-2" style={{ backgroundColor: house.color }} />
                <div className="p-4">
                  <h4 className="font-bold text-white">{house.name} 家族</h4>
                  <p className="text-gray-400 text-sm">{house.theme}</p>
                  <p className="text-gray-500 text-xs mt-2">{house.traits}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fusion */}
        <section id="fusion">
          <h2 className="text-2xl font-bold text-white mb-4">6. 融合机制</h2>

          <h3 className="text-xl font-semibold text-gray-200 mb-3">6.1 提交-揭示流程</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            融合使用提交-揭示方案以确保公平、抗抢跑的繁殖：
          </p>
          <ol className="list-decimal list-inside text-gray-400 space-y-2 mb-6">
            <li><strong className="text-gray-200">提交：</strong> 用户提交 hash(parentA, parentB, salt, block, address, mode)</li>
            <li><strong className="text-gray-200">等待：</strong> 最少 1 个区块延迟防止操纵</li>
            <li><strong className="text-gray-200">揭示：</strong> 用户揭示盐值，特征从区块哈希确定性计算</li>
          </ol>

          <h3 className="text-xl font-semibold text-gray-200 mb-3">6.2 融合模式</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="glass-card p-4">
              <h4 className="font-semibold text-white mb-2">封印模式</h4>
              <p className="text-gray-400 text-sm">亲本被永久封印，无法再融合或转让。标准融合路径。</p>
            </div>
            <div className="glass-card p-4">
              <h4 className="font-semibold text-white mb-2">销毁铸造模式</h4>
              <p className="text-gray-400 text-sm">亲本被销毁。后代获得稀有度加成。高风险，高回报。</p>
            </div>
          </div>

          <h3 className="text-xl font-semibold text-gray-200 mb-3">6.3 特征继承</h3>
          <ul className="list-disc list-inside text-gray-400 space-y-2">
            <li><strong className="text-gray-200">家族：</strong> 相同家族 = 100% 继承，不同 = 70/30 由种子加权</li>
            <li><strong className="text-gray-200">稀有度：</strong> 亲本平均值 + 加成（跨家族 +1，销毁模式 +1）</li>
            <li><strong className="text-gray-200">核心特征：</strong> 50% 从亲本继承，50% 加权随机</li>
            <li><strong className="text-gray-200">视觉特征：</strong> 20% 继承，80% 加权随机带家族偏好</li>
          </ul>
        </section>

        {/* Rendering */}
        <section id="rendering">
          <h2 className="text-2xl font-bold text-white mb-4">7. 视觉渲染管线</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            每个智能体的视觉呈现使用 Blender Cycles 以专业级设置渲染：
          </p>

          <div className="glass-card p-4 mb-6">
            <h4 className="font-semibold text-white mb-2">渲染规格</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• 引擎：Blender 4.2.0 Cycles 配合 GPU/OptiX 加速</li>
              <li>• 分辨率：1024×1024 WEBP @ 90% 质量</li>
              <li>• 灯光：4 点发射平面柔光箱（主/补/轮廓/重点）</li>
              <li>• 采样：96 次自适应采样配合降噪</li>
              <li>• 材质：PBR 金属/玻璃配合家族特定 HDRI 环境</li>
            </ul>
          </div>

          <p className="text-gray-300 leading-relaxed">
            每个代币的视觉通过渲染配方从其特征确定性生成。recipeHash 确保任何人都可以验证用于任何渲染的确切参数。
          </p>
        </section>

        {/* Economics */}
        <section id="economics">
          <h2 className="text-2xl font-bold text-white mb-4">8. 代币经济学</h2>

          <h3 className="text-xl font-semibold text-gray-200 mb-3">8.1 创世供应</h3>
          <div className="glass-card p-4 mb-6">
            <ul className="text-gray-400 space-y-2">
              <li><strong className="text-gray-200">总供应量：</strong> 1,302 创世智能体（铸造已结束，永不增加）</li>
              <li><strong className="text-gray-200">家族分布：</strong> 7 大家族</li>
              <li><strong className="text-gray-200">铸造价格：</strong> 0.05 BNB</li>
            </ul>
          </div>

          <h3 className="text-xl font-semibold text-gray-200 mb-3">8.2 稀有度分布</h3>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {[
              { tier: '普通', pct: '62%', color: 'text-gray-300' },
              { tier: '稀有', pct: '23%', color: 'text-green-400' },
              { tier: '精良', pct: '10%', color: 'text-blue-400' },
              { tier: '史诗', pct: '4%', color: 'text-purple-400' },
              { tier: '神话', pct: '1%', color: 'text-yellow-400' },
            ].map(r => (
              <div key={r.tier} className="glass-card p-3 text-center">
                <div className={`font-bold ${r.color}`}>{r.tier}</div>
                <div className="text-gray-500 text-sm">{r.pct}</div>
              </div>
            ))}
          </div>

          <h3 className="text-xl font-semibold text-gray-200 mb-3">8.3 费用</h3>
          <ul className="text-gray-400 space-y-2">
            <li><strong className="text-gray-200">融合费用：</strong> 少量费用防止垃圾繁殖</li>
            <li><strong className="text-gray-200">学习更新：</strong> 仅需 Gas，无平台费</li>
          </ul>
        </section>

        {/* Roadmap */}
        <section id="roadmap">
          <h2 className="text-2xl font-bold text-white mb-4">9. 路线图</h2>

          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <h4 className="font-semibold text-white">第一阶段：创世发布</h4>
              </div>
              <ul className="text-gray-400 text-sm space-y-1 ml-6">
                <li>• 1,302 创世智能体已铸造完成</li>
                <li>• 铸造网站配合钱包集成</li>
                <li>• 融合实验室和血脉树工具</li>
                <li>• 完整文档和白皮书</li>
              </ul>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <h4 className="font-semibold text-white">第二阶段：运行时集成</h4>
              </div>
              <ul className="text-gray-400 text-sm space-y-1 ml-6">
                <li>• 操作执行的逻辑合约模板</li>
                <li>• 智能体人格 API</li>
                <li>• 第三方集成 SDK</li>
              </ul>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <h4 className="font-semibold text-white">第三阶段：Merkle 学习</h4>
              </div>
              <ul className="text-gray-400 text-sm space-y-1 ml-6">
                <li>• 基于 Merkle 树的学习状态存储</li>
                <li>• 可验证的经验累积</li>
                <li>• 跨智能体知识共享协议</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section id="disclaimer">
          <h2 className="text-2xl font-bold text-white mb-4">10. 法律声明</h2>
          <div className="glass-card p-6 border-l-4 border-yellow-500">
            <p className="text-gray-300 text-sm leading-relaxed">
              ForgeAI 智能体是 BNB Chain 上的数字收藏品。它们不是投资产品，不承诺任何财务回报。
              NFT 的价值可能会大幅波动，甚至可能变得毫无价值。用户只应使用他们能够承受损失的资金参与。
            </p>
            <p className="text-gray-300 text-sm leading-relaxed mt-3">
              本白皮书仅供参考，不构成财务、法律或投资建议。所述功能在开发过程中可能会发生变化。
              用户有责任了解区块链交易和智能合约交互的风险。
            </p>
          </div>
        </section>
      </article>

      {/* Footer Links */}
      <div className="mt-12 pt-8 border-t border-amber-500/20 flex flex-wrap gap-4 justify-center">
        <Link href="/docs" className="btn-secondary">
          阅读完整文档
        </Link>
        <Link href="/mint" className="btn-primary">
          铸造创世智能体
        </Link>
      </div>
    </div>
  );
}
