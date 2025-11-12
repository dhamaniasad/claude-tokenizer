"use client";

import { TokenizerInput } from "../components/tokenComponents";
import './globals.css';

export default function TokenizerPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white p-4">
      <div className="w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-medium mb-2">Claude Tokenizer</h1>
          <p className="text-neutral-400">
            Count tokens for the latest Claude models including <span className="text-orange-400">Claude Sonnet 4.5, Opus 4.1, Haiku 4.5</span> and more. Upload <span className="text-orange-400">text files, PDFs or images, or paste text directly</span>.
          </p>
          <p className="text-neutral-500">
            We do not store any files or data. They are discarded immediately after processing.
          </p>
          <p className="text-sm text-neutral-400 mt-2">
            Explore the source code <a href="https://github.com/dhamaniasad/claude-tokenizer" className="text-orange-400 hover:text-orange-300">here</a>.
          </p>
        </div>

        <TokenizerInput />

        <footer className="mt-10 text-neutral-500 text-sm text-center space-y-2">
          <p>This website is not affiliated with or endorsed by Anthropic.</p>
          <p>
            See my other projects: <a href="https://www.memoryplugin.com?ref=claude-tokenizer" className="text-orange-400 hover:text-orange-300">MemoryPlugin</a> - long term memory for all your AI tools
          </p>
        </footer>
      </div>
    </div>
  );
}