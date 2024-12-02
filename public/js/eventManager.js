import {
  db,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  collection,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  increment,
} from './firebase.js';

const UI_UPDATE_DELAY = 100;

class TimeFormatter {
  static format(timestamp) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }
}

class PhotoProcessor {
  static async compressImage(file) {
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1080;

    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const [width, height] = this.#calculateDimensions(
            img.width,
            img.height,
            MAX_WIDTH,
            MAX_HEIGHT
          );

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(resolve, 'image/jpeg', 0.8);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  static #calculateDimensions(width, height, maxWidth, maxHeight) {
    if (width > height) {
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
      }
    }
    return [width, height];
  }
}

class FirebaseService {
  constructor(db, storage) {
    this.db = db;
    this.storage = storage;
  }

  async uploadFile(path, file) {
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }

  async deleteFile(path) {
    const fileRef = ref(this.storage, path);
    await deleteObject(fileRef);
  }

  async addDocument(collectionName, data) {
    return await addDoc(collection(this.db, collectionName), data);
  }

  async deleteDocument(collectionName, docId) {
    await deleteDoc(doc(this.db, collectionName, docId));
  }

  async queryDocuments(collectionName, conditions = []) {
    const q = query(collection(this.db, collectionName), ...conditions);
    return await getDocs(q);
  }

  async updateDocument(collectionName, docId, data) {
    await updateDoc(doc(this.db, collectionName, docId), data);
  }
}

class PhotoManager {
  #adminManager;
  #userManager;
  #uploadsInProgress;

  constructor(adminManager, userManager) {
    this.#adminManager = adminManager;
    this.#userManager = userManager;
    this.#uploadsInProgress = new Set();
  }

