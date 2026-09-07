from __future__ import annotations

import json
import math
import os
import tempfile
from pathlib import Path
from typing import Any, Literal

import cv2
import numpy as np
import rasterio
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from rasterio.io import MemoryFile
from rasterio.warp import transform as transform_coordinates


MAX_UPLOAD_BYTES = int(os.getenv("ROOF_VISION_MAX_UPLOAD_BYTES", str(80 * 1024 * 1024)))
SAMGEO_MODEL_TYPE = os.getenv("SAMGEO_MODEL_TYPE", "vit_b")
SAMGEO_CHECKPOINT = os.getenv("SAMGEO_CHECKPOINT", "").strip()
ALLOWED_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/tiff",
    "image/geotiff",
    "application/octet-stream",
}

try:
    from samgeo import SamGeo  # type: ignore

    SAMGEO_AVAILABLE = True
except Exception:
    SamGeo = None
    SAMGEO_AVAILABLE = False


app = FastAPI(title="Solar4U Roof Vision", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGIN", "http://localhost:3000").split(",")],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def capabilities() -> dict[str, Any]:
    return {
        "service": "roof-vision",
        "version": "1.0.0",
        "backends": {
            "promptedLocal": True,
            "dsmPlaneFitting": True,
            "samgeo": SAMGEO_AVAILABLE,
        },
        "acceptedImagery": ["PNG", "JPEG", "GeoTIFF"],
        "acceptedSurfaceModels": ["GeoTIFF DSM", "NumPy NPY DSM"],
        "maxUploadBytes": MAX_UPLOAD_BYTES,
        "requiresSourcePermission": True,
        "georeferencedResults": True,
        "notes": [
            "The local backend requires a box or point prompt and never claims unattended roof detection.",
            "GeoTIFF inputs can return WGS84 polygons; ordinary images return image-relative polygons.",
            "SamGeo is optional and is not installed in the default CPU image.",
        ],
    }


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> dict[str, Any]:
    return {"status": "ready", "capabilities": capabilities()}


@app.get("/v1/roof-vision/capabilities")
def get_capabilities() -> dict[str, Any]:
    return {"data": capabilities()}


async def read_upload(upload: UploadFile) -> bytes:
    payload = await upload.read(MAX_UPLOAD_BYTES + 1)
    if not payload:
        raise HTTPException(422, "empty_upload")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "upload_too_large")
    return payload


def require_permission(source_consent: bool, source_license: str) -> str:
    if not source_consent:
        raise HTTPException(403, "source_permission_confirmation_required")
    source = source_license.strip()
    if len(source) < 3:
        raise HTTPException(422, "source_license_or_provenance_required")
    return source


def parse_prompt(raw: str) -> dict[str, Any]:
    try:
        prompt = json.loads(raw or "{}")
    except json.JSONDecodeError as error:
        raise HTTPException(422, f"invalid_prompt_json: {error.msg}") from error
    bbox = prompt.get("bbox")
    positive = prompt.get("positivePoints") or []
    negative = prompt.get("negativePoints") or []
    if not bbox and not positive:
        raise HTTPException(422, "prompt_required: provide bbox or positivePoints")
    if bbox and (not isinstance(bbox, list) or len(bbox) != 4):
        raise HTTPException(422, "bbox_must_have_four_coordinates")
    return {"bbox": bbox, "positivePoints": positive, "negativePoints": negative, "coordinates": prompt.get("coordinates", "normalized")}


