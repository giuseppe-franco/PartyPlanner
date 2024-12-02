class XmlParser {
  parseXml() {
    throw new Error('parseXml method must be implemented');
  }
}

class DOMXmlParser extends XmlParser {
  #parseXmlToObject(xmlNode) {
    const obj = {};
    Array.from(xmlNode.children).forEach(child => {
      obj[child.tagName] =
        child.children.length > 0 ? this.#parseXmlToObject(child) : child.textContent.trim();
    });
    return obj;
  }

  parseXml(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    return this.#parseXmlToObject(xmlDoc.documentElement);
  }
}

export class LanguageService {
  #currentLanguage;
  #strings;
  #xmlParser;
  #supportedLanguages;
  #defaultLanguage;
  #isDebugMode;
  #LOG_PREFIX = '[LanguageService]';

  constructor() {
    this.#currentLanguage = 'en';
    this.#strings = {};
    this.#xmlParser = new DOMXmlParser();
    this.#supportedLanguages = ['en', 'fi', 'it', 'ru'];
    this.#defaultLanguage = 'en';
    // Enable debug logging only in non-production environments
    this.#isDebugMode =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('dev');
  }

  get currentLanguage() {
    return this.#currentLanguage;
  }

  get supportedLanguages() {
    return [...this.#supportedLanguages];
  }

  #detectBrowserLanguage() {
    const browserLang = navigator.language.split('-')[0];
    return this.#supportedLanguages.includes(browserLang) ? browserLang : this.#defaultLanguage;
  }

  #logDebug(message) {
    if (this.#isDebugMode && message) {
      // eslint-disable-next-line no-console
      console.log(`${this.#LOG_PREFIX} ${message}`);
    }
  }

  #logError(error) {
    if (error) {
      const errorMessage = error.message || 'Unknown error';
      // eslint-disable-next-line no-console
      console.error(`${this.#LOG_PREFIX} Error: ${errorMessage}`, error);
    }
  }

  async #fetchLanguageFile(language) {
    this.#logDebug(`Fetching language file for ${language}`);
    const response = await fetch(`./locale/${language}.xml`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
  }

  async initialize() {
    this.#logDebug('Starting language service initialization...');

    try {
      this.#currentLanguage = this.#detectBrowserLanguage();
      this.#logDebug(`Detected language: ${this.#currentLanguage}`);

      const xmlText = await this.#fetchLanguageFile(this.#currentLanguage);
      this.#strings = this.#xmlParser.parseXml(xmlText);
      this.#logDebug(`Loaded ${Object.keys(this.#strings).length} string keys successfully`);

      return true;
    } catch (error) {
      this.#logError(error);
      this.#logDebug(`Falling back to default language: ${this.#defaultLanguage}`);
      this.#currentLanguage = this.#defaultLanguage;
      this.#strings = {};
      return false;
    }
  }

  getString(path) {
    if (!path) {
      this.#logDebug('getString called with invalid path');
      return path;
    }

    try {
      const value = path.split('.').reduce((obj, key) => obj?.[key], this.#strings);
      if (!value) {
        this.#logDebug(`Missing translation key: ${path}`);
      }
      return value || path;
    } catch (error) {
      this.#logError(error);
      return path;
    }
  }

  async setLanguage(language) {
    this.#logDebug(`Changing language to: ${language}`);

    if (!this.#supportedLanguages.includes(language)) {
      const error = new Error(`Unsupported language: ${language}`);
      this.#logError(error);
      throw error;
    }

    try {
      const xmlText = await this.#fetchLanguageFile(language);
      this.#strings = this.#xmlParser.parseXml(xmlText);
      this.#currentLanguage = language;
      this.#logDebug(`Successfully changed language to ${language}`);
      return true;
    } catch (error) {
      this.#logError(error);
      this.#logDebug(`Failed to change language to ${language}`);
      return false;
    }
  }
}
