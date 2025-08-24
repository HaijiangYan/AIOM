var local_pid;
var classes;
var n_rest;
var filename;
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
                `<button id="option_${i}" class="categorization_button" onclick="lockChoice('${i}')" disabled>${i}</button>`
            );
        }

        $('.confidence').append(
            `<p class="confidence-text">Not sure at all&nbsp;&nbsp;</p>`
        );
        for (j = 1; j < 8; j++) {
            $('.confidence').append(
                `<button id="confidence_${j}" class="confidence_button" onclick="sendConfidence(${j})" disabled>${j}</button>`
            );
        }
        $('.confidence').append(
            `<p class="confidence-text">&nbsp;&nbsp;Completely sure</p>`
        );
        centerFourthButton();
        $('.confidence-text, .confidence').css('visibility', 'hidden');
    })
    .catch((error) => {
        console.error('Error:', error);
        alert(`Error in setting tables`);
    });
}

function centerFourthButton() {
    const button4 = $('#confidence_4');
    const windowCenter = window.innerWidth / 2;
    const button4Center = button4.offset().left + button4.outerWidth() / 2;
    const offset = windowCenter - button4Center;
    
    $('.confidence').css('transform', `translateX(${offset}px)`);
}

function getChoice() {
    axios.get(`/api/${taskName}/get_stimuli`, {
        headers: {
            'ID': local_pid,
        },
    })
    .then(response => {
        filename = response.data.filename;
        $(".stimuli").attr('src', response.data.stimulus);
        fadein_option();
    })
    .catch((error) => {
        console.error('Error:', error);
        endExperiment();
    });
}

function lockChoice(selected) {
    reaction_time = parseInt(performance.now() - stimulus_start_time);
    selected_choice = selected;
    $(`#option_${selected}`).addClass('button_highlight');
    $('.categorization_button').prop('disabled', true);
    $('.confidence-text, .confidence').css('visibility', 'visible');
    $('.confidence_button').prop('disabled', false);
}

function unlockChoice() {
    $(`#option_${selected_choice}`).removeClass('button_highlight');
    $('.confidence_button').prop('disabled', true);
    $('.confidence-text, .confidence').css('visibility', 'hidden');
    $('.categorization_button').prop('disabled', false);
}

function sendConfidence(conf) {
    // Disable all buttons after a choice is made
    $(`#option_${selected_choice}`).removeClass('button_highlight');
    $('.confidence_button').prop('disabled', true);
    $('.confidence-text, .confidence').css('visibility', 'hidden');
    axios.post(`/api/${taskName}/register_choices`, {
        choice: selected_choice,
        confidence: conf,
        rt: reaction_time,
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