# Guided solar shopping

Open **Build a system** (`/solar-part-picker`, also `/build`). The builder shares the equipment notebook's device-local document. Existing notebooks remain intact at `/equipment`.

Choose a slot, narrow its subtype, filter current observations, and compare up to four exact retailer variants. Quantity counts purchased variants or packages, not automatically individual modules. Adding stores the observed price and timestamp; subsequent price changes do not silently alter a saved budget. Remove supports undo. Use the notebook to edit quantities, notes and categories, import a backup, add a manual quote, or explicitly accept an updated price. Export build creates a restorable JSON backup.

Slots include panels, ground/roof mounting and accessories, electrical boxes/switches, wiring/fuses, inverters/controllers, and batteries. Battery format and voltage class have independent filters. Combined kits, empty enclosures and cells have distinct categories. Optional categories do not create a misleading completion percentage.

Classification and numeric clues come from retailer titles and selected variants, not verified manufacturer specifications. Selected variants override ambiguous family values. Formatted numbers and ranges are handled conservatively. Module price per stated watt requires an explicit package quantity and an unambiguous module wattage; kits containing controllers or mounting are excluded. Shared SKUs surface potential alternatives in the same category and currency, without claiming verified equivalence. Check exact contents and datasheets.

Known-price subtotals use integer minor units and keep currencies separate. Shipping, freight and tax are not quoted. Compatibility requires missing manufacturer and site inputs: cold Voc/hot Vmp and controller limits, battery/BMS support, structural mounting approval, and AC/DC protection ratings. No universal compatibility pass is generated.

Daily collection is bounded discovery plus rotation of known variants, not every product on the internet. Source coverage is visible, with honest empty states for missing accessories. Manual items and quotes remain available. No purchase or checkout is initiated by adding a component.

Native WebMCP tools expose the current build, filtered offers, category navigation and exact-offer quantity additions. They use the same validated, locked save path as the UI. Reading offers does not expose an account or complete a purchase.
