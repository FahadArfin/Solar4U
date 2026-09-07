import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import "@babylonjs/core/Culling/ray";
import { providerPanelCorners } from "../lib/roof-geometry";
import type { RoofBuilding, RoofMesh } from "../lib/roof-types";
export function createAerialScene(
  canvas: HTMLCanvasElement,
  building: RoofBuilding,
  data: RoofMesh,
  bitmap: ImageBitmap | undefined,
  onPick: (index: number) => void,
) {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
  engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, 1.5));
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString("#e9eddeff");
  const camera = new ArcRotateCamera(
    "roof camera",
    -1.1,
    0.7,
    Math.max(20, data.boundsMeters * 2.5),
    Vector3.Zero(),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 400;
  camera.lowerBetaLimit = 0.05;
  camera.upperBetaLimit = 1.5;
  camera.minZ = 0.05;
  camera.wheelPrecision = 6;
  const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
  sky.intensity = 1;
  const roof = new Mesh("measured roof", scene),
    v = new VertexData(),
    normals: number[] = [];
  v.positions = data.positions;
  v.indices = data.indices;
  v.uvs = data.uvs;
  VertexData.ComputeNormals(data.positions, data.indices, normals);
  v.normals = normals;
  v.applyToMesh(roof);
  const mat = new StandardMaterial("aerial roof", scene);
  mat.diffuseColor = Color3.FromHexString("#b4bba7");
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  roof.material = mat;
  if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
    const texture = new DynamicTexture(
      "aerial imagery",
      { width: bitmap.width, height: bitmap.height },
      scene,
      false,
    );
    texture.getContext().drawImage(bitmap, 0, 0);
    texture.update(true);
    mat.emissiveTexture = texture;
    mat.emissiveColor = Color3.Black();
    mat.diffuseColor = Color3.Black();
    mat.disableLighting = true;
  }
  const plain = new StandardMaterial("roof relief", scene);
  plain.diffuseColor = Color3.FromHexString("#b1b9a5");
  plain.specularColor = Color3.Black();
  plain.backFaceCulling = false;
  const panelMat = new StandardMaterial("provider module", scene);
  panelMat.diffuseColor = Color3.FromHexString("#244555");
  panelMat.emissiveColor = Color3.FromHexString("#07121a");
  panelMat.specularColor = Color3.FromHexString("#64747a");
  panelMat.backFaceCulling = false;
  const selectedMat = new StandardMaterial("selected module", scene);
  selectedMat.diffuseColor = Color3.FromHexString("#d3b94f");
  selectedMat.backFaceCulling = false;
  const panels = building.solarPotential.solarPanels.map((_, i) => {
    const points = providerPanelCorners(building, i, data.referenceHeight),
      mesh = new Mesh(`provider panel ${i + 1}`, scene),
      pv = new VertexData(),
      n: number[] = [];
    pv.positions = points.flat();
    pv.indices = [0, 2, 1, 0, 3, 2];
    VertexData.ComputeNormals(pv.positions, pv.indices, n);
    pv.normals = n;
    pv.applyToMesh(mesh);
    mesh.material = panelMat;
    mesh.metadata = { index: i };
    return mesh;
  });
  scene.onPointerObservable.add((p) => {
    if (
      p.type === PointerEventTypes.POINTERPICK &&
      Number.isInteger(p.pickInfo?.pickedMesh?.metadata?.index)
    )
      onPick(p.pickInfo!.pickedMesh!.metadata.index);
  });
  const observer = new ResizeObserver(() => engine.resize());
  observer.observe(canvas);
  engine.runRenderLoop(() => scene.render());
  return {
    update(count: number, selected: number, imagery: boolean) {
      panels.forEach((m, i) => {
        m.setEnabled(i < count);
        m.material = i === selected ? selectedMat : panelMat;
      });
      roof.material = imagery ? mat : plain;
    },
    reset() {
      camera.setTarget(Vector3.Zero());
      camera.alpha = -1.1;
      camera.beta = 0.7;
      camera.radius = Math.max(20, data.boundsMeters * 2.5);
    },
    top() {
      camera.beta = 0.01;
      camera.alpha = -Math.PI / 2;
    },
    dispose() {
      observer.disconnect();
      scene.dispose();
      engine.dispose();
    },
  };
}
