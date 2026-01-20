import { useState, useEffect } from "react";

interface WeatherData {
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  rainProbability: number;
  feelsLike: number;
  windSpeed: number;
}

interface UseWeatherReturn {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const BOGOTA_LAT = 4.6097;
const BOGOTA_LON = -74.0817;
const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

export const useWeather = (): UseWeatherReturn => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async () => {
    if (!API_KEY) {
      setError("API key no configurada");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Current weather
      const weatherResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${BOGOTA_LAT}&lon=${BOGOTA_LON}&appid=${API_KEY}&units=metric&lang=es`
      );

      if (!weatherResponse.ok) {
        throw new Error("Error al obtener el clima");
      }

      const weatherData = await weatherResponse.json();

      // Get rain probability from forecast
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${BOGOTA_LAT}&lon=${BOGOTA_LON}&appid=${API_KEY}&units=metric&lang=es&cnt=1`
      );

      let rainProbability = 0;
      if (forecastResponse.ok) {
        const forecastData = await forecastResponse.json();
        rainProbability = Math.round((forecastData.list?.[0]?.pop || 0) * 100);
      }

      setWeather({
        temperature: Math.round(weatherData.main.temp),
        description: weatherData.weather[0].description,
        icon: weatherData.weather[0].icon,
        humidity: weatherData.main.humidity,
        rainProbability,
        feelsLike: Math.round(weatherData.main.feels_like),
        windSpeed: Math.round(weatherData.wind.speed * 3.6), // Convert m/s to km/h
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { weather, loading, error, refresh: fetchWeather };
};

export default useWeather;
