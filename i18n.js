/**
 * 3DZAAP i18n Engine (Vanilla JS)
 * Handles language switching, translation loading, and DOM updates.
 *
 * RULE: The global topbar language selector changes the locale and reloads
 * the page so all JS-rendered content re-renders in the new language.
 * EXCEPTION: settings.html — the language selector there is a PREFERENCE
 * field that the user saves with the Save button. It must NOT trigger a reload.
 */

const i18n = {
    currentLocale: (() => {
        try { return localStorage.getItem('3dzaap_lang') || 'pt-PT'; } 
        catch (e) { return 'pt-PT'; }
    })(),
    translations: {},
    supportedLocales: ['pt-PT', 'pt-BR', 'en-US', 'es', 'en-GB'],

    async init() {
        // Fallback for old 'pt' or 'br' codes
        if (this.currentLocale === 'pt') this.currentLocale = 'pt-PT';
        if (this.currentLocale === 'br') this.currentLocale = 'pt-BR';
        if (this.currentLocale === 'en') this.currentLocale = 'en-US';
        
        await this.loadTranslations(this.currentLocale);
        this.translatePage();
        this.updateLanguageSwitcherUI();
    },

    async loadTranslations(locale) {
        try {
            const response = await fetch(`./locales/${locale}.json`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.translations = await response.json();
            this.currentLocale = locale;
            try { localStorage.setItem('3dzaap_lang', locale); } catch (e) {}
            document.documentElement.lang = locale;
        } catch (error) {
            console.warn(`[i18n] Failed to load ${locale}:`, error.message);
            showToast('<i class="ph-bold ph-x-circle"></i> Erro: ' + error.message, 'err');
        }
    },

    translatePage(root = document) {
        if (!root) return;
        const elements = root.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            let key = el.getAttribute('data-i18n');
            let target = null;
            
            // Support [attr]key syntax
            if (key.startsWith('[')) {
                const match = key.match(/^\[(.+?)\](.+)$/);
                if (match) {
                    target = match[1];
                    key = match[2];
                }
            }

            // Extract variables from data attributes
            let vars = {};
            try {
                const rawVars = el.getAttribute('data-i18n-vars');
                if (rawVars) vars = JSON.parse(rawVars);
                
                // Shortcut for common 'n' variable
                const n = el.getAttribute('data-i18n-n');
                if (n !== null) vars.n = n;
            } catch (e) {
                // Silently fail if vars aren't valid JSON
            }

            const translation = this.getNestedTranslation(key, vars);
            if (translation) {
                if (target) {
                    el.setAttribute(target, translation);
                } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (el.placeholder !== undefined) el.placeholder = translation;
                } else if (el.tagName === 'SELECT') {
                    // Skip selects
                } else {
                    el.innerHTML = translation;
                }
            }
        });

        // Só disparar o evento se for Tradução Completa de Documento para evitar recursion Loops no orders.html
        if (root === document) {
            document.body.classList.remove(...this.supportedLocales.map(l => `lang-${l}`));
            document.body.classList.add(`lang-${this.currentLocale}`);
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { locale: this.currentLocale } }));
        }
    },

    /**
     * Retrieve a nested translation by dot-notation key.
     * @param {string} key   e.g. 'dash.sub_banner.trial_active'
     * @param {object} [vars]  optional map of {placeholder: value} to interpolate
     * @param {string} [defaultVal] optional fallback if key not found
     * @returns {string|null}
     */
    getNestedTranslation(key, vars, defaultVal = null) {
        if (!key) return defaultVal;
        let val = key.split('.').reduce((obj, i) => (obj ? obj[i] : null), this.translations);
        
        // If not found, use defaultVal
        if (val === null || val === undefined) return defaultVal;

        if (vars && typeof vars === 'object') {
            for (const [k, v] of Object.entries(vars)) {
                val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
            }
        }
        return val;
    },

    /**
     * Called by the GLOBAL topbar selector (all pages except settings.html).
     * Saves preference + reloads so JS-rendered content re-renders correctly.
     */
    async setLanguage(locale) {
        if (!this.supportedLocales.includes(locale)) {
            console.warn(`[i18n] Locale ${locale} not supported`);
            return;
        }
        try { localStorage.setItem('3dzaap_lang', locale); } catch (e) {}
        window.location.reload();
    },

    /**
     * Called ONLY from settings.html preference selector.
     * Just updates the UI in-place without reloading (user saves manually).
     */
    async setLanguageSilent(locale) {
        if (!this.supportedLocales.includes(locale)) return;
        this.currentLocale = locale;
        try { localStorage.setItem('3dzaap_lang', locale); } catch (e) {}
        await this.loadTranslations(locale);
        this.translatePage();
        this.updateLanguageSwitcherUI();
    },

    async switchLanguage(locale) {
        return this.setLanguage(locale);
    },

    updateLanguageSwitcherUI() {
        // Sync all global selectors — but NOT the settings preference field
        const switchers = document.querySelectorAll('#topbarLangSelect, .lang-select-mini');
        switchers.forEach(s => { s.value = this.currentLocale; });

        // Sync the topbar theme button icon
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.querySelectorAll('#topbarThemeToggle').forEach(btn => {
            btn.innerHTML = isDark ? '<i class="ph-bold ph-sun"></i>' : '<i class="ph-bold ph-moon"></i>';
        });
    }
};

document.addEventListener('DOMContentLoaded', () => i18n.init());
window.i18n = i18n;
window.t = (key, vars, fallback) => i18n.getNestedTranslation(key, vars, fallback);
