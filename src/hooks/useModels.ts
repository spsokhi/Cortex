import { useCallback, useEffect } from "react";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { ollamaClient } from "@/services/api/ollama";
import type { ModelInfo } from "@/types/models";

export function useModels() {
  const { models, setModels, setOllamaConnected, setLoading, ollamaConnected, isLoading } =
    useModelStore();
  const { settings } = useSettingsStore();
  const { toast } = useUIStore();

  const refreshModels = useCallback(async () => {
    setLoading(true);
    try {
      const client = new (await import("@/services/api/ollama")).OllamaClient(
        settings.models.ollamaEndpoint,
      );

      const running = await client.isRunning();
      setOllamaConnected(running);

      if (!running) {
        setModels([]);
        return;
      }

      const { models: ollamaModels } = await client.listModels();

      const modelInfos: ModelInfo[] = ollamaModels.map((m) => ({
        id: m.name,
        name: m.name,
        provider: "ollama",
        size: m.size,
        parameterSize: m.details.parameter_size,
        quantization: m.details.quantization_level || undefined,
        capabilities: inferCapabilities(m.name),
        contextLength: 4096,
        status: "available",
        families: m.details.families ?? undefined,
        modifiedAt: new Date(m.modified_at).getTime(),
        digest: m.digest,
      }));

      setModels(modelInfos);
    } catch (err) {
      setOllamaConnected(false);
      toast("error", "Could not reach Ollama", "Make sure Ollama is running.");
    } finally {
      setLoading(false);
    }
  }, [settings.models.ollamaEndpoint, setModels, setOllamaConnected, setLoading, toast]);

  useEffect(() => {
    void refreshModels();
    const interval = setInterval(() => void refreshModels(), 30_000);
    return () => clearInterval(interval);
  }, [refreshModels]);

  return { models, ollamaConnected, isLoading, refreshModels };
}

function inferCapabilities(modelName: string): ModelInfo["capabilities"] {
  const name = modelName.toLowerCase();
  const caps: ModelInfo["capabilities"] = ["chat"];
  if (name.includes("code") || name.includes("coder") || name.includes("starcoder")) {
    caps.push("code");
  }
  if (name.includes("vision") || name.includes("llava") || name.includes("bakllava")) {
    caps.push("vision");
  }
  if (name.includes("embed") || name.includes("nomic")) {
    caps.push("embedding");
  }
  return caps;
}
