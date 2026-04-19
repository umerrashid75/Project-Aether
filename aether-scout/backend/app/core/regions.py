REGIONS = {
    "english_channel": {
        "label": "English Channel",
        "bbox": [49.5, -2.0, 51.5, 2.5],
        "center": [51.0, 0.5],
        "zoom": 8,
        "opensky_quality": "excellent",
        "ais_quality": "excellent",
        "description": "World's busiest shipping lane",
        "demo_recommended": False,
    },
    "north_sea": {
        "label": "North Sea",
        "bbox": [51.5, 2.0, 53.5, 6.0],
        "center": [52.5, 4.0],
        "zoom": 7,
        "opensky_quality": "excellent",
        "ais_quality": "excellent",
        "description": "Rotterdam-Antwerp energy corridor",
        "demo_recommended": False,
    },
    "mediterranean_west": {
        "label": "Western Mediterranean",
        "bbox": [36.0, -5.5, 44.0, 9.0],
        "center": [40.0, 2.0],
        "zoom": 6,
        "opensky_quality": "excellent",
        "ais_quality": "very_good",
        "description": "Gibraltar to Sardinia trade route",
        "demo_recommended": False,
    },
    "us_east_coast": {
        "label": "US East Coast",
        "bbox": [40.0, -74.5, 42.5, -69.5],
        "center": [41.0, -72.0],
        "zoom": 7,
        "opensky_quality": "excellent",
        "ais_quality": "excellent",
        "description": "New York–Boston maritime corridor",
        "demo_recommended": False,
    },
    "gibraltar": {
        "label": "Strait of Gibraltar",
        "bbox": [35.5, -6.5, 36.5, -4.5],
        "center": [36.0, -5.5],
        "zoom": 9,
        "opensky_quality": "good",
        "ais_quality": "very_good",
        "description": "Atlantic-Mediterranean gateway",
        "demo_recommended": False,
    },
    "bosphorus": {
        "label": "Bosphorus Strait",
        "bbox": [40.9, 28.9, 41.3, 29.2],
        "center": [41.1, 29.05],
        "zoom": 11,
        "opensky_quality": "good",
        "ais_quality": "excellent",
        "description": "Istanbul - Black Sea chokepoint",
        "demo_recommended": False,
    },
    "us_west_coast": {
        "label": "Los Angeles / Long Beach",
        "bbox": [32.5, -118.5, 34.5, -116.5],
        "center": [33.5, -117.5],
        "zoom": 8,
        "opensky_quality": "excellent",
        "ais_quality": "good",
        "description": "Busiest container port in North America",
        "demo_recommended": False,
    },
    "strait_of_hormuz": {
        "label": "Strait of Hormuz",
        "bbox": [25.0, 54.0, 28.0, 59.0],
        "center": [26.6, 56.5],
        "zoom": 8,
        "opensky_quality": "poor",
        "ais_quality": "poor",
        "description": "Persian Gulf - recommend demo mode",
        "demo_recommended": True,
    },
}

DEFAULT_REGION = "english_channel"


def get_region(region_id: str):
    return REGIONS.get(region_id)


def get_all_regions():
    return REGIONS
