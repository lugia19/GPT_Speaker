// ==UserScript==
// @name        Speaker button integration
// @namespace   Violentmonkey Scripts
// @match       https://chat.openai.com/*
// @match		https://gemini.google.com/*
// @match		https://perplexity.ai/*
// @match		https://claude.ai/*
// @match       https://chatgpt.com/*
// @match		https://www.perplexity.ai/*
// @match		https://www.claude.ai/*
// @grant       GM_xmlhttpRequest
// @version     1.0
// @author      lugia19
// @description 25/12/2023, 11:39:59
// ==/UserScript==



const flask_port = 57319

let message_classes = []
if (window.top !== window.self)
	throw 'Stopping execution of speaker button integration in separate thread.'

const isGemini = window.location.href.includes('gemini.google.com')
const isPerplexity = window.location.href.includes('perplexity.ai')
const isClaude = window.location.href.includes('claude.ai')

let add_speaker_button
let get_assistant_messages
if (isGemini) {
    message_classes = ["model-response-text"]
    get_assistant_messages = get_assistant_messages_gemini
    add_speaker_button = add_speaker_button_gemini
} else if (isPerplexity) {
    get_assistant_messages = get_assistant_messages_perplexity
    add_speaker_button = add_speaker_button_perplexity
} else if (isClaude) {
	message_classes = ["font-claude-message"]
	get_assistant_messages = get_assistant_messages_claude
	add_speaker_button = add_speaker_button_claude
} else {
    message_classes = ["w-full", "text-token-text-primary"]
    get_assistant_messages = get_assistant_messages_cgpt
    add_speaker_button = add_speaker_button_cgpt
}

const message_selector = '.' + message_classes.join('.');
let speaker_button_id = "speakerButton"

function findChildWithSelector(element, selector) {
    let queue = Array.from(element.children);
    while (queue.length) {
        let current = queue.shift();
        if (current.matches(selector)) {
            return current;
        }
        queue.push(...current.children);
    }
    return null;
}

function handleButtonClick(event, markdownChild) {
	console.log('Button was clicked!');
	if (markdownChild) {
		let textContent = markdownChild.textContent;
		console.log(textContent);

		let apiEndpoint = `http://localhost:${flask_port}/generate_extract_audio`;
		// Prepare the data to send
		let dataToSend = JSON.stringify({
		  text: textContent
		});

		// Use GM_xmlhttpRequest for the POST request
		GM_xmlhttpRequest({
		  method: 'POST',
		  url: apiEndpoint,
		  headers: {
			'Content-Type': 'application/json'
		  },
		  data: dataToSend,
		  onload: function(response) {
			// The request was successful
			if (response.status >= 200 && response.status < 300) {
			  // Assuming the response is JSON; parse and log or process it
			  let data = JSON.parse(response.responseText);
			  console.log('Success:', data);
			} else {
			  // Handle HTTP error responses
			  throw new Error('Request was not successful: ' + response.status);
			}
		  },
		  onerror: function(response) {
			// Handle network errors
			console.error('Request failed', response);
		  }
		});

	}
}