def decode_image(payload: bytes, filename: str) -> tuple[np.ndarray, dict[str, Any] | None]:
    suffix = Path(filename or "").suffix.lower()
    if suffix in {".tif", ".tiff"}:
        try:
            with MemoryFile(payload) as memory_file:
                with memory_file.open() as dataset:
                    count = min(3, dataset.count)
                    bands = dataset.read(list(range(1, count + 1)))
                    if count == 1:
                        bands = np.repeat(bands, 3, axis=0)
                    image = np.moveaxis(bands[:3], 0, 2)
                    image = normalize_uint8(image)
                    geo = {
                        "transform": dataset.transform,
                        "crs": dataset.crs,
                        "width": dataset.width,
                        "height": dataset.height,
                    }
                    return cv2.cvtColor(image, cv2.COLOR_RGB2BGR), geo
        except Exception as error:
            raise HTTPException(422, f"invalid_geotiff: {error}") from error
    encoded = np.frombuffer(payload, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(422, "unsupported_or_corrupt_image")
    return image, None


def normalize_uint8(values: np.ndarray) -> np.ndarray:
    values = np.nan_to_num(values.astype(np.float32))
    low, high = np.percentile(values, [2, 98])
    if high <= low:
        high = low + 1
    return np.clip((values - low) * 255 / (high - low), 0, 255).astype(np.uint8)


def prompt_pixels(prompt: dict[str, Any], width: int, height: int) -> dict[str, Any]:
    normalized = prompt.get("coordinates") != "pixels"

    def point(value: list[float]) -> tuple[int, int]:
        x = float(value[0]) * width if normalized else float(value[0])
        y = float(value[1]) * height if normalized else float(value[1])
        return max(0, min(width - 1, round(x))), max(0, min(height - 1, round(y)))

    bbox = None
    if prompt.get("bbox"):
        x0, y0 = point(prompt["bbox"][:2])
        x1, y1 = point(prompt["bbox"][2:])
        bbox = [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)]
    return {
        "bbox": bbox,
        "positivePoints": [point(item) for item in prompt.get("positivePoints", [])],
        "negativePoints": [point(item) for item in prompt.get("negativePoints", [])],
    }


def largest_polygon(mask: np.ndarray) -> tuple[np.ndarray, float, float]:
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise HTTPException(422, "no_candidate_polygon_found")
    contour = max(contours, key=cv2.contourArea)
    area = float(cv2.contourArea(contour))
    if area < 25:
        raise HTTPException(422, "candidate_polygon_too_small")
    perimeter = cv2.arcLength(contour, True)
    simplified = cv2.approxPolyDP(contour, max(1.5, perimeter * 0.008), True).reshape(-1, 2)
    hull_area = max(area, float(cv2.contourArea(cv2.convexHull(contour))))
    solidity = area / hull_area
    return simplified, area, solidity


