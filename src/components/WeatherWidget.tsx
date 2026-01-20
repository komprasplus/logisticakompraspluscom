import { motion } from "framer-motion";
import { Cloud, CloudRain, Droplets, RefreshCw, Sun, Thermometer, Wind } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import { Skeleton } from "@/components/ui/skeleton";

const WeatherWidget = () => {
  const { weather, loading, error, refresh } = useWeather();

  const getWeatherIcon = (iconCode: string) => {
    if (iconCode.includes("01")) return <Sun className="w-8 h-8 text-yellow-400" />;
    if (iconCode.includes("02") || iconCode.includes("03") || iconCode.includes("04")) 
      return <Cloud className="w-8 h-8 text-gray-400" />;
    if (iconCode.includes("09") || iconCode.includes("10") || iconCode.includes("11")) 
      return <CloudRain className="w-8 h-8 text-blue-400" />;
    return <Cloud className="w-8 h-8 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-4 border border-blue-200/30">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-gradient-to-br from-gray-500/10 to-gray-600/10 rounded-2xl p-4 border border-gray-200/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Cloud className="w-6 h-6" />
            <span className="text-sm">Clima no disponible</span>
          </div>
          <button onClick={refresh} className="p-2 hover:bg-gray-200/50 rounded-full transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  const isRainy = weather.rainProbability > 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 border shadow-sm ${
        isRainy 
          ? "bg-gradient-to-br from-blue-500/15 to-slate-500/15 border-blue-300/40" 
          : "bg-gradient-to-br from-amber-500/10 to-sky-500/10 border-amber-200/30"
      }`}
    >
      <div className="flex items-center justify-between">
        {/* Main weather info */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/50 rounded-xl shadow-inner">
            {getWeatherIcon(weather.icon)}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Bogotá</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{weather.temperature}°</span>
              <span className="text-sm text-muted-foreground">C</span>
            </div>
            <p className="text-xs text-muted-foreground capitalize">{weather.description}</p>
          </div>
        </div>

        {/* Rain probability - highlighted */}
        <div className={`flex flex-col items-center px-3 py-2 rounded-xl ${
          isRainy ? "bg-blue-500/20" : "bg-white/30"
        }`}>
          <Droplets className={`w-5 h-5 ${isRainy ? "text-blue-500" : "text-blue-400"}`} />
          <span className={`text-lg font-bold ${isRainy ? "text-blue-600" : "text-blue-500"}`}>
            {weather.rainProbability}%
          </span>
          <span className="text-[10px] text-muted-foreground">Lluvia</span>
        </div>

        {/* Additional info */}
        <div className="hidden sm:flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Thermometer className="w-3 h-3" />
            <span>Sens. {weather.feelsLike}°</span>
          </div>
          <div className="flex items-center gap-1">
            <Wind className="w-3 h-3" />
            <span>{weather.windSpeed} km/h</span>
          </div>
          <div className="flex items-center gap-1">
            <Droplets className="w-3 h-3" />
            <span>Hum. {weather.humidity}%</span>
          </div>
        </div>
      </div>

      {/* Rain warning for motorizado */}
      {isRainy && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 pt-3 border-t border-blue-300/30"
        >
          <div className="flex items-center gap-2 text-blue-600">
            <CloudRain className="w-4 h-4" />
            <span className="text-xs font-medium">
              ⚠️ Alta probabilidad de lluvia - Considera llevar protección
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default WeatherWidget;
