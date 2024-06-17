import { Canvas, Node, Edge } from "./types";
import { CanvasFileData, CanvasNodeData, CanvasTextData } from "obsidian/canvas";

// Import all of the views, components, models, etc
import { NewNode } from "./types";
var parseString = require("xml2js").parseString;

export async function parseXml(xmlString: string): Promise<any> {
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

function generateRandomId(length: number): string {
    const hexArray = Array.from({ length }, () => {
        const randomHex = Math.floor(Math.random() * 16).toString(16);
        return randomHex;
    });
    return hexArray.join("");
}
function addEdgeToCanvas(canvas: any, edgeID: string, fromEdge: any, toEdge: any) {
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

export async function get_node_by_id(canvas: Canvas, node_id: string) {
    const nodes_iterator = canvas.nodes.values();
    for (const node of nodes_iterator) {
        if (node.id === node_id) {
            return node;
        }
    }
    return null; // Return null if no node matches the ID
}

export function escapeXml(unsafe: string): string {
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

async function addNodeToCanvas(canvas: Canvas, id: string, { x, y, width, height, type, content }: NewNode) {
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

async function createEdge(node1: any, node2: any, canvas: any, from_side: string = "right", to_side: string = "left") {
    addEdgeToCanvas(
        canvas,
        generateRandomId(16),
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

export async function createChildNode(
    canvas: Canvas,
    parentNode: CanvasNodeData,
    x: number,
    y: number,
    content: string = "",
    from_side: string = "right",
    to_side: string = "left"
) {
    let tempChildNode = await addNodeToCanvas(canvas, generateRandomId(16), {
        x: x,
        y: y,
        width: 400,
        height: 200,
        type: "text",
        content,
    });
    await createEdge(parentNode, tempChildNode, canvas, from_side, to_side);

    const node = canvas.nodes?.get(tempChildNode?.id!);
    if (!node) {
        return;
    }
    return node;
}

export function createDirectionalNode(canvas: any, direction: string) {
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

    createChildNode(canvas, node, x, y, "", from_side, to_side);
}

export function startEditingNode(canvas: Canvas) {
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

export function runGraphChat(canvas: Canvas) {
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

function getAllAncestorNodes(nodes: Node[], edges: Edge[], nodeId: string): Node[] {
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

export function getLongestLineage(nodes: Node[], edges: Edge[], nodeId: string): Node[] {
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

export async function getCurrentNode(canvas: Canvas, node_id: string) {
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
