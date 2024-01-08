This is just a small side project I threw together from parts of a bigger app over a couple days.

It's composed of two parts:
1) A userscript which adds a "Speaker" button to every message on chatGPT.
2) A Flask application which recieves the text of the message and uses function calling with 3.5-turbo via the API to extract and "speak" the dialog of each character.

How to use it:
- Clone the repo
- Add the userscript to your userscript application of your choice (tampermonkey, etc)
- Install the requirements.txt via pip
- Run main.py

Additionally, you can modify the text_changes.json file (will be created if not present).
The key/value pairs will be used to replace text. I use it to fix pronunciation of stuff like acronyms, eg "VGA": "V.G.A."

You can see a usage example of the project here:
<TODO: ADD VIDEO>

