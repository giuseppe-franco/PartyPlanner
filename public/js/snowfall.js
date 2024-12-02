// Configuration class for snowfall settings
class SnowfallConfig {
  static #DEFAULT_FLAKE_SHAPES = ['❅', '❆', '❉', '❋', '❊', '✻', '✺', '❄'];
  static #DEFAULT_COUNT = 50;

  #flakeShapes;
  #flakeCount;
  #minSize;
  #maxSize;
  #minDuration;
  #maxDuration;

  constructor({
    flakeShapes = SnowfallConfig.#DEFAULT_FLAKE_SHAPES,
    count = SnowfallConfig.#DEFAULT_COUNT,
    minSize = 5,
    maxSize = 20,
    minDuration = 15,
    maxDuration = 25,
  } = {}) {
    this.#flakeShapes = flakeShapes;
    this.#flakeCount = count;
    this.#minSize = minSize;
    this.#maxSize = maxSize;
    this.#minDuration = minDuration;
    this.#maxDuration = maxDuration;
  }

  get flakeShapes() {
    return [...this.#flakeShapes];
  }
  get count() {
    return this.#flakeCount;
  }
  get minSize() {
    return this.#minSize;
  }
  get maxSize() {
    return this.#maxSize;
  }
  get minDuration() {
    return this.#minDuration;
  }
  get maxDuration() {
    return this.#maxDuration;
  }
}

// DOM Manager for handling element creation and styles
class SnowfallDOMManager {
  #container;
  #styleElement;

  constructor() {
    this.#createContainer();
    this.#addAnimationStyles();
  }

  #createContainer() {
    this.#container = document.createElement('div');
    this.#container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100vh;
            pointer-events: none;
            z-index: 9999;
        `;
    document.body.appendChild(this.#container);
  }

  #addAnimationStyles() {
    this.#styleElement = document.createElement('style');
    this.#styleElement.textContent = `
            @keyframes snowfall {
                0% { transform: translate(0, -10px); }
                100% { transform: translate(0, 100vh); }
            }
        `;
    document.head.appendChild(this.#styleElement);
  }

  get container() {
    return this.#container;
  }

  cleanup() {
    this.#container?.remove();
    this.#styleElement?.remove();
  }
}

// Snowflake factory for creating individual flakes
class SnowflakeFactory {
  #config;

  constructor(config) {
    this.#config = config;
  }

  createFlake() {
    const flake = document.createElement('div');
    const size = this.#randomBetween(this.#config.minSize, this.#config.maxSize);
    const duration = this.#randomBetween(this.#config.minDuration, this.#config.maxDuration);
    const shape = this.#getRandomShape();

    flake.textContent = shape;
    flake.style.cssText = this.#generateFlakeStyles(size, duration);

    return flake;
  }

  #randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  #getRandomShape() {
    const shapes = this.#config.flakeShapes;
    return shapes[Math.floor(Math.random() * shapes.length)];
  }

  #generateFlakeStyles(size, duration) {
    return `
            position: fixed;
            left: ${Math.random() * 100}%;
            top: -20px;
            font-size: ${size}px;
            color: white;
            text-shadow: 0 0 3px rgba(255, 255, 255, 0.3);
            animation: snowfall ${duration}s linear infinite;
            animation-delay: -${Math.random() * 15}s;
        `;
  }
}

// Main Snowfall class
export class Snowfall {
  #domManager;
  #flakeFactory;
  #config;

  constructor(config = {}) {
    this.#config = new SnowfallConfig(config);
    this.#domManager = new SnowfallDOMManager();
    this.#flakeFactory = new SnowflakeFactory(this.#config);
    this.#initialize();
  }

  #initialize() {
    this.#createFlakes();
  }

  #createFlakes() {
    const container = this.#domManager.container;
    for (let i = 0; i < this.#config.count; i++) {
      const flake = this.#flakeFactory.createFlake();
      container.appendChild(flake);
    }
  }

  // Public methods
  stop() {
    this.#domManager.cleanup();
  }

  // Optional: Method to add more flakes
  addFlakes(count = 10) {
    const container = this.#domManager.container;
    for (let i = 0; i < count; i++) {
      const flake = this.#flakeFactory.createFlake();
      container.appendChild(flake);
    }
  }
}

// Usage remains the same with added configuration options:
// Basic usage:
// const snowfall = new Snowfall();

// Advanced usage with configuration:
// const snowfall = new Snowfall({
//     count: 100,
//     minSize: 8,
//     maxSize: 25,
//     minDuration: 10,
//     maxDuration: 20
// });
//
// snowfall.stop(); // To remove the effect
