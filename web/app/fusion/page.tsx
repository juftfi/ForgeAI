'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useBlockNumber } from 'wagmi';
import {
  useCommitFusion,
  useRevealFusion,
  useCancelFusion,
  useFusionFee,
  useAgentOwner,
  useAgentLineage,
  useFusionApproval,
  useSetApprovalForAll,
  useHasActiveCommit,
  useGetCommitDetails,
  generateCommitHash,
  generateSalt,
} from '@/hooks/useContracts';
import { FusionMode, HOUSES, CONTRACTS } from '@/config/contracts';
import { useChainId } from 'wagmi';

// 家族名称映射
const HOUSE_NAMES: Record<number, string> = {
  1: 'Clear 家族',
  2: 'Monsoon 家族',
  3: 'Thunder 家族',
  4: 'Frost 家族',
  5: 'Aurora 家族',
  6: 'Sand 家族',
  7: 'Eclipse 家族',
};

interface FusionResult {
  offspring: {
    name: string;
    description: string;
    attributes: { trait_type: string; value: string }[];
  };
  vault: {
    vaultId: string;
    vaultURI: string;
    vaultHash: string;
    learningRoot: string;
  };
  offspringHouseId: number;
  offspringPersona: string;
  offspringExperience: string;
  offspringRarityTier: number;
  traitsHash: string;
  isMythic: boolean;
  mythicKey?: string;
}

type FusionStep = 'select' | 'review' | 'committed' | 'waiting' | 'revealed';

const STEP_LABELS: Record<FusionStep, string> = {
  'select': '选择',
  'review': '确认',
  'committed': '已提交',
  'waiting': '等待',
  'revealed': '已揭示',
};

