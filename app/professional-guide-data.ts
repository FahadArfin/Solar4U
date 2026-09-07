export type GuideVisual = {
  src: string;
  alt: string;
  caption: string;
  note: string;
};

export type GuideManual = {
  organization: string;
  title: string;
  href: string;
  focus: string;
  revision?: string;
};

export type GuideProduct = {
  maker: string;
  model: string;
  role: string;
  specs: string[];
  useWhen: string;
  limitation: string;
  href: string;
};

export type GuideTable = {
  title: string;
  description?: string;
  columns: string[];
  rows: string[][];
};

export type ProfessionalGuide = {
  summary: string;
  audience: string;
  visuals: GuideVisual[];
  objectives: string[];
  referenceSections: {
    title: string;
    paragraphs: string[];
    bullets?: string[];
  }[];
  tables?: GuideTable[];
  procedure?: { title: string; steps: string[] };
  products?: GuideProduct[];
  manuals: GuideManual[];
  fieldCase?: {
    title: string;
    scenario: string;
    evidence: string[];
    response: string;
  };
  reviewed: string;
};

const visuals = {
  system: {
    src: "/learn-system-overview.png",
    alt: "Cutaway overview of a home with rooftop and ground-mounted solar, storage, conversion equipment, loads, and a grid connection",
    caption: "System anatomy: sources, conversion, storage, protection, distribution, loads, and the utility interface.",
    note: "Original Solar4U conceptual illustration. It explains equipment relationships; it is not an installation drawing.",
  },
  module: {
    src: "/learn-module-anatomy.png",
    alt: "Exploded conceptual view of photovoltaic module glass, encapsulation, cells, back layer, frame, junction box, and leads",
    caption: "Module anatomy: glass, encapsulant, cell circuit, rear layer, frame, junction box, bypass paths, and leads.",
    note: "Original Solar4U conceptual visualization. Exact construction, junction-box layout, and connectors vary by model.",
  },
  equipment: {
    src: "/learn-equipment-wall.png",
    alt: "Conceptual solar equipment wall with hybrid inverter, controller, battery rack, disconnects, protected busbars, and distribution panels",
    caption: "A serviceable equipment wall separates sources, conversion equipment, batteries, protection, monitoring, and distribution.",
    note: "Original Solar4U conceptual photograph. Use the selected manufacturers’ clearance and wiring instructions for an actual layout.",
  },
  tools: {
    src: "/learn-tools-workbench.png",
    alt: "Top-down workbench with solar electrical test instruments, crimping tools, torque tools, cable tools, connector tools, labels, and PPE",
    caption: "Tool families: measurement, connector preparation, terminal crimping, controlled torque, labeling, isolation, and PPE.",
    note: "Original Solar4U editorial photograph. Objects illustrate tool categories, not certified models or a universal kit.",
  },
  hardware: {
    src: "/learn-mounting-hardware.png",
    alt: "Top-down conceptual collection of rails, splices, clamps, flashing, roof hooks, seam hardware, wire clips, grounding hardware, and fasteners",
    caption: "Mounting hardware taxonomy: rails and splices, module clamps, roof interfaces, bonding parts, wire support, and fasteners.",
    note: "Original Solar4U conceptual photograph. These are not dimensionally exact manufacturer components; use the linked product manual.",
  },
  mountTypes: {
    src: "/learn-mounting-types.png",
    alt: "Four conceptual solar installations showing pitched-roof, fixed ground, top-of-pole, and pergola mounting",
    caption: "Four different structural problems: pitched roof, fixed ground rack, top-of-pole mount, and an occupied solar canopy.",
    note: "Original Solar4U conceptual visualization. Engineering determines actual members, foundations, attachments, and spans.",
  },
} satisfies Record<string, GuideVisual>;

const manuals = {
  doePv: {
    organization: "U.S. Department of Energy",
    title: "Solar Photovoltaic System Design Basics",
    href: "https://www.energy.gov/cmei/systems/solar-photovoltaic-system-design-basics",
    focus: "PV components, system architectures, and design context",
  },
  pvwatts: {
    organization: "NREL",
    title: "PVWatts V8 API and model fields",
    href: "https://developer.nlr.gov/docs/solar/pvwatts/v8/",
    focus: "Location-aware monthly and annual production modeling",
    revision: "V8",
  },
  sandia: {
    organization: "Sandia PVPMC",
    title: "PV Performance Modeling Collaborative",
    href: "https://pvpmc.sandia.gov/modeling-guide/",
    focus: "Professional PV performance and I-V modeling",
  },
  wiring: {
    organization: "Victron Energy",
    title: "Wiring Unlimited",
    href: "https://www.victronenergy.com/media/pg/The_Wiring_Unlimited_book/en/index-en.html",
    focus: "Battery banks, DC conductors, protection, AC wiring, and grounding",
  },
  om: {
    organization: "NREL",
    title: "Best Practices for PV and Energy Storage O&M",
    href: "https://www.nrel.gov/docs/fy19osti/73822.pdf",
    focus: "Commissioning records, preventive maintenance, diagnostics, and lifecycle management",
    revision: "3rd edition",
  },
  ulEss: {
    organization: "UL Solutions",
    title: "Energy Storage System Testing and Certification",
    href: "https://www.ul.com/services/energy-storage-system-testing-and-certification",
    focus: "UL 9540 system certification and related battery/inverter safety standards",
  },
  oshaElectrical: {
    organization: "OSHA",
    title: "Solar Energy: Electrical Safety",
    href: "https://www.osha.gov/green-jobs/solar/electrical",
    focus: "Shock, electrocution, arc-flash, and PV source hazards",
  },
  oshaLoto: {
    organization: "OSHA",
    title: "Solar Energy: Lockout/Tagout",
    href: "https://www.osha.gov/green-jobs/solar/lockout-tagout",
    focus: "Control of PV, grid, battery, generator, and stored energy",
  },
  oshaFalls: {
    organization: "OSHA",
    title: "Solar Energy: Falls",
    href: "https://www.osha.gov/green-jobs/solar/falls",
    focus: "Roof access, fall protection, and solar installation hazards",
  },
  flukeAbsence: {
    organization: "Fluke",
    title: "Absence-of-voltage testing",
    href: "https://www.fluke.com/en-us/learn/blog/electrical/absence-of-voltage-testing",
    focus: "Live-dead-live instrument verification and test workflow",
  },
  staubliTools: {
    organization: "Stäubli",
    title: "PV connector tools and assembly equipment",
    href: "https://www.staubli.com/content/dam/ecs/catalogs-brochures/RE/SOL-PVTools-11014090-en.pdf",
    focus: "Matched contacts, cable, dies, locators, crimpers, and torque tools",
  },
  staubliAssembly: {
    organization: "Stäubli",
    title: "PV crimping-tool assembly instructions MA704",
    href: "https://www.staubli.com/content/dam/ecs/technical-documentation/assembly-instructions/RE/PV_MA704-en.pdf",
    focus: "Connector-family-specific preparation, crimping, inspection, and assembly",
    revision: "MA704",
  },
  ironridgeRoof: {
    organization: "IronRidge",
    title: "XR Flush Mount Installation Manual",
    href: "https://files.ironridge.com/pitched-roof-mounting/resources/brochures/IronRidge_Flush_Mount_Installation_Manual.pdf",
    focus: "Rails, attachments, clamps, bonding, wire management, and current torque tables",
    revision: "v5.2 / 2026",
  },
  ironridgeGround: {
    organization: "IronRidge",
    title: "Ground Mount Installation Manual",
    href: "https://files.ironridge.com/groundmounting/brochures/IronRidge_Ground_Mount_Installation_Manual.pdf",
    focus: "Pipe-frame foundations, braces, rails, bonding, and module mounting",
    revision: "v4.9 / 2026",
  },
  uniracSolarMount: {
    organization: "Unirac",
    title: "SolarMount Installation Guide",
    href: "https://unirac.com/document/solarmount-install-guide/",
    focus: "Rail-based pitched-roof components and installation sequence",
  },
  snapUltra: {
    organization: "SnapNrack",
    title: "Ultra Rail Installation Manual",
    href: "https://res.cloudinary.com/summitpoint/image/upload/v1772487360/SNR_Ultra_Rail_Installation_Manual_v_4_6_1_b751987632.pdf",
    focus: "Attachments, Ultra Rail components, splices, clamps, and wire management",
    revision: "v4.6.1",
  },
  s5Pvkit: {
    organization: "S-5!",
    title: "PVKIT 2.0 Installation Guide",
    href: "https://f.hubspotusercontent00.net/hubfs/3482954/Resources/Product%20Documents/Solar/PVKIT%202.0/pvkit-2-0-installation.pdf",
    focus: "Direct attachment on compatible standing-seam clamps",
    revision: "2025",
  },
  tamarackGround: {
    organization: "Tamarack Solar",
    title: "Ground Mount System Installation Manual",
    href: "https://tamaracksolar.com/wp-content/uploads/Tamarack-Solar-Ground-Mount-System-Installation-Manual.pdf",
    focus: "Pipe-frame layout, foundations, rails, bonding, and modules",
    revision: "REV8b1",
  },
  mtSolar: {
    organization: "MT Solar",
    title: "Beam Series pole-mount manual",
    href: "https://www.mtsolar.us/wp-content/uploads/2025/02/MT-Solar-Beam-Series-Manual-0225.pdf",
    focus: "Pole selection, ground-level assembly, hoisting, bracing, and seasonal tilt",
    revision: "February 2025",
  },
  solarApp: {
    organization: "U.S. Department of Energy",
    title: "Permitting and Inspection for Rooftop Solar",
    href: "https://www.energy.gov/cmei/systems/permitting-and-inspection-rooftop-solar",
    focus: "Permit, inspection, utility review, and permission-to-operate sequence",
  },
} satisfies Record<string, GuideManual>;

