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
            This tool uses Anthropic's token counting API to count tokens for Claude models. Upload text files or PDFs, or paste text directly.
          </p>
          <p className="text-sm text-neutral-400 mt-2">
            Explore the source code <a href="https://github.com/dhamaniasad/claude-tokenizer" className="text-orange-400 hover:text-orange-300">here</a>.
          </p>
        </div>

        <TokenizerInput />
        
        <footer className="mt-10 text-neutral-500 text-sm text-center">
          This website is not affiliated with or endorsed by Anthropic.
        </footer>
      </div>
    </div>
  );
}