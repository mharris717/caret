// @ts-ignore
import { encodingForModel } from "js-tiktoken";
// import ollama from "ollama/browser";
const ollama: any = 42 
// @ts-ignore
import pdfjs from "@bundled-es-modules/pdfjs-dist/build/pdf";
import pdf_worker_code from "./workers/pdf.worker.js";

import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { around } from "monkey-around";
import OpenAI from "openai";

// Create a Blob URL from the worker code
// @ts-ignore
const pdf_worker_blob = new Blob([pdf_worker_code], { type: "application/javascript" });
const pdf_worker_url = URL.createObjectURL(pdf_worker_blob);
pdfjs.GlobalWorkerOptions.workerSrc = pdf_worker_url;

import { MarkdownView, Modal, Notice, Plugin, requestUrl, setIcon, setTooltip } from "obsidian";
import { CanvasFileData, CanvasNodeData, CanvasTextData } from "obsidian/canvas";
import { Canvas, Edge, Message, Node, SparkleConfig, ViewportNode } from "./types";

// Import all of the views, components, models, etc
import { Stream } from "openai/streaming.js";
import { CaretCanvas, TrackCanvasChanges } from "./domain";
import { redBackgroundField } from "./editorExtensions/inlineDiffs";
import { CustomModelModal } from "./modals/addCustomModel";
import { CMDJModal } from "./modals/inlineEditingModal";
import { InsertNoteModal } from "./modals/insertNoteModal";
import { RemoveCustomModelModal } from "./modals/removeCustomModel";
import { SystemPromptModal } from "./modals/systemPromptModal";
import { CaretSettingTab } from "./settings";
import { refreshNode, refreshOutgoing, sparkle } from "./sparkle";
import { CaretPluginSettings, NewNode } from "./types";
import { FullPageChat, VIEW_CHAT } from "./views/chat";
import { LinearWorkflowEditor } from "./views/workflowEditor";
var parseString = require("xml2js").parseString;

export const DEFAULT_SETTINGS: CaretPluginSettings = {
    caret_version: "0.2.30",
    chat_logs_folder: "caret/chats",
    chat_logs_date_format_bool: false,
    chat_logs_rename_bool: true,
    chat_send_chat_shortcut: "enter",
    model: "gpt-4-turbo",
    llm_provider: "openai",
    openai_api_key: "",
    groq_api_key: "",
    anthropic_api_key: "",
    open_router_key: "",
    context_window: 128000,
    custom_endpoints: {},
    system_prompt: "",
    temperature: 1,
    llm_provider_options: {
        openai: {
            "gpt-4-turbo": {
                name: "gpt-4-turbo",
                context_window: 128000,
                function_calling: true,
                vision: true,
                streaming: true,
            },
            "gpt-3.5-turbo": {
                name: "gpt-3.5-turbo",
                context_window: 128000,
                function_calling: true,
                vision: true,
                streaming: true,
            },
            "gpt-4o": {
                name: "gpt-4o",
                context_window: 128000,
                function_calling: true,
                vision: true,
                streaming: true,
            },
        },
        groq: {
            "llama3-8b-8192": {
                name: "Llama 8B",
                context_window: 8192,
                function_calling: false,
                vision: false,
                streaming: true,
            },
            "llama3-70b-8192": {
                name: "Llama 70B",
                context_window: 8192,
                function_calling: false,
                vision: false,
                streaming: true,
            },
            "mixtral-8x7b-32768": {
                name: "Mixtral 8x7b",
                context_window: 32768,
                function_calling: false,
                vision: false,
                streaming: true,
            },
            "gemma-7b-it": {
                name: "Gemma 7B",
                context_window: 8192,
                function_calling: false,
                vision: false,
                streaming: true,
            },
        },
        anthropic: {
            "claude-3-opus-20240229": {
                name: "Claude 3 Opus",
                context_window: 200000,
                function_calling: true,
                vision: true,
                streaming: false,
            },
            "claude-3-sonnet-20240229": {
                name: "Claude 3 Sonnet",
                context_window: 200000,
                function_calling: true,
                vision: false,
                streaming: false,
            },
            "claude-3-haiku-20240307": {
                name: "Claude 3 Haiku",
                context_window: 200000,
                function_calling: true,
                vision: true,
                streaming: false,
            },
        },
        openrouter: {
            "anthropic/claude-3-opus": {
                name: "Claude 3 Opus",
                context_window: 200000,
                function_calling: true,
                vision: true,
                streaming: true,
            },
            "anthropic/claude-3-sonnet": {
                name: "Claude 3 Sonnet",
                context_window: 200000,
                function_calling: true,
                vision: true,
                streaming: true,
            },
            "anthropic/claude-3-haiku": {
                name: "Claude 3 Haiku",
                context_window: 200000,
                function_calling: true,
                vision: true,
                streaming: true,
            },
            "google/gemini-flash-1.5": {
                name: "Gemini Flash 1.5",
                context_window: 2800000,
                function_calling: true,
                vision: true,
                streaming: true,
            },
            "google/gemini-pro-1.5": {
                name: "Gemini Pro 1.5",
                context_window: 2800000,
                function_calling: true,
                vision: true,
                streaming: true,
            },
        },
        ollama: {
            llama3: {
                name: "llama3 8B",
                context_window: 8192,
                function_calling: false,
                vision: false,
                streaming: true,
            },
            phi3: {
                name: "Phi-3 3.8B",
                context_window: 8192,
                function_calling: false,
                vision: false,
                streaming: true,
            },
            mistral: {
                name: "Mistral 7B",
                context_window: 32768,
                function_calling: false,
                vision: false,
                streaming: true,
            },
            gemma: {
                name: "Gemma 7B",
                context_window: 8192,
                function_calling: false,
                vision: false,
                streaming: true,
            },
        },
        custom: {},
    },
    provider_dropdown_options: {
        openai: "OpenAI",
        groq: "Groq",
        ollama: "Ollama",
        anthropic: "Anthropic",
        openrouter: "OpenRouter",
        custom: "Custom",
    },
};

export default class CaretPlugin extends Plugin {
    settings: CaretPluginSettings;
    canvas_patched: boolean = false;
    selected_node_colors: any = {};
    color_picker_open_on_last_click: boolean = false;
    openai_client: OpenAI;
    groq_client: Groq;
    anthropic_client: Anthropic; 
    openrouter_client: OpenAI;
    encoder: any;
    tracker: TrackCanvasChanges;