function FusionPageContent() {
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const { data: blockNumber, refetch: refetchBlock } = useBlockNumber();

  const [parentA, setParentA] = useState(searchParams.get('parentA') || '');
  const [parentB, setParentB] = useState(searchParams.get('parentB') || '');
  const [salt, setSalt] = useState<`0x${string}` | ''>('');
  const [mode, setMode] = useState<FusionMode>(FusionMode.SEAL);
  const [step, setStep] = useState<FusionStep>('select');
  const [result, setResult] = useState<FusionResult | null>(null);
  const [commitBlock, setCommitBlock] = useState<bigint | null>(null);
  const [error, setError] = useState('');
  const [parentAValid, setParentAValid] = useState(false);
  const [parentBValid, setParentBValid] = useState(false);

  // Helper to get localStorage key for salt
  const getSaltKey = (pA: string, pB: string, addr: string) => `fusion_salt_${addr}_${pA}_${pB}`;

  // Save salt to localStorage when generated
  const saveSalt = (newSalt: `0x${string}`) => {
    if (address && parentA && parentB) {
      localStorage.setItem(getSaltKey(parentA, parentB, address), newSalt);
    }
    setSalt(newSalt);
  };

  // Load salt from localStorage
  useEffect(() => {
    if (address && parentA && parentB && !salt) {
      const savedSalt = localStorage.getItem(getSaltKey(parentA, parentB, address));
      if (savedSalt && savedSalt.startsWith('0x')) {
        setSalt(savedSalt as `0x${string}`);
      }
    }
  }, [address, parentA, parentB, salt]);

  // Poll block number every 3 seconds when in commit/waiting state
  useEffect(() => {
    if (step === 'committed' || step === 'waiting') {
      const interval = setInterval(() => {
        refetchBlock();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [step, refetchBlock]);

  // Contract hooks
  const { commit, isPending: commitPending, isSuccess: commitSuccess, hash: commitHash } = useCommitFusion();
  const { reveal, isPending: revealPending, isSuccess: revealSuccess, hash: revealHash } = useRevealFusion();
  const { cancel, isPending: cancelPending, isSuccess: cancelSuccess } = useCancelFusion();

  // Approval hooks
  const chainId = useChainId();
  const fusionCoreAddress = CONTRACTS.FusionCore[chainId as keyof typeof CONTRACTS.FusionCore] || CONTRACTS.FusionCore[97];
  const { data: isApproved, refetch: refetchApproval } = useFusionApproval(address);
  const { setApproval, isPending: approvePending, isSuccess: approveSuccess } = useSetApprovalForAll();

  // Refetch approval after success
  useEffect(() => {
    if (approveSuccess) {
      refetchApproval();
    }
  }, [approveSuccess, refetchApproval]);

  // Ownership checks
  const { data: ownerA } = useAgentOwner(parentA ? BigInt(parentA) : undefined);
  const { data: ownerB } = useAgentOwner(parentB ? BigInt(parentB) : undefined);
  const { data: lineageA } = useAgentLineage(parentA ? BigInt(parentA) : undefined);
  const { data: lineageB } = useAgentLineage(parentB ? BigInt(parentB) : undefined);

  // Fusion fee
  const { data: fusionFeeData } = useFusionFee(
    parentA ? BigInt(parentA) : undefined,
    parentB ? BigInt(parentB) : undefined
  );

  // Check for existing active commit
  const { data: hasActiveCommit, refetch: refetchActiveCommit } = useHasActiveCommit(
    address,
    parentA ? BigInt(parentA) : undefined,
    parentB ? BigInt(parentB) : undefined
  );
  const { data: existingCommit } = useGetCommitDetails(
    address,
    parentA ? BigInt(parentA) : undefined,
    parentB ? BigInt(parentB) : undefined
  );

  // Restore state from existing commit
  useEffect(() => {
    if (hasActiveCommit && existingCommit && parentA && parentB) {
      const commitData = existingCommit as { commitHash: string; commitBlock: bigint; revealed: boolean };
      if (commitData.commitBlock > BigInt(0) && !commitData.revealed) {
        setCommitBlock(commitData.commitBlock);
        setStep('waiting');
      }
    }
  }, [hasActiveCommit, existingCommit, parentA, parentB]);

  // Validate ownership
  useEffect(() => {
    if (address && ownerA) {
      setParentAValid(ownerA.toLowerCase() === address.toLowerCase());
    }
  }, [address, ownerA]);

  useEffect(() => {
    if (address && ownerB) {
      setParentBValid(ownerB.toLowerCase() === address.toLowerCase());
    }
  }, [address, ownerB]);

  // Handle commit success - only set commitBlock ONCE
  useEffect(() => {
    if (commitSuccess && blockNumber && !commitBlock) {
      setCommitBlock(blockNumber);
      setStep('waiting');
    }
  }, [commitSuccess, blockNumber, commitBlock]);

  // Handle reveal success
  useEffect(() => {
    if (revealSuccess) {
      setStep('revealed');
    }
  }, [revealSuccess]);

  // Handle cancel success
  useEffect(() => {
    if (cancelSuccess) {
      // Clear localStorage salt
      if (address && parentA && parentB) {
        localStorage.removeItem(getSaltKey(parentA, parentB, address));
      }
      // Reset state
      setSalt('');
      setCommitBlock(null);
      setStep('select');
      setError('');
      // Refetch active commit status
      refetchActiveCommit();
    }
  }, [cancelSuccess, address, parentA, parentB, refetchActiveCommit]);

  const handleGenerateSalt = () => {
    saveSalt(generateSalt());
  };

  const handleProceedToReview = () => {
    if (!parentA || !parentB) {
      setError('请选择两个亲本');
      return;
    }
    if (parentA === parentB) {
      setError('亲本必须不同');
      return;
    }
    if (!parentAValid || !parentBValid) {
      setError('请确保你拥有两个智能体');
      return;
    }
    if (!salt) {
      handleGenerateSalt();
    }
    setError('');
    setStep('review');
  };

  const handleCommit = async () => {
    if (!address || !salt) return;

    try {
      setError('');
      const currentBlock = blockNumber || BigInt(0);
      const commitHashValue = generateCommitHash(
        BigInt(parentA),
        BigInt(parentB),
        salt,
        currentBlock,
        address,
        mode
      );

      commit(BigInt(parentA), BigInt(parentB), commitHashValue, mode);
    } catch (err: any) {
      setError(err.message || '提交融合失败');
    }
  };

  const handleReveal = async () => {
    if (!salt) {
      setError('缺少盐值！请输入提交融合时生成的盐值。');
      return;
    }

    try {
      setError('');
      // Call backend to prepare reveal data
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/fusion/prepare-reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentAId: parseInt(parentA),
          parentBId: parseInt(parentB),
          salt,
          commitBlock: commitBlock?.toString(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || '准备揭示数据失败');
      }

      const data: FusionResult = await res.json();
      setResult(data);

      // Get fusion fee (totalFee is the first element)
      const fusionFee = fusionFeeData ? (fusionFeeData as [bigint, bigint, bigint, bigint])[0] : BigInt(0);

      // Call contract reveal with all parameters
      reveal(
        BigInt(parentA),
        BigInt(parentB),
        salt,
        data.vault.vaultURI,
        data.vault.vaultHash as `0x${string}`,
        data.vault.learningRoot as `0x${string}`,
        data.offspringPersona,
        data.offspringExperience,
        data.offspringHouseId,
        data.traitsHash as `0x${string}`,
        data.offspringRarityTier,
        fusionFee
      );
    } catch (err: any) {
      setError(err.message || '揭示融合失败');
    }
  };

  const handleCancel = () => {
    cancel(BigInt(parentA), BigInt(parentB));
  };

  const reset = () => {
    setParentA('');
    setParentB('');
    setSalt('');
    setResult(null);
    setStep('select');
    setCommitBlock(null);
    setError('');
  };

  const canReveal = commitBlock && blockNumber && blockNumber > commitBlock;
  // Cancel only available after commit expires (256 blocks)
  const MAX_COMMIT_AGE = BigInt(256);
  const canCancel = commitBlock && blockNumber && blockNumber > commitBlock + MAX_COMMIT_AGE;
  const blocksUntilCancel = commitBlock && blockNumber ? Number(commitBlock + MAX_COMMIT_AGE - blockNumber) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gold-gradient">
          融合实验室
        </h1>
        <p className="text-gray-400 mt-2">
          将两个智能体融合，创造拥有遗传和突变特征的新后代。
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex justify-center items-center gap-2">
        {(['select', 'review', 'committed', 'waiting', 'revealed'] as FusionStep[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s
                  ? 'bg-amber-600 text-white'
                  : getStepIndex(step) > i
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {getStepIndex(step) > i ? '✓' : i + 1}
            </div>
            {i < 4 && (
              <div
                className={`w-8 h-0.5 mx-1 ${
                  getStepIndex(step) > i ? 'bg-green-600' : 'bg-gray-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Connection Check */}
      {!isConnected && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-4 text-center">
          <p className="text-yellow-400">连接钱包以使用融合实验室</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-xl p-4 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Step 1: Select Parents */}
      {step === 'select' && (
        <div className="glass-card p-6 space-y-6">
          <h2 className="text-xl font-bold text-amber-400">选择亲本</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Parent A */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">亲本 A</label>
              <input
                type="number"
                value={parentA}
                onChange={e => setParentA(e.target.value)}
                placeholder="代币 ID"
                className="w-full bg-black/60 border border-amber-500/20 rounded-lg px-4 py-3 focus:border-amber-500/50 focus:outline-none text-white"
              />
              {parentA && ownerA && (
                <div className={`text-sm ${parentAValid ? 'text-green-400' : 'text-red-400'}`}>
                  {parentAValid ? '✓ 你拥有此智能体' : '✗ 不是你的智能体'}
                </div>
              )}
              {lineageA && (
                <div className="text-xs text-gray-500">
                  家族: {HOUSE_NAMES[lineageA.houseId] || '未知'} |
                  世代: {lineageA.generation.toString()}
                </div>
              )}
            </div>

            {/* Parent B */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">亲本 B</label>
              <input
                type="number"
                value={parentB}
                onChange={e => setParentB(e.target.value)}
                placeholder="代币 ID"
                className="w-full bg-black/60 border border-amber-500/20 rounded-lg px-4 py-3 focus:border-amber-500/50 focus:outline-none text-white"
              />
              {parentB && ownerB && (
                <div className={`text-sm ${parentBValid ? 'text-green-400' : 'text-red-400'}`}>
                  {parentBValid ? '✓ 你拥有此智能体' : '✗ 不是你的智能体'}
                </div>
              )}
              {lineageB && (
                <div className="text-xs text-gray-500">
                  家族: {HOUSE_NAMES[lineageB.houseId] || '未知'} |
                  世代: {lineageB.generation.toString()}
                </div>
              )}
            </div>
          </div>

          {/* Fusion Mode */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">融合模式</label>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setMode(FusionMode.SEAL)}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  mode === FusionMode.SEAL
                    ? 'border-amber-500 bg-amber-500/20'
                    : 'border-amber-500/20 hover:border-amber-500/40'
                }`}
              >
                <div className="font-medium text-white">封印亲本</div>
                <div className="text-sm text-gray-400 mt-1">
                  亲本被封印（无法再融合）但仍可交易
                </div>
              </button>
              <button
                onClick={() => setMode(FusionMode.BURN_TO_MINT)}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  mode === FusionMode.BURN_TO_MINT
                    ? 'border-amber-500 bg-amber-500/20'
                    : 'border-amber-500/20 hover:border-amber-500/40'
                }`}
              >
                <div className="font-medium text-white">销毁亲本</div>
                <div className="text-sm text-gray-400 mt-1">
                  亲本被销毁。后代获得稀有度加成。
                </div>
              </button>
            </div>
          </div>

          <button
            onClick={handleProceedToReview}
            disabled={!isConnected || !parentA || !parentB || !parentAValid || !parentBValid}
            className="w-full py-4 btn-primary text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            继续确认
          </button>
        </div>
      )}

      {/* Step 2: Review & Commit */}
      {step === 'review' && (
        <div className="glass-card p-6 space-y-6">
          <h2 className="text-xl font-bold text-amber-400">确认融合</h2>

          <div className="bg-black/60 rounded-lg p-4 space-y-3 border border-amber-500/20">
            <div className="flex justify-between">
              <span className="text-gray-400">亲本 A</span>
              <Link href={`/agent/${parentA}`} className="text-amber-400 hover:text-amber-300">
                智能体 #{parentA}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">亲本 B</span>
              <Link href={`/agent/${parentB}`} className="text-amber-400 hover:text-amber-300">
                智能体 #{parentB}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">模式</span>
              <span className="text-white">{mode === FusionMode.SEAL ? '封印亲本' : '销毁亲本'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">秘密盐值</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={salt}
                onChange={e => setSalt(e.target.value as `0x${string}`)}
                placeholder="0x..."
                className="flex-1 bg-black/60 border border-amber-500/20 rounded-lg px-4 py-2 font-mono text-xs text-white"
              />
              <button
                onClick={handleGenerateSalt}
                className="px-4 py-2 btn-secondary"
              >
                生成
              </button>
            </div>
            <p className="text-xs text-yellow-400">
              ⚠️ 请保存此盐值！揭示融合时需要使用它。
            </p>
          </div>

          {/* Approval Check */}
          {!isApproved && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-300 text-sm mb-3">
                ⚠️ 需要先授权 FusionCore 合约操作你的 NFT
              </p>
              <button
                onClick={() => setApproval(fusionCoreAddress as `0x${string}`, true)}
                disabled={approvePending}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
              >
                {approvePending ? '授权中...' : '授权 FusionCore'}
              </button>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setStep('select')}
              className="flex-1 py-3 btn-secondary"
            >
              返回
            </button>
            <button
              onClick={handleCommit}
              disabled={!salt || commitPending || !isApproved}
              className="flex-1 py-3 btn-primary disabled:opacity-50"
            >
              {commitPending ? '确认中...' : '提交融合'}
            </button>
          </div>

          {commitHash && (
            <div className="text-center text-sm">
              <a
                href={`https://bscscan.com/tx/${commitHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300"
              >
                查看交易 →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Step 3-4: Waiting */}
      {(step === 'committed' || step === 'waiting') && (
        <div className="glass-card p-6 space-y-6">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-white">融合已提交</h2>
            <p className="text-gray-400 mt-2">
              {canReveal
                ? '准备揭示！点击下方按钮。'
                : '等待区块确认...'}
            </p>
          </div>

          <div className="bg-black/60 rounded-lg p-4 space-y-2 text-sm border border-amber-500/20">
            <div className="flex justify-between">
              <span className="text-gray-400">提交区块</span>
              <span className="text-white">{commitBlock?.toString() || '处理中'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">当前区块</span>
              <div className="flex items-center gap-2">
                <span className="text-white">{blockNumber?.toString() || '加载中'}</span>
                <button
                  onClick={() => refetchBlock()}
                  className="text-amber-400 hover:text-amber-300 text-xs"
                  title="刷新区块"
                >
                  ↻
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">融合费用</span>
              <span className="text-amber-400">
                {fusionFeeData
                  ? `${(Number((fusionFeeData as [bigint, bigint, bigint, bigint])[0]) / 1e18).toFixed(4)} BNB`
                  : '计算中...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">状态</span>
              <span className={canReveal ? 'text-green-400' : 'text-yellow-400'}>
                {canReveal ? '准备揭示' : '等待中...'}
              </span>
            </div>
          </div>

          {/* Salt input for reveal */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">盐值 (Salt)</label>
            <input
              type="text"
              value={salt}
              onChange={(e) => setSalt(e.target.value as `0x${string}`)}
              placeholder="0x..."
              className="w-full bg-black/60 border border-amber-500/20 rounded-lg px-4 py-2 font-mono text-xs text-white"
            />
            {!salt && (
              <p className="text-xs text-red-400">
                ⚠️ 请输入提交融合时生成的盐值，否则无法揭示！
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleCancel}
              disabled={cancelPending || !canCancel}
              className="flex-1 py-3 bg-red-600/20 border border-red-600 rounded-lg font-medium hover:bg-red-600/30 transition-colors text-white disabled:opacity-50"
              title={canCancel ? '取消融合' : `还需等待 ${blocksUntilCancel} 个区块才能取消`}
            >
              {cancelPending ? '取消中...' : canCancel ? '取消融合' : `取消 (${blocksUntilCancel} 区块后)`}
            </button>
            <button
              onClick={handleReveal}
              disabled={!canReveal || revealPending || !salt}
              className="flex-1 py-3 btn-primary disabled:opacity-50"
            >
              {revealPending ? '揭示中...' : '揭示融合'}
            </button>
          </div>
          {!canCancel && canReveal && (
            <p className="text-xs text-gray-500 text-center">
              提示：只有当提交过期（256区块后）才能取消。建议先揭示融合。
            </p>
          )}
        </div>
      )}

      {/* Step 5: Revealed */}
      {step === 'revealed' && result && (
        <div className="space-y-6">
          <div className="glass-card p-6 text-center">
            <div className="text-6xl mb-4">{result.isMythic ? '🌟' : '✨'}</div>
            <h2 className="text-2xl font-bold text-white">
              {result.isMythic ? '神话诞生！' : '后代已创建！'}
            </h2>
            {result.isMythic && (
              <p className="text-yellow-400 font-bold text-xl mt-2">
                {result.mythicKey?.replace(/_/g, ' ')}
              </p>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            <div
              className="h-40 flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${HOUSES[result.offspringHouseId as keyof typeof HOUSES]?.color || '#fbbf24'}, transparent)`,
              }}
            >
              <span className="text-5xl font-bold text-white/40">新智能体</span>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-white">{result.offspring.name}</h3>
              <p className="text-gray-400 mt-2">{result.offspring.description}</p>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold mb-4 text-amber-400">遗传特征</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {result.offspring.attributes.map(attr => (
                <div key={attr.trait_type} className="bg-black/60 rounded-lg p-3 border border-amber-500/10">
                  <div className="text-xs text-gray-500">{attr.trait_type}</div>
                  <div className="font-medium text-white">{attr.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold mb-4 text-amber-400">保险库详情</h3>
            <div className="space-y-2 text-sm font-mono">
              <div>
                <span className="text-gray-500">保险库 URI: </span>
                <span className="break-all text-white">{result.vault.vaultURI}</span>
              </div>
              <div>
                <span className="text-gray-500">哈希: </span>
                <span className="break-all text-white">{result.vault.vaultHash}</span>
              </div>
            </div>
          </div>

          {revealHash && (
            <div className="text-center">
              <a
                href={`https://bscscan.com/tx/${revealHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300"
              >
                在 BSCScan 上查看交易 →
              </a>
            </div>
          )}

          <button
            onClick={reset}
            className="w-full py-4 btn-secondary"
          >
            开始新融合
          </button>
        </div>
      )}
    </div>
  );
}

function getStepIndex(step: FusionStep): number {
  const steps: FusionStep[] = ['select', 'review', 'committed', 'waiting', 'revealed'];
  return steps.indexOf(step);
}

export default function FusionPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">加载中...</p>
      </div>
    }>
      <FusionPageContent />
    </Suspense>
  );
}
