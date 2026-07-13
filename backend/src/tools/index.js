// Rejestr lokalnych narzedzi (function calling) dla Claude.

const registry = [];

function getToolDefinitions() {
  return registry.map((t) => t.definition);
}

async function executeTool(name, input) {
  const tool = registry.find((t) => t.definition.name === name);
  if (!tool) return `Narzedzie "${name}" nie istnieje.`;
  return tool.execute(input);
}

function registerTool(definition, execute) {
  registry.push({ definition, execute });
}

module.exports = { getToolDefinitions, executeTool, registerTool };

require("./tasksTool");
require("./calendarTool");
require("./gmailTool");
