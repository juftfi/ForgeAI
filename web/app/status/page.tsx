'use client';

import { useState, useEffect } from 'react';
import { useChainId } from 'wagmi';
import { CONTRACTS, HOUSES } from '@/config/contracts';

interface HealthStatus {
  status: string;
  timestamp: string;
}

interface RenderStatus {
  totalJobs: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  createdAt?: string;
  updatedAt?: string;
}

interface Stats {
  totalSupply: number;
  generatedMetadata: number;
  houses: { key: string; count: number }[];
}

export default function StatusPage() {
  const chainId = useChainId();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    async function fetchStatus() {
      setLoading(true);
      try {
        const [healthRes, renderRes, statsRes] = await Promise.allSettled([
          fetch(`${apiUrl}/health`),
          fetch(`${apiUrl}/render/status`),
          fetch(`${apiUrl}/stats`),
        ]);

        if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
          setHealth(await healthRes.value.json());
        }
        if (renderRes.status === 'fulfilled' && renderRes.value.ok) {
          setRenderStatus(await renderRes.value.json());
        }
        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          setStats(await statsRes.value.json());
        }
      } catch (e) {
        console.error('Failed to fetch status:', e);
      }
      setLoading(false);
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [apiUrl]);

  const agentAddress = CONTRACTS.HouseForgeAgent[56]; // BSC Mainnet only
  const fusionAddress = CONTRACTS.FusionCore[56]; // BSC Mainnet only
  const isMainnet = chainId === 56;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gold-gradient">
          系统状态
        </h1>
        <p className="text-gray-400">
          KinForge 基础设施实时状态
        </p>
      </div>

      {/* Overall Status */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-amber-400">总体状态</h2>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            health?.status === 'ok' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
            {health?.status === 'ok' ? '运行正常' : loading ? '检查中...' : '部分降级'}
          </div>
        </div>
        {health && (
          <p className="text-gray-500 text-sm">
            上次检查: {new Date(health.timestamp).toLocaleString('zh-CN')}
          </p>
        )}
      </div>

      {/* Network & Contracts */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 text-amber-400">网络与合约</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-black/60 rounded-lg border border-amber-500/10">
            <div>
              <div className="font-medium text-white">网络</div>
              <div className="text-gray-400 text-sm">BNB 智能链</div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm ${
              !isMainnet ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
            }`}>
              {!isMainnet ? '测试网 (97)' : '主网 (56)'}
            </div>
          </div>

          <div className="p-4 bg-black/60 rounded-lg border border-amber-500/10">
            <div className="font-medium mb-2 text-white">KinForgeAgent 合约</div>
            <div className="font-mono text-sm text-gray-400 break-all">{agentAddress}</div>
            {agentAddress !== '0x0000000000000000000000000000000000000000' && (
              <a
                href={`https://${!isMainnet ? 'testnet.' : ''}bscscan.com/address/${agentAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 text-sm hover:text-amber-300 mt-2 inline-block"
              >
                在 BSCScan 上查看 →
              </a>
            )}
          </div>

          <div className="p-4 bg-black/60 rounded-lg border border-amber-500/10">
            <div className="font-medium mb-2 text-white">FusionCore 合约</div>
            <div className="font-mono text-sm text-gray-400 break-all">{fusionAddress}</div>
            {fusionAddress !== '0x0000000000000000000000000000000000000000' && (
              <a
                href={`https://${!isMainnet ? 'testnet.' : ''}bscscan.com/address/${fusionAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 text-sm hover:text-amber-300 mt-2 inline-block"
              >
                在 BSCScan 上查看 →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* API Endpoints */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 text-amber-400">API 端点</h2>
        <div className="space-y-3">
          {[
            { name: '保险库 API', endpoint: '/vault/:id', status: health ? 'online' : 'unknown' },
            { name: '元数据 API', endpoint: '/metadata/:tokenId', status: health ? 'online' : 'unknown' },
            { name: '图片 API', endpoint: '/images/:tokenId.webp', status: health ? 'online' : 'unknown' },
            { name: '融合 API', endpoint: '/fusion/prepare-reveal', status: health ? 'online' : 'unknown' },
            { name: '统计 API', endpoint: '/stats', status: stats ? 'online' : 'unknown' },
          ].map(api => (
            <div key={api.name} className="flex items-center justify-between p-3 bg-black/60 rounded-lg border border-amber-500/10">
              <div>
                <div className="font-medium text-white">{api.name}</div>
                <div className="text-gray-500 text-sm font-mono">{api.endpoint}</div>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                api.status === 'online' ? 'bg-green-500' : 'bg-gray-500'
              }`} />
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-black/60 rounded-lg border border-amber-500/10">
          <div className="text-gray-400 text-sm">基础 URL</div>
          <div className="font-mono text-sm text-white">{apiUrl}</div>
        </div>
      </div>

      {/* Render Pipeline Status */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 text-amber-400">渲染管线</h2>
        {renderStatus ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-black/60 rounded-lg text-center border border-amber-500/10">
                <div className="text-2xl font-bold text-white">{renderStatus.totalJobs}</div>
                <div className="text-gray-400 text-sm">总任务数</div>
              </div>
              <div className="p-4 bg-black/60 rounded-lg text-center border border-amber-500/10">
                <div className="text-2xl font-bold text-green-400">{renderStatus.completed}</div>
                <div className="text-gray-400 text-sm">已完成</div>
              </div>
              <div className="p-4 bg-black/60 rounded-lg text-center border border-amber-500/10">
                <div className="text-2xl font-bold text-yellow-400">{renderStatus.pending}</div>
                <div className="text-gray-400 text-sm">等待中</div>
              </div>
              <div className="p-4 bg-black/60 rounded-lg text-center border border-amber-500/10">
                <div className="text-2xl font-bold text-red-400">{renderStatus.failed}</div>
                <div className="text-gray-400 text-sm">失败</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">进度</span>
                <span className="text-white">
                  {((renderStatus.completed / renderStatus.totalJobs) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-black/60 rounded-full overflow-hidden border border-amber-500/10">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-500"
                  style={{ width: `${(renderStatus.completed / renderStatus.totalJobs) * 100}%` }}
                />
              </div>
            </div>

            {renderStatus.updatedAt && (
              <p className="text-gray-500 text-sm">
                上次更新: {new Date(renderStatus.updatedAt).toLocaleString('zh-CN')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-400">无法获取渲染状态</p>
        )}
      </div>

      {/* Collection Stats */}
      {stats && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4 text-amber-400">收藏统计</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-black/60 rounded-lg text-center border border-amber-500/10">
              <div className="text-2xl font-bold text-amber-400">{stats.totalSupply}</div>
              <div className="text-gray-400 text-sm">总供应量</div>
            </div>
            <div className="p-4 bg-black/60 rounded-lg text-center border border-amber-500/10">
              <div className="text-2xl font-bold text-yellow-400">{stats.generatedMetadata}</div>
              <div className="text-gray-400 text-sm">已生成元数据</div>
            </div>
            <div className="p-4 bg-black/60 rounded-lg text-center border border-amber-500/10">
              <div className="text-2xl font-bold text-green-400">7</div>
              <div className="text-gray-400 text-sm">家族数</div>
            </div>
          </div>

          <h3 className="font-medium mb-3 text-white">每家族智能体数</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {stats.houses.map(h => (
              <div key={h.key} className="flex items-center gap-2 p-2 bg-black/60 rounded-lg border border-amber-500/10">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: HOUSES[Object.keys(HOUSES).find(k => HOUSES[Number(k) as keyof typeof HOUSES].name === h.key) as unknown as keyof typeof HOUSES]?.color || '#fbbf24' }}
                />
                <span className="text-sm text-white">{h.key}</span>
                <span className="text-gray-400 text-sm ml-auto">{h.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-gray-500 text-sm">
        每 30 秒自动刷新
      </div>
    </div>
  );
}
