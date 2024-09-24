from __future__ import annotations
import os

from typing import Union, Optional, List
from elevenlabslib import User
from elevenlabslib.Voice import Voice


class ComboBoxItem(object):
    def __init__(self, value, label):
        #print(f"New {self.__class__.__name__}. Label:{label} Value:{value}")
        self.value = value
        self.label = label

styleSheetPath = os.path.join("resources","darkmode.qss")

colors_dict = {
    "primary_color":"#1A1D22",
    "secondary_color":"#282C34",
    "hover_color":"#596273",
    "text_color":"#FFFFFF",
    "toggle_color":"#4a708b",
    "green":"#3a7a3a",
    "yellow":"#faf20c",
    "red":"#7a3a3a"
}

def get_stylesheet():
    with open(styleSheetPath, "r", encoding="utf8") as fp:
        styleSheet = fp.read()

    for colorKey, colorValue in colors_dict.items():
        styleSheet = styleSheet.replace("{" + colorKey + "}", colorValue)
    return styleSheet

def get_list_of_voice_texts(user: User | None, voiceList:List[Voice]=None):
    if voiceList is None:
        voiceList = user.get_available_voices()
    if user is None:
        return []
    return [ComboBoxItem(voice.voiceID, f"{voice.name}{f' (PVC)' if voice.category == 'professional' else ''}") for voice in voiceList]
