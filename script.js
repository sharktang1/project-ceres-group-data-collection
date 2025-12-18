class ProjectCeresForm {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 6;
        this.formData = {
            personal: {},
            nextOfKin: [],
            profilePhoto: null,
            location: {},
            farmerJourney: {},
            livestock: []
        };
        
        this.init();
    }

    init() {
        // Hide loading overlay after page loads
        setTimeout(() => {
            document.getElementById('loadingOverlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loadingOverlay').style.display = 'none';
                document.getElementById('mainContainer').style.display = 'block';
            }, 300);
        }, 1500);

        // Initialize form
        this.initializeForm();
        this.initializeCamera();
        this.initializeLocation();
        this.updateStepIndicator();
        
        // Set up form submission
        document.getElementById('memberForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitForm();
        });
    }

    initializeForm() {
        // Set max date for DOB (must be at least 18 years old)
        const today = new Date();
        const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        document.getElementById('dob').max = maxDate.toISOString().split('T')[0];
        
        // Set min date for DOB (approx 100 years ago)
        const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
        document.getElementById('dob').min = minDate.toISOString().split('T')[0];
        
        // Phone number formatting
        document.getElementById('phone').addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.startsWith('254')) {
                value = '+' + value;
            } else if (value.startsWith('0')) {
                value = '+254' + value.substring(1);
            }
            e.target.value = this.formatPhoneNumber(value);
        });
    }

    formatPhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{3,})$/);
        if (match) {
            return `+${match[1]} ${match[2]} ${match[3]}`;
        }
        return phone;
    }

    updateStepIndicator() {
        document.getElementById('currentStep').textContent = this.currentStep;
        document.getElementById('totalSteps').textContent = this.totalSteps;
        
        const progress = ((this.currentStep - 1) / (this.totalSteps - 1)) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;
        
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
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            this.saveCurrentStepData();
            if (this.currentStep < this.totalSteps) {
                this.currentStep++;
                this.updateStepIndicator();
                window.scrollTo(0, 0);
            }
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepIndicator();
            window.scrollTo(0, 0);
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
                this.showNotification('Please fill in all required fields marked with *', 'error');
                isValid = false;
            } else {
                input.style.borderColor = '';
            }
        });
        
        // Additional validation for email
        if (this.currentStep === 1) {
            const email = document.getElementById('email');
            if (email.value && !this.isValidEmail(email.value)) {
                email.style.borderColor = 'var(--danger)';
                this.showNotification('Please enter a valid email address', 'error');
                isValid = false;
            }
        }
        
        // Additional validation for phone
        if (this.currentStep === 1) {
            const phone = document.getElementById('phone');
            if (phone.value && !this.isValidPhone(phone.value)) {
                phone.style.borderColor = 'var(--danger)';
                this.showNotification('Please enter a valid phone number (+254 XXX XXX XXX)', 'error');
                isValid = false;
            }
        }
        
        return isValid;
    }

    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    isValidPhone(phone) {
        const re = /^\+254[0-9]{9}$/;
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
                        contact: entry.querySelector('.nok-contact').value
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
                document.querySelectorAll('.livestock-entry').forEach(entry => {
                    const livestock = {
                        type: entry.querySelector('.livestock-type').value,
                        produce: entry.querySelector('.livestock-produce').value,
                        count: entry.querySelector('.livestock-count').value,
                        info: entry.querySelector('.livestock-info').value,
                        photos: entry.querySelector('.livestock-photo').files
                    };
                    if (livestock.type || livestock.count) {
                        this.formData.livestock.push(livestock);
                    }
                });
                break;
        }
    }

    // Camera Functionality
    initializeCamera() {
        this.cameraStream = null;
        this.currentCamera = null;
        this.cameras = [];
        this.profilePhotoData = null;

        const video = document.getElementById('cameraView');
        const cameraSelect = document.getElementById('cameraSelect');
        const captureBtn = document.getElementById('capturePhoto');
        const switchBtn = document.getElementById('switchCamera');
        const retakeBtn = document.getElementById('retakePhoto');
        const preview = document.getElementById('profilePreview');

        // Get available cameras
        this.getCameras();

        // Capture photo
        captureBtn.addEventListener('click', () => this.capturePhoto());

        // Switch camera
        switchBtn.addEventListener('click', () => this.switchCamera());

        // Retake photo
        retakeBtn.addEventListener('click', () => {
            this.profilePhotoData = null;
            preview.style.display = 'flex';
            video.style.display = 'block';
            captureBtn.disabled = false;
            switchBtn.disabled = false;
            retakeBtn.style.display = 'none';
        });

        // Camera selection change
        cameraSelect.addEventListener('change', (e) => {
            this.currentCamera = e.target.value;
            this.startCamera();
        });

        // Start default camera
        this.startCamera();
    }

    async getCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.cameras = devices.filter(device => device.kind === 'videoinput');
            
            const cameraSelect = document.getElementById('cameraSelect');
            cameraSelect.innerHTML = '<option value="">Select camera...</option>';
            
            this.cameras.forEach((camera, index) => {
                const option = document.createElement('option');
                option.value = camera.deviceId;
                option.text = camera.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
            
            if (this.cameras.length > 0) {
                this.currentCamera = this.cameras[0].deviceId;
                cameraSelect.value = this.currentCamera;
            }
        } catch (error) {
            console.error('Error getting cameras:', error);
            this.showNotification('Unable to access camera. Please check permissions.', 'error');
        }
    }

    async startCamera() {
        const video = document.getElementById('cameraView');
        
        // Stop existing stream
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
        }
        
        try {
            const constraints = {
                video: {
                    deviceId: this.currentCamera ? { exact: this.currentCamera } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: this.cameras.length === 1 ? 'environment' : undefined
                }
            };
            
            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = this.cameraStream;
            video.style.display = 'block';
        } catch (error) {
            console.error('Error starting camera:', error);
            this.showNotification('Camera access denied. Please allow camera permissions.', 'error');
        }
    }

    async switchCamera() {
        if (this.cameras.length < 2) return;
        
        const currentIndex = this.cameras.findIndex(cam => cam.deviceId === this.currentCamera);
        const nextIndex = (currentIndex + 1) % this.cameras.length;
        this.currentCamera = this.cameras[nextIndex].deviceId;
        
        document.getElementById('cameraSelect').value = this.currentCamera;
        await this.startCamera();
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
            
            this.showNotification('Profile photo captured successfully!', 'success');
        }, 'image/jpeg', 0.9);
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
        
        this.showNotification('Getting your location...', 'warning');
        
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
                        message = 'Location permission denied. Please enable location services.';
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
                timeout: 10000,
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
                if (address.county) {
                    document.getElementById('county').value = address.county;
                }
                if (address.state) {
                    // State might be used for county if county not available
                    if (!address.county) {
                        document.getElementById('county').value = address.state;
                    }
                }
                if (address.village) {
                    document.getElementById('village').value = address.village;
                } else if (address.town) {
                    document.getElementById('village').value = address.town;
                }
                
                // Format physical address
                const physicalAddress = [];
                if (address.road) physicalAddress.push(address.road);
                if (address.village) physicalAddress.push(address.village);
                if (address.county) physicalAddress.push(address.county);
                if (address.country) physicalAddress.push(address.country);
                
                if (physicalAddress.length > 0) {
                    document.getElementById('physicalAddress').value = physicalAddress.join(', ');
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
                    <label>Next of Kin Name</label>
                    <input type="text" class="nok-name" placeholder="Full name">
                </div>
                <div class="form-group">
                    <label>Relationship</label>
                    <input type="text" class="nok-relationship" placeholder="e.g., Spouse, Parent">
                </div>
                <div class="form-group">
                    <label>Next of Kin Contact</label>
                    <input type="tel" class="nok-contact" placeholder="Phone number">
                </div>
            </div>
            <button type="button" class="btn-remove-nok" onclick="projectCeresForm.removeNextOfKin(this)">
                Remove
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
                    <label>Type of Livestock</label>
                    <select class="livestock-type">
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
                    <select class="livestock-produce">
                        <option value="">Select produce...</option>
                        <option value="Milk">Milk</option>
                        <option value="Eggs">Eggs</option>
                        <option value="Meat">Meat</option>
                        <option value="Wool">Wool</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Number of Animals</label>
                    <input type="number" class="livestock-count" min="0" placeholder="0">
                </div>
            </div>
            <div class="form-group">
                <label>Additional Info (Age, Height, etc.)</label>
                <textarea class="livestock-info" placeholder="Optional information about the animals..." rows="2"></textarea>
            </div>
            <div class="form-group">
                <label>Animal Photo (Optional)</label>
                <input type="file" class="livestock-photo" accept="image/*" multiple>
                <small class="help-text">You can upload a single photo representing the group of animals</small>
            </div>
            <button type="button" class="btn-remove-livestock" onclick="projectCeresForm.removeLivestockEntry(this)">
                Remove This Entry
            </button>
        `;
        
        container.appendChild(newEntry);
        this.showNotification('Livestock entry added', 'success');
    }

    removeLivestockEntry(button) {
        const container = document.getElementById('livestockContainer');
        if (container.children.length > 1) {
            button.closest('.livestock-entry').remove();
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
                html += `
                    <div class="profile-row">
                        <div class="profile-label">Next of Kin ${index + 1}:</div>
                        <div class="profile-value">
                            ${nok.name || ''} (${nok.relationship || ''}) - ${nok.contact || ''}
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
                    <div class="profile-value">${this.formData.farmerJourney.description || 'Not provided'}</div>
                </div>
                <div class="profile-row">
                    <div class="profile-label">Future Goals:</div>
                    <div class="profile-value">${this.formData.farmerJourney.futureGoals || 'Not provided'}</div>
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
                            ${animal.count || 0} ${animal.type || 'animals'} - Produce: ${animal.produce || 'Not specified'}
                            ${animal.info ? `<br><small>${animal.info}</small>` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        profileContent.innerHTML = html;
    }

    // Form Submission
    async submitForm() {
        this.showNotification('Submitting data...', 'warning');
        
        try {
            // Validate all steps
            for (let i = 1; i <= this.totalSteps; i++) {
                this.currentStep = i;
                if (!this.validateCurrentStep()) {
                    this.showNotification('Please complete all required fields', 'error');
                    return;
                }
            }
            
            // Save all data
            this.saveCurrentStepData();
            
            // Upload profile photo if exists
            let profilePhotoUrl = null;
            if (this.profilePhotoData) {
                this.showNotification('Uploading profile photo...', 'warning');
                const uploadResult = await uploadToCloudinary(this.profilePhotoData, 'muthegi-group/profiles');
                if (uploadResult.success) {
                    profilePhotoUrl = uploadResult.url;
                    this.showNotification('Profile photo uploaded successfully!', 'success');
                } else {
                    this.showNotification('Failed to upload profile photo', 'error');
                }
            }
            
            // Upload livestock photos
            const livestockPhotos = [];
            for (const animal of this.formData.livestock) {
                if (animal.photos && animal.photos.length > 0) {
                    for (let i = 0; i < animal.photos.length; i++) {
                        const photo = animal.photos[i];
                        const uploadResult = await uploadToCloudinary(photo, 'muthegi-group/livestock');
                        if (uploadResult.success) {
                            livestockPhotos.push({
                                livestockIndex: this.formData.livestock.indexOf(animal),
                                url: uploadResult.url
                            });
                        }
                    }
                }
            }
            
            // Prepare final data for Firebase
            const memberData = {
                ...this.formData,
                profilePhoto: profilePhotoUrl,
                livestockPhotos: livestockPhotos,
                submissionDate: new Date().toISOString(),
                status: 'pending',
                group: 'Muthegi Group',
                project: 'Project Ceres'
            };
            
            // Save to Firebase
            this.showNotification('Saving data to database...', 'warning');
            const dbResult = await saveToFirebase(memberData, 'muthegi-group/members');
            
            if (dbResult.success) {
                this.showNotification('Data submitted successfully!', 'success');
                
                // Reset form after 3 seconds
                setTimeout(() => {
                    this.resetForm();
                    this.currentStep = 1;
                    this.updateStepIndicator();
                    this.showNotification('Form reset for next entry', 'info');
                }, 3000);
            } else {
                throw new Error(dbResult.error);
            }
            
        } catch (error) {
            console.error('Submission error:', error);
            this.showNotification(`Submission failed: ${error.message}`, 'error');
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
            livestock: []
        };
        
        this.profilePhotoData = null;
        
        // Reset form fields
        document.getElementById('memberForm').reset();
        
        // Reset camera preview
        const preview = document.getElementById('profilePreview');
        preview.innerHTML = '<i class="fas fa-user fa-5x"></i><p>No profile picture taken</p>';
        preview.style.display = 'flex';
        
        const video = document.getElementById('cameraView');
        video.style.display = 'block';
        
        document.getElementById('capturePhoto').disabled = false;
        document.getElementById('switchCamera').disabled = false;
        document.getElementById('retakePhoto').style.display = 'none';
        
        // Reset next of kin and livestock containers to single entry
        document.getElementById('nextOfKinContainer').innerHTML = `
            <div class="next-of-kin-entry">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Next of Kin Name</label>
                        <input type="text" class="nok-name" placeholder="Full name">
                    </div>
                    <div class="form-group">
                        <label>Relationship</label>
                        <input type="text" class="nok-relationship" placeholder="e.g., Spouse, Parent">
                    </div>
                    <div class="form-group">
                        <label>Next of Kin Contact</label>
                        <input type="tel" class="nok-contact" placeholder="Phone number">
                    </div>
                </div>
                <button type="button" class="btn-remove-nok" onclick="projectCeresForm.removeNextOfKin(this)">Remove</button>
            </div>
        `;
        
        document.getElementById('livestockContainer').innerHTML = `
            <div class="livestock-entry">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Type of Livestock</label>
                        <select class="livestock-type">
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
                        <select class="livestock-produce">
                            <option value="">Select produce...</option>
                            <option value="Milk">Milk</option>
                            <option value="Eggs">Eggs</option>
                            <option value="Meat">Meat</option>
                            <option value="Wool">Wool</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Number of Animals</label>
                        <input type="number" class="livestock-count" min="0" placeholder="0">
                    </div>
                </div>
                <div class="form-group">
                    <label>Additional Info (Age, Height, etc.)</label>
                    <textarea class="livestock-info" placeholder="Optional information about the animals..." rows="2"></textarea>
                </div>
                <div class="form-group">
                    <label>Animal Photo (Optional)</label>
                    <input type="file" class="livestock-photo" accept="image/*" multiple>
                    <small class="help-text">You can upload a single photo representing the group of animals</small>
                </div>
                <button type="button" class="btn-remove-livestock" onclick="projectCeresForm.removeLivestockEntry(this)">Remove This Entry</button>
            </div>
        `;
        
        // Restart camera
        this.startCamera();
    }

    // Notification System
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${type.toUpperCase()}:</strong> ${message}
            </div>
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