const panelProducts: GuideProduct[] = [
  {
    maker: "Qcells",
    model: "Q.TRON BLK M-G2+ 440",
    role: "Residential module example",
    specs: ["440 W", "Voc 39.88 V", "Vmp 33.33 V", "Isc 13.90 A", "Imp 13.20 A", "22.5%"],
    useWhen: "Teaching a conventional residential string calculation and temperature-corrected Voc.",
    limitation: "The exact 415-440 W model and current module installation manual determine clamp zones, loads, connectors, and compatibility.",
    href: "https://us.qcells.com/wp-content/uploads/2024/08/Qcells_Data_sheet_Q.TRON_BLK_M-G2_series_415-440_2024-08_Rev04_NA.pdf",
  },
  {
    maker: "REC",
    model: "Alpha Pure-RX 470",
    role: "High-voltage module example",
    specs: ["470 W", "Voc 65.6 V", "Vmp 55.4 V", "Isc 8.95 A", "Imp 8.49 A", "22.6%"],
    useWhen: "Comparing high-voltage, lower-current module behavior and microinverter input compatibility.",
    limitation: "Four bypass-diode regions and unusual voltage require an exact input-window check; watts alone do not establish compatibility.",
    href: "https://www.recgroup.com/sites/default/files/2024-06/ds_rec_alpha_pure-rx_series_iec_eng_web.pdf",
  },
  {
    maker: "Maxeon",
    model: "Maxeon 7 445",
    role: "Premium-efficiency example",
    specs: ["Up to 445 W", "Up to 24.1%", "25 A maximum series fuse", "1000 V system rating"],
    useWhen: "Comparing efficiency, mechanical specifications, and product versus performance warranty language.",
    limitation: "Warranty availability and terms vary by market; verify the locally supplied model and installation document.",
    href: "https://sunpower.maxeon.com/int/sites/default/files/2024-03/sp_max7_112c_PT_435-445_res_dc_40years_warranty_ds_en_a4_551184A.v4.pdf",
  },
];

const controllerProducts: GuideProduct[] = [
  {
    maker: "Victron Energy",
    model: "SmartSolar MPPT 150/45",
    role: "Low-voltage battery MPPT",
    specs: ["12/24/36/48 V battery", "150 V absolute PV maximum", "145 V operating ceiling", "45 A output", "50 A PV Isc"],
    useWhen: "A small or medium low-voltage battery system fits both the cold-Voc and warm-Vmp operating envelope.",
    limitation: "The 150 V absolute maximum is not a target. Nominal PV power, input current, temperature, and battery acceptance still govern.",
    href: "https://www.victronenergy.com/upload/documents/Manual_SmartSolar_MPPT_150-35__150-45/29694-MPPT_solar_charger_manual-pdf-en.pdf",
  },
  {
    maker: "Morningstar",
    model: "TriStar MPPT 600V",
    role: "High-voltage PV to 48 V battery controller",
    specs: ["600 V maximum Voc", "100-525 V operating range", "15 A operating input", "60 A output", "3.2 kW nominal at 48 V"],
    useWhen: "Longer high-voltage PV circuits are intentionally designed for a supported 48 V battery system.",
    limitation: "High voltage changes work practices and equipment requirements; use Morningstar’s string calculator and exact manual.",
    href: "https://www.morningstarcorp.com/products/tristar-mppt-600v/",
  },
  {
    maker: "MidNite Solar",
    model: "Classic 150",
    role: "Configurable standalone MPPT",
    specs: ["150 V operating family", "12-72 V battery", "Output varies by battery voltage and operating point", "Arc-fault options by model"],
    useWhen: "A configurable off-grid system benefits from MidNite’s sizing tools, logging, and supported battery voltages.",
    limitation: "HyperVOC is a protective region, not a normal design region. Confirm the exact Classic model and current manual.",
    href: "https://www.midnitesolar.com/documents.php?act=info&model=CLASSIC+150&productCat_ID=21&product_ID=256",
  },
  {
    maker: "OutBack Power",
    model: "FLEXmax 100 AFCI",
    role: "300 V standalone MPPT",
    specs: ["300 V maximum Voc", "100 A output", "24/36/48 V battery", "Integrated AFCI"],
    useWhen: "A listed OutBack architecture needs a higher-voltage PV input and integrated arc-fault function.",
    limitation: "Published PV power and current limits vary with battery voltage and configuration.",
    href: "https://www.outbackpower.com/downloads/documents/charge_controllers/flexmax_100_afci/fm100_afci_manual.pdf",
  },
];

const inverterProducts: GuideProduct[] = [
  {
    maker: "Enphase",
    model: "IQ8X",
    role: "High-voltage module microinverter",
    specs: ["43-60 V MPPT", "79.5 V maximum DC", "10 A continuous DC", "13 A maximum module Isc", "380 VA"],
    useWhen: "A module passes Enphase’s exact voltage, current, power, and compatibility checks.",
    limitation: "A 440 W module can still fail compatibility when Isc exceeds 13 A. Module wattage alone is insufficient.",
    href: "https://enphase.com/en-ca/download/iq8x-microinverter-data-sheet",
  },
  {
    maker: "EG4",
    model: "18kPV",
    role: "Low-voltage hybrid inverter",
    specs: ["18 kW PV input", "12 kW continuous AC", "Three MPPTs", "100-600 V DC", "120/240 V split phase"],
    useWhen: "A residential hybrid architecture needs integrated PV, 48 V-class storage, grid, generator, and backup functions.",
    limitation: "Use approved battery communications, current wiring diagrams, service calculations, and utility/AHJ review.",
    href: "https://eg4electronics.com/categories/inverters/eg4-18kpv-12lv-all-in-one-hybrid-inverter",
  },
  {
    maker: "SMA",
    model: "Sunny Boy Smart Energy US",
    role: "Grid-interactive hybrid family",
    specs: ["3.84-11.52 kW family", "Three or four PV inputs by model", "Approved-battery list", "Grid and backup functions by design"],
    useWhen: "A listed grid-interactive design is built around SMA’s exact inverter and approved battery ecosystem.",
    limitation: "Model suffix, battery approval, transfer equipment, service configuration, and utility rules govern.",
    href: "https://files.sma.de/downloads/SBSExx-US-50-BE-en-10.pdf",
  },
  {
    maker: "SolarEdge",
    model: "Home Hub",
    role: "Optimizer-based hybrid family",
    specs: ["3.8-11.4 kW models", "480 V maximum input", "395 V nominal DC at 240 V", "Optimizer ecosystem"],
    useWhen: "A residential design intentionally uses compatible SolarEdge optimizers, batteries, and backup equipment.",
    limitation: "This is a system architecture, not a generic string inverter. Exact optimizer and battery compatibility are mandatory.",
    href: "https://knowledge-center.solaredge.com/sites/kc/files/se-home-hub-inverter-single-phase-inverter-made-in-usa-datasheet-nam.pdf",
  },
];

