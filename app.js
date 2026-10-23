// --- CONFIGURACIÓN DE FIREBASE (PROYECTO CENTRAL: MetroL2-IAM-Central) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC1XakVAZLUDq3-240Q_KoYYPU5JKCTjzs",
    authDomain: "metrol2-iam-central.firebaseapp.com",
    projectId: "metrol2-iam-central",
    storageBucket: "metrol2-iam-central.firebasestorage.app",
    messagingSenderId: "78845391762",
    appId: "1:78845391762:web:d64611cd7c4ef65a24074b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Asegurar que las funciones de autenticación estén expuestas globalmente
window.loginConCorreoPassword = async function() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    
    if (!emailInput || !passwordInput) {
        alert("No se encontraron los campos de acceso.");
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        alert("Por favor ingrese su correo corporativo y contraseña.");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Error de Autenticación Firebase:", error.code, error.message);
        alert("Error de autenticación: Verifique sus credenciales (Código: " + error.code + ")");
    }
};

window.loginConGoogle = async function() {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Error Google IAM:", error);
        alert("Error al iniciar sesión con Google: " + error.message);
    }
};

window.aceptarDisclaimer = function() {
    const disclaimerModal = document.getElementById('disclaimer-modal');
    if (disclaimerModal) {
        disclaimerModal.style.display = 'none';
    }
    sessionStorage.setItem('disclaimerAceptado', 'true');
};

onAuthStateChanged(auth, async (user) => {
    const loginModal = document.getElementById('login-modal');
    const disclaimerModal = document.getElementById('disclaimer-modal');

    if (user) {
        if (loginModal) loginModal.style.display = 'none';
        const disclaimerAceptado = sessionStorage.getItem('disclaimerAceptado');
        if (!disclaimerAceptado && disclaimerModal) {
            disclaimerModal.style.display = 'flex';
        } else if (disclaimerModal) {
            disclaimerModal.style.display = 'none';
        }

        const userBadge = document.getElementById('onlineUsers');
        if (userBadge) userBadge.innerHTML = `🟢 ${user.email || 'Autorizado'}`;
    } else {
        if (loginModal) loginModal.style.display = 'flex';
        if (disclaimerModal) disclaimerModal.style.display = 'none';
    }
});
