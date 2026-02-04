'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useChainId } from 'wagmi';
import { Address, keccak256, encodePacked, toHex } from 'viem';
import {
  CONTRACTS,
  HOUSE_FORGE_AGENT_ABI,
  FUSION_CORE_ABI,
  FusionMode,
} from '@/config/contracts';

// Get contract address for current chain
function useContractAddress(contract: keyof typeof CONTRACTS): Address {
  const chainId = useChainId();
  const addresses = CONTRACTS[contract];
  return addresses[chainId as keyof typeof addresses] || addresses[97];
}

// ==================== HouseForgeAgent Hooks ====================

export function useAgentBalance(owner: Address | undefined) {
  const address = useContractAddress('HouseForgeAgent');
  return useReadContract({
    address,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner },
  });
}

export function useAgentOwner(tokenId: bigint | undefined) {
  const address = useContractAddress('HouseForgeAgent');
  return useReadContract({
    address,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'ownerOf',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useAgentMetadata(tokenId: bigint | undefined) {
  const address = useContractAddress('HouseForgeAgent');
  return useReadContract({
    address,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'getMetadata',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useAgentLineage(tokenId: bigint | undefined) {
  const address = useContractAddress('HouseForgeAgent');
  return useReadContract({
    address,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'getLineage',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useAgentState(tokenId: bigint | undefined) {
  const address = useContractAddress('HouseForgeAgent');
  return useReadContract({
    address,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'getState',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useTotalSupply() {
  const address = useContractAddress('HouseForgeAgent');
  return useReadContract({
    address,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'totalSupply',
  });
}

export function useTokenOfOwnerByIndex(owner: Address | undefined, index: bigint) {
  const address = useContractAddress('HouseForgeAgent');
  return useReadContract({
    address,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'tokenOfOwnerByIndex',
    args: owner ? [owner, index] : undefined,
    query: { enabled: !!owner },
  });
}

// ==================== Approval Hooks ====================

export function useIsApprovedForAll(owner: Address | undefined, operator: Address) {
  const address = useContractAddress('HouseForgeAgent');
  return useReadContract({
    address,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'isApprovedForAll',
    args: owner ? [owner, operator] : undefined,
    query: { enabled: !!owner },
  });
}

export function useFusionApproval(owner: Address | undefined) {
  const agentAddress = useContractAddress('HouseForgeAgent');
  const fusionAddress = useContractAddress('FusionCore');
  return useReadContract({
    address: agentAddress,
    abi: HOUSE_FORGE_AGENT_ABI,
    functionName: 'isApprovedForAll',
    args: owner ? [owner, fusionAddress] : undefined,
    query: { enabled: !!owner },
  });
}

export function useSetApprovalForAll() {
  const address = useContractAddress('HouseForgeAgent');
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setApproval = (operator: Address, approved: boolean) => {
    writeContract({
      address,
      abi: HOUSE_FORGE_AGENT_ABI,
      functionName: 'setApprovalForAll',
      args: [operator, approved],
    });
  };

  return { setApproval, hash, isPending, isConfirming, isSuccess, error };
}

// ==================== HouseForgeAgent Write Hooks ====================

export function useSealAgent() {
  const address = useContractAddress('HouseForgeAgent');
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const seal = (tokenId: bigint) => {
    writeContract({
      address,
      abi: HOUSE_FORGE_AGENT_ABI,
      functionName: 'seal',
      args: [tokenId],
    });
  };

  return { seal, hash, isPending, isConfirming, isSuccess, error };
}

export function useBurnAgent() {
  const address = useContractAddress('HouseForgeAgent');
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const burn = (tokenId: bigint) => {
    writeContract({
      address,
      abi: HOUSE_FORGE_AGENT_ABI,
      functionName: 'burn',
      args: [tokenId],
    });
  };

  return { burn, hash, isPending, isConfirming, isSuccess, error };
}

// ==================== FusionCore Hooks ====================

export function useHasActiveCommit(owner: Address | undefined, parentA: bigint | undefined, parentB: bigint | undefined) {
  const address = useContractAddress('FusionCore');
  return useReadContract({
    address,
    abi: FUSION_CORE_ABI,
    functionName: 'hasActiveCommit',
    args: owner && parentA !== undefined && parentB !== undefined ? [owner, parentA, parentB] : undefined,
    query: { enabled: !!owner && parentA !== undefined && parentB !== undefined },
  });
}

export function useGetCommitDetails(owner: Address | undefined, parentA: bigint | undefined, parentB: bigint | undefined) {
  const address = useContractAddress('FusionCore');
  return useReadContract({
    address,
    abi: FUSION_CORE_ABI,
    functionName: 'getCommit',
    args: owner && parentA !== undefined && parentB !== undefined ? [owner, parentA, parentB] : undefined,
    query: { enabled: !!owner && parentA !== undefined && parentB !== undefined },
  });
}

export function useRevealWindow() {
  const address = useContractAddress('FusionCore');
  return useReadContract({
    address,
    abi: FUSION_CORE_ABI,
    functionName: 'REVEAL_WINDOW',
  });
}

export function useMinRevealDelay() {
  const address = useContractAddress('FusionCore');
  return useReadContract({
    address,
    abi: FUSION_CORE_ABI,
    functionName: 'MIN_REVEAL_DELAY',
  });
}

// ==================== FusionCore Write Hooks ====================

export function useCommitFusion() {
  const address = useContractAddress('FusionCore');
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const commit = (
    parentA: bigint,
    parentB: bigint,
    commitHash: `0x${string}`,
    mode: FusionMode
  ) => {
    writeContract({
      address,
      abi: FUSION_CORE_ABI,
      functionName: 'commitFusion',
      args: [parentA, parentB, commitHash, mode],
    });
  };

  return { commit, hash, isPending, isConfirming, isSuccess, error };
}

export function useRevealFusion() {
  const address = useContractAddress('FusionCore');
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const reveal = (
    parentA: bigint,
    parentB: bigint,
    salt: `0x${string}`,
    vaultURI: string,
    vaultHash: `0x${string}`,
    learningRoot: `0x${string}`,
    offspringPersona: string,
    offspringExperience: string,
    offspringHouseId: number,
    offspringTraitsHash: `0x${string}`,
    offspringRarityTier: number,
    fusionFee: bigint
  ) => {
    writeContract({
      address,
      abi: FUSION_CORE_ABI,
      functionName: 'revealFusion',
      args: [
        parentA,
        parentB,
        salt,
        vaultURI,
        vaultHash,
        learningRoot,
        offspringPersona,
        offspringExperience,
        offspringHouseId,
        offspringTraitsHash,
        offspringRarityTier,
      ],
      value: fusionFee,
    });
  };

  return { reveal, hash, isPending, isConfirming, isSuccess, error };
}

export function useFusionFee(parentA: bigint | undefined, parentB: bigint | undefined) {
  const address = useContractAddress('FusionCore');
  return useReadContract({
    address,
    abi: FUSION_CORE_ABI,
    functionName: 'getFusionFee',
    args: parentA !== undefined && parentB !== undefined ? [parentA, parentB] : undefined,
    query: { enabled: parentA !== undefined && parentB !== undefined },
  });
}

export function useCancelFusion() {
  const address = useContractAddress('FusionCore');
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancel = (parentA: bigint, parentB: bigint) => {
    writeContract({
      address,
      abi: FUSION_CORE_ABI,
      functionName: 'cancelFusion',
      args: [parentA, parentB],
    });
  };

  return { cancel, hash, isPending, isConfirming, isSuccess, error };
}

// ==================== Utility Functions ====================

export function generateCommitHash(
  parentA: bigint,
  parentB: bigint,
  salt: `0x${string}`,
  commitBlock: bigint,
  sender: Address,
  mode: FusionMode
): `0x${string}` {
  return keccak256(
    encodePacked(
      ['uint256', 'uint256', 'bytes32', 'uint256', 'address', 'uint8'],
      [parentA, parentB, salt, commitBlock, sender, mode]
    )
  );
}

export function generateSalt(): `0x${string}` {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return toHex(randomBytes);
}
