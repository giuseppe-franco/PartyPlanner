export class AdminManager {
  #isAdmin = false;
  #tapCount = 0;
  #lastTapTime = 0;
  #adminTimeout = null;
  #ADMIN_DURATION = 60000; // 1 minute in milliseconds
  #TAP_THRESHOLD = 500; // ms between taps
  #REQUIRED_TAPS = 8;

  constructor() {
    this.setupEasterEgg();
  }

  setupEasterEgg() {
    const heartIcon = document.getElementById('footer-heart');
    if (!heartIcon) return;

    heartIcon.addEventListener('click', () => {
      const currentTime = new Date().getTime();

      // Reset if too much time has passed
      if (currentTime - this.#lastTapTime > this.#TAP_THRESHOLD) {
        this.#tapCount = 0;
      }

      this.#tapCount++;
      this.#lastTapTime = currentTime;

      if (this.#tapCount === this.#REQUIRED_TAPS) {
        this.#enableAdminMode();
      }
    });
  }

  #enableAdminMode() {
    this.#isAdmin = true;
    this.#showAdminUI();

    // Refresh all components
    this.refreshViews();

    // Set timeout to disable admin mode after 1 minute
    if (this.#adminTimeout) {
      clearTimeout(this.#adminTimeout);
    }

    this.#adminTimeout = setTimeout(() => {
      this.#disableAdminMode();
      // Refresh the page after admin mode expires
      window.location.reload();
    }, this.#ADMIN_DURATION);
  }

  refreshViews() {
    // Trigger ItemManager refresh
    document.dispatchEvent(new CustomEvent('adminModeChanged'));
  }

  #showAdminUI() {
    const footerMessage = document.getElementById('footer-message');
    if (!footerMessage) return;

    // Remove existing admin indicator if any
    document.getElementById('admin-indicator')?.remove();

    // Create a container div for admin indicator
    const adminContainer = document.createElement('div');
    adminContainer.id = 'admin-indicator';
    adminContainer.style.cssText = `
            text-align: center;
            padding-top: 20px;
            padding-bottom: 0px;
            margin: 0;
            width: 100%;
            position: relative;
            display: block;
        `;

    // Create the admin text
    const adminText = document.createElement('span');
    adminText.style.cssText = `
            color: #FF0000;
            font-weight: bold;
            display: inline-block;
            line-height: 1;     /* Control line height */
        `;
    adminText.textContent = 'admin mode';

    // Add text to container
    adminContainer.appendChild(adminText);

    // Insert before the footer message
    const footerContainer = footerMessage.closest('.container') || footerMessage.parentNode;
    footerContainer.insertBefore(adminContainer, footerMessage);

    // Ensure consistent spacing in footer
    footerMessage.style.cssText = `
            text-align: center;
            padding-top: 10px; 
        `;
  }

  #disableAdminMode() {
    this.#isAdmin = false;
    document.getElementById('admin-indicator')?.remove();

    if (this.#adminTimeout) {
      clearTimeout(this.#adminTimeout);
      this.#adminTimeout = null;
    }
  }

  isAdminMode() {
    return this.#isAdmin;
  }
}