    async onload() {
        // Set up the encoder (gpt-4 is just used for everything as a short term solution)
        this.encoder = encodingForModel("gpt-4-0125-preview");
        // Load settings
        await this.loadSettings();
        this.tracker = new TrackCanvasChanges(new CaretCanvas(this.app.workspace.getMostRecentLeaf()!.view, this));

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
        // Initialize settings dab.
        this.addSettingTab(new CaretSettingTab(this.app, this));
        this.registerEvent(this.app.vault.on("modify", (file) => {
            console.log("modify", file)
            this.tracker.handleModify(new CaretCanvas(this.app.workspace.getMostRecentLeaf()!.view, this)); 
            // debugger
        }))
        // this.app.vault.on()
        // Add Commands.
        this.addCommand({
            id: "add-custom-models",
            name: "Add Custom Models",
            callback: () => {
                new CustomModelModal(this.app, this).open();
            },
        });

        this.addCommand({
            id: "remove-custom-models",
            name: "Remove Custom Models",
            callback: () => {
                new RemoveCustomModelModal(this.app, this).open();
            },
        });
        this.addCommand({
            id: "set-system-prompt",
            name: "Set System Prompt",
            callback: () => {
                new SystemPromptModal(this.app, this).open();
            },
        });
        this.addCommand({
            id: "create-new-workflow",
            name: "Create New Workflow",
            callback: () => {
                const leaf = this.app.workspace.getLeaf(true);
                const linearWorkflowEditor = new LinearWorkflowEditor(this, leaf);
                leaf.open(linearWorkflowEditor);
                this.app.workspace.revealLeaf(leaf);
            },
        });
        this.addCommand({
            id: "create-linear-workflow",
            name: "Create Linear Workflow From Canvas",
            callback: async () => {
                const canvas_view = this.app.workspace.getMostRecentLeaf()?.view;
                // @ts-ignore
                if (!canvas_view?.canvas) {
                    return;
                }
                const canvas = (canvas_view as any).canvas; // Assuming canvas is a property of the view

                const selection = canvas.selection;

                const selected_ids = [];
                const selection_iterator = selection.values();
                for (const node of selection_iterator) {
                    selected_ids.push(node.id);
                }

                const canvas_data = canvas.getData();
                const { nodes, edges } = canvas;

                // Filter nodes and edges based on selected IDs
                const selected_nodes = [];
                for (const node of nodes.values()) {
                    if (selected_ids.includes(node.id)) {
                        selected_nodes.push(node);
                    }
                }

                const selected_edges = [];
                for (const edge of edges.values()) {
                    // if (selected_ids.includes(edge.from.node.id) && selected_ids.includes(edge.to.node.id)) {
                    if (selected_ids.includes(edge.to.node.id)) {
                        selected_edges.push(edge);
                    }
                }
                const linear_graph = [];
                for (let i = 0; i < selected_edges.length; i++) {
                    const edge = selected_edges[i];
                    const from_node = edge.from.node.id;
                    const to_node = edge.to.node.id;
                    const node_text = linear_graph.push({ from_node, to_node });
                }
                const from_nodes = new Set(linear_graph.map((edge) => edge.from_node));
                const to_nodes = new Set(linear_graph.map((edge) => edge.to_node));

                let ultimate_ancestor = null;
                let ultimate_child = null;

                // Find the ultimate ancestor (a from_node that is not a to_node)
                for (const from_node of from_nodes) {
                    if (!to_nodes.has(from_node)) {
                        ultimate_ancestor = from_node;
                        break;
                    }
                }

                // Find the ultimate child (a to_node that is not a from_node)
                for (const to_node of to_nodes) {
                    if (!from_nodes.has(to_node)) {
                        ultimate_child = to_node;
                        break;
                    }
                }
                // Create a map for quick lookup of edges by from_node
                const edge_map = new Map();
                for (const edge of linear_graph) {
                    if (!edge_map.has(edge.from_node)) {
                        edge_map.set(edge.from_node, []);
                    }
                    edge_map.get(edge.from_node).push(edge);
                }

                // Initialize the sorted graph with the ultimate ancestor
                const sorted_graph = [];
                let current_node = ultimate_ancestor;

                // Traverse the graph starting from the ultimate ancestor
                while (current_node !== ultimate_child) {
                    const edges_from_current = edge_map.get(current_node);
                    if (edges_from_current && edges_from_current.length > 0) {
                        const next_edge = edges_from_current[0]; // Assuming there's only one edge from each node
                        sorted_graph.push(next_edge);
                        current_node = next_edge.to_node;
                    } else {
                        break; // No further edges, break the loop
                    }
                }

                // Add the ultimate child as the last node
                sorted_graph.push({ from_node: current_node, to_node: ultimate_child });
                // Create a list to hold the ordered node IDs
                const ordered_node_ids = [];

                // Add the ultimate ancestor as the starting node
                ordered_node_ids.push(ultimate_ancestor);

                // Traverse the sorted graph to collect node IDs in order
                for (const edge of sorted_graph) {
                    if (
                        edge.to_node !== ultimate_child ||
                        ordered_node_ids[ordered_node_ids.length - 1] !== ultimate_child
                    ) {
                        ordered_node_ids.push(edge.to_node);
                    }
                }

                // Initialize a new list to hold the prompts
                const prompts = [];

                // Iterate over the ordered node IDs
                for (const node_id of ordered_node_ids) {
                    // Find the corresponding node in selected_nodes
                    const node = selected_nodes.find((n) => n.id === node_id);
                    if (node) {
                        // Get the node context
                        const context = node.text;
                        // Check if the context starts with "user"
                        if (context.startsWith("<role>user</role>")) {
                            // Add the context to the prompts list
                            prompts.push(context.replace("<role>user</role>", "").trim());
                        }
                    }
                }

                const chat_folder_path = "caret/workflows";
                const chat_folder = this.app.vault.getAbstractFileByPath(chat_folder_path);
                if (!chat_folder) {
                    await this.app.vault.createFolder(chat_folder_path);
                }

                let prompts_string = ``;
                for (let i = 0; i < prompts.length; i++) {
                    const escaped_content = this.escapeXml(prompts[i]);
                    prompts_string += `

<prompt model="${this.settings.model}" provider="${this.settings.llm_provider}" delay="0" temperature="1">
${escaped_content}
</prompt>`.trim();
                }

                let file_content = `
---
caret_prompt: linear
version: 1
---
\`\`\`xml
<root>
<system_prompt tag="placeholder_do_not_delete">
</system_prompt>
    ${prompts_string}
</root>
\`\`\`
`.trim();

                let base_file_name = prompts[0]
                    .split(" ")
                    .slice(0, 10)
                    .join(" ")
                    .substring(0, 20)
                    .replace(/[^a-zA-Z0-9]/g, "_");
                let file_name = `${base_file_name}.md`;
                let file_path = `${chat_folder_path}/${file_name}`;
                let file = await this.app.vault.getFileByPath(file_path);
                let counter = 1;

                while (file) {
                    file_name = `${base_file_name}_${counter}.md`;
                    file_path = `${chat_folder_path}/${file_name}`;
                    file = await this.app.vault.getFileByPath(file_path);
                    counter++;
                }

                try {
                    if (file) {
                        await this.app.vault.modify(file, file_content);
                    } else {
                        await this.app.vault.create(file_path, file_content);
                    }
                    // new Notice("Workflow saved!");
                    const leaf = this.app.workspace.getLeaf(true);
                    const linearWorkflowEditor = new LinearWorkflowEditor(this, leaf, file_path);
                    leaf.open(linearWorkflowEditor);
                    this.app.workspace.revealLeaf(leaf);
                } catch (error) {
                    console.error("Failed to save chat:", error);
                }
            },
        });

        this.addCommand({
            id: "insert-note",
            name: "Insert Note",
            callback: async () => {
                const currentLeaf = this.app.workspace.activeLeaf;
                if (!currentLeaf) {
                    new Notice("No active leaf");
                    return;
                }
                const view = currentLeaf.view;
                const view_type = view.getViewType();
                if (view_type !== "main-caret") {
                    new Notice("This command only works in a chat window");
                    return;
                }

                // new InsertNoteModal(this.app, this, view).open();
                new InsertNoteModal(this.app, this, (note: string) => {}).open();
            },
        });

        this.addCommand({
            id: "canvas-prompt",
            name: "Canvas Prompt",
            callback: async () => {
                const currentLeaf = this.app.workspace.activeLeaf;
                if (currentLeaf?.view.getViewType() === "canvas") {
                    const canvasView = currentLeaf.view;
                    const canvas = (canvasView as any).canvas;
                    const selection = canvas.selection;

                    let average_x = 0;
                    let average_y = 0;
                    let average_height = 0;
                    let average_width = 0;

                    let total_x = 0;
                    let total_y = 0;
                    let count = 0;
                    let total_height = 0;
                    let total_width = 0;
                    let all_text = "";

                    let convo_total_tokens = 0;

                    const context_window = this.settings.context_window;

                    for (const obj of selection) {
                        const { x, y, height, width } = obj;
                        total_x += x;
                        total_y += y;
                        total_height += height;
                        total_width += width;
                        count++;
                        if ("text" in obj) {
                            const { text } = obj;
                            const text_token_length = this.encoder.encode(text).length;
                            if (convo_total_tokens + text_token_length < context_window) {
                                all_text += text + "\n";
                                convo_total_tokens += text_token_length;
                            } else {
                                new Notice("Context window exceeded - This is the message?");
                                break;
                            }
                        } else if ("filePath" in obj) {
                            let { filePath } = obj;
                            const file = await this.app.vault.getFileByPath(filePath);
                            if (!file) {
                                console.error("Not a file at this file path");
                                continue;
                            }
                            if (file.extension === "pdf") {
                                const text = await this.extractTextFromPDF(file.name);
                                const text_token_length = this.encoder.encode(text).length;
                                if (convo_total_tokens + text_token_length > context_window) {
                                    new Notice("Context window exceeded");
                                    break;
                                }
                                const file_text = `PDF Title: ${file.name}`;
                                all_text += `${file_text} \n ${text}`;
                                convo_total_tokens += text_token_length;
                            } else if (file?.extension === "md") {
                                const text = await this.app.vault.read(file);
                                const text_token_length = this.encoder.encode(text).length;
                                if (convo_total_tokens + text_token_length > context_window) {
                                    new Notice("Context window exceeded");
                                    break;
                                }
                                const file_text = `
                                Title: ${filePath.replace(".md", "")}
                                ${text}
                                `.trim();
                                all_text += file_text;
                                convo_total_tokens += text_token_length;
                            }
                        }
                    }

                    average_x = count > 0 ? total_x / count : 0;
                    average_y = count > 0 ? total_y / count : 0;
                    average_height = count > 0 ? Math.max(200, total_height / count) : 200;
                    average_width = count > 0 ? Math.max(200, total_width / count) : 200;

                    // This handles the model ---
                    // Create a modal with a text input and a submit button
                    const modal = new Modal(this.app);
                    modal.contentEl.createEl("h1", { text: "Canvas Prompt" });
                    const container = modal.contentEl.createDiv({ cls: "flex-col" });
                    const text_area = container.createEl("textarea", {
                        placeholder: "",
                        cls: "w-full mb-2",
                    });
                    const submit_button = container.createEl("button", { text: "Submit" });
                    submit_button.onclick = async () => {
                        modal.close();
                        const prompt = `
                        Please do the following:
                        ${text_area.value}

                        Given this content:
                        ${all_text}
                        `;
                        const conversation: Message[] = [{ role: "user", content: prompt }];
                        // Create the text node on the canvas
                        const text_node_config = {
                            pos: { x: average_x + 50, y: average_y }, // Position on the canvas
                            size: { width: average_width, height: average_height }, // Size of the text box
                            position: "center", // This might relate to text alignment
                            text: "", // Text content from input
                            save: true, // Save this node's state
                            focus: true, // Focus and start editing immediately
                        };
                        const node = canvas.createTextNode(text_node_config);
                        const node_id = node.id;

                        if (
                            this.settings.llm_provider_options[this.settings.llm_provider][this.settings.model]
                                .streaming
                        ) {
                            const stream = await this.llm_call_streaming(
                                this.settings.llm_provider,
                                this.settings.model,
                                conversation,
                                1
                            );

                            await this.update_node_content(node_id, stream, this.settings.llm_provider);
                        } else {
                            const content = await this.llm_call(
                                this.settings.llm_provider,
                                this.settings.model,
                                conversation
                            );
                            node.setText(content);
                        }
                    };
                    modal.open();
                }
            },
        });

        this.addCommand({
            id: "inline-editing",
            name: "Inline Editing",
            callback: () => {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView && activeView.editor) {
                    const selectedText = activeView.editor.getSelection();
                    const content = activeView.editor.getValue();
                    const startIndex = content.indexOf(selectedText);
                    const endIndex = startIndex + selectedText.length;
                    new CMDJModal(this.app, selectedText, startIndex, endIndex, this).open();
                } else {
                    new Notice("No active markdown editor or no text selected.");
                }
            },
        });

