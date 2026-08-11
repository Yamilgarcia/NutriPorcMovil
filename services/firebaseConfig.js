import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Tus credenciales reales de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDlyV_WqDookF_rlo9J3ImYG3N8fLxF26c",
  authDomain: "nutriporcmovil.firebaseapp.com",
  projectId: "nutriporcmovil",
  storageBucket: "nutriporcmovil.firebasestorage.app",
  messagingSenderId: "357814517413",
  appId: "1:357814517413:web:cefd48bd161d53fbcb974c"
};

// Inicializar la app
const app = initializeApp(firebaseConfig);

// Inicializar Auth con persistencia nativa (Mantiene la sesión abierta en el celular)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Inicializar la base de datos Firestore (Para el CRUD del Perfil de Finca)
const db = getFirestore(app);

export { auth, db };