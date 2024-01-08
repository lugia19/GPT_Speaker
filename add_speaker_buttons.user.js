//This is the userscript that adds the "Speak" buttons.
//It's very, very simple, just running on a 3 second timer.

// ==UserScript==
// @name        Speaker button integration
// @namespace   Violentmonkey Scripts
// @match       https://chat.openai.com/*
// @grant       none
// @version     1.0
// @author      lugia19
// @description 25/12/2023, 11:39:59
// ==/UserScript==

function findChildWithClass(element, className) {
	let queue = Array.from(element.children);
	while (queue.length) {
		let current = queue.shift();
		if (current.classList.contains(className)) {
			return current;
		}
		queue.push(...current.children);
	}
	return null;
}

function handleButtonClick(event, markdownChild) {
	console.log('Button was clicked!');
	if (markdownChild) {
		let textContent = markdownChild.textContent
		console.log(textContent);

		let apiEndpoint = 'http://localhost:57335/generate_extract_audio';
		// Prepare the data to send in the POST request body
		let dataToSend = {
			text: textContent
		};

		// Use the Fetch API for the POST request
		fetch(apiEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(dataToSend)
		})
			.then(response => {
				// Check if the request was successful
				if (response.ok) {
					return response.json(); // or `response.text()` if API sends back plain text
				}
				throw new Error('Network response was not ok.');
			})
			.then(data => {
				console.log('Success:', data); // Log or process the response from the server
			})
			.catch(error => {
				console.error('Error:', error);
			});
	}
}

//This function gets all the messages, and adds speaker buttons to them (with the relevat events)
function add_speaker_buttons() {
	let classes = ["w-full", "text-token-text-primary"]
	let selector = '.' + classes.join('.');
	let speaker_button_id = "speakerButton"
	// Use document.querySelectorAll() to get all elements matching the selector
	let elements = document.querySelectorAll(selector);

	// Loop through the NodeList and check if each element has only the specified classes
	for (let element of elements) {
		let elementClasses = Array.from(element.classList);

		// Check if the element's classes match the specified classes array
		if (elementClasses.length === classes.length && classes.every(className => elementClasses.includes(className))) {
			let message = element
			while (message.childElementCount === 1) {
				message = message.lastChild
			}
			console.log("Iterating over children...")
			for (let child of message.children) {
				console.log(child)
				if (child.classList.contains("w-full")) {
					if (child.classList.contains("agent-turn")) {
						//Is an assistant message. Let's get the buttons div.
						const buttons_div = findChildWithClass(child, "text-gray-400")
						if (!buttons_div.querySelector(`#${speaker_button_id}`)) {
							const existingButton = buttons_div.querySelector('button');
							console.log("Appending button...")
							let newButton = existingButton.cloneNode(false); // This removes children but preserves attributes

							// Add an SVG icon to the button instead of text
							newButton.innerHTML = `
								<svg viewBox="0 0 75 75" width="24" height="24" fill="none" class="icon-md">
									<path d="M39.389,13.769 L22.235,28.606 L6,28.606 L6,47.699 L21.989,47.699 L39.389,62.75 L39.389,13.769z" style="stroke:currentColor; stroke-width:7; stroke-linejoin:round; fill:none;" fill-rule="evenodd" clip-rule="evenodd"></path>
									<path d="M 55.1 20.5 C 68.997 31.956 68.962 46.551 55.1 56.1" style="stroke: currentColor; stroke-width: 7; stroke-linecap: round; fill: none;" fill-rule="evenodd" clip-rule="evenodd"></path>
								</svg>
							`;

							// Set the ID for the new button
							newButton.id = speaker_button_id;
							newButton.addEventListener('click', function (event) {
								handleButtonClick(event, findChildWithClass(child, "markdown"));
							});
							buttons_div.prepend(newButton);
						}
					}
					break
				}
			}
		}
	}
}

setInterval(add_speaker_buttons, 3 * 1000)