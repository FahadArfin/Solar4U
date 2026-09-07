export type Point=[number,number];
export type Region={outer:Point[];holes:Point[][]};
export type Rectangle={centre:Point;widthM:number;depthM:number;rotationDegrees:number};
export function testPlacement(region:Region,rect:Rectangle,options?:{edgeSetbackM?:number;holeClearanceM?:number;boundaryTouchAllowed?:boolean}):{valid:boolean;minOuterDistanceM:number;minHoleDistanceM:number|null};
export function validateRegion(region:Region):boolean;
export function packRegion(region:Region,options:{width:number;depth:number;gapX:number;gapY:number;setback:number;clearance:number;limit?:number}):Array<{x:number;y:number;width:number;depth:number}>;
