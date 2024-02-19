// ==UserScript==
// @name        Speaker button integration
// @namespace   Violentmonkey Scripts
// @match       https://chat.openai.com/*
// @match		https://gemini.google.com/*
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

let add_speaker_button
let get_assistant_messages
if (isGemini) {
	message_classes = ["model-response-text"]
	get_assistant_messages = get_assistant_messages_gemini
	add_speaker_button = add_speaker_button_gemini
} else {
	message_classes = ["w-full", "text-token-text-primary"]
	get_assistant_messages = get_assistant_messages_cgpt
	add_speaker_button = add_speaker_button_cgpt
}

const selector = '.' + message_classes.join('.');
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
	let elements = document.querySelectorAll(selector);
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
	return document.querySelectorAll(selector);
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


function add_all_speaker_buttons() {
	console.log("Adding speaker buttons...")
	let assistant_messages = get_assistant_messages()
	for (let assistant_message of assistant_messages) {
		console.log("Adding speaker button...")
		add_speaker_button(assistant_message)
	}
}

setInterval(add_all_speaker_buttons, 3 * 1000)