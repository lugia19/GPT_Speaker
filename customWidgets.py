from typing import List

import keyring
from PyQt6 import QtWidgets, QtCore, QtGui
from elevenlabslib import User, Voice

import helper

class CenteredLabel(QtWidgets.QLabel):
    def __init__(self, text=None, wordWrap=False):
        super(CenteredLabel, self).__init__(text)
        self.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        self.setWordWrap(wordWrap)


class InfoButton(QtWidgets.QPushButton):

    def __init__(self, info, parentLabel, isDir=False):
        super().__init__()
        new_text = info
        self.info = new_text
        self.setText("")
        self.setAccessibleName(f"Info for {parentLabel}")
        self.setAccessibleDescription("Opens a messagebox with information.")
        #self.setStyleSheet("background-color: transparent;")

        size_policy = QtWidgets.QSizePolicy(QtWidgets.QSizePolicy.Policy.Fixed, QtWidgets.QSizePolicy.Policy.Fixed)
        size_policy.setHorizontalStretch(0)
        size_policy.setVerticalStretch(0)
        size_policy.setHeightForWidth(self.sizePolicy().hasHeightForWidth())
        self.setSizePolicy(size_policy)

        self.setMaximumWidth(25)  # adjust width as needed
        if isDir:
            self.setIcon(self.style().standardIcon(QtWidgets.QStyle.StandardPixmap.SP_DirHomeIcon))
        else:
            self.setIcon(self.style().standardIcon(QtWidgets.QStyle.StandardPixmap.SP_MessageBoxInformation))
            self.clicked.connect(self.show_info)

    def show_info(self):
        msgBox = QtWidgets.QMessageBox()
        msgBox.setIcon(QtWidgets.QMessageBox.Icon.Information)
        msgBox.setWindowTitle("Info")
        msgBox.setTextFormat(QtCore.Qt.TextFormat.RichText)
        msgBox.setText(self.info)
        msgBox.exec()

class LabeledInput(QtWidgets.QWidget):
    """
    This widget has a label and below it an input.
    Arguments:
        label: The text to put above the input
        configKey: The corresponding configKey to pull the default value from and save the user-selected value to
        data: The options to choose from. If it's a string, the input will be a lineEdit, if it's a list, it will be a comboBox.
        info: If it's not None, then an 'info' button will be created which will show the text contained in this argument in a messageBox when clicked.
        infoIsDir: Replaces the info button with a directory button, which opens a file browser.
        protected: Saves the config data to the system keyring instead of the 'settings' dict.
    """
    def __init__(self, label, configKey=None, data=None, info=None, infoIsDir=False, protected=False, comboboxMinimumSize=30,
                 lineEditFixedWidth=None, lineEditMinimumSize=40):
        super().__init__()
        if configKey is not None:
            self.configKey = configKey
        self.layout = QtWidgets.QVBoxLayout(self)
        self.label = CenteredLabel(label)
        self.layout.addWidget(self.label, alignment=QtCore.Qt.AlignmentFlag.AlignCenter)
        self.protected = protected
        self.line_edit = None
        self.combo_box = None

        self.input_widget = QtWidgets.QWidget()
        self.input_layout = QtWidgets.QHBoxLayout(self.input_widget)
        self.input_layout.setSpacing(10)  # adjust the space between widgets

        if isinstance(data, list):
            self.combo_box = QtWidgets.QComboBox()
            self.combo_box.setAccessibleName(f"{label} combobox")
            if comboboxMinimumSize is not None:
                self.combo_box.setMinimumContentsLength(comboboxMinimumSize)
                self.combo_box.setSizeAdjustPolicy(self.combo_box.SizeAdjustPolicy.AdjustToMinimumContentsLengthWithIcon)

            for item in data:
                if isinstance(item, str):
                    item = helper.ComboBoxItem(item, item)
                self.combo_box.addItem(item.label, item.value)

            self.input_layout.addWidget(self.combo_box)
        else:
            self.line_edit = QtWidgets.QLineEdit()
            self.line_edit.setAccessibleName(f"{label} text input")
            if data is not None:
                self.line_edit.setText(str(data))
            if protected:
                self.line_edit.setEchoMode(QtWidgets.QLineEdit.EchoMode.PasswordEchoOnEdit)
            if lineEditMinimumSize is not None:
                fm = QtGui.QFontMetrics(self.line_edit.font())
                # Compute the width of 'n' (fixedLineEditSize) 'X' characters (or any other character you want)
                width = fm.horizontalAdvance('X' * lineEditMinimumSize)
                self.line_edit.setMinimumWidth(width)

            if lineEditFixedWidth is not None:
                fm = QtGui.QFontMetrics(self.line_edit.font())
                # Compute the width of 'n' (fixedLineEditSize) 'X' characters (or any other character you want)
                width = fm.horizontalAdvance('X' * lineEditFixedWidth)
                self.line_edit.setMinimumWidth(width)
                self.line_edit.setMaximumWidth(width)

            self.input_layout.addWidget(self.line_edit)

        currentValue = None
        if configKey is not None:
            currentValue = keyring.get_password("gpt_speaker", configKey)

        if currentValue is not None:
            if isinstance(data, list):
                allItems = [self.combo_box.itemData(i) for i in range(self.combo_box.count())]
                if currentValue in allItems:
                    self.combo_box.setCurrentIndex(allItems.index(currentValue))
                else:
                    self.combo_box.setCurrentIndex(0)
            else:
                self.line_edit.setText(str(currentValue))

        self.layout.addWidget(self.input_widget, alignment=QtCore.Qt.AlignmentFlag.AlignCenter)

        if info is not None:
            self.info_button = InfoButton(info, label, infoIsDir)
            #self.input_layout.addWidget(self.info_button, alignment=QtCore.Qt.AlignmentFlag.AlignLeft)
            self.input_layout.addWidget(self.info_button)
            if infoIsDir:
                self.info_button.clicked.connect(self.select_file)

    def select_file(self):
        self.line_edit.setText(str(QtWidgets.QFileDialog.getExistingDirectory(self, "Select Directory")))

    def get_text(self):
        if self.line_edit is not None:
            return self.line_edit.text()
        else:
            return self.combo_box.currentText()

    def get_value(self):
        if self.line_edit is not None:
            return self.line_edit.text()
        else:
            return self.combo_box.currentData()

def gen_voice_picker(label, user:User, info=None, voiceList:List[Voice] = None, includeNone = False):
    voiceList = voiceList
    data = helper.get_list_of_voice_texts(user, voiceList)
    if includeNone:
        data.insert(0, helper.ComboBoxItem(None, "None"))
    voice_picker = LabeledInput(
        label,
        data=data,
        info=info
    )
    return voice_picker

