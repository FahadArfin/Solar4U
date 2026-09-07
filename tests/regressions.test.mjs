import test from 'node:test';
import assert from 'node:assert/strict';
import {localEstimate,fitGroundArray} from '../services/solar-engine/model.mjs';
test('southern seasonal production peaks in southern summer',()=>{const n=localEstimate({capacityKw:10,latitude:43,azimuth:180});const s=localEstimate({capacityKw:10,latitude:-43,azimuth:0});assert.ok(n.monthlyKwh[5]>n.monthlyKwh[11]);assert.ok(s.monthlyKwh[11]>s.monthlyKwh[5])});
test('cumulative cash flow equals the actual preceding annual values',()=>{const model=localEstimate({capacityKw:10,latitude:43});assert.equal(model.netCost,model.installedCost);assert.equal(model.cashFlow.at(-1).cumulativeSavings,model.cashFlow.reduce((sum,y)=>sum+y.annualSavings,-model.netCost))});
test('ground layout rejects negative setbacks and preserves explicit zero',()=>{assert.throws(()=>fitGroundArray({areaSqM:100,setbackM:-100}));const plan=fitGroundArray({areaSqM:100,setbackM:0,rowSpacingM:0});assert.equal(plan.assumptions.setbackM,0);assert.equal(plan.assumptions.rowSpacingM,0);assert.ok(plan.panelCount<60)});