def prompted_local_segment(image: np.ndarray, prompt: dict[str, Any]) -> tuple[np.ndarray, float, dict[str, Any]]:
    height, width = image.shape[:2]
    pixels = prompt_pixels(prompt, width, height)
    mask = np.full((height, width), cv2.GC_BGD, dtype=np.uint8)
    rect = None
    if pixels["bbox"]:
        x0, y0, x1, y1 = pixels["bbox"]
        if x1 - x0 < 4 or y1 - y0 < 4:
            raise HTTPException(422, "bbox_too_small")
        rect = (x0, y0, x1 - x0, y1 - y0)
        mask[y0:y1, x0:x1] = cv2.GC_PR_FGD
        mode = cv2.GC_INIT_WITH_MASK
    else:
        mask[:] = cv2.GC_PR_BGD
        mode = cv2.GC_INIT_WITH_MASK
    for x, y in pixels["positivePoints"]:
        cv2.circle(mask, (x, y), max(2, min(width, height) // 100), cv2.GC_FGD, -1)
    for x, y in pixels["negativePoints"]:
        cv2.circle(mask, (x, y), max(2, min(width, height) // 100), cv2.GC_BGD, -1)
    bg_model = np.zeros((1, 65), np.float64)
    fg_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(image, mask, rect, bg_model, fg_model, 7, mode)
    binary = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    kernel = np.ones((5, 5), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
    polygon, area, solidity = largest_polygon(binary)
    bbox_area = width * height
    if pixels["bbox"]:
        x0, y0, x1, y1 = pixels["bbox"]
        bbox_area = max(1, (x1 - x0) * (y1 - y0))
    coverage = min(1.0, area / max(1, bbox_area))
    confidence = round(min(0.92, max(0.25, 0.35 + 0.4 * solidity + 0.2 * coverage)), 3)
    return polygon, confidence, {"solidity": round(solidity, 3), "promptCoverage": round(coverage, 3)}


def samgeo_segment(payload: bytes, filename: str, prompt: dict[str, Any], image: np.ndarray) -> tuple[np.ndarray, float, dict[str, Any]]:
    if not SAMGEO_AVAILABLE or SamGeo is None:
        raise HTTPException(503, "samgeo_backend_not_installed")
    height, width = image.shape[:2]
    pixels = prompt_pixels(prompt, width, height)
    suffix = Path(filename or "image.tif").suffix or ".tif"
    with tempfile.TemporaryDirectory(prefix="solar4u-samgeo-") as temp_dir:
        source_path = Path(temp_dir) / f"source{suffix}"
        output_path = Path(temp_dir) / "mask.tif"
        source_path.write_bytes(payload)
        kwargs: dict[str, Any] = {"model_type": SAMGEO_MODEL_TYPE, "automatic": False}
        if SAMGEO_CHECKPOINT:
            kwargs["checkpoint"] = SAMGEO_CHECKPOINT
        model = SamGeo(**kwargs)
        model.set_image(str(source_path))
        point_coords = pixels["positivePoints"] + pixels["negativePoints"]
        point_labels = [1] * len(pixels["positivePoints"]) + [0] * len(pixels["negativePoints"])
        box = pixels["bbox"]
        model.predict(
            point_coords=point_coords or None,
            point_labels=point_labels or None,
            box=box,
            multimask_output=False,
            output=str(output_path),
        )
        with rasterio.open(output_path) as dataset:
            binary = np.where(dataset.read(1) > 0, 255, 0).astype(np.uint8)
    polygon, area, solidity = largest_polygon(binary)
    confidence = round(min(0.98, max(0.45, 0.55 + 0.4 * solidity)), 3)
    return polygon, confidence, {"solidity": round(solidity, 3), "maskPixels": int(area), "modelType": SAMGEO_MODEL_TYPE}


def polygon_payload(points: np.ndarray, width: int, height: int, geo: dict[str, Any] | None) -> dict[str, Any]:
    pixels = [[int(x), int(y)] for x, y in points]
    normalized = [[round(float(x) / width, 6), round(float(y) / height, 6)] for x, y in points]
    result: dict[str, Any] = {"pixelPolygon": pixels, "normalizedPolygon": normalized}
    if geo and geo.get("crs"):
        rows = [int(y) for x, y in points]
        cols = [int(x) for x, y in points]
        world = [rasterio.transform.xy(geo["transform"], row, col, offset="center") for row, col in zip(rows, cols)]
        xs, ys = zip(*world)
        lngs, lats = transform_coordinates(geo["crs"], "EPSG:4326", list(xs), list(ys))
        ring = [[round(lng, 8), round(lat, 8)] for lng, lat in zip(lngs, lats)]
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])
        result["geoPolygon"] = {"type": "Polygon", "coordinates": [ring]}
    return result


@app.post("/v1/roof-vision/segment")
async def segment(
    image: UploadFile = File(...),
    prompt: str = Form(...),
    backend: Literal["auto", "local", "samgeo"] = Form("auto"),
    source_consent: bool = Form(False),
    source_license: str = Form(""),
) -> dict[str, Any]:
    provenance = require_permission(source_consent, source_license)
    if image.content_type and image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(415, "unsupported_image_type")
    parsed_prompt = parse_prompt(prompt)
    payload = await read_upload(image)
    decoded, geo = decode_image(payload, image.filename or "image")
    selected = "samgeo" if backend == "samgeo" or (backend == "auto" and SAMGEO_AVAILABLE) else "prompted-local"
    if selected == "samgeo":
        polygon, confidence, diagnostics = samgeo_segment(payload, image.filename or "image.tif", parsed_prompt, decoded)
    else:
        polygon, confidence, diagnostics = prompted_local_segment(decoded, parsed_prompt)
    result = polygon_payload(polygon, decoded.shape[1], decoded.shape[0], geo)
    return {
        "data": {
            "candidate": {**result, "confidence": confidence},
            "backend": selected,
            "reviewRequired": True,
            "diagnostics": diagnostics,
            "provenance": {"source": provenance, "permissionConfirmed": True, "filename": image.filename},
        }
    }


def load_dsm(payload: bytes, filename: str) -> tuple[np.ndarray, dict[str, Any] | None]:
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".npy":
        with tempfile.NamedTemporaryFile(suffix=".npy") as temp:
            temp.write(payload)
            temp.flush()
            return np.load(temp.name).astype(np.float64), None
    try:
        with MemoryFile(payload) as memory_file:
            with memory_file.open() as dataset:
                values = dataset.read(1).astype(np.float64)
                if dataset.nodata is not None:
                    values[values == dataset.nodata] = np.nan
                return values, {"transform": dataset.transform, "crs": dataset.crs, "width": dataset.width, "height": dataset.height}
    except Exception as error:
        raise HTTPException(422, f"invalid_dsm: {error}") from error


def load_mask(payload: bytes, filename: str) -> tuple[np.ndarray, dict[str, Any] | None]:
    try:
        with MemoryFile(payload) as memory_file:
            with memory_file.open() as dataset:
                values = dataset.read(1)
                return np.where(np.isfinite(values) & (values > 0), 255, 0).astype(np.uint8), {
                    "transform": dataset.transform,
                    "crs": dataset.crs,
                    "width": dataset.width,
                    "height": dataset.height,
                }
    except Exception as error:
        raise HTTPException(422, f"invalid_mask: {error}") from error


def seed_pixel(
    shape: tuple[int, int],
    geo: dict[str, Any] | None,
    latitude: float | None,
    longitude: float | None,
) -> tuple[int, int]:
    height, width = shape
    if geo and geo.get("crs") and latitude is not None and longitude is not None:
        xs, ys = transform_coordinates("EPSG:4326", geo["crs"], [longitude], [latitude])
        row, col = rasterio.transform.rowcol(geo["transform"], xs[0], ys[0])
        return max(0, min(height - 1, int(row))), max(0, min(width - 1, int(col)))
    return height // 2, width // 2


def isolate_seeded_component(mask: np.ndarray, row: int, col: int) -> tuple[np.ndarray, dict[str, Any]]:
    if mask.ndim != 2:
        raise HTTPException(422, "mask_must_be_single_band")
    binary = np.where(mask > 0, 1, 0).astype(np.uint8)
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if count <= 1:
        raise HTTPException(422, "building_mask_is_empty")
    label = int(labels[row, col])
    if label == 0:
        foreground_rows, foreground_cols = np.where(binary > 0)
        if not len(foreground_rows):
            raise HTTPException(422, "building_mask_is_empty")
        distances = (foreground_rows - row) ** 2 + (foreground_cols - col) ** 2
        nearest = int(np.argmin(distances))
        label = int(labels[foreground_rows[nearest], foreground_cols[nearest]])
        seed_distance = float(math.sqrt(float(distances[nearest])))
    else:
        seed_distance = 0.0
    component = np.where(labels == label, 255, 0).astype(np.uint8)
    component = cv2.morphologyEx(component, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
    return component, {
        "componentCount": int(count - 1),
        "selectedComponentPixels": int(stats[label, cv2.CC_STAT_AREA]),
        "selectedCentroidPixels": [round(float(centroids[label][0]), 2), round(float(centroids[label][1]), 2)],
        "seedPixel": [int(col), int(row)],
        "seedDistancePixels": round(seed_distance, 2),
    }


def rasterize_normalized_polygon(shape: tuple[int, int], polygon: list[list[float]]) -> np.ndarray:
    height, width = shape
    if len(polygon) < 3:
        raise HTTPException(422, "polygon_requires_at_least_three_points")
    points = np.array([[round(float(x) * (width - 1)), round(float(y) * (height - 1))] for x, y in polygon], np.int32)
    mask = np.zeros((height, width), np.uint8)
    cv2.fillPoly(mask, [points], 255)
    return mask


def fit_plane(points: np.ndarray) -> tuple[float, float, float]:
    coefficients, *_ = np.linalg.lstsq(np.c_[points[:, 0], points[:, 1], np.ones(len(points))], points[:, 2], rcond=None)
    return float(coefficients[0]), float(coefficients[1]), float(coefficients[2])


def plane_candidates(
    dsm: np.ndarray,
    polygon: list[list[float]],
    pixel_size_m: float,
    tolerance_m: float,
    max_planes: int,
    min_pixels: int,
) -> list[dict[str, Any]]:
    mask = rasterize_normalized_polygon(dsm.shape, polygon)
    return plane_candidates_from_mask(dsm, mask, pixel_size_m, tolerance_m, max_planes, min_pixels)


def plane_candidates_from_mask(
    dsm: np.ndarray,
    mask: np.ndarray,
    pixel_size_m: float,
    tolerance_m: float,
    max_planes: int,
    min_pixels: int,
) -> list[dict[str, Any]]:
    if mask.shape != dsm.shape:
        raise HTTPException(422, "mask_and_dsm_dimensions_must_match")
    rows, cols = np.where((mask > 0) & np.isfinite(dsm))
    if len(rows) < min_pixels:
        raise HTTPException(422, "not_enough_valid_dsm_samples")
    points = np.c_[cols * pixel_size_m, rows * pixel_size_m, dsm[rows, cols]]
    remaining = np.arange(len(points))
    rng = np.random.default_rng(416)
    results: list[dict[str, Any]] = []
    for _ in range(max_planes):
        if len(remaining) < min_pixels:
            break
        best: np.ndarray | None = None
        for _trial in range(180):
            sample_indices = rng.choice(remaining, 3, replace=False)
            sample = points[sample_indices]
            try:
                a, b, c = fit_plane(sample)
            except np.linalg.LinAlgError:
                continue
            residuals = np.abs(points[remaining, 2] - (a * points[remaining, 0] + b * points[remaining, 1] + c))
            inliers = remaining[residuals <= tolerance_m]
            if best is None or len(inliers) > len(best):
                best = inliers
        if best is None or len(best) < min_pixels:
            break
        a, b, c = fit_plane(points[best])
        residuals = points[best, 2] - (a * points[best, 0] + b * points[best, 1] + c)
        rmse = float(np.sqrt(np.mean(residuals**2)))
        component_mask = np.zeros(dsm.shape, np.uint8)
        best_cols = np.clip(np.round(points[best, 0] / pixel_size_m).astype(int), 0, dsm.shape[1] - 1)
        best_rows = np.clip(np.round(points[best, 1] / pixel_size_m).astype(int), 0, dsm.shape[0] - 1)
        component_mask[best_rows, best_cols] = 255
        component_mask = cv2.morphologyEx(component_mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=2)
        contour, area, solidity = largest_polygon(component_mask)
        pitch = math.degrees(math.atan(math.sqrt(a * a + b * b)))
        azimuth = (math.degrees(math.atan2(-a, -b)) + 360) % 360
        confidence = min(0.99, max(0.2, (1 - min(1.0, rmse / max(tolerance_m, 0.01))) * 0.55 + min(1, len(best) / len(points)) * 0.3 + solidity * 0.15))
        results.append({
            "normalizedPolygon": [[round(float(x) / dsm.shape[1], 6), round(float(y) / dsm.shape[0], 6)] for x, y in contour],
            "pitchDegrees": round(pitch, 2),
            "azimuthDegrees": round(azimuth, 2),
            "rmseMeters": round(rmse, 3),
            "sampleCount": int(len(best)),
            "confidence": round(confidence, 3),
            "areaPixels": round(area, 1),
            "areaMeters2": round(area * pixel_size_m * pixel_size_m, 2),
        })
        remaining = remaining[~np.isin(remaining, best)]
    return results


@app.post("/v1/roof-vision/solar-planes")
async def solar_planes(
    dsm: UploadFile = File(...),
    building_mask: UploadFile = File(...),
    center_latitude: float | None = Form(None),
    center_longitude: float | None = Form(None),
    pixel_size_m: float = Form(0.1),
    tolerance_m: float = Form(0.14),
    max_planes: int = Form(8),
    min_pixels: int = Form(180),
    source_consent: bool = Form(False),
    source_license: str = Form(""),
) -> dict[str, Any]:
    provenance = require_permission(source_consent, source_license)
    if pixel_size_m <= 0 or tolerance_m <= 0 or not 1 <= max_planes <= 24 or not 20 <= min_pixels <= 500000:
        raise HTTPException(422, "invalid_plane_fitting_parameters")
    dsm_payload, mask_payload = await read_upload(dsm), await read_upload(building_mask)
    surface, surface_geo = load_dsm(dsm_payload, dsm.filename or "surface.tif")
    source_mask, mask_geo = load_mask(mask_payload, building_mask.filename or "mask.tif")
    if source_mask.shape != surface.shape:
        raise HTTPException(422, "mask_and_dsm_dimensions_must_match")
    row, col = seed_pixel(source_mask.shape, mask_geo or surface_geo, center_latitude, center_longitude)
    selected_mask, diagnostics = isolate_seeded_component(source_mask, row, col)
    candidates = plane_candidates_from_mask(surface, selected_mask, pixel_size_m, tolerance_m, max_planes, min_pixels)
    for candidate in candidates:
        points = np.array([[x * surface.shape[1], y * surface.shape[0]] for x, y in candidate["normalizedPolygon"]])
        candidate.update(polygon_payload(points, surface.shape[1], surface.shape[0], surface_geo))
    footprint_points, footprint_area, footprint_solidity = largest_polygon(selected_mask)
    footprint = polygon_payload(footprint_points, surface.shape[1], surface.shape[0], surface_geo)
    return {
        "data": {
            "planes": candidates,
            "buildingFootprint": {
                **footprint,
                "areaPixels": round(footprint_area, 1),
                "areaMeters2": round(footprint_area * pixel_size_m * pixel_size_m, 2),
            },
            "reviewRequired": True,
            "backend": "masked-dsm-ransac-plane-fitting",
            "diagnostics": {**diagnostics, "footprintSolidity": round(footprint_solidity, 3)},
            "provenance": {
                "source": provenance,
                "permissionConfirmed": True,
                "dsmFilename": dsm.filename,
                "maskFilename": building_mask.filename,
            },
        }
    }


@app.post("/v1/roof-vision/planes")
async def planes(
    dsm: UploadFile = File(...),
    polygon: str = Form(...),
    pixel_size_m: float = Form(0.5),
    tolerance_m: float = Form(0.18),
    max_planes: int = Form(8),
    min_pixels: int = Form(80),
    source_consent: bool = Form(False),
    source_license: str = Form(""),
) -> dict[str, Any]:
    provenance = require_permission(source_consent, source_license)
    if pixel_size_m <= 0 or tolerance_m <= 0 or not 1 <= max_planes <= 24 or not 20 <= min_pixels <= 500000:
        raise HTTPException(422, "invalid_plane_fitting_parameters")
    try:
        parsed_polygon = json.loads(polygon)
    except json.JSONDecodeError as error:
        raise HTTPException(422, "invalid_polygon_json") from error
    payload = await read_upload(dsm)
    surface, geo = load_dsm(payload, dsm.filename or "surface.tif")
    candidates = plane_candidates(surface, parsed_polygon, pixel_size_m, tolerance_m, max_planes, min_pixels)
    for candidate in candidates:
        points = np.array([[x * surface.shape[1], y * surface.shape[0]] for x, y in candidate["normalizedPolygon"]])
        candidate.update(polygon_payload(points, surface.shape[1], surface.shape[0], geo))
    return {
        "data": {
            "planes": candidates,
            "reviewRequired": True,
            "backend": "dsm-ransac-plane-fitting",
            "provenance": {"source": provenance, "permissionConfirmed": True, "filename": dsm.filename},
        }
    }
