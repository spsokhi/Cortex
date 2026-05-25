export type ModelProvider = "ollama" | "custom";

export type ModelCapability =
  | "chat"
  | "code"
  | "vision"
  | "embedding"
  | "function_calling";

export type ModelStatus = "available" | "downloading" | "not_downloaded" | "error";

export interface ModelInfo {
  id: string;
  name: string;
  provider: ModelProvider;
  size: number; // bytes
  parameterSize: string; // e.g. "7B", "13B"
  quantization?: string; // e.g. "Q4_K_M"
  capabilities: ModelCapability[];
  contextLength: number;
  status: ModelStatus;
  downloadProgress?: number; // 0-100
  description?: string;
  license?: string;
  families?: string[];
  modifiedAt?: number;
  digest?: string;
}

export interface ModelConfig {
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  seed?: number;
  numCtx: number;
  numPredict: number;
  stop?: string[];
}

export interface ModelDownloadRequest {
  modelName: string;
  insecure?: boolean;
}

export interface ModelDownloadProgress {
  modelName: string;
  status: string;
  total?: number;
  completed?: number;
  percent?: number;
}

export interface OllamaModelDetail {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaListResponse {
  models: OllamaModelDetail[];
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  numCtx: 4096,
  numPredict: -1,
};
