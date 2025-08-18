var local_pid;
var classes;
var n_rest;
var n_trial = 1;
var selected_choice;
var stimulus_start_time;
var reaction_time;
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
        classes = response.data.classes;
        n_rest = Number(response.data.n_rest);

        for (const i of classes) {
            $('.options').append(
                `<button id="option_${i}" class="categorization_button" onclick="sendChoice('${i}')">${i}</button>`
            );
        }

        $('.intensity').append(
            `<p class="intensity-text">Very weak&nbsp;&nbsp;</p>`
        );
        for (j = 1; j < 6; j++) {
            $('.intensity').append(
                `<button id="intensity_${j}" class="intensity_button" onclick="sendIntensity(${j})" disabled>${j}</button>`
            );
        }
        $('.intensity').append(
            `<p class="intensity-text">&nbsp;&nbsp;Very strong</p>`
        );
        centerFourthButton();
        $('.intensity-text, .intensity').css('visibility', 'hidden');
    })
    .catch((error) => {
        console.error('Error:', error);
        alert(`Error in setting tables`);
    });
}

function centerFourthButton() {
    const button4 = $('#intensity_3');
    const windowCenter = window.innerWidth / 2;
    const button4Center = button4.offset().left + button4.outerWidth() / 2;
    const offset = windowCenter - button4Center;
    
    $('.intensity').css('transform', `translateX(${offset}px)`);
}

function getChoice() {
    axios.get(`/api/${taskName}/get_stimuli`, {
        headers: {
            'ID': local_pid,
        },
    })
    .then(response => {
        $(".stimuli").attr('src', response.data.stimulus);
        fadein_option();
    })
    .catch((error) => {
        console.error('Error:', error);
        endExperiment();
    });
}

function sendChoice(selected) {
    reaction_time = parseInt(performance.now() - stimulus_start_time);
    selected_choice = selected;
    $(`#option_${selected}`).addClass('button_highlight');
    $('.categorization_button').prop('disabled', true);
    $('.intensity-text, .intensity').css('visibility', 'visible');
    $('.intensity_button').prop('disabled', false);
}

function back2unselected() {
    $(`#option_${selected_choice}`).removeClass('button_highlight');
    $('.intensity_button').prop('disabled', true);
    $('.intensity-text, .intensity').css('visibility', 'hidden');
    $('.categorization_button').prop('disabled', false);
}

function sendIntensity(intensity) {
    // Disable all buttons after a choice is made
    $(`#option_${selected_choice}`).removeClass('button_highlight');
    $('.intensity_button').prop('disabled', true);
    $('.intensity-text, .intensity').css('visibility', 'hidden');
    axios.post(`/api/${taskName}/register_choices`, {
        choice: selected_choice,
        intensity: intensity,
        rt: reaction_time,
    }, 
        {headers: {
            'Content-Type': 'application/json',
            'ID': local_pid,
            'n_trial': n_trial
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
    window.location.href = `/experiment/${taskName}`; 
}

// UI animation
function fadeaway_option(progress) {
    $('.stimuli').removeClass('fade-in-horizontal').addClass('fade-out-horizontal');
    setTimeout(() => {
        updateProgress(progress);
    }, 100);
}

function fadein_option() {
    $('.stimuli').removeClass('fade-out-horizontal').addClass('fade-in-horizontal');
    setTimeout(() => {
        $('.categorization_button').prop('disabled', false);
        stimulus_start_time = performance.now();
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