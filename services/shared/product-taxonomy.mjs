const clean = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const rules = [
  { category: "mounting", pickerCategory: "mounting", confidence: .98, pattern: /\b(?:tilt mount|roof mount|ground mount|racking|mounting|mount kit|rail(?:s| kit)?|mid[ -]?clamp|end[ -]?clamp|roof clamp|panel clamp|bracket|flashing|tile hook|standing seam clamp|ground screw)\b/i },
  { category: "electrical_protection", pickerCategory: "protection", confidence: .97, pattern: /\b(?:combiner|disconnect|isolator|breaker|class t|mega fuse|anl fuse|fuse holder|surge protection|\bspd\b|ground rod|grounding lug)\b/i },
  { category: "wire", pickerCategory: "wiring", confidence: .97, pattern: /\b(?:pv wire|solar cable|battery cable|\bthhn\b|\bthwn\b|mc4|cable gland|copper lug|ferrule|busbar|terminal cover)\b/i },
  { category: "charge_controller", pickerCategory: "controllers", confidence: .98, pattern: /\b(?:charge controller|\bmppt\b|\bpwm controller\b)\b/i },
  { category: "monitoring", pickerCategory: "monitoring", confidence: .96, pattern: /\b(?:cerbo|gateway|smartshunt|battery shunt|energy monitor|ct clamp|rs485|can bus|communication cable)\b/i },
  { category: "tools", pickerCategory: "tools", confidence: .96, pattern: /\b(?:crimper|multimeter|clamp meter|insulated glove|arc flash|wire stripper|mc4 wrench|eye protection|\bppe\b)\b/i },
  { category: "battery", pickerCategory: "storage", confidence: .94, pattern: /\b(?:lifepo4|lithium iron|powerwall|server rack battery|battery module|battery pack|battery cell|\bbms\b|active balancer)\b/i },
  { category: "power_station", pickerCategory: "inverters", confidence: .95, pattern: /\b(?:power station|solar generator)\b/i },
  { category: "inverter", pickerCategory: "inverters", confidence: .94, pattern: /\b(?:microinverter|hybrid inverter|string inverter|off[ -]?grid inverter|grid[ -]?tie inverter|\binverter\b)\b/i },
  { category: "panel", pickerCategory: "generation", confidence: .9, pattern: /\b(?:pv module|photovoltaic module|solar module|bifacial module|monofacial module|topcon module|hjt module|perc module|flexible solar panel|\d{2,4}\s*w(?:att)?\s+(?:bifacial\s+|monofacial\s+)?(?:solar\s+)?panel)\b/i },
];

export function classifySolarProduct(title, description = "", sourceCategory = "") {
  const titleText = clean(title);
  const full = `${titleText} ${clean(sourceCategory)} ${clean(description)}`;
  for (const rule of rules) {
    if (rule.pattern.test(titleText)) return { ...rule, source: "title_rule" };
  }
  for (const rule of rules) {
    if (rule.pattern.test(full)) return { ...rule, confidence: Math.max(.55, rule.confidence - .14), source: "content_rule" };
  }
  return { category: "other", pickerCategory: "other", confidence: .2, source: "unclassified" };
}

function numberFrom(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1].replaceAll(",", ""));
  }
  return undefined;
}

export function extractSolarSpecifications(title, description = "", existing = {}) {
  const text = clean(`${title} ${description}`);
  const dimensions = text.match(/\b(\d{2,4}(?:\.\d+)?)\s*[x×]\s*(\d{2,4}(?:\.\d+)?)\s*[x×]\s*(\d{1,3}(?:\.\d+)?)\s*mm\b/i);
  const inches = text.match(/\b(\d{2,3}(?:\.\d+)?)\s*[x×]\s*(\d{2,3}(?:\.\d+)?)\s*[x×]\s*(\d{1,3}(?:\.\d+)?)\s*(?:in|inch|inches|")\b/i);
  const cell = text.match(/\b(TOPCon|HJT|PERC|shingled|back contact|CIGS|mono(?:crystalline)?|poly(?:crystalline)?)\b/i)?.[1];
  const moduleType = /\bbifacial\b/i.test(text) ? "Bifacial"
    : /\bflexible|semi-flexible\b/i.test(text) ? "Flexible / semi-flexible"
      : /\bmonofacial\b/i.test(text) ? "Monofacial" : undefined;
  return Object.fromEntries(Object.entries({
    ...existing,
    moduleType: existing.moduleType || moduleType,
    cellTechnology: existing.cellTechnology || cell,
    voc: existing.voc ?? numberFrom(text, [/\b(?:voc|open circuit voltage)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*v\b/i]),
    vmp: existing.vmp ?? numberFrom(text, [/\b(?:vmp|vmpp|maximum power voltage|voltage at (?:max|maximum) power)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*v\b/i]),
    isc: existing.isc ?? numberFrom(text, [/\b(?:isc|short circuit current)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*a\b/i]),
    imp: existing.imp ?? numberFrom(text, [/\b(?:imp|impp|maximum power current|current at (?:max|maximum) power)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*a\b/i]),
    lengthMm: existing.lengthMm ?? (dimensions ? Number(dimensions[1]) : undefined),
    widthMm: existing.widthMm ?? (dimensions ? Number(dimensions[2]) : undefined),
    thicknessMm: existing.thicknessMm ?? (dimensions ? Number(dimensions[3]) : undefined),
    dimensionsIn: existing.dimensionsIn || (inches ? `${inches[1]} × ${inches[2]} × ${inches[3]} in` : undefined),
    efficiencyPercent: existing.efficiencyPercent ?? numberFrom(text, [/\b(?:module )?efficiency\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/i]),
    maxSystemVoltage: existing.maxSystemVoltage ?? numberFrom(text, [/\bmax(?:imum)? system voltage\s*[:=]?\s*(\d+(?:\.\d+)?)\s*v/i]),
  }).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

export function categoryLabel(category) {
  return ({
    generation: "Solar Generation",
    inverters: "Inverters & Power Stations",
    controllers: "Charge Controllers",
    storage: "Energy Storage",
    protection: "Electrical Protection",
    wiring: "Wiring & Terminations",
    mounting: "Mounting & Racking",
    monitoring: "Monitoring & Communications",
    tools: "Tools & PPE",
    other: "Needs review",
  })[category] || category;
}
