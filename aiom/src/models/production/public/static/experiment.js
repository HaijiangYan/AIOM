var local_pid;
var local_categories;
var production_mode;
var example_image;
var selectedFiles = [];

// Webcam variables
let stream = null;
let facingMode = 'user'; // Start with front camera
let webcamActive = false;

const instruction_text = `/exp-static/${taskName}/instruction.html`;

function show_instruction() {
    return $.Deferred(function(deferred) {
        // Display the modal
        $('#instruction').load(`${instruction_text}`, function(response, status, xhr) {
            if (status == "error") {
                $("#instruction").html("Sorry, there was an error loading the instruction.");
            }
        });
        $("#instructions").css("display", "flex");

        // Wait for the user to click "Continue"
        $("#consentButton").on("click", function() {
            $("#instructions").css("display", "none"); // Hide the modal
            deferred.resolve();    // Continue the script
        });
    }).promise();
}

function set_up() {
    local_pid = Cookies.get('pid');
    axios.post(`/api/${taskName}/set_up`, {
        names: local_pid,
    }, {headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => {
        local_categories = response.data.classes;
        production_mode = response.data.production_mode;
        example_image = response.data.example_image;
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

// Initialize webcam
async function initializeWebcam() {
    try {
        if (stream) {
            stopWebcam();
        }
        
        const constraints = {
            video: {
                facingMode: facingMode,
                width: { ideal: 480 },
                height: { ideal: 480 }
            }
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        $('#webcam')[0].srcObject = stream;
        $('.webcam-container').css('display', 'flex');
        webcamActive = true;
        $('#status').html('Camera ready').css('color', 'green');
        $('#category_instruction').html(`Now please take a photo for <strong>${local_categories[selectedFiles.length]}!</strong>`);
    } catch (error) {
        console.error('Error accessing the webcam:', error);
        $('#status').html('Could not access camera. Please allow camera access or use file upload instead.')
                    .css('color', 'red');
    }
}

// Stop webcam
function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        $('#webcam')[0].srcObject = null;
        stream = null;
    }
    webcamActive = false;
    $('.webcam-container').css('display', 'none');
}

async function handleFiles() {
    const files = $('#file-input')[0].files;
    
    if (files.length > 0) {
        $('#preview').empty();
        
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            
            if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
                $('#status').html('Converting HEIC image...');
                
                try {
                    // Convert HEIC to JPEG
                    const jpegBlob = await heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.8
                    });
                    
                    // Create a new file from the converted blob
                    file = new File([jpegBlob], file.name.replace('.heic', '.jpg'), {
                        type: 'image/jpeg'
                    });
                    
                    $('#status').html('HEIC conversion complete');
                } catch (error) {
                    console.error('HEIC conversion error:', error);
                    $('#status').html('Failed to convert HEIC file. Please try another format.')
                                .css('color', 'red');
                    continue;
                }
            }
            
            // Validate file type
            if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
                $('#status').html('Please upload only JPG, JPEG or PNG files.')
                            .css('color', 'red');
                continue;
            }
            
            selectedFiles.push(file);
        }
        
        create_preview();
        
        if (selectedFiles.length > 0) {
            $('#status').html(`${selectedFiles.length} file(s) selected`).css('color', 'green');
            $('#upload-btn').show();
        }
    }
}

function create_preview() {
    $('#preview').empty();
    if (selectedFiles.length === local_categories.length) {
        $('#category_instruction').html(`All photos taken. You can now click "Confirm" to submit.`);
    } else {
        $('#category_instruction').html(`Now please take a photo for <strong>${local_categories[selectedFiles.length]}!</strong>`);
    }
    
    if (selectedFiles.length != local_categories.length) {
            $('#upload-btn').prop('disabled', true);
        } else {
            $('#upload-btn').prop('disabled', false);
        }
    
    $.each(selectedFiles, function(index, file) {
        // Create container for preview and delete button
        const $container = $('<div>').addClass('preview-container')
                                        .attr('data-index', index);
        
        // Create preview image
        const $img = $('<img>').addClass('preview-image');
        $container.append($img);
        
        // only Create delete button for the last image
        if (index === selectedFiles.length - 1) {
            const $deleteBtn = $('<div>').addClass('delete-btn')
                                        .html('×')
                                        .on('click', function() {
                                            removeImage(index);
                                        });
            $container.append($deleteBtn);
        } 
        
        $('#preview').append($container);
        
        // Load image preview
        const reader = new FileReader();
        reader.onload = function(e) {
            $img.attr('src', e.target.result);
        };
        reader.readAsDataURL(file);
    });
}

