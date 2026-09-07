export const components = [
  { type: "pv-array", name: "PV array", ports: ["positive", "negative", "ground"] },
  { type: "combiner", name: "Combiner", ports: ["positive", "negative", "ground"] },
  { type: "disconnect", name: "DC disconnect", ports: ["line+", "line-", "load+", "load-", "ground"] },
  { type: "charge-controller", name: "Charge controller", ports: ["pv+", "pv-", "battery+", "battery-", "ground"] },
  { type: "inverter", name: "Inverter", ports: ["dc+", "dc-", "ac-l1", "ac-l2", "neutral", "ground"] },
  { type: "battery", name: "Battery", ports: ["positive", "negative", "communication", "ground"] },
  { type: "breaker", name: "Breaker / fuse", ports: ["line", "load"] },
  { type: "busbar", name: "Busbar", ports: ["terminal"] },
  { type: "main-panel", name: "Main service panel", ports: ["l1", "l2", "neutral", "ground"] },
  { type: "ground", name: "Grounding electrode", ports: ["ground"] },
];

export function validateDiagram(diagram) {
  const issues = [];
  const nodes = diagram.nodes || [];
  const connections = diagram.connections || [];
  for (const node of nodes) {
    if (node.type === "pv-array" && Number(node.seriesVoc || 0) > Number(node.controllerMaxVoc || Infinity)) issues.push({ severity: "error", code: "PV_VOC_EXCEEDED", componentId: node.id, message: "Cold-corrected array voltage exceeds the configured controller limit.", suggestion: "Reduce modules in series or select a higher-voltage controller." });
    if (node.type === "battery" && Number(node.parallelCurrentA || 0) > Number(node.conductorAmpacityA || Infinity)) issues.push({ severity: "error", code: "CONDUCTOR_AMPACITY", componentId: node.id, message: "Configured battery current exceeds conductor ampacity.", suggestion: "Increase conductor ampacity and coordinate overcurrent protection." });
    if (node.type === "battery" && !node.overcurrentProtectionA) issues.push({ severity: "warning", code: "BATTERY_OCPD_MISSING", componentId: node.id, message: "No battery overcurrent protection value is configured.", suggestion: "Add a listed fuse or breaker sized for the conductor and equipment." });
  }
  const connected = new Set(connections.flatMap(c => [c.fromNodeId, c.toNodeId]));
  for (const node of nodes.filter(n => !connected.has(n.id))) issues.push({ severity: "warning", code: "UNCONNECTED_COMPONENT", componentId: node.id, message: `${node.label || node.type} is not connected.` });
  return { valid: !issues.some(i => i.severity === "error"), issues, checksRun: 4, disclaimer: "Planning assistance only; not engineering approval or a code-compliance determination." };
}
