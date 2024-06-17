
1. onload()
Initializes the plugin, sets up encoders, loads settings, initializes API clients, adds setting tabs, and registers commands and events.
2. getFrontmatter(file)
Processes and retrieves the front matter from a file.
3. highlightLineage()
Highlights the lineage of nodes in a canvas based on selection.
4. unhighlightLineage()
Resets the highlighting of node lineages in a canvas.
5. patchCanvasMenu()
Patches the canvas menu to add custom functionality and UI elements.
6. createDirectionalNode(canvas, direction)
Creates a new node in a specified direction relative to a selected node on the canvas.
7. startEditingNode(canvas)
Initiates editing of a selected node on the canvas.
runGraphChat(canvas)
Executes a graph chat operation on the canvas.
9. navigate(canvas, direction)
Navigates through nodes on the canvas based on a specified direction.
10. parseXml(xmlString)
Parses an XML string into a JavaScript object.
11. parseCustomXML(xmlString, tags)
Parses custom XML content based on specified tags.
12. extractTextFromPDF(file_name)
Extracts text from a PDF file.
13. addNewNodeButton(menuEl)
Adds a new node button to the canvas menu.
14. addExtraActions(menuEl)
Adds extra action buttons to the canvas menu.
15. getAllAncestorNodes(nodes, edges, nodeId)
Retrieves all ancestor nodes for a given node based on edges.
16. getLongestLineage(nodes, edges, nodeId)
Static method to get the longest lineage of nodes starting from a specified node.
17. getDirectAncestorsWithContext(nodes, edges, nodeId)
Retrieves direct ancestors of a node that contain specific context information.
18. getAllAncestorsWithContext(nodes, edges, nodeId)
Retrieves all ancestors of a node that contain context information.
19. getRefBlocksContent(node_text)
Retrieves content from referenced blocks within node text.
20. getCurrentNode(canvas, node_id)
Retrieves the current node from the canvas based on node ID.
21. getCurrentCanvasView()
Retrieves the current canvas view.
22. getAssociatedNodeContent(currentNode, nodes, edges)
Retrieves associated content for a node based on its connections in the graph.
23. sparkle(node_id, system_prompt, sparkle_config)
Executes a sparkle operation on a node with specified configurations.
24. buildConversation(node, nodes, edges, system_prompt)
Builds a conversation context for a node based on its lineage and associated content.
25. mergeSettingsAndSparkleConfig(sparkle_config)
Merges plugin settings with sparkle configuration.
26. refreshNode(refreshed_node_id, system_prompt, sparkle_config)
Refreshes a node's content based on a sparkle operation.
27. update_node_content(node_id, stream, llm_provider)
Updates a node's content based on streaming data from an LLM provider.

Divide them into groups. Start with these groups:

Node or Lineage
Calling LLM
Other


function getInstanceMethods(obj: any): string[] {
    let methods: string[] = [];
    let proto = Object.getPrototypeOf(obj);

    while (proto && proto !== Object.prototype) {
        Object.getOwnPropertyNames(proto).forEach(prop => {
            if (prop !== 'constructor' && typeof obj[prop] === 'function') {
                methods.push(prop);
            }
        });
        proto = Object.getPrototypeOf(proto);
    }

    return methods;
}

