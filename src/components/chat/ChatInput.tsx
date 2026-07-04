import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Send, Square, Paperclip, Mic, MicOff, Database, Wrench } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores/uiStore";
import { useVoice } from "@/hooks/useVoice";
import { PromptLibrary } from "@/components/chat/PromptLibrary";
import { cn } from "@/utils/cn";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  ragEnabled: boolean;
  onToggleRag: () => void;
  toolsEnabled: boolean;
  onToggleTools: () => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
  onInputChange?: (value: string) => void;
}

export function ChatInput({
  onSend,
  onStop,
  isGenerating,
  ragEnabled,
  onToggleRag,
  toolsEnabled,
  onToggleTools,
  disabled = false,
  placeholder = "Ask anything… (Shift+Enter for new line)",
  initialValue = "",
  onInputChange,
}: ChatInputProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, [initialValue]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useUIStore();
  const { recordingState, interimText, startRecording, stopRecording } = useVoice();
  const isRecording = recordingState === "recording";

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating || disabled) return;
    onSend(trimmed);
    setValue("");
    onInputChange?.("");
  }, [value, isGenerating, disabled, onSend, onInputChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleVoice = useCallback(() => {
    if (recordingState === "transcribing") return;
    if (recordingState === "recording") {
      void stopRecording().then((text) => {
        if (!text) return;
        setValue((v) => {
          const updated = v ? v.trimEnd() + " " + text : text;
          onInputChange?.(updated);
          return updated;
        });
      });
    } else {
      void startRecording();
    }
  }, [recordingState, startRecording, stopRecording, onInputChange]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isGenerating) textareaRef.current?.focus();
  }, [isGenerating]);

  return (
    <div className="relative px-4 pb-4">
      {/* Recording / transcribing indicator */}
      <AnimatePresence>
        {recordingState !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute -top-10 left-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-cortex-error/20 border border-cortex-error/40 rounded-xl text-xs text-cortex-error"
          >
            <span className="w-2 h-2 rounded-full bg-cortex-error animate-pulse flex-shrink-0" />
            <span className="truncate flex-1">
              {recordingState === "transcribing"
                ? "Transcribing locally…"
                : interimText || "Listening… click the mic to finish"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "flex flex-col gap-2 rounded-2xl border transition-all duration-200",
          "bg-cortex-surface-2",
          isRecording
            ? "border-cortex-error/50 shadow-[0_0_0_1px_rgba(248,113,113,0.3)]"
            : "border-cortex-border focus-within:border-cortex-accent/50 focus-within:shadow-[0_0_0_1px_rgba(129,140,248,0.2)]",
        )}
      >
        {/* Textarea */}
        <TextareaAutosize
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); onInputChange?.(e.target.value); }}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Recording… click mic to insert" : placeholder}
          disabled={disabled}
          minRows={1}
          maxRows={12}
          className={cn(
            "w-full bg-transparent px-4 pt-3 text-sm text-cortex-text placeholder-cortex-text-dim",
            "resize-none outline-none selectable leading-relaxed",
          )}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5">
          <div className="flex items-center gap-1">
            {/* File attachment */}
            <ToolbarButton
              icon={<Paperclip size={14} />}
              label="Attach file"
              onClick={() => toast("info", "Coming soon", "File drag & drop is available in the Files tab")}
            />

            {/* RAG toggle */}
            <ToolbarButton
              icon={<Database size={14} />}
              label={ragEnabled ? "RAG enabled" : "RAG disabled"}
              active={ragEnabled}
              onClick={onToggleRag}
            />

            {/* Tools */}
            <ToolbarButton
              icon={<Wrench size={14} />}
              label={
                toolsEnabled
                  ? "Tools enabled — the AI can search documents & read notes"
                  : "Tools disabled"
              }
              active={toolsEnabled}
              onClick={onToggleTools}
            />

            {/* Voice */}
            <ToolbarButton
              icon={isRecording ? <MicOff size={14} /> : <Mic size={14} />}
              label={
                recordingState === "transcribing"
                  ? "Transcribing…"
                  : isRecording
                    ? "Stop recording"
                    : "Voice input"
              }
              active={recordingState !== "idle"}
              activeColor="text-cortex-error"
              onClick={handleVoice}
            />

            {/* Prompt library */}
            <PromptLibrary
              currentInput={value}
              onInsert={(content) => {
                setValue(content);
                onInputChange?.(content);
                textareaRef.current?.focus();
              }}
            />
          </div>

          {/* Send / Stop */}
          <div className="flex items-center gap-2">
            {value.trim() && !isGenerating && (
              <span className="text-2xs text-cortex-text-dim">{value.length}</span>
            )}
            {isGenerating ? (
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cortex-error/20 border border-cortex-error/30 text-cortex-error text-xs font-medium hover:bg-cortex-error/30 transition-colors"
              >
                <Square size={11} fill="currentColor" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!value.trim() || disabled}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150",
                  value.trim() && !disabled
                    ? "bg-cortex-accent text-white hover:bg-cortex-accent-dim active:scale-95 shadow-cortex-glow"
                    : "bg-cortex-surface-3 text-cortex-text-dim cursor-not-allowed",
                )}
                title="Send (Enter)"
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-2xs text-cortex-text-dim mt-2 opacity-60">
        Cortex may make mistakes. All data stays on your device.
      </p>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active = false,
  activeColor = "text-cortex-accent",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "p-1.5 rounded-lg transition-colors",
        active
          ? `${activeColor} bg-cortex-surface-3`
          : "text-cortex-text-dim hover:text-cortex-text hover:bg-cortex-surface-3",
      )}
    >
      {icon}
    </button>
  );
}
