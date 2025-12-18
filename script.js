// Project Ceres - Muthegi Group Data Collection Form
// Import Firebase modules
const firebaseScript = document.createElement('script');
firebaseScript.type = 'module';
firebaseScript.innerHTML = `
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
  import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
  
  window.firebaseModules = { initializeApp, getFirestore, collection, addDoc, getAnalytics };
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
            profilePhoto: null,
            location: {},
            farmerJourney: {},
            livestock: [],
            signature: null,
            consent: false
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
        this.analytics = null;
        this.firebaseInitialized = false;
        
        this.init();
    }

    async init() {
        // Hide loading overlay after page loads
        setTimeout(() => {
            document.getElementById('loadingOverlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loadingOverlay').style.display = 'none';
                document.getElementById('mainContainer').style.display = 'block';
                this.showNotification('Welcome to Project Ceres Data Collection Form', 'info');
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
        
        // Set up form submission
        document.getElementById('memberForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitForm();
        });
        
        // Show initial guide
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
            
            const { initializeApp, getFirestore, getAnalytics } = window.firebaseModules;
            
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
            this.db = getFirestore(app);
            this.analytics = getAnalytics(app);
            this.firebaseInitialized = true;
            
            console.log('Firebase initialized successfully');
            this.showNotification('Database connection established', 'success');
            
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.showNotification('Database connection failed. Data will be saved locally.', 'error');
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
        
        // Phone number formatting - Fixed pattern issue
        document.getElementById('phone').addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.startsWith('254')) {
                value = '+' + value;
            } else if (value.startsWith('0')) {
                value = '+254' + value.substring(1);
            }
            e.target.value = this.formatPhoneNumber(value);
        });
        
        // Remove the problematic pattern attribute
        document.getElementById('phone').removeAttribute('pattern');
        
        // Set current date for consent
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatPhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length <= 3) {
            return '+' + cleaned;
        } else if (cleaned.length <= 6) {
            return '+' + cleaned.slice(0, 3) + ' ' + cleaned.slice(3);
        } else {
            return '+' + cleaned.slice(0, 3) + ' ' + cleaned.slice(3, 6) + ' ' + cleaned.slice(6, 9);
        }
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
        
        // Show step guide
        this.showStepGuide();
    }

    showStepGuide() {
        const guides = {
            1: "Start by filling in your personal details. Make sure all required fields are completed.",
            2: "Add your next of kin information. You can add multiple entries. If they're under 18, provide birth certificate number.",
            3: "Take a clear profile photo. You can switch between front and rear cameras.",
            4: "Provide your farm location details. Use the GPS button to get your current coordinates.",
            5: "Tell us about your farming journey and future goals.",
            6: "Add information about your livestock. You can take photos with your camera.",
            7: "Read the consent statement carefully and provide your digital signature."
        };
        
        if (guides[this.currentStep]) {
            this.showNotification(guides[this.currentStep], 'info');
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
            }
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepIndicator();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    validateCurrentStep() {
        const stepId = `step${this.currentStep}`;
        const step = document.getElementById(stepId);
        const requiredInputs = step.querySelectorAll('[required]');
        
        let isValid = true;
        
        requiredInputs.forEach(input => {
            if (!input.value.trim()) {
                input.style.borderColor = 'var(--danger)';
                isValid = false;
            } else {
                input.style.borderColor = '';
            }
        });
        
        if (!isValid) {
            this.showNotification('Please fill in all required fields marked with *', 'error');
            return false;
        }
        
        // Additional validation for email
        if (this.currentStep === 1) {
            const email = document.getElementById('email');
            if (email.value && !this.isValidEmail(email.value)) {
                email.style.borderColor = 'var(--danger)';
                this.showNotification('Please enter a valid email address', 'error');
                return false;
            }
        }
        
        // Additional validation for phone
        if (this.currentStep === 1) {
            const phone = document.getElementById('phone');
            const phoneValue = phone.value.replace(/\s/g, '');
            if (phoneValue && !this.isValidPhone(phoneValue)) {
                phone.style.borderColor = 'var(--danger)';
                this.showNotification('Please enter a valid phone number (e.g., +254 712 345 678)', 'error');
                return false;
            }
        }
        
        // Validation for signature
        if (this.currentStep === 7) {
            if (!this.signatureData) {
                this.showNotification('Please provide your digital signature', 'error');
                return false;
            }
            
            const consentCheckbox = document.getElementById('agreeConsent');
            if (!consentCheckbox.checked) {
                this.showNotification('Please agree to the consent statement', 'error');
                return false;
            }
        }
        
        return true;
    }

    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    isValidPhone(phone) {
        // Accept +254 followed by 9 digits, or local format starting with 0
        const re = /^(?:\+254|0)[17]\d{8}$/;
        return re.test(phone.replace(/\s/g, ''));
    }

    saveCurrentStepData() {
        switch(this.currentStep) {
            case 1:
                this.formData.personal = {
                    fullName: document.getElementById('fullName').value,
                    phone: document.getElementById('phone').value,
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
                    const nok = {
                        name: entry.querySelector('.nok-name').value,
                        relationship: entry.querySelector('.nok-relationship').value,
                        contact: entry.querySelector('.nok-contact').value,
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
                        photos: this.livestockPhotos[index] || []
                    };
                    if (livestock.type || livestock.count) {
                        this.formData.livestock.push(livestock);
                    }
                });
                break;
                
            case 7:
                this.formData.consent = document.getElementById('agreeConsent').checked;
                this.formData.signature = this.signatureData;
                break;
        }
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
            this.showNotification('You can now retake your profile photo', 'info');
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
            this.showNotification('Unable to access camera. Please check permissions.', 'error');
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
        } catch (error) {
            console.error('Error starting camera:', error);
            this.showNotification('Camera access denied. Please allow camera permissions.', 'error');
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
            this.showNotification('Only one camera available', 'warning');
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
        
        // Convert to blob
        canvas.toBlob((blob) => {
            this.profilePhotoData = blob;
            
            // Show preview
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
            
            this.showNotification('Profile photo captured successfully! Camera turned off to save battery.', 'success');
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
            
            this.showNotification('Livestock photo captured successfully!', 'success');
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
            this.showNotification(`${files.length} photo(s) uploaded successfully!`, 'success');
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
            this.showNotification('Photo removed', 'info');
        }
    }

    removeLivestockPhotos(entry) {
        const entryIndex = Array.from(document.querySelectorAll('.livestock-entry')).indexOf(entry);
        if (this.livestockPhotos[entryIndex]) {
            this.livestockPhotos[entryIndex] = [];
            this.updateLivestockPhotoPreview(entry, entryIndex);
            this.showNotification('All photos removed from this entry', 'info');
        }
    }

    // Signature Functionality
    initializeSignature() {
        const canvas = document.getElementById('signatureCanvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        // Set drawing style
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Event listeners for drawing
        canvas.addEventListener('mousedown', (e) => this.startDrawing(e, canvas, ctx));
        canvas.addEventListener('mousemove', (e) => this.draw(e, canvas, ctx));
        canvas.addEventListener('mouseup', () => this.stopDrawing());
        canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events for mobile
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e, canvas, ctx);
        });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e, canvas, ctx);
        });
        canvas.addEventListener('touchend', () => {
            this.stopDrawing();
        });
        
        // Clear signature button
        document.getElementById('clearSignature').addEventListener('click', () => {
            this.clearSignature(canvas, ctx);
        });
        
        // Undo button
        document.getElementById('undoSignature').addEventListener('click', () => {
            this.undoSignature(canvas, ctx);
        });
    }

    startDrawing(e, canvas, ctx) {
        this.isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        
        this.signaturePoints = [[x, y]];
        document.getElementById('signaturePlaceholder').style.display = 'none';
        
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    draw(e, canvas, ctx) {
        if (!this.isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        
        this.signaturePoints.push([x, y]);
        
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveSignature();
        }
    }

    clearSignature(canvas, ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.signaturePoints = [];
        this.signatureData = null;
        document.getElementById('signaturePlaceholder').style.display = 'flex';
        this.showNotification('Signature cleared', 'info');
    }

    undoSignature(canvas, ctx) {
        if (this.signaturePoints.length > 0) {
            this.signaturePoints.pop();
            
            // Redraw all points
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (this.signaturePoints.length > 0) {
                ctx.beginPath();
                ctx.moveTo(this.signaturePoints[0][0], this.signaturePoints[0][1]);
                
                for (let i = 1; i < this.signaturePoints.length; i++) {
                    ctx.lineTo(this.signaturePoints[i][0], this.signaturePoints[i][1]);
                }
                ctx.stroke();
            } else {
                document.getElementById('signaturePlaceholder').style.display = 'flex';
                this.signatureData = null;
            }
            
            this.showNotification('Last stroke undone', 'info');
        }
    }

    saveSignature() {
        const canvas = document.getElementById('signatureCanvas');
        canvas.toBlob((blob) => {
            this.signatureData = blob;
            this.showNotification('Signature saved', 'success');
        }, 'image/png');
    }

    // Location Functionality
    initializeLocation() {
        document.getElementById('getCurrentLocation').addEventListener('click', () => {
            this.getCurrentLocation();
        });
    }

    getCurrentLocation() {
        if (!navigator.geolocation) {
            this.showNotification('Geolocation is not supported by your browser', 'error');
            return;
        }
        
        this.showNotification('Getting your location... Please ensure location services are enabled.', 'warning');
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                document.getElementById('latitude').value = lat.toFixed(6);
                document.getElementById('longitude').value = lng.toFixed(6);
                
                this.showNotification('Location obtained successfully!', 'success');
                
                // Reverse geocode to get address details
                this.reverseGeocode(lat, lng);
            },
            (error) => {
                let message = 'Unable to retrieve your location.';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location permission denied. Please enable location services in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out.';
                        break;
                }
                this.showNotification(message, 'error');
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
            // Using OpenStreetMap Nominatim API
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
            this.showNotification('Maximum 5 next of kin entries allowed', 'warning');
            return;
        }
        
        const newEntry = document.createElement('div');
        newEntry.className = 'next-of-kin-entry';
        newEntry.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Next of Kin Name *</label>
                    <input type="text" class="nok-name" name="nok-name[]" required placeholder="Full name">
                </div>
                <div class="form-group">
                    <label>Relationship *</label>
                    <input type="text" class="nok-relationship" name="nok-relationship[]" required placeholder="e.g., Spouse, Parent">
                </div>
                <div class="form-group">
                    <label>Next of Kin Contact *</label>
                    <input type="tel" class="nok-contact" name="nok-contact[]" required placeholder="Phone number">
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
        this.showNotification('Next of kin entry added', 'success');
    }

    removeNextOfKin(button) {
        const container = document.getElementById('nextOfKinContainer');
        if (container.children.length > 1) {
            button.closest('.next-of-kin-entry').remove();
            this.showNotification('Next of kin entry removed', 'success');
        } else {
            this.showNotification('At least one next of kin entry is required', 'warning');
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
        this.showNotification('Livestock entry added', 'success');
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
            this.showNotification('Livestock entry removed', 'success');
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
                    <div class="profile-value">${this.formData.personal.phone || 'Not provided'}</div>
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
                            <small>Contact: ${nok.contact || ''}</small>
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
                            ${animal.photos && animal.photos.length > 0 ? `<br><small>${animal.photos.length} photo(s) attached</small>` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        // Consent
        html += `
            <div class="profile-section">
                <h3><i class="fas fa-file-signature"></i> Consent</h3>
                <div class="profile-row">
                    <div class="profile-label">Consent Given:</div>
                    <div class="profile-value">${this.formData.consent ? 'Yes' : 'No'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Signature:</div>
                    <div class="profile-value">${this.formData.signature ? 'Provided' : 'Not provided'}</div>
                </div>
            </div>
        `;
        
        profileContent.innerHTML = html;
    }

    // Cloudinary Upload Function
    async uploadToCloudinary(file, folder = 'muthegi-group') {
        // Cloudinary configuration
        const cloudName = 'dpymwa41m';
        const apiKey = '126267173967732';
        
        // For direct uploads, you need an upload preset
        // Create one in Cloudinary Dashboard: Settings > Upload > Upload presets
        const uploadPreset = 'muthegi_preset'; // Change this to your actual upload preset
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        formData.append('folder', folder);
        formData.append('api_key', apiKey);
        
        try {
            this.showNotification(`Uploading ${folder}...`, 'info');
            
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                {
                    method: 'POST',
                    body: formData
                }
            );
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Upload failed with status: ${response.status}`);
            }
            
            const data = await response.json();
            
            return {
                success: true,
                url: data.secure_url,
                publicId: data.public_id,
                data: data
            };
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Firebase Save Function
    async saveToFirebase(data) {
        if (!this.firebaseInitialized || !this.db) {
            throw new Error('Firebase not initialized');
        }
        
        try {
            const { collection, addDoc } = window.firebaseModules;
            
            // Prepare data for Firebase (remove blobs, keep URLs)
            const firebaseData = {
                personal: data.personal,
                nextOfKin: data.nextOfKin,
                location: data.location,
                farmerJourney: data.farmerJourney,
                livestock: data.livestock.map(animal => ({
                    type: animal.type,
                    produce: animal.produce,
                    count: animal.count,
                    info: animal.info,
                    photoCount: animal.photos ? animal.photos.length : 0
                })),
                consent: data.consent,
                submissionDate: data.submissionDate,
                status: data.status,
                group: data.group,
                project: data.project,
                profilePhotoUrl: data.profilePhoto,
                signatureUrl: data.signature,
                livestockPhotoUrls: data.livestockPhotos,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Save to Firestore
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
            
            // Keep track of saved forms
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

    // Form Submission
    async submitForm() {
        this.showNotification('Starting submission process...', 'warning');
        
        try {
            // Validate all steps
            for (let i = 1; i <= this.totalSteps; i++) {
                this.currentStep = i;
                if (!this.validateCurrentStep()) {
                    this.showNotification('Please complete all required fields', 'error');
                    this.updateStepIndicator();
                    return;
                }
            }
            
            // Save all data
            this.saveCurrentStepData();
            
            // Disable submit button
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
            
            // Upload profile photo if exists
            let profilePhotoUrl = null;
            if (this.profilePhotoData) {
                this.showNotification('Uploading profile photo...', 'info');
                const uploadResult = await this.uploadToCloudinary(this.profilePhotoData, 'muthegi-group/profiles');
                if (uploadResult.success) {
                    profilePhotoUrl = uploadResult.url;
                    this.showNotification('Profile photo uploaded successfully!', 'success');
                } else {
                    this.showNotification('Failed to upload profile photo: ' + uploadResult.error, 'error');
                }
            }
            
            // Upload livestock photos
            const livestockPhotoUrls = [];
            for (let i = 0; i < this.livestockPhotos.length; i++) {
                const photos = this.livestockPhotos[i];
                if (photos && photos.length > 0) {
                    for (let j = 0; j < photos.length; j++) {
                        this.showNotification(`Uploading livestock photo ${j + 1} of ${photos.length}...`, 'info');
                        const uploadResult = await this.uploadToCloudinary(photos[j], 'muthegi-group/livestock');
                        if (uploadResult.success) {
                            livestockPhotoUrls.push({
                                livestockIndex: i,
                                url: uploadResult.url
                            });
                            this.showNotification(`Livestock photo ${j + 1} uploaded`, 'success');
                        } else {
                            this.showNotification(`Failed to upload livestock photo ${j + 1}: ${uploadResult.error}`, 'error');
                        }
                    }
                }
            }
            
            // Upload signature if exists
            let signatureUrl = null;
            if (this.signatureData) {
                this.showNotification('Uploading signature...', 'info');
                const uploadResult = await this.uploadToCloudinary(this.signatureData, 'muthegi-group/signatures');
                if (uploadResult.success) {
                    signatureUrl = uploadResult.url;
                    this.showNotification('Signature uploaded successfully!', 'success');
                }
            }
            
            // Prepare final data
            const memberData = {
                ...this.formData,
                profilePhoto: profilePhotoUrl,
                livestockPhotos: livestockPhotoUrls,
                signature: signatureUrl,
                submissionDate: new Date().toISOString(),
                status: 'submitted',
                group: 'Muthegi Group',
                project: 'Project Ceres'
            };
            
            // Save to Firebase
            let firebaseResult = null;
            if (this.firebaseInitialized) {
                try {
                    this.showNotification('Saving data to database...', 'info');
                    firebaseResult = await this.saveToFirebase(memberData);
                    this.showNotification('Data saved to database successfully!', 'success');
                } catch (firebaseError) {
                    this.showNotification(`Firebase save failed: ${firebaseError.message}. Saving locally as backup.`, 'error');
                    firebaseResult = { success: false, error: firebaseError.message };
                }
            }
            
            // Save locally as backup
            const localResult = this.saveToLocalStorage(memberData);
            if (localResult.success) {
                this.showNotification('Data backed up locally', 'info');
            }
            
            // Show final success message
            if (firebaseResult && firebaseResult.success) {
                this.showNotification('Form submitted successfully! Data saved to cloud database.', 'success');
            } else {
                this.showNotification('Form submitted! Data saved locally. Please check internet connection for cloud sync.', 'warning');
            }
            
            // Reset form after 3 seconds
            setTimeout(() => {
                this.resetForm();
                this.showNotification('Form reset for next entry', 'info');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Data';
            }, 3000);
            
        } catch (error) {
            console.error('Submission error:', error);
            this.showNotification(`Submission failed: ${error.message}`, 'error');
            
            // Re-enable submit button
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Data';
        }
    }

    resetForm() {
        // Reset form data
        this.formData = {
            personal: {},
            nextOfKin: [],
            profilePhoto: null,
            location: {},
            farmerJourney: {},
            livestock: [],
            signature: null,
            consent: false
        };
        
        this.profilePhotoData = null;
        this.livestockPhotos = [];
        this.signatureData = null;
        this.signaturePoints = [];
        
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
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.getElementById('signaturePlaceholder').style.display = 'flex';
        
        // Reset next of kin and livestock containers to single entry
        document.getElementById('nextOfKinContainer').innerHTML = `
            <div class="next-of-kin-entry">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Next of Kin Name *</label>
                        <input type="text" class="nok-name" name="nok-name[]" required placeholder="Full name">
                    </div>
                    <div class="form-group">
                        <label>Relationship *</label>
                        <input type="text" class="nok-relationship" name="nok-relationship[]" required placeholder="e.g., Spouse, Parent">
                    </div>
                    <div class="form-group">
                        <label>Next of Kin Contact *</label>
                        <input type="tel" class="nok-contact" name="nok-contact[]" required placeholder="Phone number">
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
    }

    // Notification System
    showNotification(message, type = 'info') {
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
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
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
