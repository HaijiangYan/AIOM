// const port = '8080';
// const host = "http://127.0.0.1";
// const url = host + ':' + port;
var local_pid;
var local_chain;
var local_dim;
var local_state;
var proposed_values;
var classes;
var class_questions;
var n_rest;
var mode;
var stimuli_attr;
var stimuli_list;
var current_n_class; // which class we're in by order;
var n_trial = 1;

function submit_id(id) {
    Cookies.set('pid', id);
    axios.post(`/api/set_table`, {
        names: id,
    }, {headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => {
        classes = JSON.stringify(response.data.classes);
        class_questions = JSON.stringify(response.data.class_questions);
        Cookies.set('classes', classes);
        Cookies.set('class_questions', class_questions);
        Cookies.set('n_rest', response.data.n_rest);
        Cookies.set('mode', response.data.mode);
    })
    .then(() => {window.location.href = `/instruction`;})
    .catch((error) => {
        console.error('Error:', error);
        alert(`Error in setting tables`);
    });
}

function startChoice() {
    local_pid = Cookies.get('pid');
    classes = Cookies.get('classes');
    classes = JSON.parse(classes);
    class_questions = Cookies.get('class_questions');
    class_questions = JSON.parse(class_questions);
    n_rest = Number(Cookies.get('n_rest'));
    mode = Cookies.get('mode');

    if (mode === 'test') {
        stimuli_attr = 'alt';
    } else if (mode === 'image') {
        stimuli_attr = 'src';
    }

    axios.get(`/api/start_choices`, {
        headers: {
            'ID': local_pid,
        },
    })
    .then(response => {
        // console.log(response.data);
        current_n_class = response.data.current_category;
        stimuli_list = response.data.stimuli;
        generateOptions();
        local_chain = response.data.table_no;
        local_dim = response.data.current_dim;
        local_state = response.data.current_state;
        proposed_values = response.data.proposed_values;
        fadein_option();
        return response.data;
    })
    .catch((error) => {
        console.error('Error:', error);
        // alert(`Error sending list ${local_pid}`);
        endExperiment();
    });
}

function generateOptions() {
    const leng = stimuli_list.length;
    const $choicesContainer = $('#choices'); // Use jQuery to select the container
    // Clear the container before appending new options
    $choicesContainer.empty(); 
    $(".question").html(class_questions[current_n_class]);
    $('#slider')
    .attr('min', 0)
    .attr('max', leng-1)
    .attr('value', 0)
    .attr('step', 1)
    .val(0); 

    const $optionDiv = $('<div>').addClass('gsp_option');
    const $img = $('<img>')
        .attr(stimuli_attr, stimuli_list[0])
        .attr('width', 128) // Set the width
        .attr('height', 128); // Set the height
    $optionDiv.append($img); // Append the image to the div
    $choicesContainer.append($optionDiv);
}

// Highlight the selected option based on the slider value
function updateHighlight() {
    const sliderValue = parseInt($('#slider').val()); // Get the slider value
    $('.gsp_option img').attr(stimuli_attr, stimuli_list[sliderValue]);
}

function getChoice() {
    axios.get(`/api/get_choices`, {
        headers: {
            'ID': local_pid,
        },
    })
    .then(response => {
        if (response.data.prior) {
            local_state = response.data.current_state;
            local_chain = response.data.table_no;
            priorOptions(response.data.stimuli).then(() => {
                return response.data;
            });
        } else {
            // console.log(response.data.proposal);
            current_n_class = response.data.current_category;
            stimuli_list = response.data.stimuli;
            generateOptions();
            local_chain = response.data.table_no;
            local_dim = response.data.current_dim;
            local_state = response.data.current_state;
            proposed_values = response.data.proposed_values;
            fadein_option();
            return response.data;
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        // alert(`Error sending list ${local_pid}`);
        endExperiment();
    });
}

function sendChoice_prior(selectedOption) {
    axios.post(`/api/register_choices`, {
        choice: selectedOption,
        current_state: local_state,
    }, 
        {headers: {
            'Content-Type': 'application/json',
            'ID': local_pid + `_no${local_chain}`,
            'n_trial': n_trial, 
            'prior': true,
        },
    })
    .then(response => {
        n_trial ++;
        if (!response.data.finish) {
            if ((n_trial-1)%n_rest===0 && n_trial != 2) {
                time_to_rest().then(() => {
                    setTimeout(() => {
                        getChoice();
                    }, 500)
                });
            } else {
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

function sendChoice() {
    const decision = parseInt($('#slider').val());
    const replace_value = proposed_values[decision];
    const new_state = [...local_state];
    new_state[local_dim] = replace_value;
    // console.log("result");
    axios.post(`/api/register_choices`, {
        choice: new_state,
    }, 
        {headers: {
            'Content-Type': 'application/json',
            'ID': local_pid + `_no${local_chain}`,
            'current_category': current_n_class,
            'current_dim': local_dim,
            // 'current_class': classes[class_order[current_n_class]],
            'n_trial': n_trial, 
            'prior': false,
        },
    })
    .then(response => {
        n_trial ++;
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
    })
    .catch((error) => {
        console.error('Error:', error);
        // alert(`Error sending list ${local_pid}`);
        endExperiment();
    });
}

function endExperiment() {
    window.location.href = `/thanks`;
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

function priorOptions(stimuli) {
    return $.Deferred(function(deferred) {
        // Display
        $('#priorContent p').html('Please select a category that best describes the image:');
        $('#priorStimulus').attr(stimuli_attr, stimuli); 
        $choicesContainer = $('#priorSelect'); 
        $choicesContainer.empty(); 

        for (let i = 0; i < classes.length; i++) {
            const $button = $('<button>')
                .addClass('category-btn')
                .attr('data-value', classes[i])
                .html(classes[i])
                .on('click', function() {
                    const selectedValue = $(this).attr('data-value');
                    sendChoice_prior(selectedValue);
                    $("#prior").css("display", "none");
                    deferred.resolve();
                });
            
            $choicesContainer.append($button);
        }
        $("#prior").css("display", "flex");
    }).promise();
}
