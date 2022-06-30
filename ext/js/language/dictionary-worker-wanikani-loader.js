/*
 * Copyright (C) 2021-2022  Yomichan Authors
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

/**
 * Class used for loading the WaniKani dictionary.
 */
class DictionaryWorkerWaniKaniLoader {
    /**
     * Creates a new instance of the WaniKani loader.
     */
    constructor() {
    }

    /**
     * Attempts to load an image using an ArrayBuffer and a media type to return details about it.
     * @param {ArrayBuffer} content The binary content for the image, encoded as an ArrayBuffer.
     * @param {string} mediaType The media type for the image content.
     * @returns {Promise<{content: ArrayBuffer, width: number, height: number}>} Details about the requested image content.
     * @throws {Error} An error can be thrown if the image fails to load.
     */
    async loadDictionary(apiKey, onProgress) {
        const zip = new JSZip();
        zip.file('index.json', '{"title":"WaniKani","format":3,"revision":"wanikani1","sequenced":false}');
        await this._fetchSubjects(apiKey, ['kanji'], (data, bank, index, total) => {
            const kanjis = data.filter(_ => this._isValidKanji(_));
            const vocabs = data.filter(_ => this._isValidVocabulary(_));
            if (kanjis) {
                zip.file(`kanji_bank_${bank}.json`, JSON.stringify(kanjis.map(_ => this._convertKanji(_.data))));
            }
            if (vocabs) {
                zip.file(`term_bank_${bank}.json`, JSON.stringify(vocabs.map(_ => this._convertVocabulary(_.data))));
            }
        });
        return await zip.generateAsync({type: 'arraybuffer'});
    }

    _isValidKanji(data) {
        return data.object === 'kanji' && data.data.meanings.length > 0;
    }

    _isValidVocabulary(data) {
        return data.object === 'vocabulary' && data.data.meanings.length > 0;
    }

    _convertKanji(data) {
        return [
            data.slug,
            "",
            "",
            "",
            data.meanings.map(_ => _.meaning),
            {

            }
        ];
    }

    _convertVocabulary(data) {
        return [
            data.slug,
            "",
            "",
            "",
            data.meanings.map(_ => _.meaning),
            {

            }
        ];
    }

    async _fetchSubjects(apiKey, types, onProgress) {
        const api = new WaniKaniAPIV2();
        api.apiKey = apiKey;
        api.enabled = true;

        // Fetch the first page
        let result = await api.getSubjects({types});
        const total = result.total_count;
        let bank = 0;
        let index = 0;
        while (result !== null) {
            bank++;
            index += result.pages.per_page;
            onProgress(result.data, bank, index, total);

            // Fetch next page if available
            if (result.pages.next_url) {
                result = await api.getURL(result.pages.next_url);
            } else {
                result = null;
            }
        }
    }
}
