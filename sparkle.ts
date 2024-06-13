import CaretPlugin from "main";
import { Notice, View } from "obsidian";

import { CaretPluginSettings, Edge, Node, SparkleConfig } from "./types";

type RestrictedPlugin = Pick<
  CaretPlugin,
  | "app"
  | "settings"
  | "getCurrentNode"
  | "getFrontmatter"
  | "parseXml"
  | "createChildNode"
  | "get_node_by_id"
  | "llm_call_streaming"
  | "llm_call"
  | "update_node_content"
  | "getLongestLineage"
  | "getAssociatedNodeContent"
  | "getRefBlocksContent"
  | "encoder"
>;
export async function sparkle(
  node_id: string,
  system_prompt: string = "",
  sparkle_config: SparkleConfig = {
    model: "default",
    provider: "default",
    temperature: 1,
  },
  plugin: RestrictedPlugin
) {
  const canvas_view = plugin.app.workspace.getMostRecentLeaf()?.view;
  // @ts-ignore
  if (!canvas_view || !canvas_view.canvas) {
    return;
  }
  // @ts-ignore
  const canvas = canvas_view.canvas;
  const { app, settings } = plugin;

  let node = await plugin.getCurrentNode(canvas, node_id);
  if (!node) {
    console.error("Node not found with ID:", node_id);
    return;
  }
  node.unknownData.role = "user";

  const canvas_data = canvas.getData();
  const { edges, nodes } = canvas_data;

  // Continue with operations on `target_node`
  if (node.hasOwnProperty("file")) {
    const file_path = node.file.path;
    const file = app.vault.getAbstractFileByPath(file_path);
    if (file) {
      // @ts-ignore
      const text = await app.vault.cachedRead(file);

      // Check for the presence of three dashes indicating the start of the front matter
      const front_matter = await plugin.getFrontmatter(file);
      if (front_matter.hasOwnProperty("caret_prompt")) {
        let caret_prompt = front_matter.caret_prompt;

        if (caret_prompt === "parallel" && text) {
          const matchResult = text.match(/```xml([\s\S]*?)```/);
          if (!matchResult) {
            new Notice("Incorrectly formatted parallel workflow.");
            return;
          }
          const xml_content = matchResult[1].trim();
          const xml = await plugin.parseXml(xml_content);
          const system_prompt_list = xml.root.system_prompt;

          const system_prompt = system_prompt_list[0]._.trim();

          const prompts = xml.root.prompt;
          const card_height = node.height;
          const middle_index = Math.floor(prompts.length / 2);
          const highest_y = node.y - middle_index * (100 + card_height); // Calculate the highest y based on the middle index
          const sparkle_promises = [];

          for (let i = 0; i < prompts.length; i++) {
            const prompt = prompts[i];

            const prompt_content = prompt._.trim();
            const prompt_delay = prompt.$?.delay || 0;
            const prompt_model = prompt.$?.model || "default";
            const prompt_provider = prompt.$?.provider || "default";
            const prompt_temperature = parseFloat(prompt.$?.temperature) || settings.temperature;
            const new_node_content = `${prompt_content}`;
            const x = node.x + node.width + 200;
            const y = highest_y + i * (100 + card_height); // Increment y for each prompt to distribute them vertically including card height

            // Create a new user node
            const user_node = await plugin.createChildNode(canvas, node, x, y, new_node_content, "right", "left");
            user_node.unknownData.role = "user";
            user_node.unknownData.displayOverride = false;

            const sparkle_config: SparkleConfig = {
              model: prompt_model,
              provider: prompt_provider,
              temperature: prompt_temperature,
            };

            const sparkle_promise = (async () => {
              if (prompt_delay > 0) {
                new Notice(`Waiting for ${prompt_delay} seconds...`);
                await new Promise((resolve) => setTimeout(resolve, prompt_delay * 1000));
                new Notice(`Done waiting for ${prompt_delay} seconds.`);
              }
              await sparkle(user_node.id, system_prompt, sparkle_config, plugin);
            })();

            sparkle_promises.push(sparkle_promise);
          }

          await Promise.all(sparkle_promises);
          return;
        } else if (caret_prompt === "linear") {
          const matchResult = text.match(/```xml([\s\S]*?)```/);
          if (!matchResult) {
            new Notice("Incorrectly formatted linear workflow.");
            return;
          }
          const xml_content = matchResult[1].trim();
          const xml = await plugin.parseXml(xml_content);
          const system_prompt_list = xml.root.system_prompt;

          const system_prompt = system_prompt_list[0]._.trim();

          const prompts = xml.root.prompt;

          let current_node = node;
          for (let i = 0; i < prompts.length; i++) {
            const prompt = prompts[i];
            const prompt_content = prompt._.trim();
            const prompt_delay = prompt.$?.delay || 0;
            const prompt_model = prompt.$?.model || "default";
            const prompt_provider = prompt.$?.provider || "default";
            const prompt_temperature = parseFloat(prompt.$?.temperature) || settings.temperature;
            const new_node_content = `${prompt_content}`;
            const x = current_node.x + current_node.width + 200;
            const y = current_node.y;

            // Create a new user node
            const user_node = await plugin.createChildNode(canvas, current_node, x, y, new_node_content, "right", "left");
            user_node.unknownData.role = "user";
            user_node.unknownData.displayOverride = false;
            const sparkle_config: SparkleConfig = {
              model: prompt_model,
              provider: prompt_provider,
              temperature: prompt_temperature,
            };
            if (prompt_delay > 0) {
              new Notice(`Waiting for ${prompt_delay} seconds...`);
              await new Promise((resolve) => setTimeout(resolve, prompt_delay * 1000));
              new Notice(`Done waiting for ${prompt_delay} seconds.`);
            }
            const assistant_node = await sparkle(user_node.id, system_prompt, sparkle_config, plugin);
            current_node = assistant_node;
          }
        } else {
          new Notice("Invalid Caret Prompt");
        }

        return;
      }
    } else {
      console.error("File not found or is not a readable file:", file_path);
    }
  }

  const { conversation } = await buildConversation(node, nodes, edges, system_prompt, plugin);

  const mergedSparkleConfig = mergeSettingsAndSparkleConfig(settings, sparkle_config);
  const { provider, model, temperature } = mergedSparkleConfig;

  const node_content = ``;
  const x = node.x + node.width + 200;
  const new_node = await plugin.createChildNode(canvas, node, x, node.y, node_content, "right", "left");
  if (!new_node) {
    throw new Error("Invalid new node");
  }
  const new_node_id = new_node.id;
  if (!new_node_id) {
    throw new Error("Invalid node id");
  }
  const new_canvas_node = await plugin.get_node_by_id(canvas, new_node_id);

  if (!new_canvas_node.unknownData.hasOwnProperty("role")) {
    new_canvas_node.unknownData.role = "";
    new_canvas_node.unknownData.displayOverride = false;
  }
  new_canvas_node.unknownData.role = "assistant";

  if (settings.llm_provider_options[provider][model].streaming) {
    const stream = await plugin.llm_call_streaming(provider, model, conversation, temperature);
    await plugin.update_node_content(new_node_id, stream, provider);
    return new_node;
  } else {
    const content = await plugin.llm_call(settings.llm_provider, settings.model, conversation);
    new_node.setText(content);
  }
}