const toolProducts: GuideProduct[] = [
  {
    maker: "Fluke",
    model: "393 FC",
    role: "High-voltage PV clamp meter",
    specs: ["CAT III 1500 V", "CAT IV 600 V", "1500 Vdc", "999.9 A AC/DC jaw", "IP54"],
    useWhen: "Utility-scale, commercial, or high-voltage PV measurements require a 1500 V-rated clamp instrument.",
    limitation: "The flexible iFlex accessory measures AC only; clamp accuracy and conductor position still matter.",
    href: "https://www.fluke.com/en-us/product/electrical-testing/clamp-meters/393-fc",
  },
  {
    maker: "Fluke",
    model: "283 FC",
    role: "High-voltage digital multimeter",
    specs: ["CAT III 1500 V", "CAT IV 1000 V", "IP52", "Optional 60 A AC/DC wireless clamp"],
    useWhen: "Precise PV voltage, polarity, resistance, logging, and remote current correlation are needed.",
    limitation: "It is not itself a high-current clamp meter; test-lead and environment ratings must match the instrument.",
    href: "https://www.fluke.com/en-us/product/electrical-testing/digital-multimeters/283-fc-digital-multimeter",
  },
  {
    maker: "Klein Tools",
    model: "CL800",
    role: "Residential AC/DC clamp meter",
    specs: ["600 A AC/DC", "1000 V", "CAT IV 600 V", "CAT III 1000 V", "True RMS + LoZ"],
    useWhen: "Residential 1000 V-and-below work needs an affordable AC/DC clamp meter.",
    limitation: "IP40 and not rated for 1500 V PV. Select a different tool for higher-energy or harsher environments.",
    href: "https://www.kleintools.com/catalog/clamp-meters/digital-clamp-meter-ac-auto-range-trms-low-impedance-loz-auto",
  },
  {
    maker: "Fluke",
    model: "SMFT-1000",
    role: "PV commissioning analyzer",
    specs: ["5-1000 V Voc", "0.2-20 A Isc", "I-V curves", "Insulation resistance", "Protective-conductor continuity"],
    useWhen: "IEC 62446-style commissioning and array performance documentation need an integrated analyzer.",
    limitation: "Respect the 1000 V and 20 A limits and isolate sensitive electronics for the tests that require it.",
    href: "https://www.fluke.com/en-us/product/electrical-testing/best-solar-energy-industry-tools/smft-1000-pv-tester",
  },
  {
    maker: "Stäubli",
    model: "PV-CZM-61100 / PV-WZ-TORQUE-SET",
    role: "Connector-family crimp and torque tools",
    specs: ["14/12/10 AWG crimp family", "Dedicated locator", "3-6 N·m torque set", "Matched contacts and cable"],
    useWhen: "Assembling the exact Stäubli connector/contact/cable system covered by the current instructions.",
    limitation: "Not a universal MC4 tool. Connector family, contact, cable OD, die, locator, strip length, and torque must match.",
    href: "https://www.staubli.com/content/dam/ecs/catalogs-brochures/RE/SOL-PVTools-11014090-en.pdf",
  },
  {
    maker: "Knipex",
    model: "95 18 200 SBA",
    role: "Insulated PV cable shears",
    specs: ["1000 V insulated", "Copper/aluminum through 2/0 AWG", "Twin cutting edges"],
    useWhen: "Cleanly cutting compatible copper or aluminum cable after it has been de-energized.",
    limitation: "Not for steel and never a justification to cut energized conductors.",
    href: "https://www.knipex-tools.com/products/cable-and-wire-rope-shears/cable-shears/cable-shears-twin-cutting-edges-1000v-insulated/9518200SBA",
  },
  {
    maker: "Wera",
    model: "Kraftform Kompakt VDE 16 Torque",
    role: "Insulated terminal torque driver",
    specs: ["1.2-3.0 N·m range", "IEC 60900", "Slim VDE blades"],
    useWhen: "An equipment terminal’s current manual specifies a value within the tool’s calibrated range.",
    limitation: "It does not replace a connector-family torque tool and is not suitable outside its stated range.",
    href: "https://www.wera.de/en/tools/kraftform-kompakt-vde-16-torque-12-30-nm-extra-slim-1-tool-finder/",
  },
  {
    maker: "Burndy",
    model: "MY2911C",
    role: "Manual battery-lug crimper",
    specs: ["#8-250 kcmil code copper", "#8-4/0 flexible copper", "Dieless mechanical tool"],
    useWhen: "Lower-volume professional crimping uses compatible listed Burndy connectors and the documented conductor class.",
    limitation: "An arbitrary lug and cable do not become a verified connection because the tool can physically compress them.",
    href: "https://www.hubbell.com/burndy/en/products/dieless-mechanical-crimper-covered-handles-8-str-250-kcmil-copper-code-8-str-40-str-copper-flex-30-navy-250-navy-copper-navy-cable/p/511891",
  },
  {
    maker: "3M",
    model: "SecureFit SF601SGAF",
    role: "Impact-rated eye protection example",
    specs: ["ANSI/ISEA Z87.1 impact", "U6 UV marking", "Anti-fog coating"],
    useWhen: "Routine assessed impact and UV exposure requires compliant safety glasses.",
    limitation: "Safety glasses do not replace arc-rated face protection or goggles where the hazard assessment requires them.",
    href: "https://www.3m.com/3M/en_US/p/dc/v000525303/",
  },
];

const mountingProducts: GuideProduct[] = [
  {
    maker: "IronRidge",
    model: "XR Flush Mount",
    role: "Rail-based pitched-roof family",
    specs: ["XR10 / XR100 / XR1000 rails", "UFO/EFO clamps", "FlashFoot2 and roof-specific attachments", "UL 2703 system"],
    useWhen: "A rail-based design needs broad roof and module options supported by the current Design Assistant.",
    limitation: "Rail, attachment spacing, cantilever, clamp zones, torque, roof zones, and loads are project-specific.",
    href: "https://www.ironridge.com/pitched-roofs/xr-flush-mount-for-pitched-roofs/",
  },
  {
    maker: "Unirac",
    model: "SolarMount",
    role: "Rail-based pitched-roof family",
    specs: ["Multiple rail sizes", "Roof-specific attachments", "Module clamps and bonding", "Design-tool workflow"],
    useWhen: "A familiar rail platform is intentionally designed using Unirac’s current engineering documents.",
    limitation: "Do not transfer spans, attachments, or torque values from another Unirac family or an old manual.",
    href: "https://unirac.com/products/pitched-roof/solarmount/",
  },
  {
    maker: "SnapNrack",
    model: "Ultra Rail",
    role: "Compact rail-based roof mount",
    specs: ["UR-40 / UR-45 rail", "SpeedSeal and flashed attachment families", "Wide-seam clamp", "Integrated wire-management options"],
    useWhen: "A pitched roof is designed around SnapNrack’s compatible attachments, rail, clamps, and current manual.",
    limitation: "Attachment, splice, clamp, and grounding torque values are component-specific.",
    href: "https://www.snapnrack.com/ultra-rail-roof-mount-system",
  },
  {
    maker: "EcoFasten",
    model: "RockIt",
    role: "Rail-less pitched-roof system",
    specs: ["Mount and coupling architecture", "Integrated bonding", "Module-level layout", "MLPE attachment option"],
    useWhen: "A rail-less design is compatible with the exact module and roof layout.",
    limitation: "Rail-less systems demand precise layout and affect module replacement, thermal movement, and row alignment.",
    href: "https://ecofastensolar.com/system/rockit/",
  },
  {
    maker: "S-5!",
    model: "PVKIT 2.0",
    role: "Standing-seam direct attach",
    specs: ["Rail-less module attachment", "Profile-specific S-5! clamps", "UL 2703 / UL 3741 configurations", "No roof penetration when correctly matched"],
    useWhen: "The exact roof seam, metal, gauge, concealed clips, and approved clamp/system have been verified.",
    limitation: "Clamp capacity alone does not establish the standing-seam roof panel or concealed-clip capacity.",
    href: "https://www.s-5.com/products/solar-panels-on-metal-roof-pvkit-2-0/",
  },
  {
    maker: "IronRidge",
    model: "BX Ballasted",
    role: "Ballasted low-slope roof system",
    specs: ["Wind-tunnel-engineered platform", "Low-slope roof application", "Site-specific ballast map", "Membrane interface"],
    useWhen: "A structural and roofing review supports the exact site-specific ballast and attachment design.",
    limitation: "Never move or substitute ballast. Roof zones, parapets, drainage, seismic, membrane, and structural reserve govern.",
    href: "https://www.ironridge.com/flat-roofs/ballasted/",
  },
  {
    maker: "Tamarack Solar",
    model: "Ground Mount System",
    role: "Pipe-frame fixed ground mount",
    specs: ["Pipe-based substructure", "Adjustable site layout", "Rail adapters and bonding", "Residential/off-grid scale"],
    useWhen: "A site-specific foundation and pipe schedule is established from wind, snow, frost, soil, and corrosion inputs.",
    limitation: "The manual is not a universal footing design. Utilities, geotechnical conditions, drainage, and engineering govern.",
    href: "https://tamaracksolar.com/products/ground-mounting-system/",
  },
  {
    maker: "MT Solar",
    model: "Beam Series",
    role: "Adjustable top-of-pole mount",
    specs: ["Ground-level assembly concept", "Hoistable array head", "Seasonal tilt", "Multiple array sizes"],
    useWhen: "The manufacturer-selected pole, foundation, beam configuration, lift method, and site loads are followed.",
    limitation: "Pole mounts create large overturning moments; foundation, hoisting, conductor movement, and wind-safe adjustment require engineering.",
    href: "https://www.mtsolar.us/install-guides/",
  },
  {
    maker: "Lumos Solar",
    model: "Architectural canopy systems",
    role: "Pergola and canopy PV",
    specs: ["Bifacial glass modules", "Architectural framing", "Overhead application", "Water-management options by system"],
    useWhen: "An engineered occupied structure is intentionally designed for shade, weather behavior, fire access, and PV.",
    limitation: "Ordinary modules and racking do not automatically create a watertight roof or a permitted occupied structure.",
    href: "https://lumossolar.com/",
  },
];

