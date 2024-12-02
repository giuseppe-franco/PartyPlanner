# The Party Planner

A modern web application for organizing the Mobile Team Winter Celebration party contributions.

## Features

- 📅 Real-time countdown to the event
- 🌤️ Weather forecast integration
- 🗺️ Location details
- 📝 Party contribution management
- 📸 Photo sharing (activated at event start)
- 💬 Feedback system (activated 3 hours after event)
- 🌍 Multi-language support (EN/FI/IT/RU)
- 🔥 Firebase integration

## Setup Instructions

### Prerequisites

- Node.js installed (for local development server)
- Firebase account
- OpenWeather API key
- Modern web browser

### Step 1: Clone the Repository

```bash
git clone https://github.com/giuseppefrancodev/mobile-team-winter-celebration.git
cd party-planner
```

### Step 2: Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Firebase Storage
4. Go to Project Settings
5. Copy your Firebase configuration
6. Create `js/firebaseConfig.js`:

```javascript
export const CONFIG = {
  firebase: {
    apiKey: 'your-api-key',
    authDomain: 'your-domain.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-bucket.appspot.com',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id',
  },
  openWeather: {
    apiKey: 'your-openweather-api-key',
  },
  eventDate: '2024-12-20T17:00:00+02:00',
};
```

### Step 3: Configure Firestore and Storage

1. In Firebase Console, go to Firestore Database
2. Create database in test mode
3. Add these security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: true;
    }
  }
}
```

### Step 4: OpenWeather Setup

1. Sign up at [OpenWeather](https://openweathermap.org/api)
2. Get your API key
3. Add it to the CONFIG object in firebaseConfig.js

### Step 5: Run Locally

Using Python (simplest):

```bash
python -m http.server 8000
```

Using Node.js:

```bash
npx http-server
```

Visit `http://localhost:8000` in your browser.

## Development

### File Structure

```
party-planner/
├── index.html          # Main HTML file
├── styles.css          # Global styles
├── legal/             # Legal documents
│   ├── eula.html      # Terms of Use
│   └── privacy-policy.html  # Privacy Policy
├── locale/            # Language files
│   ├── en.xml         # English strings
│   ├── it.xml         # Italian strings
│   ├── ru.xml         # Russian strings
│   └── fi.xml         # Finnish strings
└── js/
    ├── app.js         # Main application logic
    ├── eventManager.js # Event phase management
    ├── languageService.js
    ├── itemManager.js
    ├── weatherService.js
    ├── countdownService.js
    └── firebaseConfig.js
```

### Adding New Features

1. Create new service in `js/` folder
2. Import and initialize in `app.js`
3. Add any required strings to XML files
4. Update README.md

## Troubleshooting

- **XML not loading**: Check file paths and server configuration
- **Firebase errors**: Verify configuration and rules
- **Language issues**: Ensure XML files are properly formatted
- **Photo upload issues**: Check Firebase Storage rules
- **Time-based features**: Verify timezone settings

## License

MIT License
