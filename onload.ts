import { encodingForModel } from "js-tiktoken";

import { Message } from "./types";
import { Command, MarkdownView, Modal, Notice } from "obsidian";

// Import all of the views, components, models, etc
import { CaretSettingTab } from "./settings";
import { CMDJModal } from "./modals/inlineEditingModal";
import { InsertNoteModal } from "./modals/insertNoteModal";
import { RemoveCustomModelModal } from "./modals/removeCustomModel";
import { SystemPromptModal } from "./modals/systemPromptModal";
import { redBackgroundField } from "./editorExtensions/inlineDiffs";
import { CustomModelModal } from "./modals/addCustomModel";
import { LinearWorkflowEditor } from "./views/workflowEditor";
import { FullPageChat, VIEW_CHAT } from "./views/chat";

import { escapeXml, parseXml } from "./util";
import { LlmCall } from "./llm_call";
import CaretPlugin from "./main";

export class CaretOnload {
    constructor(readonly plugin: CaretPlugin) {}
    get app() {
        return this.plugin.app;
    }

    get settings() {
        return this.plugin.settings;
    }
    get encoder() {
        return this.plugin.encoder;
    }

    addCommand(command: Command) {
        return this.plugin.addCommand(command);
    }

    async onload() {
        // Set up the encoder (gpt-4 is just used for everything as a short term solution)
        this.plugin.encoder = encodingForModel("gpt-4-0125-preview");
        // Load settings
        await this.plugin.loadSettings();
        this.plugin.llm_call = new LlmCall(this.plugin.settings);

        // Initialize settings dab.
        this.plugin.addSettingTab(new CaretSettingTab(this.app, this.plugin));

        // Add Commands.
        this.addCommand({
            id: "add-custom-models",
            name: "Add Custom Models",
            callback: () => {
                new CustomModelModal(this.app, this.plugin).open();
            },
        });

        this.addCommand({
            id: "remove-custom-models",
            name: "Remove Custom Models",
            callback: () => {
                new RemoveCustomModelModal(this.app, this.plugin).open();
            },
        });
        this.addCommand({
            id: "set-system-prompt",
            name: "Set System Prompt",
            callback: () => {
                new SystemPromptModal(this.app, this.plugin).open();
            },
        });
        this.addCommand({
            id: "create-new-workflow",
            name: "Create New Workflow",
            callback: () => {
                const leaf = this.app.workspace.getLeaf(true);
                const linearWorkflowEditor = new LinearWorkflowEditor(this.plugin, leaf);
                leaf.open(linearWorkflowEditor);
                this.app.workspace.revealLeaf(leaf);
            },
        });
        this.addCommand({
            id: "create-linear-workflow",
            name: "Create Linear Workflow From Canvas",
            callback: async () => {
                const { canvas } = this.plugin.getCurrentCanvas();
                if (!canvas) {
                    return;
                }

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
                    const escaped_content = escapeXml(prompts[i]);
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
                                const text = await this.plugin.extractTextFromPDF(file.name);
                                const text_token_length = this.plugin.encoder.encode(text).length;
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
                            const stream: Message = await this.plugin.llm_call.llm_call_streaming(
                                this.settings.llm_provider,
                                this.settings.model,
                                conversation,
                                1
                            );

                            await this.plugin.update_node_content(node_id, stream, this.settings.llm_provider);
                        } else {
                            const content = await this.plugin.llm_call.llm_call(
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
                    new CMDJModal(this.app, selectedText, startIndex, endIndex, this.plugin).open();
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
                    const front_matter = await this.plugin.getFrontmatter(current_file);

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
                        xml_object = await parseXml(text);
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
        this.plugin.registerEvent(
            this.app.workspace.on("active-leaf-change", (event) => {
                // TODO - Refactor this to use getActiveViewOfType
                // Just not sure what the constructor for that is yet
                const currentLeaf = this.app.workspace.activeLeaf;
                if (currentLeaf) {
                    this.plugin.unhighlightLineage();
                    if (currentLeaf?.view.getViewType() === "canvas") {
                        this.plugin.patchCanvasMenu();
                    }
                }
            })
        );
        // Register the editor extension
        this.plugin.registerEditorExtension([redBackgroundField]);

        // Register the sidebar icon
        this.plugin.addChatIconToRibbon();

        // Register Views
        // Currently not using the sidebar chat.
        // this.registerView(VIEW_NAME_SIDEBAR_CHAT, (leaf) => new SidebarChat(leaf));
        this.plugin.registerView(VIEW_CHAT, (leaf) => new FullPageChat(this, leaf));
    }
}