const commonObjectives = {
  design: [
    "Separate a planning estimate from an engineered or permitted design.",
    "Locate the controlling nameplate field, manual section, and revision for every limit.",
    "Record assumptions so a result can be reproduced after equipment or weather data changes.",
  ],
  field: [
    "Recognize the system boundary before measuring, opening, disconnecting, or changing a component.",
    "Use the selected manufacturer’s current procedure rather than a generic sequence.",
    "Capture an as-built record that another qualified person can understand.",
  ],
};

export const professionalGuides: Record<string, ProfessionalGuide> = {
  "solar-flow": {
    summary: "Map every source, conversion stage, storage element, protective boundary, distribution point, control link, and operating mode before selecting hardware.",
    audience: "Foundation through system-design reference",
    visuals: [visuals.system, visuals.equipment],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "Normal, outage, and shutdown are different one-lines",
        paragraphs: [
          "A useful architecture drawing shows more than a single arrow from panels to loads. It identifies which contacts are open or closed, which bus is grid-forming, which loads are backed up, where metering occurs, and how communications coordinate the battery, inverter, transfer equipment, and utility interface.",
          "During an outage, an interactive inverter must not energize the utility. A hybrid system may establish a local grid for a critical-load panel while regulating PV production and battery state of charge. During shutdown, PV conductors can remain energized wherever illumination and equipment topology allow.",
        ],
        bullets: ["Solar-only grid tie", "Microinverter with backup controller", "Low-voltage DC-coupled hybrid", "AC-coupled retrofit", "Standalone inverter/charger", "High-voltage battery hybrid"],
      },
    ],
    tables: [{
      title: "Architecture questions",
      columns: ["Boundary", "Question a professional drawing must answer"],
      rows: [
        ["PV", "Which strings or module-level devices feed each tracker or AC branch?"],
        ["Battery", "What establishes charge/discharge limits, pre-charge, isolation, and communications?"],
        ["AC", "Which bus is grid-forming, which circuits are backed up, and where is neutral-ground bonding controlled?"],
        ["Utility", "Where are the service point, meter, disconnect, export control, and anti-islanding functions?"],
      ],
    }],
    procedure: { title: "Architecture review", steps: ["Draw the normal energy path.", "Draw the outage state separately.", "Mark every source and isolation point.", "Add protection ratings and conductor identifiers.", "Add communications and control dependencies.", "Review shutdown and recovery behavior.", "Issue an as-built revision after commissioning."] },
    manuals: [manuals.doePv, manuals.wiring, manuals.om],
    reviewed: "2026-07-30",
  },
  "electrical-language": {
    summary: "Use consistent electrical quantities and test conditions so watts, volt-amps, watt-hours, current, and nameplate boundary values are never mixed.",
    audience: "Foundation with professional calculation notes",
    visuals: [visuals.module, visuals.tools],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "Quantities belong to operating conditions",
        paragraphs: [
          "A 5 kW inverter describes a rate of conversion; a 5 kWh battery describes stored energy. A motor can draw modest real power during normal operation but demand much higher current and apparent power during starting. A module’s Voc and Isc are boundary test values, while Vmp and Imp describe a maximum-power operating point under stated conditions.",
          "Resistance creates voltage drop and heat. Because conductor heating follows current squared, raising DC bus voltage can materially reduce current for a fixed power transfer, but voltage class, shock protection, switching, and equipment compatibility also change.",
        ],
      },
    ],
    tables: [{
      title: "Do not interchange these values",
      columns: ["Quantity", "Unit", "Design use"],
      rows: [["Real power", "W / kW", "Continuous load and generation rate"], ["Apparent power", "VA / kVA", "AC conductor, inverter, transformer, and generator behavior"], ["Energy", "Wh / kWh", "Production, consumption, and autonomy"], ["Charge", "Ah", "Battery capacity only when voltage is stated"], ["Resistance", "Ω", "Voltage drop and heating"], ["Frequency", "Hz", "AC source and equipment compatibility"]],
    }],
    manuals: [manuals.doePv, manuals.wiring],
    reviewed: "2026-07-30",
  },
  "component-map": {
    summary: "Treat the balance of system as a compatibility chain: electrical ratings, environmental ratings, listings, terminals, communications, and current manufacturer instructions must align.",
    audience: "Equipment selection and plan review",
    visuals: [visuals.equipment, visuals.module],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "Nameplate-to-nameplate compatibility",
        paragraphs: [
          "Start at the module and trace maximum voltage, operating voltage, short-circuit current, operating current, power, connector family, conductor range, and environmental conditions through every device. Repeat the exercise from the battery toward the inverter and every charging source.",
          "A component can be individually listed yet incompatible with the system around it. The approved battery list, module compatibility tool, racking/module listing, connector family, terminal conductor class, communication protocol, and firmware version can all be controlling constraints.",
        ],
      },
    ],
    products: [...panelProducts, ...controllerProducts.slice(0, 2), ...inverterProducts.slice(0, 2)],
    manuals: [manuals.doePv, manuals.ulEss, manuals.wiring],
    reviewed: "2026-07-30",
  },
  "load-audit": {
    summary: "Build separate energy, coincident-demand, inrush, voltage/phase, and criticality models instead of sizing a system from monthly billing kWh alone.",
    audience: "System sizing and resilience planning",
    visuals: [visuals.equipment],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "From utility interval data to an outage load schedule",
        paragraphs: [
          "Use 12-24 months of bills for seasonal context and obtain 15-, 30-, or 60-minute interval data when available. Then measure or document cycling and motor loads whose nameplates do not describe daily energy. Build a separate outage schedule because conservation, heating, water, and communications priorities change when the grid is unavailable.",
          "Do not use a universal motor-surge multiplier. Prefer manufacturer locked-rotor/inrush data, measured starting current, and the inverter’s surge curve with duration and battery-voltage conditions.",
        ],
      },
    ],
    tables: [{
      title: "Professional load-audit fields",
      columns: ["Field", "Why it matters"],
      rows: [["Measured W and VA", "Separates real energy from apparent-power loading"], ["Runtime / duty cycle", "Converts a load into daily and monthly energy"], ["Coincident window", "Builds the inverter continuous-demand timeline"], ["Startup current and duration", "Checks inverter surge and battery power"], ["120/240 V and phase", "Determines topology and distribution"], ["Criticality", "Separates backed-up and discretionary circuits"], ["Season", "Captures HVAC, pumping, and weather variation"]],
    }],
    fieldCase: { title: "Well pump inside a modest daily load", scenario: "A refrigerator, lights, network equipment, furnace blower, and well pump total 5.5 kWh/day.", evidence: ["Normal overlap is only 1.2 kW.", "The pump has a short measured 4.1 kVA starting event.", "The battery can supply enough daily energy but one module’s BMS limit is below the inverter’s required DC surge."], response: "Size energy and power independently. Check inverter surge duration, DC voltage at low state of charge, aggregate BMS current, conductor path, and generator/load-management alternatives." },
    manuals: [manuals.doePv, manuals.pvwatts],
    reviewed: "2026-07-30",
  },
  "array-sizing": {
    summary: "Use monthly plane-of-array weather modeling, documented losses, DC/AC ratio, clipping, and a recovery strategy rather than annual peak-sun-hour arithmetic alone.",
    audience: "Production modeling and array design",
    visuals: [visuals.module],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "PVWatts for screening; SAM and PVPMC for deeper work",
        paragraphs: [
          "PVWatts V8 can return monthly plane-of-array irradiance, DC energy, AC energy, annual energy, capacity factor, station metadata, and hourly results. Record tilt, azimuth, array type, DC/AC ratio, inverter efficiency, albedo, soiling, and each loss assumption with the result.",
          "A typical meteorological year is a representative model input, not a prediction for the next winter. Add local horizon shade, snow behavior, row spacing, roof-face separation, module temperature, availability, and equipment-specific clipping where the project warrants it.",
        ],
      },
    ],
    tables: [{
      title: "Model layers",
      columns: ["Layer", "Question"],
      rows: [["Weather", "Which station/dataset, period, and distance represent the site?"], ["Geometry", "What tilt, azimuth, tracking, row spacing, and horizon apply?"], ["DC array", "Which module model, temperature behavior, mismatch, wiring, and soiling apply?"], ["Inverter", "What DC/AC ratio, efficiency, clipping, and temperature derating apply?"], ["Availability", "What outages, curtailment, snow, maintenance, and communications loss apply?"]],
    }],
    manuals: [manuals.pvwatts, manuals.sandia, manuals.om],
    reviewed: "2026-07-30",
  },
  "battery-sizing": {
    summary: "Check usable energy, continuous and surge power, charge acceptance, temperature, reserve, degradation, communication, and recharge capacity as separate constraints.",
    audience: "Storage planning and professional compatibility review",
    visuals: [visuals.equipment, visuals.system],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "Energy sufficiency does not prove power sufficiency",
        paragraphs: [
          "Compute energy from the critical-load profile, autonomy days, reserve, and conversion efficiency. Then independently compute worst-case DC current at the battery’s minimum operating voltage. The battery bank, BMS, branch fuses, busbars, cables, inverter, and terminals must all support the continuous and transient demand.",
          "Do not subtract depth of discharge twice when a manufacturer already publishes usable energy. Add low-temperature charge restrictions, environmental control, calendar aging, cycle behavior, closed-loop compatibility, and the expected recovery source.",
        ],
      },
    ],
    tables: [{
      title: "Battery decision variables",
      columns: ["Variable", "Required evidence"],
      rows: [["Nominal / usable energy", "Current manufacturer specification and reserve policy"], ["Continuous / surge current", "BMS and cell limits with duration and temperature"], ["Charge acceptance", "Aggregate solar, grid, generator, and alternator charging"], ["Environment", "Operating, charging, storage, enclosure, and heater limits"], ["Communication", "Approved inverter/BMS protocol, firmware, and wiring"], ["Certification", "Component and integrated ESS listing required by the project"]],
    }],
    manuals: [manuals.ulEss, manuals.wiring],
    reviewed: "2026-07-30",
  },
  "inverter-controller-sizing": {
    summary: "Evaluate each MPPT and the inverter/battery interface as an operating envelope, not a single watts comparison.",
    audience: "Advanced equipment selection",
    visuals: [visuals.equipment, visuals.module],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "The five controller checks",
        paragraphs: [
          "For each tracker, verify cold-corrected Voc below the absolute maximum, hot Vmp above the tracking/start threshold, operating and short-circuit current limits, permitted array power/oversizing, and output current accepted by the battery. Repeat by tracker when orientations or strings differ.",
          "For an inverter, verify continuous and surge output, voltage and phase, DC operating range, MPPT count, battery voltage and approved models, generator/AC-coupling behavior, transfer ratings, environmental derating, neutral-ground behavior, and required system accessories.",
        ],
      },
    ],
    products: [...controllerProducts, ...inverterProducts],
    manuals: [manuals.wiring, manuals.doePv],
    reviewed: "2026-07-30",
  },
  "series-parallel": {
    summary: "Calculate series voltage and parallel current independently for every MPPT, then apply temperature, tolerance, source-current, and equipment-specific rules.",
    audience: "Array circuit design",
    visuals: [visuals.module],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "Cold voltage and hot operating voltage",
        paragraphs: [
          "Cold weather raises module open-circuit voltage; hot cells reduce operating voltage. A design can pass the absolute maximum in mild weather yet exceed it on a cold clear morning, or remain below the maximum but fall outside the tracking window when hot.",
          "Parallel strings add current and potential backfeed. String fusing, combiner equipment, conductor ampacity, connector ratings, terminal limits, and the module maximum-series-fuse rating must be evaluated using the applicable design method.",
        ],
      },
    ],
    products: panelProducts,
    manuals: [manuals.wiring, manuals.sandia],
    reviewed: "2026-07-30",
  },
  "shade-mismatch": {
    summary: "Use I-V behavior, bypass-diode regions, time-resolved shade, string topology, and tracker assignment to diagnose nonlinear production loss.",
    audience: "Advanced array performance",
    visuals: [visuals.module],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "Shade changes the circuit curve",
        paragraphs: [
          "Series-connected modules share current. Partial shade can activate one or more bypass-diode regions, remove voltage contribution, and create multiple local power peaks. Parallel strings share operating voltage and can mismatch when orientation, temperature, module type, or irradiance differs.",
          "Module-level electronics mitigate selected mismatch modes and add observability, but they do not restore missing irradiance. Treat chimneys, vents, trees, parapets, snow, and row-to-row shade as time-of-day and season-specific geometry.",
        ],
      },
    ],
    manuals: [manuals.sandia, manuals.om],
    reviewed: "2026-07-30",
  },
  "diagrams-expansion": {
    summary: "Maintain separate one-line, site/roof plan, communications, shutdown-state, and as-built drawings with revision-controlled equipment schedules.",
    audience: "Design documentation and plan review",
    visuals: [visuals.system, visuals.equipment],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "What professionals expect to find",
        paragraphs: [
          "The one-line identifies topology, ratings, conductors, protection, grounding, isolation, metering, and interconnection. The site and roof plans identify physical location, pathways, setbacks, equipment, attachments, access, and concealed routes. A controls drawing identifies BMS, inverter, gateway, CT, network, and emergency-control dependencies.",
          "Expansion is a redesign. New modules, trackers, batteries, inverters, or backed-up loads can change voltage, current, fault current, bus loading, settings, approvals, listings, thermal conditions, grounding, and shutdown behavior.",
        ],
      },
    ],
    procedure: { title: "Drawing package", steps: ["Equipment schedule with exact suffixes", "Site/roof plan", "Electrical one-line", "String and MPPT schedule", "Conductor and OCPD schedule", "Grounding/bonding detail", "Controls/communications diagram", "Labels and shutdown notes", "As-built revision and photo index"] },
    manuals: [manuals.solarApp, manuals.doePv],
    reviewed: "2026-07-30",
  },
  "battery-chemistry": {
    summary: "Compare chemistries through voltage, energy, power, temperature, ventilation, failure behavior, controls, listing, and lifecycle—not marketing shorthand.",
    audience: "Storage selection and safety review",
    visuals: [visuals.equipment],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "The integrated system matters",
        paragraphs: [
          "Cell chemistry is only the first layer. Module construction, BMS, contactors, pre-charge, enclosure, thermal strategy, inverter compatibility, communications, external protection, installation location, fire separation, and integrated ESS certification determine how a residential storage system can be used.",
          "A low-voltage open-loop battery and a 150-400 V closed-loop residential stack are not interchangeable approaches. High-voltage consumer ESS equipment is a qualified-person, compatibility-controlled system.",
        ],
      },
    ],
    manuals: [manuals.ulEss, manuals.wiring],
    reviewed: "2026-07-30",
  },
  "bank-architecture": {
    summary: "Select 12, 24, 48, or high-voltage architecture from power, conductor, equipment, controls, serviceability, and hazard constraints.",
    audience: "Battery-system architecture",
    visuals: [visuals.equipment],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "Balanced current paths",
        paragraphs: [
          "Parallel batteries need deliberately balanced branch paths, compatible battery state, branch protection where required, rated busbars, and an aggregate current check. Equal-length and equal-gauge branches to common busbars are easier to inspect than casual daisy chains.",
          "Series connections add voltage and impose manufacturer restrictions on battery count, midpoint connections, communications, and balancing. Never assume a nominally 12 V battery may be placed in series unless its current manual permits the exact configuration.",
        ],
      },
    ],
    tables: [{ title: "Equal 4.8 kW transfer before losses", columns: ["Bus", "Approximate current", "Design consequence"], rows: [["12 V", "400 A", "Extremely high current and demanding fault protection"], ["24 V", "200 A", "Still a heavy high-current architecture"], ["48 V", "100 A", "Common residential/off-grid low-voltage class"], ["≈400 V", "12 A", "Closed-loop HV ESS; very different shock and service controls"]] }],
    manuals: [manuals.wiring, manuals.ulEss],
    reviewed: "2026-07-30",
  },
  "battery-monitoring": {
    summary: "Combine shunt measurements, BMS cell/protection data, charger status, temperature, state estimation, alarms, and firmware/settings records.",
    audience: "Operations and diagnostics",
    visuals: [visuals.equipment],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "A BMS and a shunt answer different questions",
        paragraphs: [
          "The BMS protects cells and reports internal limits. A correctly placed shunt measures every amp entering or leaving the battery boundary and supports whole-system energy accounting. Charger, inverter, gateway, and BMS logs provide additional context.",
          "State-of-charge accuracy depends on correct capacity, charge efficiency, tail-current and synchronization settings, a complete current path through the shunt, and periodic achievement of the configured synchronization condition.",
        ],
      },
    ],
    manuals: [manuals.wiring, manuals.om],
    reviewed: "2026-07-30",
  },
  "tools-meter": {
    summary: "Choose instruments, connector tooling, cable tools, calibrated torque tools, labels, and PPE by the exact circuit, environment, task, and manufacturer system.",
    audience: "Installer-grade tool selection",
    visuals: [visuals.tools],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "There is no universal solar tool kit",
        paragraphs: [
          "A 48 V battery service call, a 600 V residential string, and a 1500 V commercial array require different instrument categories, working-voltage ratings, current range, ingress protection, leads, probes, PPE, and work boundaries. A meter’s maximum displayed voltage is not a substitute for its CAT rating.",
          "Connector and lug tooling is a matched system. Use the exact cable, contact, connector body, die, locator, crimper, strip length, inspection criteria, and torque device in the current instructions. A generic hydraulic crimper and arbitrary lug do not establish a listed or reliable termination.",
        ],
      },
    ],
    products: toolProducts,
    manuals: [manuals.flukeAbsence, manuals.staubliTools, manuals.oshaElectrical],
    fieldCase: { title: "Meter lead left in the current jack", scenario: "After a current test, a technician prepares to measure a battery’s voltage.", evidence: ["The lead remains connected to the low-resistance current input.", "Battery available fault current is high.", "A meter fuse and enclosure are not guaranteed to interrupt every incorrectly applied source."], response: "Stop before contact. Apply a function-jack-lead-rating check, inspect the instrument, prove it on a known source, test the target, and re-prove it. Use a clamp method where appropriate rather than opening a live current path." },
    reviewed: "2026-07-30",
  },
  "protection-grounding": {
    summary: "Coordinate overcurrent protection, disconnecting means, surge protection, rapid shutdown, fault functions, bonding paths, and grounding as distinct jobs.",
    audience: "Professional electrical reference",
    visuals: [visuals.equipment, visuals.hardware],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "Ratings must survive the source",
        paragraphs: [
          "A protective device needs the correct DC or AC voltage rating, continuous-current behavior, conductor compatibility, environmental/temperature rating, interrupt capacity, polarity where applicable, and coordination with equipment SCCR and available fault current. A fuse holder is not automatically a load-break disconnect.",
          "Bonding connects exposed conductive parts into a dependable fault-current path. The evaluated module/racking/lug combination, rail-splice method, removable sections, enclosures, raceways, hinges, and equipment grounding conductor all matter. An extra ground rod does not replace the required bonding path.",
        ],
      },
    ],
    manuals: [manuals.wiring, manuals.oshaElectrical, manuals.ironridgeRoof],
    reviewed: "2026-07-30",
  },
  "mounting": {
    summary: "Separate roof, ground, pole, and canopy structures, then trace the site-specific load path from module frame to building or soil.",
    audience: "Structural and installation reference",
    visuals: [visuals.mountTypes, visuals.hardware],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "Mounting is a structural system",
        paragraphs: [
          "Module loads travel through clamp zones, clamps, rails or direct attachments, roof interfaces, framing, or through ground-rack braces, posts, and foundations into soil. Wind uplift, downward pressure, snow, drift, sliding, seismic effects, thermal movement, corrosion, drainage, roof zones, and maintenance access alter the design.",
          "Marketing wind and snow envelopes are not project values. Use current locally adopted requirements, site exposure and topography, roof geometry, module dimensions and clamp zones, fastener/substrate capacity, current racking design tools, and stamped engineering where required.",
        ],
      },
    ],
    products: mountingProducts,
    manuals: [manuals.ironridgeRoof, manuals.ironridgeGround, manuals.s5Pvkit, manuals.mtSolar],
    reviewed: "2026-07-30",
  },
  "install-components": {
    summary: "Lay out and install equipment from current clearances, conductor pathways, bend radii, terminal systems, environmental limits, service access, and a controlled torque record.",
    audience: "Field installation",
    visuals: [visuals.equipment, visuals.tools],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "A clean wall is not necessarily a compliant wall",
        paragraphs: [
          "Before mounting equipment, coordinate weight, backing, fire/environmental location, ventilation, service covers, working space, conduit approach, conductor bending, communication separation, battery clearances, disconnect visibility, drainage, impact exposure, and future replacement.",
          "Every termination is a manufactured interface: conductor material and strand class, strip length, ferrule or lug, die, crimp count/orientation, terminal hardware, anti-oxidation treatment where specified, and torque all come from the exact equipment and connector instructions.",
        ],
      },
    ],
    procedure: { title: "Equipment-wall installation record", steps: ["Verify current manuals and approved equipment schedule.", "Mock up equipment and cover-removal clearances.", "Install structural backing and heavy equipment.", "Install raceways, enclosures, busbars, protection, and disconnects.", "Prepare and inspect terminations with matched tooling.", "Torque using the stated range and record the value/tool.", "Label both ends and update the one-line.", "Inspect before covers and controlled energization."] },
    products: toolProducts.slice(4, 8),
    manuals: [manuals.wiring, manuals.ulEss],
    reviewed: "2026-07-30",
  },
  "commissioning": {
    summary: "Commission by documented subsystem gates: records, visual/mechanical inspection, safe isolation, de-energized tests, controlled energization, functional tests, and a performance baseline.",
    audience: "Qualified commissioning and handoff",
    visuals: [visuals.tools, visuals.equipment],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "Baseline measurements become future evidence",
        paragraphs: [
          "Capture model and serial numbers, firmware, settings, string map, polarity, Voc, insulation test where applicable, continuity/bonding results, battery voltage and state, operating current, irradiance, module temperature, inverter output, alarms, communications, torque records, photographs, and the as-built drawing.",
          "The energization sequence is product-specific. A common battery-based controller may require battery/control power before PV, while other systems use different pre-charge and startup logic. Stop on unexpected voltage, polarity, sound, smell, heat, alarm, or communication state.",
        ],
      },
    ],
    products: toolProducts.slice(0, 4),
    manuals: [manuals.om, manuals.flukeAbsence, manuals.oshaLoto],
    reviewed: "2026-07-30",
  },
  "troubleshooting": {
    summary: "Preserve logs and divide the system into safe, measurable boundaries before replacing parts or resetting evidence.",
    audience: "Qualified diagnostics",
    visuals: [visuals.tools, visuals.equipment],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "Evidence before intervention",
        paragraphs: [
          "Record timestamp, irradiance, temperature, operating mode, state of charge, load, alarm history, firmware/settings, recent changes, and whether the fault repeats. Compare against commissioning baselines and peer strings or channels.",
          "Use safe isolation and live-dead-live verification before connector, fuse, termination, insulation, or continuity work. Do not disconnect PV connectors under load, tighten a hot connection live, bypass a BMS, or increase fuse size to suppress repeated operation.",
        ],
      },
    ],
    fieldCase: { title: "Ground-fault alarm after rain", scenario: "An inverter reports a recurring insulation or ground-fault alarm after wet weather.", evidence: ["The alarm clears after drying.", "One rooftop cable route crosses a sharp edge.", "A connector pair was assembled from visually compatible but different manufacturers."], response: "Qualified personnel isolate all sources, prove absence where required, disconnect sensitive electronics according to instructions, segment the circuit, perform appropriate insulation testing, and inspect pinches, boxes, connectors, backsheets, and water paths. Replace damaged or cross-mated connector pairs as complete approved assemblies." },
    manuals: [manuals.om, manuals.oshaElectrical, manuals.flukeAbsence],
    reviewed: "2026-07-30",
  },
  "permits": {
    summary: "Build a revision-controlled submission set that satisfies electrical, structural, fire, building, utility, and manufacturer requirements for the actual jurisdiction.",
    audience: "Permit preparation and plan review",
    visuals: [visuals.mountTypes, visuals.system],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "The AHJ and utility review different boundaries",
        paragraphs: [
          "Confirm adopted code editions, local amendments, forms, fees, structural criteria, fire access, battery requirements, inspection sequence, and utility interconnection rules before final design. A permit approval and utility permission to operate are separate gates.",
          "The packet typically includes site/roof plans, structural notes, attachment schedule, module clamp zones, one-line, equipment schedule/listings, conductor and protection schedule, grounding/bonding, labels, rapid shutdown, battery location, manufacturer data, and interconnection documents.",
        ],
      },
    ],
    procedure: { title: "Revision control", steps: ["Record jurisdiction and adopted editions.", "Freeze exact equipment model suffixes.", "Submit site, structural, electrical, and product documents.", "Log reviewer comments and response revisions.", "Record field changes before concealment.", "Submit required revisions.", "Preserve approved and as-built sets.", "Obtain inspection and utility permission to operate."] },
    manuals: [manuals.solarApp, manuals.ironridgeRoof],
    reviewed: "2026-07-30",
  },
  "example-systems": {
    summary: "Compare complete architectures under normal, outage, shutdown, and recovery conditions instead of presenting universal bills of material.",
    audience: "Casebook for designers and advanced owners",
    visuals: [visuals.system, visuals.equipment, visuals.mountTypes],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "Six useful casebooks",
        paragraphs: [
          "Build separate examples for grid-tied microinverters, optimizer/string inverter, 48 V DC-coupled hybrid, modular off-grid inverter/charger, AC-coupled retrofit, and high-voltage hybrid storage. Each should show operating states, metering, communications, shutdown boundaries, failure modes, and the design records required.",
          "Example ratings explain tradeoffs but never replace a load study, site model, current manuals, calculations, product compatibility, and local approval.",
        ],
        bullets: ["Garage critical-load backup", "Remote snow-climate cabin", "Residential split-phase hybrid", "Existing PV with AC-coupled storage", "High-voltage battery/inverter ecosystem", "Vehicle or mobile DC architecture"],
      },
    ],
    products: [...controllerProducts.slice(0, 2), ...inverterProducts],
    manuals: [manuals.doePv, manuals.wiring, manuals.om],
    reviewed: "2026-07-30",
  },
  "maintenance": {
    summary: "Use weather-aware performance trends, documented inspection, safe corrective work, configuration control, and an updated as-built record throughout the asset life.",
    audience: "Owner, installer, and O&M reference",
    visuals: [visuals.equipment, visuals.mountTypes],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "Design for maintenance before installation",
        paragraphs: [
          "Accessible disconnects, supported conductors, drainage, service clearances, monitoring, replaceable equipment, readable labels, and preserved documentation determine whether later work can be safe and efficient.",
          "Normalize production for weather and availability before declaring a fault. Track inverter clipping and derating, communications, battery state and temperature, repeated trips, peer-string differences, soiling, shade growth, storm damage, settlement, corrosion, water entry, pests, and failed wire support.",
        ],
      },
    ],
    procedure: { title: "Controlled change", steps: ["Preserve the current baseline.", "Review the proposed component and current manuals.", "Repeat voltage/current/fault/protection/structural checks.", "Obtain required approval.", "Install and recommission the affected subsystem.", "Update settings, labels, drawings, photos, and warranty records."] },
    manuals: [manuals.om, manuals.wiring],
    reviewed: "2026-07-30",
  },

  "module-datasheet": {
    summary: "Read a module datasheet and installation manual together: electrical boundary values, temperature behavior, mechanical loads, clamp zones, connectors, dimensions, and warranty language all affect design.",
    audience: "Professional equipment reference",
    visuals: [visuals.module, visuals.hardware],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "Datasheet anatomy",
        paragraphs: [
          "Pmax, Voc, Vmp, Isc, Imp, efficiency, tolerance, temperature coefficients, and NMOT describe electrical behavior under stated conditions. Maximum system voltage and maximum series-fuse rating are system constraints, not normal operating targets.",
          "Dimensions, weight, frame profile, cable length, connector family, junction-box rating, fire classification, front/rear design loads, test loads, and approved clamp zones determine structural and layout compatibility. Product and performance warranties cover different obligations.",
        ],
      },
    ],
    products: panelProducts,
    manuals: [manuals.doePv, manuals.sandia, manuals.ironridgeRoof],
    reviewed: "2026-07-30",
  },
  "inverter-architectures": {
    summary: "Compare string, optimizer, microinverter, standalone inverter/charger, and hybrid architectures through voltage, MPPT, phase, grid-forming, backup, battery, generator, and control behavior.",
    audience: "Professional inverter selection",
    visuals: [visuals.equipment, visuals.system],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "Topology determines the design questions",
        paragraphs: [
          "Microinverters move conversion to each module and create an AC branch architecture. Optimizer systems use a proprietary DC architecture. String inverters centralize conversion. Hybrid inverters coordinate PV, battery, grid, backup loads, and sometimes generators. Standalone inverter/chargers may rely on separate MPPT controllers.",
          "Grid-following and grid-forming behavior, transfer controls, neutral-ground management, AC coupling, frequency-watt control, approved battery communications, and service topology cannot be inferred from continuous wattage.",
        ],
      },
    ],
    products: inverterProducts,
    manuals: [manuals.doePv, manuals.ulEss],
    reviewed: "2026-07-30",
  },
  "mppt-envelope": {
    summary: "Plot cold Voc, hot Vmp, operating current, short-circuit current, tracker limits, output current, battery acceptance, and thermal derating on one controller operating envelope.",
    audience: "Advanced controller sizing",
    visuals: [visuals.module, visuals.equipment],
    objectives: commonObjectives.design,
    referenceSections: [
      {
        title: "A pass requires every boundary",
        paragraphs: [
          "A string can remain below the absolute voltage maximum but fail to reach startup or remain within the MPPT window when hot. A tracker can accept the operating current yet have a lower published short-circuit-current limit. A controller can accept PV nameplate power but clip output or exceed battery charge acceptance.",
          "Run the manufacturer’s string tool where available and preserve module data, minimum design temperature, maximum cell-temperature assumption, series/parallel count, tracker assignment, tolerance, and manual revision.",
        ],
      },
    ],
    products: controllerProducts,
    manuals: [manuals.wiring, manuals.sandia],
    reviewed: "2026-07-30",
  },
  "professional-tools": {
    summary: "Build task-specific kits for residential, high-voltage PV, battery, connector, mounting, and commissioning work rather than one generic toolbox.",
    audience: "Professional field reference",
    visuals: [visuals.tools],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "Select by task and boundary",
        paragraphs: [
          "Document instrument CAT and voltage rating, current range, DC clamp capability, lead/probe ratings, environmental rating, proving method, calibration status, and accessories. Document every crimper’s exact conductor/contact/lug system and every torque tool’s usable range and calibration.",
          "A strong kit also includes fall protection selected from a site plan, lockout/tagout hardware, labels with suitable stock, illumination, insulated hand tools where applicable, spare rated leads and fuses, inspection mirrors, cleaning materials approved by manufacturers, and protected document access.",
        ],
      },
    ],
    products: toolProducts,
    manuals: [manuals.oshaElectrical, manuals.flukeAbsence, manuals.staubliTools],
    reviewed: "2026-07-30",
  },
  "pv-connectors": {
    summary: "Treat the cable, contact, connector body, seal, die, locator, crimper, strip length, seating, and torque as one evaluated connector assembly.",
    audience: "Connector workmanship and inspection",
    visuals: [visuals.tools, visuals.module],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "A connector that clicks can still be incompatible",
        paragraphs: [
          "Do not cross-mate brands because interfaces appear to fit. Identify the exact connector family, cable conductor size and outer diameter, contact, seal, body, tool, locator, strip length, cap-nut torque, environmental limits, and current assembly instructions.",
          "Inspect for nicked strands, incomplete conductor capture, incorrect die imprint, bent contacts, partial seating, contaminated or wet interfaces, damaged seals, loose cap nuts, heat discoloration, and unsupported cable. Never disconnect a PV connector under load.",
        ],
      },
    ],
    procedure: { title: "Connector assembly record", steps: ["Verify exact connector/contact/cable compatibility.", "Cut square and strip to the stated length without nicking.", "Use the stated die and locator through a complete cycle.", "Inspect the conductor and insulation crimp.", "Insert and verify contact retention.", "Assemble and torque with the designated tool.", "Cap/protect until mating.", "Mate only an approved pair and support the cable."] },
    products: toolProducts.filter(product=>product.maker==="Stäubli"),
    manuals: [manuals.staubliTools, manuals.staubliAssembly],
    reviewed: "2026-07-30",
  },
  "battery-terminations": {
    summary: "Engineer high-current battery terminations around conductor material and class, compatible lug, die/tool, crimp record, terminal hardware, torque, protection, support, and inspection.",
    audience: "Battery workmanship reference",
    visuals: [visuals.tools, visuals.equipment],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "The connection is a tested system",
        paragraphs: [
          "Cable size alone does not establish compatibility. Confirm copper or aluminum, strand class, insulation diameter, lug listing and barrel, stud/pad size, plating, die index, crimp count and orientation, strip length, heat-shrink allowance, terminal hardware, anti-oxidation treatment where specified, and torque.",
          "Route and support cable so terminals do not carry cable weight or vibration. Locate source protection according to the design, minimize unprotected conductor length, and verify the protective device’s DC voltage and interrupt capability for the battery’s available fault current.",
        ],
      },
    ],
    products: toolProducts.filter(product=>product.maker==="Burndy"),
    manuals: [manuals.wiring, manuals.ulEss],
    reviewed: "2026-07-30",
  },
  "electrical-safety-loto": {
    summary: "Plan for concurrent PV, battery, grid, generator, capacitor, and mechanical/fall hazards; illumination means the PV source cannot simply be switched off.",
    audience: "Qualified-person safety reference",
    visuals: [visuals.tools, visuals.system],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "Establish and verify the work condition",
        paragraphs: [
          "Identify every energy source and backfeed path, establish the qualified-person boundary, perform the task-specific shock/arc/fall assessment, isolate in the product-specific order, apply lockout/tagout, address stored energy and automatic controls, then perform live-dead-live verification with an appropriately rated instrument.",
          "A non-contact voltage detector is not proof that PV DC conductors are de-energized. Gloves, face protection, arc-rated clothing, helmet, eye protection, footwear, and fall protection are selected from the hazard assessment and exact exposure—not from a generic solar shopping list.",
        ],
      },
    ],
    procedure: { title: "Energy-control plan", steps: ["Identify PV, grid, battery, generator, control, and stored energy.", "Define the work boundary and qualified roles.", "Select PPE and fall/rescue controls.", "Follow product-specific shutdown.", "Apply lockout/tagout.", "Release or wait for stored energy as specified.", "Verify instrument on a known source.", "Test the work boundary.", "Re-verify the instrument.", "Control re-energization and document the return to service."] },
    manuals: [manuals.oshaElectrical, manuals.oshaLoto, manuals.oshaFalls, manuals.flukeAbsence],
    reviewed: "2026-07-30",
  },
  "roof-survey": {
    summary: "Document roof covering, age, drainage, framing, decking, damage, roof zones, loads, obstructions, access, fire pathways, electrical routing, and reroof implications before choosing attachments.",
    audience: "Site survey and structural design",
    visuals: [visuals.mountTypes, visuals.hardware],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "Survey the complete load and water path",
        paragraphs: [
          "Record roof slope, covering manufacturer/type/condition, deck thickness, framing size and spacing, attic access, prior leaks, underlayment, valleys, hips, ridges, parapets, drains, snow-retention behavior, rooftop equipment, and the proposed conductor path.",
          "Structural design depends on locally adopted wind, exposure, topography, building height and roof zones, snow and drift, seismic and dead-load combinations, module geometry and clamp zones, substrate capacity, and engineered attachment schedules.",
        ],
      },
    ],
    procedure: { title: "Survey deliverables", steps: ["Scaled roof plan and photographs", "Roof-covering and age record", "Framing/deck evidence", "Damage and leak notes", "Obstruction, access, and fire-path dimensions", "Site wind/snow/seismic criteria", "Array and attachment concept", "Electrical route and equipment locations", "Reroof and warranty coordination notes"] },
    manuals: [manuals.ironridgeRoof, manuals.uniracSolarMount, manuals.solarApp],
    reviewed: "2026-07-30",
  },
  "roof-systems": {
    summary: "Compare rail-based, rail-less, asphalt-shingle, tile, standing-seam, and exposed-fastened systems by their exact load path and current evaluated assembly.",
    audience: "Roof attachment selection",
    visuals: [visuals.hardware, visuals.mountTypes],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "The roof interface controls the hardware",
        paragraphs: [
          "Asphalt shingles may use flashed rafter attachments, evaluated deck mounts, or listed butyl systems. Tile roofs may use hooks, replacement tiles, knockout flashing, or standoffs that transfer load without bearing on fragile tile. Standing-seam clamps require the exact seam, material, gauge, clip spacing, roof-panel capacity, and tested clamp. Exposed-fastened metal attachments require the correct rib geometry, gasket compression, substrate, and fastener path.",
          "Rail-based systems offer flexible module layout and serviceability but require span, cantilever, splice, thermal, and attachment design. Rail-less systems reduce long material but require precise layout, compatible modules, controlled thermal movement, and a replacement strategy.",
        ],
      },
    ],
    products: mountingProducts.slice(0, 5),
    manuals: [manuals.ironridgeRoof, manuals.snapUltra, manuals.s5Pvkit],
    reviewed: "2026-07-30",
  },
  "flat-roof": {
    summary: "Design attached or ballasted low-slope systems around roof reserve, wind zones, seismic restraint, membrane compatibility, drainage, pathways, parapets, and exact site ballast/attachment plans.",
    audience: "Low-slope roof reference",
    visuals: [visuals.hardware, visuals.mountTypes],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "Ballast is a site-specific structural schedule",
        paragraphs: [
          "Roof zones, building height, exposure, parapets, module geometry, row spacing, tilt, seismic conditions, and wind-tunnel coefficients determine ballast. Structural reserve, insulation/deck behavior, membrane protection, slip sheets, drainage, roof warranty, and reroof plans must be coordinated.",
          "Never move blocks for convenience, substitute block size/density, omit seismic or attachment components, or assume an interior-row layout applies at edges and corners. Attached systems introduce waterproofing and substrate/pullout requirements instead.",
        ],
      },
    ],
    products: mountingProducts.filter(product=>product.model.includes("Ballasted")),
    manuals: [manuals.solarApp],
    reviewed: "2026-07-30",
  },
  "ground-pole": {
    summary: "Separate fixed ground and top-of-pole systems, then engineer utilities, soil, frost, drainage, corrosion, foundations, row geometry, bracing, hoisting, conductor movement, and maintenance access.",
    audience: "Ground and pole mounting reference",
    visuals: [visuals.mountTypes, visuals.hardware],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "The soil and foundation are part of the array",
        paragraphs: [
          "Fixed ground mounts can use concrete piers, driven piles, helical piles, ground screws, grade beams, or ballast. Utility location, geotechnical assumptions, frost depth, groundwater, drainage, grading, corrosion, tolerances, snow clearance, trenching, vegetation, and equipment access belong in the design.",
          "Top-of-pole mounts create a concentrated overturning moment and require an approved pole, head, footing, hoisting method, tilt hardware, wind-safe adjustment procedure, and conductor routing that tolerates every permitted position.",
        ],
      },
    ],
    products: mountingProducts.filter(product=>["Tamarack Solar","MT Solar"].includes(product.maker)),
    manuals: [manuals.ironridgeGround, manuals.tamarackGround, manuals.mtSolar],
    reviewed: "2026-07-30",
  },
  "solar-canopies": {
    summary: "Treat pergolas, carports, and solar canopies as occupied structures with engineered foundations, framing, clearance, impact protection, drainage, snow behavior, fire access, and coordinated electrical systems.",
    audience: "Architectural PV reference",
    visuals: [visuals.mountTypes, visuals.hardware],
    objectives: commonObjectives.field,
    referenceSections: [
      {
        title: "A module array is not automatically a roof",
        paragraphs: [
          "Determine whether the canopy provides shade only or a genuinely weather-managed enclosure. Module joints, seals, gutters, downspouts, thermal movement, snow shedding, drip lines, corrosion, lighting, EV equipment, conduit, grounding, accessibility, and emergency-disconnect placement must be designed together.",
          "Vehicle clearances and bollards, pedestrian paths, fire access, foundations, wind/snow/seismic loads, overhead glass/module approval, and local building permits make a canopy materially different from ordinary ground racking.",
        ],
      },
    ],
    products: mountingProducts.filter(product=>product.maker==="Lumos Solar"),
    manuals: [manuals.solarApp, manuals.doePv],
    reviewed: "2026-07-30",
  },
};
