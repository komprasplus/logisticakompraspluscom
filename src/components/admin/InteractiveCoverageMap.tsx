import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Radio } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CoverageDept {
  id: string;
  name: string;
  cities: string[];
  coords: { top: string; left: string };
}

const coverageData: CoverageDept[] = [
  {
    id: "atl",
    name: "Atlántico",
    cities: ["Barranquilla", "Soledad"],
    coords: { top: "10%", left: "42%" },
  },
  {
    id: "mag",
    name: "Magdalena",
    cities: ["Santa Marta", "Ciénaga", "Pueblo Viejo", "Zona Bananera"],
    coords: { top: "8%", left: "52%" },
  },
  {
    id: "ant",
    name: "Antioquia",
    cities: ["Medellín", "Bello", "Itagüí", "Envigado", "Sabaneta", "Copacabana"],
    coords: { top: "35%", left: "32%" },
  },
  {
    id: "cun",
    name: "Cundinamarca",
    cities: [
      "Soacha",
      "Sibaté",
      "Madrid",
      "Chía",
      "Zipaquirá",
      "Funza",
      "Cota",
      "Mosquera",
      "Tocancipá",
      "Facatativá",
      "Sopó",
      "Cajicá",
    ],
    coords: { top: "52%", left: "46%" },
  },
  {
    id: "bog",
    name: "Bogotá D.C.",
    cities: ["Bogotá, D.C."],
    coords: { top: "55%", left: "49%" },
  },
  {
    id: "val",
    name: "Valle del Cauca",
    cities: ["Cali", "Palmira", "Candelaria", "Yumbo", "Jamundí"],
    coords: { top: "62%", left: "26%" },
  },
];

const InteractiveCoverageMap = () => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const totalCities = coverageData.reduce((sum, d) => sum + d.cities.length, 0);

  return (
    <Card className="overflow-hidden rounded-3xl border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-primary/5 via-card to-card px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Mapa de Cobertura en Tiempo Real
            </h3>
            <p className="text-xs text-muted-foreground">
              Operación logística activa en Colombia
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full border-primary/30 bg-primary/5 text-primary font-semibold"
          >
            {coverageData.length} Departamentos
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-emerald-500/30 bg-emerald-500/5 text-emerald-600 font-semibold"
          >
            {totalCities} Municipios
          </Badge>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative w-full bg-gradient-to-b from-muted/30 to-muted/50">
        <div className="relative mx-auto" style={{ height: 480, maxWidth: 520 }}>
          {/* SVG Colombia silhouette (stylized) */}
          <svg
            viewBox="0 0 400 500"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="colombia-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary) / 0.08)" />
                <stop offset="100%" stopColor="hsl(var(--primary) / 0.03)" />
              </linearGradient>
            </defs>
            {/* Stylized Colombia path */}
            <path
              d="M 195 20
                 L 230 25
                 L 255 55
                 L 245 85
                 L 270 110
                 L 290 145
                 L 285 180
                 L 305 220
                 L 295 265
                 L 280 310
                 L 295 360
                 L 275 405
                 L 240 440
                 L 200 460
                 L 170 470
                 L 145 460
                 L 130 430
                 L 145 395
                 L 125 365
                 L 110 320
                 L 95 275
                 L 105 230
                 L 95 185
                 L 110 145
                 L 135 105
                 L 155 75
                 L 170 45
                 L 180 25
                 Z"
              fill="url(#colombia-fill)"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Subtle grid lines */}
            <g stroke="hsl(var(--border) / 0.4)" strokeWidth="0.5" strokeDasharray="2 4">
              <line x1="50" y1="125" x2="350" y2="125" />
              <line x1="50" y1="250" x2="350" y2="250" />
              <line x1="50" y1="375" x2="350" y2="375" />
              <line x1="200" y1="0" x2="200" y2="500" />
            </g>
          </svg>

          {/* Pulsing markers */}
          {coverageData.map((dept) => {
            const isActive = activeId === dept.id;
            return (
              <Popover
                key={dept.id}
                open={isActive}
                onOpenChange={(open) => setActiveId(open ? dept.id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer focus:outline-none"
                    style={{ top: dept.coords.top, left: dept.coords.left }}
                    onMouseEnter={() => setActiveId(dept.id)}
                    onMouseLeave={() => setActiveId((curr) => (curr === dept.id ? null : curr))}
                    aria-label={`Cobertura ${dept.name}`}
                  >
                    {/* Outer ping wave */}
                    <span className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-primary/40 animate-ping" />
                    {/* Mid ring */}
                    <span className="absolute inset-0 m-auto h-5 w-5 rounded-full bg-primary/30" />
                    {/* Solid center dot */}
                    <span className="relative block h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/50 ring-2 ring-background transition-transform group-hover:scale-125" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="center"
                  className="w-64 rounded-2xl border-border bg-card p-4 shadow-xl"
                >
                  <div className="flex items-center gap-2 border-b border-border pb-2 mb-3">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">
                      {dept.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-auto rounded-full border-primary/30 bg-primary/5 text-[10px] text-primary"
                    >
                      {dept.cities.length}
                    </Badge>
                  </div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                    Municipios cubiertos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dept.cities.map((city) => (
                      <Badge
                        key={city}
                        variant="secondary"
                        className="rounded-full text-[11px] font-medium"
                      >
                        {city}
                      </Badge>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}

          {/* Legend overlay */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-card/90 backdrop-blur px-3 py-1.5 shadow-md border border-border">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-medium text-foreground">
              Cobertura activa
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default InteractiveCoverageMap;
