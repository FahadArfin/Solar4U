"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { professionalGuides, type ProfessionalGuide } from "./professional-guide-data";

type LessonSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  formula?: string;
  warning?: string;
  table?: string[][];
};

type Lesson = {
  id: string;
  group: string;
  number: string;
  title: string;
  lead: string;
  minutes: number;
  sections: LessonSection[];
};

type LessonEnhancement = {
  expanded: string[];
  specs: { label: string; value: string; detail: string }[];
  example: { title: string; scenario: string; values: string[]; result: string };
  diagram: {
    title: string;
    caption: string;
    variant: "flow" | "parallel" | "bars" | "stack" | "cycle";
    nodes: string[];
  };
  sources: { organization: string; label: string; href: string }[];
};

const lessons: Lesson[] = [
  {
    id: "solar-flow", group: "Start here", number: "01", title: "Solar power flow and system types", minutes: 14,
    lead: "Understand what each stage does before choosing hardware: capture, regulate, store, convert, distribute, and protect.",
    sections: [
      { heading: "The energy path", paragraphs: ["Panels produce variable DC power. A charge controller conditions that power for a battery, the battery supplies a stable DC bus, and an inverter converts DC into AC for ordinary loads. Grid-tied and battery-based systems alter this path, but they never remove the need for compatible voltage, current, protection, and controls."], bullets: ["Sunlight -> PV array -> PV disconnect/protection -> charge controller or inverter", "Battery systems add storage, battery protection, disconnects, and usually an inverter/charger", "AC loads receive power only after conversion; DC loads may connect through a properly protected DC distribution panel"] },
      { heading: "Off-grid, grid-tied, and hybrid", bullets: ["Off-grid: batteries and often a generator carry the system when solar is insufficient.", "Grid-tied: a listed interactive inverter synchronizes with the utility; ordinary systems shut down during an outage.", "Hybrid: solar, battery, grid, and sometimes generator power share a controlled architecture with transfer and isolation functions.", "Portable systems: the same electrical rules apply even when the equipment is packaged into a power station."] },
      { heading: "Start with a use case", paragraphs: ["Define whether you are supporting emergency loads, a vehicle, a cabin, a workshop, or a whole residence. The design objective determines autonomy, surge capability, service voltage, mounting, permitting, and budget."], warning: "Do not connect panels directly to a battery or ordinary appliance. Variable PV voltage requires equipment designed for that source." },
    ],
  },
  {
    id: "electrical-language", group: "Start here", number: "02", title: "Electrical language and core formulas", minutes: 16,
    lead: "Read labels and datasheets confidently by separating instantaneous power from stored or consumed energy.",
    sections: [
      { heading: "Voltage, current, power, and energy", bullets: ["Voltage (V) is electrical potential.", "Current (A) is the rate of charge flow.", "Power (W) is the instantaneous rate of doing electrical work.", "Energy (Wh or kWh) is power accumulated over time.", "Resistance (ohms) turns part of that power into heat."], formula: "Power (W) = Voltage (V) x Current (A)" },
      { heading: "Battery units", paragraphs: ["Amp-hours describe charge capacity at a stated voltage. Watt-hours make unlike battery voltages easier to compare. Usable energy is lower than nameplate energy after reserve, depth-of-discharge limits, conversion loss, temperature, and aging."], formula: "Nominal energy (Wh) = battery voltage x amp-hours" },
      { heading: "AC and DC are not interchangeable", bullets: ["PV modules and batteries are DC sources.", "Most household branch circuits and appliances use AC.", "Breakers, switches, connectors, and fuses must carry an appropriate DC or AC rating for the circuit.", "Open-circuit voltage and short-circuit current are test conditions, not the normal operating point."] },
    ],
  },
  {
    id: "component-map", group: "Equipment", number: "03", title: "Core components and compatibility", minutes: 22,
    lead: "Build a compatibility chain so every device accepts the voltage, current, power, environment, and battery chemistry presented to it.",
    sections: [
      { heading: "PV modules", bullets: ["Voc: open-circuit voltage; use it for maximum-voltage checks after cold correction.", "Vmp: voltage near maximum power; use it to check the MPPT operating window.", "Isc: short-circuit current; use it when evaluating conductors and protection.", "Imp: current near maximum power; useful for normal operating estimates.", "Rigid monocrystalline modules are common for permanent arrays; flexible and folding modules trade durability or efficiency for portability."] },
      { heading: "Controllers, batteries, and inverters", bullets: ["MPPT controllers convert higher PV voltage into battery charging current and offer a wider array-design window than PWM controllers.", "The battery BMS protects lithium cells, but it does not replace circuit protection, a disconnect, or a shunt-based energy monitor.", "Pure-sine inverters are the normal choice for motors and electronics.", "Continuous output, surge output, DC input range, charger behavior, neutral-ground configuration, and listed use must all match the project."] },
      { heading: "Balance of system", bullets: ["PV wire and weather-rated connectors", "Combiner boxes where parallel strings require combining or individual protection", "Busbars, lugs, shunts, disconnects, fuses, and breakers", "Equipment grounding and bonding hardware", "Conduit, cable support, labels, strain relief, and enclosures"], warning: "A collection of individually good products is not automatically a compatible system. Verify the complete chain before purchasing." },
    ],
  },
  {
    id: "load-audit", group: "System sizing", number: "04", title: "Build a load audit", minutes: 18,
    lead: "Measure daily energy, simultaneous power, and startup surge instead of sizing from a monthly bill alone.",
    sections: [
      { heading: "Create the appliance schedule", bullets: ["Record watts, quantity, hours per day, days per week, and seasonal behavior.", "Measure cycling loads such as refrigerators with an energy meter over at least a full day.", "Separate critical loads from optional loads.", "Identify 120 V and 240 V loads and anything with a motor, compressor, heating element, or pump."] },
      { heading: "Three totals matter", table: [["Value", "What it sizes"], ["Daily Wh", "PV energy and battery autonomy"], ["Simultaneous W", "Inverter continuous rating"], ["Starting surge", "Inverter surge and battery discharge capability"]], formula: "Daily energy = sum of (load watts x operating hours per day)" },
      { heading: "Add reality", paragraphs: ["Account for inverter standby draw, conversion losses, winter production, snow, shading, future loads, and days when behavior differs from the average. A system that only works on the average day is not a resilient system."] },
    ],
  },
  {
    id: "array-sizing", group: "System sizing", number: "05", title: "Size the PV array", minutes: 20,
    lead: "Turn the load audit into a seasonal production target, then verify the result with location-aware climate data.",
    sections: [
      { heading: "First-pass calculation", formula: "Required array watts = daily Wh / peak-sun-hours / system efficiency", bullets: ["Use monthly solar resource, not only an annual average.", "Include wiring, conversion, temperature, soiling, mismatch, and availability losses.", "Decide whether the array must cover average use, winter use, or battery recovery after an outage.", "Use the PV production calculator for location, orientation, tilt, multiple roof faces, and monthly results."] },
      { heading: "Recovery matters", paragraphs: ["A battery sized for several days of autonomy may also require a larger array or generator to recover promptly. Model the highest daily load plus the energy needed to recharge after a low-state-of-charge event."], warning: "Nameplate watts are a laboratory rating. Real output changes with irradiance, cell temperature, angle, shade, snow, wiring, clipping, and equipment behavior." },
      { heading: "Before purchasing modules", bullets: ["Confirm physical dimensions, weight, clamp zones, connector type, warranty, and fire classification.", "Check Voc, Vmp, Isc, Imp, temperature coefficients, and maximum system voltage.", "Plan spare modules carefully: future replacements may not electrically match the original array."] },
    ],
  },
  {
    id: "battery-sizing", group: "System sizing", number: "06", title: "Size storage and autonomy", minutes: 20,
    lead: "Translate critical-load energy into nominal battery capacity after reserve, usable depth of discharge, and conversion efficiency.",
    sections: [
      { heading: "Nominal capacity", formula: "Battery kWh = daily critical-load kWh x autonomy days / usable fraction / efficiency", bullets: ["Autonomy means time without useful solar or grid input.", "Reserve is energy intentionally left unused for battery health or emergency margin.", "Cold temperature can reduce available energy and may prohibit lithium charging.", "Inverter idle draw and DC auxiliary loads continue overnight."] },
      { heading: "Discharge capability", paragraphs: ["Energy capacity alone is not enough. Confirm that the battery and BMS can continuously and briefly supply the inverter's DC current. Parallel batteries must share current through a deliberate busbar and cable layout."], formula: "Approximate DC current = AC watts / battery voltage / inverter efficiency" },
      { heading: "Design questions", bullets: ["What loads must survive an outage?", "How many hours or days must they run?", "Will a generator recharge the battery?", "What state of charge should remain in reserve?", "Can the battery be heated or installed inside its approved temperature range?"] },
    ],
  },
  {
    id: "inverter-controller-sizing", group: "System sizing", number: "07", title: "Size the inverter and charge controller", minutes: 22,
    lead: "Check continuous power, surge, MPPT operating range, cold-array voltage, output current, and battery compatibility together.",
    sections: [
      { heading: "Inverter selection", bullets: ["Add loads that may operate simultaneously.", "Capture motor and compressor starting surge.", "Match the battery nominal voltage and allowable DC range.", "Confirm split-phase or 240 V requirements.", "Account for charger input, transfer switch behavior, neutral-ground bonding, standby consumption, and environmental rating."] },
      { heading: "Controller selection", formula: "Minimum controller output current ~= array watts / battery voltage x design margin", bullets: ["Cold-corrected string Voc must remain below the absolute PV input limit.", "Warm operating Vmp must remain inside the MPPT tracking window.", "Parallel string current must stay within input and terminal limits.", "Confirm supported battery voltage, charging profile, temperature sensing, and maximum PV power."] },
      { heading: "Margins are not guesses", paragraphs: ["Use the manufacturer's published limits and its required calculation method. The controller calculator is a planning shortlist, not approval to operate at a product's absolute boundary."] },
    ],
  },
  {
    id: "series-parallel", group: "Array design", number: "08", title: "Series, parallel, and series-parallel arrays", minutes: 24,
    lead: "Series connections add voltage; parallel connections add current. That one rule drives controller fit, wire size, shade response, and protection.",
    sections: [
      { heading: "Series strings", bullets: ["String Voc = module Voc x modules in series.", "String Vmp = module Vmp x modules in series.", "String current remains approximately one module's current.", "Higher voltage can reduce current and conductor loss for the same power.", "A shaded or weak module can constrain the string."] },
      { heading: "Parallel strings", bullets: ["Array current = string current x parallel strings.", "Voltage remains the voltage of one string.", "Conductors, combiners, connectors, and controllers must accept the combined current.", "Reverse-current and string-fusing requirements depend on module ratings and the number of strings."] },
      { heading: "Hybrid layouts", paragraphs: ["A 2S2P array has two modules per string and two strings in parallel. Each parallel string should have equivalent module count and compatible electrical characteristics. Different roof planes may perform better on separate MPPT inputs."], warning: "Calculate cold Voc for every string and verify the controller limit before energizing the array." },
    ],
  },
  {
    id: "shade-mismatch", group: "Array design", number: "09", title: "Shade, mismatch, and module datasheets", minutes: 19,
    lead: "Treat shade and electrical mismatch as circuit-design problems, not only production losses.",
    sections: [
      { heading: "Read the module label", bullets: ["Use Voc and its temperature coefficient for maximum string voltage.", "Use Vmp to confirm the controller can track the string in hot conditions.", "Use Isc and the required code/design multiplier for source-circuit conductors and protection.", "Review maximum series-fuse rating, connector family, bifacial rating method, and maximum system voltage."] },
      { heading: "Mismatch behavior", paragraphs: ["Series-connected modules share current, while parallel strings share voltage. Mixing modules with unlike current in series or unlike voltage in parallel can pull the array away from each module's best operating point."], bullets: ["Group similarly oriented and similarly shaded modules.", "Avoid mixing electrical characteristics unless the effect has been modeled.", "Use separate MPPT inputs for materially different roof faces where equipment permits.", "Do not mate look-alike connectors from different manufacturers unless expressly listed as compatible."] },
      { heading: "Bypass devices", paragraphs: ["Module bypass diodes can reduce hot-spot risk and preserve some output during partial shade, but they do not make arbitrary mixed arrays safe or efficient."] },
    ],
  },
  {
    id: "diagrams-expansion", group: "Array design", number: "10", title: "Draw the one-line and plan expansion", minutes: 18,
    lead: "A diagram is the working specification for installation, review, labeling, troubleshooting, and future changes.",
    sections: [
      { heading: "Show every energy path", bullets: ["Module and string configuration", "Combiner, disconnect, controller, battery, inverter, distribution, grid, and generator connections", "Conductor material, gauge, insulation, route, and length", "Fuse or breaker rating and interrupting rating", "Equipment and conductor grounding", "Communication and monitoring links"] },
      { heading: "Leave deliberate capacity", bullets: ["Controller and inverter power cannot be expanded beyond published limits.", "Provide physical service clearance and ventilation.", "Reserve appropriate breaker positions and conduit capacity.", "Plan busbar, rack, and battery communication expansion.", "Document unused provisions so they are not mistaken for abandoned wiring."] },
      { heading: "Revision discipline", paragraphs: ["Date the drawing, record product model numbers and firmware, and update the diagram after any field change. A stale diagram is dangerous during troubleshooting."] },
    ],
  },
  {
    id: "battery-chemistry", group: "Batteries", number: "11", title: "Battery chemistry and BMS fundamentals", minutes: 24,
    lead: "Compare usable energy, cycle life, charging limits, temperature behavior, maintenance, ventilation, and failure response.",
    sections: [
      { heading: "LiFePO4", bullets: ["High usable fraction and cycle life when operated within limits.", "A BMS monitors cells and can stop charge or discharge during unsafe conditions.", "Charging below the battery's allowed temperature can cause damage.", "BMS current, contactor capability, communications, enclosure rating, and serviceability matter as much as capacity."] },
      { heading: "AGM and flooded lead-acid", bullets: ["Lead-acid usually provides less usable energy for a given nameplate capacity.", "Repeated partial charging and deep discharge shorten life.", "Flooded batteries require electrolyte maintenance and ventilation.", "Chemistries, ages, capacities, and conditions should not be casually mixed in one bank."] },
      { heading: "BMS versus system protection", paragraphs: ["A BMS protects cells and the battery assembly. It does not replace a properly sized fuse close to the energy source, a service disconnect, conductor protection, or an accurate shunt monitor."], warning: "Follow the battery manufacturer's charging, temperature, torque, spacing, communication, and parallel-unit instructions." },
    ],
  },
  {
    id: "bank-architecture", group: "Batteries", number: "12", title: "12 V, 24 V, and 48 V bank architecture", minutes: 20,
    lead: "Higher DC voltage reduces current for the same power, but raises equipment, training, and fault-energy requirements.",
    sections: [
      { heading: "Choose system voltage from power and architecture", table: [["Voltage", "Typical design context"], ["12 V", "Small vehicle, marine, or portable loads"], ["24 V", "Mid-sized cabin, workshop, or mobile system"], ["48 V", "Larger inverter systems and longer high-power DC paths"]], formula: "Current = power / voltage" },
      { heading: "Series and parallel batteries", bullets: ["Series adds voltage while amp-hour capacity remains the same.", "Parallel adds amp-hour and current capability while voltage remains the same.", "Only use configurations approved by the battery manufacturer.", "Use balanced busbar connections and appropriately matched cable resistance.", "Do not mix old and new batteries or incompatible BMS-controlled models."] },
      { heading: "High-voltage batteries", paragraphs: ["Some residential systems use battery voltages far above 48 V. These are not simply larger low-voltage DIY banks; they require purpose-built batteries, inverters, disconnects, connectors, procedures, and qualified design practices."] },
    ],
  },
  {
    id: "battery-monitoring", group: "Batteries", number: "13", title: "Charging, monitoring, and cold weather", minutes: 18,
    lead: "Use a shunt and recorded trends to understand energy flow instead of relying only on instantaneous battery voltage.",
    sections: [
      { heading: "What to monitor", bullets: ["State of charge and cumulative amp-hours", "Charge and discharge current", "Battery voltage under load and at rest", "Cell or pack temperature", "BMS alarms and high/low events", "Daily minimum state of charge and recovery time"] },
      { heading: "Charging profile", paragraphs: ["Controller and inverter/charger setpoints must match the battery manufacturer's profile. Lithium and lead-acid batteries use different charging behavior; equalization intended for some lead-acid systems can damage lithium batteries."], bullets: ["Confirm absorption, float, low-voltage cutoff, restart, and temperature compensation settings.", "Coordinate every charging source: solar, alternator, grid, and generator.", "Verify the maximum combined charge current."] },
      { heading: "Cold climates", warning: "Do not charge a lithium battery below its permitted temperature. Use an approved heated battery, conditioned enclosure, or charging lockout rather than improvising." },
    ],
  },
  {
    id: "tools-meter", group: "Safety", number: "14", title: "Tools, PPE, and multimeter practice", minutes: 20,
    lead: "Prepare the right test equipment, crimp tooling, torque tools, and personal protection before conductors are cut.",
    sections: [
      { heading: "Core kit", bullets: ["Wire cutters and strippers matched to conductor size", "Manufacturer-approved crimpers and dies", "Torque screwdriver/wrench and sockets", "Voltage-rated multimeter and, where useful, DC clamp meter", "Heat shrink, labels, cable support, and strain relief", "Eye protection, insulated tools or gloves where required, and an appropriate fire extinguisher"] },
      { heading: "Meter workflow", bullets: ["Inspect leads and meter category/rating.", "Select AC or DC and a range above the expected value.", "Prove the meter on a known source before and after the measurement.", "Check polarity and voltage before making a connection.", "Use continuity only on de-energized circuits.", "Do not measure current by placing ordinary meter leads directly across a source."] },
      { heading: "Torque is a specification", paragraphs: ["Loose connections create heat; over-tightening damages terminals. Record the manufacturer's torque value and use calibrated tools where the consequence warrants it. Perform a controlled pull test on crimped conductors."] },
    ],
  },
  {
    id: "protection-grounding", group: "Safety", number: "15", title: "Conductors, overcurrent protection, grounding, and disconnects", minutes: 28,
    lead: "Protect the conductor, interrupt faults safely, and provide an intentional path for equipment faults and maintenance isolation.",
    sections: [
      { heading: "Conductor selection", bullets: ["Ampacity after temperature, bundling, conduit, and terminal limitations", "Voltage drop over the complete circuit path", "Copper or aluminum termination compatibility", "Wet, sunlight, temperature, flexibility, and abrasion ratings", "Conduit fill, bending radius, support, and physical protection"] },
      { heading: "Fuses and breakers", paragraphs: ["Overcurrent protection is selected from circuit current, conductor ampacity, equipment instructions, and the governing code. It must also carry an adequate DC voltage and interrupting rating for the available fault current."], bullets: ["Place battery protection close to the source as permitted by the equipment and code.", "Use disconnecting means that are actually rated to break the DC circuit.", "Do not substitute an AC-only breaker on a DC circuit.", "Identify circuits that remain energized when a disconnect is open."] },
      { heading: "Grounding and bonding", paragraphs: ["Equipment grounding, system grounding, neutral-ground bonding, and lightning/surge protection are different design questions. The correct arrangement depends on inverter topology, mobile versus stationary use, service equipment, and local rules."], warning: "Ground-rod and neutral-bonding rules cannot be safely reduced to one universal diagram. Follow listed equipment instructions and the authority having jurisdiction." },
    ],
  },
  {
    id: "mounting", group: "Mounting", number: "16", title: "Roof, ground, and pole mounting", minutes: 22,
    lead: "Design for structure, water, wind, snow, access, shade, wire management, bonding, and maintenance - not only tilt.",
    sections: [
      { heading: "Roof arrays", bullets: ["Verify structure and roof condition before adding decades of service life.", "Use a listed mounting/flashing approach compatible with the roof covering.", "Observe attachment spacing, rail spans, clamp zones, setbacks, pathways, and module edge clearances.", "Plan wire support so connectors never rest on the roof.", "Provide airflow and access without creating water intrusion."] },
      { heading: "Ground and pole arrays", bullets: ["Check underground utilities, property restrictions, setbacks, and drainage.", "Design foundations and framing for local wind, snow, frost, and soil.", "Protect exposed backsheets and conductors from people, animals, vegetation, and equipment.", "Size trench conduit and pulling access; separate incompatible circuits as required.", "Ground mounts simplify cleaning and seasonal adjustment but require secure foundations."] },
      { heading: "Orientation and shade", paragraphs: ["Use the production calculator to compare azimuth and tilt by month. In the Northern Hemisphere, south-facing is often strongest annually, while east/west arrays can better match morning and evening loads. Winter optimization usually uses a steeper tilt." ] },
    ],
  },
  {
    id: "install-components", group: "Installation", number: "17", title: "Install batteries, controller, inverter, and wiring", minutes: 26,
    lead: "Mount and route the system while it is de-energized, preserving service clearances, airflow, and an obvious energy path.",
    sections: [
      { heading: "Before wiring", bullets: ["Finalize the one-line diagram and equipment layout.", "Confirm every model, conductor, lug, fuse, breaker, disconnect, and enclosure.", "Photograph labels and record serial numbers.", "Cover PV modules or keep connectors isolated; modules produce voltage in light.", "Lock out available sources and verify absence of voltage."] },
      { heading: "Battery and power electronics", bullets: ["Provide approved battery support, spacing, temperature control, and ventilation.", "Mount controllers and inverters in the required orientation with manufacturer clearances.", "Keep controller-to-battery conductors short where practical.", "Use busbars and shunts to create intentional current paths.", "Crimp, heat-shrink, support, label, torque, and document each conductor."] },
      { heading: "Connection order", paragraphs: ["Many controllers require the battery connection before the PV connection so system voltage is detected correctly. Follow the exact manufacturer sequence rather than a generic rule."], warning: "Never make or break ordinary PV connectors under load unless the connector is specifically rated and the procedure permits it." },
    ],
  },
  {
    id: "commissioning", group: "Installation", number: "18", title: "Commissioning and initial power-on", minutes: 22,
    lead: "Energize one subsystem at a time with expected measurements, stop conditions, and a written record.",
    sections: [
      { heading: "Pre-energization inspection", bullets: ["Mechanical mounting complete and conductors supported", "Polarity independently verified at every source and load", "Open-circuit voltages compared with calculated values", "Protection and disconnect ratings verified", "Terminal torque recorded", "Grounding/bonding inspected", "Battery settings and firmware confirmed", "Covers, barriers, labels, and clearances complete"] },
      { heading: "Controlled sequence", paragraphs: ["Use the sequence required by the installed equipment. A common battery system approach is to establish the DC battery bus and controller first, confirm configuration, enable PV input, then energize the inverter and test a small load. Hybrid and grid-interactive equipment may require a different manufacturer commissioning procedure."], bullets: ["Pause after each source is enabled.", "Record voltage, current, state, alarms, and temperature.", "Start with a small predictable load.", "Test shutdown and emergency disconnect behavior."] },
      { heading: "Stop conditions", warning: "Stop immediately for reverse polarity, unexpected voltage, arcing, smoke, odor, rapid heating, swelling, repeated protection trips, or any reading outside the equipment's stated range." },
    ],
  },
  {
    id: "troubleshooting", group: "Installation", number: "19", title: "Testing and troubleshooting", minutes: 24,
    lead: "Divide the system into sections and prove one energy path at a time instead of replacing parts at random.",
    sections: [
      { heading: "A repeatable diagnostic order", bullets: ["Read and record the exact alarm before clearing it.", "Perform a visual and thermal inspection without touching energized conductors.", "Verify source voltage and polarity.", "Check fuses and breakers using an appropriate de-energized test.", "Measure voltage at both sides of each connection under load.", "Rebuild the operating chain one subsystem at a time."] },
      { heading: "Common failure patterns", table: [["Symptom", "Likely checks"], ["Controller off", "Battery-side voltage, polarity, fuse, required startup order"], ["PV present but no charge", "MPPT window, battery state, charge limits, disconnects, shade"], ["Inverter trips on startup", "Surge, battery voltage sag, cable drop, BMS current limit"], ["Low production", "Shade, orientation, soiling, clipping, failed string, monitoring data"], ["Hot terminal", "Loose or poor crimp, undersized conductor, damaged terminal"]] },
      { heading: "Know when to stop", paragraphs: ["Burning odor, smoke, swelling batteries, arcing, damaged insulation, repeated unexplained trips, or uncertainty around service/grid conductors requires qualified help. Do not bypass a protective device to make a fault disappear."] },
    ],
  },
  {
    id: "permits", group: "Permits", number: "20", title: "Permits, utility review, and inspection packet", minutes: 20,
    lead: "Treat approval as a design input. Requirements vary by address, equipment, system type, and the locally adopted code.",
    sections: [
      { heading: "Ask before buying", bullets: ["Which building, electrical, fire, zoning, or historic approvals apply?", "Is utility interconnection required?", "Which code editions and local amendments are enforced?", "Are stamped structural or electrical documents required?", "What setbacks, access pathways, rapid-shutdown, placard, and service-upgrade rules apply?", "Which equipment listings and approved product directories are accepted?"] },
      { heading: "Build the packet", bullets: ["Site plan and array layout", "Roof attachment or foundation detail", "Single-line electrical diagram", "Equipment datasheets and certifications", "Conductor, raceway, voltage-drop, ampacity, and protection calculations", "Battery location, capacity, chemistry, clearances, and emergency information", "Placard schedule, shutdown procedure, and commissioning results"] },
      { heading: "Inspection readiness", paragraphs: ["Make every disconnect accessible and label it consistently with the drawings. Keep torque records, photographs of concealed work, manuals, and revised drawings available."], warning: "Statements such as 'off-grid never needs a permit' are unreliable. Confirm with the authority having jurisdiction for the actual installation." },
    ],
  },
  {
    id: "example-systems", group: "Field examples", number: "21", title: "Four example system architectures", minutes: 18,
    lead: "Use examples to understand tradeoffs, then recalculate every value for your own loads, climate, and equipment.",
    sections: [
      { heading: "Tiny home", paragraphs: ["A mid-voltage architecture can support refrigeration, lighting, communications, and modest cooking loads. The source guide illustrates a 24 V concept with roughly 1.2 kW of PV, substantial battery storage, MPPT charging, and a pure-sine inverter."], bullets: ["Prioritize measured daily loads.", "Protect batteries from cold.", "Use a combiner and isolation for service."] },
      { heading: "Garage backup and van", paragraphs: ["A small garage backup can prioritize lighting, a refrigerator, doors, and charging. A vehicle system adds alternator charging, vibration, constrained ventilation, chassis bonding, and mobile electrical rules."], bullets: ["Avoid modified-sine inverters for sensitive chargers and motors.", "Fuse both ends of applicable vehicle interconnects.", "Minimize controller-to-battery distance."] },
      { heading: "Remote cabin", paragraphs: ["Long PV runs and larger loads often favor a 48 V battery architecture and higher-voltage PV strings, with generator integration for prolonged low-sun periods."], warning: "Example ratings are educational starting points, not bills of material. Product limits and site conditions govern." },
    ],
  },
  {
    id: "maintenance", group: "Field examples", number: "22", title: "Maintenance, records, and expansion", minutes: 18,
    lead: "A quiet system still needs trend review, mechanical inspection, cleaning when warranted, and controlled change management.",
    sections: [
      { heading: "Routine observations", bullets: ["Compare monthly production with weather and prior years.", "Review battery minimum/maximum state of charge and temperature.", "Check logs for repeated trips, clipping, communication loss, or cell imbalance.", "Inspect accessible cables, support, connectors, enclosures, corrosion, pests, and water entry.", "Follow manufacturer schedules for torque or thermal inspection; do not invent retorque intervals."] },
      { heading: "Cleaning and weather", bullets: ["Clean only when soiling materially affects output.", "Work when modules are cool and follow safe roof-access practices.", "Avoid abrasive tools, pressure washing, and chemicals not approved by the module maker.", "Use approved methods for snow; never strike or step on modules."] },
      { heading: "Expansion is a redesign", paragraphs: ["New panels, batteries, controllers, or inverters can change voltage, current, fault current, settings, protection, grounding, thermal loading, and approvals. Update calculations and drawings before making the change."], bullets: ["Archive original and revised settings.", "Recommission affected subsystems.", "Update labels and the emergency shutdown plan."] },
    ],
  },
];

