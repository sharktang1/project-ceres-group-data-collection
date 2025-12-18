// Cloudinary configuration
const cloudinaryConfig = {
    cloudName: 'dpymwa41m',
    apiKey: '126267173967732',
    apiSecret: 'i9KAdp3r40enPfj_PBLIO-W1ZUQ'
};

// Generate SHA1 signature
const generateSignature = async (params) => {
    const { apiSecret } = cloudinaryConfig;
    
    const stringToSign = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');

    const fullString = stringToSign + apiSecret;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(fullString);
    
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return signature;
};

// Main upload function
export const uploadToCloudinary = async (file, folder = 'muthegi-group') => {
    try {
        const { cloudName, apiKey } = cloudinaryConfig;
        
        const timestamp = Math.round(Date.now() / 1000);
        const params = {
            timestamp: timestamp,
            folder: folder
        };

        const signature = await generateSignature(params);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);
        formData.append('folder', folder);

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
};

// File validation
export const validateFile = (file) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/gif', 
        'image/webp'
    ];

    if (!file) {
        return { valid: false, error: 'No file selected' };
    }

    if (!allowedTypes.includes(file.type)) {
        return { 
            valid: false, 
            error: 'Please upload a valid image file (JPEG, PNG, GIF, WebP)' 
        };
    }

    if (file.size > maxSize) {
        return { 
            valid: false, 
            error: 'Image size must be less than 10MB' 
        };
    }

    return { valid: true, error: null };
};
