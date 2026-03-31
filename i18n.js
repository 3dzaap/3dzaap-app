/**
 * 3DZAAP i18n Engine (Vanilla JS)
 * Handles language switching, translation loading, and DOM updates.
 */

const i18n = {
    currentLocale: localStorage.getItem('3dzaap_lang') || 'pt-PT',
    translations: {},
    supportedLocales: ['pt-PT', 'pt-BR', 'en', 'es', 'en-GB'],

    async init() {
        // Fallback for old 'pt' or 'br' codes
        if (this.currentLocale === 'pt') this.currentLocale = 'pt-PT';
        if (this.currentLocale === 'br') this.currentLocale = 'pt-BR';
        
        await this.loadTranslations(this.currentLocale);
        this.translatePage();
        this.updateLanguageSwitcherUI();
    },

    async loadTranslations(locale) {
        try {
            const response = await fetch(`./locales/${locale}.json`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.translations = await response.json();
            this.currentLocale = locale;
            localStorage.setItem('3dzaap_lang', locale);
            document.documentElement.lang = locale;
        } catch (error) {
            console.error(`Failed to load translations for ${locale}:`, error);
        }
    },

    translatePage() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.getNestedTranslation(key);
            if (translation) {
                // If it's an input or textarea, update both placeholder and value if needed
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (el.placeholder) el.placeholder = translation;
                } else if (el.tagName === 'SELECT') {
                   // Skip direct select translation unless needed
                } else {
                    el.innerHTML = translation;
                }
            }
        });

        document.body.classList.remove(...this.supportedLocales.map(l => `lang-${l}`));
        document.body.classList.add(`lang-${this.currentLocale}`);
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { locale: this.currentLocale } }));
    },

    getNestedTranslation(key) {
        if (!key) return null;
        return key.split('.').reduce((obj, i) => (obj ? obj[i] : null), this.translations);
    },

    async setLanguage(locale) {
        if (!this.supportedLocales.includes(locale)) {
            console.warn(`Locale ${locale} not supported`);
            return;
        }
        
        // Save the new locale and reload the page to ensure all JS-rendered
        // modules perfectly catch the new locale translations
        localStorage.setItem('3dzaap_lang', locale);
        window.location.reload();
    },

    async switchLanguage(locale) {
        return this.setLanguage(locale);
    },

    updateLanguageSwitcherUI() {
        const switchers = document.querySelectorAll('.lang-select, .lang-select-mini, #sidebarLangSelect');
        switchers.forEach(s => {
            s.value = this.currentLocale;
        });
    }
};

document.addEventListener('DOMContentLoaded', () => i18n.init());
window.i18n = i18n;
