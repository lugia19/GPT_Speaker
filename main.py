import json
import os
import signal
import sys
import threading
import time
import typing

import requests
from PyQt6 import QtGui
from PyQt6.QtCore import QEvent, QMetaObject, Qt, Q_ARG
from PyQt6.QtGui import QIcon, QFont
from flask import Flask, request, jsonify
import keyring
from PyQt6.QtWidgets import (QApplication, QVBoxLayout, QWidget, QPushButton, QScrollArea, QFrame, QSizePolicy, QHBoxLayout, QLayout, QSystemTrayIcon, QMenu, QDialog, QMainWindow, QLabel)
from elevenlabslib import *

import helper
import openai
from customWidgets import LabeledInput, gen_voice_picker

#Can be customized, but must be changed in the userscript as well
flask_port = 57319

#This file will be used to replace the keys with the value.
#Example: {"Jack":"Jill"} means that any mention of "Jack" will be replaced with "Jill" when it's being spoken.
#Useful to fix pronounciation errors for acronyms and the like.
text_changes_file = "text_changes.json"
logo_path = os.path.join("resources","logo.png")
if os.path.isfile(text_changes_file):
    text_changes = json.load(open(text_changes_file, "r"))
else:
    text_changes = {}
    json.dump(text_changes, open(text_changes_file,"w"))

#This function is run whenever a playback ends. I use it to add a small delay to make it sound more natural.
def playback_end_func():
    time.sleep(0.5)

#For other info, the instructions GPT-3.5 gets mean that it will _only_ synthesize the text present in quotes (more or less).
#If your text is in a different format, you'll have to adjust them accordingly.
#Also, the "Gender" input is to help it tell characters apart when only pronouns are being used.

class AskKeys(QDialog):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("API Keys Input")
        self.main_layout = QVBoxLayout()
        self.elevenlabs_api_key = LabeledInput(label="Elevenlabs API Key", configKey="elevenlabs_api_key", protected=True)
        self.openai_api_key = LabeledInput(label="OpenAI API Key", configKey="openai_api_key", protected=True)
        self.elevenlabs_model = LabeledInput(label="TTS Model", configKey="elevenlabs_model", protected=False, data="eleven_multilingual_v2")
        self.main_layout.addWidget(self.elevenlabs_api_key)
        self.main_layout.addWidget(self.openai_api_key)
        self.main_layout.addWidget(self.elevenlabs_model)

        self.done_button = QPushButton("Done")
        self.done_button.clicked.connect(lambda: self.done(0))
        self.main_layout.addWidget(self.done_button)
        self.setLayout(self.main_layout)
    def closeEvent(self, a0: typing.Optional[QtGui.QCloseEvent]) -> None:
        self.done(-1)

