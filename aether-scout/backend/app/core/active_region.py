import asyncio

from app.core.regions import DEFAULT_REGION, REGIONS


class ActiveRegionStore:
    def __init__(self):
        self._region_id = DEFAULT_REGION
        self._listeners: list[asyncio.Queue] = []

    @property
    def region_id(self) -> str:
        return self._region_id

    @property
    def config(self) -> dict:
        return REGIONS[self._region_id]

    @property
    def bbox(self) -> list[float]:
        return self.config["bbox"]

    async def set_region(self, region_id: str) -> dict:
        if region_id not in REGIONS:
            raise ValueError(f"Unknown region: {region_id}")
        self._region_id = region_id
        for q in self._listeners:
            await q.put(region_id)
        return self.config

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._listeners.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        if q in self._listeners:
            self._listeners.remove(q)


active_region = ActiveRegionStore()
