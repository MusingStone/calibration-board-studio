"""Regenerate the bundled marker codebooks from OpenCV's predefined dictionaries.

Requires opencv-contrib-python and writes src/data/markers.json. The browser does
not depend on OpenCV: this is only a development utility.
"""
import json
from pathlib import Path
import cv2

aruco = cv2.aruco
families = {
    "DICT_4X4_50": aruco.DICT_4X4_50,
    "DICT_5X5_100": aruco.DICT_5X5_100,
    "DICT_6X6_250": aruco.DICT_6X6_250,
    "DICT_7X7_50": aruco.DICT_7X7_50,
    "DICT_7X7_100": aruco.DICT_7X7_100,
    "DICT_7X7_250": aruco.DICT_7X7_250,
    "APRILTAG_16H5": aruco.DICT_APRILTAG_16h5,
    "APRILTAG_25H9": aruco.DICT_APRILTAG_25h9,
    "APRILTAG_36H10": aruco.DICT_APRILTAG_36h10,
    "APRILTAG_36H11": aruco.DICT_APRILTAG_36h11,
}
result = {}
for name, kind in families.items():
    dictionary = aruco.getPredefinedDictionary(kind)
    size = dictionary.markerSize
    codes = []
    for marker_id in range(dictionary.bytesList.shape[0]):
        image = aruco.generateImageMarker(dictionary, marker_id, size + 2, borderBits=1)
        codes.append("".join("1" if pixel < 128 else "0" for row in image[1:-1, 1:-1] for pixel in row))
    result[name] = {"size": size, "codes": codes}
Path("src/data/markers.json").write_text(json.dumps(result, separators=(",", ":")))
print({name: len(data["codes"]) for name, data in result.items()})