//This function gets all the messages, and adds speaker buttons to them (with the relevant events)
function get_assistant_messages_cgpt() {
	// Use document.querySelectorAll() to get all elements matching the selector
	let elements = document.querySelectorAll(message_selector);
	let assistant_messages = []
	// Loop through the NodeList and check if each element has only the specified classes
	for (let element of elements) {
		let elementClasses = Array.from(element.classList);

		// Check if the element's classes match the specified classes array
		if (elementClasses.length === message_classes.length && message_classes.every(className => elementClasses.includes(className))) {
			//It's actually a message.
			let outer_message = element
			while (outer_message.childElementCount === 1) {
				outer_message = outer_message.lastChild
			}
			console.log("Iterating over children...")
			for (let child of outer_message.children) {
				console.log(child)
				if (child.classList.contains("w-full")) {
					//Is inner message
					if (child.classList.contains("agent-turn")) {
						//Is an assistant message. Add it to the array.
						assistant_messages.push(child)
					}
					//We found the message - either it was an assistant message, or it was not. Stop iterating.
					break
				}
			}
		}
	}
	return assistant_messages
}
function add_speaker_button_cgpt(inner_message) {
	//Get the buttons div
	const buttons_div = findChildWithSelector(inner_message, ".text-gray-400")
	if (!buttons_div.querySelector(`#${speaker_button_id}`)) {
		const existingButton = buttons_div.querySelector('button');
		console.log("Appending button...")
		let newButton = existingButton.cloneNode(false); // This removes children but preserves attributes

		// Add an SVG icon to the button instead of text
		newButton.innerHTML = `
			<svg viewBox="0 0 75 75" width="24" height="24" fill="none" class="icon-md">
				<path d="M39.389,13.769 L22.235,28.606 L6,28.606 L6,47.699 L21.989,47.699 L39.389,62.75 L39.389,13.769z" style="stroke:currentColor;stroke-width:5;stroke-linejoin:round;fill:none;" fill-rule="evenodd" clip-rule="evenodd"></path>
				<path d="M 55.1 20.5 C 68.997 31.956 68.962 46.551 55.1 56.1" style="stroke: currentColor; stroke-width: 5; stroke-linecap: round; fill: none;" fill-rule="evenodd" clip-rule="evenodd"></path>							  
			</svg>
		`;

		// Set the ID for the new button
		newButton.id = speaker_button_id;
		newButton.addEventListener('click', function (event) {
			handleButtonClick(event, findChildWithSelector(inner_message, ".markdown"));
		});
		buttons_div.prepend(newButton);
	}
}

function get_assistant_messages_gemini() {
	return document.querySelectorAll(message_selector);
}

function add_speaker_button_gemini(inner_message) {
	console.log("Adding gemini speaker button...")
	const modelResponse = inner_message.closest('model-response');
	const messageFooter = findChildWithSelector(modelResponse, ".response-container-footer")
	let buttons_div = findChildWithSelector(messageFooter, "fact-check-button").parentElement
	if (!buttons_div.querySelector(`#${speaker_button_id}`)) {
		const existingButton = buttons_div.querySelector('button');
		console.log("Appending button to div...")
		let newButton = existingButton.cloneNode(false); // This removes children but preserves attributes

		// Add an SVG icon to the button instead of text
		newButton.innerHTML = `
			<svg viewBox="0 0 75 75" width="24" height="24" fill="none" class="icon-md" preserveAspectRatio="xMidYMid meet">
				<path d="M39.389,13.769 L22.235,28.606 L6,28.606 L6,47.699 L21.989,47.699 L39.389,62.75 L39.389,13.769z" style="stroke:currentColor;stroke-width:5;stroke-linejoin:round;fill:none;" fill-rule="evenodd" clip-rule="evenodd"></path>
				<path d="M 55.1 20.5 C 68.997 31.956 68.962 46.551 55.1 56.1" style="stroke: currentColor; stroke-width: 5; stroke-linecap: round; fill: none;" fill-rule="evenodd" clip-rule="evenodd"></path>							  
			</svg>
		`;

		// Set the ID for the new button
		newButton.id = speaker_button_id;
		newButton.addEventListener('click', function (event) {
			handleButtonClick(event, findChildWithSelector(inner_message, ".markdown"));
		});
		buttons_div.append(newButton);
	}
}


function get_assistant_messages_claude() {
	return document.querySelectorAll('.font-claude-message');
}

