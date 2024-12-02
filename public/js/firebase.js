// Firebase core
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';

// Firestore services
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  deleteDoc,
  updateDoc,
  doc,
  increment,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Storage services
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js';

// Configuration
import { CONFIG } from './config.js';

// Initialize Firebase
const firebaseApp = initializeApp(CONFIG.firebase);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

// Export configuration
export { CONFIG };

// Export Firebase core services
export { db, storage };

// Export Firestore services
export {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  deleteDoc,
  doc,
  updateDoc,
  increment,
};

// Export Storage services
export { ref, uploadBytes, getDownloadURL, deleteObject };
