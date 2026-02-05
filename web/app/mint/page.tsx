'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId, useSimulateContract } from 'wagmi';
import { parseEther, formatEther, decodeEventLog } from 'viem';
import Link from 'next/link';
import { CONTRACTS, HOUSE_FORGE_AGENT_ABI } from '@/config/contracts';
import { trackEvent, trackMintAttempt } from '@/lib/analytics';

// 七大天气家族 - KinForge Weather Theme
const HOUSE_DATA = {
  CLEAR: { id: 1, name: 'Clear 家族', theme: '高压清澈', desc: '精准、洞察、透明', color: '#60A5FA' },
  MONSOON: { id: 2, name: 'Monsoon 家族', theme: '霓虹雨潮', desc: '适应、流动、更新', color: '#34D399' },
  THUNDER: { id: 3, name: 'Thunder 家族', theme: '风暴警戒', desc: '能量、颠覆、力量', color: '#A78BFA' },
  FROST: { id: 4, name: 'Frost 家族', theme: '静默稳定', desc: '守护、耐心、沉静', color: '#93C5FD' },
  AURORA: { id: 5, name: 'Aurora 家族', theme: '磁漂极光', desc: '创意、视野、奇迹', color: '#F472B6' },
  SAND: { id: 6, name: 'Sand 家族', theme: '金噪适应', desc: '耐久、生存、韧性', color: '#FBBF24' },
  ECLIPSE: { id: 7, name: 'Eclipse 家族', theme: '黑日权威', desc: '神秘、变革、秘密', color: '#6B7280' },
};

// 特征名称中英对照
const TRAIT_LABELS: Record<string, string> = {
  'RarityTier': '稀有度',
  'WeatherID': '基因编号',
  'FrameType': '框架类型',
  'CoreMaterial': '核心材质',
  'LightSignature': '光谱特征',
  'InstrumentMark': '仪器标记',
  'Atmosphere': '氛围',
  'DioramaGeometry': '几何结构',
  'PaletteTemperature': '色温',
  'SurfaceAging': '表面老化',
  'MicroEngraving': '微雕纹',
  'LensBloom': '镜光',
};

interface PreviewAgent {
  tokenId: number;
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes: { trait_type: string; value: string }[];
  };
  hasRender: boolean;
  imageUrl: string | null;
}

interface ReservedAgent {
  tokenId: number;
  metadata: PreviewAgent['metadata'];
  vault: {
    vaultId: string;
    vaultURI: string;
    vaultHash: string;
    learningRoot: string;
  };
  mintParams: {
    houseId: number;
    persona: string;
    experience: string;
    vaultURI: string;
    vaultHash: string;
    learningRoot: string;
    traitsHash: string;
    rarityTier: number;
  };
}

