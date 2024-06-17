// @ts-ignore
import ollama from "ollama/browser";

import OpenAI from "openai";

import { CaretPluginSettings, Message } from "./types";
import { Notice, requestUrl } from "obsidian";

import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { around } from "monkey-around";

export class LlmCall {
    openai_client: OpenAI;
    groq_client: Groq;
    anthropic_client: Anthropic;
    openrouter_client: OpenAI;
    settings: CaretPluginSettings;

    constructor(settings: CaretPluginSettings) {
        this.settings = settings;

        // Initialize API clients
        if (this.settings.openai_api_key) {
            this.openai_client = new OpenAI({ apiKey: this.settings.openai_api_key, dangerouslyAllowBrowser: true });
        }
        if (this.settings.groq_api_key) {
            this.groq_client = new Groq({ apiKey: this.settings.groq_api_key, dangerouslyAllowBrowser: true });
        }
        if (this.settings.anthropic_api_key) {
            this.anthropic_client = new Anthropic({
                apiKey: this.settings.anthropic_api_key,
            });
        }
        if (this.settings.open_router_key) {
            this.openrouter_client = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: this.settings.open_router_key,
                dangerouslyAllowBrowser: true,
            });
        }
    }

    async llm_call(provider: string, model: string, conversation: any[]): Promise<string> {
        if (provider === "ollama") {
            let model_param = model;
            new Notice("Calling ollama");
            try {
                const response = await ollama.chat({
                    model: model_param,
                    messages: conversation,
                });
                new Notice("Message back from ollama");
                return response.message.content;
            } catch (error) {
                console.error(error);
                if (error.message) {
                    new Notice(error.message);
                }
                throw error;
            }
        } else if (provider == "openai") {
            if (!this.openai_client) {
                const error_message = "API Key not configured for OpenAI. Restart the app if you just added it!";
                new Notice(error_message);
                throw new Error(error_message);
            }
            new Notice("Calling OpenAI");
            const params = {
                messages: conversation,
                model: model,
            };
            try {
                const completion = await this.openai_client.chat.completions.create(params);
                new Notice("Message back from OpenAI");
                const message = completion.choices[0].message as Message;
                return message.content;
            } catch (error) {
                console.error("Error fetching chat completion from OpenAI:", error);
                new Notice(error.message);
                throw error;
            }
        } else if (provider == "anthropic") {
            try {
                if (!this.anthropic_client) {
                    const error_message =
                        "API Key not configured for Anthropic.  Restart the app if you just added it!";
                    new Notice(error_message);
                    throw new Error(error_message);
                }
                new Notice("Calling Anthropic");

                // Extract system message content if it exists
                let systemContent = "";
                conversation = conversation.filter((message) => {
                    if (message.role === "system") {
                        systemContent = message.content;
                        return false; // Remove the system message from the conversation
                    }
                    return true;
                });

                const body = {
                    model: this.settings.model,
                    max_tokens: 4096,
                    messages: conversation,
                    system: systemContent, // Set the system parameter
                };

                const response = await requestUrl({
                    url: "https://api.anthropic.com/v1/messages",
                    method: "POST",
                    headers: {
                        "x-api-key": this.settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01", // Add this line
                        "content-type": "application/json", // Add this line
                    },
                    body: JSON.stringify(body),
                });
                const completion = await response.json;
                new Notice("Message back from Anthropic");
                const message = completion.content[0].text;
                return message;
            } catch (error) {
                console.error("Error during Anthropic call:");
                console.error(error);
                new Notice(`Error: ${error.message}`);
                throw error;
            }
        } else if (provider == "groq") {
            if (!this.groq_client) {
                const error_message = "API Key not configured for Groq.  Restart the app if you just added it!";
                new Notice(error_message);
                throw new Error(error_message);
            }
            new Notice("Calling Groq");

            const params = {
                messages: conversation,
                model: model,
            };
            try {
                const completion = await this.groq_client.chat.completions.create(params);
                new Notice("Message back from Groq");
                const message = completion.choices[0].message as Message;
                return message.content;
            } catch (error) {
                console.error("Error fetching chat completion from OpenAI:", error);
                new Notice(error.message);
                throw error;
            }
        } else {
            const error_message = "Invalid llm provider / model configuration";
            new Notice(error_message);
            throw new Error(error_message);
        }
    }
    async llm_call_streaming(provider: string, model: string, conversation: any[], temperature: number) {
        if (this.settings.system_prompt && this.settings.system_prompt.length > 0) {
            conversation.unshift({
                role: "system",
                content: this.settings.system_prompt,
            });
        }
        if (provider === "ollama") {
            let model_param = model;
            new Notice("Calling ollama");
            try {
                const response = await ollama.chat({
                    model: model_param,
                    messages: conversation,
                    stream: true,
                    temperature: temperature,
                });
                return response;
            } catch (error) {
                console.error(error);
                if (error.message) {
                    new Notice(error.message);
                }
                throw error;
            }
        } else if (provider == "openai") {
            if (!this.openai_client) {
                const error_message = "API Key not configured for OpenAI. Restart the app if you just added it!";
                new Notice(error_message);
                throw new Error(error_message);
            }
            new Notice("Calling OpenAI");
            const params = {
                messages: conversation,
                model: model,
                stream: true,
                temperature: temperature,
            };
            try {
                const stream = await this.openai_client.chat.completions.create(params);
                return stream;
            } catch (error) {
                console.error("Error fetching chat completion from OpenAI:", error);
                new Notice(error.message);
                throw error;
            }
        } else if (provider == "openrouter") {
            if (!this.openrouter_client) {
                const error_message = "API Key not configured for OpenRouter. Restart the app if you just added it!";
                new Notice(error_message);
                throw new Error(error_message);
            }
            new Notice("Calling OpenRouter");
            const params = {
                messages: conversation,
                model: model,
                stream: true,
                temperature: temperature,
            };
            try {
                const stream = await this.openrouter_client.chat.completions.create(params);
                return stream;
            } catch (error) {
                console.error("Error fetching chat completion from OpenRouter:", error);
                new Notice(error.message);
                throw error;
            }
        } else if (provider == "groq") {
            if (!this.groq_client) {
                const error_message = "API Key not configured for Groq.  Restart the app if you just added it!";
                new Notice(error_message);
                throw new Error(error_message);
            }
            new Notice("Calling Groq");

            const params = {
                messages: conversation,
                model: model,
                stream: true,
                temperature: temperature,
            };
            try {
                const stream = await this.groq_client.chat.completions.create(params);
                return stream;
            } catch (error) {
                console.error("Error fetching chat completion from OpenAI:", error);
                new Notice(error.message);
                throw error;
            }
        } else if (provider == "anthropic") {
            new Notice("Error: Anthropic Streaming not supported");
        } else if (provider == "custom") {
            new Notice("Calling Custom Client");
            const custom_model = this.settings.model;
            const model_settings = this.settings.custom_endpoints[custom_model];
            const custom_api_key = model_settings.api_key;
            const custom_endpoint = model_settings.endpoint;

            const custom_client = new OpenAI({
                apiKey: custom_api_key,
                baseURL: custom_endpoint,
                dangerouslyAllowBrowser: true,
            });

            if (!custom_endpoint) {
                const error_message = "Custom endpoint not configured. Restart the app if you just added it!";
                new Notice(error_message);
                throw new Error(error_message);
            }

            if (!custom_client) {
                const error_message = "Custom client not initialized properly. Restart the app if you just added it!";
                new Notice(error_message);
                throw new Error(error_message);
            }

            const params = {
                messages: conversation,
                model: model,
                stream: true,
                temperature: temperature,
            };

            try {
                const stream = await custom_client.chat.completions.create(params);
                return stream;
            } catch (error) {
                console.error("Error streaming from Custom Client:", error);
                new Notice(error.message);
                throw error;
            }
        } else {
            const error_message = "Invalid llm provider / model configuration";
            new Notice(error_message);
            throw new Error(error_message);
        }
    }
}
