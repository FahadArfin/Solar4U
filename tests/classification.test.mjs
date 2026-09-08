import test from "node:test";
import assert from "node:assert/strict";
import { classifyOffer } from "../services/price-worker/classification.mjs";
const classify = (name, variant = "Default Title") =>
  classifyOffer({ name, variant });
const fixtures = [
  [
    "Battery Temperature Sensor for Voyager Charge Controllers",
    "",
    "batteries",
    "accessories",
  ],
  [
    "LiTime 300A Battery Bus Bar",
    "300A Bus Bar - Black",
    "wiring",
    "connectors",
  ],
  ["350A Battery Switch", "", "electrical", "battery-switch"],
  [
    "Battery Equalizer Voltage Balancer for 24V Lead-Acid/AGM/Gel/Flood Battery",
    "",
    "batteries",
    "accessories",
  ],
  ["Golf Cart Battery Lifting Strap", "", "batteries", "accessories"],
  [
    "Dr.Prepare 2-in-1 PowerMax LiFePO4 Battery and Portable DC Power Station",
    "Hub",
    "batteries",
    "accessories",
  ],
  [
    "ALPHA 5 Server Rack Battery",
    "Battery Server Rack",
    "batteries",
    "accessories",
  ],
  [
    "YIXIANG Diy Box Fire Resistant Aerosol Fire Extinguisher Suitable for Energy Storage Lithium Ion Battery Fire Fighting",
    "",
    "batteries",
    "accessories",
  ],
  [
    "YIXIANG DIY Box Lifepo4 Battery Case Accessory Insect Net for Dust and Mosquito Repellent",
    "",
    "batteries",
    "accessories",
  ],
  [
    "Controller for Panels and Batteries in a Solar System",
    "Upgraded 30A PWM Solar Charge Controller",
    "inverters",
    "controller",
  ],
  [
    "Pro 12V Bluetooth Pure Sine Inverter (1000W/2000W/3000W) + 120V 30A Automatic ATS Transfer Switch",
    "1000W",
    "bundles",
    "system",
  ],
  [
    "10AWG Solar Connector to SAE Adapter | Connect Solar Panel Connectors to SAE Plug",
    "Standard Polarity",
    "wiring",
    "connectors",
  ],
  [
    "Solar Panel Extension Cable Pair (2 Cables) - Male to Female Solar Connectors",
    "10FT Each × 2 / 12 AWG",
    "wiring",
    "dc-cable",
  ],
  [
    "6 Gauge Battery Cables | Pair of 6AWG Red and Black Pure Copper Inverter Battery Cables with Lugs",
    "1 Feet Red & Black (Set)",
    "wiring",
    "dc-cable",
  ],
  [
    "Inverter Remote Control with Smart LCD Display — Exclusive for Nova Pure Series",
    "",
    "other",
    "unknown",
  ],
  [
    "ETHOS Stackable Battery",
    "1 x Control Box Only",
    "batteries",
    "accessories",
  ],
  ["ETHOS Stackable Battery", "1 x Parallel Kit", "batteries", "accessories"],
  [
    "ESM100 Battery Monitor for Wall Mount Battery",
    "",
    "batteries",
    "accessories",
  ],
  ["Wall Mount Kit for SG48200T Battery", "", "batteries", "accessories"],
  [
    "US Stock Grey V19 BMS Vertical Box 16s 3.2V Lifepo4 Home Energy Storage Vertical Battery Box",
    "",
    "batteries",
    "enclosure",
  ],
  [
    "SunGoldPower Battery Bracket for CoreX 5 Pro Server Rack Battery",
    "",
    "batteries",
    "accessories",
  ],
  [
    "SunGoldPower 5-Layer Battery Rack for 3U Server Rack Battery",
    "",
    "batteries",
    "accessories",
  ],
  ["51.2V Server Rack Battery", "", "batteries", "server-rack"],
  ["51.2V Battery Rack-Mounted", "", "batteries", "server-rack"],
  [
    "Sinclair SkyRack HD Ground Mount Solar Rack",
    "12 Panels / Fixed Tilt",
    "mounting",
    "ground",
  ],
  [
    "Modular & Expandable Ground Mount Brackets for 2× 400W–590W Solar Panels | Heavy-Duty Adjustable",
    "",
    "mounting",
    "ground",
  ],
  ["Solar Panel Mounting Z Brackets", "2 sets", "mounting", "accessories"],
  [
    "Apollo 5K AC 240V Split Phase Combiner Box",
    "",
    "electrical",
    "ac-combiner",
  ],
  [
    "4X High Power Port Combiner to High Power Port Connector",
    "",
    "wiring",
    "connectors",
  ],
  [
    "12V/24V 150A Adjustable Dual Battery Isolator (VSR)",
    "",
    "electrical",
    "isolator",
  ],
  [
    "RX-LFP48100-H | 19 inch Rack Mounted 3U Module | Self heating | UL1973 9540A",
    "",
    "batteries",
    "server-rack",
  ],
  [
    "6500W 48V Hybrid Inverter 9000W Dual MPPT",
    "5.12kWh Wall Mount Battery + 6.5kW Inverter",
    "bundles",
    "system",
  ],
  [
    "EcoFlow STREAM",
    "STREAM Microinverter + 1x400W Solar Panels",
    "bundles",
    "system",
  ],
  [
    "Vertical DIY Battery Box with BMS - Cells Not Included",
    "",
    "batteries",
    "enclosure",
  ],
  ["Inverter with built-in transfer switch", "", "inverters", "unknown"],
  ["DC Cable for Floor-standing Battery", "", "wiring", "dc-cable"],
  ["Solar cable entry gland", "", "electrical", "glands"],
  ["Hybrid solar inverter", "", "inverters", "hybrid"],
  ["Plug-in microinverter", "", "inverters", "plugin"],
  [
    "NOVA 2K12 Pure Sine Wave Inverter w/ Transfer Switch",
    "",
    "inverters",
    "unknown",
  ],
  [
    "Dual Battery Isolator Auto Connect/Disconnect",
    "",
    "electrical",
    "isolator",
  ],
  [
    "TOP Rack TRT Solar Panel Rail-less Roof Mounting System",
    "",
    "mounting",
    "roof",
  ],
  ["TOP Rack TRT Solar Panel Tile Hook System", "", "mounting", "roof"],
  ["TOP Rack Solar Panel TRT Rail Less System", "", "mounting", "roof"],
  ["440 Watt Solar Panels (with Z-brackets)", "", "bundles", "system"],
  [
    "12V Smart Battery",
    "1 Pack Battery & Add Only $5 for Mounting Brackets",
    "bundles",
    "system",
  ],
  [
    "Anker E10 Hybrid Solar Power System | Choose Complete Bundle",
    "6kWh Battery / Ground Mount",
    "bundles",
    "system",
  ],
  ["MEGA 400W Solar Panel 10-Busbar", "8 Solar Panels", "panels", "unknown"],
  ["MEGA 175W Solar Panel with Extension Cable", "", "panels", "unknown"],
  [
    "CoreX5 Pro Server Rack Battery with Tier-1 EVE Cells",
    "",
    "batteries",
    "server-rack",
  ],
  [
    "DELTA PRO ULTRA-X Extra Battery with EV-Grade LFP Cells",
    "",
    "batteries",
    "unknown",
  ],
  ["Traver Force 400W Solar Panel", "4 pack+ 80A Mppt", "bundles", "system"],
  ["Complete Off-Grid Solar Kit 13,000W output", "", "bundles", "system"],
  ["DC Battery Cable with Lugs & Connectors", "", "wiring", "dc-cable"],
];
for (const [name, variant, group, subtype] of fixtures)
  test(`classifies the purchased item: ${name}`, () => {
    const c = classify(name, variant);
    assert.equal(c.group, group);
    assert.equal(c.subtype, subtype);
  });
