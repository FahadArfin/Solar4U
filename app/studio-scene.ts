import earcut from "earcut";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import "@babylonjs/core/Culling/ray";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import {
  add,
  scale,
  radians,
  point3,
  panelCorners,
  type StudioPlan,
  type Vec3,
} from "../lib/studio";
export function createStudioScene(
  canvas: HTMLCanvasElement,
  onPick: (id: string) => void,
) {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    adaptToDeviceRatio: true,
  });
  engine.setHardwareScalingLevel(
    1 / Math.min(window.devicePixelRatio || 1, 1.5),
  );
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString("#e9eddeff");
  const camera = new ArcRotateCamera(
    "camera",
    -1.1,
    1.04,
    46,
    new Vector3(7, 1, 0),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 160;
  camera.lowerBetaLimit = 0.15;
  camera.upperBetaLimit = 1.5;
  camera.wheelPrecision = 12;
  camera.panningSensibility = 65;
  camera.minZ = 0.1;
  const fill = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
  fill.intensity = 0.65;
  fill.groundColor = Color3.FromHexString("#829575");
  const sun = new DirectionalLight("sun", new Vector3(0.5, -1, 0.4), scene);
  sun.position = new Vector3(-30, 50, -25);
  sun.intensity = 0.6;
  const shadows = new ShadowGenerator(2048, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 24;
  shadows.bias = 0.002;
  shadows.normalBias = 0.03;
  const material = (name: string, color: string) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = new Color3(0.08, 0.08, 0.08);
    return m;
  };
  const leaves = material("leaves", "#899d6c");
  const grass = material("sage lawn", "#c6d2ae"),
    walls = material("warm plaster", "#eee8d4"),
    roofMat = material("weathered roof", "#8d927a"),
    glass = material("window glass", "#78948b"),
    wood = material("timber", "#a3916d"),
    panelMat = material("module glass", "#233e49"),
    selectedMat = material("selected module", "#ccb765"),
    concrete = material("path", "#e8e5d4"),
    obstacleMat = material("exclusion marker", "#af9571");
  const moduleTexture = new DynamicTexture(
    "solar cells",
    { width: 384, height: 640 },
    scene,
    false,
  );
  const ctx = moduleTexture.getContext();
  ctx.fillStyle = "#233e49";
  ctx.fillRect(0, 0, 384, 640);
  ctx.strokeStyle = "#4f6670";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 384; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 640);
    ctx.stroke();
  }
  for (let y = 0; y <= 640; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(384, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#708084";
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, 384, 640);
  moduleTexture.update();
  panelMat.diffuseTexture = moduleTexture;
  panelMat.diffuseColor = new Color3(1, 1, 1);
  panelMat.specularColor = new Color3(0.15, 0.18, 0.2);
  panelMat.specularPower = 80;
  walls.backFaceCulling = false;
  roofMat.backFaceCulling = false;
  panelMat.backFaceCulling = false;
  selectedMat.backFaceCulling = false;
  const ground = MeshBuilder.CreateGround(
    "land",
    { width: 180, height: 180 },
    scene,
  );
  ground.material = grass;
  ground.position.y = -0.04;
  ground.receiveShadows = true;
  ground.isPickable = false;
  let group: TransformNode | null = null;
  let current: StudioPlan | null = null;
  const panelMeshes = new Map<string, Mesh>();
  function box(
    name: string,
    size: Vec3,
    pos: Vec3,
    mat: StandardMaterial,
    rotation = 0,
  ) {
    const m = MeshBuilder.CreateBox(
      name,
      { width: size[0], height: size[1], depth: size[2] },
      scene,
    );
    m.position = Vector3.FromArray(pos);
    m.rotation.y = rotation;
    m.material = mat;
    m.parent = group;
    m.receiveShadows = true;
    m.isPickable = false;
    shadows.addShadowCaster(m);
    return m;
  }
  function quad(name: string, vertices: Vec3[], mat: StandardMaterial) {
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = vertices.flat();
    data.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    data.indices = [0, 2, 1, 0, 3, 2];
    const normals: number[] = [];
    VertexData.ComputeNormals(data.positions, data.indices, normals);
    data.normals = normals;
    data.applyToMesh(mesh);
    mesh.material = mat;
    mesh.parent = group;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    shadows.addShadowCaster(mesh);
    return mesh;
  }
  function tree(x: number, z: number, height: number) {
    box("tree trunk", [0.25, height * 0.6, 0.25], [x, height * 0.3, z], wood);
    const m = MeshBuilder.CreateSphere(
      "soft tree canopy",
      { diameter: height * 0.75, segments: 7 },
      scene,
    );
    m.scaling.y = 1.2;
    m.position.set(x, height * 0.8, z);
    m.material = leaves;
    m.parent = group;
    m.isPickable = false;
    shadows.addShadowCaster(m);
  }
  function rebuild(plan: StudioPlan) {
    group?.dispose(false, false);
    group = new TransformNode("measured property", scene);
    panelMeshes.clear();
    const s = plan.settings,
      a = radians(s.azimuth),
      u: Vec3 = [Math.cos(a), 0, -Math.sin(a)],
      front: Vec3 = [Math.sin(a), 0, Math.cos(a)];
    box("house", [s.width, s.eaves, s.depth], [0, s.eaves / 2, 0], walls, a);
    for (const surface of plan.surfaces.filter((s) => s.kind === "roof")) {
      const rings = [surface.outer, ...surface.holes],
        coords = rings.flat(),
        holes: number[] = [];
      let offset = surface.outer.length;
      for (const h of surface.holes) {
        holes.push(offset);
        offset += h.length;
      }
      const m = new Mesh(surface.label, scene),
        v = new VertexData();
      v.positions = coords.flatMap(([x, y]) => point3(surface, x, y));
      v.indices = earcut(coords.flat(), holes, 2);
      const normals: number[] = [];
      VertexData.ComputeNormals(v.positions, v.indices, normals);
      v.normals = normals;
      v.applyToMesh(m);
      m.material = roofMat;
      m.parent = group;
      m.receiveShadows = true;
      m.isPickable = false;
      shadows.addShadowCaster(m);
    }
    // Gable end walls are generated from the entered house dimensions.
    const peak =
      s.eaves +
      (s.roof === "flat"
        ? 0
        : (Math.tan(radians(s.pitch)) * s.depth) /
          (s.roof === "gable" ? 2 : 1));
    if (s.roof !== "flat")
      for (const side of [-1, 1]) {
        const centre = scale(u, (s.width / 2) * side),
          v = [
            add(centre, add(scale(front, s.depth / 2), [0, s.eaves, 0])),
            add(
              centre,
              add(scale(front, s.roof === "mono" ? -s.depth / 2 : 0), [
                0,
                peak,
                0,
              ]),
            ),
            add(centre, add(scale(front, -s.depth / 2), [0, s.eaves, 0])),
          ];
        const m = new Mesh("gable wall", scene),
          d = new VertexData();
        d.positions = v.flat();
        d.indices = [0, 1, 2];
        const n: number[] = [];
        VertexData.ComputeNormals(d.positions, d.indices, n);
        d.normals = n;
        d.applyToMesh(m);
        m.parent = group;
        m.material = walls;
        m.isPickable = false;
        shadows.addShadowCaster(m);
      }
    if (s.roof === "mono") {
      box(
        "high wall",
        [s.width, Math.max(0.01, peak - s.eaves), 0.12],
        add(scale(front, -s.depth / 2), [0, (peak + s.eaves) / 2, 0]),
        walls,
        a,
      );
    }
    for (const side of [-1, 1])
      for (let col = -1; col <= 1; col++) {
        const pos = add(
          scale(u, col * s.width * 0.26),
          add(scale(front, side * (s.depth / 2 + 0.06)), [
            0,
            Math.min(1.6, s.eaves * 0.55),
            0,
          ]),
        );
        box("window frame", [1.25, 1.2, 0.1], pos, wood, a);
        box("window", [1.1, 1.06, 0.13], pos, glass, a);
        box("window mullion", [0.06, 1.08, 0.15], pos, walls, a);
      }
    box(
      "front door",
      [0.95, Math.min(2.15, s.eaves), 0.16],
      add(
        scale(front, s.depth / 2 + 0.08),
        add(scale(u, -s.width * 0.1), [0, Math.min(2.15, s.eaves) / 2, 0]),
      ),
      wood,
      a,
    );
    box(
      "entry path",
      [1.5, 0.05, 5],
      add(scale(front, s.depth / 2 + 2.5), [0, 0, 0]),
      concrete,
      a,
    );
    for (const surface of plan.surfaces) {
      const outline = surface.outer.map(([x, y]) =>
        Vector3.FromArray(add(point3(surface, x, y), [0, 0.035, 0])),
      );
      outline.push(outline[0]);
      const boundary = MeshBuilder.CreateLines(
        "surface boundary",
        { points: outline },
        scene,
      );
      boundary.color = Color3.FromHexString("#71835c");
      boundary.parent = group;
      boundary.isPickable = false;
      for (const hole of surface.holes) {
        const p = hole.map(([x, y]) =>
          Vector3.FromArray(add(point3(surface, x, y), [0, 0.14, 0])),
        );
        p.push(p[0]);
        const m = MeshBuilder.CreateLines(
          "exclusion boundary",
          { points: p },
          scene,
        );
        m.color = Color3.FromHexString("#9b683d");
        m.parent = group;
        m.isPickable = false;
        const xs = hole.map((v) => v[0]),
          ys = hole.map((v) => v[1]);
        const center = point3(
          surface,
          (Math.min(...xs) + Math.max(...xs)) / 2,
          (Math.min(...ys) + Math.max(...ys)) / 2,
        );
        box(
          "exclusion marker",
          [0.45, surface.kind === "roof" ? 0.8 : 0.18, 0.45],
          add(center, [0, surface.kind === "roof" ? 0.4 : 0.09, 0]),
          obstacleMat,
        );
      }
    }
    for (const p of plan.panels) {
      const surface = plan.surfaces.find((s) => s.id === p.surfaceId)!;
      const corners = panelCorners(surface, p);
      const mesh = quad(p.id, corners, panelMat);
      mesh.isPickable = true;
      mesh.metadata = { panelId: p.id };
      panelMeshes.set(p.id, mesh);
      if (surface.kind === "ground") {
        for (const [x, y] of [
          [p.x + 0.12, p.y + 0.1],
          [p.x + p.width - 0.12, p.y + p.depth - 0.1],
        ]) {
          const base = point3(surface, x, y),
            height =
              0.7 +
              ((y - p.y) / p.depth) * p.slopeLength * Math.sin(radians(p.tilt));
          box(
            "ground support",
            [0.055, height, 0.055],
            add(base, [0, height / 2, 0]),
            wood,
          );
        }
      }
    }
    for (const [x, z, h] of [
      [-s.width / 2 - 4, -s.depth / 2 - 3, 4.7],
      [-s.width / 2 - 5, s.depth / 2 + 3, 3.7],
      [s.width / 2 + 3, -s.depth / 2 - 5, 4.2],
    ])
      tree(x, z, h);
    shadows.getShadowMap()?.resetRefreshCounter();
  }
  scene.onPointerObservable.add((info) => {
    if (
      info.type === PointerEventTypes.POINTERPICK &&
      info.pickInfo?.pickedMesh?.metadata?.panelId
    )
      onPick(info.pickInfo.pickedMesh.metadata.panelId);
  });
  const resize = new ResizeObserver(() => engine.resize());
  resize.observe(canvas);
  engine.runRenderLoop(() => scene.render());
  return {
    update(plan: StudioPlan, selected: string) {
      if (current !== plan) {
        rebuild(plan);
        if (!current) {
          camera.target.set(plan.settings.width * 0.6, 2, 0);
          camera.radius = Math.max(
            38,
            (plan.settings.width + plan.settings.groundWidth + 9) * 1.3,
          );
        }
        current = plan;
      }
      for (const [id, m] of panelMeshes)
        m.material = id === selected ? selectedMat : panelMat;
    },
    reset() {
      camera.alpha = -1.1;
      camera.beta = 1.04;
      camera.target.set((current?.settings.width ?? 12) * 0.6, 2, 0);
      camera.radius = Math.max(
        38,
        ((current?.settings.width ?? 12) +
          (current?.settings.groundWidth ?? 12) +
          9) *
          1.3,
      );
    },
    setSun(altitude: number, azimuth: number) {
      const alt = radians(altitude),
        az = radians(azimuth);
      sun.direction.set(
        -Math.sin(az) * Math.cos(alt),
        -Math.sin(alt),
        -Math.cos(az) * Math.cos(alt),
      );
      sun.position = sun.direction.scale(-60);
      shadows.getShadowMap()?.resetRefreshCounter();
    },
    capture() {
      scene.render();
      return canvas.toDataURL("image/png");
    },
    dispose() {
      resize.disconnect();
      scene.dispose();
      engine.dispose();
    },
  };
}
