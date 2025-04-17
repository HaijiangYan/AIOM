// const port = '8080';
// const host = "http://127.0.0.1";
// const url = host + ':' + port;
var local_pid;
var classes;
var n_rest;
var filename;
var n_trial = 1;

function loadParameters() {
    local_pid = Cookies.get('pid');
    classes = Cookies.get('classes');
    classes = JSON.parse(classes);
    n_rest = Number(Cookies.get('n_rest'));
    for (const i of classes) {
        $('.options').append(
            `<button id="option_${i}" class="categorization_button" onclick="sendChoice('${i}')">${i}</button>`
        );
    }
}

function getChoice() {
    axios.get(`/api/categorization_stimuli`, {
        headers: {
            'ID': local_pid,
        },
    })
    .then(response => {
        filename = response.data.filename;
        $(".stimuli").attr('src', response.data.stimulus);
        $('.categorization_button').prop('disabled', false);
        fadein_option();
    })
    .catch((error) => {
        console.error('Error:', error);
        endExperiment();
    });
}


function sendChoice(selected) {
    // Disable all buttons after a choice is made
    $('.categorization_button').prop('disabled', true);
    axios.post(`/api/register_categorization`, {
        choice: selected,
    }, 
        {headers: {
            'Content-Type': 'application/json',
            'ID': local_pid,
            'n_trial': n_trial, 
            'filename': filename,
        },
    })
    .then(response => {
        n_trial ++;
        if (!response.data.finish) {
            if ((n_trial-1)%n_rest===0 && n_trial != 2) {
                time_to_rest().then(() => {
                    // Code here will run after the user clicks "Continue"
                    fadeaway_option(response.data.progress);
                    setTimeout(() => {
                        getChoice();
                    }, 500)
                });
            } else {
                fadeaway_option(response.data.progress);
                setTimeout(() => {
                    getChoice();
                }, 500)
            }

        } else {
            endExperiment(); 
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        endExperiment();
    });
}

function endExperiment() {
    window.location.href = `/categorization_finished`; 
}

// UI animation
function fadeaway_option(progress) {
    $('.stimuli').removeClass('fade-in').addClass('fade-out');
    setTimeout(() => {
        updateProgress(progress);
    }, 100);
}

function fadein_option() {
    $('.stimuli').removeClass('fade-out').addClass('fade-in');
}

function updateProgress(progress) {
    $('#progressBar').css('width', `${progress*100}%`);
}

function time_to_rest() {
    return $.Deferred(function(deferred) {
        // Display the modal
        $('#restContent p').html('You can have a rest now!');
        $("#rest").css("display", "flex");

        // Wait for the user to click "Continue"
        $("#continueButton").on("click", function() {
            $("#rest").css("display", "none"); // Hide the modal
            deferred.resolve();    // Continue the script
        });
    }).promise();
}
