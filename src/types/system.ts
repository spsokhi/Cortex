export interface SystemStats {
  cpuUsage: number; // 0-100
  memoryUsed: number; // bytes
  memoryTotal: number; // bytes
  gpuUsage?: number; // 0-100
  vramUsed?: number; // bytes
  vramTotal?: number; // bytes
  ollamaRunning: boolean;
  activeModel?: string;
  tokensThroughput?: number; // tokens/sec
}

export interface AppSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  models: ModelSettings;
  rag: RagSettings;
  voice: VoiceSettings;
  privacy: PrivacySettings;
  advanced: AdvancedSettings;
}

export interface GeneralSettings {
  language: string;
  startMinimized: boolean;
  closeToTray: boolean;
  autoUpdateCheck: boolean;
  dataDirectory: string;
}

export interface AppearanceSettings {
  theme: "dark" | "light" | "system";
  fontSize: "sm" | "md" | "lg";
  fontFamily: string;
  compactMode: boolean;
  showTimestamps: boolean;
  showTokenCount: boolean;
  codeTheme: string;
}

export interface ModelSettings {
  defaultModel: string;
  ollamaEndpoint: string;
  requestTimeout: number;
  maxConcurrentRequests: number;
  defaultTemperature: number;
  defaultContextLength: number;
}

export interface RagSettings {
  enabled: boolean;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  minScore: number;
  indexOnUpload: boolean;
  watchDirectories: string[];
}

export interface VoiceSettings {
  enabled: boolean;
  whisperModel: "tiny" | "base" | "small" | "medium" | "large";
  language: string;
  wakeWord?: string;
  wakeWordEnabled: boolean;
  inputDevice?: string;
  outputDevice?: string;
  ttsEnabled: boolean;
}

export interface PrivacySettings {
  telemetryEnabled: boolean;
  crashReportingEnabled: boolean;
  encryptStorage: boolean;
  clearHistoryOnExit: boolean;
  historyRetentionDays: number;
}

export interface AdvancedSettings {
  debugMode: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  maxLogFileSizeMb: number;
  pythonPath?: string;
  embeddingServicePort: number;
  whisperServicePort: number;
  ragServicePort: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    language: "en",
    startMinimized: false,
    closeToTray: true,
    autoUpdateCheck: false,
    dataDirectory: "",
  },
  appearance: {
    theme: "dark",
    fontSize: "md",
    fontFamily: "Inter var",
    compactMode: false,
    showTimestamps: true,
    showTokenCount: false,
    codeTheme: "one-dark-pro",
  },
  models: {
    defaultModel: "llama3:8b",
    ollamaEndpoint: "http://localhost:11434",
    requestTimeout: 120,
    maxConcurrentRequests: 1,
    defaultTemperature: 0.7,
    defaultContextLength: 4096,
  },
  rag: {
    enabled: true,
    embeddingModel: "nomic-embed-text",
    chunkSize: 512,
    chunkOverlap: 64,
    topK: 5,
    minScore: 0.4,
    indexOnUpload: true,
    watchDirectories: [],
  },
  voice: {
    enabled: false,
    whisperModel: "base",
    language: "en",
    wakeWordEnabled: false,
    ttsEnabled: false,
  },
  privacy: {
    telemetryEnabled: false,
    crashReportingEnabled: false,
    encryptStorage: false,
    clearHistoryOnExit: false,
    historyRetentionDays: 90,
  },
  advanced: {
    debugMode: false,
    logLevel: "warn",
    maxLogFileSizeMb: 50,
    embeddingServicePort: 8001,
    whisperServicePort: 8002,
    ragServicePort: 8003,
  },
};

export interface NotificationPayload {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}