class CanvasNodes {
  nodes: Node[];
  edges: Edge[];
  canvas: any;
  constructor(readonly canvas_view: View, readonly plugin: RestrictedPlugin) {
    // @ts-ignore
    if (!canvas_view || !canvas_view.canvas) {
      return;
    }
    // @ts-ignore
    const canvas = canvas_view.canvas;
    this.canvas = canvas;

    // node.unknownData.role = "user";

    const canvas_data = canvas.getData();
    const { edges, nodes } = canvas_data;
    this.nodes = nodes;
    this.edges = edges;
  }
}

export async function refreshNode(
  refreshed_node_id: string,
  system_prompt: string = "",
  sparkle_config: SparkleConfig = {
    model: "default",
    provider: "default",
    temperature: 1,
  },
  plugin: RestrictedPlugin
) {
  //   console.log("refreshed_node_id", refreshed_node_id);
  const canvas_view = plugin.app.workspace.getMostRecentLeaf()?.view;
  const { app, settings } = plugin;

  const canvas_nodes = new CanvasNodes(canvas_view!, plugin);
  const { nodes, edges, canvas } = canvas_nodes;

  let refreshed_node = await plugin.getCurrentNode(canvas, refreshed_node_id);
  if (!refreshed_node) {
    console.error("Node not found with ID:", refreshed_node_id);
    return;
  }

  const longest_lineage = plugin.getLongestLineage(nodes, edges, refreshed_node.id);
  console.log("longest_lineage in refresh", longest_lineage);
  const parent_node = longest_lineage[1];
  console.log("parent_node", parent_node);

  const { conversation } = await buildConversation(parent_node!, nodes, edges, system_prompt, plugin);
  console.log(conversation);
  const mergedSparkleConfig = mergeSettingsAndSparkleConfig(settings, sparkle_config);
  const { provider, model, temperature } = mergedSparkleConfig;

  const stream = await plugin.llm_call_streaming(provider, model, conversation, temperature);
  refreshed_node.text = "";
  await plugin.update_node_content(refreshed_node.id, stream, provider);
}

