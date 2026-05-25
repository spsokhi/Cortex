import { motion } from "framer-motion";
import { Code2, Terminal, GitBranch, Cpu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";

const CODE_STARTERS = [
  { label: "Explain this code", prompt: "Explain the following code step by step:\n\n```\n\n```" },
  { label: "Write a function", prompt: "Write a function that " },
  { label: "Debug this error", prompt: "I'm getting this error:\n\n```\n\n```\n\nMy code:\n\n```\n\n```" },
  { label: "Code review", prompt: "Please review this code and suggest improvements:\n\n```\n\n```" },
  { label: "Refactor", prompt: "Refactor this code to be cleaner and more maintainable:\n\n```\n\n```" },
  { label: "Write tests", prompt: "Write unit tests for the following function:\n\n```\n\n```" },
];

export function CodeRoute() {
  const navigate = useNavigate();
  const { createConversation } = useChatStore();
  const { activeModelId } = useModelStore();

  const handleStarter = (prompt: string) => {
    const conv = createConversation(activeModelId, "Code Assistant");
    navigate(`/chat/${conv.id}`, { state: { initialPrompt: prompt } });
  };

  return (
    <motion.div
      key="code"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      <div className="px-6 py-4 border-b border-cortex-border bg-cortex-surface/50 flex-shrink-0">
        <h1 className="text-sm font-semibold text-cortex-text">Code Assistant</h1>
        <p className="text-xs text-cortex-text-muted mt-0.5">
          AI-powered coding help — fully offline
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-cortex-surface-3 border border-cortex-border flex items-center justify-center mx-auto">
              <Code2 size={26} className="text-cortex-accent" />
            </div>
            <p className="text-sm font-medium text-cortex-text">Start a coding session</p>
            <p className="text-xs text-cortex-text-muted">
              Pick a starter or open a new chat and paste your code
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {CODE_STARTERS.map((s) => (
              <button
                key={s.label}
                onClick={() => handleStarter(s.prompt)}
                className="flex items-start gap-2.5 p-3.5 rounded-xl border border-cortex-border bg-cortex-surface-2 hover:border-cortex-accent/30 hover:bg-cortex-surface-3 transition-all text-left group"
              >
                <Terminal size={14} className="text-cortex-accent mt-0.5 flex-shrink-0 group-hover:text-cortex-accent" />
                <span className="text-xs text-cortex-text-muted group-hover:text-cortex-text transition-colors">
                  {s.label}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 p-4 rounded-xl border border-cortex-border bg-cortex-surface-2 text-xs text-cortex-text-muted">
            <div className="flex items-center gap-2 text-cortex-text font-medium mb-1">
              <GitBranch size={13} className="text-cortex-accent" />
              Tips
            </div>
            <p>• Use code-specialized models like <span className="font-mono text-cortex-text">deepseek-coder</span> or <span className="font-mono text-cortex-text">codellama</span> for best results</p>
            <p>• Wrap code in triple backticks with the language for syntax highlighting</p>
            <p>• Upload files in the Files tab to ask questions about your codebase</p>
          </div>

          <button
            onClick={() => navigate("/models")}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-cortex-border text-xs text-cortex-text-muted hover:text-cortex-text hover:border-cortex-accent/30 transition-all"
          >
            <Cpu size={13} />
            Manage models
          </button>
        </div>
      </div>
    </motion.div>
  );
}
