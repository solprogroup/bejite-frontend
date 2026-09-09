import { useState, useMemo, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";

const GEO_URL = "/world-countries-110m.json";

// Country name normalization map for matching API data to TopoJSON names
const COUNTRY_NAME_MAP = {
  "usa": "United States of America",
  "us": "United States of America",
  "united states": "United States of America",
  "uk": "United Kingdom",
  "united kingdom": "United Kingdom",
  "uae": "United Arab Emirates",
  "south korea": "South Korea",
  "north korea": "North Korea",
  "czech republic": "Czechia",
  "ivory coast": "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  "congo": "Dem. Rep. Congo",
  "democratic republic of congo": "Dem. Rep. Congo",
  "dr congo": "Dem. Rep. Congo",
  "republic of congo": "Congo",
  "eswatini": "eSwatini",
  "swaziland": "eSwatini",
  "hong kong s.a.r.": "China",
  "hong kong": "China",
  "macau": "China",
  "taiwan": "Taiwan",
  "palestine": "Palestine",
  "gambia": "Gambia",
  "the gambia": "Gambia",
  "cabo verde": "Cape Verde",
  "timor-leste": "Timor-Leste",
  "east timor": "Timor-Leste",
  "myanmar": "Myanmar",
  "burma": "Myanmar",
  "laos": "Laos",
  "russia": "Russia",
  "south sudan": "S. Sudan",
  "s. sudan": "S. Sudan",
  "central african republic": "Central African Rep.",
  "dominican republic": "Dominican Rep.",
  "equatorial guinea": "Eq. Guinea",
  "western sahara": "W. Sahara",
  "bosnia and herzegovina": "Bosnia and Herz.",
  "bosnia": "Bosnia and Herz.",
  "north macedonia": "Macedonia",
  "macedonia": "Macedonia",
  "sierra leone": "Sierra Leone",
  "guinea-bissau": "Guinea-Bissau",
  "burkina faso": "Burkina Faso",
  "trinidad and tobago": "Trinidad and Tobago",
  "solomon islands": "Solomon Is.",
  "papua new guinea": "Papua New Guinea",
  "new zealand": "New Zealand",
  "sri lanka": "Sri Lanka",
  "costa rica": "Costa Rica",
  "el salvador": "El Salvador",
  "puerto rico": "Puerto Rico",
  "saudi arabia": "Saudi Arabia",
  "south africa": "South Africa",
  "aruba": "Netherlands",
};

const normalizeCountryName = (name) => {
  if (!name) return "";
  const lower = name.trim().toLowerCase();
  return COUNTRY_NAME_MAP[lower] || name.trim();
};

const WorldMap = ({ data = [], totalJobseekers = 0 }) => {
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredGeo, setHoveredGeo] = useState(null);

  // Build lookup dictionary from API data (country name -> count)
  const { dataMap, maxCount } = useMemo(() => {
    const map = {};
    let max = 0;
    data.forEach(({ name, count }) => {
      const normalized = normalizeCountryName(name);
      const normalizedLower = normalized.toLowerCase();
      map[normalizedLower] = (map[normalizedLower] || 0) + count;
      if (map[normalizedLower] > max) max = map[normalizedLower];
    });
    return { dataMap: map, maxCount: max };
  }, [data]);

  // Color scale for countries WITH data: light green -> deep green
  const colorScale = useMemo(() => {
    return scaleLinear()
      .domain([1, maxCount || 1])
      .range(["#66bb6a", "#1b5e20"]);
  }, [maxCount]);

  // Get fill color for a geography
  const getFillColor = useCallback(
    (geoName, isHovered) => {
      const geoNameLower = (geoName || "").toLowerCase();
      const count = dataMap[geoNameLower] || 0;
      const hasData = count > 0;

      if (isHovered) {
        return hasData ? "#16730F" : "#e8e8e8";
      }
      // Countries with jobseekers = green, without = white
      return hasData ? colorScale(count) : "#ffffff";
    },
    [dataMap, colorScale],
  );

  const handleMouseEnter = useCallback(
    (geo, evt) => {
      const geoName = geo.properties.name;
      const geoNameLower = geoName.toLowerCase();
      const count = dataMap[geoNameLower] || 0;
      setHoveredGeo(geo.rsmKey);
      setTooltipContent({ name: geoName, count });
      setTooltipPos({ x: evt.clientX, y: evt.clientY });
    },
    [dataMap],
  );

  const handleMouseMove = useCallback((evt) => {
    setTooltipPos({ x: evt.clientX, y: evt.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredGeo(null);
    setTooltipContent(null);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 120,
          center: [15, 5],
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup
          center={[15, 5]}
          zoom={1}
          minZoom={1}
          maxZoom={8}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = geo.properties.name;
                const isHovered = hoveredGeo === geo.rsmKey;
                const fillColor = getFillColor(geoName, isHovered);

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillColor}
                    stroke="#b0bec5"
                    strokeWidth={isHovered ? 1 : 0.5}
                    onMouseEnter={(evt) => handleMouseEnter(geo, evt)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    tabIndex={-1}
                    className="rsm-geography"
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltipContent && (
        <div
          style={{
            position: "fixed",
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 40,
            background: "rgba(255, 255, 255, 0.97)",
            border: "1px solid #e0e0e0",
            borderRadius: "10px",
            padding: "10px 16px",
            pointerEvents: "none",
            zIndex: 9999,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            minWidth: "140px",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "14px",
              color: "#1a1a1a",
              marginBottom: "4px",
            }}
          >
            {tooltipContent.name}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: tooltipContent.count > 0 ? "#16730F" : "#9e9e9e",
              fontWeight: 600,
            }}
          >
            {tooltipContent.count > 0
              ? `${tooltipContent.count.toLocaleString()} jobseeker${tooltipContent.count !== 1 ? "s" : ""}`
              : "No jobseekers"}
          </div>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "12px",
          background: "rgba(255,255,255,0.95)",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "11px",
          color: "#555",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "2px",
            background: "#ffffff",
            border: "1px solid #ccc",
          }}
        />
        <span style={{ marginRight: "8px" }}>No data</span>
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "2px",
            background: "#66bb6a",
          }}
        />
        <span>Low</span>
        <div
          style={{
            width: "40px",
            height: "10px",
            borderRadius: "5px",
            background: "linear-gradient(to right, #66bb6a, #1b5e20)",
          }}
        />
        <span>High</span>
      </div>

      {/* Inline style to remove default outline on Geography focus */}
      <style>{`
        .rsm-geography {
          outline: none !important;
          cursor: pointer;
          transition: fill 0.15s ease;
        }
        .rsm-geography:focus {
          outline: none !important;
        }
      `}</style>
    </div>
  );
};

export default WorldMap;