test("mounts never inherit generation capacity or purchased panel counts", () => {
  const c = classify(fixtures[1][0], fixtures[1][1]);
  assert.equal(c.specs.watts, null);
  assert.equal(c.specs.packCount, null);
});
test("selected variants override family specifications without decoding model numbers", () => {
  assert.equal(classify("ANL Fuse 20A/30A/40A/100A", "20A").specs.currentA, 20);
  assert.equal(
    classify(
      "Renon Xtreme LV Battery 10.24–30.72kWh",
      "1 Battery Modules | 5.12kWh",
    ).specs.energyKwh,
    5.12,
  );
  assert.equal(classify(fixtures[6][0]).specs.nominalVoltage, null);
  const cable = classify(
    "50MM2 Battery Power Cable Parallel cables or cables connecting inverters",
    "100CM",
  );
  assert.equal(cable.specs.crossSectionMm2, 50);
  assert.equal(cable.specs.lengthM, 1);
});
test("package watt costs require explicit quantity and unambiguous module wattage", () => {
  assert.equal(classify("450W Solar Panel").specs.packCount, null);
  assert.equal(classify("450W Solar Panel Pallet").specs.packCount, null);
  assert.equal(classify("450W Solar Panel - pack of 31").specs.packCount, 31);
  assert.equal(classify("Solar Panel 400W or 450W").specs.watts, null);
});
test("voltage class and physical form are independently represented", () => {
  const rack = classify("51.2V 5.12kWh Server Rack Battery");
  assert.equal(rack.subtype, "server-rack");
  assert.equal(rack.specs.voltageClass, "low");
  const vertical = classify("High Voltage Vertical Battery 102.4V");
  assert.equal(vertical.subtype, "vertical");
  assert.equal(vertical.specs.voltageClass, "high");
});
test("formatted numbers and unresolved ranges cannot create false power comparisons", () => {
  assert.equal(classify("2,500W Off Grid Inverter").specs.powerW, 2500);
  assert.equal(classify("Solar Panel 200-400W").specs.watts, null);
  assert.equal(
    classify("Inverter 10,000W output and 11kW PV").specs.powerW,
    null,
  );
  assert.equal(classify("Solar Panel 200-400W", "300W").specs.watts, 300);
  assert.equal(
    classify("MEGA 400W Solar Panel", "8 Solar Panels").specs.packCount,
    8,
  );
  assert.equal(
    classify("Traver Force 400W Solar Panel", "4 pack+ 80A Mppt").specs.watts,
    null,
  );
});
