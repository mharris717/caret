import CaretPlugin from "main";
import { Notice } from "obsidian";

import { CaretCanvas, RestrictedPlugin, TrackCanvasChanges, mergeSettingsAndSparkleConfig } from "./domain";
import { Node, SparkleConfig } from "./types";

// export type Me = Pick<
//   CaretPlugin,
//   | "app"
//   | "settings"

// >;

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
  if (!plugin.tracker) {
    plugin.tracker = new TrackCanvasChanges(new CaretCanvas(plugin.app.workspace.getMostRecentLeaf()!.view, plugin));
  }

  const canvas_nodes = CaretCanvas.fromPlugin(plugin);

  const { app, settings } = plugin;
  const node = canvas_nodes.getNode(node_id).node;

  // @ts-ignore
  node.unknownData.role = "user";

  const { edges, nodes, canvas } = canvas_nodes;

  // Continue with operations on `target_node`
  if (node.hasOwnProperty("file")) {
    // @ts-ignore
    const file_path = node.file!.path;
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
          const xml = await CaretPlugin.parseXml(xml_content);
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
            const user_node = await plugin.createChildNode(
              canvas_nodes.canvas,
              node,
              x,
              y,
              new_node_content,
              "right",
              "left"
            );
            user_node.unknownData.role = "user";
            user_node.unknownData.displayOverride = false;

            const sparkle_config: SparkleConfig = {
              model: prompt_model,
              provider: prompt_provider,
              temperature: prompt_temperature,
            };

            const sparkle_promise = (async () => {
              await waitForPromptDelay(prompt_delay);
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
          const xml = await CaretPlugin.parseXml(xml_content);
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
            await waitForPromptDelay(prompt_delay);
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

  return await sparkle_basic(node, system_prompt, sparkle_config, plugin);
}

async function sparkle_basic(node: Node, system_prompt: string, sparkle_config: SparkleConfig, plugin: RestrictedPlugin) {
  const canvas_nodes = CaretCanvas.fromPlugin(plugin);
  const { nodes, edges, canvas } = canvas_nodes;
  const settings = plugin.settings;
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
  const { settings } = plugin;

  const canvas_nodes = CaretCanvas.fromPlugin(plugin);
  const { nodes, edges } = canvas_nodes;
  const refreshed_node = canvas_nodes.getNode(refreshed_node_id);
  //   let refreshed_node = await plugin.getCurrentNode(canvas, refreshed_node_id);

  const longest_lineage = refreshed_node.getLongestLineage();
  console.log("longest_lineage in refresh", longest_lineage);
  const parent_node = longest_lineage[1];
  console.log("parent_node", parent_node);

  const { conversation } = await buildConversation(parent_node!, nodes, edges, system_prompt, plugin);
  console.log(conversation);
  const mergedSparkleConfig = mergeSettingsAndSparkleConfig(settings, sparkle_config);
  const { provider, model, temperature } = mergedSparkleConfig;

  const stream = await plugin.llm_call_streaming(provider, model, conversation, temperature);
  refreshed_node.node.text = "";
  await plugin.update_node_content(refreshed_node.id, stream, provider);
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
  const canvas_nodes = CaretCanvas.fromPlugin(plugin);

  let updated_node = canvas_nodes.getNode(updated_node_id);
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
  const longest_lineage = CaretPlugin.getLongestLineage(nodes, edges, node.id);
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

async function waitForPromptDelay(prompt_delay: number) {
  if (prompt_delay > 0) {
    new Notice(`Waiting for ${prompt_delay} seconds...`);
    await new Promise((resolve) => setTimeout(resolve, prompt_delay * 1000));
    new Notice(`Done waiting for ${prompt_delay} seconds.`);
  }
}