function removeImage(index) {
    // Remove the file from selectedFiles array
    selectedFiles.splice(index, 1);
    
    // Update the preview
    create_preview();
    
    // Update status
    if (selectedFiles.length > 0) {
        $('#status').html(`${selectedFiles.length} file(s) selected`)
                    .css('color', 'green');
        $('#upload-btn').show();
    } else {
        $('#status').html('No files selected');
        $('#upload-btn').hide();
    }
}

function endExperiment() {
    window.location.href = `/experiment/${taskName}`;
}

function load_onclick() {
    // Tab functionality
    $('.tab').on('click', function() {
        const tabId = $(this).data('tab');
        
        // Update active tab
        $('.tab').removeClass('active');
        $(this).addClass('active');
        
        // Show corresponding content
        $('.tab-content').removeClass('active');
        $(`#${tabId}-tab`).addClass('active');
        
        // Initialize or stop webcam as needed
        if (tabId === 'webcam') {
            initializeWebcam();
        } else if (webcamActive) {
            stopWebcam();
        }
    });

    // Switch between front and back cameras
    $('#switch-camera-btn').on('click', function() {
        facingMode = facingMode === 'user' ? 'environment' : 'user';
        initializeWebcam();
    });

    // Capture photo from webcam
    $('#capture-btn').on('click', function() {
        // Create a canvas element to draw the video frame
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const video = $('#webcam')[0];
        
        // Set canvas dimensions to match video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the current video frame on the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob(function(blob) {
            // Create a file from the blob
            const fileName = `webcam_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            
            // Add to selected files
            selectedFiles.push(file);
            
            // Update preview
            create_preview();
            
            // Update status
            $('#status').html(`${selectedFiles.length} file(s) selected`).css('color', 'green');
            $('#upload-btn').show();
            
        }, 'image/jpeg', 0.9); // JPEG format with 90% quality
    });

    // Open file dialog when select button is clicked
    $('#select-btn').on('click', function() {
        $('#file-input').click();
    });

    // Handle file selection
    $('#file-input').on('change', async function() {
        await handleFiles();
    });

    // Drag and drop functionality
    $('.upload-container').on('dragover', function(e) {
        e.preventDefault();
        $(this).css('backgroundColor', '#f7f9fa');
    });

    $('.upload-container').on('dragleave', function() {
        $(this).css('backgroundColor', '');
    });

    $('.upload-container').on('drop', async function(e) {
        e.preventDefault();
        $(this).css('backgroundColor', '');
        
        if (e.originalEvent.dataTransfer.files) {
            $('#file-input')[0].files = e.originalEvent.dataTransfer.files;
            await handleFiles();
        }
    });

    // Handle upload to server
    $('#upload-btn').on('click', function() {
        if (selectedFiles.length === 0) {
            $('#status').html('No files selected for upload');
            return;
        }
        const consentPublications = $('#consent_face').is(':checked') ? 'true' : 'false';
        // Create FormData to send files
        const formData = new FormData();
        $.each(selectedFiles, function(index, file) {
            const extension = file.name.split('.').pop().toLowerCase();
            const file_category = local_categories[index];
            const newFilename = `${file_category}.${extension}`;
            const renamedFile = new File([file], newFilename, { type: file.type });
            formData.append('files', renamedFile);
        });

        axios.post(`/api/${taskName}/upload`, formData, {
            headers: {
                'Consent-Publications': consentPublications,
                'pid': local_pid
            },
            onUploadProgress: (progressEvent) => {
                const percentComplete = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                $('#status').html(`Uploading: ${percentComplete}%`);
            }
        })
        .then(function(response) {
            $('#status').html(response.data.message).css('color', 'green');
            
            // Stop webcam if active
            if (webcamActive) {
                stopWebcam();
            }
            
            // Reset after successful upload
            setTimeout(function() {
                $('#preview').empty();
                $('#status').html('');
                $('#upload-btn').hide();
                selectedFiles.length = 0;
                $('#file-input').val('');
                endExperiment();
            }, 2000);
        })
        .catch(function(error) {
            console.error('Upload error:', error);
            $('#status').html('Upload failed. Please check the connection and try again. If it persists, please contact us.').css('color', 'red');
            $('#status').append('<br><a href="upload_finished">Skip the uploading.</a>');
        });
    });
}

