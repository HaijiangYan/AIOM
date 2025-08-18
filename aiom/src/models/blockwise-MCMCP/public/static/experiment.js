var local_pid;
var current_on_left;

var start_classes;
var classes;
var class_questions;
var n_rest;

var mode;
var stimuli_attr;

var current_position;
var proposal_position;
var current_category;
var proposal_category;

var current_chain;
var current_class;
var n_trial = 1;
var attention_check_pass = true;
const taskName = window.taskName;
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
        class_questions = response.data.class_questions;
        n_rest = Number(response.data.n_rest);
        mode = response.data.mode;

        if (mode === 'test') {
            stimuli_attr = 'alt';
        } else if (mode === 'image') {
            stimuli_attr = 'src';
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        alert(`Error in setting tables`);
    });
}


function getChoice() {
    axios.get(`/api/${taskName}/get_choices`, {
        headers: {
            'ID': local_pid
        },
    })
    .then(response => {
        // parse the information from the response
        current_on_left = 0.5 <= Math.random();
        if (['likelihood', 'attention_check'].includes(response.data.trial_type)) {

            $(".option").removeClass('hidden-option');
            current_class = response.data.current_class;
            // show question
            const question_lh = class_questions[classes.indexOf(current_class)];
            const words = question_lh.split(' ');
            const lastWord = words.pop(); // Remove and return the last word
            const questionStart = words.join(' '); 
            $(".question").html(`${questionStart}<br><span class="highlight">${lastWord}</span>`);

            const left_attrs = { class: 'stimuli_left', height: 128, width: 128 };
            const right_attrs = { class: 'stimuli_right', height: 128, width: 128 };
            left_attrs[stimuli_attr] = current_on_left ? response.data.current : response.data.proposal;
            right_attrs[stimuli_attr] = current_on_left ? response.data.proposal : response.data.current;

            if (response.data.trial_type === 'attention_check') {
                const attention_check = response.data.attention_check;
                const is_left_correct = current_on_left ? (current_class === attention_check[0]) : (current_class === attention_check[1]);
                const is_right_correct = current_on_left ? (current_class === attention_check[1]) : (current_class === attention_check[0]);
                left_attrs.onclick = `sendChoice_attentioncheck(${is_left_correct})`;
                right_attrs.onclick = `sendChoice_attentioncheck(${is_right_correct})`;
            } else { // 'likelihood' trial
                left_attrs.onclick = 'sendChoice(0)';
                right_attrs.onclick = 'sendChoice(1)';
                current_chain = response.data.current_chain;
                current_position = response.data.current_position;
                proposal_position = response.data.proposal_position;
            }

            const $left_img = $('<img>').attr(left_attrs);
            const $right_img = $('<img>').attr(right_attrs);
            $(".stimuli_left").replaceWith($left_img);
            $(".stimuli_right").replaceWith($right_img);
            
        } else {

            $(".option").addClass('hidden-option');
            current_chain = response.data.current_chain;
            current_position = response.data.stimulus_position;
            current_category = response.data.current;
            proposal_category = response.data.proposal;

            const left_button_text = current_on_left ? current_category : proposal_category;
            const right_button_text = current_on_left ? proposal_category : current_category;
            $(".stimuli_left").replaceWith(
                `<button class="stimuli_left" id="button_left" onclick="sendChoice_prior(0)">${left_button_text}</button>`);
            $(".stimuli_right").replaceWith(
                `<button class="stimuli_right" id="button_right" onclick="sendChoice_prior(1)">${right_button_text}</button>`);
            
            const question_img_attrs = { id: 'question_stimuli', height: 128, width: 128 };
            question_img_attrs[stimuli_attr] = response.data.current_stimulus;
            const $question_img = $('<img>').attr(question_img_attrs);
            $(".question").html('Which option can best describe the image:<br><br>').append($question_img);

        }

        fadein_option();
        return response.data;
    })
    .catch((error) => {
        console.error('Error:', error);
        // alert(`Error sending list ${local_pid}`);
        errorhandler();
    });
}


function sendChoice_attentioncheck(attention_check) {
    $(".stimuli_left, .stimuli_right").removeAttr("onclick");
    axios.post(`/api/register_attentioncheck`, {
        result: attention_check,
    }, 
        {headers: {
            'Content-Type': 'application/json',
            'ID': local_pid,
        },
    })
    .then(response => {
        if (response.data.fail_count >= 2) {
            attention_check_pass = false;
        }
        fadeaway_option(100);
        
        setTimeout(() => {
            getChoice();  
        }, 500)
    })
    .catch((error) => {
        console.error('Error:', error);
        // alert(`Error sending list ${local_pid}`);
        errorhandler();
    });
}


function sendChoice(selected) {
    $(".stimuli_left, .stimuli_right").removeAttr("onclick");
    let decision;
    if (current_on_left) {
        decision = selected;
    } else {
        decision = 1-selected;
    }
    const selected_position = decision==0 ? current_position : proposal_position;
    axios.post(`/api/${taskName}/register_choices`, {
        choice: selected_position,
    }, 
        {headers: {
            'Content-Type': 'application/json',
            'name': local_pid,
            'ID': `${local_pid}_blockwise_no${current_chain}`,
            'n_trial': n_trial, 
            'current_class': current_class,
            'trial_type': 'likelihood',
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
        // alert(`Error sending list ${local_pid}`);
        errorhandler();
    });
}

function sendChoice_prior(selected) {
    $(".stimuli_left, .stimuli_right").removeAttr("onclick");
    let decision;
    if (current_on_left) {
        decision = selected;
    } else {
        decision = 1-selected;
    }
    const selected_category = decision==0 ? current_category : proposal_category;
    axios.post(`/api/${taskName}/register_choices`, {
        choice: selected_category,
        current_position: current_position,
    }, 
        {headers: {
            'Content-Type': 'application/json',
            'ID': `${local_pid}_blockwise_no${current_chain}`, 
            'name': local_pid,
            'n_trial': n_trial, 
            'trial_type': 'prior',
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
        // alert(`Error sending list ${local_pid}`);
        errorhandler();
    });
}

function endExperiment() {
    if (attention_check_pass) window.location.href = `/experiment/${taskName}`;  // continue to the next subexperiment
    else window.location.href = '/early_stop';  // end the experiment without bonus
}

function errorhandler() {
    window.location.href = '/error';
}



// UI animation
function fadeaway_option(progress) {
    $('#choice_left').removeClass('fade-in').addClass('fade-out');
    $('#choice_right').removeClass('fade-in').addClass('fade-out');
    setTimeout(() => {
        updateProgress(progress);
    }, 100);
}

function fadein_option() {
    $('#choice_left').removeClass('fade-out').addClass('fade-in');
    $('#choice_right').removeClass('fade-out').addClass('fade-in');
}

function updateProgress(progress) {
    if (progress <= 1.0) {
        const progressBar = document.getElementById('progressBar');
        progressBar.style.width = `${progress*100}%`;
    }
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