        this.addCommand({
            id: "edit-workflow",
            name: "Edit Workflow",
            callback: async () => {
                const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
                if (editor) {
                    const current_file = this.app.workspace.getActiveFile();
                    const front_matter = await this.getFrontmatter(current_file);

                    if (front_matter.caret_prompt !== "linear") {
                        new Notice("Not a linear workflow");
                    }
                    const leaf = this.app.workspace.getLeaf(true);
                    const linearWorkflowEditor = new LinearWorkflowEditor(this, leaf, current_file?.path);
                    leaf.open(linearWorkflowEditor);
                    this.app.workspace.revealLeaf(leaf);
                    return;
                }
            },
        });

        this.addCommand({
            id: "apply-inline-changes",
            name: "Apply Inline Changes",
            callback: () => {
                const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
                if (editor) {
                    let content = editor.getValue();
                    // Regex to find |-content-|
                    const deleteRegex = /\|-(.*?)-\|/gs;
                    // Regex to find |+content+|

                    // Replace all instances of |-content-| with empty string
                    content = content.replace(deleteRegex, "");
                    // Replace all instances of |+content+| with empty string
                    // @ts-ignore
                    content = content.replaceAll("|+", "");
                    // @ts-ignore
                    content = content.replaceAll("+|", "");

                    // Set the modified content back to the editor
                    editor.setValue(content);
                    new Notice("Dips applied successfully.");
                } else {
                    new Notice("No active markdown editor found.");
                }
            },
        });

        this.addCommand({
            id: "continue-chat",
            name: "Continue Chat",
            callback: async () => {
                const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
                if (editor) {
                    const active_file = this.app.workspace.getActiveFile();
                    if (!active_file) {
                        new Notice("No active file to continue chat from");
                        return;
                    }
                    const active_file_name = active_file.name;
                    let content = editor.getValue();

                    const split = content.split("<root>");
                    const first_half = split[1];
                    const second_split = first_half.split("</root>");
                    const text = `<root>${second_split[0].trim()}</root>`;

                    let xml_object;

                    if (text) {
                        xml_object = await CaretPlugin.parseXml(text);
                    } else {
                        new Notice("No XML block found.");
                        return;
                    }
                    const convo_id = xml_object.root.metadata[0].id[0];
                    const messages_from_xml = xml_object.root.conversation[0].message;
                    const messages: Message[] = [];
                    if (messages_from_xml) {
                        for (let i = 0; i < messages_from_xml.length; i++) {
                            const role = messages_from_xml[i].role[0];
                            const content = messages_from_xml[i].content[0];
                            messages.push({ role, content });
                        }
                    }
                    if (convo_id && messages) {
                        const leaf = this.app.workspace.getLeaf(true);
                        // @ts-ignore
                        const header_el = leaf.tabHeaderEl;
                        if (header_el) {
                            const title_el = header_el.querySelector(".workspace-tab-header-inner-title");
                            if (title_el) {
                                if (active_file_name) {
                                    title_el.textContent = active_file_name;
                                } else {
                                    title_el.textContent = "Caret Chat";
                                }
                            }
                        }
                        const chatView = new FullPageChat(this, leaf, convo_id, messages);
                        leaf.open(chatView);
                        leaf.getDisplayText();
                        this.app.workspace.revealLeaf(leaf);
                    } else {
                        new Notice("No valid chat data found in the current document.");
                    }
                } else {
                    new Notice("No active markdown editor found.");
                }
            },
        });

        // Helper command for just logging out info needed while developing
        // this.addCommand({
        //     id: "caret-log",
        //     name: "Log",
        //     callback: async () => {

        //     },
        // });

        // Registering events.

