use anyhow::{anyhow, Context, Result};
use futures_util::StreamExt;
use reqwest::Client;
use std::time::Duration;
use tokio::sync::broadcast;

use crate::models::{
    ModelInfo, OllamaChatRequest, OllamaChatResponse, OllamaOptions, OllamaTagsResponse,
    StreamEvent,
};

pub struct OllamaService {
    client: Client,
}

impl Default for OllamaService {
    fn default() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .expect("Failed to build HTTP client");
        Self { client }
    }
}

impl OllamaService {
    pub async fn is_running(&self, endpoint: &str) -> bool {
        self.client
            .get(format!("{endpoint}/api/tags"))
            .timeout(Duration::from_secs(3))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    pub async fn get_version(&self, endpoint: &str) -> Option<String> {
        #[derive(serde::Deserialize)]
        struct VersionResp {
            version: String,
        }

        self.client
            .get(format!("{endpoint}/api/version"))
            .timeout(Duration::from_secs(3))
            .send()
            .await
            .ok()?
            .json::<VersionResp>()
            .await
            .ok()
            .map(|v| v.version)
    }

    pub async fn list_models(&self, endpoint: &str) -> Result<Vec<ModelInfo>> {
        let resp = self
            .client
            .get(format!("{endpoint}/api/tags"))
            .send()
            .await
            .context("Failed to reach Ollama")?
            .json::<OllamaTagsResponse>()
            .await
            .context("Failed to parse Ollama response")?;

        let models = resp
            .models
            .into_iter()
            .map(|m| {
                let caps = infer_capabilities(&m.name);
                ModelInfo {
                    id: m.name.clone(),
                    name: m.name,
                    provider: "ollama".to_string(),
                    size: m.size,
                    parameter_size: m.details.parameter_size,
                    quantization: m.details.quantization_level,
                    capabilities: caps,
                    context_length: 4096,
                    status: "available".to_string(),
                    download_progress: None,
                    modified_at: chrono::DateTime::parse_from_rfc3339(&m.modified_at)
                        .ok()
                        .map(|dt| dt.timestamp_millis()),
                    digest: Some(m.digest),
                }
            })
            .collect();

        Ok(models)
    }

    /// Stream a chat completion, emitting tokens via the provided broadcast sender.
    pub async fn chat_stream(
        &self,
        endpoint: &str,
        model: &str,
        messages: Vec<crate::models::OllamaChatMessage>,
        temperature: f32,
        num_ctx: u32,
        tx: broadcast::Sender<StreamEvent>,
    ) -> Result<()> {
        let request = OllamaChatRequest {
            model: model.to_string(),
            messages,
            stream: true,
            options: OllamaOptions {
                temperature,
                num_ctx,
            },
        };

        let resp = self
            .client
            .post(format!("{endpoint}/api/chat"))
            .json(&request)
            .send()
            .await
            .context("Failed to start chat stream")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Ollama error {status}: {body}"));
        }

        let mut stream = resp.bytes_stream();
        let mut total_tokens: u32 = 0;

        while let Some(chunk) = stream.next().await {
            let bytes = chunk.context("Stream read error")?;
            let text = String::from_utf8_lossy(&bytes);

            for line in text.lines() {
                if line.is_empty() {
                    continue;
                }
                match serde_json::from_str::<OllamaChatResponse>(line) {
                    Ok(data) => {
                        if let Some(msg) = &data.message {
                            if !msg.content.is_empty() {
                                let _ = tx.send(StreamEvent::Token {
                                    content: msg.content.clone(),
                                });
                            }
                        }
                        if data.done {
                            total_tokens = data.eval_count.unwrap_or(0);
                        }
                    }
                    Err(_) => continue, // Partial line
                }
            }
        }

        let _ = tx.send(StreamEvent::Done {
            token_count: total_tokens,
        });

        Ok(())
    }

    pub async fn delete_model(&self, endpoint: &str, model: &str) -> Result<()> {
        #[derive(serde::Serialize)]
        struct DeleteReq<'a> {
            name: &'a str,
        }

        let resp = self
            .client
            .delete(format!("{endpoint}/api/delete"))
            .json(&DeleteReq { name: model })
            .send()
            .await
            .context("Failed to delete model")?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(anyhow!("Failed to delete model: {}", resp.status()))
        }
    }
}

fn infer_capabilities(name: &str) -> Vec<String> {
    let n = name.to_lowercase();
    let mut caps = vec!["chat".to_string()];
    if n.contains("code") || n.contains("coder") || n.contains("starcoder") {
        caps.push("code".to_string());
    }
    if n.contains("vision") || n.contains("llava") || n.contains("bakllava") {
        caps.push("vision".to_string());
    }
    if n.contains("embed") || n.contains("nomic") {
        caps.push("embedding".to_string());
    }
    caps
}
