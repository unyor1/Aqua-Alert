import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { EvacCenter } from "../../data/evac_centers";
import { haversineDistanceKm } from "../../utils/geo";
import { supabase } from "../../utils/supabase/client";

type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  address?: Record<string, string>;
};

export default function EvacFinder() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NominatimPlace | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [suggestedPlaces, setSuggestedPlaces] = useState<Array<{ id: string; name: string; lat: number; lon: number; type?: string; distanceKm?: number }>>([]);
  const [officialCenters, setOfficialCenters] = useState<EvacCenter[]>([]);
  const [officialNearest, setOfficialNearest] = useState<Array<{ id: string; name: string; distanceKm: number }>>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.from<EvacCenter>("evac_centers").select("*");
        if (error) {
          if (mounted) setOfficialCenters([]);
          return;
        }
        if (mounted) setOfficialCenters(data && data.length ? data : []);
      } catch (err) {
        if (mounted) setOfficialCenters([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const search = async () => {
    setError(null);
    setResults([]);
    setSelected(null);
    setSuggestedPlaces([]);
    setOfficialNearest([]);
    if (!query.trim()) return;
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph&limit=6&addressdetails=1`;
      const resp = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "FloodAlertApp/1.0 (contact@yourdomain.com)" } });
      if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
      const data = (await resp.json()) as NominatimPlace[];
      setResults(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyFacilities = async (lat: number, lon: number, radius = 2500) => {
    setSuggestedPlaces([]);
    try {
      const query = `[
out:json][timeout:25];
(
  node(around:${radius},${lat},${lon})["amenity"="school"];
  node(around:${radius},${lat},${lon})["amenity"="community_centre"];
  node(around:${radius},${lat},${lon})["amenity"="townhall"];
  node(around:${radius},${lat},${lon})["amenity"="village_hall"];
  node(around:${radius},${lat},${lon})["building"="public"];
  node(around:${radius},${lat},${lon})["building"="hall"];
);
out center;`;
      const isDev = import.meta.env.DEV;
      const resp = await fetch('/api/overpass', {
        method: 'POST',
        headers: isDev ? { 'Content-Type': 'text/plain' } : { 'Content-Type': 'application/json' },
        body: isDev ? query : JSON.stringify({ query }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.elements) return;
      const items = data.elements
        .map((el: any) => {
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (!elLat || !elLon) return null;
          const name = el.tags?.name || el.tags?.ref || `${el.tags?.amenity || el.tags?.leisure || el.tags?.sport || 'facility'}`;
          const type = el.tags?.amenity || el.tags?.leisure || el.tags?.sport || '';
          const distanceKm = Math.round(haversineDistanceKm(lat, lon, elLat, elLon) * 100) / 100;
          return { id: String(el.id), name, lat: elLat, lon: elLon, type, distanceKm };
        })
        .filter(Boolean) as Array<{ id: string; name: string; lat: number; lon: number; type?: string; distanceKm?: number }>;
      items.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
      setSuggestedPlaces(items.slice(0, 8));
    } catch (err) {
      console.warn("Overpass failed", err);
    }
  };

  const computeOfficialNearest = (lat: number, lon: number) => {
    if (!officialCenters || officialCenters.length === 0) return setOfficialNearest([]);
    const all = officialCenters.map((c) => ({
      id: c.device_id || c.id || `${c.lat}-${c.lng}`,
      name: (c as any).name || c.device_id || 'Evac Center',
      distanceKm: Math.round(haversineDistanceKm(lat, lon, c.lat, c.lng) * 100) / 100,
    }));
    all.sort((a, b) => a.distanceKm - b.distanceKm);
    setOfficialNearest(all.slice(0, 3));
  };

  const onSelect = (p: NominatimPlace) => {
    setSelected(p);
    const lat = parseFloat(p.lat);
    const lon = parseFloat(p.lon);
    void fetchNearbyFacilities(lat, lon);
    computeOfficialNearest(lat, lon);
  };

  const useMyLocation = () => {
    setError(null);
    setResults([]);
    setSelected(null);
    setSuggestedPlaces([]);
    setOfficialNearest([]);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserCoords({ lat, lon });
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&zoom=14`;
          const resp = await fetch(url, { headers: { Accept: "application/json" } });
          if (resp.ok) {
            const data = await resp.json();
            const place = {
              place_id: data.place_id || Date.now(),
              display_name: data.display_name || `${lat}, ${lon}`,
              lat: String(lat),
              lon: String(lon),
            } as NominatimPlace;
            setSelected(place);
          }
        } catch (err) {
          console.warn("Reverse geocode failed", err);
          setSelected({ place_id: Date.now(), display_name: `${lat}, ${lon}`, lat: String(lat), lon: String(lon) });
        } finally {
          setLoading(false);
        }
        // fetch suggestions and official centers
        void fetchNearbyFacilities(lat, lon);
        computeOfficialNearest(lat, lon);
      },
      (err) => {
        setLoading(false);
        setError(err.message || "Unable to retrieve your location");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const onSelectSuggested = (item: { id: string; name: string; lat: number; lon: number; distanceKm?: number }) => {
    setSelected({ place_id: Number(item.id), display_name: item.name, lat: String(item.lat), lon: String(item.lon) });
    computeOfficialNearest(item.lat, item.lon);
    void fetchNearbyFacilities(item.lat, item.lon);
  };

  return (
    <div className="min-h-full py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">Find Nearest Evacuation Center (Philippines)</h1>

        <div className="mb-4 flex gap-2">
          <Input placeholder="Search place, barangay, city, or address" value={query} onChange={(e: any) => setQuery(e.target.value)} />
          <Button onClick={search} disabled={loading}>{loading ? "Searching..." : "Search"}</Button>
        </div>

        {error && <div className="text-red-600 mb-4">{error}</div>}

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Results & Suggestions</CardTitle>
              <CardDescription>Choose the place or a nearby facility</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {suggestedPlaces.length > 0 && results.length === 0 && !userCoords && (
                  <div>
                    <div className="text-sm text-gray-600">Nearby facilities (schools, multipurpose halls)</div>
                    <div className="space-y-1 mt-2">
                      {suggestedPlaces.map((s) => (
                        <div key={s.id} className="p-2 rounded hover:bg-gray-50 cursor-pointer" onClick={() => onSelectSuggested(s)}>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.type || ''} • {s.distanceKm} km</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.length === 0 ? (<div className="text-gray-500">No results yet.</div>) : (
                  results.map((r) => (
                    <div key={r.place_id} className="p-2 rounded hover:bg-gray-50 cursor-pointer" onClick={() => onSelect(r)}>
                      <div className="font-medium">{r.display_name.split(",")[0]}</div>
                      <div className="text-xs text-gray-500">{r.display_name}</div>
                    </div>
                  ))
                )}

                <div className="mt-3">
                  <Button onClick={useMyLocation} disabled={loading}>Use my location</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evacuation Recommendations</CardTitle>
              <CardDescription>Nearby suggested facilities</CardDescription>
            </CardHeader>
            <CardContent>
              {selected ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600">Selected place</div>
                    <div className="font-medium">{selected.display_name}</div>
                    <div className="text-xs text-gray-500">lat: {selected.lat}, lon: {selected.lon}</div>
                  </div>

                  {officialNearest && officialNearest.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-600">Official evacuation centers (closest)</div>
                      <ol className="list-decimal list-inside space-y-2 mt-2">
                        {officialNearest.map((n) => (
                          <li key={n.id}>
                            <div className="font-medium">{n.name}</div>
                            <div className="text-xs text-gray-500">Distance: {n.distanceKm} km</div>
                            <div className="mt-1">
                              <a className="text-blue-600 underline" href={`https://www.google.com/maps/dir/?api=1&origin=${selected?.lat},${selected?.lon}&destination=${encodeURIComponent(n.name)}`} target="_blank" rel="noreferrer">Open directions in Google Maps</a>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {suggestedPlaces.length > 0 ? (
                    <div>
                      <div className="text-sm text-gray-600">Suggested evacuation points (closest first)</div>
                      <ol className="list-decimal list-inside space-y-2 mt-2">
                        {suggestedPlaces.map((s) => (
                          <li key={s.id}>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-gray-500">{s.type || 'facility'} • {s.distanceKm} km</div>
                            <div className="mt-1">
                              <a className="text-blue-600 underline" href={`https://www.google.com/maps/dir/?api=1&origin=${selected?.lat},${selected?.lon}&destination=${s.lat},${s.lon}`} target="_blank" rel="noreferrer">Open directions in Google Maps</a>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    <div className="text-gray-500">Select a place or use your location to see nearby schools, gyms, or courts that can be used as evacuation points.</div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500">No place selected.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
