// Project Ceres - Muthegi Group Data Collection Form
// Import Firebase modules
const firebaseScript = document.createElement('script');
firebaseScript.type = 'module';
firebaseScript.innerHTML = `
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
  import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
  import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
  
  window.firebaseModules = { initializeApp, getFirestore, collection, addDoc, getStorage, ref, uploadBytes, getDownloadURL, getAnalytics };
`;
document.head.appendChild(firebaseScript);

// Main Application Class
class ProjectCeresForm {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 7;
        this.formData = {
            personal: {},
            nextOfKin: [],
            location: {},
            farmerJourney: {},
            livestock: [],
            consent: false,
            // Image URLs will be stored here after upload
            profilePhotoUrl: null,
            signatureUrl: null,
            livestockPhotoUrls: []
        };
        
        // Camera states
        this.cameraStream = null;
        this.livestockCameraStream = null;
        this.currentCamera = null;
        this.currentLivestockCamera = null;
        this.cameras = [];
        this.livestockCameras = [];
        this.profilePhotoData = null;
        this.currentLivestockEntry = null;
        this.livestockPhotos = [];
        
        // Signature state
        this.signaturePoints = [];
        this.isDrawing = false;
        this.signatureData = null;
        
        // Firebase
        this.db = null;
        this.storage = null;
        this.analytics = null;
        this.firebaseInitialized = false;
        
        // Notification control
        this.notificationsEnabled = true;
        this.shownNotifications = new Set();
        
        // Submission state
        this.isSubmitting = false;
        