function add_speaker_button_claude(inner_message) {
	// Go up one level to the parent container
	const messageContainer = inner_message.closest('.group');
	if (!messageContainer) return;

	// Find the footer within this container
	const buttons_div = findChildWithSelector(messageContainer, ".text-text-400");
	if (buttons_div && !buttons_div.querySelector(`#${speaker_button_id}`)) {
		const existingButton = buttons_div.querySelector('button');
		if (existingButton) {
			let newButton = existingButton.cloneNode(false);

			// Add the SVG icon
			newButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 75 75">
                    <path d="M39.389,13.769 L22.235,28.606 L6,28.606 L6,47.699 L21.989,47.699 L39.389,62.75 L39.389,13.769z" style="stroke:currentColor;stroke-width:5;stroke-linejoin:round;fill:none;" fill-rule="evenodd" clip-rule="evenodd"></path>
                    <path d="M 55.1 20.5 C 68.997 31.956 68.962 46.551 55.1 56.1" style="stroke: currentColor; stroke-width: 5; stroke-linecap: round; fill: none;" fill-rule="evenodd" clip-rule="evenodd"></path>
                </svg>
            `;

			newButton.id = speaker_button_id;
			newButton.title = "Text to speech";
			newButton.addEventListener('click', function (event) {
				handleButtonClick(event, inner_message);
			});

			// Insert the new button after the first button in the div
			buttons_div.insertBefore(newButton, buttons_div.children[1]);
		}
	}
}


function get_assistant_messages_perplexity() {
    // Find all elements that contain the text "Answer" and are followed by the actual answer text
    const answerLabels = Array.from(document.querySelectorAll('.font-display.text-lg.font-medium'))
        .filter(el => el.textContent.trim() === 'Answer');

    // For each "Answer" label, find the corresponding answer text
    return answerLabels.map(label => {
        const answerContainer = label.closest('.border-borderMain\\/50').parentElement;
        if (answerContainer) {
            return answerContainer.querySelector('.prose.dark\\:prose-invert.inline');
        }
        return null;
    }).filter(el => el !== null);
}

function add_speaker_button_perplexity(inner_message) {
    const messageContainer = inner_message.closest('.border-borderMain\\/50');
    if (!messageContainer) return;

    const bottomRightButtonGroup = messageContainer.querySelector('.flex.items-center.gap-x-xs');
    if (!bottomRightButtonGroup || bottomRightButtonGroup.querySelector(`#${speaker_button_id}`)) return;

    const newButton = document.createElement('button');
    newButton.id = speaker_button_id;
    newButton.className = 'md:hover:bg-offsetPlus text-textOff dark:text-textOffDark md:hover:text-textMain dark:md:hover:bg-offsetPlusDark dark:md:hover:text-textMainDark font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-in-out font-sans select-none items-center relative group/button justify-center text-center items-center rounded-full cursor-point active:scale-95 origin-center whitespace-nowrap inline-flex text-sm aspect-square h-8';
    newButton.innerHTML = `
        <div class="flex items-center min-w-0 justify-center gap-xs">
            <svg viewBox="0 0 75 75" width="24" height="24" fill="none" class="icon-md">
                <path d="M39.389,13.769 L22.235,28.606 L6,28.606 L6,47.699 L21.989,47.699 L39.389,62.75 L39.389,13.769z" style="stroke:currentColor;stroke-width:5;stroke-linejoin:round;fill:none;" fill-rule="evenodd" clip-rule="evenodd"></path>
                <path d="M 55.1 20.5 C 68.997 31.956 68.962 46.551 55.1 56.1" style="stroke: currentColor; stroke-width: 5; stroke-linecap: round; fill: none;" fill-rule="evenodd" clip-rule="evenodd"></path>
            </svg>
        </div>
    `;
    newButton.addEventListener('click', function (event) {
        handleButtonClick(event, inner_message);
    });

    // Insert the new button as the first child of the bottom right button group
    bottomRightButtonGroup.insertBefore(newButton, bottomRightButtonGroup.firstChild);
}

function add_all_speaker_buttons() {
	console.log("Adding speaker buttons...")
	let assistant_messages = get_assistant_messages()
	for (let assistant_message of assistant_messages) {
		console.log("Adding speaker button...")
		add_speaker_button(assistant_message)
	}
}

setInterval(add_all_speaker_buttons, 3 * 1000)