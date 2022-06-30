/*
 * Copyright (C) 2019-2022  Yomichan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/* global
 * WaniKaniAPIV2
 * AnkiUtil
 * ObjectPropertyAccessor
 * SelectorObserver
 */

class WaniKaniController {
    constructor(settingsController, dictionaryImportController) {
        this._settingsController = settingsController;
        this._dictionaryImportController = dictionaryImportController;
        this._waniKaniAPI = new WaniKaniAPIV2();
        this._stringComparer = new Intl.Collator(); // Locale does not matter
        this._getAnkiDataPromise = null;
        this._ankiErrorContainer = null;
        this._ankiErrorMessageNode = null;
        this._ankiErrorMessageNodeDefaultContent = '';
        this._ankiErrorMessageDetailsNode = null;
        this._ankiErrorMessageDetailsContainer = null;
        this._waniKaniErrorMessageDetailsToggle = null;
        this._ankiErrorInvalidResponseInfo = null;
        this._ankiCardPrimary = null;
        this._waniKaniError = null;
        this._validateFieldsToken = null;
    }

    get settingsController() {
        return this._settingsController;
    }

    async prepare() {
        this._waniKaniErrorMessageDetailsToggle = document.querySelector('#wanikani-error-message-details-toggle');
        this._waniKaniEnableCheckbox = document.querySelector('[data-setting="waniKani.enable"]');
        const waniKaniApiKeyInput = document.querySelector('#wanikani-api-key-input');

        this._waniKaniErrorMessageDetailsToggle.addEventListener('click', this._onWaniKaniErrorMessageDetailsToggleClick.bind(this), false);
        if (this._waniKaniEnableCheckbox !== null) { this._waniKaniEnableCheckbox.addEventListener('settingChanged', this._onWaniKaniEnableChanged.bind(this), false); }

        document.querySelector('#wanikani-import').addEventListener('click', this._onWaniKaniImportButtonClick.bind(this), false);
        document.querySelector('#wanikani-error-log').addEventListener('click', this._onWaniKaniErrorLogLinkClick.bind(this));

        waniKaniApiKeyInput.addEventListener('focus', this._onApiKeyInputFocus.bind(this));
        waniKaniApiKeyInput.addEventListener('blur', this._onApiKeyInputBlur.bind(this));

        const onWaniKaniSettingChanged = () => { this._updateOptions(); };
        const nodes = [waniKaniApiKeyInput, ...document.querySelectorAll('[data-setting="waniKani.enable"]')];
        for (const node of nodes) {
            node.addEventListener('settingChanged', onWaniKaniSettingChanged);
        }

        await this._updateOptions();
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));
    }

    getFieldMarkers(type) {
        switch (type) {
            case 'terms':
                return [
                    'audio',
                    'clipboard-image',
                    'clipboard-text',
                    'cloze-body',
                    'cloze-prefix',
                    'cloze-suffix',
                    'conjugation',
                    'dictionary',
                    'document-title',
                    'expression',
                    'frequencies',
                    'furigana',
                    'furigana-plain',
                    'glossary',
                    'glossary-brief',
                    'glossary-no-dictionary',
                    'part-of-speech',
                    'pitch-accents',
                    'pitch-accent-graphs',
                    'pitch-accent-positions',
                    'reading',
                    'screenshot',
                    'search-query',
                    'selection-text',
                    'sentence',
                    'sentence-furigana',
                    'tags',
                    'url'
                ];
            case 'kanji':
                return [
                    'character',
                    'clipboard-image',
                    'clipboard-text',
                    'cloze-body',
                    'cloze-prefix',
                    'cloze-suffix',
                    'dictionary',
                    'document-title',
                    'glossary',
                    'kunyomi',
                    'onyomi',
                    'screenshot',
                    'search-query',
                    'selection-text',
                    'sentence-furigana',
                    'sentence',
                    'stroke-count',
                    'tags',
                    'url'
                ];
            default:
                return [];
        }
    }

    async getAnkiData() {
        let promise = this._getAnkiDataPromise;
        if (promise === null) {
            promise = this._getAnkiData();
            this._getAnkiDataPromise = promise;
            promise.finally(() => { this._getAnkiDataPromise = null; });
        }
        return promise;
    }

    async getModelFieldNames(model) {
        return await this._ankiConnect.getModelFieldNames(model);
    }

    getRequiredPermissions(fieldValue) {
        return this._settingsController.permissionsUtil.getRequiredPermissionsForAnkiFieldValue(fieldValue);
    }

    // Private

    async _updateOptions() {
        const options = await this._settingsController.getOptions();
        this._onOptionsChanged({options});
    }

    async _onOptionsChanged({options: {waniKani}}) {
        let {apiKey} = waniKani;
        if (apiKey === '') { apiKey = null; }
        this._waniKaniAPI.enabled = waniKani.enable;
        this._waniKaniAPI.apiKey = apiKey;
    }

    _onWaniKaniErrorMessageDetailsToggleClick() {
        const node = this._ankiErrorMessageDetailsContainer;
        node.hidden = !node.hidden;
    }

    _onWaniKaniEnableChanged({detail: {value}}) {
        if (this._waniKaniAPI.apiKey === null) { return; }
        this._waniKaniAPI.enabled = value;
    }

    _onAnkiCardPrimaryTypeRadioChange(e) {
        const node = e.currentTarget;
        if (!node.checked) { return; }

        this._setAnkiCardPrimaryType(node.dataset.value, node.dataset.ankiCardMenu);
    }

    async _onWaniKaniImportButtonClick() {
        if (!this._waniKaniAPI.enabled) { return; }
        const showDictionariesButton = document.querySelector('[data-modal-action="show,dictionaries"]');
        if (showDictionariesButton === null) { return; }

        const onProgress = (data) => {
            console.log(data);
        };
        
        const result = await new DictionaryWorker().loadWaniKaniDictionary(this._waniKaniAPI.apiKey, {}, onProgress);
        showDictionariesButton.click();
        await this._dictionaryImportController.importDictionaries([{input: result, type: 'archive'}]);
    }

    _onWaniKaniErrorLogLinkClick() {
        if (this._waniKaniError === null) { return; }
        console.log({error: this._waniKaniError});
    }

    _onTestAnkiNoteViewerButtonClick(e) {
        this._testAnkiNoteViewerSafe(e.currentTarget.dataset.mode);
    }

    _onApiKeyInputFocus(e) {
        e.currentTarget.type = 'text';
    }

    _onApiKeyInputBlur(e) {
        e.currentTarget.type = 'password';
    }

    _setAnkiCardPrimaryType(ankiCardType, ankiCardMenu) {
        if (this._ankiCardPrimary === null) { return; }
        this._ankiCardPrimary.dataset.ankiCardType = ankiCardType;
        if (typeof ankiCardMenu !== 'undefined') {
            this._ankiCardPrimary.dataset.ankiCardMenu = ankiCardMenu;
        } else {
            delete this._ankiCardPrimary.dataset.ankiCardMenu;
        }
    }

    async _getAnkiData() {
        this._setAnkiStatusChanging();
        const [
            [deckNames, error1],
            [modelNames, error2]
        ] = await Promise.all([
            this._getDeckNames(),
            this._getModelNames()
        ]);

        if (error1 !== null) {
            this._showAnkiError(error1);
        } else if (error2 !== null) {
            this._showAnkiError(error2);
        } else {
            this._hideAnkiError();
        }

        return {deckNames, modelNames};
    }

    async _getDeckNames() {
        try {
            const result = await this._ankiConnect.getDeckNames();
            this._sortStringArray(result);
            return [result, null];
        } catch (e) {
            return [[], e];
        }
    }

    async _getModelNames() {
        try {
            const result = await this._ankiConnect.getModelNames();
            this._sortStringArray(result);
            return [result, null];
        } catch (e) {
            return [[], e];
        }
    }

    _setAnkiStatusChanging() {
        this._ankiErrorMessageNode.textContent = this._ankiErrorMessageNodeDefaultContent;
        this._ankiErrorMessageNode.classList.remove('danger-text');
    }

    _hideAnkiError() {
        if (this._ankiErrorContainer !== null) {
            this._ankiErrorContainer.hidden = true;
        }
        this._ankiErrorMessageDetailsContainer.hidden = true;
        this._ankiErrorMessageDetailsToggle.hidden = true;
        this._ankiErrorInvalidResponseInfo.hidden = true;
        this._ankiErrorMessageNode.textContent = (this._ankiConnect.enabled ? 'Connected' : 'Not enabled');
        this._ankiErrorMessageNode.classList.remove('danger-text');
        this._ankiErrorMessageDetailsNode.textContent = '';
        this._ankiError = null;
    }

    _showAnkiError(error) {
        this._ankiError = error;

        let errorString = typeof error === 'object' && error !== null ? error.message : null;
        if (!errorString) { errorString = `${error}`; }
        if (!/[.!?]$/.test(errorString)) { errorString += '.'; }
        this._ankiErrorMessageNode.textContent = errorString;
        this._ankiErrorMessageNode.classList.add('danger-text');

        const data = error.data;
        let details = '';
        if (typeof data !== 'undefined') {
            details += `${JSON.stringify(data, null, 4)}\n\n`;
        }
        details += `${error.stack}`.trimRight();
        this._ankiErrorMessageDetailsNode.textContent = details;

        if (this._ankiErrorContainer !== null) {
            this._ankiErrorContainer.hidden = false;
        }
        this._ankiErrorMessageDetailsContainer.hidden = true;
        this._ankiErrorInvalidResponseInfo.hidden = (errorString.indexOf('Invalid response') < 0);
        this._ankiErrorMessageDetailsToggle.hidden = false;
    }

    _sortStringArray(array) {
        const stringComparer = this._stringComparer;
        array.sort((a, b) => stringComparer.compare(a, b));
    }

    async _testAnkiNoteViewerSafe(mode) {
        this._setAnkiNoteViewerStatus(false, null);
        try {
            await this._testAnkiNoteViewer(mode);
        } catch (e) {
            this._setAnkiNoteViewerStatus(true, e);
            return;
        }
        this._setAnkiNoteViewerStatus(true, null);
    }

    async _testAnkiNoteViewer(mode) {
        const queries = [
            '"よむ" deck:current',
            '"よむ"',
            'deck:current',
            ''
        ];

        let noteId = null;
        for (const query of queries) {
            const notes = await yomichan.api.findAnkiNotes(query);
            if (notes.length > 0) {
                noteId = notes[0];
                break;
            }
        }

        if (noteId === null) {
            throw new Error('Could not find a note to test with');
        }

        await yomichan.api.noteView(noteId, mode, false);
    }

    _setAnkiNoteViewerStatus(visible, error) {
        const node = document.querySelector('#test-anki-note-viewer-results');
        if (visible) {
            const success = (error === null);
            node.textContent = success ? 'Success!' : error.message;
            node.dataset.success = `${success}`;
        } else {
            node.textContent = '';
            delete node.dataset.success;
        }
        node.hidden = !visible;
    }
}