        this.init();
    }

    async init() {
        // Hide loading overlay after page loads
        setTimeout(() => {
            document.getElementById('loadingOverlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loadingOverlay').style.display = 'none';
                document.getElementById('mainContainer').style.display = 'block';
                // Show only welcome notification
                this.showNotification('Welcome to Project Ceres Data Collection Form', 'info', true);
            }, 300);
        }, 1500);

        // Initialize Firebase
        await this.initializeFirebase();
        
        // Initialize form
        this.initializeForm();
        this.initializeCamera();
        this.initializeLivestockCamera();
        this.initializeSignature();
        this.initializeLocation();
        this.updateStepIndicator();
        
        // REMOVED: Don't add duplicate event listener here
        // The HTML form already has onsubmit="submitForm()"
        
        // Show initial guide (only once)
        setTimeout(() => {
            this.showStepGuide();
        }, 2000);
    }

    async initializeFirebase() {
        try {
            // Wait for Firebase modules to load
            await new Promise(resolve => {
                const checkFirebase = () => {
                    if (window.firebaseModules) {
                        resolve();
                    } else {
                        setTimeout(checkFirebase, 100);
                    }
                };
                checkFirebase();
            });
            
            const { initializeApp, getFirestore, getStorage, getAnalytics } = window.firebaseModules;
            
            // Firebase configuration for autostore-58181 project
            const firebaseConfig = {
                apiKey: "AIzaSyAiRNS2NaZnCNOZ3r948mhsciu7f-xTkXc",
                authDomain: "autostore-58181.firebaseapp.com",
                projectId: "autostore-58181",
                storageBucket: "autostore-58181.firebasestorage.app",
                messagingSenderId: "208074075097",
                appId: "1:208074075097:web:4dea4c511813cde7df47c8",
                measurementId: "G-S0ZBHHKWNW"
            };
            
            // Initialize Firebase
            const app = initializeApp(firebaseConfig);
            this.db = getFirestore(app);
            this.storage = getStorage(app);
            this.analytics = getAnalytics(app);
            this.firebaseInitialized = true;
            
            console.log('Firebase initialized successfully for database and storage');
            
        } catch (error) {
            console.error('Firebase initialization error:', error);
            // Only show error notification
            this.showNotification('Database connection failed. Data will be saved locally.', 'error', true);
        }
    }

    initializeForm() {
        // Set max date for DOB (must be at least 18 years old)
        const today = new Date();
        const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        document.getElementById('dob').max = maxDate.toISOString().split('T')[0];
        
        // Set min date for DOB (approx 100 years ago)
        const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
        document.getElementById('dob').min = minDate.toISOString().split('T')[0];
        
        // Phone number handling - FIXED VALIDATION
        document.getElementById('phone').addEventListener('input', (e) => {
            let value = e.target.value;
            
            // Allow + at the beginning
            if (value.startsWith('+')) {
                // Keep + and digits only
                value = '+' + value.substring(1).replace(/\D/g, '');
            } else {
                // Remove all non-digits
                value = value.replace(/\D/g, '');
            }
            
            e.target.value = value;
        });
        
        // Add blur event to format on lose focus
        document.getElementById('phone').addEventListener('blur', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.startsWith('254') && value.length >= 12) {
                // Format with + for international numbers
                e.target.value = '+254' + value.substring(3);
            } else if (value.startsWith('0') && value.length === 10) {
                // Keep as is for local format
                e.target.value = value;
            }
        });
        
        // Set current date for consent
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Initialize Next of Kin phone fields
        this.setupDynamicPhoneFields();
        
        // Set up form submission button - SINGLE EVENT LISTENER
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.submitForm();
        });
        
        // Remove any inline onsubmit handler from the form
        const form = document.getElementById('memberForm');
        form.onsubmit = null;
        form.setAttribute('onsubmit', 'return false;');
    }

    setupDynamicPhoneFields() {
        // Set up event delegation for dynamically added phone fields
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('nok-contact')) {
                this.formatPhoneInput(e.target);
            }
        });
    }

    formatPhoneInput(input) {
        let value = input.value;
        
        // Allow + at the beginning
        if (value.startsWith('+')) {
            value = '+' + value.substring(1).replace(/\D/g, '');
        } else {
            value = value.replace(/\D/g, '');
        }
        
        input.value = value;
        
        // Format on blur
        const originalBlur = input.onblur;
        input.onblur = function(e) {
            let val = e.target.value.replace(/\D/g, '');
            if (val.startsWith('254') && val.length >= 12) {
                e.target.value = '+254' + val.substring(3);
            } else if (val.startsWith('0') && val.length === 10) {
                e.target.value = val;
            }
            if (originalBlur) originalBlur.call(this, e);
        };
    }

    updateStepIndicator() {
        document.getElementById('currentStep').textContent = this.currentStep;
        document.getElementById('totalSteps').textContent = this.totalSteps;
        
        const progress = ((this.currentStep - 1) / (this.totalSteps - 1)) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;
        
        // Update step titles
        document.querySelectorAll('.step-title').forEach((title, index) => {
            title.classList.toggle('active', index === this.currentStep - 1);
        });
        
        // Show/hide navigation buttons
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');
        
        prevBtn.style.display = this.currentStep === 1 ? 'none' : 'flex';
        nextBtn.style.display = this.currentStep === this.totalSteps ? 'none' : 'flex';
        submitBtn.style.display = this.currentStep === this.totalSteps ? 'flex' : 'none';
        
        // Update active step
        document.querySelectorAll('.form-step').forEach((step, index) => {
            step.classList.toggle('active', index === this.currentStep - 1);
        });
        
        // Update consent name when on step 7
        if (this.currentStep === 7 && this.formData.personal.fullName) {
            document.getElementById('consentName').textContent = this.formData.personal.fullName;
        }
    }

    showStepGuide() {
        const guides = {
            1: "Start by filling in your personal details. Make sure all required fields are completed.",
            2: "Add your next of kin information. You can add multiple entries.",
            3: "Take a clear profile photo. You can switch between front and rear cameras.",
            4: "Provide your farm location details. Use the GPS button to get your current coordinates.",
            5: "Tell us about your farming journey and future goals.",
            6: "Add information about your livestock. You can take photos with your camera.",
            7: "Read the consent statement carefully and provide your digital signature."
        };
        
        if (guides[this.currentStep] && !this.shownNotifications.has(`guide-${this.currentStep}`)) {
            this.showNotification(guides[this.currentStep], 'info', true);
            this.shownNotifications.add(`guide-${this.currentStep}`);
        }
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            this.saveCurrentStepData();
            if (this.currentStep < this.totalSteps) {
                this.currentStep++;
                this.updateStepIndicator();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                // Close camera if it's open
                if (this.currentStep !== 3 && this.cameraStream) {
                    this.stopCamera();
                }
                
                // Reinitialize signature canvas when reaching step 7
                if (this.currentStep === 7) {
                    setTimeout(() => {
                        console.log('Reached step 7, reinitializing signature...');
                        this.initializeSignature();
                    }, 500);
                }
                
                // Show step guide
                setTimeout(() => this.showStepGuide(), 500);
            }
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepIndicator();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Reinitialize signature canvas when returning to step 7
            if (this.currentStep === 7) {
                setTimeout(() => {
                    console.log('Returned to step 7, reinitializing signature...');
                    this.initializeSignature();
                }, 500);
            }
        }
    }

    validateCurrentStep(submitValidation = false) {
        const stepId = `step${this.currentStep}`;
        const step = document.getElementById(stepId);
        const requiredInputs = step.querySelectorAll('[required]');
        
        let isValid = true;
        
        // Clear all validation errors first
        step.querySelectorAll('.validation-error').forEach(el => {
            el.classList.remove('validation-error');
        });
        step.querySelectorAll('.validation-error-message').forEach(el => {
            el.classList.remove('show');
        });
        
        // Validate required fields
        requiredInputs.forEach(input => {
            if (input.type === 'checkbox') {
                if (!input.checked) {
                    isValid = false;
                    this.showValidationError(input, 'This agreement is required');
                }
            } else if (input.type === 'tel') {
                const value = input.value;
                if (!value || !this.isValidPhone(value)) {
                    isValid = false;
                    this.showValidationError(input, 'Please enter a valid Kenyan phone number (e.g., +254720547335 or 0720547335)');
                }
            } else if (input.type === 'date') {
                if (!input.value) {
                    isValid = false;
                    this.showValidationError(input, 'Please enter your date of birth');
                } else {
                    const dateValue = new Date(input.value);
                    const minDate = new Date(input.min);
                    const maxDate = new Date(input.max);
                    
                    if (dateValue < minDate || dateValue > maxDate) {
                        isValid = false;
                        this.showValidationError(input, 'Date must be between 1925 and 2007');
                    }
                }
            } else if (input.type === 'email') {
                if (input.value && !this.isValidEmail(input.value)) {
                    isValid = false;
                    this.showValidationError(input, 'Please enter a valid email address');
                } else if (!input.value && submitValidation && this.currentStep === 1) {
                    // Email is optional, but for submission we want to encourage it
                    this.showNotification('Email is recommended for better communication', 'warning', true);
                }
            } else {
                if (!input.value.trim()) {
                    isValid = false;
                    const label = input.previousElementSibling?.textContent || 'This field';
                    this.showValidationError(input, `${label} is required`);
                }
            }
        });
        
        // Special validation for signature
        if (this.currentStep === 7) {
            if (!this.signatureData) {
                isValid = false;
                const signatureError = document.getElementById('signatureError');
                if (signatureError) {
                    signatureError.classList.add('show');
                }
            } else {
                const signatureError = document.getElementById('signatureError');
                if (signatureError) {
                    signatureError.classList.remove('show');
                }
            }
            
            // Validate consent checkbox
            const consentCheckbox = document.getElementById('agreeConsent');
            if (!consentCheckbox.checked) {
                isValid = false;
                this.showValidationError(consentCheckbox, 'Please agree to the consent statement');
            }
        }
        
        if (!isValid) {
            this.showNotification('Please fill in all required fields correctly', 'error', true);
            
            // Scroll to first error
            const firstError = step.querySelector('.validation-error');
            if (firstError) {
                setTimeout(() => {
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstError.focus();
                }, 100);
            }
            
            return false;
        }
        
        return true;
    }

    showValidationError(input, message) {
        input.classList.add('validation-error');
        const errorDiv = input.nextElementSibling;
        if (errorDiv && errorDiv.classList.contains('validation-error-message')) {
            errorDiv.textContent = message;
            errorDiv.classList.add('show');
        }
    }

    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    isValidPhone(phone) {
        // FIXED PHONE VALIDATION - ACCEPTS +254 FORMAT
        // 1. Clean the input: remove all non-digit characters except a leading plus
        let cleaned;
        if (phone.startsWith('+')) {
            cleaned = '+' + phone.substring(1).replace(/\D/g, '');
        } else {
            cleaned = phone.replace(/\D/g, '');
        }
        
        // 2. Accept various Kenyan phone number formats
        // Allow: +254XXXXXXXXX, 254XXXXXXXXX, 0XXXXXXXXX
        const kenyanRegex = /^(?:\+?254|0)?[17]\d{8}$/;
        
        // Test the cleaned number against the pattern
        return kenyanRegex.test(cleaned);
    }

    saveCurrentStepData() {
        switch(this.currentStep) {
            case 1:
                const phoneValue = document.getElementById('phone').value;
                let formattedPhone = phoneValue.replace(/\D/g, '');
                
                // Format phone to 254XXXXXXXXX (without +)
                if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
                    formattedPhone = '254' + formattedPhone.substring(1);
                } else if (formattedPhone.startsWith('254')) {
                    // Already in 254 format
                } else if (formattedPhone.length === 9) {
                    formattedPhone = '254' + formattedPhone;
                }
                
                this.formData.personal = {
                    fullName: document.getElementById('fullName').value,
                    phone: formattedPhone,
                    email: document.getElementById('email').value,
                    dob: document.getElementById('dob').value,
                    maritalStatus: document.getElementById('maritalStatus').value,
                    nationality: document.getElementById('nationality').value,
                    idNumber: document.getElementById('idNumber').value
                };
                break;
                
            case 2:
                this.formData.nextOfKin = [];
                document.querySelectorAll('.next-of-kin-entry').forEach(entry => {
                    const phoneVal = entry.querySelector('.nok-contact').value;
                    let formattedNokPhone = phoneVal.replace(/\D/g, '');
                    
                    // Format next of kin phone to 254 format
                    if (formattedNokPhone.startsWith('0') && formattedNokPhone.length === 10) {
                        formattedNokPhone = '254' + formattedNokPhone.substring(1);
                    } else if (formattedNokPhone.startsWith('254')) {
                        // Already in 254 format
                    } else if (formattedNokPhone.length === 9) {
                        formattedNokPhone = '254' + formattedNokPhone;
                    }
                    
                    const nok = {
                        name: entry.querySelector('.nok-name').value,
                        relationship: entry.querySelector('.nok-relationship').value,
                        contact: formattedNokPhone,
                        birthCert: entry.querySelector('.nok-birth-cert').value,
                        age: entry.querySelector('.nok-age').value
                    };
                    if (nok.name || nok.relationship || nok.contact) {
                        this.formData.nextOfKin.push(nok);
                    }
                });
                break;
                
            case 3:
                // Profile photo is saved separately
                break;
                
            case 4:
                this.formData.location = {
                    county: document.getElementById('county').value,
                    subCounty: document.getElementById('subCounty').value,
                    ward: document.getElementById('ward').value,
                    village: document.getElementById('village').value,
                    physicalAddress: document.getElementById('physicalAddress').value,
                    gps: {
                        latitude: document.getElementById('latitude').value,
                        longitude: document.getElementById('longitude').value
                    }
                };
                break;
                
            case 5:
                this.formData.farmerJourney = {
                    description: document.getElementById('farmerDescription').value,
                    futureGoals: document.getElementById('futureGoals').value
                };
                break;
                
            case 6:
                this.formData.livestock = [];
                document.querySelectorAll('.livestock-entry').forEach((entry, index) => {
                    const livestock = {
                        type: entry.querySelector('.livestock-type').value,
                        produce: entry.querySelector('.livestock-produce').value,
                        count: entry.querySelector('.livestock-count').value,
                        info: entry.querySelector('.livestock-info').value,
                        photoCount: this.livestockPhotos[index] ? this.livestockPhotos[index].length : 0
                    };
                    if (livestock.type || livestock.count) {
                        this.formData.livestock.push(livestock);
                    }
                });
                break;
                
            case 7:
                this.formData.consent = document.getElementById('agreeConsent').checked;
                // Signature URL will be added after upload
                break;
        }
        
        // Log data to console (for debugging)
        console.log(`Step ${this.currentStep} data saved:`, this.formData);
    }

    // Camera Functionality
    async initializeCamera() {
        const video = document.getElementById('cameraView');
        const cameraSelect = document.getElementById('cameraSelect');
        const captureBtn = document.getElementById('capturePhoto');
        const switchBtn = document.getElementById('switchCamera');
        const retakeBtn = document.getElementById('retakePhoto');

        // Get available cameras
        await this.getCameras('cameraSelect');

        // Capture photo
        captureBtn.addEventListener('click', () => this.capturePhoto());

        // Switch camera
        switchBtn.addEventListener('click', () => this.switchCamera('cameraSelect'));

        // Retake photo
        retakeBtn.addEventListener('click', () => {
            this.profilePhotoData = null;
            document.getElementById('profilePreview').style.display = 'flex';
            video.style.display = 'block';
            captureBtn.disabled = false;
            switchBtn.disabled = false;
            retakeBtn.style.display = 'none';
            console.log('Photo retake ready');
        });

        // Camera selection change
        cameraSelect.addEventListener('change', (e) => {
            this.currentCamera = e.target.value;
            this.startCamera('cameraView', 'cameraSelect');
        });

        // Start default camera
        this.startCamera('cameraView', 'cameraSelect');
    }

    async getCameras(selectId) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            
            const cameraSelect = document.getElementById(selectId);
            cameraSelect.innerHTML = '<option value="">Select camera...</option>';
            
            cameras.forEach((camera, index) => {
                const option = document.createElement('option');
                option.value = camera.deviceId;
                option.text = camera.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
            
            if (cameras.length > 0) {
                if (selectId === 'cameraSelect') {
                    this.currentCamera = cameras[0].deviceId;
                    cameraSelect.value = this.currentCamera;
                } else {
                    this.currentLivestockCamera = cameras[0].deviceId;
                    cameraSelect.value = this.currentLivestockCamera;
                }
            }
            
            return cameras;
        } catch (error) {
            console.error('Error getting cameras:', error);
            return [];
        }
    }

    async startCamera(videoId, selectId) {
        const video = document.getElementById(videoId);
        
        // Stop existing stream
        if (videoId === 'cameraView' && this.cameraStream) {
            this.stopCamera();
        } else if (videoId === 'livestockCameraView' && this.livestockCameraStream) {
            this.stopLivestockCamera();
        }
        
        try {
            const deviceId = selectId === 'cameraSelect' ? this.currentCamera : this.currentLivestockCamera;
            const constraints = {
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            video.style.display = 'block';
            
            if (videoId === 'cameraView') {
                this.cameraStream = stream;
            } else {
                this.livestockCameraStream = stream;
            }
            
            console.log('Camera started successfully');
        } catch (error) {
            console.error('Error starting camera:', error);
            this.showNotification('Camera access denied. Please allow camera permissions.', 'error', true);
        }
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => {
                track.stop();
            });
            this.cameraStream = null;
        }
        const video = document.getElementById('cameraView');
        if (video) {
            video.srcObject = null;
        }
    }

    async switchCamera(selectId) {
        const cameras = await this.getCameras(selectId);
        if (cameras.length < 2) {
            console.log('Only one camera available');
            return;
        }
        
        const currentDeviceId = selectId === 'cameraSelect' ? this.currentCamera : this.currentLivestockCamera;
        const currentIndex = cameras.findIndex(cam => cam.deviceId === currentDeviceId);
        const nextIndex = (currentIndex + 1) % cameras.length;
        
        if (selectId === 'cameraSelect') {
            this.currentCamera = cameras[nextIndex].deviceId;
        } else {
            this.currentLivestockCamera = cameras[nextIndex].deviceId;
        }
        
        document.getElementById(selectId).value = selectId === 'cameraSelect' ? this.currentCamera : this.currentLivestockCamera;
        
        const videoId = selectId === 'cameraSelect' ? 'cameraView' : 'livestockCameraView';
        await this.startCamera(videoId, selectId);
    }

    capturePhoto() {
        const video = document.getElementById('cameraView');
        const canvas = document.getElementById('photoCanvas');
        const preview = document.getElementById('profilePreview');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob - FIXED: Use proper image/jpeg format
        canvas.toBlob((blob) => {
            this.profilePhotoData = blob;
            
            // Show preview using blob URL
            const url = URL.createObjectURL(blob);
            preview.innerHTML = `<img src="${url}" alt="Profile Preview" style="width:100%;height:100%;object-fit:cover;">`;
            preview.style.display = 'flex';
            video.style.display = 'none';
            
            // Update button states
            document.getElementById('capturePhoto').disabled = true;
            document.getElementById('switchCamera').disabled = true;
            document.getElementById('retakePhoto').style.display = 'inline-flex';
            
            // Stop camera to save battery
            this.stopCamera();
            
            this.showNotification('Profile photo captured successfully!', 'success', true);
        }, 'image/jpeg', 0.9);
    }

    // Livestock Camera Functionality
    initializeLivestockCamera() {
        // Set up event listeners for livestock photo buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('take-livestock-photo') || 
                e.target.closest('.take-livestock-photo')) {
                const entry = e.target.closest('.livestock-entry');
                this.openLivestockCamera(entry);
            }
            
            if (e.target.classList.contains('upload-livestock-photo') || 
                e.target.closest('.upload-livestock-photo')) {
                const entry = e.target.closest('.livestock-entry');
                this.triggerLivestockUpload(entry);
            }
            
            if (e.target.classList.contains('btn-remove-photo') || 
                e.target.closest('.btn-remove-photo')) {
                const entry = e.target.closest('.livestock-entry');
                this.removeLivestockPhotos(entry);
            }
        });
        
        // Set up livestock camera modal buttons
        document.getElementById('switchLivestockCamera').addEventListener('click', () => {
            this.switchCamera('livestockCameraSelect');
        });
        
        document.getElementById('captureLivestockPhoto').addEventListener('click', () => {
            this.captureLivestockPhoto();
        });
    }

    openLivestockCamera(entry) {
        this.currentLivestockEntry = entry;
        document.getElementById('livestockCameraModal').style.display = 'flex';
        
        // Initialize cameras for livestock modal
        setTimeout(async () => {
            await this.getCameras('livestockCameraSelect');
            this.startCamera('livestockCameraView', 'livestockCameraSelect');
        }, 100);
    }

    closeLivestockCamera() {
        document.getElementById('livestockCameraModal').style.display = 'none';
        this.stopLivestockCamera();
        this.currentLivestockEntry = null;
    }

    stopLivestockCamera() {
        if (this.livestockCameraStream) {
            this.livestockCameraStream.getTracks().forEach(track => {
                track.stop();
            });
            this.livestockCameraStream = null;
        }
        const video = document.getElementById('livestockCameraView');
        if (video) {
            video.srcObject = null;
        }
    }

    captureLivestockPhoto() {
        const video = document.getElementById('livestockCameraView');
        const canvas = document.getElementById('livestockPhotoCanvas');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob
        canvas.toBlob((blob) => {
            if (!this.currentLivestockEntry) return;
            
            const entryIndex = Array.from(document.querySelectorAll('.livestock-entry')).indexOf(this.currentLivestockEntry);
            if (!this.livestockPhotos[entryIndex]) {
                this.livestockPhotos[entryIndex] = [];
            }
            
            this.livestockPhotos[entryIndex].push(blob);
            
            // Update preview
            this.updateLivestockPhotoPreview(this.currentLivestockEntry, entryIndex);
            
            // Stop camera
            this.stopLivestockCamera();
            
            // Close modal
            this.closeLivestockCamera();
            
            this.showNotification('Livestock photo captured successfully!', 'success', true);
        }, 'image/jpeg', 0.9);
    }

    triggerLivestockUpload(entry) {
        const input = entry.querySelector('.livestock-photo-input');
        input.click();
        
        input.onchange = (e) => {
            const files = Array.from(e.target.files);
            const entryIndex = Array.from(document.querySelectorAll('.livestock-entry')).indexOf(entry);
            
            if (!this.livestockPhotos[entryIndex]) {
                this.livestockPhotos[entryIndex] = [];
            }
            
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    this.livestockPhotos[entryIndex].push(file);
                }
            });
            
            this.updateLivestockPhotoPreview(entry, entryIndex);
            this.showNotification(`${files.length} photo(s) uploaded`, 'success', true);
        };
    }

    updateLivestockPhotoPreview(entry, entryIndex) {
        const previewContainer = entry.querySelector('.livestock-photo-preview');
        const thumbnailsContainer = entry.querySelector('.photo-thumbnails');
        
        if (!this.livestockPhotos[entryIndex] || this.livestockPhotos[entryIndex].length === 0) {
            previewContainer.style.display = 'none';
            return;
        }
        
        previewContainer.style.display = 'block';
        thumbnailsContainer.innerHTML = '';
        
        this.livestockPhotos[entryIndex].forEach((photo, index) => {
            const url = URL.createObjectURL(photo);
            const thumbnail = document.createElement('div');
            thumbnail.className = 'photo-thumbnail';
            thumbnail.innerHTML = `
                <img src="${url}" alt="Livestock Photo ${index + 1}">
                <button type="button" class="remove-thumbnail" data-entry="${entryIndex}" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            thumbnailsContainer.appendChild(thumbnail);
            
            // Add remove functionality
            thumbnail.querySelector('.remove-thumbnail').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeLivestockPhoto(entryIndex, index);
            });
        });
    }

    removeLivestockPhoto(entryIndex, photoIndex) {
        if (this.livestockPhotos[entryIndex]) {
            this.livestockPhotos[entryIndex].splice(photoIndex, 1);
            const entry = document.querySelectorAll('.livestock-entry')[entryIndex];
            this.updateLivestockPhotoPreview(entry, entryIndex);
            console.log('Photo removed');
        }
    }

    removeLivestockPhotos(entry) {
        const entryIndex = Array.from(document.querySelectorAll('.livestock-entry')).indexOf(entry);
        if (this.livestockPhotos[entryIndex]) {
            this.livestockPhotos[entryIndex] = [];
            this.updateLivestockPhotoPreview(entry, entryIndex);
            console.log('All photos removed from this entry');
        }
    }

    // SIGNATURE FUNCTIONALITY - COMPLETELY FIXED VERSION
    initializeSignature() {
        console.log('Initializing signature canvas...');
        
        const canvas = document.getElementById('signatureCanvas');
        const placeholder = document.getElementById('signaturePlaceholder');
        const signaturePad = document.querySelector('.signature-pad');
        
        if (!canvas) {
            console.error('Signature canvas not found!');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // State variables
        this.isDrawing = false;
        this.signaturePoints = [];
        this.signatureData = null;
        
        // Initialize canvas with proper dimensions
        const initializeCanvasSize = () => {
            // Get the actual display size of the canvas container
            const rect = canvas.parentElement.getBoundingClientRect();
            const displayWidth = Math.floor(rect.width);
            const displayHeight = Math.floor(rect.height);
            
            console.log('Canvas container size:', displayWidth, 'x', displayHeight);
            
            // Check if canvas size matches display size
            if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
                // Save current image data if any
                const imageData = this.signaturePoints.length > 0 ? 
                    ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
                
                // Set canvas to display size
                canvas.width = displayWidth;
                canvas.height = displayHeight;
                
                console.log('Canvas resized to:', canvas.width, 'x', canvas.height);
                
                // Set drawing context properties - BLACK INK
                ctx.strokeStyle = '#000000'; // Pure black
                ctx.lineWidth = 2.5; // Optimal thickness
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.fillStyle = '#000000';
                
                // Restore image data if any
                if (imageData) {
                    ctx.putImageData(imageData, 0, 0);
                }
            }
        };
        
        // Wait for DOM to be ready and canvas to be visible
        const waitForCanvas = () => {
            if (canvas.parentElement.clientWidth > 0 && canvas.parentElement.clientHeight > 0) {
                initializeCanvasSize();
            } else {
                // Try again after a short delay
                setTimeout(waitForCanvas, 100);
            }
        };
        
        // Initialize canvas size when step 7 is shown
        const initializeForStep = () => {
            if (this.currentStep === 7) {
                // Wait a bit for the step to be fully rendered
                setTimeout(() => {
                    waitForCanvas();
                }, 300);
            }
        };
        
        // Listen for step changes
        const originalNextStep = this.nextStep;
        const originalPrevStep = this.prevStep;
        
        this.nextStep = function() {
            originalNextStep.apply(this);
            setTimeout(() => initializeForStep.apply(this), 100);
        };
        
        this.prevStep = function() {
            originalPrevStep.apply(this);
            setTimeout(() => initializeForStep.apply(this), 100);
        };
        
        // Also initialize on page load for step 1
        waitForCanvas();
        
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                initializeCanvasSize();
            }, 250);
        });
        
        // Get canvas coordinates from event
        const getCanvasCoordinates = (e) => {
            const rect = canvas.getBoundingClientRect();
            let clientX, clientY;
            
            if (e.type.includes('touch')) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        };
        
        // Start drawing
        const startDrawing = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const { x, y } = getCanvasCoordinates(e);
            
            this.isDrawing = true;
            signaturePad.classList.add('active');
            placeholder.style.display = 'none';
            
            // Start new path
            ctx.beginPath();
            ctx.moveTo(x, y);
            
            // Draw initial point
            ctx.lineTo(x, y);
            ctx.stroke();
            
            this.signaturePoints.push([x, y]);
            console.log('Started drawing at:', x, y);
        };
        
        // Continue drawing
        const draw = (e) => {
            if (!this.isDrawing) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const { x, y } = getCanvasCoordinates(e);
            
            // Draw line to new position
            ctx.lineTo(x, y);
            ctx.stroke();
            
            this.signaturePoints.push([x, y]);
        };
        
        // Stop drawing
        const stopDrawing = (e) => {
            if (this.isDrawing) {
                e?.preventDefault();
                e?.stopPropagation();
                
                this.isDrawing = false;
                signaturePad.classList.remove('active');
                ctx.closePath();
                this.saveSignature();
                
                console.log('Stopped drawing. Total points:', this.signaturePoints.length);
            }
        };
        
        // Event handlers - SINGLE SET OF HANDLERS (no conflicts)
        const addEventHandlers = () => {
            // Remove any existing event handlers first
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseleave', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
            canvas.removeEventListener('touchcancel', stopDrawing);
            
            // Add clean event handlers
            // Mouse events
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('mouseleave', stopDrawing);
            
            // Touch events
            canvas.addEventListener('touchstart', startDrawing, { passive: false });
            canvas.addEventListener('touchmove', draw, { passive: false });
            canvas.addEventListener('touchend', stopDrawing, { passive: false });
            canvas.addEventListener('touchcancel', stopDrawing, { passive: false });
            
            console.log('Signature event handlers attached');
        };
        
        // Add event handlers after canvas is initialized
        setTimeout(addEventHandlers, 500);
        
        // Clear signature
        document.getElementById('clearSignature').addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.signaturePoints = [];
            this.signatureData = null;
            placeholder.style.display = 'flex';
            console.log('Signature cleared');
        });
        
        // Undo last stroke
        document.getElementById('undoSignature').addEventListener('click', () => {
            if (this.signaturePoints.length > 0) {
                // Clear and redraw all points except last stroke
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                if (this.signaturePoints.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(this.signaturePoints[0][0], this.signaturePoints[0][1]);
                    
                    for (let i = 1; i < this.signaturePoints.length - 1; i++) {
                        ctx.lineTo(this.signaturePoints[i][0], this.signaturePoints[i][1]);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(this.signaturePoints[i][0], this.signaturePoints[i][1]);
                    }
                    
                    this.signaturePoints.pop();
                } else {
                    this.signaturePoints = [];
                    placeholder.style.display = 'flex';
                    this.signatureData = null;
                }
                
                console.log('Undo performed. Remaining points:', this.signaturePoints.length);
            }
        });
        
        // Save signature as blob
        this.saveSignature = () => {
            canvas.toBlob((blob) => {
                this.signatureData = blob;
                console.log('Signature saved as blob:', blob?.size, 'bytes');
            }, 'image/png', 1.0);
        };
        
        console.log('Signature canvas initialization complete');
    }

    // Location Functionality
    initializeLocation() {
        document.getElementById('getCurrentLocation').addEventListener('click', () => {
            this.getCurrentLocation();
        });
    }

    getCurrentLocation() {
        if (!navigator.geolocation) {
            this.showNotification('Geolocation is not supported by your browser', 'error', true);
            return;
        }
        
        this.showNotification('Getting your location...', 'info', true);
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                document.getElementById('latitude').value = lat.toFixed(6);
                document.getElementById('longitude').value = lng.toFixed(6);
                
                this.showNotification('Location obtained successfully!', 'success', true);
                
                // Reverse geocode to get address details
                this.reverseGeocode(lat, lng);
            },
            (error) => {
                let message = 'Unable to retrieve your location.';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location permission denied. Please enable location services.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out.';
                        break;
                }
                this.showNotification(message, 'error', true);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    }

    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            
            if (response.ok) {
                const data = await response.json();
                const address = data.address;
                
                // Update form fields based on geocoded data
                if (address.county && !document.getElementById('county').value) {
                    document.getElementById('county').value = address.county;
                }
                if (address.state && !document.getElementById('county').value) {
                    document.getElementById('county').value = address.state;
                }
                if (address.village && !document.getElementById('village').value) {
                    document.getElementById('village').value = address.village;
                } else if (address.town && !document.getElementById('village').value) {
                    document.getElementById('village').value = address.town;
                }
                
                // Format physical address
                if (!document.getElementById('physicalAddress').value) {
                    const physicalAddress = [];
                    if (address.road) physicalAddress.push(address.road);
                    if (address.village) physicalAddress.push(address.village);
                    if (address.county) physicalAddress.push(address.county);
                    if (address.country) physicalAddress.push(address.country);
                    
                    if (physicalAddress.length > 0) {
                        document.getElementById('physicalAddress').value = physicalAddress.join(', ');
                    }
                }
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
        }
    }

    // Next of Kin Management
    addNextOfKin() {
        const container = document.getElementById('nextOfKinContainer');
        const entryCount = container.children.length;
        
        if (entryCount >= 5) {
            this.showNotification('Maximum 5 next of kin entries allowed', 'warning', true);
            return;
        }
        
        const newEntry = document.createElement('div');
        newEntry.className = 'next-of-kin-entry';
        newEntry.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Next of Kin Name *</label>
                    <input type="text" class="nok-name" name="nok-name[]" required placeholder="Full name">
                    <div class="validation-error-message nok-name-error">Please enter next of kin name</div>
                </div>
                <div class="form-group">
                    <label>Relationship *</label>
                    <input type="text" class="nok-relationship" name="nok-relationship[]" required placeholder="e.g., Spouse, Parent">
                    <div class="validation-error-message nok-relationship-error">Please enter relationship</div>
                </div>
                <div class="form-group">
                    <label>Next of Kin Contact *</label>
                    <input type="tel" class="nok-contact" name="nok-contact[]" required 
                           placeholder="Phone number"
                           inputmode="tel">
                    <div class="validation-error-message nok-contact-error">Please enter a valid phone number</div>
                </div>
                <div class="form-group">
                    <label>Birth Certificate Number (If under 18)</label>
                    <input type="text" class="nok-birth-cert" name="nok-birth-cert[]" placeholder="Enter if next of kin is under 18">
                </div>
                <div class="form-group">
                    <label>Age</label>
                    <input type="number" class="nok-age" name="nok-age[]" min="0" max="120" placeholder="Age in years">
                </div>
            </div>
            <button type="button" class="btn-remove-nok" onclick="projectCeresForm.removeNextOfKin(this)">
                <i class="fas fa-trash"></i> Remove
            </button>
        `;
        
        container.appendChild(newEntry);
        
        // Set up phone formatting for new field
        const phoneInput = newEntry.querySelector('.nok-contact');
        this.formatPhoneInput(phoneInput);
        
        console.log('Next of kin entry added');
    }

    removeNextOfKin(button) {
        const container = document.getElementById('nextOfKinContainer');
        if (container.children.length > 1) {
            button.closest('.next-of-kin-entry').remove();
            console.log('Next of kin entry removed');
        } else {
            this.showNotification('At least one next of kin entry is required', 'warning', true);
        }
    }

    // Livestock Management
    addLivestockEntry() {
        const container = document.getElementById('livestockContainer');
        const newEntry = document.createElement('div');
        newEntry.className = 'livestock-entry';
        newEntry.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Type of Livestock *</label>
                    <select class="livestock-type" name="livestock-type[]" required>
                        <option value="">Select type...</option>
                        <option value="Cattle">Cattle</option>
                        <option value="Goat">Goat</option>
                        <option value="Sheep">Sheep</option>
                        <option value="Chicken">Chicken</option>
                        <option value="Pig">Pig</option>
                        <option value="Other">Other</option>
                    </select>
                    <div class="validation-error-message livestock-type-error">Please select livestock type</div>
                </div>
                <div class="form-group">
                    <label>Produce</label>
                    <select class="livestock-produce" name="livestock-produce[]">
                        <option value="">Select produce...</option>
                        <option value="Milk">Milk</option>
                        <option value="Eggs">Eggs</option>
                        <option value="Meat">Meat</option>
                        <option value="Wool">Wool</option>
                        <option value="Manure">Manure</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Number of Animals *</label>
                    <input type="number" class="livestock-count" name="livestock-count[]" min="1" required placeholder="0">
                    <div class="validation-error-message livestock-count-error">Please enter number of animals (minimum 1)</div>
                </div>
            </div>
            <div class="form-group">
                <label>Additional Info (Breed, Age, etc.)</label>
                <textarea class="livestock-info" name="livestock-info[]" placeholder="Optional information about the animals..." rows="2"></textarea>
            </div>
            
            <div class="livestock-photo-section">
                <h4><i class="fas fa-camera"></i> Animal Photo</h4>
                <div class="photo-options">
                    <button type="button" class="btn-secondary take-livestock-photo">
                        <i class="fas fa-camera"></i> Take Photo with Camera
                    </button>
                    <span class="or-divider">OR</span>
                    <div class="upload-option">
                        <input type="file" class="livestock-photo-input" accept="image/*" multiple style="display:none;">
                        <button type="button" class="btn-secondary upload-livestock-photo">
                            <i class="fas fa-upload"></i> Upload Photo
                        </button>
                    </div>
                </div>
                <div class="livestock-photo-preview" style="display:none;">
                    <div class="photo-thumbnails"></div>
                    <button type="button" class="btn-remove-photo">
                        <i class="fas fa-trash"></i> Remove Photo
                    </button>
                </div>
            </div>
            
            <button type="button" class="btn-remove-livestock" onclick="projectCeresForm.removeLivestockEntry(this)">
                <i class="fas fa-trash"></i> Remove This Entry
            </button>
        `;
        
        container.appendChild(newEntry);
        console.log('Livestock entry added');
    }

    removeLivestockEntry(button) {
        const container = document.getElementById('livestockContainer');
        if (container.children.length > 1) {
            const entry = button.closest('.livestock-entry');
            const entryIndex = Array.from(container.children).indexOf(entry);
            
            // Remove associated photos
            if (this.livestockPhotos[entryIndex]) {
                this.livestockPhotos.splice(entryIndex, 1);
            }
            
            entry.remove();
            console.log('Livestock entry removed');
        }
    }

    // Profile View
    toggleProfileView() {
        const formContainer = document.querySelector('.form-container');
        const profileView = document.getElementById('profileView');
        
        if (profileView.style.display === 'none') {
            // Save all data first
            this.saveCurrentStepData();
            this.generateProfileView();
            formContainer.style.display = 'none';
            profileView.style.display = 'block';
        } else {
            profileView.style.display = 'none';
            formContainer.style.display = 'block';
        }
    }

    generateProfileView() {
        const profileContent = document.getElementById('profileContent');
        let html = '';
        
        // Personal Information
        html += `
            <div class="profile-section">
                <h3><i class="fas fa-user-circle"></i> Personal Information</h3>
                <div class="profile-row">
                    <div class="profile-label">Full Name:</div>
                    <div class="profile-value">${this.formData.personal.fullName || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Phone Number:</div>
                    <div class="profile-value">${this.formData.personal.phone ? '+254' + this.formData.personal.phone.substring(3) : 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Email:</div>
                    <div class="profile-value">${this.formData.personal.email || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Date of Birth:</div>
                    <div class="profile-value">${this.formData.personal.dob || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Marital Status:</div>
                    <div class="profile-value">${this.formData.personal.maritalStatus || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Nationality:</div>
                    <div class="profile-value">${this.formData.personal.nationality || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">ID Number:</div>
                    <div class="profile-value">${this.formData.personal.idNumber || 'Not provided'}</div>
                </div>
            </div>
        `;
        
        // Next of Kin
        if (this.formData.nextOfKin.length > 0) {
            html += `<div class="profile-section"><h3><i class="fas fa-users"></i> Next of Kin</h3>`;
            this.formData.nextOfKin.forEach((nok, index) => {
                let extraInfo = '';
                if (nok.birthCert) extraInfo += `<br><small>Birth Cert: ${nok.birthCert}</small>`;
                if (nok.age) extraInfo += `<br><small>Age: ${nok.age} years</small>`;
                
                html += `
                    <div class="profile-row">
                        <div class="profile-label">Next of Kin ${index + 1}:</div>
                        <div class="profile-value">
                            ${nok.name || ''} (${nok.relationship || ''})<br>
                            <small>Contact: ${nok.contact ? '+254' + nok.contact.substring(3) : ''}</small>
                            ${extraInfo}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        // Location
        html += `
            <div class="profile-section">
                <h3><i class="fas fa-map-marker-alt"></i> Location Information</h3>
                <div class="profile-row">
                    <div class="profile-label">County:</div>
                    <div class="profile-value">${this.formData.location.county || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Sub-County:</div>
                    <div class="profile-value">${this.formData.location.subCounty || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Ward:</div>
                    <div class="profile-value">${this.formData.location.ward || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Village/Location:</div>
                    <div class="profile-value">${this.formData.location.village || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Physical Address:</div>
                    <div class="profile-value">${this.formData.location.physicalAddress || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">GPS Coordinates:</div>
                    <div class="profile-value">
                        ${this.formData.location.gps.latitude ? `Lat: ${this.formData.location.gps.latitude}, Lng: ${this.formData.location.gps.longitude}` : 'Not provided'}
                    </div>
                </div>
            </div>
        `;
        
        // Farmer Journey
        html += `
            <div class="profile-section">
                <h3><i class="fas fa-seedling"></i> Farmer Journey</h3>
                <div class="profile-row">
                    <div class="profile-label">Description:</div>
                    <div class="profile-value" style="white-space: pre-wrap;">${this.formData.farmerJourney.description || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Future Goals:</div>
                    <div class="profile-value" style="white-space: pre-wrap;">${this.formData.farmerJourney.futureGoals || 'Not provided'}</div>
                </div>
            </div>
        `;
        
        // Livestock
        if (this.formData.livestock.length > 0) {
            html += `<div class="profile-section"><h3><i class="fas fa-paw"></i> Livestock Information</h3>`;
            this.formData.livestock.forEach((animal, index) => {
                html += `
                    <div class="profile-row">
                        <div class="profile-label">Livestock ${index + 1}:</div>
                        <div class="profile-value">
                            ${animal.count || 0} ${animal.type || 'animals'} 
                            ${animal.produce ? `- Produce: ${animal.produce}` : ''}
                            ${animal.info ? `<br><small>${animal.info}</small>` : ''}
                            ${animal.photoCount > 0 ? `<br><small>${animal.photoCount} photo(s) attached</small>` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        // Images
        html += `
            <div class="profile-section">
                <h3><i class="fas fa-images"></i> Uploaded Images</h3>
                <div class="profile-row">
                    <div class="profile-label">Profile Photo:</div>
                    <div class="profile-value">${this.formData.profilePhotoUrl ? 'Uploaded ✓' : 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Signature:</div>
                    <div class="profile-value">${this.formData.signatureUrl ? 'Uploaded ✓' : 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Livestock Photos:</div>
                    <div class="profile-value">${this.formData.livestockPhotoUrls.length > 0 ? `${this.formData.livestockPhotoUrls.length} photo(s) uploaded ✓` : 'No photos uploaded'}</div>
                </div>
            </div>
        `;
        
        // Consent
        html += `
            <div class="profile-section">
                <h3><i class="fas fa-file-signature"></i> Consent</h3>
                <div class="profile-row">
                    <div class="profile-label">Consent Given:</div>
                    <div class="profile-value">${this.formData.consent ? 'Yes' : 'No'}</div>
                </div>
            </div>
        `;
        
        profileContent.innerHTML = html;
    }

    // ============================================
    // FIREBASE STORAGE UPLOAD FUNCTIONS
    // ============================================
    
    async uploadToFirebaseStorage(file, fileType = 'profile') {
        try {
            console.log(`Uploading ${fileType} to Firebase Storage...`);
            
            const { ref, uploadBytes, getDownloadURL } = window.firebaseModules;
            
            // Generate unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            
            // Determine folder and file extension
            let folder = 'muthegi-group/profiles';
            let fileExtension = 'jpg';
            
            if (fileType === 'signature') {
                folder = 'muthegi-group/signatures';
                fileExtension = 'png'; // Signatures are saved as PNG for transparency
            } else if (fileType === 'livestock') {
                folder = 'muthegi-group/livestock';
                fileExtension = 'jpg';
            }
            
            const fileName = `${fileType}_${timestamp}_${randomString}.${fileExtension}`;
            const storageRef = ref(this.storage, `${folder}/${fileName}`);
            
            // Upload file
            const snapshot = await uploadBytes(storageRef, file);
            
            // Get download URL
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            console.log(`${fileType} uploaded successfully:`, downloadURL);
            
            return {
                success: true,
                url: downloadURL,
                fileName: fileName,
                fileType: fileType
            };
        } catch (error) {
            console.error(`Firebase Storage upload error (${fileType}):`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================
    // FIREBASE FIRESTORE SAVE FUNCTION
    // ============================================
    
    async saveToFirebase(data) {
        if (!this.firebaseInitialized || !this.db) {
            throw new Error('Firebase not initialized');
        }
        
        try {
            const { collection, addDoc } = window.firebaseModules;
            
            const firebaseData = {
                // Form data
                personal: data.personal,
                nextOfKin: data.nextOfKin,
                location: data.location,
                farmerJourney: data.farmerJourney,
                livestock: data.livestock,
                consent: data.consent,
                
                // Image URLs (uploaded to Firebase Storage)
                profilePhotoUrl: data.profilePhotoUrl,
                signatureUrl: data.signatureUrl,
                livestockPhotoUrls: data.livestockPhotoUrls,
                
                // Metadata
                submissionDate: new Date().toISOString(),
                status: 'submitted',
                group: 'Muthegi Group',
                project: 'Project Ceres',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            console.log('Saving to Firebase:', firebaseData);
            
            const docRef = await addDoc(collection(this.db, 'muthegi-group-members'), firebaseData);
            
            return {
                success: true,
                docId: docRef.id,
                message: 'Data saved to Firebase successfully'
            };
        } catch (error) {
            console.error('Firebase save error:', error);
            throw new Error(`Failed to save to Firebase: ${error.message}`);
        }
    }

    // Save data locally as fallback
    saveToLocalStorage(data) {
        try {
            const timestamp = new Date().getTime();
            const key = `muthegi_member_${timestamp}`;
            localStorage.setItem(key, JSON.stringify(data));
            
            const savedForms = JSON.parse(localStorage.getItem('muthegi_saved_forms') || '[]');
            savedForms.push({
                key: key,
                name: data.personal.fullName,
                timestamp: timestamp,
                date: new Date().toISOString()
            });
            localStorage.setItem('muthegi_saved_forms', JSON.stringify(savedForms));
            
            return {
                success: true,
                key: key,
                message: 'Data saved locally as backup'
            };
        } catch (error) {
            console.error('Local storage save error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================
    // FORM SUBMISSION - FIXED TO PREVENT DOUBLE SUBMISSION
    // ============================================
    
    async submitForm() {
        // Prevent double submission
        if (this.isSubmitting) {
            console.log('Submission already in progress, ignoring duplicate request');
            return;
        }
        
        this.showNotification('Starting submission process...', 'info', true);
        
        try {
            this.isSubmitting = true;
            
            // Validate all steps for final submission
            for (let i = 1; i <= this.totalSteps; i++) {
                this.currentStep = i;
                if (!this.validateCurrentStep(true)) {
                    this.showNotification('Please complete all required fields', 'error', true);
                    this.updateStepIndicator();
                    this.isSubmitting = false;
                    return;
                }
            }
            
            // Save all form data
            this.saveCurrentStepData();
            
            // Disable submit button
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading Images...';
            
            // ============================================
            // STEP 1: UPLOAD ALL IMAGES TO FIREBASE STORAGE
            // ============================================
            
            this.showNotification('Uploading images to storage...', 'info', true);
            
            // 1. Upload profile photo
            let profilePhotoUrl = null;
            if (this.profilePhotoData) {
                console.log('Uploading profile photo to Firebase Storage...');
                const uploadResult = await this.uploadToFirebaseStorage(this.profilePhotoData, 'profile');
                if (uploadResult.success) {
                    profilePhotoUrl = uploadResult.url;
                    this.formData.profilePhotoUrl = profilePhotoUrl;
                    console.log('Profile photo uploaded:', profilePhotoUrl);
                    this.showNotification('Profile photo uploaded ✓', 'success', true);
                } else {
                    console.error('Failed to upload profile photo:', uploadResult.error);
                    this.showNotification('Failed to upload profile photo. Data will be saved without image.', 'warning', true);
                }
            }
            
            // 2. Upload signature
            let signatureUrl = null;
            if (this.signatureData) {
                console.log('Uploading signature to Firebase Storage...');
                const uploadResult = await this.uploadToFirebaseStorage(this.signatureData, 'signature');
                if (uploadResult.success) {
                    signatureUrl = uploadResult.url;
                    this.formData.signatureUrl = signatureUrl;
                    console.log('Signature uploaded:', signatureUrl);
                    this.showNotification('Signature uploaded ✓', 'success', true);
                } else {
                    console.error('Failed to upload signature:', uploadResult.error);
                    this.showNotification('Failed to upload signature. Data will be saved without signature.', 'warning', true);
                }
            }
            
            // 3. Upload livestock photos
            this.formData.livestockPhotoUrls = [];
            let totalLivestockPhotos = 0;
            let uploadedLivestockPhotos = 0;
            
            // Count total photos
            for (let i = 0; i < this.livestockPhotos.length; i++) {
                if (this.livestockPhotos[i]) {
                    totalLivestockPhotos += this.livestockPhotos[i].length;
                }
            }
            
            if (totalLivestockPhotos > 0) {
                this.showNotification(`Uploading ${totalLivestockPhotos} livestock photo(s)...`, 'info', true);
                
                for (let i = 0; i < this.livestockPhotos.length; i++) {
                    const photos = this.livestockPhotos[i];
                    if (photos && photos.length > 0) {
                        for (let j = 0; j < photos.length; j++) {
                            console.log(`Uploading livestock photo ${uploadedLivestockPhotos + 1} of ${totalLivestockPhotos}...`);
                            const uploadResult = await this.uploadToFirebaseStorage(photos[j], 'livestock');
                            if (uploadResult.success) {
                                this.formData.livestockPhotoUrls.push({
                                    livestockIndex: i,
                                    photoIndex: j,
                                    url: uploadResult.url,
                                    uploadedAt: new Date().toISOString()
                                });
                                uploadedLivestockPhotos++;
                                console.log(`Livestock photo ${uploadedLivestockPhotos} uploaded:`, uploadResult.url);
                            } else {
                                console.error(`Failed to upload livestock photo ${uploadedLivestockPhotos + 1}:`, uploadResult.error);
                            }
                        }
                    }
                }
                
                if (uploadedLivestockPhotos > 0) {
                    this.showNotification(`${uploadedLivestockPhotos} livestock photo(s) uploaded ✓`, 'success', true);
                }
            }
            
            // ============================================
            // STEP 2: SAVE COMPLETE DATA TO FIREBASE FIRESTORE
            // ============================================
            
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Data...';
            this.showNotification('Saving data to database...', 'info', true);
            
            // Add metadata to form data
            const completeFormData = {
                ...this.formData,
                submissionDate: new Date().toISOString(),
                status: 'submitted',
                group: 'Muthegi Group',
                project: 'Project Ceres',
                totalLivestockPhotos: uploadedLivestockPhotos
            };
            
            // Save to Firebase
            let firebaseResult = null;
            if (this.firebaseInitialized) {
                try {
                    console.log('Saving complete data to Firebase...');
                    firebaseResult = await this.saveToFirebase(completeFormData);
                    console.log('Firebase save result:', firebaseResult);
                } catch (firebaseError) {
                    console.error('Firebase save failed:', firebaseError);
                    firebaseResult = { success: false, error: firebaseError.message };
                }
            }
            
            // Save locally as backup
            const localResult = this.saveToLocalStorage(completeFormData);
            if (localResult.success) {
                console.log('Data backed up locally with key:', localResult.key);
            }
            
            // ============================================
            // STEP 3: SHOW FINAL RESULT
            // ============================================
            
            if (firebaseResult && firebaseResult.success) {
                this.showNotification('Form submitted successfully! Data saved to database.', 'success', true);
                console.log('Form submission complete. Document ID:', firebaseResult.docId);
                
                // Show success message with details
                setTimeout(() => {
                    this.showNotification(
                        `Thank you! Your data has been saved. ${uploadedLivestockPhotos > 0 ? uploadedLivestockPhotos + ' livestock photos uploaded.' : ''}`,
                        'success',
                        true
                    );
                }, 1000);
                
                // Reset form after 5 seconds
                setTimeout(() => {
                    this.resetForm();
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Data';
                    this.isSubmitting = false;
                }, 5000);
                
            } else {
                // Firebase failed but local save worked
                this.showNotification('Form submitted! Data saved locally (database connection failed).', 'warning', true);
                console.log('Local backup saved with key:', localResult.key);
                
                // Reset form after 3 seconds
                setTimeout(() => {
                    this.resetForm();
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Data';
                    this.isSubmitting = false;
                }, 3000);
            }
            
        } catch (error) {
            console.error('Submission error:', error);
            this.showNotification(`Submission failed: ${error.message}`, 'error', true);
            
            // Re-enable submit button and reset submission state
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Data';
            this.isSubmitting = false;
        }
    }

    resetForm() {
        // Reset form data
        this.formData = {
            personal: {},
            nextOfKin: [],
            location: {},
            farmerJourney: {},
            livestock: [],
            consent: false,
            profilePhotoUrl: null,
            signatureUrl: null,
            livestockPhotoUrls: []
        };
        
        this.profilePhotoData = null;
        this.livestockPhotos = [];
        this.signatureData = null;
        this.signaturePoints = [];
        this.shownNotifications.clear();
        
        // Reset form fields
        document.getElementById('memberForm').reset();
        
        // Reset camera preview
        const preview = document.getElementById('profilePreview');
        preview.innerHTML = '<i class="fas fa-user fa-5x"></i><p>No profile picture taken</p>';
        preview.style.display = 'flex';
        
        const video = document.getElementById('cameraView');
        if (video) {
            video.srcObject = null;
            video.style.display = 'block';
        }
        
        document.getElementById('capturePhoto').disabled = false;
        document.getElementById('switchCamera').disabled = false;
        document.getElementById('retakePhoto').style.display = 'none';
        
        // Reset signature canvas
        const canvas = document.getElementById('signatureCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            document.getElementById('signaturePlaceholder').style.display = 'flex';
        }
        
        // Reset next of kin and livestock containers to single entry
        document.getElementById('nextOfKinContainer').innerHTML = `
            <div class="next-of-kin-entry">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Next of Kin Name *</label>
                        <input type="text" class="nok-name" name="nok-name[]" required placeholder="Full name">
                        <div class="validation-error-message nok-name-error">Please enter next of kin name</div>
                    </div>
                    <div class="form-group">
                        <label>Relationship *</label>
                        <input type="text" class="nok-relationship" name="nok-relationship[]" required placeholder="e.g., Spouse, Parent">
                        <div class="validation-error-message nok-relationship-error">Please enter relationship</div>
                    </div>
                    <div class="form-group">
                        <label>Next of Kin Contact *</label>
                        <input type="tel" class="nok-contact" name="nok-contact[]" required 
                               placeholder="Phone number"
                               inputmode="tel">
                        <div class="validation-error-message nok-contact-error">Please enter a valid phone number</div>
                    </div>
                    <div class="form-group">
                        <label>Birth Certificate Number (If under 18)</label>
                        <input type="text" class="nok-birth-cert" name="nok-birth-cert[]" placeholder="Enter if next of kin is under 18">
                    </div>
                    <div class="form-group">
                        <label>Age</label>
                        <input type="number" class="nok-age" name="nok-age[]" min="0" max="120" placeholder="Age in years">
                    </div>
                </div>
                <button type="button" class="btn-remove-nok" onclick="projectCeresForm.removeNextOfKin(this)">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        `;
        
        document.getElementById('livestockContainer').innerHTML = `
            <div class="livestock-entry">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Type of Livestock *</label>
                        <select class="livestock-type" name="livestock-type[]" required>
                            <option value="">Select type...</option>
                            <option value="Cattle">Cattle</option>
                            <option value="Goat">Goat</option>
                            <option value="Sheep">Sheep</option>
                            <option value="Chicken">Chicken</option>
                            <option value="Pig">Pig</option>
                            <option value="Other">Other</option>
                        </select>
                        <div class="validation-error-message livestock-type-error">Please select livestock type</div>
                    </div>
                    <div class="form-group">
                        <label>Produce</label>
                        <select class="livestock-produce" name="livestock-produce[]">
                            <option value="">Select produce...</option>
                            <option value="Milk">Milk</option>
                            <option value="Eggs">Eggs</option>
                            <option value="Meat">Meat</option>
                            <option value="Wool">Wool</option>
                            <option value="Manure">Manure</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Number of Animals *</label>
                        <input type="number" class="livestock-count" name="livestock-count[]" min="1" required placeholder="0">
                        <div class="validation-error-message livestock-count-error">Please enter number of animals (minimum 1)</div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Additional Info (Breed, Age, etc.)</label>
                    <textarea class="livestock-info" name="livestock-info[]" placeholder="Optional information about the animals..." rows="2"></textarea>
                </div>
                
                <div class="livestock-photo-section">
                    <h4><i class="fas fa-camera"></i> Animal Photo</h4>
                    <div class="photo-options">
                        <button type="button" class="btn-secondary take-livestock-photo">
                            <i class="fas fa-camera"></i> Take Photo with Camera
                        </button>
                        <span class="or-divider">OR</span>
                        <div class="upload-option">
                            <input type="file" class="livestock-photo-input" accept="image/*" multiple style="display:none;">
                            <button type="button" class="btn-secondary upload-livestock-photo">
                                <i class="fas fa-upload"></i> Upload Photo
                            </button>
                        </div>
                    </div>
                    <div class="livestock-photo-preview" style="display:none;">
                        <div class="photo-thumbnails"></div>
                        <button type="button" class="btn-remove-photo">
                            <i class="fas fa-trash"></i> Remove Photo
                        </button>
                    </div>
                </div>
                
                <button type="button" class="btn-remove-livestock" onclick="projectCeresForm.removeLivestockEntry(this)">
                    <i class="fas fa-trash"></i> Remove This Entry
                </button>
            </div>
        `;
        
        // Reset step
        this.currentStep = 1;
        this.updateStepIndicator();
        
        // Close any open modal
        document.getElementById('livestockCameraModal').style.display = 'none';
        this.stopLivestockCamera();
        
        // Re-setup phone fields
        this.setupDynamicPhoneFields();
        
        // Reinitialize signature
        setTimeout(() => {
            this.initializeSignature();
        }, 500);
    }

    // Notification System with control
    showNotification(message, type = 'info', forceShow = false) {
        // Only show important notifications
        if (!forceShow && type === 'info') {
            console.log(`Info: ${message}`);
            return;
        }
        
        // Limit error notifications
        if (type === 'error' && !forceShow) {
            const errorKey = `error-${message.substring(0, 50)}`;
            if (this.shownNotifications.has(errorKey)) {
                return;
            }
            this.shownNotifications.add(errorKey);
        }
        
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="${icons[type] || 'fas fa-info-circle'}"></i>
            <div class="notification-content">${message}</div>
        `;
        
        container.appendChild(notification);
        
        // Remove notification after appropriate time
        const duration = type === 'error' ? 8000 : 5000;
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

// Initialize the form when DOM is loaded
let projectCeresForm;
document.addEventListener('DOMContentLoaded', () => {
    projectCeresForm = new ProjectCeresForm();
});

// Global functions for HTML onclick events
function nextStep() {
    projectCeresForm.nextStep();
}

function prevStep() {
    projectCeresForm.prevStep();
}

function addNextOfKin() {
    projectCeresForm.addNextOfKin();
}

function removeNextOfKin(button) {
    projectCeresForm.removeNextOfKin(button);
}

function addLivestockEntry() {
    projectCeresForm.addLivestockEntry();
}

function removeLivestockEntry(button) {
    projectCeresForm.removeLivestockEntry(button);
}

function toggleProfileView() {
    projectCeresForm.toggleProfileView();
}

function closeLivestockCamera() {
    projectCeresForm.closeLivestockCamera();
}