class VoicePickerUI(QMainWindow):
    #Yes, I generated a lot of the UI code with GPT-4 because I'm lazy.
    def __init__(self):
        super().__init__()
        self.setWindowTitle("GPT Speaker")
        self.initUI()

    def initUI(self):
        self.user = elevenlabs_user
        self.voice_list = self.user.get_available_voices()
        self.main_widget = QWidget(self)
        self.main_layout = QVBoxLayout(self.main_widget)
        self.main_layout.setSizeConstraint(QLayout.SizeConstraint.SetNoConstraint)

        self.scroll_area = QScrollArea(self.main_widget)
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

        self.container = QWidget(self.scroll_area)
        self.scroll_area.setWidget(self.container)
        self.container_layout = QVBoxLayout(self.container)
        button_container = QHBoxLayout()
        self.button_add = QPushButton('Add')
        self.button_remove = QPushButton('Remove')
        button_container.addWidget(self.button_add)
        button_container.addWidget(self.button_remove)
        self.button_add.clicked.connect(self.add_voice_picker)
        self.button_remove.clicked.connect(self.remove_widget)

        self.main_layout.addWidget(self.scroll_area)
        self.main_layout.addLayout(button_container)
        self.last_lines = QLabel("")
        self.last_lines.setFont(QFont('Arial', 12))
        self.last_lines.setWordWrap(True)
        self.main_layout.addWidget(self.last_lines)

        self.count = 0
        wrapper_widget = QWidget()
        wrapper_widget.setLayout(self.main_layout)
        self.setCentralWidget(wrapper_widget)


        #System icon setup
        self.trayIcon = QSystemTrayIcon(self)
        self.trayIcon.setIcon(QIcon(logo_path))

        # Create a menu for the tray icon
        trayMenu = QMenu()
        restoreAction = trayMenu.addAction("Restore")
        restoreAction.triggered.connect(self.showNormal)
        exitAction = trayMenu.addAction("Exit")
        exitAction.triggered.connect(self.close)

        self.trayIcon.setContextMenu(trayMenu)
        self.trayIcon.activated.connect(self.onTrayIconActivated)


    def closeEvent(self, event):
        self.trayIcon.hide()
        gui_app.exit(0)

    def changeEvent(self, event):
        if event.type() == QEvent.Type.WindowStateChange:
            if self.isMinimized():
                self.hide()
                self.trayIcon.show()
                event.ignore()

    def onTrayIconActivated(self, reason):
        if reason == QSystemTrayIcon.ActivationReason.DoubleClick:
            self.showNormal()


    def add_voice_picker(self):
        new_container = QHBoxLayout()

        label = "Voice "+str(self.count+1)
        char_name = LabeledInput("Character Name\n(Empty=Voice Name)")
        voice_picker = gen_voice_picker(label, user=self.user, voiceList=self.voice_list, includeNone=True)
        gender_input = LabeledInput("Character Gender", data=["female","male", "other"], comboboxMinimumSize=10)
        new_container.addWidget(char_name)
        new_container.addWidget(voice_picker)
        new_container.addWidget(gender_input)
        self.container_layout.addLayout(new_container)
        self.count += 1
        width = 0
        width += char_name.width()
        width += voice_picker.width()
        width += gender_input.width()

        target_height = int(voice_picker.height()/1.5)
        if self.height() >= target_height:
            target_height = self.height()
        self.resize(int(width/2), target_height)

    def remove_widget(self):
        if self.count > 0:
            layout = self.container_layout.itemAt(self.count - 1)

            # Remove all widgets in the layout
            while layout.count():
                child = layout.takeAt(0)
                child.widget().deleteLater()

            self.container_layout.removeItem(layout)
            self.count -= 1

    def get_voices(self):
        voice_dict = dict()
        for i in range(self.container_layout.count()):
            layout = self.container_layout.itemAt(i)

            # Since the widgets are containers, treat the widgets specially
            if layout.widget() is None:
                voice_input = None
                gender_input = None
                name_input = None
                # Iterate over the widgets within the sub-layout
                for j in range(layout.count()):
                    widget = layout.itemAt(j).widget()

                    if widget.line_edit is not None:
                        name_input = widget
                    else:
                        if widget.combo_box.count() == 3 and widget.combo_box.itemData(0) in ["male","female","other"]:
                            gender_input = widget
                        else:
                            voice_input = widget

                # Now you can operate on the pairs of widgets
                if voice_input is not None and gender_input is not None:
                    char_name = name_input.get_text()
                    if char_name == "":
                        char_name = voice_input.get_text()
                    voice_dict[char_name] = {"gender":gender_input.get_text(),"id":voice_input.get_value()}

        return voice_dict

from flask_cors import CORS
flask_app = Flask(__name__)
CORS(flask_app)
voice_cache = dict()

playback_options = PlaybackOptions(onPlaybackEnd=playback_end_func)
synthesizer = Synthesizer(defaultPlaybackOptions=playback_options)
synthesizer.start()

@flask_app.route('/', methods=['GET'])
def home():
    # Just a simple test to make sure it's working
    return jsonify({"message": "GPT_Speaker (v3) test page"}), 200

@flask_app.route('/stopServer', methods=['GET'])
def stopServer():
    os.kill(os.getpid(), signal.SIGINT)
    return jsonify({ "success": True, "message": "Server is shutting down..." })

