# Equipment notebook and saved workspace

The equipment route now holds a real browser-local bill of materials. Add a currently observed retailer variant from the price tracker, enter a manual item or service, or explicitly bring in the saved studio's placed module count. Studio modules enter as unpriced manual lines; geometry does not identify a particular retail product.

Retailer lines preserve exact variant identity, SKU, currency, integer minor-unit price, observation date, availability and source link. Repeated additions of the same dated snapshot increase quantity. Different snapshots stay separate. Checking current prices shows a comparison; it never silently changes a budget. Explicit updates reject missing or concurrently changed source snapshots.

Manual prices use exact decimal parsing for the currency's precision. Blank means unpriced; an explicit zero means zero. Known-price subtotals stay separate by currency and list the excluded unpriced units. Shipping, taxes, product compatibility and installation approval are not inferred.

Device saves use Web Locks and read the latest document inside the lock, so concurrent tabs can update different lines without losing either edit. Editor conflicts fail visibly. Invalid saved data remains intact; a recovery action saves the original before replacing it. JSON imports are validated before writing, marked as imported snapshots, and retain the preceding document as a recovery copy. Final serialized size is limited to 2 MB. JSON is the restorable format; CSV is a spreadsheet export with formula-leading text neutralized.

The workspace reads actual design, equipment, learning and watchlist summaries. The device archive preserves the original JSON text of each document; individual editors export directly restorable files. All storage belongs to the current browser and origin. Legacy picker and roof-plan keys are preserved, and seeded legacy prices are not promoted into retailer observations.

Validation covers currency and unpriced totals, snapshot identity, exact prices, invalid links and imports, malicious property names, stale snapshot updates and backup round trips. Browser checks exercised real retailer addition, manual CAD unpriced items, native WebMCP quantity updates, full reload, actual saved-design module import, simultaneous edits from two tabs, and a 390 px workspace layout.
