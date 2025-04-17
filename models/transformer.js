// what kind of stimuli you wish to send to the front-end? 
// If just coordinate, use 'raw'; otherwise, you need to find out yourself.

// keep the original stimuli: use for local test
const axios = require('axios');
const fs = require('fs');

async function raw(array) {
    return array;
}

// turn the stimuli into an image
function to_image(array) {
    const url = process.env.imageurl+'/generate';
    return axios.post(url, {
        vector: array,
    }, {headers: {
        'accept': 'application/json', 
        'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
    })
    .then(response => {
        const base64 = Buffer.from(response.data).toString('base64');
        return `data:image/png;base64,${base64}`;
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function to_image_gsp(obj) {
    const url = process.env.imageurl+'/generate_batch';
    return axios.post(url, {
        vector: obj,
    }, {headers: {
        'accept': 'application/json', 
        'Content-Type': 'application/json',
        },
        responseType: 'json',
    })
    .then(response => {
        return response.data.images.map(img => `data:image/png;base64,${img}`);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function grab_image(path) {
    // get image data from the path
    const imageData = fs.readFileSync(path);
    const base64 = Buffer.from(imageData).toString('base64');
    return `data:image/png;base64,${base64}`;
}

module.exports = {raw, to_image, to_image_gsp, grab_image};