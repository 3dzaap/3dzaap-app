/**
 * 3DZAAP i18n Engine (Vanilla JS)
 * Handles language switching, translation loading, and DOM updates.
 */

const i18n = {
    currentLocale: localStorage.getItem('3dzaap_lang') || 'pt',
    translations: {},
    supportedLocales: ['pt', 'br', 'en', 'es'],

    async init() {
        await this.loadTranslations(this.currentLocale);
        this.translatePage();
        this.updateLanguageSwitcherUI();
    },

    async loadTranslations(locale) {
        try {
            const response = await fetch(`./locales/${locale}.json`);
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
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (el.placeholder) el.placeholder = translation;
                } else {
                    el.innerHTML = translation;
                }
            }
        });

        // Update body class for regional styling if needed
        document.body.classList.remove(...this.supportedLocales.map(l => `lang-${l}`));
        document.body.classList.add(`lang-${this.currentLocale}`);

        // Dispatch event for components that need to react
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { locale: this.currentLocale } }));
    },

    getNestedTranslation(key) {
        return key.split('.').reduce((obj, i) => (obj ? obj[i] : null), this.translations);
    },

    async switchLanguage(locale) {
        if (!this.supportedLocales.includes(locale)) return;
        await this.loadTranslations(locale);
        this.translatePage();
        this.updateLanguageSwitcherUI();
    },

    updateLanguageSwitcherUI() {
        const switchers = document.querySelectorAll('.lang-select');
        switchers.forEach(s => {
            s.value = this.currentLocale;
        });
    }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => i18n.init());

window.i18n = i18n;
