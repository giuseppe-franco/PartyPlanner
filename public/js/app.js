import { WeatherService } from './weatherService.js';
import { CountdownService } from './countdownService.js';
import { CONFIG } from './firebase.js';
import { LanguageService } from './languageService.js';
import { ItemManager } from './itemManager.js';
import { EventManager } from './eventManager.js';
import { AdminManager } from './adminManager.js';
import { UserManager } from './userManager.js';

class UIManager {
  #languageService;

  constructor(languageService) {
    this.#languageService = languageService;
  }

  updateText(selector, stringKey) {
    const element = document.querySelector(selector);
    if (element) {
      const text = this.#languageService.getString(stringKey);
      element.textContent = text;
    }
  }

  updatePlaceholder(selector, stringKey) {
    const input = document.querySelector(selector);
    if (input) {
      input.placeholder = this.#languageService.getString(stringKey);
    }
  }

  showAlert(id, message, duration = 3000) {
    const alert = document.getElementById(id);
    if (alert) {
      if (message) alert.textContent = message;
      alert.style.display = 'block';
      setTimeout(() => (alert.style.display = 'none'), duration);
    }
  }

  updateCategorySelect(categories) {
    const categorySelect = document.querySelector('#category');
    if (categorySelect) {
      categorySelect.innerHTML = Object.entries(categories)
        .map(([value, text]) => `<option value="${value}">${text}</option>`)
        .join('');
    }
  }
}

class FormManager {
  #itemManager;
  #languageService;
  #uiManager;

  constructor(itemManager, languageService, uiManager) {
    this.#itemManager = itemManager;
    this.#languageService = languageService;
    this.#uiManager = uiManager;
  }

  async handleSubmit(event) {
    event.preventDefault();

    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    const formData = this.#getFormData();

    await this.#processFormSubmission(formData, submitButton, originalText);
  }

  #getFormData() {
    return {
      name: document.getElementById('name').value,
      item: document.getElementById('item').value,
      category: document.getElementById('category').value,
      notes: document.getElementById('notes').value,
    };
  }

  async #processFormSubmission(formData, submitButton, originalText) {
    submitButton.disabled = true;
    submitButton.textContent = this.#languageService.getString('form.buttons.adding');

    try {
      const success = await this.#itemManager.addItem(
        formData.name,
        formData.item,
        formData.category,
        formData.notes
      );

      if (success) {
        this.#uiManager.showAlert('successAlert');
        this.#clearFormFields();
      }
    } catch (error) {
      // Log error for debugging but handle gracefully for user
      this.#uiManager.showAlert(
        'errorAlert',
        this.#languageService.getString('messages.error.addItem')
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }

  #clearFormFields() {
    document.getElementById('item').value = '';
    document.getElementById('notes').value = '';
  }
}

class ServiceManager {
  static async initializeServices(config) {
    const adminManager = new AdminManager();
    const userManager = new UserManager();
    const services = {
      languageService: new LanguageService(),
      itemManager: new ItemManager(config.eventDate, adminManager, userManager),
      weatherService: new WeatherService(config.openWeather.apiKey),
      countdownService: new CountdownService(config.eventDate),
      adminManager: adminManager,
      userManager: userManager,
    };

    await services.languageService.initialize();
    services.weatherService.fetchWeatherForecast();

    return services;
  }
}

export class PartyPlannerApp {
  #services = {};
  #uiManager;
  #formManager;
  #languageService;

  constructor() {
    this.#initialize();
    this.#setupCleanup();
  }

  async #initialize() {
    try {
      const mainContent = document.querySelector('.container');
      if (mainContent) {
        mainContent.style.visibility = 'hidden';
      }

      this.#services = await ServiceManager.initializeServices(CONFIG);

      this.#languageService = this.#services.languageService;
      this.#uiManager = new UIManager(this.#services.languageService);
      this.#formManager = new FormManager(
        this.#services.itemManager,
        this.#services.languageService,
        this.#uiManager
      );

      this.#services.eventManager = new EventManager(
        CONFIG.eventDate,
        this.#services.itemManager,
        this.#services.languageService,
        this.#services.adminManager,
        this.#services.userManager
      );

      await this.#updateUI();

      if (mainContent) {
        mainContent.style.visibility = 'visible';
      }
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.remove();
      }
    } catch (error) {
      // Handle initialization errors gracefully
      const mainContent = document.querySelector('.container');
      if (mainContent) {
        mainContent.style.visibility = 'visible';
      }
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.remove();
      }
    }
  }

  #setupCleanup() {
    window.addEventListener('unload', () => {
      this.#services.countdownService?.cleanup();
    });
  }

  #updateUI() {
    this.#updateHeaders();
    this.#updateEventInfo();
    this.#updateForm();
    this.#updateFooter();
  }

  #updateHeaders() {
    ['#page-title', '#header-title'].forEach(selector =>
      this.#uiManager.updateText(selector, 'header.title')
    );
    this.#uiManager.updateText('#welcome-message', 'header.welcomeMessage');
  }

  #updateEventInfo() {
    const eventInfoSelectors = {
      '#countdown-label': 'eventInfo.countdown.title',
      '#location-label': 'eventInfo.location.title',
      '#location-value': 'eventInfo.location.value',
      '#time-label': 'eventInfo.time.title',
      '#weather-label': 'eventInfo.weather.title',
    };

    Object.entries(eventInfoSelectors).forEach(([selector, key]) =>
      this.#uiManager.updateText(selector, key)
    );

    ['days', 'hours', 'minutes', 'seconds'].forEach(unit =>
      this.#uiManager.updateText(`#${unit}-label`, `eventInfo.countdown.units.${unit}`)
    );
  }

  #updateForm() {
    const formLabels = {
      '#form-title': 'form.title',
      '#name-label': 'form.fields.name.label',
      '#item-label': 'form.fields.item.label',
      '#category-label': 'form.fields.category.label',
      '#notes-label': 'form.fields.notes.label',
      '#submit-button': 'form.buttons.add',
    };

    Object.entries(formLabels).forEach(([selector, key]) =>
      this.#uiManager.updateText(selector, key)
    );

    ['name', 'item', 'notes'].forEach(field =>
      this.#uiManager.updatePlaceholder(`#${field}`, `form.fields.${field}.placeholder`)
    );

    const categories = this.#languageService.getString('form.fields.category.options');
    this.#uiManager.updateCategorySelect(categories);

    Object.keys(categories).forEach(key =>
      this.#uiManager.updateText(`#${key}-title`, `form.fields.category.options.${key}`)
    );
  }

  #updateFooter() {
    ['message', 'heart'].forEach(item =>
      this.#uiManager.updateText(`#footer-${item}`, `footer.${item}`)
    );

    ['terms', 'privacy'].forEach(item =>
      this.#uiManager.updateText(
        `#legal-${item === 'terms' ? 'eula' : 'privacy'}`,
        `legal.links.${item}`
      )
    );
  }

  handleAddItem(event) {
    return this.#formManager.handleSubmit(event);
  }
}
