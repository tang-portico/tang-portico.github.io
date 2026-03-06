// Shared Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAaWnmFJFiE4qGxOakqNpSpIWaOAuozOQ0",
    authDomain: "portico-epg.firebaseapp.com",
    projectId: "portico-epg",
    storageBucket: "portico-epg.firebasestorage.app",
    messagingSenderId: "233497411246",
    appId: "1:233497411246:web:9246d6151eb0ff655ff73f",
    measurementId: "G-NDX39HGFLF"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
