var local_pid;
var local_chain;
var local_dim;
var local_state;
var proposed_values;
var class_question;
var n_rest;
var stimuli_list;
var current_step = 0; // which class we're in by order;
var n_trial = 1;
const taskName = window.taskName;

function show_instruction() {
    return $.Deferred(function(deferred) {
        $('#insContent p').load(`/exp-static/${taskName}/instruction.html`, function(response, status, xhr) {
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
        pid: local_pid,
    }, {headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => {
        class_question = response.data.ordered_class_question;
        n_rest = Number(response.data.n_rest);
    })
    .catch((error) => {
        console.error('Error:', error);
        alert(`Error in setting tables`);
    });
}

function getChoice() {
    axios.get(`/api/${taskName}/get_choices`, {
        headers: {
            'ID': local_pid,
            'current_class': Object.keys(class_question)[current_step],
        },
    })
    .then(response => {
        stimuli_list = response.data.stimuli;
        generateOptions();
        local_chain = response.data.table_no;
        local_dim = response.data.current_dim;
        local_state = response.data.current_state;
        proposed_values = response.data.proposed_values;
        fadein_option();
        $('#submitButton').prop('disabled', false);
        return response.data;
    })
    .catch((error) => {
        console.error('Error:', error);
        errorhandler();
    });
}

// Highlight the selected option based on the slider value
function updateHighlight() {
    const sliderValue = parseInt($('#slider').val()); // Get the slider value
    $('.gsp_option img').attr('src', stimuli_list[sliderValue]);
}

function generateOptions() {
    const leng = stimuli_list.length;
    const $choicesContainer = $('#choices'); // Use jQuery to select the container
    // Clear the container before appending new options
    $choicesContainer.empty(); 
    const question_lh = Object.values(class_question)[current_step];
    const words = question_lh.split(' ');
    const lastWord = words.pop(); // Remove and return the last word
    const questionStart = words.join(' '); 
    $(".question").html(`${questionStart}<br><span class="highlight">${lastWord}</span>`);
    $('#slider')
    .attr('min', 0)
    .attr('max', leng-1)
    .attr('value', 0)
    .attr('step', 1)
    .val(0); 

    const $optionDiv = $('<div>').addClass('gsp_option');
    const $img = $('<img>')
        .attr('src', stimuli_list[0])
        .attr('width', 128) // Set the width
        .attr('height', 128); // Set the height
    $optionDiv.append($img); // Append the image to the div
    $choicesContainer.append($optionDiv);
}


function sendChoice() {
    $('#submitButton').prop('disabled', true);
    const decision = parseInt($('#slider').val());
    const replace_value = proposed_values[decision];
    const new_state = [...local_state];
    new_state[local_dim] = replace_value;
    // console.log("result");
    axios.post(`/api/${taskName}/register_choices`, {
        choice: new_state,
    }, 
        {headers: {
            'Content-Type': 'application/json',
            'table_name': `${local_pid}_gsp_${Object.keys(class_question)[current_step]}_no${local_chain}`,
            'current_dim': local_dim,
            'n_trial': n_trial, 
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
            if (current_step < Object.keys(class_question).length - 1) {
                fadeaway_option(response.data.progress);
                current_step ++;
                n_trial = 1;
                setTimeout(() => {
                    getChoice();
                }, 500)
            } else {
                endExperiment(); 
            }
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        errorhandler();
    });
}

function endExperiment() {
    window.location.href = `/experiment/${taskName}`;  // continue to the next subexperiment
}

function errorhandler() {
    window.location.href = '/error';
}



// UI animation
function fadeaway_option(progress) {
    $('#choices').removeClass('fade-in').addClass('fade-out');
    $('#slider').removeClass('fade-in').addClass('fade-out');
    setTimeout(() => {
        updateProgress(progress);
    }, 100);
}

function fadein_option() {
    $('#choices').removeClass('fade-out').addClass('fade-in');
    $('#slider').removeClass('fade-out').addClass('fade-in');
}

function updateProgress(progress) {
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = `${progress*100}%`;
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