const professionalLessons: Lesson[] = [
  {
    id: "module-datasheet", group: "Equipment reference", number: "P01", title: "PV module anatomy and datasheet literacy", minutes: 32,
    lead: "Read electrical, mechanical, temperature, connector, clamp-zone, load, and warranty fields as one product definition.",
    sections: [
      { heading: "The module is an electrical and structural assembly", paragraphs: ["Front glass, encapsulation, cells and interconnects, rear glass or backsheet, frame, junction box, bypass diodes, leads, seals, and connectors behave as a complete manufactured product. Cell technology and nameplate watts alone do not establish system fit."], bullets: ["Use Pmax, Voc, Vmp, Isc, Imp, tolerance, temperature coefficients, and NMOT in the electrical model.", "Use dimensions, weight, frame profile, cable length, connector family, design/test loads, and clamp zones in layout and structural review.", "Read the installation manual and regional certification documents alongside the sales datasheet."] },
      { heading: "A compatibility counterexample", paragraphs: ["A module may appear to fit a microinverter by wattage while exceeding its maximum module Isc, or fit an MPPT at STC while exceeding absolute voltage after cold correction. Every relevant nameplate field must pass independently."], warning: "Maximum system voltage and maximum series-fuse rating are boundary values, not targets or automatic permission for a particular string." },
    ],
  },
  {
    id: "inverter-architectures", group: "Equipment reference", number: "P02", title: "Inverter architectures and grid-forming behavior", minutes: 38,
    lead: "Compare string, optimizer, microinverter, standalone inverter/charger, and hybrid systems through their actual operating states.",
    sections: [
      { heading: "Topology before wattage", paragraphs: ["Architecture determines where DC becomes AC, how MPPT is divided, which circuits remain energized during an outage, how anti-islanding works, how batteries communicate, and which equipment establishes a local AC waveform."], bullets: ["String inverter: central DC conversion and tracker assignment.", "Optimizer system: proprietary module electronics plus a compatible central inverter.", "Microinverter: module-level DC-to-AC conversion and AC branch circuits.", "Hybrid: coordinated PV, battery, grid, backup loads, and sometimes generator.", "Standalone inverter/charger: battery-centered AC source commonly paired with separate MPPT controllers."] },
      { heading: "Professional selection fields", bullets: ["Continuous and transient output with duration", "Voltage, phase, frequency, and neutral-ground behavior", "MPPT count, input window, current, and DC/AC ratio", "Grid-following versus grid-forming modes", "Transfer, backup, generator, AC-coupling, and export-control behavior", "Approved batteries, communications, firmware, environment, listing, and warranty"] },
    ],
  },
  {
    id: "mppt-envelope", group: "Equipment reference", number: "P03", title: "MPPT operating-envelope design", minutes: 34,
    lead: "Plot cold Voc, hot Vmp, current, power, tracker assignment, output current, and battery acceptance before shortlisting a controller.",
    sections: [
      { heading: "Five independent boundaries", bullets: ["Cold-corrected Voc below the absolute PV maximum", "Hot operating Vmp above startup and inside the tracking range", "Operating and short-circuit current within each tracker/input limit", "Array power and oversizing within the manufacturer’s method", "Controller output within the battery, BMS, conductor, terminal, and protection limits"] },
      { heading: "Document the temperature assumptions", paragraphs: ["Record the module revision, temperature coefficients, local minimum design temperature, maximum operating-cell-temperature assumption, series and parallel count, tracker assignment, tolerances, and the controller manual revision. A controller label is not a substitute for its sizing instructions."], warning: "Protective overvoltage regions such as a manufacturer’s special cold-start feature are not automatically normal operating design regions." },
    ],
  },
  {
    id: "professional-tools", group: "Professional fieldwork", number: "P04", title: "Professional solar tool selection", minutes: 42,
    lead: "Choose measurement, connector, terminal, torque, labeling, isolation, and PPE equipment for the exact task and circuit boundary.",
    sections: [
      { heading: "Select instruments by exposure", paragraphs: ["A 48 V battery call, a 600 V residential string, and a 1500 V commercial array require different working-voltage and CAT ratings, current capability, leads, probes, environmental protection, proving methods, and PPE."], bullets: ["High-voltage PV DMM or clamp meter where the circuit requires it", "AC/DC clamp capability rather than AC-only assumptions", "PV analyzer and irradiance/temperature reference for commissioning", "Thermal camera with correct emissivity and loading context", "Known-source or proving-unit workflow for live-dead-live verification"] },
      { heading: "Tooling is part of the connection system", paragraphs: ["Connector and lug quality depends on matched cable, contact or lug, die, locator, tool, strip length, crimp process, inspection, assembly, and torque. Physical fit is not proof of compatibility."], warning: "No tool—even one marked insulated—makes energized cutting, connector separation, or casual live work acceptable." },
    ],
  },
  {
    id: "pv-connectors", group: "Professional fieldwork", number: "P05", title: "PV connector assembly and crimp inspection", minutes: 36,
    lead: "Build and inspect photovoltaic connectors as a controlled manufacturer-specific process, not a generic MC4-shaped connection.",
    sections: [
      { heading: "The approved combination", bullets: ["Exact connector family and contact", "Conductor material/size and cable outer diameter", "Strip length and strand condition", "Die, locator, crimp tool, and full-cycle operation", "Contact seating and retention", "Seal and cap-nut assembly with the designated torque tool", "Approved mating pair, environmental protection, and cable support"] },
      { heading: "Defects to reject", bullets: ["Nicked or cut strands", "Incorrect crimp wings or die imprint", "Partial contact seating", "Cross-mated brands", "Wet, dirty, cracked, or heat-discolored interfaces", "Loose cap nut, damaged seal, tension, abrasion, or unsupported cable"], warning: "Never disconnect a PV connector under load. Isolate using equipment rated and intended to interrupt the circuit." },
    ],
  },
  {
    id: "battery-terminations", group: "Professional fieldwork", number: "P06", title: "Battery lugs, busbars, and high-current workmanship", minutes: 38,
    lead: "Control every high-current interface from conductor strand class through protection, crimp evidence, terminal torque, and cable support.",
    sections: [
      { heading: "A complete termination record", bullets: ["Conductor material, size, strand class, insulation, and temperature rating", "Compatible listed lug barrel, plating, palm/stud size, and enclosure", "Specified die/tool, die index, crimp count, orientation, and inspection mark", "Strip length, heat-shrink allowance, terminal hardware, and treatment where specified", "Product-specific torque, calibrated tool, witness/record method, and later inspection requirements"] },
      { heading: "Fault current changes the stakes", paragraphs: ["Battery banks can supply extremely high fault current. Source protection, unprotected conductor length, DC interrupt rating, busbar rating, enclosure, clearances, finger safety, and service procedure must be evaluated together."], warning: "An inexpensive hydraulic crimper and an arbitrary lug do not form an engineered connection simply because the finished crimp looks tight." },
    ],
  },
  {
    id: "electrical-safety-loto", group: "Professional fieldwork", number: "P07", title: "Electrical safety, PPE, LOTO, and fall planning", minutes: 44,
    lead: "Control concurrent PV, battery, grid, generator, capacitor, control, fall, weather, and material-handling hazards.",
    sections: [
      { heading: "Photovoltaic sources remain sources in light", paragraphs: ["The work plan identifies every source and backfeed path, defines qualified-person boundaries, selects PPE from a task-specific hazard assessment, isolates in the manufacturer’s sequence, applies lockout/tagout, addresses stored energy and automatic controls, and verifies the work condition."], bullets: ["Shock and arc-flash assessment", "PV, grid, battery, generator, and control isolation", "Live-dead-live instrument verification", "Voltage-rated gloves and protectors when required", "Eye, face, arc-rated clothing, helmet, hearing, and footwear as assessed", "Roof fall protection plus rescue planning"] },
      { heading: "Test equipment is part of PPE planning", paragraphs: ["Use an instrument, leads, probes, accessories, CAT rating, working voltage, and environmental rating appropriate to the source. A non-contact detector is not proof that a PV DC circuit is dead."], warning: "This lesson describes planning concepts. Energized electrical work and fall protection require qualified personnel, employer procedures, and the governing regulations." },
    ],
  },
  {
    id: "roof-survey", group: "Mounting reference", number: "M01", title: "Roof survey and structural load path", minutes: 40,
    lead: "Document the roof, structure, weather exposure, drainage, access, and electrical route before selecting an attachment.",
    sections: [
      { heading: "Survey the building, not only the sunlight", bullets: ["Roof age, covering type/manufacturer, condition, prior leaks, and reroof timeline", "Deck thickness and condition, rafter/truss size and spacing, attic access, and load-path evidence", "Slope, dimensions, roof zones, valleys, hips, ridges, parapets, drains, and obstructions", "Locally adopted wind, exposure, topography, snow/drift, seismic, and dead-load criteria", "Fire pathways, service access, module handling, fall protection, and rescue", "Conduit route, attic penetrations, equipment location, and utility interface"] },
      { heading: "What the structural drawing must show", paragraphs: ["Trace module frame to clamp, rail or direct attachment, roof interface, fastener, decking or structural member, and building. Attachment spacing cannot be copied from a neighboring project."], warning: "Marketing wind/snow envelopes and generic span tables are not site-specific structural approval." },
    ],
  },
  {
    id: "roof-systems", group: "Mounting reference", number: "M02", title: "Roof rails, rail-less systems, and attachment families", minutes: 48,
    lead: "Compare asphalt-shingle, tile, standing-seam, exposed-fastened metal, rail-based, and rail-less systems by their tested load and water paths.",
    sections: [
      { heading: "Roof-covering families", bullets: ["Asphalt shingle: flashed rafter attachment, evaluated deck mount, or listed butyl attachment", "Tile: profile-specific hook, replacement tile, knockout flashing, or standoff with underlayment detailing", "Standing seam: tested nonpenetrating clamp matched to seam geometry, material, gauge, and clip system", "Exposed-fastened metal: rib-crown bracket or structural attachment with specified fasteners and gasket compression"] },
      { heading: "Rails versus rail-less", paragraphs: ["Rails add layout tolerance, leveling, wire channels, and familiar module service, but introduce span, cantilever, splice, and thermal-break rules. Rail-less systems reduce long material and roof handling, but demand precise layout, module compatibility, controlled thermal movement, and a replacement strategy."], warning: "A sealant bead is not a substitute for the tested flashing, gasket, fastener, and drainage-plane sequence." },
    ],
  },
  {
    id: "flat-roof", group: "Mounting reference", number: "M03", title: "Low-slope attached and ballasted arrays", minutes: 38,
    lead: "Coordinate roof reserve, membrane, wind zones, seismic restraint, drainage, pathways, parapets, and the exact site ballast or attachment plan.",
    sections: [
      { heading: "Ballasted does not mean structure-free", bullets: ["Wind-tunnel system and site-specific roof-zone design", "Exact block quantity, density, location, clips, trays, and seismic components", "Roof structural reserve, insulation/deck behavior, and concentrated loads", "Membrane compatibility, slip sheets, drainage, access, and roof warranty", "Parapets, row geometry, tilt, module size, fire pathways, and reroof strategy"] },
      { heading: "Attached low-slope systems", paragraphs: ["Positive attachments can reduce ballast but add membrane, flashing, substrate, fastener, pullout, thermal, and warranty requirements. Coordinate the roofing manufacturer and racking attachment documentation."], warning: "Never move, omit, or substitute ballast blocks outside the approved site plan." },
    ],
  },
  {
    id: "ground-pole", group: "Mounting reference", number: "M04", title: "Fixed ground mounts and top-of-pole systems", minutes: 46,
    lead: "Engineer foundations, soil, frost, drainage, corrosion, braces, row geometry, hoisting, conductor movement, and maintenance access.",
    sections: [
      { heading: "Fixed ground structures", bullets: ["Utility locate, easements, setbacks, flood exposure, and access", "Concrete pier, driven pile, helical pile, ground screw, grade beam, or ballast foundation", "Soil/geotechnical assumptions, frost depth, groundwater, drainage, grading, and corrosion", "Control lines, foundation tolerance, braces, rails/purlins, snow clearance, row spacing, trenching, and vegetation"] },
      { heading: "Top-of-pole differences", paragraphs: ["Pole mounts concentrate array wind and snow loads into a pole and footing. Select the head, beam, pole, footing, hoisting method, tilt positions, conductors, and wind-safe adjustment procedure as one manufacturer/engineered system."], warning: "Solar4U must never issue a universal pole diameter, footing diameter, depth, or concrete recipe." },
    ],
  },
  {
    id: "solar-canopies", group: "Mounting reference", number: "M05", title: "Solar pergolas, carports, and canopies", minutes: 42,
    lead: "Treat overhead solar as an occupied structure with engineered framing, drainage, impact protection, access, and coordinated electrical services.",
    sections: [
      { heading: "Dual-use structure", bullets: ["Foundations plus wind, snow, seismic, and overhead-module design", "Vehicle and pedestrian clearance, accessibility, bollards, and impact zones", "Shade-only versus genuinely weather-managed roof", "Module joints, gaskets, gutters, downspouts, drip lines, and snow shedding", "Fire access, emergency disconnects, equipment locations, grounding, lighting, EV rough-in, and conduit", "Corrosion, thermal movement, maintenance access, and module replacement"] },
      { heading: "Architectural modules and conventional modules", paragraphs: ["Some canopy systems use purpose-designed glass modules and integrated water management. Ordinary framed modules mounted over a pergola do not automatically create a waterproof roof or approved overhead glazing system."], warning: "A canopy or pergola normally requires structural and building review beyond ordinary ground-rack approval." },
    ],
  },
];