        // This registers patching the canvas
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (event) => {
                // TODO - Refactor this to use getActiveViewOfType
                // Just not sure what the constructor for that is yet
                const currentLeaf = this.app.workspace.activeLeaf;
                if (currentLeaf) {
                    this.unhighlightLineage();
                    if (currentLeaf?.view.getViewType() === "canvas") {
                        this.patchCanvasMenu();
                    }
                }
            })
        );
        // Register the editor extension
        this.registerEditorExtension([redBackgroundField]);

        // Register the sidebar icon
        this.addChatIconToRibbon();

        // Register Views
        // Currently not using the sidebar chat.
        // this.registerView(VIEW_NAME_SIDEBAR_CHAT, (leaf) => new SidebarChat(leaf));
        this.registerView(VIEW_CHAT, (leaf) => new FullPageChat(this, leaf));
    }

    // General functions that the plugin uses
    async getFrontmatter(file: any) {
        let front_matter: any;
        try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                front_matter = { ...fm };
            });
        } catch (error) {
            console.error("Error processing front matter:", error);
        }
        return front_matter;
    }

    async highlightLineage() {
        await new Promise((resolve) => setTimeout(resolve, 200)); // Sleep for 200 milliseconds

        const canvas_view = this.app.workspace.getMostRecentLeaf()?.view;
        // @ts-ignore
        if (!canvas_view?.canvas) {
            return;
        }
        const canvas = (canvas_view as any).canvas; // Assuming canvas is a property of the view

        const selection = canvas.selection;
        const selection_iterator = selection.values();
        const node = selection_iterator.next().value;
        if (!node) {
            return;
        }
        const nodes_iterator = canvas.nodes.values();
        const nodes_array = Array.from(nodes_iterator);
        const canvas_data = canvas.getData();
        const { edges, nodes } = canvas_data;
        const longest_lineage = await CaretPlugin.getLongestLineage(nodes, edges, node.id);

        // Create a set to track lineage node IDs for comparison
        const lineage_node_ids = new Set(longest_lineage.map((node) => node.id));

        // Iterate through all nodes in the longest lineage
        for (const lineage_node of longest_lineage) {
            const lineage_id = lineage_node.id;
            const lineage_color = lineage_node.color;
            // Only store and change the color if it's not already stored
            if (!this.selected_node_colors.hasOwnProperty(lineage_id)) {
                this.selected_node_colors[lineage_id] = lineage_color; // Store the current color with node's id as key
                const filtered_nodes = nodes_array.filter((node: Node) => node.id === lineage_id);
                filtered_nodes.forEach((node: Node) => {
                    node.color = "4"; // Reset the node color to its original
                    node.render(); // Re-render the node to apply the color change
                });
            }
        }

        // Reset and remove nodes not in the current lineage
        Object.keys(this.selected_node_colors).forEach((node_id) => {
            if (!lineage_node_ids.has(node_id)) {
                const original_color = this.selected_node_colors[node_id];
                const filtered_nodes = nodes_array.filter((node: Node) => node.id === node_id);
                filtered_nodes.forEach((node: Node) => {
                    node.color = original_color; // Reset the node color to its original
                    node.render(); // Re-render the node to apply the color change
                });
                delete this.selected_node_colors[node_id]; // Remove from tracking object
            }
        });
    }
    async getChatLog(folderPath: string, chatId: string) {
        const chatFolder = this.app.vault.getFolderByPath(folderPath);
        if (!chatFolder) {
            await this.app.vault.createFolder(folderPath);
        }
        let fileToSaveTo = null;

        const folder = this.app.vault.getFolderByPath(folderPath);
        let folders_to_check = [folder];
        let num_folders_to_check = 1;
        let num_folders_checked = 0;

        while (num_folders_checked < num_folders_to_check) {
            const folder = folders_to_check[num_folders_checked];
            const children = folder?.children || [];
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.hasOwnProperty("extension")) {
                    // @ts-ignore
                    let contents = await this.app.vault.cachedRead(child);
                    if (!contents) {
                        continue;
                    }
                    contents = contents.toLowerCase();

                    const split_one = contents.split("<id>")[1];
                    const id = split_one.split("</id>")[0];
                    if (id.toLowerCase() === chatId.toLowerCase()) {
                        fileToSaveTo = child;
                    }
                } else {
                    // @ts-ignore
                    folders_to_check.push(child);
                    num_folders_to_check += 1;
                }
            }

            num_folders_checked += 1;
        }
        return fileToSaveTo;
    }
    escapeXml(unsafe: string): string {
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case "<":
                    return "&lt;";
                case ">":
                    return "&gt;";
                case "&":
                    return "&amp;";
                case "'":
                    return "&apos;";
                case '"':
                    return "&quot;";
                default:
                    return c;
            }
        });
    }
    async unhighlightLineage() {
        const canvas_view = this.app.workspace.getMostRecentLeaf()?.view;
        // @ts-ignore
        if (!canvas_view?.canvas) {
            return;
        }
        const canvas = (canvas_view as any).canvas;
        const nodes_iterator = canvas.nodes.values();
        const nodes_array = Array.from(nodes_iterator);

        for (const node_id in this.selected_node_colors) {
            const filtered_nodes = nodes_array.filter((node: Node) => node.id === node_id);
            filtered_nodes.forEach((node: Node) => {
                node.color = this.selected_node_colors[node_id]; // Reset the node color to its original
                node.render(); // Re-render the node to apply the color change
            });
        }
        this.selected_node_colors = {}; // Clear the stored colors after resetting
    }
    patchCanvasMenu() {
        const canvasView = this.app.workspace.getMostRecentLeaf()?.view;
        // @ts-ignore
        if (!canvasView?.canvas) {
            return;
        }
        if (!canvasView) {
            return;
        }
        // @ts-ignore
        const canvas = canvasView.canvas;
        const nodes = canvas.nodes;

        for (const node of nodes.values()) {
            if (node.unknownData) {
                if (!node.unknownData.role) {
                    node.unknownData.role = "";
                }
                if (node.unknownData.displayOverride) {
                    node.unknownData.displayOverride = false;
                }
            }
        }

        const menu = canvas.menu;
        if (!menu) {
            console.error("No menu found on the canvas");
            return;
        }
        const that = this; // Capture the correct 'this' context.

        const menuUninstaller = around(menu.constructor.prototype, {
            render: (next: any) =>
                async function (...args: any) {
                    const result = await next.call(this, ...args);

                    that.addNewNodeButton(this.menuEl);

                    that.add_sparkle_button(this.menuEl);
                    that.addExtraActions(this.menuEl);

                    // await that.add_agent_button(this.menuEl);

                    return result;
                },
        });
        this.register(menuUninstaller);
        // if (!this.canvas_patched) {
        // Define the functions to be patched
        const functions = {
            onDoubleClick: (next: any) =>
                function (event: MouseEvent) {
                    next.call(this, event);
                },
            onPointerdown: (next: any) =>
                function (event: MouseEvent) {
                    if (event.target) {
                        // @ts-ignore
                        const isNode = event.target.closest(".canvas-node");
                        const canvas_color_picker_item = document.querySelector(
                            '.clickable-icon button[aria-label="Set Color"]'
                        );

                        if (isNode) {
                            that.highlightLineage();
                        } else {
                            that.unhighlightLineage();
                        }
                    } else {
                        that.unhighlightLineage();
                    }

                    next.call(this, event);
                },

            requestFrame: (next: any) =>
                function (...args: any) {
                    const canvas_view = this.app.workspace.getMostRecentLeaf()?.view;
                    // @ts-ignore
                    if (!canvas_view?.canvas) {
                        return;
                    }
                    const canvas = (canvas_view as any).canvas; // Assuming canvas is a property of the view
                    const nodes = canvas.nodes;

                    for (const node of nodes.values()) {
                        if (node.unknownData) {
                            if (!node.unknownData.role) {
                                node.unknownData.role = "";
                            }
                            if (!node.unknownData.displayOverride) {
                                node.unknownData.displayOverride = false;
                            }
                        }
                        const contentEl = node.contentEl;
                        if (contentEl) {
                            const targetDiv = contentEl.querySelector(".markdown-embed-content.node-insert-event");
                            if (targetDiv) {
                                let customDisplayDiv = contentEl.querySelector("#custom-display");
                                if (node.unknownData.role.length > 0) {
                                    if (!customDisplayDiv) {
                                        customDisplayDiv = document.createElement("div");
                                        customDisplayDiv.id = "custom-display";
                                        customDisplayDiv.style.width = "100%";
                                        customDisplayDiv.style.height = "40px";
                                        customDisplayDiv.style.backgroundColor = "rgba(211, 211, 211, 0.8)";
                                        customDisplayDiv.style.padding = "2px";
                                        customDisplayDiv.style.paddingLeft = "8px";
                                        customDisplayDiv.style.paddingTop = "4px";
                                        targetDiv.parentNode.insertBefore(customDisplayDiv, targetDiv);
                                    }

                                    if (node.unknownData.role === "assistant") {
                                        customDisplayDiv.textContent = "🤖";
                                    } else if (node.unknownData.role === "user") {
                                        customDisplayDiv.textContent = "👤";
                                    } else if (node.unknownData.role === "system") {
                                        customDisplayDiv.textContent = "🖥️";
                                    }
                                }

                                node.unknownData.displayOverride = true;
                            }
                        }
                    }

                    const result = next.call(this, ...args);
                    return result;
                },
        };
        const doubleClickPatcher = around(canvas.constructor.prototype, functions);
        this.register(doubleClickPatcher);

        canvasView.scope?.register(["Mod", "Shift"], "ArrowUp", () => {
            that.createDirectionalNode(canvas, "top");
        });

        canvasView.scope?.register(["Mod"], "ArrowUp", () => {
            that.navigate(canvas, "top");
        });
        canvasView.scope?.register(["Mod"], "ArrowDown", () => {
            that.navigate(canvas, "bottom");
        });
        canvasView.scope?.register(["Mod"], "ArrowLeft", () => {
            that.navigate(canvas, "left");
        });
        canvasView.scope?.register(["Mod"], "ArrowRight", () => {
            that.navigate(canvas, "right");
        });
        canvasView.scope?.register(["Mod"], "Enter", () => {
            that.startEditingNode(canvas);
        });

        canvasView.scope?.register(["Mod", "Shift"], "ArrowUp", () => {
            that.createDirectionalNode(canvas, "top");
        });
        canvasView.scope?.register(["Mod", "Shift"], "ArrowDown", () => {
            that.createDirectionalNode(canvas, "bottom");
        });
        canvasView.scope?.register(["Mod", "Shift"], "ArrowLeft", () => {
            that.createDirectionalNode(canvas, "left");
        });
        canvasView.scope?.register(["Mod", "Shift"], "ArrowRight", () => {
            that.createDirectionalNode(canvas, "right");
        });
        canvasView.scope?.register(["Mod", "Shift"], "Enter", () => {
            that.runGraphChat(canvas);
        });

        if (!this.canvas_patched) {
            // @ts-ignore
            canvasView.leaf.rebuildView();
            this.canvas_patched = true;
        }
    }
    createDirectionalNode(canvas: any, direction: string) {
        const selection = canvas.selection;
        const selectionIterator = selection.values();
        const node = selectionIterator.next().value;
        if (!node) {
            return;
        }
        if (node.isEditing) {
            return;
        }
        const parent_node_x = node.x;
        const parent_node_y = node.y;
        const parent_width = node.width;
        const parent_height = node.height;

        let x: number;
        let y: number;
        let from_side: string;
        let to_side: string;

        switch (direction) {
            case "left":
                x = parent_node_x - parent_width - 200;
                y = parent_node_y;
                from_side = "left";
                to_side = "right";
                break;
            case "right":
                x = parent_node_x + parent_width + 200;
                y = parent_node_y;
                from_side = "right";
                to_side = "left";
                break;
            case "top":
                x = parent_node_x;
                y = parent_node_y - parent_height - 200;
                from_side = "top";
                to_side = "bottom";
                break;
            case "bottom":
                x = parent_node_x;
                y = parent_node_y + parent_height + 200;
                from_side = "bottom";
                to_side = "top";
                break;
            default:
                console.error("Invalid direction provided");
                return;
        }

        this.createChildNode(canvas, node, x, y, "", from_side, to_side);
    }
    startEditingNode(canvas: Canvas) {
        const selection = canvas.selection;
        const selectionIterator = selection.values();
        const node = selectionIterator.next().value;
        const node_id = node.id;
        node.isEditing = true;
        const editButton = document.querySelector('.canvas-menu button[aria-label="Edit"]') as HTMLElement;
        if (editButton) {
            editButton.click(); // Simulate the click on the edit button
        } else {
            console.error("Edit button not found");
        }
    }
    runGraphChat(canvas: Canvas) {
        canvas.requestSave();
        const selection = canvas.selection;
        const selectionIterator = selection.values();
        const node = selectionIterator.next().value;
        const node_id = node.id;

        const editButton = document.querySelector('.canvas-menu button[aria-label="Sparkle"]') as HTMLButtonElement;
        if (editButton) {
            setTimeout(() => {
                editButton.click(); // Simulate the click on the edit button after 200 milliseconds
            }, 200);
        } else {
            console.error("Edit button not found");
        }
    }
    navigate(canvas: Canvas, direction: string) {
        // const canvas = canvasView.canvas;
        const selection = canvas.selection;
        const selectionIterator = selection.values();
        const node = selectionIterator.next().value;
        if (!node) {
            return;
        }
        if (node.isEditing) {
            return;
        }
        const node_id = node.id;
        const canvas_data = canvas.getData();

        // Assuming direction can be 'next' or 'previous' for simplicity
        const edges = canvas_data.edges;
        const nodes = canvas_data.nodes;
        let targetNodeID: string | null = null;

        switch (direction) {
            case "right":
                // Handle both 'from' and 'to' cases for 'right'
                const edgeRightFrom = edges.find(
                    (edge: Edge) => edge.fromNode === node_id && edge.fromSide === "right"
                );
                if (edgeRightFrom) {
                    targetNodeID = edgeRightFrom.toNode;
                } else {
                    const edgeRightTo = edges.find((edge: Edge) => edge.toNode === node_id && edge.toSide === "right");
                    if (edgeRightTo) {
                        targetNodeID = edgeRightTo.fromNode;
                    }
                }
                break;
            case "left":
                // Handle both 'from' and 'to' cases for 'left'
                const edgeLeftFrom = edges.find((edge: Edge) => edge.fromNode === node_id && edge.fromSide === "left");
                if (edgeLeftFrom) {
                    targetNodeID = edgeLeftFrom.toNode;
                } else {
                    const edgeLeftTo = edges.find((edge: Edge) => edge.toNode === node_id && edge.toSide === "left");
                    if (edgeLeftTo) {
                        targetNodeID = edgeLeftTo.fromNode;
                    }
                }
                break;
            case "top":
                // Handle both 'from' and 'to' cases for 'top'
                const edgeTopFrom = edges.find((edge: Edge) => edge.fromNode === node_id && edge.fromSide === "top");
                if (edgeTopFrom) {
                    targetNodeID = edgeTopFrom.toNode;
                } else {
                    const edgeTopTo = edges.find((edge: Edge) => edge.toNode === node_id && edge.toSide === "top");
                    if (edgeTopTo) {
                        targetNodeID = edgeTopTo.fromNode;
                    }
                }
                break;
            case "bottom":
                // Handle both 'from' and 'to' cases for 'bottom'
                const edgeBottomFrom = edges.find(
                    (edge: Edge) => edge.fromNode === node_id && edge.fromSide === "bottom"
                );
                if (edgeBottomFrom) {
                    targetNodeID = edgeBottomFrom.toNode;
                } else {
                    const edgeBottomTo = edges.find(
                        (edge: Edge) => edge.toNode === node_id && edge.toSide === "bottom"
                    );
                    if (edgeBottomTo) {
                        targetNodeID = edgeBottomTo.fromNode;
                    }
                }
                break;
        }
        // const viewportNodes = canvas.getViewportNodes();
        let viewport_nodes: ViewportNode[] = [];
        let initial_viewport_children = canvas.nodeIndex.data.children;
        if (initial_viewport_children.length > 1) {
            let type_nodes = "nodes";

            // If there is more childen then use this path.
            if (initial_viewport_children[0] && "children" in initial_viewport_children[0]) {
                type_nodes = "children";
            }
            if (type_nodes === "children") {
                for (let i = 0; i < initial_viewport_children.length; i++) {
                    const nodes_list = initial_viewport_children[i].children;

                    nodes_list.forEach((node: ViewportNode) => {
                        viewport_nodes.push(node);
                    });
                }
            }
            if (type_nodes === "nodes") {
                for (let i = 0; i < initial_viewport_children.length; i++) {
                    const viewport_node = initial_viewport_children[i];
                    viewport_nodes.push(viewport_node);
                }
            }
        }

        if (targetNodeID) {
            const target_node = viewport_nodes.find((node) => node.id === targetNodeID);
            if (target_node) {
                // TODO - Figure out the proper way to do this and abstract it out so it's easier to get viewport children
                // @ts-ignore
                canvas.selectOnly(target_node);
                // @ts-ignore
                canvas.zoomToSelection(target_node);
            }
        }
        this.highlightLineage();
    }

    static async parseXml(xmlString: string): Promise<any> {
        try {
            const result = await new Promise((resolve, reject) => {
                parseString(xmlString, (err: any, result: any) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            console.dir(result);
            return result;
        } catch (err) {
            console.error(err);
        }
    }

    parseCustomXML(xmlString: string, tags: string[]) {
        // Function to extract content between tags
        function getContent(tag: string, string: string) {
            const openTag = `<${tag}>`;
            const closeTag = `</${tag}>`;
            const start = string.indexOf(openTag) + openTag.length;
            const end = string.indexOf(closeTag);
            const prompt_content = string.substring(start, end).trim();
            return prompt_content;
        }

        // Initialize the result object
        const result: any = {};

        // Extract content for each tag provided
        tags.forEach((tag: string) => {
            const content = getContent(tag, xmlString);
            result[tag] = content;
        });

        return result;
    }
    async extractTextFromPDF(file_name: string): Promise<string> {
        // TODO - Clean this up later
        // @ts-ignore
        const file_path = await this.app.vault.getResourcePath({
            path: file_name,
        });
        async function loadAndExtractText(file_path: string): Promise<string> {
            try {
                const doc = await pdfjs.getDocument(file_path).promise;
                const numPages = doc.numPages;

                // Load metadata
                // const metadata = await doc.getMetadata();

                let fullText = "";
                for (let i = 1; i <= numPages; i++) {
                    const page = await doc.getPage(i);
                    const content = await page.getTextContent();
                    // TODO - Clean this up
                    // @ts-ignore
                    const pageText = content.items.map((item: { str: string }) => item.str).join(" ");
                    fullText += pageText + " ";

                    // Release page resources.
                    page.cleanup();
                }
                return fullText;
            } catch (err) {
                console.error("Error: " + err);
                throw err;
            }
        }

        const fullDocumentText = await loadAndExtractText(file_path);
        return fullDocumentText;
    }
    addNewNodeButton(menuEl: HTMLElement) {
        if (!menuEl.querySelector(".graph-menu-item")) {
            const graphButtonEl = createEl("button", "clickable-icon graph-menu-item");
            setTooltip(graphButtonEl, "Create User Message", { placement: "top" });
            setIcon(graphButtonEl, "lucide-workflow");
            graphButtonEl.addEventListener("click", async () => {
                // Assuming canvasView is accessible here, or you need to pass it similarly
                const canvasView = this.app.workspace.getLeavesOfType("canvas").first()?.view;
                const view = this.app.workspace.getMostRecentLeaf()?.view;
                // @ts-ignore
                if (!view?.canvas) {
                    return;
                }
                // @ts-ignore
                const canvas = view.canvas;
                const selection = canvas.selection;
                const selectionIterator = selection.values();
                const node = selectionIterator.next().value;
                const x = node.x + node.width + 200;
                const new_node = await this.createChildNode(canvas, node, x, node.y, "");
                new_node.unknownData.role = "user";
            });
            menuEl.appendChild(graphButtonEl);
        }
    }
    addExtraActions(menuEl: HTMLElement) {
        if (!menuEl.querySelector(".wand")) {
            const graphButtonEl = createEl("button", "clickable-icon wand");
            setTooltip(graphButtonEl, "Actions", { placement: "top" });
            setIcon(graphButtonEl, "lucide-wand");

            interface SubmenuItemConfig {
                name: string;
                icon: string;
                tooltip: string;
                callback: () => void;
            }

            function createSubmenu(configs: SubmenuItemConfig[]): HTMLElement {
                const submenuEl = createEl("div", { cls: "submenu" });

                configs.forEach((config) => {
                    const submenuItem = createEl("div", { cls: "submenu-item" });
                    const iconEl = createEl("span", { cls: "clickable-icon" });
                    setIcon(iconEl, config.icon);
                    setTooltip(iconEl, config.tooltip, { placement: "top" });
                    submenuItem.appendChild(iconEl);
                    submenuItem.addEventListener("click", config.callback);
                    submenuEl.appendChild(submenuItem);
                });

                return submenuEl;
            }
            const canvasView = this.app.workspace.getLeavesOfType("canvas").first()?.view;
            const view = this.app.workspace.getMostRecentLeaf()?.view;
            // @ts-ignore
            if (!view?.canvas) {
                return;
            }
            // @ts-ignore
            const canvas = view.canvas;
            const selection = canvas.selection;
            const selectionIterator = selection.values();
            const node = selectionIterator.next().value;

            const submenuConfigs: SubmenuItemConfig[] = [
                {
                    name: "User",
                    icon: "lucide-user",
                    tooltip: "Set role to user",
                    callback: () => {
                        node.unknownData.role = "user";
                        node.unknownData.displayOverride = false;
                        canvas.requestFrame();
                    },
                },
                {
                    name: "Assistant",
                    icon: "lucide-bot",
                    tooltip: "Set role to assistant",
                    callback: () => {
                        node.unknownData.role = "assistant";
                        node.unknownData.displayOverride = false;
                        canvas.requestFrame();
                    },
                },
                {
                    name: "System Prompt",
                    icon: "lucide-monitor-check",
                    tooltip: "Set system prompt",
                    callback: () => {
                        node.unknownData.role = "system";
                        node.unknownData.displayOverride = false;
                        canvas.requestFrame();
                    },
                },
                {
                  name: "Refresh",
                  icon: "lucide-refresh-ccw",
                  tooltip: "Refresh",
                  callback: () => {
                      console.log("Clicked Refresh")
                      refreshNode(node.id, this.settings.system_prompt, {
                        model: "default",
                        provider: "default",
                        temperature: 1,
                    }, this);
                  },
              },
              {
                name: "Refresh Outgoing",  
                icon: "lucide-refresh-ccw",
                tooltip: "Refresh Outgoing",
                callback: () => {
                    console.log("Clicked Refresh")
                    refreshOutgoing(node.id, this.settings.system_prompt, {
                      model: "default",
                      provider: "default",
                      temperature: 1,
                  }, this);
                },
            },
            ];

            const submenuEl = createSubmenu(submenuConfigs);

            // Append the submenu to the main button
            graphButtonEl.appendChild(submenuEl);

            let submenuVisible = false;

            graphButtonEl.addEventListener("click", () => {
                submenuVisible = !submenuVisible;
                submenuEl.style.display = submenuVisible ? "grid" : "none";
            });

            menuEl.appendChild(graphButtonEl);
        }
    }
    getAllAncestorNodes(nodes: Node[], edges: Edge[], nodeId: string): Node[] {
        let ancestors: Node[] = [];
        let queue: string[] = [nodeId];
        let processedNodes: Set<string> = new Set();

        while (queue.length > 0) {
            let currentId = queue.shift();
            if (!currentId || processedNodes.has(currentId)) continue;

            processedNodes.add(currentId);
            const incomingEdges: Edge[] = edges.filter((edge) => edge.toNode === currentId);
            incomingEdges.forEach((edge) => {
                const ancestor = nodes.find((node) => node.id === edge.fromNode);
                if (ancestor && !processedNodes.has(ancestor.id)) {
                    ancestors.push(ancestor);
                    queue.push(ancestor.id);
                }
            });
        }

        return ancestors;
    }
    static getLongestLineage(nodes: Node[], edges: Edge[], nodeId: string): Node[] {
        let longestLineage: Node[] = [];

        function findLongestPath(currentId: string, path: Node[]): void {
            const incomingEdges: Edge[] = edges.filter((edge) => edge.toNode === currentId);
            if (incomingEdges.length === 0) {
                // Check if the current path is the longest we've encountered
                if (path.length > longestLineage.length) {
                    longestLineage = path.slice();
                }
                return;
            }

            incomingEdges.forEach((edge) => {
                const ancestor = nodes.find((node) => node.id === edge.fromNode);
                if (ancestor) {
                    // Check if the ancestor is the direct ancestor (index 1) and has 'context' in its content
                    if (path.length === 1 && ancestor.type === "text" && ancestor.text.includes("<context>")) {
                        return; // Skip this lineage
                    }
                    findLongestPath(ancestor.id, path.concat(ancestor));
                }
            });
        }

        // Start with the given node
        const startNode = nodes.find((node) => node.id === nodeId);
        if (startNode) {
            findLongestPath(nodeId, [startNode]);
        }

        return longestLineage;
    }
    async getDirectAncestorsWithContext(nodes: Node[], edges: Edge[], nodeId: string): Promise<string> {
        let direct_ancentors_context = "";

        const startNode = nodes.find((node) => node.id === nodeId);
        if (!startNode) return "";

        const incomingEdges: Edge[] = edges.filter((edge) => edge.toNode === nodeId);
        for (let i = 0; i < incomingEdges.length; i++) {
            const edge = incomingEdges[i];
            const ancestor = nodes.find((node) => node.id === edge.fromNode);
            if (ancestor && ancestor.type === "text" && ancestor.text.includes("<context>")) {
                direct_ancentors_context += ancestor.text + "\n";
            } else if (ancestor && ancestor.type === "file" && ancestor.file && ancestor.file.includes(".md")) {
                const file_path = ancestor.file;
                const file = this.app.vault.getFileByPath(file_path);
                if (file) {
                    const context = await this.app.vault.cachedRead(file);
                    direct_ancentors_context += "\n" + context;
                } else {
                    console.error("File not found:", file_path);
                }
            }
        }
        return direct_ancentors_context;
    }
    async getAllAncestorsWithContext(nodes: Node[], edges: Edge[], nodeId: string): Promise<string> {
        let ancestors_context = "";
        let convo_total_tokens = 0;

        const findAncestorsWithContext = async (nodeId: string) => {
            const node = nodes.find((node) => node.id === nodeId);
            if (!node) return;

            const incomingEdges: Edge[] = edges.filter((edge) => edge.toNode === nodeId);
            for (let i = 0; i < incomingEdges.length; i++) {
                const edge = incomingEdges[i];
                const ancestor = nodes.find((node) => node.id === edge.fromNode);
                if (ancestor) {
                    let contextToAdd = "";

                    if (ancestor.type === "text") {
                        // @ts-ignore
                        const role = ancestor.role || "";
                        if (role.length === 0) {
                            let ancestor_text = ancestor.text;
                            const block_ref_content = await this.getRefBlocksContent(ancestor_text);
                            ancestor_text += block_ref_content;
                            contextToAdd += ancestor_text;
                        }
                    } else if (ancestor.type === "file" && ancestor.file && ancestor.file.includes(".md")) {
                        const file_path = ancestor.file;
                        const file = this.app.vault.getFileByPath(file_path);
                        if (file) {
                            const context = await this.app.vault.cachedRead(file);

                            if (!context.includes("caret_prompt")) {
                                contextToAdd = `\n\n---------------------------\n\nFile Title: ${file_path}\n${context}`;
                            }
                        } else {
                            console.error("File not found:", file_path);
                        }
                    } else if (ancestor.type === "file" && ancestor.file && ancestor.file.includes(".pdf")) {
                        const file_name = ancestor.file;
                        const text = await this.extractTextFromPDF(file_name);
                        contextToAdd = `\n\n---------------------------\n\nPDF File Title: ${file_name}\n${text}`;
                    }

                    const contextTokens = this.encoder.encode(contextToAdd).length;
                    if (convo_total_tokens + contextTokens > this.settings.context_window) {
                        new Notice(
                            "Exceeding context window while adding ancestor context. Stopping further additions."
                        );
                        return;
                    }

                    ancestors_context += contextToAdd;
                    convo_total_tokens += contextTokens;

                    await findAncestorsWithContext(ancestor.id);
                }
            }
        };

        await findAncestorsWithContext(nodeId);
        return ancestors_context;
    }

    async getRefBlocksContent(node_text: any): Promise<string> {
        const bracket_regex = /\[\[(.*?)\]\]/g;
        let rep_block_content = "";

        let match;
        const matches = [];

        while ((match = bracket_regex.exec(node_text)) !== null) {
            matches.push(match);
        }
        for (const match of matches) {
            let file_path = match[1];
            if (!file_path.includes(".")) {
                file_path += ".md";
            }
            let file = await this.app.vault.getFileByPath(file_path);

            if (!file) {
                const files = this.app.vault.getFiles();
                let matchedFile = files.find((file) => file.name === file_path);
                if (matchedFile) {
                    file = matchedFile;
                }
            }
            if (file && file_path.includes(".md")) {
                const file_content = await this.app.vault.cachedRead(file);
                rep_block_content += `File: ${file_path}\n${file_content}`; // Update modified_content instead of message.content
            } else if (file && file_path.includes(".pdf")) {
                const pdf_content = await this.extractTextFromPDF(file_path);
                rep_block_content += `PDF File Name: ${file_path}\n ${pdf_content}`;
            } else {
                new Notice(`File not found: ${file_path}`);
            }
        }

        return rep_block_content;
    }
    async getCurrentNode(canvas: Canvas, node_id: string) {
        await canvas.requestSave(true);
        const nodes_iterator = canvas.nodes.values();
        let node = null;
        for (const node_obj of nodes_iterator) {
            if (node_obj.id === node_id) {
                node = node_obj;
                break;
            }
        }
        return node;
    }
    async getCurrentCanvasView() {
        const canvas_view = this.app.workspace.getMostRecentLeaf()?.view;
        // @ts-ignore
        if (!canvas_view || !canvas_view.canvas) {
            return;
        }
        // @ts-ignore
        const canvas = canvas_view.canvas;
        return canvas_view;
    }
    async getAssociatedNodeContent(currentNode: any, nodes: any[], edges: any[]): Promise<string> {
        const visited = new Set();
        const contentBlocks: string[] = [];

        const traverse = async (nodeId: string) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const node = nodes.find((n) => n.id === nodeId);
            if (node) {
                let nodeContent = "";
                if (node.role === "") {
                    if (node.type === "text") {
                        nodeContent = node.text;
                        const block_ref_content = await this.getRefBlocksContent(node.text);
                        nodeContent += block_ref_content;
                    } else if (node.type === "file") {
                        if (node.file && node.file.includes(".md")) {
                            const file = this.app.vault.getFileByPath(node.file);
                            if (file) {
                                const fileContent = await this.app.vault.cachedRead(file);
                                nodeContent = `\n\n---------------------------\n\nFile Title: ${node.file}\n${fileContent}`;
                            } else {
                                console.error("File not found:", node.file);
                            }
                        } else if (node.file && node.file.includes(".pdf")) {
                            const pdfContent = await this.extractTextFromPDF(node.file);
                            nodeContent = `\n\n---------------------------\n\nPDF File Title: ${node.file}\n${pdfContent}`;
                        }
                    }
                    contentBlocks.push(nodeContent);
                }
            }

            const connectedEdges = edges.filter((edge) => edge.fromNode === nodeId || edge.toNode === nodeId);
            for (const edge of connectedEdges) {
                const nextNodeId = edge.fromNode === nodeId ? edge.toNode : edge.fromNode;
                const next_node = nodes.find((n) => n.id === nextNodeId);
                if (next_node.role === "user" || next_node.role === "assistant") {
                    continue;
                }

                await traverse(nextNodeId);
            }
        };

        await traverse(currentNode.id);

        return contentBlocks.join("\n");
    }

    async sparkle(
        node_id: string,
        system_prompt: string = "",
        sparkle_config: SparkleConfig = {
            model: "default",
            provider: "default",
            temperature: 1,
        }
    ) {
        return sparkle(node_id, system_prompt, sparkle_config, this)
    }
    async update_node_content(node_id: string, stream: Stream<any>, llm_provider: string) {
        const canvas_view = this.app.workspace.getMostRecentLeaf()?.view;
        // @ts-ignore
        if (!canvas_view?.canvas) {
            return;
        }
        const canvas: Canvas = (canvas_view as any).canvas; // Assuming canvas is a property of the view
        const canvas_data = canvas.getData();
        const nodes_iterator = canvas.nodes.values();
        let node = null;
        for (const node_objs of nodes_iterator) {
            if (node_objs.id === node_id) {
                node = node_objs;
                break;
            }
        }
        node.width = 510;

        if (
            llm_provider === "openai" ||
            llm_provider === "groq" ||
            llm_provider === "custom" ||
            llm_provider === "openrouter"
        ) {
            for await (const part of stream) {
                const delta_content = part.choices[0]?.delta.content || "";

                const current_text = node.text;
                const new_content = `${current_text}${delta_content}`;
                const word_count = new_content.split(/\s+/).length;
                const number_of_lines = Math.ceil(word_count / 7);
                if (word_count > 500) {
                    node.width = 750;
                    node.height = Math.max(200, number_of_lines * 35);
                } else {
                    node.height = Math.max(200, number_of_lines * 45);
                }

                node.setText(new_content);
                node.render();
            }
        }
        if (llm_provider === "ollama") {
            for await (const part of stream) {
                const current_text = node.text;
                const new_content = `${current_text}${part.message.content}`;
                const word_count = new_content.split(/\s+/).length;
                const number_of_lines = Math.ceil(word_count / 7);
                if (word_count > 500) {
                    const width = 750;
                    const height = Math.max(200, number_of_lines * 35);
                    // TODO - Try out node.resize() to see if that solves the visual bug.
                    node.height = height;
                    // node.resize(width);
                } else {
                    node.height = Math.max(200, number_of_lines * 45);
                }
                node.setText(new_content);
                node.render();
                node.moveTo();
            }
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

    add_sparkle_button(menuEl: HTMLElement) {
        if (!menuEl.querySelector(".spark_button")) {
            const buttonEl = createEl("button", "clickable-icon spark_button");
            setTooltip(buttonEl, "Sparkle", { placement: "top" });
            setIcon(buttonEl, "lucide-sparkles");
            buttonEl.addEventListener("click", async () => {
                const canvasView = this.app.workspace.getMostRecentLeaf()?.view;
                // @ts-ignore
                if (!canvasView.canvas) {
                    return;
                }
                // @ts-ignore
                const canvas = canvasView.canvas;
                await canvas.requestSave(true);
                const selection = canvas.selection;
                const selectionIterator = selection.values();
                const node = selectionIterator.next().value;
                const node_id = node.id;
                await this.sparkle(node_id);
            });
            menuEl.appendChild(buttonEl);
        }
    }
    async get_node_by_id(canvas: Canvas, node_id: string) {
        const nodes_iterator = canvas.nodes.values();
        for (const node of nodes_iterator) {
            if (node.id === node_id) {
                return node;
            }
        }
        return null; // Return null if no node matches the ID
    }

    async createChildNode(
      canvas: Canvas,
      parentNode: CanvasNodeData,
      x: number,
      y: number,
      content: string = "",
      from_side: string = "right",
      to_side: string = "left"
  ) {
    return CaretPlugin.createChildNode(canvas, parentNode, x, y, content, from_side, to_side);
  }

    static async createChildNode(
        canvas: Canvas,
        parentNode: CanvasNodeData,
        x: number,
        y: number,
        content: string = "",
        from_side: string = "right",
        to_side: string = "left"
    ) {
        let tempChildNode = await CaretPlugin.addNodeToCanvas(canvas, CaretPlugin.generateRandomId(16), {
            x: x,
            y: y,
            width: 400,
            height: 200,
            type: "text",
            content,
        });
        await CaretPlugin.createEdge(parentNode, tempChildNode, canvas, from_side, to_side);

        const node = canvas.nodes?.get(tempChildNode?.id!);
        if (!node) {
            return;
        }
        return node;
    }

    static async addNodeToCanvas(canvas: Canvas, id: string, { x, y, width, height, type, content }: NewNode) {
        if (!canvas) {
            return;
        }

        const data = canvas.getData();
        if (!data) {
            return;
        }

        const node: Partial<CanvasTextData | CanvasFileData> = {
            id: id,
            x: x,
            y: y,
            width: width,
            height: height,
            type: type,
        };

        switch (type) {
            case "text":
                node.text = content;
                break;
            case "file":
                node.file = content;
                break;
        }

        canvas.importData({
            nodes: [...data.nodes, node],
            edges: data.edges,
        });

        canvas.requestFrame();

        return node;
    }
    static async createEdge(node1: any, node2: any, canvas: any, from_side: string = "right", to_side: string = "left") {
        CaretPlugin.addEdgeToCanvas(
            canvas,
            CaretPlugin.generateRandomId(16),
            {
                fromOrTo: "from",
                side: from_side,
                node: node1,
            },
            {
                fromOrTo: "to",
                side: to_side,
                node: node2,
            }
        );
    }
    static generateRandomId(length: number): string {
        const hexArray = Array.from({ length }, () => {
            const randomHex = Math.floor(Math.random() * 16).toString(16);
            return randomHex;
        });
        return hexArray.join("");
    }
    
    static addEdgeToCanvas(canvas: any, edgeID: string, fromEdge: any, toEdge: any) {
        if (!canvas) {
            return;
        }

        const data = canvas.getData();
        if (!data) {
            return;
        }

        canvas.importData({
            edges: [
                ...data.edges,
                {
                    id: edgeID,
                    fromNode: fromEdge.node.id,
                    fromSide: fromEdge.side,
                    toNode: toEdge.node.id,
                    toSide: toEdge.side,
                },
            ],
            nodes: data.nodes,
        });
        canvas.requestFrame();
    }

    addChatIconToRibbon() {
        this.addRibbonIcon("message-square", "Caret Chat", async (evt) => {
            await this.app.workspace.getLeaf(true).setViewState({
                type: VIEW_CHAT,
                active: true,
            });
        });
    }

    onunload() {}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
