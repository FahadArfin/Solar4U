# Calculator workshop

The published calculator interface uses one light theme and nine interactive tools. Each result includes its method, limits and a primary reference. JSON exports contain applied inputs and results; the interface explicitly describes calculator values as tab-local rather than saved projects.

## Correctness changes

- Browser, hosted API and local solar service share the seasonal model. Southern seasons use signed latitude. Monthly integer allocations stay nonnegative and sum exactly to annual production, including tiny arrays.
- PVGIS 5.3 production replaces both energy and dependent financial figures. All incentive inputs use percentages from 0 through 100. The default is zero. Mixed provider responses identify individual arrays and the mixed aggregate.
- Climate requests validate all array parameters and total capacity before upstream calls. Changing inputs or leaving the PV tool cancels pending work. Native WebMCP returns the actual source/result or error.
- Zero battery capacity yields zero runtime; zero load yields an undefined duration rather than invented finite runtime. Invalid voltage, fractional module counts and contradictory module ratings are rejected.
- Cable sizing returns no candidate or cost when the example table cannot meet both constraints. Table ampacities and costs remain explicitly illustrative, requiring the actual installation conditions.
- TOU capacity uses discharge efficiency, while charging cost uses round-trip efficiency. Shares cannot exceed 100%; negative arbitrage savings remain negative. Inconsistent efficiency boundaries are rejected.
- Charge-controller comparison evaluates whole strings against verified Victron cold-voltage, PV short-circuit current, startup and power limits. It does not split modules among imaginary fractional controllers. Coefficients apply to every independent array; different module coefficients need separate calculations.

## Validation

Regression coverage includes zero/invalid input, small-array rounding, both hemispheres, percent units, climate financial reconciliation, no-fit cables, TOU losses and controller constraints. Hosted tests cover invalid multi-array requests and empty capacity. Browser checks exercised native WebMCP, actual PVGIS data, invalid-input reset, desktop and 390 px layouts.

These are preliminary energy and electrical planning tools. They do not establish conductor ampacity, connector suitability, protection coordination, battery surge capability, shading, export compensation, or site-specific compliance.
