var local_pid;
var n_rest;
var rating_levels;
var stimulus_index;
var n_trial = 1;
const taskName = window.taskName
const instruction_text = `/exp-static/${taskName}/instruction.html`;

function show_instruction() {
    return $.Deferred(function(deferred) {
        $('#insContent p').load(`${instruction_text}`, function(response, status, xhr) {
            if (status == "error") {
                $("#insContent p").html("Sorry, there was an error loading the instruction.");
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
        n_rest = Number(response.data.n_rest);
        rating_levels = Number(response.data.rating_levels);
        $("#rating_slider").val(Math.ceil(rating_levels / 2));
        $("#rating_slider").attr({
            "max": rating_levels,
            "value": Math.ceil(rating_levels / 2)
        });
    })
    .catch((error) => {
        console.error('Error:', error);
        errorhandler();
    });
}

function getChoice() {
    axios.get(`/api/${taskName}/get_stimuli`, {
        headers: {
            'ID': local_pid
        }
    })
    .then(response => {
        stimulus_index = response.data.selected_index;
        $("#text").html(response.data.stimulus);
        fadein_option();
    })
    .catch((error) => {
        console.error('Error:', error);
        errorhandler();
    });
}

function sendChoice() {
    const rating = $('#rating_slider').val();
    $('#submit_button').prop('disabled', true);
    axios.post(`/api/${taskName}/register_choices`, {
        rating: rating,
    }, 
        {headers: {
            'Content-Type': 'application/json',
            'ID': local_pid,
            'n_trial': n_trial,
            'stimulus_index': stimulus_index
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
        errorhandler();
    });
}

function endExperiment() {
    window.location.href = `/experiment/${taskName}`; 
}

function errorhandler() {
    window.location.href = '/error';
}

// UI animation
function fadeaway_option(progress) {
    $('#text').removeClass('fade-in').addClass('fade-out');
    setTimeout(() => {
        updateProgress(progress);
    }, 100);
}

function fadein_option() {
    $('#text').removeClass('fade-out').addClass('fade-in');
    setTimeout(() => {
        $('#submit_button').prop('disabled', false);
        $("#rating_slider").val(Math.ceil(rating_levels / 2));
        $('#slider_value').text($('#rating_slider').val());
    }, 500);
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