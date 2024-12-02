import { db, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from './firebase.js';

// Database Service Interface
class DatabaseService {
  async getItems() {
    throw new Error('Not implemented');
  }

  async addItem() {
    throw new Error('Not implemented');
  }

  async deleteItem() {
    throw new Error('Not implemented');
  }
}

// Firebase Implementation
class FirebaseService extends DatabaseService {
  #db;
  #collectionName;

  constructor(db, collectionName = 'partyItems') {
    super();
    this.#db = db;
    this.#collectionName = collectionName;
  }

  async getItems() {
    const q = query(collection(this.#db, this.#collectionName), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async addItem(item) {
    const docRef = await addDoc(collection(this.#db, this.#collectionName), item);
    return { id: docRef.id, ...item };
  }

  async deleteItem(itemId) {
    await deleteDoc(doc(this.#db, this.#collectionName, itemId));
    return true;
  }
}

// UI Renderer Class
class ItemRenderer {
  renderCategoryItems(items, isEventStarted, currentUserId, isAdmin) {
    return items.length === 0
      ? '<div class="item">No items yet</div>'
      : items
          .map(item => this.#renderItemTemplate(item, isEventStarted, currentUserId, isAdmin))
          .join('');
  }

  #renderItemTemplate(item, isEventStarted, currentUserId, isAdmin) {
    const { name, item: itemName, notes, timestamp, id, userId } = item;
    // Allow deletion if admin or if the event hasn't started and user owns the item
    const canDelete = isAdmin || (!isEventStarted && userId === currentUserId);

    return `
              <div class="item fade-in">
                  <div class="item-header">
                      <div class="item-info">
                          <strong>${name}</strong>: ${itemName}
                          ${notes ? `<br><small class="item-notes">${notes}</small>` : ''}
                          <div class="item-timestamp">${this.#formatTimestamp(timestamp)}</div>
                      </div>
                      ${canDelete ? `<button type="button" class="delete-button" data-item-id="${id}">&#x2715;</button>` : ''}
                  </div>
              </div>
          `;
  }

  #formatTimestamp(timestamp) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }

  showError(message) {
    const errorAlert = document.getElementById('errorAlert');
    if (errorAlert) {
      errorAlert.textContent = message;
      errorAlert.style.display = 'block';
      setTimeout(() => (errorAlert.style.display = 'none'), 3000);
    }
  }
}

// Main ItemManager Class
export class ItemManager {
  // Private fields
  #items;
  #targetDate;
  #dbService;
  #renderer;
  #categories;
  #userManager;
  #adminManager;

  constructor(targetDate, adminManager, userManager) {
    this.#items = [];
    this.#targetDate = targetDate;
    this.#dbService = new FirebaseService(db);
    this.#renderer = new ItemRenderer();
    this.#categories = ['beverages', 'savory', 'sweets', 'other'];
    this.#userManager = userManager;
    this.#adminManager = adminManager;

    // Add event listener for admin mode changes
    document.addEventListener('adminModeChanged', () => {
      this.renderItems();
    });

    this.loadItems(); // Initial load
  }

  // Error handling wrapper
  async #errorBoundary(operation, errorMessage) {
    try {
      return await operation();
    } catch (error) {
      // Handle errors gracefully and inform the user
      this.#renderer.showError(`Error ${errorMessage}. Please try again.`);
      return false;
    }
  }

  // Private validation method
  #validateItem(name, item) {
    return name?.trim() && item?.trim();
  }

  // Public methods
  async loadItems() {
    return this.#errorBoundary(async () => {
      this.#items = await this.#dbService.getItems();
      this.renderItems();
    }, 'loading items');
  }

  async addItem(name, item, category, notes) {
    if (!this.#validateItem(name, item)) return false;

    const userId = this.#userManager.getUserId();
    const newItem = {
      name: name.trim(),
      item: item.trim(),
      category,
      notes: notes?.trim() || '',
      timestamp: new Date().toISOString(),
      userId, // Store user identification for permission checks
    };

    return this.#errorBoundary(async () => {
      const savedItem = await this.#dbService.addItem(newItem);
      this.#items.unshift(savedItem);
      this.renderItems();
      return true;
    }, 'adding item');
  }

  async deleteItem(itemId) {
    return this.#errorBoundary(async () => {
      const currentUserId = this.#userManager.getUserId();
      const item = this.#items.find(item => item.id === itemId);

      if (!item) {
        throw new Error('Item not found');
      }

      if (!this.#adminManager.isAdminMode() && item.userId !== currentUserId) {
        throw new Error('You can only delete your own items');
      }

      await this.#dbService.deleteItem(itemId);
      this.#items = this.#items.filter(item => item.id !== itemId);
      this.renderItems();
      return true;
    }, 'deleting item');
  }

  renderItems() {
    const isEventStarted = new Date() >= new Date(this.#targetDate);
    const currentUserId = this.#userManager.getUserId();
    const isAdmin = this.#adminManager?.isAdminMode();

    this.#categories.forEach(category => {
      const container = document.getElementById(category);
      if (!container) return;

      const categoryItems = this.#items.filter(item => item.category === category);
      container.innerHTML = this.#renderer.renderCategoryItems(
        categoryItems,
        isEventStarted,
        currentUserId,
        isAdmin
      );
    });

    // Admin mode should always show delete buttons
    if (isAdmin || !isEventStarted) {
      this.#addDeleteEventListeners();
    }
  }

  #addDeleteEventListeners() {
    const buttons = document.querySelectorAll('.delete-button');
    buttons.forEach(button => {
      button.removeEventListener('click', this.#handleDelete);
      button.addEventListener('click', this.#handleDelete);
    });
  }

  #handleDelete = async e => {
    const itemId = e.currentTarget.getAttribute('data-item-id');
    if (itemId && confirm('Are you sure you want to delete this item?')) {
      await this.deleteItem(itemId);
    }
  };

  reloadItems() {
    return this.loadItems();
  }

  getUserItems(userId) {
    return this.#items.filter(item => item.userId === userId);
  }
}