const allLessons: Lesson[] = [...lessons, ...professionalLessons];

const lessonEnhancements: Record<string, LessonEnhancement> = {
  "solar-flow": {
    expanded: [
      "Think of a solar system as six coordinated jobs: harvest, route, convert, store, distribute, and protect. A component can perform more than one job—a hybrid inverter may contain an MPPT charger, battery charger, transfer switch, and grid-interactive inverter—but the jobs still need to appear on the drawing.",
      "Power may travel in different directions during the same day. At noon, PV can supply loads while charging the battery and exporting surplus. After sunset, the battery may supply a critical-load panel. During a prolonged outage, a generator or grid charger may become the controlled energy source.",
    ],
    specs: [
      { label: "PV side", value: "Variable DC", detail: "Voltage and current move with sun, temperature, shade, and MPPT operation." },
      { label: "Battery side", value: "DC bus", detail: "The BMS, protection, cables, and inverter must agree on voltage and current." },
      { label: "Load side", value: "AC + DC", detail: "Household AC and protected DC branches are separate distribution systems." },
    ],
    example: { title: "Evening outage", scenario: "A hybrid home loses utility power at 6:00 PM.", values: ["PV: 0.8 kW and falling", "Critical loads: 1.1 kW", "Battery: 10 kWh, 70% state of charge"], result: "The inverter isolates from the grid, combines the remaining PV with battery power, and supplies only the backed-up circuits. The ordinary main panel is not automatically energized." },
    diagram: { title: "Bidirectional energy map", caption: "Follow the source to each conversion and protection point. Arrows can reverse between the grid, inverter, and battery.", variant: "flow", nodes: ["Sun", "PV array", "PV protection", "Hybrid inverter", "Battery", "Critical loads", "Grid"] },
    sources: [
      { organization: "U.S. Department of Energy", label: "Homeowner’s Guide to Solar", href: "https://www.energy.gov/cmei/systems/homeowners-guide-solar" },
      { organization: "Victron Energy", label: "Wiring Unlimited", href: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/index-en.html" },
    ],
  },
  "electrical-language": {
    expanded: [
      "A 100 W load describes a rate; running it for five hours consumes 500 Wh. That distinction prevents a common design mistake: choosing an inverter from energy consumption or choosing a battery from peak watts.",
      "Datasheet values also belong to specific conditions. Module Voc and Isc are boundary test values, while Vmp and Imp describe the maximum-power operating point. Battery amp-hours only become comparable after multiplying by nominal voltage and applying the manufacturer’s usable-energy limits.",
    ],
    specs: [
      { label: "Power", value: "W = V × A", detail: "Instantaneous demand or generation." },
      { label: "Energy", value: "Wh = W × h", detail: "Accumulated production or consumption." },
      { label: "Resistive loss", value: "P = I²R", detail: "Doubling current produces four times the heating at the same resistance." },
    ],
    example: { title: "Same power, different current", scenario: "A 1,200 W inverter load is supplied from two possible battery voltages.", values: ["12 V ideal current: 100 A", "48 V ideal current: 25 A", "Real current is higher after inverter loss"], result: "The 48 V design carries one quarter of the current for the same power, which materially changes cable, fuse, busbar, and connection requirements." },
    diagram: { title: "The four quantities", caption: "Power links voltage and current; energy adds time; resistance determines voltage drop and heat.", variant: "cycle", nodes: ["Voltage (V)", "Current (A)", "Power (W)", "Time (h)", "Energy (Wh)", "Resistance (Ω)"] },
    sources: [
      { organization: "Victron Energy", label: "Wiring Unlimited — theory", href: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/theory.html" },
      { organization: "U.S. Department of Energy", label: "Photovoltaics", href: "https://www.energy.gov/cmei/systems/photovoltaics" },
    ],
  },
  "component-map": {
    expanded: [
      "Compatibility is a chain, not a checklist of brand names. Begin at the module datasheet and trace the worst-case voltage and current through connectors, conductors, combiners, controllers, busbars, batteries, inverters, panels, and loads.",
      "Environmental ratings matter as much as electrical ratings. Indoor battery equipment may require a controlled location; rooftop connectors need sunlight and wet-location suitability; enclosures need the correct ingress and temperature rating; mounting hardware must be approved for the roof and module.",
    ],
    specs: [
      { label: "Module", value: "Voc / Vmp / Isc / Imp", detail: "Use the complete electrical label, not watts alone." },
      { label: "Controller", value: "Input + output limits", detail: "Check cold Voc, MPPT window, input current, output current, and supported battery." },
      { label: "Inverter", value: "Continuous + surge", detail: "Also verify waveform, phase, DC range, transfer behavior, and listings." },
    ],
    example: { title: "A hidden mismatch", scenario: "Eight 50 V Voc modules are proposed for a controller with a 250 V absolute PV limit.", values: ["8S string at label conditions: 400 V", "Cold weather increases Voc", "Controller absolute limit: 250 V"], result: "The products are incompatible even if array watts are below the controller’s advertised power. Reconfigure the strings or select different equipment." },
    diagram: { title: "Compatibility chain", caption: "Every handoff has an electrical limit, an environmental rating, and an installation instruction.", variant: "flow", nodes: ["Module label", "Connectors", "Combiner", "Controller", "DC bus", "Battery", "Inverter", "Loads"] },
    sources: [
      { organization: "Victron Energy", label: "Technical information and schematics", href: "https://www.victronenergy.com/support-and-downloads/technical-information" },
      { organization: "UL Solutions", label: "Energy storage system testing and certification", href: "https://www.ul.com/services/energy-storage-system-testing-and-certification" },
    ],
  },
  "load-audit": {
    expanded: [
      "Use measured energy whenever practical. Refrigerators, pumps, and HVAC equipment cycle; nameplates usually state a boundary or rated condition rather than a 24-hour energy total. A plug-in energy meter or monitored circuit gives a better daily figure.",
      "Build at least three scenarios: ordinary day, conservation/outage day, and worst seasonal day. Then create a timeline to expose simultaneous loads. Two appliances can have modest daily energy yet still overlap and set the inverter peak.",
    ],
    specs: [
      { label: "Daily energy", value: "Wh/day", detail: "Sets the first-pass PV and autonomy target." },
      { label: "Coincident load", value: "W", detail: "Sizes inverter continuous output and distribution." },
      { label: "Starting demand", value: "W or A", detail: "Check motor locked-rotor/current and inverter surge duration." },
    ],
    example: { title: "Critical-load audit", scenario: "A refrigerator, internet equipment, lights, and a well pump must survive an outage.", values: ["Daily energy: 4.6 kWh", "Normal overlap: 1.1 kW", "Pump startup: 3.8 kW for a short interval"], result: "A battery based only on 4.6 kWh could look adequate, while an inverter based only on 1.1 kW may fail when the pump starts. Both energy and surge must pass." },
    diagram: { title: "One-day load profile", caption: "Short peaks size the inverter; the total area under the profile sizes energy production and storage.", variant: "bars", nodes: ["Overnight base", "Morning pump", "Midday base", "Dinner loads", "Evening lighting", "Refrigerator cycles"] },
    sources: [
      { organization: "U.S. Department of Energy", label: "Homeowner’s Guide to Solar", href: "https://www.energy.gov/cmei/systems/homeowners-guide-solar" },
      { organization: "NLR", label: "PVWatts Calculator model", href: "https://developer.nlr.gov/docs/solar/pvwatts/v8/" },
    ],
  },
  "array-sizing": {
    expanded: [
      "Annual kWh hides seasonality. Model monthly AC energy using location, tilt, azimuth, array type, temperature, and losses. A northern off-grid system designed only from the annual average can enter a repeated winter energy deficit.",
      "PVWatts V8 reports monthly plane-of-array irradiance, DC output, AC output, annual energy, and capacity factor. Treat it as a reproducible screening model, then refine for actual horizon shade, snow behavior, roof geometry, equipment selection, and operating strategy.",
    ],
    specs: [
      { label: "Climate input", value: "TMY weather", detail: "Typical-year data represents long-term conditions, not a promise for next month." },
      { label: "Orientation", value: "Tilt + azimuth", detail: "Different roof faces should be modeled separately and summed." },
      { label: "Losses", value: "Documented %", detail: "Record soiling, shade, wiring, mismatch, availability, and conversion assumptions." },
    ],
    example: { title: "Why monthly modeling wins", scenario: "A 10 kW home array has strong annual production but a winter heating load.", values: ["Annual estimate: 11,500 kWh", "January estimate: 480 kWh", "July estimate: 1,420 kWh"], result: "The annual total can resemble annual consumption while January still has a large deficit. Storage cannot economically move July energy into January." },
    diagram: { title: "Seasonal production shape", caption: "Illustrative monthly shape only—the calculator should supply the location-specific values.", variant: "bars", nodes: ["Jan", "Mar", "May", "Jul", "Sep", "Nov"] },
    sources: [
      { organization: "NLR", label: "PVWatts V8 API inputs and outputs", href: "https://developer.nlr.gov/docs/solar/pvwatts/v8/" },
      { organization: "NREL", label: "Solar resource data best practices", href: "https://www.nrel.gov/docs/fy21osti/77635.pdf" },
    ],
  },
  "battery-sizing": {
    expanded: [
      "Separate energy capacity from power capability. A battery may contain enough kWh for the night but still have a BMS discharge limit below the inverter’s demand. Confirm continuous current, permitted surge current and duration, low-temperature behavior, and inverter low-voltage cutoff.",
      "Autonomy is a design choice with steep cost consequences. Model critical loads first, add reserve, then decide whether a generator or controlled load shedding is more practical than another full day of battery.",
    ],
    specs: [
      { label: "Nominal energy", value: "V × Ah", detail: "Convert to Wh before comparing banks at different voltages." },
      { label: "Usable energy", value: "Nominal × usable fraction", detail: "Follow chemistry and manufacturer limits; reserve is additional." },
      { label: "Power check", value: "BMS A × minimum V", detail: "Compare against inverter DC demand, including surge." },
    ],
    example: { title: "Two-day backup", scenario: "Critical loads use 5 kWh/day; two days are requested with 15% reserve and 90% conversion efficiency.", values: ["Load energy: 10 kWh", "After 15% reserve: 11.76 kWh", "After 90% efficiency: about 13.1 kWh nominal"], result: "A roughly 13.1 kWh first-pass bank meets the arithmetic, but temperature, aging, inverter current, product limits, and recharge strategy still need verification." },
    diagram: { title: "Battery energy layers", caption: "Nameplate capacity is divided into usable load energy, conversion loss, and intentional reserve.", variant: "stack", nodes: ["Emergency reserve", "Conversion + standby loss", "Usable night one", "Usable night two", "Low-state cutoff"] },
    sources: [
      { organization: "U.S. Department of Energy", label: "Home solar and storage overview", href: "https://www.energy.gov/cmei/systems/homeowners-guide-solar" },
      { organization: "UL Solutions", label: "Residential ESS safety testing", href: "https://www.ul.com/services/safety-testing-residential-energy-storage-systems-ess" },
    ],
  },
  "inverter-controller-sizing": {
    expanded: [
      "For the PV input, test two temperature cases: cold Voc against the controller’s absolute maximum and hot Vmp against the bottom of its tracking window. Then test parallel-string Isc/current against input terminals and any manufacturer-defined limit.",
      "For the battery output, array watts divided by battery voltage gives a first-pass charging current. The selected controller, battery charge limit, cables, busbars, and overcurrent protection must all accommodate the actual controlled output.",
    ],
    specs: [
      { label: "Absolute PV voltage", value: "Never exceed", detail: "Use corrected worst-case Voc and the manufacturer’s method." },
      { label: "MPPT window", value: "Operating range", detail: "Vmp must remain high enough under warm operating conditions." },
      { label: "Battery charging", value: "A and profile", detail: "Aggregate all chargers and respect battery/BMS charge limits." },
    ],
    example: { title: "Controller shortlist", scenario: "A 48 V battery is paired with two 4-module strings; each module has 49.5 V Voc and 13 A Isc.", values: ["Label string Voc: 198 V", "Array Isc: 26 A before required factors", "Array power: 4.8 kW"], result: "The controller needs an absolute PV limit safely above corrected cold Voc, acceptable input current, roughly 100 A-class output capacity at 48 V, and the correct battery charging profile." },
    diagram: { title: "Controller boundary checks", caption: "Voltage is determined by modules in series; current is determined by parallel strings; output current is governed by array power and battery voltage.", variant: "parallel", nodes: ["Cold Voc ceiling", "Warm Vmp floor", "Parallel Isc", "PV input terminals", "MPPT conversion", "Battery charge limit"] },
    sources: [
      { organization: "Victron Energy", label: "Which solar charge controller: PWM or MPPT?", href: "https://www.victronenergy.com/support-and-downloads/technical-information" },
      { organization: "Victron Energy", label: "Wiring Unlimited — solar", href: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/dc-wiring.html" },
    ],
  },
  "series-parallel": {
    expanded: [
      "In series, every module carries the same string current and module voltages add. In parallel, every string operates at a common voltage and string currents add. That is why series count is a voltage decision and parallel count is a current decision.",
      "Do not assume identical wattage means compatibility. Compare Vmp, Imp, Voc, Isc, cell count, temperature behavior, connector family, and manufacturer instructions. Put materially different orientations or module groups on independent MPPT inputs when supported.",
    ],
    specs: [
      { label: "4S", value: "4 × module voltage", detail: "Current remains approximately one module/string current." },
      { label: "3P", value: "3 × string current", detail: "Voltage remains approximately one string voltage." },
      { label: "4S3P", value: "12 modules", detail: "Four modules per string and three equal strings in parallel." },
    ],
    example: { title: "4S3P array", scenario: "Twelve 400 W modules each have 37 Vmp and 10.8 Imp.", values: ["String Vmp: 148 V", "Array Imp: 32.4 A", "Nameplate power: 4.8 kW"], result: "Use 148 V and 32.4 A as operating-point estimates, then independently evaluate corrected Voc, Isc-based conductor/protection rules, controller limits, and losses." },
    diagram: { title: "Series-parallel topology", caption: "Each row is a series string. The rows join in parallel at the combiner.", variant: "parallel", nodes: ["String A: M1—M2—M3—M4", "String B: M1—M2—M3—M4", "String C: M1—M2—M3—M4", "Combiner", "PV disconnect", "MPPT input"] },
    sources: [
      { organization: "Victron Energy", label: "Wiring Unlimited — solar arrays", href: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/dc-wiring.html" },
      { organization: "NLR", label: "PVWatts V8", href: "https://developer.nlr.gov/docs/solar/pvwatts/v8/" },
    ],
  },
  "shade-mismatch": {
    expanded: [
      "Shade is electrical, spatial, and temporal. A narrow vent shadow crossing one cell group can activate bypass behavior and reshape the string’s current-voltage curve. A tree may affect only winter mornings or become worse as it grows.",
      "Record shade by roof plane and time of year. Module-level electronics can reduce some mismatch effects and provide visibility, but they do not create sunlight and must be included in rapid-shutdown, mounting, thermal, communication, and compatibility planning.",
    ],
    specs: [
      { label: "Mismatch", value: "Current + voltage", detail: "Different modules and conditions move the shared operating point." },
      { label: "Bypass path", value: "Cell-group level", detail: "Limits hot-spot stress but can reduce available module voltage." },
      { label: "Separate MPPT", value: "Different planes", detail: "Useful for unlike azimuth, tilt, module type, or shade pattern." },
    ],
    example: { title: "Chimney shadow", scenario: "A south roof has one chimney shadow moving across the lower module row in winter.", values: ["Affected window: 9–11 AM", "One string crosses the shadow", "Second string remains clear"], result: "Rearranging strings or assigning the affected plane to another MPPT can outperform a visually neat wiring layout. Model the actual time pattern before buying optimizers." },
    diagram: { title: "Shade across a string", caption: "The highlighted cell group constrains a shared series current until its bypass path operates.", variant: "flow", nodes: ["Clear module", "Clear module", "Shaded cell group", "Clear module", "Changed I–V curve", "MPPT response"] },
    sources: [
      { organization: "NREL", label: "PV system performance and O&M best practices", href: "https://www.nrel.gov/docs/fy19osti/73822.pdf" },
      { organization: "NLR", label: "PVWatts V8 modeling inputs", href: "https://developer.nlr.gov/docs/solar/pvwatts/v8/" },
    ],
  },
  "diagrams-expansion": {
    expanded: [
      "A one-line diagram communicates electrical topology: sources, conversion equipment, conductors, disconnects, protection, grounding, distribution, and ratings. A site plan communicates physical placement, access, setbacks, pathways, equipment locations, and point of interconnection.",
      "Draw future capacity as an explicit design case. Spare wall space does not guarantee spare electrical capacity. Expansion can change fault current, bus loading, conductor ampacity, controller limits, battery communication, rapid shutdown, and approvals.",
    ],
    specs: [
      { label: "One-line", value: "Electrical intent", detail: "Show ratings, conductor sizes, OCPD, grounding, and disconnects." },
      { label: "Site plan", value: "Physical intent", detail: "Show property, roof/array, equipment, access, and routing." },
      { label: "Revision record", value: "As-built truth", detail: "Date changes and preserve settings, photos, labels, and model numbers." },
    ],
    example: { title: "Future battery addition", scenario: "A grid-tied PV design may receive storage two years later.", values: ["Reserve equipment-wall space", "Document service and backed-up-load capacity", "Choose a compatible architecture, not merely a larger conduit"], result: "The drawing records the intended transition and the constraints that must be rechecked. It does not pre-approve future equipment." },
    diagram: { title: "Minimum one-line", caption: "Ratings and protective boundaries belong beside the conductor they govern.", variant: "flow", nodes: ["PV strings", "Combiner/OCPD", "DC disconnect", "Inverter", "AC disconnect", "Distribution panel", "Meter / grid"] },
    sources: [
      { organization: "U.S. Department of Energy", label: "Permitting and inspection for rooftop solar", href: "https://www.energy.gov/cmei/systems/permitting-and-inspection-rooftop-solar" },
      { organization: "IronRidge", label: "Pitched-roof design resources", href: "https://base.ironridge.com/pitched-roof-mounting/resources" },
    ],
  },
  "battery-chemistry": {
    expanded: [
      "Chemistry changes voltage profile, usable depth, charge behavior, temperature limits, ventilation needs, mass, and failure modes. Product certification, installation instructions, compatible inverter/charger settings, and the complete energy-storage-system listing matter more than a chemistry nickname.",
      "A BMS supervises cells and can interrupt charging or discharging, but it is not a substitute for external circuit protection, a service disconnect, correct conductor sizing, ventilation or spacing rules, or a whole-system shunt.",
    ],
    specs: [
      { label: "LiFePO₄", value: "Flat voltage curve", detail: "Use a shunt/BMS data rather than voltage alone for state of charge." },
      { label: "Lead-acid", value: "Charge stages", detail: "Ventilation, temperature compensation, and depth of discharge affect service life." },
      { label: "ESS listing", value: "System-level", detail: "UL 9540 evaluates the integrated storage system and referenced safety standards." },
    ],
    example: { title: "Cold garage battery", scenario: "A lithium battery is installed where winter temperature can fall below its permitted charge temperature.", values: ["PV is available on a clear cold morning", "Cells remain below charge threshold", "BMS may block charging"], result: "The system needs an approved environmental strategy—such as a conditioned location or manufacturer-supported heating—not a disabled temperature protection." },
    diagram: { title: "Protection layers", caption: "Cell supervision is one layer inside a larger storage safety system.", variant: "stack", nodes: ["Cell chemistry", "Module construction", "BMS limits", "External fuse + disconnect", "Listed enclosure/system", "Location + fire/code review"] },
    sources: [
      { organization: "UL Solutions", label: "Understanding UL 9540 and ESS certification", href: "https://www.ul.com/services/energy-storage-system-testing-and-certification" },
      { organization: "UL Solutions", label: "Installation codes and ESS requirements", href: "https://www.ul.com/resources/installation-codes-and-requirements-energy-storage-systems-ess-faqs" },
    ],
  },
  "bank-architecture": {
    expanded: [
      "Higher battery voltage reduces current for the same power and often becomes practical as inverter size grows. It does not automatically make a system safer: voltage hazards, product ecosystem, series-battery restrictions, disconnects, and qualified-service requirements also change.",
      "Parallel batteries should have intentionally balanced current paths. Equal-length, equal-gauge branch cables to rated busbars are easier to inspect and expand than a long daisy chain. Follow the exact battery manufacturer’s maximum series/parallel count and fuse requirements.",
    ],
    specs: [
      { label: "1.2 kW at 12 V", value: "≈100 A ideal", detail: "Before inverter loss and low-voltage conditions." },
      { label: "1.2 kW at 24 V", value: "≈50 A ideal", detail: "Half the 12 V current." },
      { label: "1.2 kW at 48 V", value: "≈25 A ideal", detail: "One quarter of the 12 V current." },
    ],
    example: { title: "Workshop upgrade", scenario: "A 12 V cabin system gains a 2.4 kW well pump and longer inverter run.", values: ["12 V ideal full-load current: 200 A", "48 V ideal full-load current: 50 A", "Existing 12 V equipment cannot simply move to 48 V"], result: "A 48 V redesign may reduce DC current, but requires a compatible inverter, controllers, DC loads/converters, battery architecture, protection, and revised drawings." },
    diagram: { title: "Same power at three bus voltages", caption: "Bar length represents approximate current before losses.", variant: "bars", nodes: ["12 V — 100 A", "24 V — 50 A", "48 V — 25 A", "Cable heating follows I²R"] },
    sources: [
      { organization: "Victron Energy", label: "Wiring Unlimited — battery bank wiring", href: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/battery-bank-wiring.html" },
      { organization: "Victron Energy", label: "Lithium Battery Smart installation", href: "https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/installation.html" },
    ],
  },
  "battery-monitoring": {
    expanded: [
      "Charging settings are a system contract. Every charger—solar, inverter/charger, alternator, or generator—must use values permitted by the battery manufacturer, and their combined current must remain acceptable to the bank and BMS.",
      "A shunt measures current crossing the battery boundary and integrates it over time. Accurate state-of-charge tracking depends on correct capacity, charge-efficiency, tail-current, and synchronization settings. Trend voltage, current, temperature, state of charge, and protection events together.",
    ],
    specs: [
      { label: "Shunt position", value: "Battery negative boundary", detail: "All system negative current must pass through it; only battery-side connections bypass it." },
      { label: "Charge sources", value: "Aggregate current", detail: "Solar, grid, and alternator charging can overlap." },
      { label: "Cold charging", value: "Manufacturer limit", detail: "Use a supported sensor/heater strategy and keep BMS protection active." },
    ],
    example: { title: "State-of-charge drift", scenario: "A monitor says 62%, while the BMS repeatedly reaches full charge earlier than expected.", values: ["Incorrect programmed capacity", "Small DC load bypasses shunt", "Synchronization settings never satisfied"], result: "Correct the wiring and monitor settings, then complete the manufacturer’s synchronization procedure. Do not recalibrate by guessing a percentage." },
    diagram: { title: "What the shunt must see", caption: "Every load and charger belongs on the system side; the battery alone belongs on the battery side.", variant: "flow", nodes: ["Battery negative", "Shunt", "Negative busbar", "Inverter", "Charge controller", "DC loads", "Monitor"] },
    sources: [
      { organization: "Victron Energy", label: "Wiring Unlimited — shunts and battery wiring", href: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/dc-wiring.html" },
      { organization: "Victron Energy", label: "Lithium Battery Smart installation", href: "https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/installation.html" },
    ],
  },
  "tools-meter": {
    expanded: [
      "A meter’s maximum displayed voltage is not its complete safety rating. The measurement category describes the transient-energy environment. Use an independently certified meter and leads whose CAT and voltage ratings match the circuit and location.",
      "Before a voltage-absence test, inspect the leads, confirm the jacks and function, prove the meter on a known source, test the target, then re-prove it. Clamp meters reduce the need to open a current path, but do not eliminate shock or arc-flash risk.",
    ],
    specs: [
      { label: "CAT II", value: "Receptacle loads", detail: "Appliances and portable equipment; not a service entrance rating." },
      { label: "CAT III", value: "Fixed distribution", detail: "Panels, switchgear, and fixed equipment environments." },
      { label: "CAT IV", value: "Service origin", detail: "Utility connection, service entrance, and outdoor conductors." },
    ],
    example: { title: "Wrong jack, wrong hazard", scenario: "A meter lead remains in the current jack after an amperage test and is then placed across a battery.", values: ["Current input presents a very low-resistance path", "Battery fault current can be extremely high", "Meter fuse/rating may not safely interrupt the event"], result: "Stop and use a written setup check: correct function, correct jacks, intact rated leads, known-source proof, and appropriate PPE before contact." },
    diagram: { title: "Live–dead–live sequence", caption: "Proving the test instrument before and after the target reduces the chance of trusting a failed meter or lead.", variant: "flow", nodes: ["Inspect meter + leads", "Known live source", "Target circuit", "Known live source again", "Record result"] },
    sources: [
      { organization: "Fluke", label: "Electrical measurement category ratings", href: "https://www.fluke.com/en-in/learn/blog/safety/safe-test-tools-real-world-use" },
      { organization: "Fluke", label: "Inspecting and testing meter leads", href: "https://www.fluke.com/en-gb/learn/blog/digital-multimeters/testing-your-test-leads" },
      { organization: "OSHA", label: "Solar electrical hazards", href: "https://www.osha.gov/green-jobs/solar/electrical" },
    ],
  },
  "protection-grounding": {
    expanded: [
      "Overcurrent protection protects conductors and equipment from damaging current; a disconnect provides an intentional isolation point; grounding and bonding create defined fault paths and equalize exposed conductive parts. One device does not automatically perform all three jobs.",
      "DC interruption is demanding because the arc does not naturally cross zero each cycle. Use devices specifically listed and rated for the circuit’s DC voltage, current, polarity where applicable, fault current, environment, and conductor/terminal range.",
    ],
    specs: [
      { label: "Fuse/breaker", value: "Protect conductor", detail: "Coordinate ampacity, continuous loading, equipment limits, and interrupt rating." },
      { label: "Disconnect", value: "Isolate equipment", detail: "Locate and label it for operation and emergency response." },
      { label: "Bonding/grounding", value: "Fault path", detail: "Follow the adopted code and inverter/system topology." },
    ],
    example: { title: "Battery fault boundary", scenario: "A large lithium bank feeds an inverter through a short, heavy cable.", values: ["Normal current is high", "Available fault current can be far higher", "Cable is exposed until its first protective device"], result: "Place correctly rated protection close to the source as required, minimize the unprotected length, and verify the device’s DC interrupt capability for the battery system." },
    diagram: { title: "Protection is coordinated", caption: "The source-side protective device limits the faulted conductor; the disconnect creates a service boundary; bonding supports fault clearing.", variant: "flow", nodes: ["Energy source", "Source OCPD", "Disconnect", "Protected conductor", "Equipment", "Bonding path", "Grounding system"] },
    sources: [
      { organization: "Victron Energy", label: "Wiring Unlimited — DC wiring and protection", href: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/dc-wiring.html" },
      { organization: "OSHA", label: "Solar electrical safety", href: "https://www.osha.gov/green-jobs/solar/electrical" },
    ],
  },
  "mounting": {
    expanded: [
      "A mounting plan transfers wind, snow, dead, and seismic loads into a structure or foundation while preserving roof drainage and weatherproofing. Attachment spacing and rail span come from engineered tables or design software using site-specific loads and roof zones.",
      "Follow the current racking and module manuals as one system. Clamp zones, fastener type, pilot holes, flashing sequence, rail orientation, cantilever, thermal expansion, bonding hardware, torque, edge setbacks, and wire support are not interchangeable details.",
    ],
    specs: [
      { label: "Roof input", value: "Structure + covering", detail: "Verify rafter/truss condition, roof age, attachment type, and water path." },
      { label: "Site load", value: "Wind + snow", detail: "Use the governing local design values and roof zones." },
      { label: "Torque", value: "Manufacturer value", detail: "Use a calibrated tool and record critical connections." },
    ],
    example: { title: "Composition-shingle roof", scenario: "A flush-mount row crosses rafters on a pitched roof.", values: ["Locate structural members", "Use the approved attachment/flashing sequence", "Level rails and torque hardware to the current manual"], result: "A watertight penetration and a structural connection are two separate success criteria. Photograph concealed flashing and attachment work before modules cover it." },
    diagram: { title: "Roof load path", caption: "Module loads travel through clamps, rails, attachments, and fasteners into the roof structure.", variant: "stack", nodes: ["PV module", "Mid/end clamps", "Rail", "Roof attachment + flashing", "Structural rafter/truss", "Building load path"] },
    sources: [
      { organization: "IronRidge", label: "XR Flush Mount installation manual", href: "https://files.ironridge.com/pitched-roof-mounting/resources/brochures/IronRidge_Flush_Mount_Installation_Manual.pdf" },
      { organization: "IronRidge", label: "Pitched-roof design resources", href: "https://base.ironridge.com/pitched-roof-mounting/resources" },
    ],
  },
  "install-components": {
    expanded: [
      "Lay out the equipment wall before drilling: manufacturer clearances, ventilation, conductor bend radius, service access, communication separation, water exposure, battery location, disconnect visibility, and future replacement all compete for space.",
      "Connections are manufactured interfaces. Use the stated conductor material/class, strip length, lug, die, crimp process, terminal hardware, anti-oxidation treatment where specified, and torque. Support cables so terminals do not carry cable weight or movement.",
    ],
    specs: [
      { label: "Battery cables", value: "Matched paths", detail: "Equalize parallel branches and land them on rated busbars." },
      { label: "Controller leads", value: "Short + low drop", detail: "Accurate battery sensing and charge control depend on the path." },
      { label: "Data cables", value: "Separated/routed", detail: "Follow manufacturer guidance for interference and network topology." },
    ],
    example: { title: "Equipment-wall mock-up", scenario: "A hybrid inverter, controller, battery cabinet, busbars, and disconnects share one utility room wall.", values: ["Cardboard outlines mark clearances", "Conduit routes are planned before mounting", "Service covers can open without removing adjacent equipment"], result: "The mock-up catches bend-radius and access conflicts before heavy equipment is installed. Final locations still require electrical, structural, fire, and manufacturer review." },
    diagram: { title: "Serviceable equipment wall", caption: "Keep protective devices visible, high-current paths short, and required clearances open.", variant: "parallel", nodes: ["PV disconnect", "MPPT / hybrid inverter", "Battery disconnect", "Positive + negative busbars", "Battery enclosure", "AC distribution"] },
    sources: [
      { organization: "Victron Energy", label: "Wiring Unlimited — cable selection and connections", href: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/dc-wiring.html" },
      { organization: "UL Solutions", label: "ESS installation requirements", href: "https://www.ul.com/resources/installation-codes-and-requirements-energy-storage-systems-ess-faqs" },
    ],
  },
  "commissioning": {
    expanded: [
      "Commission by subsystem, not with one dramatic power-on. First complete visual, mechanical, polarity, continuity, insulation/grounding where applicable, and configuration checks with sources isolated. Then energize in the manufacturer’s sequence.",
      "The baseline is part of the installation. Record firmware, settings, open-circuit voltages, battery voltage and state of charge, operating currents, temperatures, alarms, production, torque records, photographs, serial numbers, and the final as-built drawing.",
    ],
    specs: [
      { label: "Pre-energization", value: "Inspect + measure", detail: "Polarity, conductor identity, terminations, protection, grounding, and covers." },
      { label: "Controlled start", value: "One subsystem", detail: "Observe state and alarms before enabling the next source or load." },
      { label: "Baseline", value: "Saved evidence", detail: "Future troubleshooting needs known-good values." },
    ],
    example: { title: "First charge", scenario: "A new battery-based array is ready to energize.", values: ["Battery/BMS first if the controller requires it", "Confirm controller sees the correct battery voltage/profile", "Close PV input only after configuration and polarity checks"], result: "The precise order follows the product manuals. Pause immediately on unexpected voltage, smell, heat, noise, alarm, or communication state." },
    diagram: { title: "Controlled energization", caption: "Every gate has a pass/fail result. A failed gate returns to isolation and diagnosis.", variant: "flow", nodes: ["Documents checked", "Mechanical inspection", "Dead tests", "Battery/control power", "PV source", "AC/load test", "Baseline saved"] },
    sources: [
      { organization: "NREL", label: "PV and energy storage O&M best practices", href: "https://www.nrel.gov/docs/fy19osti/73822.pdf" },
      { organization: "Victron Energy", label: "Wiring Unlimited", href: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/index-en.html" },
    ],
  },
  "troubleshooting": {
    expanded: [
      "Troubleshoot from evidence and boundaries. Capture the fault time, operating mode, weather, load, state of charge, temperatures, alarms, recent changes, and whether the problem is repeatable. Preserve logs before resets erase context.",
      "Divide the system at safe test points: source, protection, conductor, conversion equipment, storage, distribution, and load. Compare measured values with the as-built baseline and manufacturer limits; change only one controlled variable at a time.",
    ],
    specs: [
      { label: "No production", value: "Irradiance → AC", detail: "Check source voltage, disconnects/OCPD, MPPT state, alarms, and grid status." },
      { label: "Low battery", value: "Energy balance", detail: "Compare load, charge energy, temperature, settings, and actual capacity." },
      { label: "Hot connection", value: "Stop + isolate", detail: "Do not normalize odor, discoloration, melting, or repeated trips." },
    ],
    example: { title: "Controller shows PV voltage but no charge", scenario: "The display reports 145 V PV and zero battery current on a sunny day.", values: ["Battery may be full or charge-limited", "PV input may be below start power under shade", "BMS/temperature/communication may block charge"], result: "Read controller state and alarms before disconnecting anything. Confirm battery acceptance and operating conditions, then follow the manufacturer’s diagnostic tree." },
    diagram: { title: "Fault isolation tree", caption: "Start with the symptom and split the energy path into measurable boundaries.", variant: "parallel", nodes: ["Symptom + timestamp", "Source available?", "Protection closed?", "Converter enabled?", "Battery accepting?", "Load/distribution normal?"] },
    sources: [
      { organization: "NREL", label: "PV O&M best practices", href: "https://www.nrel.gov/docs/fy19osti/73822.pdf" },
      { organization: "Fluke", label: "Basic electrical measurement guidance", href: "https://www.fluke.com/en-ie/learn/blog/electrical/basic-electrical-measurement-faq" },
    ],
  },
  "permits": {
    expanded: [
      "The authority having jurisdiction, fire/building officials, and utility may review different parts of the same project. Confirm the adopted code editions and local amendments before final design; permit requirements, fees, forms, setbacks, and inspection sequence vary by place.",
      "A complete packet commonly includes a site plan, roof/array layout, structural information, one-line diagram, equipment specifications/listings, conductor and protection schedule, labels, rapid-shutdown approach where applicable, battery location, and interconnection documents.",
    ],
    specs: [
      { label: "Permit", value: "Before installation", detail: "Local building/electrical approval is normally required for rooftop work." },
      { label: "Inspection", value: "Installed work", detail: "The as-built system must match approved documents or revisions." },
      { label: "Utility PTO", value: "Before export", detail: "Permission to operate follows utility interconnection requirements." },
    ],
    example: { title: "Revision during installation", scenario: "The specified module is unavailable after permit approval.", values: ["Replacement has different dimensions", "Voc/Isc and clamp zones change", "Array layout and calculations may change"], result: "Submit the required revision and update the drawing/spec sheets before treating the replacement as equivalent. Keep the approved and as-built sets aligned." },
    diagram: { title: "Approval path", caption: "Local processes differ, but design, review, installation, inspection, and utility authorization are distinct gates.", variant: "flow", nodes: ["Site + load study", "Design packet", "Permit / utility review", "Installation", "Inspection", "Corrections if needed", "Permission to operate"] },
    sources: [
      { organization: "U.S. Department of Energy", label: "Permitting and inspection for rooftop solar", href: "https://www.energy.gov/cmei/systems/permitting-and-inspection-rooftop-solar" },
      { organization: "U.S. Department of Energy", label: "SolarAPP+ overview", href: "https://www.energy.gov/cmei/systems/streamlining-solar-permitting-solarapp" },
    ],
  },
  "example-systems": {
    expanded: [
      "Examples are comparison frameworks, not shopping lists. Start with loads and operating objective, then select architecture. A refrigerator backup, RV, remote cabin, and whole-home hybrid can all use solar and batteries while having entirely different voltage, grounding, transfer, mounting, and approval needs.",
      "For each example, write an energy budget, peak/surge requirement, winter production case, autonomy target, recharge strategy, one-line, protection schedule, and failure plan. Then replace illustrative values with measured loads and current product documentation.",
    ],
    specs: [
      { label: "Portable", value: "0.2–2 kWh", detail: "Illustrative range for small devices and short-duration loads." },
      { label: "Critical loads", value: "5–20 kWh", detail: "Highly dependent on pumps, refrigeration, heating, and outage duration." },
      { label: "Whole home", value: "Load-managed", detail: "Large HVAC, water heating, cooking, and EV loads dominate architecture." },
    ],
    example: { title: "Remote cabin first pass", scenario: "A cabin uses 4 kWh/day and must operate through two low-sun days.", values: ["48 V architecture", "About 10–13 kWh first-pass storage after reserve/loss assumptions", "PV sized from the weakest design month plus generator recovery"], result: "The example narrows the design space. Actual cable lengths, module temperature, well-pump surge, battery limits, snow, generator integration, and local approvals determine the final system." },
    diagram: { title: "Architecture ladder", caption: "Complexity grows with load diversity, autonomy, transfer requirements, and grid interaction.", variant: "bars", nodes: ["Portable DC kit", "Vehicle / RV", "Cabin", "Critical-load backup", "Whole-home hybrid"] },
    sources: [
      { organization: "U.S. Department of Energy", label: "Homeowner’s Guide to Solar", href: "https://www.energy.gov/cmei/systems/homeowners-guide-solar" },
      { organization: "Victron Energy", label: "Off-grid, backup, and storage schematics", href: "https://www.victronenergy.com/support-and-downloads/technical-information" },
    ],
  },
  "maintenance": {
    expanded: [
      "Maintenance begins at design: accessible disconnects, supported wiring, replaceable equipment, good drainage, clear labels, monitoring, and preserved documentation reduce lifetime risk. Use the manufacturer’s schedule and site conditions rather than inventing a universal cleaning or retorque interval.",
      "Normalize production for weather before declaring a fault. Trend monthly energy, inverter availability, clipping, battery state-of-charge extremes, temperature, alarms, and communication gaps. Inspect after severe weather and after any contractor works near the array or electrical equipment.",
    ],
    specs: [
      { label: "Monthly", value: "Trend review", detail: "Compare production, weather, alarms, battery range, and prior periods." },
      { label: "Periodic", value: "Physical inspection", detail: "Look for wire movement, pests, corrosion, water entry, damage, and label condition." },
      { label: "After change", value: "Recommission", detail: "Update settings, drawings, photos, labels, and baseline values." },
    ],
    example: { title: "Ten-percent production decline", scenario: "This spring’s output is below last spring’s total.", values: ["Weather was cloudier", "One inverter channel has repeated communication gaps", "New tree growth shades the morning array"], result: "Separate weather, availability, and shade effects before cleaning or replacing parts. Use monitoring channels and a safe inspection to locate the actual loss." },
    diagram: { title: "Lifecycle record", caption: "A maintained system moves through observation, comparison, safe inspection, correction, verification, and documentation.", variant: "cycle", nodes: ["Monitor", "Compare", "Inspect safely", "Correct", "Verify", "Update records"] },
    sources: [
      { organization: "NREL", label: "Best Practices for PV and Energy Storage O&M", href: "https://www.nrel.gov/docs/fy19osti/73822.pdf" },
      { organization: "NREL", label: "O&M design and wire-management summary", href: "https://www.nrel.gov/docs/fy17osti/68281.pdf" },
    ],
  },
};

const discussions = [
  { tag: "Controllers", title: "Overpaneling an MPPT controller", summary: "Understand why PV nameplate power may exceed controller output in some approved designs, and why voltage, input current, thermal limits, and warranty rules still govern.", href: "https://cleversolarpower.com/overpaneling-mppt-charge-controller/" },
  { tag: "Controllers", title: "MPPT minimum input voltage", summary: "Explore the lower edge of the tracking window: a string can remain below the absolute maximum yet still be too low for reliable charging.", href: "https://cleversolarpower.com/mppt-minimum-input-voltage/" },
  { tag: "Arrays", title: "Mixing mismatched solar panels", summary: "A deeper look at how unlike current and voltage ratings interact in series and parallel configurations.", href: "https://cleversolarpower.com/mixing-solar-panels-mismatched/" },
  { tag: "Arrays", title: "Shading: series or parallel?", summary: "Compare shade behavior across string layouts and learn why bypass diodes and separate MPPT inputs matter.", href: "https://cleversolarpower.com/shading-solar-panels/" },
  { tag: "Batteries", title: "Do you need a shunt with a BMS?", summary: "Separate cell protection from accurate whole-system energy accounting and long-term state-of-charge tracking.", href: "https://cleversolarpower.com/do-you-need-a-shunt-if-you-have-a-bms/" },
  { tag: "Batteries", title: "Depth of discharge for LiFePO4", summary: "Examine the relationship between usable capacity, reserve, cycle life, and operating objectives.", href: "https://cleversolarpower.com/depth-of-discharge-lifepo4-batteries/" },
  { tag: "System voltage", title: "Why 48 V can outperform 12 V", summary: "Follow the current, conductor, voltage-drop, and expansion consequences of moving to a higher DC bus voltage.", href: "https://cleversolarpower.com/48v-vs-12v-battery/" },
  { tag: "Safety", title: "Protection devices in off-grid systems", summary: "Review the distinct jobs performed by fuses, breakers, isolators, surge protection, and disconnecting means.", href: "https://cleversolarpower.com/safety-devices-for-off-grid-solar-systems/" },
  { tag: "Safety", title: "Wire types for solar PV systems", summary: "Go beyond gauge and compare insulation, sunlight, wet-location, temperature, flexibility, and installation ratings.", href: "https://cleversolarpower.com/wire-types-for-solar-pv-systems/" },
  { tag: "Safety", title: "Grounding and bonding for vans", summary: "A mobile-system discussion of chassis bonding, residual-current protection, electrical networks, and neutral-earth decisions.", href: "https://cleversolarpower.com/grounding-and-bonding-for-vans/" },
  { tag: "Inverters", title: "High-frequency versus low-frequency inverters", summary: "Compare surge behavior, transformer topology, weight, idle consumption, and use-case fit.", href: "https://cleversolarpower.com/high-and-low-frequency-inverter/" },
  { tag: "Backup", title: "What is a critical-load panel?", summary: "Learn how selected circuits are separated for outage support instead of attempting to back up every household load.", href: "https://cleversolarpower.com/what-is-a-critical-load-panel/" },
  { tag: "Controllers", title: "Multiple charge controllers on one bank", summary: "Consider coordinated charge settings, aggregate current, shared sensing, and independent PV inputs.", href: "https://cleversolarpower.com/multiple-charge-controllers/" },
  { tag: "Mounting", title: "Summer and winter tilt angles", summary: "Explore seasonal tilt tradeoffs and why annual maximum production may not match winter resilience.", href: "https://cleversolarpower.com/best-tilt-angle-for-solar-panels-summer-winter/" },
];

function ProfessionalReference({ guide }: { guide: ProfessionalGuide }) {
  return <div className="professional-reference">
    <div className="pro-reference-head">
      <div><span>TECHNICAL REFERENCE • REVIEWED {guide.reviewed}</span><h2>Essentials for learners. Source-backed detail for field professionals.</h2><p>{guide.summary}</p></div>
      <aside><small>AUDIENCE</small><b>{guide.audience}</b><small>REFERENCE POLICY</small><p>Exact model, suffix, manual revision, adopted code, site conditions, and AHJ requirements control.</p></aside>
    </div>

    <div className={`lesson-photo-gallery ${guide.visuals.length>1?"multiple":""}`}>
      {guide.visuals.map(visual=><figure key={visual.src}>
        <div><Image src={visual.src} alt={visual.alt} fill sizes="(max-width: 850px) 92vw, 55vw"/></div>
        <figcaption><b>{visual.caption}</b><small>{visual.note}</small></figcaption>
      </figure>)}
    </div>

    <section className="pro-objectives">
      <span>WHEN YOU FINISH THIS REFERENCE</span>
      <div>{guide.objectives.map((objective,index)=><p key={objective}><b>{String(index+1).padStart(2,"0")}</b>{objective}</p>)}</div>
    </section>

    {guide.referenceSections.map(section=><section className="pro-reading" key={section.title}>
      <span>DESIGN DESK</span><h2>{section.title}</h2>
      {section.paragraphs.map(paragraph=><p key={paragraph}>{paragraph}</p>)}
      {section.bullets&&<ul>{section.bullets.map(item=><li key={item}>{item}</li>)}</ul>}
    </section>)}

    {guide.tables?.map(table=><section className="pro-table-section" key={table.title}>
      <span>REFERENCE TABLE</span><h2>{table.title}</h2>{table.description&&<p>{table.description}</p>}
      <div className="pro-data-table" style={{"--pro-columns":table.columns.length} as CSSProperties}>
        <div className="pro-data-head">{table.columns.map(column=><b key={column}>{column}</b>)}</div>
        {table.rows.map(row=><div className="pro-data-row" key={row.join("|")}>{row.map((cell,index)=><span key={`${index}-${cell}`}>{cell}</span>)}</div>)}
      </div>
    </section>)}

    {guide.products&&guide.products.length>0&&<section className="pro-products">
      <div className="pro-section-heading"><span>MODEL EXAMPLES • NOT UNIVERSAL ENDORSEMENTS</span><h2>Representative equipment and where it fits</h2><p>Each example includes the use case and the limitation that is easy to miss. Confirm availability and the current official documentation before purchase or design.</p></div>
      <div className="pro-product-grid">{guide.products.map(product=><article key={`${product.maker}-${product.model}`}>
        <div><small>{product.role}</small><span>{product.maker}</span></div>
        <h3>{product.model}</h3>
        <ul>{product.specs.map(spec=><li key={spec}>{spec}</li>)}</ul>
        <dl><dt>Suitable when</dt><dd>{product.useWhen}</dd><dt>Important limitation</dt><dd>{product.limitation}</dd></dl>
        <a href={product.href} target="_blank" rel="noreferrer">Open official product/manual ↗</a>
      </article>)}</div>
    </section>}

    {guide.procedure&&<section className="pro-procedure">
      <div><span>FIELD WORKFLOW</span><h2>{guide.procedure.title}</h2><p>The order can change when the controlling manufacturer or safety procedure requires it.</p></div>
      <ol>{guide.procedure.steps.map((step,index)=><li key={step}><b>{String(index+1).padStart(2,"0")}</b><span>{step}</span></li>)}</ol>
    </section>}

    {guide.fieldCase&&<section className="pro-field-case">
      <div><span>FIELD CASE</span><h2>{guide.fieldCase.title}</h2><p>{guide.fieldCase.scenario}</p></div>
      <div><small>EVIDENCE</small><ul>{guide.fieldCase.evidence.map(item=><li key={item}>{item}</li>)}</ul></div>
      <div><small>RESPONSE</small><p>{guide.fieldCase.response}</p></div>
    </section>}

    <section className="manual-shelf">
      <div className="pro-section-heading"><span>CURRENT PRIMARY SOURCES</span><h2>Manufacturer and authority manual shelf</h2><p>Open the authoritative source rather than relying on a copied torque value, old screenshot, or revisionless summary.</p></div>
      <div>{guide.manuals.map(manual=><a href={manual.href} target="_blank" rel="noreferrer" key={manual.href}>
        <small>{manual.organization}</small><h3>{manual.title}</h3><p>{manual.focus}</p><div className="manual-card-foot">{manual.revision&&<span>{manual.revision}</span>}<b>Open reference ↗</b></div>
      </a>)}</div>
    </section>
  </div>;
}

function LessonBody({ lesson }: { lesson: Lesson }) {
  const enhancement=lessonEnhancements[lesson.id];
  const professionalGuide=professionalGuides[lesson.id];
  return <article className="learn-article" id="lesson-content">
    <div className="learn-article-head"><div><span>LESSON {lesson.number}</span><h1>{lesson.title}</h1><p>{lesson.lead}</p></div><div><b>{lesson.minutes}</b><small>MIN READ</small></div></div>
    <div className="lesson-callout"><b>Before you build</b><p>Use this material for planning and vocabulary. Final electrical, structural, fire, utility, and permitting decisions must follow listed equipment instructions and qualified local review.</p></div>
    {professionalGuide&&<ProfessionalReference guide={professionalGuide}/>}
    {enhancement&&<section className="lesson-section lesson-deep-dive">
      <span className="lesson-kicker">DEEPER EXPLANATION</span>
      <h2>What this means in a real design</h2>
      {enhancement.expanded.map(paragraph=><p key={paragraph}>{paragraph}</p>)}
      <div className="lesson-spec-grid">{enhancement.specs.map(spec=><div key={spec.label}><span>{spec.label}</span><b>{spec.value}</b><p>{spec.detail}</p></div>)}</div>
    </section>}
    {lesson.sections.map(section=><section className="lesson-section" key={section.heading}>
      <h2>{section.heading}</h2>
      {section.paragraphs?.map(paragraph=><p key={paragraph}>{paragraph}</p>)}
      {section.formula&&<div className="lesson-formula"><small>WORKING FORMULA</small><code>{section.formula}</code></div>}
      {section.bullets&&<ul>{section.bullets.map(item=><li key={item}>{item}</li>)}</ul>}
      {section.table&&<div className="lesson-table">{section.table.map((row,rowIndex)=><div className={rowIndex===0?"head":""} key={row.join("-")}>{row.map(cell=><span key={cell}>{cell}</span>)}</div>)}</div>}
      {section.warning&&<div className="lesson-warning"><b>Safety boundary</b><p>{section.warning}</p></div>}
    </section>)}
    {enhancement&&<section className="lesson-field-example">
      <div><span>REAL-LIFE WORKED EXAMPLE</span><h2>{enhancement.example.title}</h2><p>{enhancement.example.scenario}</p></div>
      <ul>{enhancement.example.values.map(value=><li key={value}>{value}</li>)}</ul>
      <div className="lesson-example-result"><small>DESIGN READING</small><p>{enhancement.example.result}</p></div>
    </section>}
    {enhancement&&<section className="lesson-sources">
      <span className="lesson-kicker">VERIFY AND GO DEEPER</span><h2>Primary technical references</h2>
      <p>These links point to government, laboratory, safety-science, test-instrument, or manufacturer documentation used to expand this lesson. Always use the current manual for the exact equipment being installed.</p>
      <div>{enhancement.sources.map(source=><a href={source.href} target="_blank" rel="noreferrer" key={source.href}><small>{source.organization}</small><b>{source.label}</b><span>Open source ↗</span></a>)}</div>
    </section>}
    <div className="lesson-next-action"><div><small>PUT IT TO WORK</small><h3>Document your assumptions before moving on.</h3><p>Record the values, equipment limits, and unanswered questions this lesson creates for your project.</p></div><Link href="/planner">Open system planner -&gt;</Link></div>
  </article>;
}

export default function GuidesPage() {
  const [activeId,setActiveId]=useState(allLessons[0].id);
  const [query,setQuery]=useState("");
  const [visited,setVisited]=useState<string[]>([allLessons[0].id]);
  const activeIndex=allLessons.findIndex(lesson=>lesson.id===activeId);
  const activeLesson=allLessons[activeIndex];
  const groups=[...new Set(allLessons.map(lesson=>lesson.group))];
  const manualCount=new Set(Object.values(professionalGuides).flatMap(guide=>guide.manuals.map(manual=>manual.href))).size;
  const modelExampleCount=new Set(Object.values(professionalGuides).flatMap(guide=>(guide.products||[]).map(product=>`${product.maker}:${product.model}`))).size;
  const filtered=useMemo(()=>allLessons.filter(lesson=>`${lesson.title} ${lesson.group} ${lesson.lead}`.toLowerCase().includes(query.toLowerCase())),[query]);
  function openLesson(id:string){
    setActiveId(id);
    setVisited(old=>old.includes(id)?old:[...old,id]);
    requestAnimationFrame(()=>document.getElementById("lesson-content")?.scrollIntoView({behavior:"smooth",block:"start"}));
  }
  function move(offset:number){
    const target=allLessons[activeIndex+offset];
    if(target)openLesson(target.id);
  }
  return <main className="learn-page">
    <header className="learn-hero">
      <div><div className="eyebrow">SOLAR4U TECHNICAL REFERENCE LIBRARY</div><h1>Learn the basics. <span>Keep the field manual.</span></h1><p>A dense, source-backed library for first-time builders, experienced installers, designers, and licensed electricians—from electrical principles through exact product manuals, mounting families, commissioning, inspection, and long-term operation.</p><div className="learn-hero-actions"><a href="#curriculum">Open curriculum</a><a href="#extra-discussions">Extra discussions</a></div></div>
      <div className="learn-hero-side">
        <figure className="learn-system-figure"><Image src="/learn-system-overview.png" alt="Cutaway overview of a home solar system showing rooftop and ground arrays, inverter, battery bank, critical loads, and utility connection" fill priority sizes="(max-width: 850px) 90vw, 38vw"/><figcaption>One home. Multiple energy paths. Every path needs conversion, control, and protection.</figcaption></figure>
        <div className="learn-overview"><span><b>{allLessons.length}</b> technical chapters</span><span><b>{manualCount}</b> primary manuals</span><span><b>{modelExampleCount}</b> model-reference cards</span><span><b>79</b> supplied PDF pages reviewed</span></div>
      </div>
    </header>
    <nav className="learn-toolbar" aria-label="Learning page sections"><a href="#curriculum">Tutorial</a><a href="#reference">Reference</a><a href="#field-examples">Examples</a><a href="#extra-discussions">Extra Discussions</a><Link href="/calculators">Calculators</Link></nav>
    <div className="learn-shell" id="curriculum">
      <aside className="learn-sidebar">
        <label><span>Search lessons</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="e.g. grounding, batteries"/></label>
        <div className="learn-progress"><div><span style={{width:`${visited.length/allLessons.length*100}%`}}></span></div><small>{visited.length} of {allLessons.length} opened</small></div>
        {groups.map(group=>{
          const groupLessons=filtered.filter(lesson=>lesson.group===group);
          if(!groupLessons.length)return null;
          return <section key={group}><h2>{group}</h2>{groupLessons.map(lesson=><button className={lesson.id===activeId?"active":""} onClick={()=>openLesson(lesson.id)} key={lesson.id}><span>{lesson.number}</span><b>{lesson.title}</b>{visited.includes(lesson.id)&&<i>✓</i>}</button>)}</section>;
        })}
        {!filtered.length&&<p className="learn-empty">No lesson matches that search.</p>}
      </aside>
      <section className="learn-reader">
        <div className="lesson-pager"><button disabled={activeIndex===0} onClick={()=>move(-1)}>‹ Previous</button><span>{activeIndex+1} / {allLessons.length}</span><button disabled={activeIndex===allLessons.length-1} onClick={()=>move(1)}>Next ›</button></div>
        <LessonBody lesson={activeLesson}/>
        <div className="lesson-pager bottom"><button disabled={activeIndex===0} onClick={()=>move(-1)}>‹ Previous lesson</button><button disabled={activeIndex===allLessons.length-1} onClick={()=>move(1)}>Next lesson ›</button></div>
      </section>
      <aside className="learn-reference" id="reference">
        <div><small>QUICK REFERENCE</small><h2>System checks</h2>{["Loads measured","Monthly solar modeled","Cold Voc checked","Conductors sized","Protection coordinated","Diagram updated","Approval confirmed","Commissioning recorded"].map(item=><label key={item}><input type="checkbox"/><span>{item}</span></label>)}</div>
        <div><small>CORE EQUATIONS</small><code>W = V x A</code><code>Wh = W x h</code><code>Wh = V x Ah</code><code>Vdrop = I x R</code></div>
        <div className="source-note"><small>SOURCE FOUNDATION</small><p>Original Solar4U explanations informed by the supplied <cite>The Beginner&apos;s Guide to DIY Solar</cite>, then expanded with {manualCount} current government, laboratory, safety, and manufacturer references. Model examples are identified as examples—not universal endorsements.</p></div>
      </aside>
    </div>
    <section className="learning-workflow" id="field-examples"><div><small>PROJECT WORKFLOW</small><h2>Read in the order your project develops.</h2><p>Move back and forth between the lessons, calculators, system planner, and diagram tool. A real design is iterative.</p></div><ol>{[["01","Measure","Loads, site, climate, constraints"],["02","Model","PV, storage, surge, cash flow"],["03","Design","Strings, conductors, protection, layout"],["04","Review","Manufacturer, code, utility, permits"],["05","Build","Mount, label, torque, document"],["06","Commission","Test, record, maintain, revise"]].map(([number,title,copy])=><li key={number}><span>{number}</span><b>{title}</b><p>{copy}</p></li>)}</ol></section>
    <section className="extra-discussions" id="extra-discussions">
      <div className="extra-heading"><div><small>EXTRA DISCUSSIONS</small><h2>Go deeper on the edge cases.</h2></div><p>Curated technical follow-ups from the 13-page Clever Solar Power blog archive. These links open the original articles; summaries below are Solar4U&apos;s own orientation notes.</p></div>
      <div className="discussion-filters">{[...new Set(discussions.map(item=>item.tag))].map(tag=><span key={tag}>{tag}</span>)}</div>
      <div className="discussion-grid">{discussions.map((discussion,index)=><a href={discussion.href} target="_blank" rel="noreferrer" key={discussion.href}><div><span>{discussion.tag}</span><i>{String(index+1).padStart(2,"0")}</i></div><h3>{discussion.title}</h3><p>{discussion.summary}</p><b>Read original discussion ↗</b></a>)}</div>
      <div className="external-source"><p>Browse the complete source archive for additional reviews, wiring examples, battery configurations, and controller topics.</p><a href="https://cleversolarpower.com/blog/" target="_blank" rel="noreferrer">Visit Clever Solar Power blog ↗</a></div>
    </section>
  </main>;
}
