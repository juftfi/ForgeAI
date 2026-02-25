export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gold-gradient">Privacy Policy</h1>
        <p className="text-gray-400">Last updated: February 6, 2026</p>
      </div>

      <div className="glass-card p-8 space-y-8 text-gray-300 leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-amber-400 mb-3">1. Introduction</h2>
          <p>
            ForgeAI (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a decentralized application (DApp) deployed on BNB Chain.
            This Privacy Policy explains how we handle information when you interact with our website
            at kinforge.xyz and our smart contracts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-amber-400 mb-3">2. Information We Collect</h2>

          <h3 className="text-lg font-medium text-white mt-4 mb-2">2.1 Blockchain Data (Public)</h3>
          <p>
            When you interact with our smart contracts, transaction data is recorded on the BNB Chain
            blockchain. This includes your wallet address, transaction hashes, token ownership, and
            on-chain metadata. This data is inherently public and immutable.
          </p>

          <h3 className="text-lg font-medium text-white mt-4 mb-2">2.2 Wallet Connection</h3>
          <p>
            We use WalletConnect and browser wallet extensions (e.g., MetaMask) to facilitate blockchain
            interactions. We do not have access to your private keys, seed phrases, or wallet passwords.
            The wallet connection only provides your public address for identity verification.
          </p>

          <h3 className="text-lg font-medium text-white mt-4 mb-2">2.3 AI Chat Data</h3>
          <p>
            When you chat with your Agent, conversation messages are stored on our server to enable
            the AI dialogue and memory features. This data is associated with your token ID and wallet
            address. Only the verified token owner can access chat history and memories for their Agent.
          </p>

          <h3 className="text-lg font-medium text-white mt-4 mb-2">2.4 Automatically Collected Data</h3>
          <p>
            Our hosting providers (Vercel, Railway) may collect standard web server logs including
            IP addresses, browser type, and access timestamps. We do not use cookies for tracking purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-amber-400 mb-3">3. How We Use Information</h2>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>To verify token ownership for AI chat sessions</li>
            <li>To provide personalized AI dialogue based on Agent personality</li>
            <li>To store Agent memories and learning snapshots</li>
            <li>To generate and serve NFT metadata and images</li>
            <li>To facilitate fusion (breeding) operations</li>
            <li>To compute and sync learningRoot hashes to the blockchain</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-amber-400 mb-3">4. Data Storage and Security</h2>
          <p>
            Off-chain data (chat history, memories, vault data) is stored on secured servers hosted by
            Railway. On-chain data (token metadata, learningRoot, vaultHash) is stored permanently on
            the BNB Chain blockchain.
          </p>
          <p className="mt-2">
            AI chat processing is handled through third-party AI providers (OpenAI). Conversations are
            sent to these providers for response generation. Please refer to their respective privacy
            policies for information on how they handle data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-amber-400 mb-3">5. Data Sharing</h2>
          <p>We do not sell, trade, or rent your personal information. Data may be shared with:</p>
          <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
            <li><strong>AI Providers</strong> (OpenAI) — for processing chat messages</li>
            <li><strong>Blockchain Networks</strong> — transaction data is publicly visible on BNB Chain</li>
            <li><strong>Hosting Providers</strong> (Vercel, Railway) — for infrastructure operations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-amber-400 mb-3">6. Your Rights</h2>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>You can view all data associated with your Agent through our API</li>
            <li>Chat sessions can be ended at any time</li>
            <li>On-chain data cannot be deleted due to the immutable nature of blockchain</li>
            <li>You may transfer or sell your NFT, which transfers access to the associated Agent data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-amber-400 mb-3">7. Third-Party Services</h2>
          <p>Our DApp integrates with the following third-party services:</p>
          <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
            <li><strong>BNB Chain (BSC)</strong> — blockchain network</li>
            <li><strong>WalletConnect</strong> — wallet connection protocol</li>
            <li><strong>OpenAI</strong> — AI chat processing</li>
            <li><strong>Vercel</strong> — frontend hosting</li>
            <li><strong>Railway</strong> — backend hosting</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-amber-400 mb-3">8. Children</h2>
          <p>
            ForgeAI is not intended for use by individuals under the age of 18. We do not knowingly
            collect information from children.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-amber-400 mb-3">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page
            with an updated revision date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-amber-400 mb-3">10. Contact</h2>
          <p>
            For questions about this Privacy Policy, please reach out via our{' '}
            <a href="https://x.com/kinforge_lab" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">
              X (Twitter)
            </a>{' '}
            or{' '}
            <a href="https://github.com/ForgeAILab/kinforge" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">
              GitHub
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
