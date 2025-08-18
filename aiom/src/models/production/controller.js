const { BaseController } = require('aiom');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class Controller extends BaseController {
    constructor(experimentPath, task) {
        super(experimentPath, task);
        this.stimuli_path = path.join(this.expPath, 'stimuli');
        // Add your custom initialization here
        this.task = task;
        this.classes = ['happy', 'sad', 'surprise', 'angry', 'neutral', 'disgust', 'fear'];
        this.production_mode = 'webcam';
        // initialize
        this._initialize();
    }

    // make sure that all internal functions (not exposed via API) are starting with a '_'
    async _initialize() {
        // Initialize any necessary resources or configurations here
        await this._DB_add_column('participants', 'face_authorization', 'BOOLEAN DEFAULT TRUE');
        // Create images table if it doesn't exist
        await this._DB_create_table('production', [
            { name: 'id', type: 'SERIAL PRIMARY KEY' },
            { name: 'participant_id', type: 'TEXT NOT NULL' },
            { name: 'image_name', type: 'TEXT NOT NULL' },
            { name: 'image_data', type: 'BYTEA NOT NULL' },
            { name: 'upload_date', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
        ]);
        // console.log(`✅ ${this.task} initialized successfully.`);
    }

    async set_up(req, res, next) {
        // 'api/task/set_up'
        // handle request from the front-end and send stimuli to client
        const name = req.body.names;
        try {
            // Get example image
            const customImgDir = path.join(this.expPath, 'stimuli', 'production_example');
            const exampleImg = fs.readdirSync(customImgDir);
            const exampleImgPath = path.join(customImgDir, exampleImg[0]);
            
            // Read the example image as base64
            const imageBuffer = fs.readFileSync(exampleImgPath);
            const imageBase64 = imageBuffer.toString('base64');
            const imageMimeType = path.extname(exampleImg[0]).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
            
            res.status(200).json({
                "classes": this.classes, 
                "production_mode": this.production_mode,
                "example_image": `data:${imageMimeType};base64,${imageBase64}`
            });
        } catch (error) {
            next(error);
        }
    }

    async upload(req, res, next) {
        // '/api/task/upload'
        try {
            const consentPublications = req.header('Consent-Publications');
            const pid = req.header('pid');
            if (consentPublications === 'false') {
                await this._DB_update_row('participants', { face_authorization: false }, { participant: pid });
            }
            
            const files = req.files.files;
            const filesArray = Array.isArray(files) ? files : [files];
            const MAX_SIZE_MB = 1; // Define max size in MB
            const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
            
            for (let i = 0; i < filesArray.length; i++) {
                const file = filesArray[i];
                let imageData = file.data;
                
                if (imageData.length > MAX_SIZE_BYTES) {
                let quality = 90;
                while (quality >= 40 && imageData.length > MAX_SIZE_BYTES) {
                    try {
                    imageData = await sharp(file.data)
                        .jpeg({ quality })
                        .toBuffer();
                    quality -= 10;
                    } catch (err) {
                    console.error(`Error compressing ${file.name}:`, err);
                    imageData = file.data; 
                    break;
                    }
                }
                }
                // Insert image into database
                await this._DB_add_row('production', {
                    participant_id: pid,
                    image_name: file.name.split('.')[0],
                    image_data: imageData
                });
            }
            console.log(`Files uploaded successfully for participant ${pid}`);

            res.status(200).json({
                progress: 100,
                message: "Files uploaded successfully -- thank you!",
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = { Controller };