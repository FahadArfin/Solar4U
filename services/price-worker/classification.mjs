export const shoppingGroups = [
  {
    id: "panels",
    name: "Solar panels",
    category: "Solar panel",
    description: "Rigid, bifacial, flexible and portable modules.",
    subtypes: [
      ["rigid", "Rigid panels"],
      ["bifacial", "Bifacial panels"],
      ["flexible", "Flexible panels"],
      ["portable", "Portable panels"],
      ["unknown", "Other / unspecified"],
    ],
  },
  {
    id: "mounting",
    name: "Solar mounting",
    category: "Mounting",
    description:
      "Ground mounts, roof mounts, rails and the hardware that holds it together.",
    subtypes: [
      ["ground", "Ground mounts"],
      ["roof", "Roof mounts"],
      ["rails", "Rails"],
      ["accessories", "Clamps & accessories"],
      ["unknown", "Other / unspecified"],
    ],
  },
  {
    id: "electrical",
    name: "Electrical boxes & switches",
    category: "Protection",
    description: "Glands, combiners, PV disconnects and transfer switches.",
    subtypes: [
      ["glands", "Solar & cable glands"],
      ["combiner", "Combiner boxes"],
      ["ac-combiner", "AC combiner boxes"],
      ["disconnect", "PV disconnects"],
      ["transfer", "Transfer switches"],
      ["isolator", "Battery isolators"],
      ["enclosure", "Boxes & enclosures"],
      ["unknown", "Other / unspecified"],
    ],
  },
  {
    id: "wiring",
    name: "Wiring & fuses",
    category: "Wiring",
    description: "DC and AC cable, terminals, fuses, breakers and connectors.",
    subtypes: [
      ["dc-cable", "DC cables"],
      ["ac-cable", "AC cables"],
      ["cable", "Unspecified cables"],
      ["terminals", "Terminals & lugs"],
      ["fuses", "Fuses & holders"],
      ["breakers", "Circuit breakers"],
      ["connectors", "Connectors & busbars"],
      ["unknown", "Other / unspecified"],
    ],
  },
  {
    id: "inverters",
    name: "Inverters & controllers",
    category: "Inverter",
    description:
      "Hybrid, off-grid and grid-tied conversion, plus standalone controllers.",
    subtypes: [
      ["hybrid", "Hybrid inverters"],
      ["offgrid", "Off-grid inverters"],
      ["plugin", "Plug-in inverters"],
      ["gridtie", "Grid-tie / microinverters"],
      ["controller", "Charge controllers"],
      ["unknown", "Other / unspecified"],
    ],
  },
  {
    id: "batteries",
    name: "Battery storage",
    category: "Battery",
    description:
      "Compare voltage classes, rack batteries, vertical and wall-mounted formats.",
    subtypes: [
      ["server-rack", "Server-rack batteries"],
      ["vertical", "Vertical / floor-standing"],
      ["wall", "Wall-mounted"],
      ["stackable", "Stackable batteries"],
      ["portable", "Portable / drop-in"],
      ["accessories", "Battery accessories"],
      ["enclosure", "Empty enclosures / DIY boxes"],
      ["cells", "Individual cells"],
      ["unknown", "Other / unspecified"],
    ],
  },
  {
    id: "bundles",
    name: "Complete kits & power stations",
    category: "Other",
    description:
      "Combined systems and portable power stations; compare their included components.",
    subtypes: [
      ["system", "Multi-component kits"],
      ["power-station", "Portable power stations"],
      ["unknown", "Other / unspecified"],
    ],
  },
  {
    id: "other",
    name: "Other equipment",
    category: "Other",
    description:
      "Unclassified observations and equipment outside the main component groups.",
    subtypes: [["unknown", "Unspecified"]],
  },
];
const unique = (values) => {
  const u = [...new Set(values)];
  return u.length === 1 ? u[0] : null;
};
function numeric(text, pattern, multiplier = 1) {
  return unique(
    [...text.matchAll(pattern)]
      .map((m) => Number(m[1]) * multiplier)
      .filter((n) => Number.isFinite(n) && n > 0),
  );
}
function normalizeNumbers(text) {
  return text
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/(?<![\d.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\d.,])/g, (n) =>
      n.replaceAll(",", ""),
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*(?:-|to|\/)\s*(\d+(?:\.\d+)?)\s*(kwh|kw|watts?|w|volts?|v|ah|amps?|a)\b/g,
      "$1$3 $2$3",
    );
}
export function classifyOffer(offer) {
  const name = String(offer.name ?? ""),
    variant = String(offer.variant ?? ""),
    t = normalizeNumbers(name + " " + variant);
  let group = "other",
    subtype = "unknown";
  const inverter = /\b(?:micro.?inverter|inverter)\b/.test(t),
    battery =
      /\bbatter(?:y|ies)\b|lifepo4|lithium|\d\s*kwh\b|\blfp\d|\brx-lfp\d/.test(
        t,
      ),
    panel = /\bsolar panels?\b|\bphotovoltaic\b|\bbifacial\b/.test(t);
  const controller = /\b(?:mppt|charge controller)\b/.test(t);
  const complete =
    /\bcomplete\b.{0,35}\bsolar (?:kit|system)\b|\bsolar power system\b/.test(
      t,
    ) ||
    ((panel || battery || inverter) &&
      /(?:with|\+|& add).{0,35}\b(?:z.brackets?|mounting brackets?|ground mount)\b/.test(
        t,
      )) ||
    (/\b(?:mounting|brackets?)\b/.test(name.toLowerCase()) &&
      /\bwith\b.{0,40}\bsolar panels?\b/.test(variant.toLowerCase())) ||
    (((/\b(?:kit|bundle|system)\b|\+/.test(t) &&
      [inverter, battery, panel].filter(Boolean).length >= 2) ||
      (panel && controller && /\+\s*\d*\s*a?\s*(?:mppt|controller)/.test(t))) &&
      !/\bcable kit\b|\bmounting kit\b/.test(t));
  const principalPanel =
    panel &&
    !/\b(?:mount|mounting|brackets?|rack|rails?|tile.hook|cable for|cables for|connector for|connectors for)\b/.test(
      t,
    ) &&
    /solar panels?\b/.test(name.toLowerCase());
  if (complete) {
    group = "bundles";
    subtype = "system";
  } else if (
    /\bpower station\b|\bsolar generator\b/.test(t) &&
    !/\b(?:cables?|adapters?|covers?|bags?|wheels?|chargers?|connectors?)\b/.test(
      name.toLowerCase(),
    )
  ) {
    group = "bundles";
    subtype = "power-station";
  } else if (inverter && /\binverter\b.{0,40}\b(?:with|w\/|built.in)/.test(t)) {
    group = "inverters";
    subtype = /hybrid/.test(t)
      ? "hybrid"
      : /off[ -]?grid/.test(t)
        ? "offgrid"
        : /grid[ -]?tie|micro.?inverter/.test(t)
          ? "gridtie"
          : "unknown";
  } else if (
    battery &&
    /\b(?:diy|empty|cells not included|no cells)\b/.test(t) &&
    /\b(?:box|case|cabinet|enclosure)\b/.test(t)
  ) {
    group = "batteries";
    subtype = "enclosure";
  } else if (
    /\b(?:glands?|combiner box|pv combiner|transfer switch|pv disconnect|solar disconnect|disconnect switch|electrical box|junction box|enclosure|battery isolator)\b/.test(
      t,
    )
  ) {
    group = "electrical";
    subtype = /gland/.test(t)
      ? "glands"
      : /combiner/.test(t)
        ? /\bac\b/.test(t)
          ? "ac-combiner"
          : "combiner"
        : /battery isolator/.test(t)
          ? "isolator"
          : /transfer switch/.test(t)
            ? "transfer"
            : /(?:pv|solar) disconnect|disconnect switch/.test(t)
              ? "disconnect"
              : /battery isolator/.test(t)
                ? "isolator"
                : "enclosure";
  } else if (
    /\b(?:cables?|wires?|fuses?|terminals?|lugs?|connectors?|mc4|busbars?|breaker)\b/.test(
      t,
    ) &&
    !principalPanel
  ) {
    group = "wiring";
    subtype = /\b(?:dc|pv|battery|solar) (?:power )?cables?\b/.test(t)
      ? "dc-cable"
      : /\bac cables?\b/.test(t)
        ? "ac-cable"
        : /\bfuse/.test(t)
          ? "fuses"
          : /\bbreaker/.test(t)
            ? "breakers"
            : /\bterminal|\blug/.test(t)
              ? "terminals"
              : /\bconnector|\bmc4|\bbusbar/.test(t)
                ? "connectors"
                : /\bac\b|alternating current|\bextension cord/.test(t)
                  ? "ac-cable"
                  : /\bdc\b|\bpv\b|battery cable|solar cable/.test(t)
                    ? "dc-cable"
                    : "cable";
  } else if (
    /\b(?:ground mount|roof mount|mounting|racking|solar rack|top rack|tile.hooks?|rail.less|rail.base|z.brackets?|end clamps?|mid clamps?|solar rails?|mounting rails?|tilt mounts?)\b/.test(
      t,
    ) &&
    !(/\b(?:rack.mount|wall.mount)\b/.test(t) && battery)
  ) {
    group = "mounting";
    subtype = /ground|pole.mount/.test(t)
      ? "ground"
      : /roof|rail.less|tile.hook|rail.base.*system/.test(t)
        ? "roof"
        : /rail/.test(t)
          ? "rails"
          : "accessories";
  } else if (
    /\bbattery charger\b|\bcharger for\b|\bempty battery rack\b|\bbattery rack cabinet\b/.test(
      t,
    )
  ) {
    group = "batteries";
    subtype = "accessories";
  } else if (inverter) {
    group = "inverters";
    subtype = /\bhybrid\b/.test(t)
      ? "hybrid"
      : /plug[ -]?in/.test(t)
        ? "plugin"
        : /off[ -]?grid/.test(t)
          ? "offgrid"
          : /grid[ -]?(?:tie|tied)|micro.?inverter/.test(t)
            ? "gridtie"
            : "unknown";
  } else if (
    /\bcharge controller\b|\bsolar controller\b|\bmppt controller\b/.test(t)
  ) {
    group = "inverters";
    subtype = "controller";
  } else if (battery) {
    group = "batteries";
    subtype =
      /\b(?:cells?|prismatic)\b/.test(t) && !/\bbatter(?:y|ies)\b/.test(t)
        ? "cells"
        : /server.?rack|rack.?mount|\b19[ -]?inch/.test(t)
          ? "server-rack"
          : /\bvertical\b|floor.?standing|\bupright\b/.test(t)
            ? "vertical"
            : /wall.?mount/.test(t)
              ? "wall"
              : /stackable|stacking/.test(t)
                ? "stackable"
                : /drop.?in|\brv\b|\bmarine\b/.test(t)
                  ? "portable"
                  : "unknown";
  } else if (panel || /\bsolar module\b|\bsolar blanket\b/.test(t)) {
    group = "panels";
    subtype = /bifacial/.test(t)
      ? "bifacial"
      : /flexible/.test(t)
        ? "flexible"
        : /portable|foldable|folding/.test(t)
          ? "portable"
          : /rigid|monocrystalline|polycrystalline/.test(t)
            ? "rigid"
            : "unknown";
  }
  const condition = /\b(?:refurbished|refurb)\b/.test(t)
    ? "refurbished"
    : /\b(?:used|pre.?owned|second.?hand)\b/.test(t)
      ? "used"
      : /\bnew\b/.test(t)
        ? "new"
        : "unknown";
  const variantText = normalizeNumbers(variant);
  const powerPattern = /(?<![\d.,])(\d+(?:\.\d+)?)\s*(kw|watts?|w)\b/g;
  const powerText = [...variantText.matchAll(powerPattern)].length
    ? variantText
    : t;
  const power = unique(
    [...powerText.matchAll(powerPattern)]
      .map((m) => Number(m[1]) * (m[2] === "kw" ? 1000 : 1))
      .filter((n) => n > 0 && n <= 1000000),
  );
  const selectedNumber = (pattern) =>
    numeric(
      [...variantText.matchAll(pattern)].length ? variantText : t,
      pattern,
    );
  const nominalVoltage = selectedNumber(/(\d+(?:\.\d+)?)\s*v(?:olts?)?\b/g);
  const energyKwh = selectedNumber(/(\d+(?:\.\d+)?)\s*kwh\b/g);
  const capacityAh = selectedNumber(/(\d+(?:\.\d+)?)\s*ah\b/g);
  const currentA =
    group === "wiring"
      ? selectedNumber(/(\d+(?:\.\d+)?)\s*a(?:mps?)?\b/g)
      : null;
  const crossSectionMm2 =
    group === "wiring" ? selectedNumber(/(\d+(?:\.\d+)?)\s*mm[²2]/g) : null;
  const lengthText = /\d\s*(?:cm|mm|m|ft|feet)\b/.test(variantText)
    ? variantText
    : t;
  const lengthM =
    group === "wiring"
      ? unique(
          [
            ...lengthText.matchAll(/(\d+(?:\.\d+)?)\s*(cm|mm|m|ft|feet)\b/g),
          ].map(
            (m) =>
              Number(m[1]) *
              { cm: 0.01, mm: 0.001, m: 1, ft: 0.3048, feet: 0.3048 }[m[2]],
          ),
        )
      : null;
  const voltageClass =
    group !== "batteries" ||
    ["accessories", "enclosure", "cells"].includes(subtype)
      ? "unknown"
      : /\bhigh[ -]voltage\b|\bhv\b/.test(t)
        ? "high"
        : /\blow[ -]voltage\b|\blv\b/.test(t)
          ? "low"
          : nominalVoltage !== null
            ? nominalVoltage <= 60
              ? "low"
              : "high"
            : "unknown";
  const selectedPanelCount = numeric(
    variantText,
    /\b(\d+)\s+(?:solar )?panels?\b/g,
  );
  const explicitPack =
    selectedPanelCount ??
    unique(
      [
        ...t.matchAll(
          /(?:pack of|pallet of|set of)\s*(\d+)\b|\b(\d+)\s*(?:[- ]pack|pieces?|pcs|panels? per pallet)\b/g,
        ),
      ].map((m) => Number(m[1] ?? m[2])),
    );
  const packAmbiguous =
    /\bpallet\b|\bpack\b|\bset of\b|\bbundle\b|\b\d+\s*[x×]/.test(t) &&
    explicitPack === null;
  const watts =
    group === "panels" && power !== null && power <= 1000 ? power : null;
  const packCount =
    group === "panels" ? (packAmbiguous ? null : explicitPack) : null;
  const specs = {
    watts,
    powerW: group === "inverters" ? power : null,
    nominalVoltage:
      group === "batteries" || group === "inverters" ? nominalVoltage : null,
    energyKwh: group === "batteries" ? energyKwh : null,
    capacityAh: group === "batteries" ? capacityAh : null,
    packCount,
    voltageClass,
    condition,
    currentA,
    crossSectionMm2,
    lengthM,
  };
  return {
    group,
    subtype,
    specs,
    basis:
      "Title-derived clues; confirm the exact variant and manufacturer datasheet.",
    packageNote:
      group === "panels"
        ? packCount === null
          ? "Package quantity unclear; price is for the listed variant."
          : packCount === 1
            ? "One module stated in the listing; confirm package contents."
            : `${packCount} modules stated in the title; confirm package contents.`
        : "Price is for the listed variant; package, length and accessories may differ.",
  };
}
