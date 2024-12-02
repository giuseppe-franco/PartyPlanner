class WeatherDataProcessor {
  calculateAverageTemperature(forecasts) {
    if (!forecasts || forecasts.length === 0) return null;
    return (
      forecasts.reduce((sum, forecast) => sum + forecast.main.temp, 0) / forecasts.length
    ).toFixed(1);
  }

  getMostFrequentDescription(forecasts) {
    if (!forecasts || forecasts.length === 0) return null;
    const descriptions = forecasts.map(forecast => forecast.weather[0].description);
    return descriptions
      .sort(
        (a, b) =>
          descriptions.filter(desc => desc === a).length -
          descriptions.filter(desc => desc === b).length
      )
      .pop();
  }
}

export class WeatherService {
  #apiKey;
  #city;
  #dataProcessor;

  constructor(apiKey) {
    this.#apiKey = apiKey;
    this.#city = 'helsinki';
    this.#dataProcessor = new WeatherDataProcessor();
  }

  async fetchWeatherForecast() {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${this.#city}&units=metric&appid=${this.#apiKey}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const targetDate = '2024-12-20';
      const forecastsForTargetDate = this.#filterForecastsByDate(data.list, targetDate);

      if (forecastsForTargetDate.length > 0) {
        const avgTemp = this.#dataProcessor.calculateAverageTemperature(forecastsForTargetDate);
        const description = this.#dataProcessor.getMostFrequentDescription(forecastsForTargetDate);

        this.updateWeatherUI(`${avgTemp}°C, ${this.#capitalizeFirstLetter(description)}`);
      } else {
        this.updateWeatherUI('No forecast data available');
      }
    } catch (error) {
      // Handle API errors gracefully with a user-friendly message
      this.updateWeatherUI('Unable to load weather data');
    }
  }

  updateWeatherUI(text) {
    const weatherElement = document.getElementById('weather');
    if (weatherElement) {
      weatherElement.innerText = text;
    }
  }

  // Helper methods
  #filterForecastsByDate(forecasts, targetDate) {
    return forecasts.filter(forecast => forecast.dt_txt.startsWith(targetDate));
  }

  #capitalizeFirstLetter(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