const allMethods = [
    'onload',
    'getFrontmatter',
    'highlightLineage',
    'getChatLog',
    'escapeXml',
    'unhighlightLineage',
    'patchCanvasMenu',
    'createDirectionalNode',
    'startEditingNode',
    'runGraphChat',
    'navigate',
    'parseXml',
    'parseCustomXML',
    'extractTextFromPDF',
    'addNewNodeButton',
    'addExtraActions',
    'getAllAncestorNodes',
    'getLongestLineage',
    'getDirectAncestorsWithContext',
    'getAllAncestorsWithContext',
    'getRefBlocksContent',
    'getCurrentNode',
    'getCurrentCanvasView',
    'getAssociatedNodeContent',
    'sparkle',
    'update_node_content',
    'llm_call',
    'llm_call_streaming',
    'add_sparkle_button',
    'get_node_by_id',
    'createChildNode',
    'addNodeToCanvas',
    'createEdge',
    'generateRandomId',
    'addEdgeToCanvas',
    'addChatIconToRibbon',
    'onunload',
    'loadSettings',
    'saveSettings',
    'addRibbonIcon',
    'addStatusBarItem',
    'addCommand',
    'addSettingTab',
    'registerView',
    'registerHoverLinkSource',
    'registerExtensions',
    'registerMarkdownPostProcessor',
    'registerMarkdownCodeBlockProcessor',
    'registerCodeMirror',
    'registerEditorExtension',
    'registerObsidianProtocolHandler',
    'registerEditorSuggest',
    'loadData',
    'saveData',
    'loadCSS',
    'getModifiedTime',
    '_onConfigFileChange',
    'load',
    'onload',
    'unload',
    'onunload',
    'addChild',
    'removeChild',
    'register',
    'registerEvent',
    'registerDomEvent',
    'registerScopeEvent',
    'registerInterval',
];
const baseMethods = [
    'onload',
    'addRibbonIcon',
    'addStatusBarItem',
    'addCommand',
    'addSettingTab',
    'registerView',
    'registerHoverLinkSource',
    'registerExtensions',
    'registerMarkdownPostProcessor',
    'registerMarkdownCodeBlockProcessor',
    'registerCodeMirror',
    'registerEditorExtension',
    'registerObsidianProtocolHandler',
    'registerEditorSuggest',
    'loadData',
    'saveData',
    'loadCSS',
    'getModifiedTime',
    '_onConfigFileChange',
    'load',
    'onload',
    'unload',
    'onunload',
    'addChild',
    'removeChild',
    'register',
    'registerEvent',
    'registerDomEvent',
    'registerScopeEvent',
    'registerInterval',
];
const caretMethods = allMethods.filter(x => !baseMethods.includes(x));
console.log(caretMethods);
console.log(caretMethods.join('\n'));
// ['getFrontmatter', 'highlightLineage', 'getChatLog', 'escapeXml', 'unhighlightLineage', 'patchCanvasMenu', 'createDirectionalNode', 'startEditingNode', 'runGraphChat', 'navigate', 'parseXml', 'parseCustomXML', 'extractTextFromPDF', 'addNewNodeButton', 'addExtraActions', 'getAllAncestorNodes', 'getLongestLineage', 'getDirectAncestorsWithContext', 'getAllAncestorsWithContext', 'getRefBlocksContent', 'getCurrentNode', 'getCurrentCanvasView', 'getAssociatedNodeContent', 'sparkle', 'update_node_content', 'llm_call', 'llm_call_streaming', 'add_sparkle_button', 'get_node_by_id', 'createChildNode', 'addNodeToCanvas', 'createEdge', 'generateRandomId', 'addEdgeToCanvas', 'addChatIconToRibbon', 'loadSettings', 'saveSettings']

// getFrontmatter
// highlightLineage
// getChatLog
// escapeXml
// unhighlightLineage
// patchCanvasMenu
// createDirectionalNode
// startEditingNode
// runGraphChat
// navigate
// parseXml
// parseCustomXML
// extractTextFromPDF
// addNewNodeButton
// addExtraActions
// getAllAncestorNodes
// getLongestLineage
// getDirectAncestorsWithContext
// getAllAncestorsWithContext
// getRefBlocksContent
// getCurrentNode
// getCurrentCanvasView
// getAssociatedNodeContent
// sparkle
// update_node_content
// llm_call
// llm_call_streaming
// add_sparkle_button
// get_node_by_id
// createChildNode
// addNodeToCanvas
// createEdge
// generateRandomId
// addEdgeToCanvas
// addChatIconToRibbon
// loadSettings
// saveSettings