@flask_app.route('/generate_extract_audio', methods=['POST'])
def generate_audio():
    # Get the body of text from the request
    if not request.is_json:
        return jsonify({"error": "Invalid request format."}), 400
    text = request.get_json().get("text")

    # Call the openAI API to get the JSON
    voice_dict = ex.get_voices()
    print(voice_dict)
    print(text)
    if len(voice_dict) == 0:
        return jsonify({"message": "Audio generation not run, no voices."}), 200

    messages = list()
    tools = [
        {
            "type": "function",
            "function": {
                "name": "speak",
                    "description": "Speaks the given prompt as a chosen character.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "speech_data": {
                                "type": "array",
                                "items" : {
                                    "type": "object",
                                    "properties": {
                                        "character": {
                                            "type": 'string',
                                            "enum": list(voice_dict.keys()),
                                            "description": 'The name of the character speaking the line.'
                                        },
                                        "text": {
                                            "type": 'string',
                                            "description": 'The line the character should speak.'
                                        }
                                    }
                                }
                            }
                        },
                        "required": ["speech_data"]
                    }
            }
        }
    ]

    messages.append({"role": "system",
                     "content": "Your job is to act as a dialog speaker. You will extract the quoted"
                     "(in quotes) dialog from the provided input and speak it using the provided function."
                     "\nYou must NOT modify the text, only extract the dialog."
                     "\nIf a character does not has an associated voice, ignore it."})
    messages.append({"role": "user", "content": text})
    messages.append({"role": "user", "content": "Please speak the dialog from the previous message."})
    messages[-1]["content"] += f"\nThe characters you can choose from are:\n"

    for character_name, data in voice_dict.items():
        messages[-1]["content"] += f"- '{character_name}' (Gender: {data.get('gender')})\n"

    response = openai_client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=messages,
        tools=tools,
        tool_choice={"type": "function", "function": {"name": "speak"}}
    )

    response_dict = response.choices[0].message.model_dump()

    tool_call = response_dict.get("tool_calls")
    if tool_call is None:
        print("Got back no calls. Exiting.")
        return
    else:
        tool_call = tool_call[0]

    speech_data = json.loads(tool_call.get("function").get("arguments")).get("speech_data")
    print(speech_data)
    lines = speech_data
    all_text = ""
    # Process each character line in the request
    for item in lines:
        character = item.get("character")
        text = item.get("text")


        for key, value in text_changes.items():
            text = text.replace(key, value)
        #We use fuzzy matching to get the most likely voice.
        from fuzzywuzzy import process
        matches = process.extract(character, list(voice_dict.keys()), limit=None)
        most_likely_match = voice_dict[matches[0][0]].get("id")
        cached_voice = voice_cache.get(character)
        print(f"Trying to find voice corresponding to {character}")
        print(cached_voice)
        print(most_likely_match)

        if character not in voice_cache or (cached_voice is None and most_likely_match is not None) or (cached_voice is not None and cached_voice.voiceID != most_likely_match):
            try:
                if most_likely_match is None:
                    raise IndexError
                voice_cache[character] = elevenlabs_user.get_voice_by_ID(most_likely_match)
            except IndexError:
                voice_cache[character] = None

        voice:ElevenLabsVoice = voice_cache[character]
        all_text += f"{character}: {text}\n\n"
        if voice is not None:
            print(f"Character: {character}, Voice: {voice.name if voice is not None else ''}, Text: {text}")
            synthesizer.add_to_queue(voice, text, generation_options)
        else:
            print(f"Voice not found, skipping text '{text}'")
    all_text = all_text.strip()
    QMetaObject.invokeMethod(ex.last_lines, "setText", Qt.ConnectionType.AutoConnection, Q_ARG(str, all_text))
    # Return a success response
    return jsonify({"message": "Audio generation successful."}), 200


if __name__ == '__main__':
    if os.name == "nt":
        import ctypes
        myappid = u'lugia19.GPT_Speakerv3'
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
    gui_app = QApplication(sys.argv)
    gui_app.setWindowIcon(QIcon(logo_path))
    gui_app.setStyleSheet(helper.get_stylesheet())
    while True:
        keys = AskKeys()
        return_code = keys.exec()
        if return_code != 0:
            os._exit(1) #Please just explode.

        openai_api_key = keys.openai_api_key.get_value()
        elevenlabs_api_key = keys.elevenlabs_api_key.get_value()
        elevenlabs_model = keys.elevenlabs_model.get_value()
        try:
            openai_client = openai.Client(api_key=openai_api_key)
            elevenlabs_user = ElevenLabsUser(elevenlabs_api_key)
            break
        except (openai.AuthenticationError,ValueError):
            print("API key error!")
            pass

    keyring.set_password("gpt_speaker", "elevenlabs_api_key", elevenlabs_api_key)
    keyring.set_password("gpt_speaker", "openai_api_key", openai_api_key)
    keyring.set_password("gpt_speaker", "elevenlabs_model", elevenlabs_model)

    generation_options = GenerationOptions(model_id=elevenlabs_model, latencyOptimizationLevel=1)

    ex = VoicePickerUI()
    ex.trayIcon.show()
    flask_thread = threading.Thread(target=flask_app.run, kwargs={'host':'127.0.0.1', 'port':flask_port})
    flask_thread.start()


    ex.show()
    gui_app.exec()

    requests.get(f"http://localhost:{flask_port}/stopServer")   #Kill the flask server
    flask_thread.join()
