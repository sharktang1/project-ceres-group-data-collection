import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBQAXb4Jv27wld9LAypBpSqqF_7WFhPp4A",
    authDomain: "groupsdb1.firebaseapp.com",
    projectId: "groupsdb1",
    storageBucket: "groupsdb1.firebasestorage.app",
    messagingSenderId: "233794413556",
    appId: "1:233794413556:web:31648e459d6948b691cfa1",
    measurementId: "G-HCSEFDXJ1F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Save data to Firebase
export const saveToFirebase = async (data, collectionPath = 'muthegi-group/members') => {
    try {
        // Add timestamp
        const dataWithTimestamp = {
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Split collection path (e.g., 'muthegi-group/members')
        const pathParts = collectionPath.split('/');
        let currentCollection = collection(db, pathParts[0]);
        
        // Handle nested collections
        for (let i = 1; i < pathParts.length; i++) {
            // This is a simplified approach - in real scenario, you'd need document references
            // For now, we'll use a flat structure
            break;
        }
        
        // Add document to collection
        const docRef = await addDoc(collection(db, 'members'), {
            ...dataWithTimestamp,
            group: 'muthegi-group',
            collectionPath: collectionPath
        });
        
        return {
            success: true,
            docId: docRef.id,
            message: 'Data saved successfully'
        };
    } catch (error) {
        console.error('Firebase save error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Get data from Firebase (if needed for profile view)
export const getFromFirebase = async (docId) => {
    try {
        // You would implement this based on your Firestore structure
        return {
            success: true,
            data: null
        };
    } catch (error) {
        console.error('Firebase get error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};
