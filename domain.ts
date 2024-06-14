import CaretPlugin from "main";
import { View } from "obsidian";

import { refreshOutgoing } from "./sparkle";
import { CaretPluginSettings, Edge, Node, SparkleConfig } from "./types";

export type RestrictedPlugin = Pick<
  CaretPlugin,
  | "app"
  | "settings"
  | "getCurrentNode"
  | "getFrontmatter"
  | "createChildNode"
  | "get_node_by_id"
  | "llm_call_streaming"
  | "llm_call"
  | "update_node_content"
  | "getAssociatedNodeContent"
  | "getRefBlocksContent"
  | "encoder"
  | "tracker"
>;

export class CaretCanvas {
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

  textById() {
    const res: { [k: string]: string } = {};
    this.nodes.forEach((node) => {
      res[node.id] = node.text;
    });
    return res;
  }

  getNode(nodeId: string) {
    const [res] = this.nodes.filter((node) => node.id === nodeId);
    return new CaretNode(res, this);
  }

  getLongestLineage(node_id: string) {
    return CaretPlugin.getLongestLineage(this.nodes, this.edges, node_id);
  }

  static fromPlugin(plugin: RestrictedPlugin) {
    return new CaretCanvas(plugin.app.workspace.getMostRecentLeaf()!.view, plugin);
  }
}

export class TrackCanvasChanges {
  canvas_nodes: CaretCanvas;
  constructor(canvas_nodes: CaretCanvas) {
    this.canvas_nodes = canvas_nodes;
  }

  handleModify(new_nodes: CaretCanvas) {
    const old = this.canvas_nodes.textById();
    const nw = new_nodes.textById();
    for (const [id, text] of Object.entries(nw)) {
      if (old[id] !== text) {
        const new_node = new_nodes.nodes.find((node) => node.id === id);
        console.log("changed", new_node);
        refreshOutgoing(
          new_node!.id,
          "",
          {
            model: "default",
            provider: "default",
            temperature: 1,
          },
          this.canvas_nodes.plugin
        );
      }
    }
    this.canvas_nodes = new_nodes;
  }
}

export function mergeSettingsAndSparkleConfig(settings: CaretPluginSettings, sparkle_config: SparkleConfig): SparkleConfig {
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

export class CaretNode {
  constructor(readonly node: Node, readonly canvas_nodes: CaretCanvas) {}

  outgoingNodes() {
    return this.canvas_nodes.edges
      .filter((edge) => edge.fromNode === this.node.id)
      .map((edge) => this.canvas_nodes.getNode(edge.toNode));
  }

  async getAssociatedNodeContent() {
    return this.canvas_nodes.plugin.getAssociatedNodeContent(this.node, this.canvas_nodes.nodes, this.canvas_nodes.edges);
  }

  get id() {
    return this.node.id;
  }

  getLongestLineage() {
    return this.canvas_nodes.getLongestLineage(this.node.id); 
  }
}
