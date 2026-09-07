import unittest

import cv2
import numpy as np

from app import isolate_seeded_component, plane_candidates, plane_candidates_from_mask, prompted_local_segment


class RoofVisionAlgorithmsTest(unittest.TestCase):
    def test_prompted_segmentation_finds_bright_roof(self):
        image = np.full((240, 320, 3), 35, np.uint8)
        polygon = np.array([[75, 55], [245, 65], [230, 190], [85, 180]], np.int32)
        cv2.fillPoly(image, [polygon], (185, 185, 185))
        result, confidence, _ = prompted_local_segment(
            image,
            {"bbox": [0.18, 0.14, 0.82, 0.88], "positivePoints": [[0.5, 0.5]], "negativePoints": [], "coordinates": "normalized"},
        )
        self.assertGreaterEqual(len(result), 4)
        self.assertGreater(confidence, 0.4)

    def test_dsm_plane_fitting_recovers_pitch(self):
        rows, cols = np.indices((140, 180))
        pixel_size = 0.5
        slope = np.tan(np.deg2rad(25))
        dsm = 20 + cols * pixel_size * slope
        planes = plane_candidates(dsm, [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]], pixel_size, 0.05, 2, 100)
        self.assertTrue(planes)
        self.assertAlmostEqual(planes[0]["pitchDegrees"], 25, delta=0.5)
        self.assertGreater(planes[0]["confidence"], 0.7)

    def test_seeded_mask_isolates_selected_building_before_plane_fitting(self):
        rows, cols = np.indices((160, 220))
        dsm = 30 + cols * 0.1 * np.tan(np.deg2rad(18))
        mask = np.zeros_like(dsm, dtype=np.uint8)
        mask[35:125, 65:155] = 255
        mask[20:80, 175:215] = 255
        selected, diagnostics = isolate_seeded_component(mask, 80, 110)
        self.assertEqual(int(np.count_nonzero(selected)), 90 * 90)
        self.assertEqual(diagnostics["componentCount"], 2)
        planes = plane_candidates_from_mask(dsm, selected, 0.1, 0.05, 2, 100)
        self.assertTrue(planes)
        self.assertAlmostEqual(planes[0]["pitchDegrees"], 18, delta=0.5)


if __name__ == "__main__":
    unittest.main()