function mergeSettingsAndSparkleConfig(settings: CaretPluginSettings, sparkle_config: SparkleConfig): SparkleConfig {
  let model = settings.model;
  let provider = settings.llm_provider;
  let temperature = settings.temperature;
  if (sparkle_config.model !== "default") {
    model = sparkle_config.model;
  }
  if (sparkle_config.provider !== "default") {
    provider = sparkle_config.provider;
  }
  if (sparkle_config.temperature !== settings.temperature) {
    temperature = sparkle_config.temperature;
  }
  return { model, provider, temperature };
}

class FancyNode {
  constructor(readonly node: Node, readonly canvas_nodes: CanvasNodes) {}

  outgoingNodes() {
    return this.canvas_nodes.edges.filter((edge) => edge.fromNode === this.node.id).map((edge) => this.getNode(edge.toNode));
  }

  getNode(nodeId: string) {
    const [res] = this.canvas_nodes.nodes.filter((node) => node.id === nodeId);
    return new FancyNode(res, this.canvas_nodes);
  }

  async getAssociatedNodeContent() {
    return this.canvas_nodes.plugin.getAssociatedNodeContent(this.node, this.canvas_nodes.nodes, this.canvas_nodes.edges);
  }
}

export async function refreshOutgoing(
  updated_node_id: string,
  system_prompt: string = "",
  sparkle_config: SparkleConfig = {
    model: "default",
    provider: "default",
    temperature: 1,
  },
  plugin: RestrictedPlugin
) {
  const canvas_view = plugin.app.workspace.getMostRecentLeaf()?.view;
  const { app, settings } = plugin;

  const canvas_nodes = new CanvasNodes(canvas_view!, plugin);
  const { nodes, edges, canvas } = canvas_nodes;

  let updated_node_raw = await plugin.getCurrentNode(canvas, updated_node_id);
  let updated_node = new FancyNode(updated_node_raw, canvas_nodes);
  for (const outgoing of updated_node.outgoingNodes()) {
    // @ts-ignore
    console.log("outgoing role", outgoing.node.role);
    // @ts-ignore
    if (outgoing.node.role === "assistant") {
      await refreshNode(outgoing.node.id, system_prompt, sparkle_config, plugin);
    }
    // await refreshNode(outgoing.node.id, system_prompt, sparkle_config, plugin);
    await refreshOutgoing(outgoing.node.id, system_prompt, sparkle_config, plugin);
  }
}

async function buildConversation(node: Node, nodes: Node[], edges: any[], system_prompt: string, plugin: RestrictedPlugin) {
  const longest_lineage = plugin.getLongestLineage(nodes, edges, node.id);
  console.log("longest", longest_lineage);

  const conversation = [];
  let local_system_prompt = system_prompt;
  let convo_total_tokens = 0;
  const settings = plugin.settings;

  for (let i = 0; i < longest_lineage.length; i++) {
    const node = longest_lineage[i];
    const node_context = await plugin.getAssociatedNodeContent(node, nodes, edges);
    // @ts-ignore
    let role = node.role || "";
    if (role === "user") {
      let content = node.text;
      // Only for the first node
      // And get referencing content here.
      const block_ref_content = await plugin.getRefBlocksContent(content);
      if (block_ref_content.length > 0) {
        content += `\n${block_ref_content}`;
      }
      if (node_context.length > 0) {
        content += `\n${node_context}`;
      }

      if (content && content.length > 0) {
        const user_message_tokens = plugin.encoder.encode(content).length;
        if (user_message_tokens + convo_total_tokens > settings.context_window) {
          new Notice("Exceeding context window while adding user message. Trimming content");
          break;
        }
        const message = {
          role,
          content,
        };
        if (message.content.length > 0) {
          conversation.push(message);
          convo_total_tokens += user_message_tokens;
        }
      }
    } else if (role === "assistant") {
      const content = node.text;
      const message = {
        role,
        content,
      };
      conversation.push(message);
    } else if (role === "system") {
      local_system_prompt = node.text;
    }
  }
  conversation.reverse();
  if (local_system_prompt.length > 0) {
    conversation.unshift({ role: "system", content: local_system_prompt });
  }
  return { conversation };
}
