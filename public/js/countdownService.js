const UI_UPDATE_DELAY = 100;

class TimeUnitCalculator {
  static #MILLISECONDS_PER_SECOND = 1000;
  static #SECONDS_PER_MINUTE = 60;
  static #MINUTES_PER_HOUR = 60;
  static #HOURS_PER_DAY = 24;

  static calculateTimeUnits(diffInMilliseconds) {
    const totalSeconds = Math.floor(diffInMilliseconds / this.#MILLISECONDS_PER_SECOND);
    const totalMinutes = Math.floor(totalSeconds / this.#SECONDS_PER_MINUTE);
    const totalHours = Math.floor(totalMinutes / this.#MINUTES_PER_HOUR);

    return {
      days: Math.floor(totalHours / this.#HOURS_PER_DAY),
      hours: totalHours % this.#HOURS_PER_DAY,
      minutes: totalMinutes % this.#MINUTES_PER_HOUR,
      seconds: totalSeconds % this.#SECONDS_PER_MINUTE,
    };
  }
}

// UI Renderer class
class CountdownRenderer {
  #countdownSelector = '.countdown-units';

  showEventStarted() {
    const countdownUnits = document.querySelector(this.#countdownSelector);
    if (countdownUnits) {
      countdownUnits.innerHTML = '<div class="time-unit event-started"><span>Started</span></div>';
    }
  }

  updateUI(timeUnits) {
    Object.entries(timeUnits).forEach(([unit, value]) => {
      this.#updateElement(unit, value);
    });
  }

  #updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value).padStart(2, '0');
    }
  }
}

// Main CountdownService class
export class CountdownService {
  // Private fields
  #targetDate;
  #interval;
  #renderer;
  #updateInterval = 1000; // 1 second

  constructor(targetDate) {
    this.#validateTargetDate(targetDate);
    this.#targetDate = new Date(targetDate);
    this.#interval = null;
    this.#renderer = new CountdownRenderer();

    this.#initialize();
  }

  // Private methods
  #validateTargetDate(targetDate) {
    const date = new Date(targetDate);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid target date provided');
    }
  }

  #initialize() {
    if (this.#isEventStarted()) {
      this.#renderer.showEventStarted();
    } else {
      this.initializeCountdown();
    }
  }

  #isEventStarted() {
    return this.#targetDate <= new Date();
  }

  #calculateTimeRemaining() {
    const now = new Date();
    return this.#targetDate - now;
  }

  #updateCountdown = () => {
    const timeRemaining = this.#calculateTimeRemaining();

    if (timeRemaining <= 0) {
      this.cleanup();
      this.#renderer.showEventStarted();

      setTimeout(() => {
        window.location.reload();
      }, UI_UPDATE_DELAY);
      return;
    }

    const timeUnits = TimeUnitCalculator.calculateTimeUnits(timeRemaining);
    this.#renderer.updateUI(timeUnits);
  };

  // Public methods
  initializeCountdown() {
    if (this.#interval) {
      this.cleanup();
    }

    this.#interval = setInterval(this.#updateCountdown, this.#updateInterval);
    this.#updateCountdown();
  }

  cleanup() {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
  }

  // Optional: Additional public methods that could be useful
  get remainingTime() {
    return Math.max(0, this.#calculateTimeRemaining());
  }

  get isStarted() {
    return this.#isEventStarted();
  }
}

// Usage remains the same:
// const countdown = new CountdownService('2024-12-20');
// countdown.cleanup(); // When needed