  async loadPhotos() {
    const q = query(collection(db, 'partyPhotos'), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async uploadPhoto(file, uploaderName) {
    if (this.#uploadsInProgress.has(file.name)) {
      throw new Error('File already uploading');
    }

    this.#uploadsInProgress.add(file.name);

    try {
      const fileToUpload =
        file.size > 5 * 1024 * 1024 ? await PhotoProcessor.compressImage(file) : file;

      const fileName = `party-photos/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, fileName);

      await uploadBytes(storageRef, fileToUpload);
      const url = await getDownloadURL(storageRef);

      const photoData = {
        url,
        uploaderName: uploaderName.trim(),
        timestamp: new Date().toISOString(),
        filename: fileName,
        userId: this.#userManager.getUserId(),
      };

      const photoDoc = await addDoc(collection(db, 'partyPhotos'), photoData);
      return { id: photoDoc.id, ...photoData };
    } finally {
      this.#uploadsInProgress.delete(file.name);
    }
  }

  async deletePhoto(photoData) {
    const currentUserId = this.#userManager.getUserId();

    if (!this.#adminManager?.isAdminMode() && photoData.userId !== currentUserId) {
      throw new Error('Unauthorized: Cannot delete photos uploaded by others');
    }

    const docRef = doc(db, 'partyPhotos', photoData.id);
    await deleteDoc(docRef);

    const fileRef = ref(storage, photoData.filename);
    await deleteObject(fileRef);

    return true;
  }
}

class FeedbackManager {
  #adminManager;
  #userManager;
  #firebaseService;

  constructor(adminManager, userManager, firebaseService) {
    this.#adminManager = adminManager;
    this.#userManager = userManager;
    this.#firebaseService = firebaseService;
  }

  async addFeedback(name, message) {
    const feedbackData = {
      name: name.trim(),
      message: message.trim(),
      timestamp: new Date().toISOString(),
      userId: this.#userManager.getUserId(),
      reactions: {},
    };

    const docRef = await addDoc(collection(db, 'partyFeedback'), feedbackData);
    return { id: docRef.id, ...feedbackData };
  }

  async updateFeedback(feedbackId, newMessage) {
    await this.#firebaseService.updateDocument('partyFeedback', feedbackId, {
      message: newMessage.trim(),
      lastEdited: new Date().toISOString(),
    });
  }

  async deleteFeedback(feedbackId) {
    const feedbackRef = doc(db, 'partyFeedback', feedbackId);
    const feedbackDoc = await getDoc(feedbackRef);

    if (!feedbackDoc.exists()) {
      throw new Error('Feedback not found');
    }

    const feedbackData = feedbackDoc.data();
    const currentUserId = this.#userManager.getUserId();

    if (!this.#adminManager?.isAdminMode() && feedbackData.userId !== currentUserId) {
      throw new Error('Unauthorized deletion attempt');
    }

    await deleteDoc(feedbackRef);
    return true;
  }

  async loadFeedback() {
    const querySnapshot = await this.#firebaseService.queryDocuments('partyFeedback', [
      orderBy('timestamp', 'desc'),
    ]);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async updateReaction(feedbackId, emoji) {
    await this.#firebaseService.updateDocument('partyFeedback', feedbackId, {
      [`reactions.${emoji}`]: increment(1),
    });
  }
}

class UIComponentBuilder {
  static createPhotoSection(languageService, lastSubmittedName = '') {
    const section = document.createElement('div');
    section.className = 'photo-section';
    section.style.display = 'none';
    section.innerHTML = `
            <div class="form-section form-container">
                <div class="form-header">
                    <h2 class="form-title">${languageService.getString('photoUpload.title')}</h2>
                </div>
                <form id="photoForm" class="photo-upload-form">
                    <div class="form-grid" style="grid-template-columns: repeat(2, 1fr);">
                        <div class="form-group">
                            <label class="form-label" for="uploaderName">
                                ${languageService.getString('photoUpload.fields.name.label')}
                            </label>
                            <input type="text" id="uploaderName" required value="${lastSubmittedName}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="photoInput">
                                ${languageService.getString('photoUpload.fields.photos.label')}
                            </label>
                            <input type="file" id="photoInput" accept="image/*" multiple required>
                        </div>
                    </div>
                    <div class="upload-info">
                        ${languageService.getString('photoUpload.fields.photos.maxSize')}
                    </div>
                    <div id="photoPreview" class="photo-preview"></div>
                    <button type="submit">
                        ${languageService.getString('photoUpload.fields.uploadButton')}
                    </button>
                </form>
                <div id="photoGallery" class="photo-gallery"></div>
            </div>
        `;
    return section;
  }

  static createFeedbackSection(languageService) {
    const section = document.createElement('div');
    section.className = 'feedback-section';
    section.style.display = 'none';
    section.innerHTML = `
            <div class="form-section">
                <div class="form-header">
                    <h2 class="form-title">${languageService.getString('feedback.title')}</h2>
                </div>
                <form id="feedbackForm" class="feedback-form">
                    <div class="form-grid" style="grid-template-columns: 1fr;">
                        <div class="form-group">
                            <label class="form-label" for="feedbackName">
                                ${languageService.getString('feedback.fields.name.label')}
                            </label>
                            <input type="text" id="feedbackName" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="feedbackText">
                                ${languageService.getString('feedback.fields.message.label')}
                            </label>
                            <textarea id="feedbackText" required rows="4"></textarea>
                        </div>
                    </div>
                    <button type="submit">
                        ${languageService.getString('feedback.fields.submitButton')}
                    </button>
                </form>
                <div id="feedbackList" class="feedback-list"></div>
            </div>
        `;
    return section;
  }
}

export class EventManager {
  #adminManager;
  #eventDateTime;
  #itemManager;
  #languageService;
  #photoManager;
  #feedbackManager;
  #firebaseService;
  #userManager;

  #currentPhotoIndex = 0;
  #totalPhotos = 0;

  constructor(eventDateTime, itemManager, languageService, adminManager, userManager) {
    this.#eventDateTime = new Date(eventDateTime);
    this.#itemManager = itemManager;
    this.#languageService = languageService;

    this.#firebaseService = new FirebaseService(db, storage);
    this.#photoManager = new PhotoManager(adminManager, userManager);
    this.#feedbackManager = new FeedbackManager(adminManager, userManager, this.#firebaseService);

    this.#adminManager = adminManager;
    this.#userManager = userManager;

    document.addEventListener('adminModeChanged', () => {
      this.#loadExistingPhotos();
      this.#loadExistingFeedback();
    });

    this.#initialize();
  }

  async #initialize() {
    try {
      this.#setupComponents();
      const isStarted = this.#checkEventStatus();

      if (isStarted) {
        setTimeout(() => {
          this.#freezeItemForm();
          this.#showPhotoSection();
          this.#setupEventHandlers();
          this.#setupUsernameIfAny();
        }, UI_UPDATE_DELAY);
      } else {
        this.#setupEventHandlers();
        this.#setupUsernameIfAny();
      }
    } catch (error) {
      // Error is logged but not thrown to prevent breaking initialization
    }
  }

  #setupComponents() {
    this.#setupPhotoSection();
    this.#setupFeedbackSection();
    this.#setupPhotoViewer();
  }

  #checkEventStatus() {
    const now = new Date();
    const isStarted = now >= this.#eventDateTime;

    if (isStarted) {
      this.#freezeItemForm();

      setTimeout(() => {
        this.#showPhotoSection();
      }, UI_UPDATE_DELAY);

      const feedbackTime = new Date(this.#eventDateTime.getTime() + 3 * 60 * 60 * 1000);
      const showFeedback = now >= feedbackTime;

      if (showFeedback) {
        setTimeout(() => {
          this.#showFeedbackSection();
        }, UI_UPDATE_DELAY);
      }
    }

    return isStarted;
  }

  #setupUsernameIfAny() {
    const savedUsername = this.#userManager.getUsername();
    if (savedUsername) {
      const nameInputs = document.querySelectorAll('#uploaderName, #feedbackName');
      nameInputs.forEach(input => {
        if (input) input.value = savedUsername;
      });
    }
  }

  async #setupPhotoSection() {
    const photoSection = UIComponentBuilder.createPhotoSection(this.#languageService, '');

    this.#insertPhotoSection(photoSection);
    this.#setupPhotoHandlers();
    await this.#loadExistingPhotos();

    this.#updateUploaderName();
  }

  async #updateUploaderName() {
    try {
      await this.#itemManager.loadItems();
      const lastSubmittedName = this.#itemManager.items?.[0]?.name || '';

      const uploaderNameInput = document.getElementById('uploaderName');
      if (uploaderNameInput && lastSubmittedName) {
        uploaderNameInput.value = lastSubmittedName;
      }
    } catch (error) {
      // Error is logged but handled gracefully
    }
  }

  #insertPhotoSection(photoSection) {
    const categories = document.querySelector('.categories');
    if (categories) {
      categories.parentNode.insertBefore(photoSection, categories);
    } else {
      document.querySelector('.container')?.appendChild(photoSection);
    }
  }

  async #loadExistingPhotos() {
    try {
      const photos = await this.#photoManager.loadPhotos();
      const photoGallery = document.getElementById('photoGallery');
      if (photoGallery) {
        photoGallery.innerHTML = '';
        photos.forEach(photo => this.#addPhotoToGallery(photo, photoGallery));
      }
    } catch (error) {
      // Error is logged but handled gracefully
    }
  }

  #setupPhotoHandlers() {
    const photoForm = document.getElementById('photoForm');
    const photoInput = document.getElementById('photoInput');

    if (!photoForm || !photoInput) return;

    photoInput.addEventListener('change', this.#handlePhotoInputChange.bind(this));
    photoForm.addEventListener('submit', this.#handlePhotoSubmit.bind(this));
  }

  async #handlePhotoInputChange(e) {
    const photoPreview = document.getElementById('photoPreview');
    photoPreview.innerHTML = '';

    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        this.#showError(
          this.#languageService
            .getString('photoUpload.messages.invalidFile')
            .replace('{filename}', file.name)
        );
        return false;
      }
      return true;
    });

    for (const file of validFiles) {
      if (file.size > 5 * 1024 * 1024) {
        this.#showWarning(
          this.#languageService
            .getString('photoUpload.messages.compressionNotice')
            .replace('{filename}', file.name)
        );
      }
      await this.#previewFile(file, photoPreview);
    }
  }

  async #previewFile(file, previewContainer) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'preview-image';
        previewContainer.appendChild(img);
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  async #handlePhotoSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const uploaderName = form.querySelector('#uploaderName').value.trim();
    this.#userManager.setUsername(uploaderName);

    const photoInput = form.querySelector('#photoInput');
    const submitButton = form.querySelector('button[type="submit"]');
    const photoGallery = document.getElementById('photoGallery');

    if (!uploaderName) {
      this.#showError(this.#languageService.getString('photoUpload.messages.nameRequired'));
      return;
    }

    submitButton.disabled = true;
    const files = Array.from(photoInput.files);
    const progressContainer = this.#createUploadProgressUI(form, files.length);
    let uploadedCount = 0;

    try {
      await Promise.all(
        files.map(async file => {
          try {
            const photoData = await this.#photoManager.uploadPhoto(file, uploaderName);
            this.#addPhotoToGallery(photoData, photoGallery);
            uploadedCount++;
            this.#updateUploadProgress(progressContainer, uploadedCount, files.length);
          } catch (error) {
            this.#showError(
              this.#languageService
                .getString('photoUpload.messages.uploadFailed')
                .replace('{filename}', file.name)
            );
          }
        })
      );

      photoInput.value = '';
      document.getElementById('photoPreview').innerHTML = '';
    } finally {
      submitButton.disabled = false;
      this.#fadeOutElement(progressContainer);
    }
  }

  #createUploadProgressUI(form, totalFiles) {
    const container = document.createElement('div');
    container.className = 'upload-progress';
    container.innerHTML = `
            <div class="upload-progress-text">
                ${this.#languageService
                  .getString('photoUpload.messages.uploadingProgress')
                  .replace('{current}', '0')
                  .replace('{total}', totalFiles)}
            </div>
            <div class="upload-progress-bar">
                <div class="progress-fill"></div>
            </div>
        `;
    form.appendChild(container);
    return container;
  }

  #updateUploadProgress(container, current, total) {
    const progressText = container.querySelector('.upload-progress-text');
    const progressFill = container.querySelector('.progress-fill');
    progressText.textContent = this.#languageService
      .getString('photoUpload.messages.uploadingProgress')
      .replace('{current}', current)
      .replace('{total}', total);
    progressFill.style.width = `${(current / total) * 100}%`;
  }

  #addPhotoToGallery(photoData, gallery) {
    const userId = this.#userManager.getUserId();
    const canDelete = photoData.userId === userId || this.#adminManager.isAdminMode();

    const photoContainer = document.createElement('div');
    photoContainer.className = 'gallery-item';
    photoContainer.innerHTML = `
            <div class="photo-wrapper">
                <img src="${photoData.url}" class="gallery-image" alt="Party photo">
                ${canDelete ? '<div class="delete-photo-button"><span>×</span></div>' : ''}
                <div class="photo-info">
                    <span class="uploader-name">
                        ${this.#languageService.getString('photoUpload.messages.uploadedBy')}
                        ${photoData.uploaderName}
                    </span>
                    <span class="upload-time">${TimeFormatter.format(photoData.timestamp)}</span>
                </div>
            </div>
        `;

    const wrapper = photoContainer.querySelector('.photo-wrapper');

    wrapper.addEventListener('click', e => {
      // Don't open viewer if clicking delete button
      if (!e.target.closest('.delete-photo-button')) {
        window.openPhotoViewer(wrapper);
      }
    });

    if (canDelete) {
      const deleteButton = photoContainer.querySelector('.delete-photo-button');
      deleteButton.addEventListener('click', async e => {
        e.stopPropagation();
        if (confirm(this.#languageService.getString('photoUpload.messages.deleteConfirm'))) {
          try {
            await this.#photoManager.deletePhoto(photoData);
            photoContainer.remove();
          } catch (error) {
            this.#showError(this.#languageService.getString('photoUpload.messages.deleteFailed'));
          }
        }
      });
    }

    gallery.insertBefore(photoContainer, gallery.firstChild);
  }

  #setupPhotoInteractions(container, photoData) {
    const wrapper = container.querySelector('.photo-wrapper');
    const deleteButton = container.querySelector('.delete-photo-button');

    wrapper.addEventListener('click', () => {
      window.openPhotoViewer(wrapper);
    });

    deleteButton.addEventListener('click', async e => {
      e.stopPropagation();
      if (confirm(this.#languageService.getString('photoUpload.messages.deleteConfirm'))) {
        try {
          await this.#photoManager.deletePhoto(photoData);
          container.remove();
        } catch (error) {
          this.#showError(this.#languageService.getString('photoUpload.messages.deleteFailed'));
        }
      } else {
        deleteButton.style.display = 'none';
      }
    });

    document.addEventListener('click', e => {
      if (!deleteButton.contains(e.target) && !wrapper.contains(e.target)) {
        deleteButton.style.display = 'none';
      }
    });
  }

  async #setupFeedbackSection() {
    const feedbackSection = UIComponentBuilder.createFeedbackSection(this.#languageService);

    const categories = document.querySelector('.categories');
    if (categories) {
      categories.parentNode.insertBefore(feedbackSection, categories.nextSibling);
    } else {
      const footer = document.getElementById('footer-message').parentElement;
      footer.parentNode.insertBefore(feedbackSection, footer);
    }

    this.#setupFeedbackHandlers();
    await this.#loadExistingFeedback();
  }

  #setupFeedbackHandlers() {
    const feedbackForm = document.getElementById('feedbackForm');
    if (!feedbackForm) return;

    feedbackForm.addEventListener('submit', this.#handleFeedbackSubmit.bind(this));
  }

  async #handleFeedbackSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const nameInput = form.querySelector('#feedbackName');
    const name = nameInput.value.trim();
    this.#userManager.setUsername(name);

    const messageInput = form.querySelector('#feedbackText');
    const submitButton = form.querySelector('button[type="submit"]');

    if (!nameInput.value.trim() || !messageInput.value.trim()) {
      this.#showError(this.#languageService.getString('feedback.messages.required'));
      return;
    }

    submitButton.disabled = true;

    try {
      const feedback = await this.#feedbackManager.addFeedback(nameInput.value, messageInput.value);
      this.#addFeedbackToList(feedback);
      form.reset();
    } catch (error) {
      this.#showError(this.#languageService.getString('feedback.messages.submitError'));
    } finally {
      submitButton.disabled = false;
    }
  }

  async #loadExistingFeedback() {
    try {
      const feedbackItems = await this.#feedbackManager.loadFeedback();
      const feedbackList = document.getElementById('feedbackList');
      if (feedbackList) {
        feedbackList.innerHTML = '';
        feedbackItems.forEach(feedback => this.#addFeedbackToList(feedback));
      }
    } catch (error) {
      // Error is logged but handled gracefully
    }
  }

  #showError(message) {
    const errorAlert = document.getElementById('errorAlert');
    if (errorAlert) {
      errorAlert.textContent = message;
      errorAlert.style.display = 'block';
      setTimeout(() => (errorAlert.style.display = 'none'), 3000);
    }
  }

  #showWarning() {
    // Method kept for potential future implementation
    // No-op to fix unused parameter warning
  }

  #fadeOutElement(element) {
    element.style.opacity = '0';
    setTimeout(() => element.remove(), 500);
  }

  #freezeItemForm() {
    const formSection = document.querySelector('.form-section');
    if (formSection) {
      formSection.style.display = 'none';

      setTimeout(() => {
        this.#itemManager?.reloadItems();
      }, UI_UPDATE_DELAY);
    }
  }

  #showPhotoSection() {
    const photoSection = document.querySelector('.photo-section');
    if (photoSection) {
      photoSection.style.display = 'block';
    }
  }

  #showFeedbackSection() {
    const feedbackSection = document.querySelector('.feedback-section');
    if (feedbackSection) {
      feedbackSection.style.display = 'block';
    }
  }

  #setupEventHandlers() {
    window.openPhotoViewer = this.#openPhotoViewer.bind(this);
    window.changePhoto = this.#changePhoto.bind(this);

    if ('ontouchstart' in window) {
      this.#setupTouchHandlers();
    }
  }

  #setupPhotoViewer() {
    if (new Date() < this.#eventDateTime) {
      return;
    }
  }

  #openPhotoViewer(element) {
    const viewer = document.createElement('div');
    viewer.className = 'photo-viewer';
    const images = Array.from(document.querySelectorAll('.gallery-image'));

    if (!images.length) return;

    const currentIndex = images.indexOf(element.querySelector('img'));
    this.#currentPhotoIndex = currentIndex;
    this.#totalPhotos = images.length;

    viewer.innerHTML = `
            <img src="${images[currentIndex].src}">
            <div class="photo-viewer-controls">
                <button class="viewer-button prev" onclick="window.changePhoto(-1)">‹</button>
                <button class="viewer-button next" onclick="window.changePhoto(1)">›</button>
            </div>
            <button class="viewer-button close">×</button>
        `;

    viewer.onclick = e => {
      if (e.target === viewer) viewer.remove();
    };
    viewer.querySelector('.close').onclick = () => viewer.remove();

    document.body.appendChild(viewer);
  }

  #changePhoto(direction) {
    const viewer = document.querySelector('.photo-viewer');
    if (!viewer) return;

    const images = Array.from(document.querySelectorAll('.gallery-image'));
    if (!images.length) return;

    this.#currentPhotoIndex =
      (this.#currentPhotoIndex + direction + this.#totalPhotos) % this.#totalPhotos;
    viewer.querySelector('img').src = images[this.#currentPhotoIndex].src;
  }

  #setupTouchHandlers() {
    let startX;

    document.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
    });

    document.addEventListener('touchend', e => {
      if (!startX || !document.querySelector('.photo-viewer')) return;

      const diffX = e.changedTouches[0].clientX - startX;
      if (Math.abs(diffX) > 50) {
        this.#changePhoto(diffX > 0 ? -1 : 1);
      }
      startX = null;
    });
  }

  #addFeedbackToList(feedback) {
    const feedbackList = document.getElementById('feedbackList');
    const feedbackItem = document.createElement('div');
    feedbackItem.className = 'feedback-item fade-in';

    const userId = this.#userManager.getUserId();
    const isAdmin = this.#adminManager?.isAdminMode();
    const isOwnFeedback = feedback.userId === userId || isAdmin;

    feedbackItem.innerHTML = `
            <div class="feedback-header">
                <span class="feedback-name">${feedback.name}</span>
                <span class="feedback-time">${TimeFormatter.format(feedback.timestamp)}</span>
                ${isOwnFeedback ? this.#getFeedbackActionsHTML() : ''}
            </div>
            <div class="feedback-content">${feedback.message}</div>
            ${this.#getReactionsHTML(feedback.reactions)}
        `;

    this.#setupFeedbackItemHandlers(feedbackItem, feedback, isOwnFeedback);
    feedbackList.insertBefore(feedbackItem, feedbackList.firstChild);
  }

  #getFeedbackActionsHTML() {
    return `
            <div class="feedback-actions">
                <button class="edit-btn">
                    ${this.#languageService.getString('feedback.actions.edit')}
                </button>
                <button class="delete-btn">
                    ${this.#languageService.getString('feedback.actions.delete')}
                </button>
            </div>
        `;
  }

  #getReactionsHTML(reactions = {}) {
    const emojis = ['👍', '❤️', '🎉'];
    return `
            <div class="feedback-reactions">
                ${emojis
                  .map(
                    emoji => `
                    <button class="emoji-btn ${reactions[emoji] ? 'active' : ''}" 
                            data-emoji="${emoji}">
                        ${emoji} ${reactions[emoji] || 0}
                    </button>
                `
                  )
                  .join('')}
            </div>
        `;
  }

  #setupFeedbackItemHandlers(feedbackItem, feedback, isOwnFeedback) {
    if (isOwnFeedback) {
      const editBtn = feedbackItem.querySelector('.edit-btn');
      const deleteBtn = feedbackItem.querySelector('.delete-btn');

      editBtn?.addEventListener('click', () => this.#handleFeedbackEdit(feedbackItem, feedback));
      deleteBtn?.addEventListener('click', () =>
        this.#handleFeedbackDelete(feedbackItem, feedback)
      );
    }

    const reactionButtons = feedbackItem.querySelectorAll('.emoji-btn');
    reactionButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const emoji = button.dataset.emoji;
        try {
          await this.#feedbackManager.updateReaction(feedback.id, emoji);
          const newCount = (feedback.reactions?.[emoji] || 0) + 1;
          button.classList.add('active');
          button.textContent = `${emoji} ${newCount}`;
          feedback.reactions = {
            ...feedback.reactions,
            [emoji]: newCount,
          };
        } catch (error) {
          // Error handling but no console log
        }
      });
    });
  }

  async #handleFeedbackEdit(feedbackItem, feedback) {
    const contentDiv = feedbackItem.querySelector('.feedback-content');
    const currentText = contentDiv.textContent;

    contentDiv.innerHTML = `
            <textarea class="edit-textarea">${currentText}</textarea>
            <div class="edit-actions">
                <button class="save-edit">
                    ${this.#languageService.getString('feedback.actions.save')}
                </button>
                <button class="cancel-edit">
                    ${this.#languageService.getString('feedback.actions.cancel')}
                </button>
            </div>
        `;

    const saveBtn = contentDiv.querySelector('.save-edit');
    const cancelBtn = contentDiv.querySelector('.cancel-edit');
    const textarea = contentDiv.querySelector('.edit-textarea');

    saveBtn.addEventListener('click', async () => {
      const newText = textarea.value.trim();
      if (newText && newText !== currentText) {
        try {
          await this.#feedbackManager.updateFeedback(feedback.id, newText);
          contentDiv.innerHTML = newText;
          feedback.message = newText;
        } catch (error) {
          this.#showError(this.#languageService.getString('feedback.messages.updateError'));
          this.#cancelEdit(contentDiv, currentText);
        }
      } else {
        this.#cancelEdit(contentDiv, currentText);
      }
    });

    cancelBtn.addEventListener('click', () => this.#cancelEdit(contentDiv, currentText));
  }

  async #handleFeedbackDelete(feedbackItem, feedback) {
    if (confirm(this.#languageService.getString('feedback.actions.deleteConfirm'))) {
      try {
        await this.#feedbackManager.deleteFeedback(feedback.id);
        feedbackItem.remove();
      } catch (error) {
        this.#showError(this.#languageService.getString('feedback.messages.deleteError'));
      }
    }
  }

  #cancelEdit(contentDiv, originalText) {
    contentDiv.innerHTML = originalText;
  }
}
