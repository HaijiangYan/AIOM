# Production Task Example

This example demonstrates how to build a facial expression production experiment using AIOM's BaseController. The Production task asks participants to produce specific facial expressions and capture them using their webcam, making it ideal for studying emotion expression, cross-cultural expression differences, and building facial expression datasets.

## Overview

The Production task is designed to collect authentic facial expression data from participants in a controlled experimental setting. It features:
- **Webcam-based image capture** for real-time expression recording
- **Multi-emotion production prompts** across basic emotion categories
- **Consent management** for publication and research use
- **Automatic image compression** to optimize storage and bandwidth
- **Secure image storage** in database with participant linking
- **Example-guided production** to help participants understand the task

## Table of Contents

- [Experiment Design](#experiment-design)
- [Controller Implementation](#controller-implementation)
- [Key Features](#key-features)
- [Configuration Parameters](#configuration-parameters)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Setup Requirements](#setup-requirements)
- [Understanding the Method](#understanding-the-method)
- [Best Practices](#best-practices)

---

## Experiment Design

### Production Task Structure

The experiment follows this flow:
1. **Consent collection** for image use in research/publications
2. **Example demonstration** showing target expressions
3. **Expression production** guided prompts for each emotion
4. **Webcam capture** of participant's facial expressions
5. **Image processing** and storage with compression

### Emotion Categories

```javascript
this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
```

Participants produce expressions for all seven basic emotions plus neutral expressions.

### Production Modes

```javascript
this.production_mode = 'webcam';  // Real-time webcam capture
```

Currently supports webcam mode with potential for expansion to other capture methods.

---

## Controller Implementation

### Basic Setup

```javascript
const { BaseController } = require('aiom');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        
        // Core configuration
        this.task = task;
        this.stimuli_path = path.join(this.expPath, 'stimuli');
        this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
        this.production_mode = 'webcam';
        
        this._initialize();
    }
}
```

### Database Initialization

Sets up consent tracking and image storage:

```javascript
async _initialize() {
    try {
        // Add consent tracking to participants table
        await this._DB_add_column('participants', 'face_authorization', 'BOOLEAN DEFAULT TRUE');
        
        // Create dedicated table for image storage
        await this._DB_create_table('production', [
            { name: 'id', type: 'SERIAL PRIMARY KEY' },
            { name: 'participant_id', type: 'TEXT NOT NULL' },
            { name: 'image_name', type: 'TEXT NOT NULL' },
            { name: 'image_data', type: 'BYTEA NOT NULL' },      // Binary image data
            { name: 'upload_date', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
        ]);
        
        console.log(`✅ ${this.task} initialized successfully.`);
    } catch (error) {
        console.error(`Error setting up ${this.task} database:`, error);
    }
}
```

**What this creates:**
- **Consent tracking**: Records whether participants allow image use in publications
- **Image storage**: Secure database storage for all captured images
- **Metadata tracking**: Links images to participants with timestamps

---

## Key Features

### 1. Example-Guided Expression Production

Provides visual examples to guide participants:

```javascript
async set_up(req, res, next) {
    const name = req.body.names;
    
    try {
        // Load example image to show participants what's expected
        const customImgDir = path.join(this.expPath, 'stimuli', 'production_example');
        const exampleImg = fs.readdirSync(customImgDir);
        const exampleImgPath = path.join(customImgDir, exampleImg[0]);
        
        // Convert example image to base64 for web display
        const imageBuffer = fs.readFileSync(exampleImgPath);
        const imageBase64 = imageBuffer.toString('base64');
        const imageMimeType = path.extname(exampleImg[0]).toLowerCase() === '.png' ? 
            'image/png' : 'image/jpeg';
        
        res.status(200).json({
            "classes": this.classes,
            "production_mode": this.production_mode,
            "example_image": `data:${imageMimeType};base64,${imageBase64}`
        });
    } catch (error) {
        next(error);
    }
}
```

**Example directory structure:**
```
stimuli/
└── production_example/
    ├── happy_example.jpg
    ├── sad_example.jpg
    ├── surprise_example.jpg
    └── ...
```

### 2. Consent Management

Handles publication consent and privacy preferences:

```javascript
async upload(req, res, next) {
    try {
        // Check participant's consent for publication use
        const consentPublications = req.header('Consent-Publications');
        const pid = req.header('pid');
        
        // Record consent status
        if (consentPublications === 'false') {
            await this._DB_update_row('participants', 
                { face_authorization: false }, 
                { participant: pid }
            );
        }
        
        // Continue with file processing...
    } catch (error) {
        next(error);
    }
}
```

**Consent levels:**
- `face_authorization: true` - Images may be used in publications
- `face_authorization: false` - Images for research use only

### 3. Automatic Image Compression

Optimizes images for storage while maintaining quality:

```javascript
const MAX_SIZE_MB = 1;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Process each uploaded file
for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];
    let imageData = file.data;
    
    // Compress if file is too large
    if (imageData.length > MAX_SIZE_BYTES) {
        let quality = 90;  // Start with 90% quality
        
        while (quality >= 40 && imageData.length > MAX_SIZE_BYTES) {
            try {
                imageData = await sharp(file.data)
                    .jpeg({ quality })
                    .toBuffer();
                quality -= 10;  // Reduce quality in steps
            } catch (err) {
                console.error(`Error compressing ${file.name}:`, err);
                imageData = file.data;  // Use original if compression fails
                break;
            }
        }
    }
}
```

**Compression strategy:**
1. Check if image exceeds 1MB limit
2. If too large, compress using JPEG with decreasing quality (90% → 80% → 70% → ...)
3. Stop when size is acceptable or quality reaches 40%
4. Store compressed version or original if compression fails

### 4. Secure Database Storage

Stores images as binary data with full metadata:

```javascript
// Store processed image in database
await this._DB_add_row('production', {
    participant_id: pid,
    image_name: file.name.split('.')[0],  // Remove file extension
    image_data: imageData,                // Binary data
    // upload_date automatically set by database
});
```

**Security features:**
- Images stored in database, not file system
- No direct file access from web
- Participant-linked access control
- Automatic timestamps for audit trails

---

## Configuration Parameters

### Core Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `classes` | Array | `['happy', 'sad', ...]` | Emotions to be produced |
| `production_mode` | String | `'webcam'` | Image capture method |
| `MAX_SIZE_MB` | Number | `1` | Maximum image size before compression |

### File Handling

| Setting | Value | Purpose |
|---------|--------|---------|
| Supported formats | JPEG, PNG | Web-compatible image formats |
| Storage method | Database BYTEA | Secure binary storage |
| Compression | Progressive JPEG | Bandwidth optimization |

---

## API Endpoints

### `POST /api/production/set_up`
Initialize task and provide example images.

**Request:**
```javascript
{
    "names": "participant_001"
}
```

**Response:**
```javascript
{
    "classes": ["happy", "sad", "surprise", "angry", "neutral", "disgust", "fear"],
    "production_mode": "webcam",
    "example_image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
}
```

### `POST /api/production/upload`
Upload captured facial expression images.

**Headers:**
- `Consent-Publications`: "true" or "false"
- `pid`: Participant identifier

**Request:** (multipart/form-data)
- `files`: Array of image files

**Response:**
```javascript
{
    "progress": 100,
    "message": "Files uploaded successfully -- thank you!"
}
```

---

## Database Schema

### Extended Participants Table

Additional column for consent tracking:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `face_authorization` | BOOLEAN | `TRUE` | Permission to use images in publications |

### Production Images Table

Table name: `production`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Unique image identifier |
| `participant_id` | TEXT NOT NULL | Links to participant |
| `image_name` | TEXT NOT NULL | Original filename (without extension) |
| `image_data` | BYTEA NOT NULL | Compressed binary image data |
| `upload_date` | TIMESTAMP | Automatic upload timestamp |

**Example data:**
```sql
id | participant_id  | image_name | image_data | upload_date
1  | participant_001 | happy_1   | \x89504e47... | 2025-01-15 14:30:22
2  | participant_001 | sad_1     | \x89504e47... | 2025-01-15 14:30:25
3  | participant_001 | surprise_1| \x89504e47... | 2025-01-15 14:30:28
```

---

## Setup Requirements

### Directory Structure

```
your_study/
├── experiments/
│   └── production/
│       ├── controller.js              # This controller file
│       ├── stimuli/
│       │   └── production_example/    # Example images
│       │       ├── happy_example.jpg
│       │       ├── sad_example.jpg
│       │       ├── surprise_example.jpg
│       │       ├── angry_example.jpg
│       │       ├── neutral_example.jpg
│       │       ├── disgust_example.jpg
│       │       └── fear_example.jpg
│       ├── public/
│       │   ├── experiment.ejs         # Frontend template
│       │   └── static/
│       │       ├── experiment.js      # Webcam handling JavaScript
│       │       └── experiment.css     # Styling
│       └── custom_text/
│           └── instruction.html       # Task instructions
└── .env                              # Environment configuration
```

### Frontend Requirements

Your webpage must handle webcam access and image capture:

```javascript
// Initialize webcam
async function initWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 640, 
                height: 480 
            } 
        });
        
        const video = document.getElementById('webcam');
        video.srcObject = stream;
        video.play();
        
        return stream;
    } catch (error) {
        console.error('Error accessing webcam:', error);
        alert('Please allow webcam access to participate in this study.');
    }
}

// Capture image from webcam
function captureImage() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('capture-canvas');
    const context = canvas.getContext('2d');
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob for upload
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            resolve(blob);
        }, 'image/jpeg', 0.8);
    });
}

// Upload images
async function uploadImages(images, consentForPublications) {
    const formData = new FormData();
    
    // Add all captured images
    images.forEach((imageBlob, index) => {
        formData.append('files', imageBlob, `expression_${index}.jpg`);
    });
    
    const response = await fetch('/api/production/upload', {
        method: 'POST',
        headers: {
            'Consent-Publications': consentForPublications.toString(),
            'pid': participantId
        },
        body: formData
    });
    
    return response.json();
}
```

### HTML Structure

```html
<!-- Webcam display -->
<video id="webcam" width="640" height="480" autoplay muted></video>

<!-- Hidden canvas for image capture -->
<canvas id="capture-canvas" style="display: none;"></canvas>

<!-- Example image display -->
<div id="example-container">
    <h3>Example:</h3>
    <img id="example-image" alt="Expression example" />
</div>

<!-- Expression prompt -->
<div id="prompt-container">
    <h2 id="current-prompt">Please make a HAPPY expression</h2>
    <button id="capture-btn" onclick="captureExpression()">Capture Expression</button>
</div>

<!-- Consent checkbox -->
<div id="consent-container">
    <input type="checkbox" id="publication-consent" />
    <label for="publication-consent">
        I consent to my images being used in scientific publications
    </label>
</div>
```

---

## Understanding the Method

### What is Expression Production?

Expression production tasks collect authentic emotional expressions by:

1. **Prompting specific emotions**: Clear instructions for target expressions
2. **Providing examples**: Visual guides to help participants understand targets
3. **Capturing natural expressions**: Real-time webcam recording
4. **Building datasets**: Creating databases for emotion recognition research

### Applications

- **Cross-cultural emotion studies**: Comparing expression patterns across cultures
- **Individual differences research**: Understanding personal expression styles  
- **AI training data**: Building datasets for emotion recognition algorithms
- **Clinical research**: Studying expression production in different populations
- **Validation studies**: Creating ground-truth data for emotion recognition

### Research Considerations

```javascript
// Factors to consider in expression production studies:

const considerations = {
    cultural_factors: "Expression norms vary across cultures",
    individual_differences: "People vary in expressiveness",
    social_desirability: "Participants may moderate expressions",
    fatigue_effects: "Expression quality may decrease over time",
    lighting_conditions: "Image quality affects analysis",
    privacy_concerns: "Participants may be self-conscious"
};
```

---

## Best Practices

### 1. Consent and Privacy Management

Implement comprehensive consent procedures:

```javascript
async upload(req, res, next) {
    try {
        const consentPublications = req.header('Consent-Publications');
        const consentResearch = req.header('Consent-Research');
        const pid = req.header('pid');
        
        // Detailed consent tracking
        await this._DB_update_row('participants', {
            face_authorization: consentPublications === 'true',
            research_consent: consentResearch === 'true',
            consent_timestamp: new Date().toISOString()
        }, { participant: pid });
        
        // Only process if basic research consent given
        if (consentResearch !== 'true') {
            return res.status(400).json({
                error: "Research consent required for participation"
            });
        }
        
        // Continue with file processing...
    } catch (error) {
        next(error);
    }
}
```

### 2. Image Quality Control

Implement quality checks for captured images:

```javascript
async upload(req, res, next) {
    try {
        const files = req.files.files;
        const filesArray = Array.isArray(files) ? files : [files];
        
        for (let i = 0; i < filesArray.length; i++) {
            const file = filesArray[i];
            
            // Quality checks
            if (file.size < 1000) {  // Too small, likely empty
                console.warn(`Image ${file.name} is too small (${file.size} bytes)`);
                continue;
            }
            
            if (file.size > 10 * 1024 * 1024) {  // Too large
                console.warn(`Image ${file.name} is too large (${file.size} bytes)`);
                continue;
            }
            
            // Check if valid image format
            if (!file.mimetype.startsWith('image/')) {
                console.warn(`File ${file.name} is not an image`);
                continue;
            }
            
            // Process image...
            await this._processAndStoreImage(file, pid);
        }
    } catch (error) {
        next(error);
    }
}
```

### 3. Progressive Image Compression

Optimize compression for different use cases:

```javascript
async _compressImage(imageData, targetSize = 1024 * 1024, minQuality = 40) {
    let compressed = imageData;
    let quality = 95;
    
    while (compressed.length > targetSize && quality >= minQuality) {
        try {
            compressed = await sharp(imageData)
                .jpeg({ 
                    quality,
                    progressive: true,
                    mozjpeg: true  // Better compression
                })
                .toBuffer();
            
            quality -= 5;
        } catch (error) {
            console.error('Compression error:', error);
            break;
        }
    }
    
    console.log(`Compressed from ${imageData.length} to ${compressed.length} bytes (quality: ${quality + 5}%)`);
    return compressed;
}
```

### 4. Participant Guidance

Provide clear instructions and feedback:

```javascript
async set_up(req, res, next) {
    const name = req.body.names;
    
    try {
        // Load multiple examples for each emotion
        const exampleImages = {};
        
        for (const emotion of this.classes) {
            const examplePath = path.join(this.expPath, 'stimuli', 'production_example', `${emotion}_example.jpg`);
            if (fs.existsSync(examplePath)) {
                const imageBuffer = fs.readFileSync(examplePath);
                exampleImages[emotion] = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
            }
        }
        
        res.status(200).json({
            "classes": this.classes,
            "production_mode": this.production_mode,
            "example_images": exampleImages,
            "instructions": {
                "webcam_positioning": "Position your face clearly in the frame",
                "lighting": "Ensure good lighting on your face",
                "expression_timing": "Hold the expression for 2-3 seconds before capturing",
                "multiple_attempts": "You can retake any expression if needed"
            }
        });
    } catch (error) {
        next(error);
    }
}
```

### 5. Data Export for Analysis

Add methods to export images for analysis:

```javascript
async export_images(req, res, next) {
    const participantId = req.query.participant_id;
    
    try {
        const images = await this._DB_get_row('production', { participant_id: participantId });
        
        // Create export package
        const exportData = {
            participant_id: participantId,
            consent_status: await this._getConsentStatus(participantId),
            images: images.rows.map(row => ({
                id: row.id,
                name: row.image_name,
                upload_date: row.upload_date,
                // Note: Actual image data not included for security
                // Use separate secure endpoint for image retrieval
            }))
        };
        
        res.status(200).json(exportData);
    } catch (error) {
        next(error);
    }
}

// Secure image retrieval endpoint
async get_image(req, res, next) {
    const imageId = req.params.id;
    const requestingUser = req.header('Authorization'); // Implement auth
    
    try {
        // Verify authorization to access this image
        if (!this._authorizeImageAccess(requestingUser, imageId)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const result = await this._DB_get_row('production', { id: imageId });
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }
        
        const imageData = result.rows[0].image_data;
        res.set('Content-Type', 'image/jpeg');
        res.send(imageData);
    } catch (error) {
        next(error);
    }
}
```

### 6. Batch Processing Support

Handle multiple expression sessions:

```javascript
constructor(experimentPath, task) {
    super(experimentPath, task);
    
    // Support for multiple recording sessions
    this.sessions = [
        { name: 'baseline', emotions: ['neutral', 'happy', 'sad'] },
        { name: 'intense', emotions: ['angry', 'disgust', 'fear'] },
        { name: 'subtle', emotions: ['surprise', 'contempt', 'embarrassment'] }
    ];
    
    this._initialize();
}

async upload(req, res, next) {
    try {
        const sessionName = req.header('Session-Name') || 'default';
        const files = req.files.files;
        
        // Process files with session information
        for (const file of filesArray) {
            await this._DB_add_row('production', {
                participant_id: pid,
                session_name: sessionName,
                image_name: file.name.split('.')[0],
                image_data: compressedImageData
            });
        }
    } catch (error) {
        next(error);
    }
}
```

---

This example demonstrates how AIOM's BaseController can be extended to create robust facial expression production experiments. The implementation handles webcam capture, consent management, image compression, and secure storage while providing a user-friendly interface for participants to produce authentic emotional expressions.