export default function MintPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [selectedHouse, setSelectedHouse] = useState<string | null>(null);
  const [reservedAgent, setReservedAgent] = useState<ReservedAgent | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [actualMintedTokenId, setActualMintedTokenId] = useState<number | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const contractAddress = CONTRACTS.HouseForgeAgent[56]; // BSC Mainnet only

  // Read mint price from contract
  const { data: mintPrice } = useReadContract({
    address: contractAddress,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'publicPrice',
  });

  const { data: mintActive } = useReadContract({
    address: contractAddress,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'publicMintActive',
  });

  const { writeContract, data: hash, isPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });

  // 从交易回执中解析实际铸造的 tokenId
  useEffect(() => {
    if (isSuccess && receipt?.logs) {
      // 查找 Transfer 事件 (topic0 = Transfer(address,address,uint256))
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      const transferLog = receipt.logs.find(log => log.topics[0] === transferTopic);
      if (transferLog && transferLog.topics[3]) {
        // topics[3] 是 tokenId (indexed)
        const tokenId = parseInt(transferLog.topics[3], 16);
        console.log('[Mint] Actual minted tokenId:', tokenId);
        setActualMintedTokenId(tokenId);
      }
    }
  }, [isSuccess, receipt]);

  // 模拟铸造交易，提前检测错误
  const { error: simulateError, isError: isSimulateError } = useSimulateContract({
    address: contractAddress,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'mintGenesisPublic',
    args: reservedAgent ? [
      reservedAgent.mintParams.houseId,
      reservedAgent.mintParams.persona,
      reservedAgent.mintParams.experience,
      reservedAgent.mintParams.vaultURI,
      reservedAgent.mintParams.vaultHash as `0x${string}`,
      reservedAgent.mintParams.learningRoot as `0x${string}`,
      reservedAgent.mintParams.traitsHash as `0x${string}`,
      reservedAgent.mintParams.rarityTier,
      [],
    ] : undefined,
    value: mintPrice as bigint || parseEther('0.01'),
    query: { enabled: !!reservedAgent && !!address && !isSuccess },
  });

  // 解析模拟错误
  const getSimulateErrorMessage = (): string | null => {
    if (!simulateError) return null;
    const msg = simulateError.message || '';
    if (msg.includes('Already minted') || msg.includes('ERC721')) {
      return '此智能体已被铸造，请换一个。';
    }
    if (msg.includes('Not active')) {
      return '铸造尚未开放。';
    }
    if (msg.includes('Invalid')) {
      return '参数无效，请刷新页面重试。';
    }
    if (msg.includes('insufficient funds')) {
      return '余额不足。';
    }
    return '预检失败，此智能体可能已被铸造。请取消预订后重试。';
  };

  // 用户取消钱包签名时自动重置状态
  useEffect(() => {
    if (writeError) {
      const msg = writeError.message || '';
      if (msg.includes('User rejected') || msg.includes('User denied')) {
        // 用户取消，静默重置
        resetWrite();
      }
    }
  }, [writeError, resetWrite]);

  // 取消预订，重新选择
  const cancelReservation = () => {
    setReservedAgent(null);
    resetWrite();
  };

  // 解析用户友好的错误信息
  const getErrorMessage = (error: Error | null): string | null => {
    if (!error) return null;
    const msg = error.message || '';

    // 用户取消
    if (msg.includes('User rejected') || msg.includes('User denied')) {
      return null; // 不显示任何错误，用户主动取消
    }
    // 余额不足
    if (msg.includes('insufficient funds') || msg.includes('Insufficient')) {
      return '余额不足，请确保有足够的 BNB 支付铸造费用和 Gas。';
    }
    // 合约错误
    if (msg.includes('execution reverted')) {
      if (msg.includes('Not active')) return '铸造尚未开放。';
      if (msg.includes('Already minted')) return '此智能体已被铸造。';
      if (msg.includes('Invalid')) return '参数无效，请刷新页面重试。';
      return '交易被合约拒绝，请刷新页面重试。';
    }
    // 其他错误 - 简化显示
    return '交易失败，请重试。';
  };

  // Reserve agent for minting - 方案3: 只传 house，系统自动分配 tokenId
  const reserveAgent = async () => {
    if (!selectedHouse) return;

    setIsReserving(true);
    setReserveError(null);

    try {
      const res = await fetch(`${API_URL}/genesis/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 方案3: 只传 house，后端自动分配匹配的 tokenId
        body: JSON.stringify({ house: selectedHouse }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reserve agent');
      }
      const data = await res.json();
      setReservedAgent(data);
      trackEvent('reserve_agent', { tokenId: data.tokenId, house: selectedHouse });
    } catch (err: any) {
      setReserveError(err.message || '预订智能体失败。请重试。');
    } finally {
      setIsReserving(false);
    }
  };

  // Handle mint transaction
  const handleMint = async () => {
    if (!reservedAgent || !address) return;

    trackMintAttempt(reservedAgent.tokenId, selectedHouse || 'unknown');

    const price = mintPrice || parseEther('0.05');

    writeContract({
      address: contractAddress,
      abi: HOUSE_FORGE_AGENT_ABI,
      functionName: 'mintGenesisPublic',
      args: [
        reservedAgent.mintParams.houseId,
        reservedAgent.mintParams.persona,
        reservedAgent.mintParams.experience,
        reservedAgent.mintParams.vaultURI,
        reservedAgent.mintParams.vaultHash as `0x${string}`,
        reservedAgent.mintParams.learningRoot as `0x${string}`,
        reservedAgent.mintParams.traitsHash as `0x${string}`,
        reservedAgent.mintParams.rarityTier,
        [], // No merkle proof for public mint
      ],
      value: price as bigint,
    });
  };

  // Get trait value from reserved agent metadata
  const getTraitValue = (traitType: string): string => {
    if (!reservedAgent?.metadata) return '—';
    const attr = reservedAgent.metadata.attributes.find((a: { trait_type: string; value: string }) => a.trait_type === traitType);
    return attr?.value || '—';
  };

  // Get Chinese label for trait
  const getTraitLabel = (traitType: string): string => {
    return TRAIT_LABELS[traitType] || traitType;
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-sm text-amber-300 mb-2">
          创世系列 — 2,100 智能体
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gold-gradient">
          铸造你的创世智能体
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          选择你的家族，预览你的智能体，然后铸造。每个智能体都有预生成的特征、保险库数据和可验证哈希。
        </p>
      </div>

      {/* House Selection */}
      <section className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 text-amber-400">1. 选择你的家族</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {Object.entries(HOUSE_DATA).map(([key, house]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedHouse(key);
                setReservedAgent(null); // 重置已预订的 agent
                setReserveError(null);
              }}
              className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                selectedHouse === key
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-amber-500/10 hover:border-amber-500/30 bg-black/60'
              }`}
            >
              <div
                className="w-12 h-12 mx-auto rounded-full mb-3 opacity-80"
                style={{ backgroundColor: house.color }}
              />
              <p className="font-medium text-center text-sm text-white">{house.name}</p>
              <p className="text-amber-400/60 text-xs mt-1 text-center truncate">{house.theme}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Assigned Agent Section - 只在已预订后显示分配的智能体详情 */}
      {reservedAgent && (
        <section className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4 text-amber-400">已分配的智能体</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Agent Image */}
            <div className="relative aspect-square rounded-xl overflow-hidden bg-black/80 border border-amber-500/20">
              {/* 优先加载渲染图片，失败后用占位符 SVG */}
              <img
                src={`${API_URL}/images/${reservedAgent.tokenId}.webp`}
                alt={reservedAgent.metadata.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // 渲染图片加载失败，尝试占位符 SVG
                  const target = e.target as HTMLImageElement;
                  target.src = `${API_URL}/placeholder/${reservedAgent.tokenId}.svg`;
                  target.onerror = () => {
                    // 占位符也失败，显示颜色圆圈
                    target.style.display = 'none';
                    const placeholder = target.nextElementSibling as HTMLElement;
                    if (placeholder) placeholder.style.display = 'flex';
                  };
                }}
              />
              {/* 备用占位符 - 所有图片都加载失败时显示 */}
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ display: 'none' }}
              >
                <div
                  className="w-32 h-32 rounded-full opacity-60"
                  style={{ backgroundColor: HOUSE_DATA[selectedHouse as keyof typeof HOUSE_DATA]?.color }}
                />
              </div>
              {/* Rarity Badge */}
              <div className="absolute top-4 left-4">
                <div className="px-3 py-1 rounded-full bg-black/80 backdrop-blur-sm text-sm font-medium text-amber-400 border border-amber-500/30">
                  {getTraitValue('RarityTier')}
                </div>
              </div>
              {/* Token ID */}
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/80 backdrop-blur-sm text-sm text-gray-300 border border-gray-500/30">
                #{reservedAgent.tokenId}
              </div>
            </div>

            {/* Agent Details */}
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {reservedAgent.metadata.name.replace('HouseForge', 'KinForge').replace(/House\s+/g, '')}
                </h3>
                <p className="text-amber-400/70 text-sm mt-1">{getTraitValue('WeatherID')}</p>
              </div>

              {/* Core Traits */}
              <div className="grid grid-cols-2 gap-3">
                {['FrameType', 'CoreMaterial', 'LightSignature', 'InstrumentMark'].map(trait => (
                  <div key={trait} className="p-3 bg-black/60 rounded-lg border border-amber-500/10">
                    <p className="text-gray-500 text-xs">{getTraitLabel(trait)}</p>
                    <p className="font-medium text-sm truncate text-white">{getTraitValue(trait)}</p>
                  </div>
                ))}
              </div>

              {/* Secondary Traits */}
              <div className="grid grid-cols-3 gap-2">
                {['Atmosphere', 'DioramaGeometry', 'PaletteTemperature', 'SurfaceAging', 'MicroEngraving', 'LensBloom'].map(trait => (
                  <div key={trait} className="p-2 bg-black/40 rounded-lg text-center border border-amber-500/5">
                    <p className="text-gray-500 text-[10px]">{getTraitLabel(trait)}</p>
                    <p className="text-xs truncate text-gray-300">{getTraitValue(trait)}</p>
                  </div>
                ))}
              </div>

              {/* Assigned Badge */}
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-green-300 text-sm">
                  <span className="font-semibold">已分配</span> — 系统已为你分配 {HOUSE_DATA[selectedHouse as keyof typeof HOUSE_DATA]?.name} 家族的智能体 #{reservedAgent.tokenId}。
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Mint Section - 方案3: 选择 house 后直接显示铸造区 */}
      {selectedHouse && (
        <section className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4 text-amber-400">2. 预订并铸造</h2>

          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">连接钱包以铸造智能体</p>
              <p className="text-sm text-gray-500">
                选择家族后，连接钱包即可铸造。系统会自动为你分配一个该家族的智能体。
              </p>
            </div>
          ) : !reservedAgent ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-black/60 rounded-lg border border-amber-500/20">
                <div>
                  <p className="text-gray-400 text-sm">已选家族</p>
                  <p className="font-bold text-white">{HOUSE_DATA[selectedHouse as keyof typeof HOUSE_DATA]?.name}</p>
                  <p className="text-amber-400/70 text-xs">系统将自动分配该家族的可用智能体</p>
                </div>
                <button
                  onClick={reserveAgent}
                  disabled={isReserving}
                  className="btn-secondary"
                >
                  {isReserving ? '分配中...' : '预订智能体'}
                </button>
              </div>
              <p className="text-gray-500 text-sm text-center">
                点击预订后，系统会自动分配一个 {HOUSE_DATA[selectedHouse as keyof typeof HOUSE_DATA]?.name} 的智能体给你。
              </p>
              {reserveError && (
                <div className="p-4 rounded-lg bg-red-900/30 border border-red-500">
                  <p className="text-red-400 text-sm">{reserveError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Reserved Agent Info */}
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    <span className="font-semibold text-green-300">智能体已预订</span>
                  </div>
                  {!isSuccess && !isPending && !isConfirming && (
                    <button
                      onClick={cancelReservation}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      取消预订
                    </button>
                  )}
                </div>
                <p className="text-gray-400 text-sm">
                  保险库已创建，哈希值: <code className="text-xs text-amber-400">{reservedAgent.vault.vaultHash.slice(0, 18)}...</code>
                </p>
              </div>

              {/* Mint Price & Button */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">铸造价格</p>
                  <p className="text-2xl font-bold text-white">
                    {mintPrice ? formatEther(mintPrice as bigint) : '0.05'} BNB
                  </p>
                </div>
                <button
                  onClick={handleMint}
                  disabled={isPending || isConfirming || !mintActive || isSuccess || isSimulateError}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
                    !isPending && !isConfirming && mintActive && !isSuccess && !isSimulateError
                      ? 'btn-primary'
                      : 'bg-gray-700 cursor-not-allowed text-gray-400'
                  }`}
                >
                  {isSuccess
                    ? '已铸造'
                    : isPending
                    ? '请在钱包确认...'
                    : isConfirming
                    ? '铸造中...'
                    : !mintActive
                    ? '铸造未开放'
                    : isSimulateError
                    ? '无法铸造'
                    : '铸造智能体'}
                </button>
              </div>

              {/* 预检错误 - 提前发现问题 */}
              {isSimulateError && getSimulateErrorMessage() && (
                <div className="p-4 rounded-lg bg-orange-900/30 border border-orange-500">
                  <p className="text-orange-400 text-sm mb-2">
                    ⚠️ {getSimulateErrorMessage()}
                  </p>
                  <button
                    onClick={cancelReservation}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    取消预订，换一个智能体
                  </button>
                </div>
              )}

              {/* Transaction Status */}
              {hash && (
                <div className="p-4 rounded-lg bg-black/60 border border-amber-500/20">
                  <p className="text-sm text-gray-400">交易哈希:</p>
                  <a
                    href={`https://${chainId === 56 ? '' : 'testnet.'}bscscan.com/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 break-all text-sm"
                  >
                    {hash}
                  </a>
                </div>
              )}

              {isSuccess && (
                <div className="p-4 rounded-lg bg-green-900/30 border border-green-500">
                  <p className="text-green-400 mb-2">
                    成功铸造智能体 #{actualMintedTokenId || reservedAgent.tokenId}！
                  </p>
                  {actualMintedTokenId && actualMintedTokenId !== reservedAgent.tokenId && (
                    <p className="text-yellow-400 text-xs mb-2">
                      注意：合约分配的实际 Token ID 与预订 ID 不同
                    </p>
                  )}
                  <div className="flex gap-4 mt-3">
                    <Link href={`/agent/${actualMintedTokenId || reservedAgent.tokenId}`} className="text-amber-400 hover:text-amber-300 text-sm">
                      查看你的智能体 →
                    </Link>
                    <button
                      onClick={() => {
                        setReservedAgent(null);
                        setSelectedHouse(null);
                        setReserveError(null);
                        setActualMintedTokenId(null);
                        resetWrite();
                      }}
                      className="text-gray-400 hover:text-white text-sm"
                    >
                      铸造另一个
                    </button>
                  </div>
                </div>
              )}

              {writeError && getErrorMessage(writeError) && (
                <div className="p-4 rounded-lg bg-red-900/30 border border-red-500">
                  <p className="text-red-400 text-sm">
                    {getErrorMessage(writeError)}
                  </p>
                  <button
                    onClick={resetWrite}
                    className="text-xs text-gray-400 hover:text-white mt-2"
                  >
                    关闭
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* House Info Section */}
      <section className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 text-amber-400">关于家族</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(HOUSE_DATA).map(([key, house]) => (
            <div
              key={key}
              className={`p-4 rounded-lg transition-all ${
                selectedHouse === key
                  ? 'bg-amber-500/10 border border-amber-500/30'
                  : 'bg-black/40 border border-transparent hover:border-amber-500/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: house.color }}
                />
                <div>
                  <h4 className="font-medium text-white">{house.name}</h4>
                  <p className="text-amber-400/60 text-xs mb-1">{house.theme}</p>
                  <p className="text-gray-400 text-sm">{house.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Link */}
      <div className="text-center">
        <Link href="/docs/faq" className="text-amber-400 hover:text-amber-300 text-sm">
          有关于铸造的问题？查看常见问题 →
        </Link>
      </div>
    </div>
  );
}
