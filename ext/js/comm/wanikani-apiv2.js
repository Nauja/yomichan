/*
 * Copyright (C) 2016-2022  Yomichan Authors
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
 * AnkiUtil
 */

class WaniKaniAPIV2 {
    constructor() {
        this._enabled = false;
        this._localVersion = 2;
        this._remoteVersion = 0;
        this._versionCheckPromise = null;
        this._apiKey = null;
    }

    get enabled() {
        return this._enabled;
    }

    set enabled(value) {
        this._enabled = value;
    }

    get apiKey() {
        return this._apiKey;
    }

    set apiKey(value) {
        this._apiKey = value;
    }

    async isConnected() {
        try {
            return this._apiKey !== null;
        } catch (e) {
            return false;
        }
    }

    async getSubjects(params) {
        if (!this._enabled) { return null; }
        return await this._invoke('subjects', params);
    }

    async getURL(action) {
        if (!this._enabled) { return null; }
        return await this._invoke(action, {});
    }

    // Private

    async _invoke(action, params) {
        const body = {params, version: this._localVersion};
        if (!action.startsWith('https://')) {
            action = `https://api.wanikani.com/v2/${action}?` + new URLSearchParams(params);
        }
        let response;
        try {
            response = await fetch(action, {
                method: 'GET',
                mode: 'cors',
                cache: 'default',
                credentials: 'omit',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this._apiKey}`
                },
                redirect: 'follow',
                referrerPolicy: 'no-referrer'
            });
        } catch (e) {
            const error = new Error('WaniKani connection failure');
            error.data = {action, params, originalError: e};
            throw error;
        }

        if (!response.ok) {
            const error = new Error(`WaniKani connection error: ${response.status}`);
            error.data = {action, params, status: response.status};
            throw error;
        }

        let responseText = null;
        let result;
        try {
            responseText = await response.text();
            result = JSON.parse(responseText);
        } catch (e) {
            const error = new Error('Invalid WaniKani response');
            error.data = {action, params, status: response.status, responseText, originalError: e};
            throw error;
        }

        if (isObject(result)) {
            const apiError = result.error;
            if (typeof apiError !== 'undefined') {
                const error = new Error(`WaniKani error: ${apiError}`);
                error.data = {action, params, status: response.status, apiError};
                throw error;
            }
        }

        return result;
    }
}
