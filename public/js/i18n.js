(function() {
  var STORAGE_KEY = 'yt-language';
  var SUPPORTED = ['zh-TW', 'en'];
  var dictionaries = {};
  var currentLanguage = 'zh-TW';

  function normalizeLanguage(language) {
    if (!language) return 'zh-TW';
    if (SUPPORTED.indexOf(language) !== -1) return language;
    if (String(language).toLowerCase().indexOf('en') === 0) return 'en';
    return 'zh-TW';
  }

  function interpolate(template, vars) {
    if (!vars) return template;
    return String(template).replace(/\{(\w+)\}/g, function(_, key) {
      return vars[key] === undefined || vars[key] === null ? '' : String(vars[key]);
    });
  }

  async function loadDictionary(language) {
    var normalized = normalizeLanguage(language);
    if (dictionaries[normalized]) return dictionaries[normalized];

    try {
      var response = await fetch('/i18n/' + normalized + '.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Failed to load dictionary');
      dictionaries[normalized] = await response.json();
    } catch (_) {
      dictionaries[normalized] = {};
    }

    return dictionaries[normalized];
  }

  function lookup(key) {
    var languageDict = dictionaries[currentLanguage] || {};
    if (Object.prototype.hasOwnProperty.call(languageDict, key)) return languageDict[key];

    var fallbackDict = dictionaries['zh-TW'] || {};
    if (Object.prototype.hasOwnProperty.call(fallbackDict, key)) return fallbackDict[key];

    return key;
  }

  function shouldSkipNode(node) {
    if (!node || !node.parentElement) return true;
    if (node.parentElement.closest('[data-i18n-skip="true"]')) return true;
    return ['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE'].indexOf(node.parentElement.tagName) !== -1;
  }

  function translateTextNode(node) {
    if (shouldSkipNode(node)) return;
    var raw = node.textContent;
    var trimmed = raw.trim();
    if (!trimmed) return;

    var translated = lookup(trimmed);
    if (translated === trimmed) return;

    node.textContent = raw.replace(trimmed, translated);
  }

  function translateAttribute(element, attrName) {
    var value = element.getAttribute(attrName);
    if (!value) return;

    var translated = lookup(value);
    if (translated !== value) {
      element.setAttribute(attrName, translated);
    }
  }

  function translatePage(root) {
    var scope = root || document.body;
    if (!scope) return;

    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      translateTextNode(node);
    }

    scope.querySelectorAll('[placeholder],[title],[aria-label]').forEach(function(element) {
      translateAttribute(element, 'placeholder');
      translateAttribute(element, 'title');
      translateAttribute(element, 'aria-label');
    });
  }

  function updateLanguageToggle() {
    var button = document.getElementById('language-toggle');
    if (!button) return;

    button.textContent = currentLanguage === 'zh-TW' ? 'EN' : '繁中';
    button.setAttribute(
      'aria-label',
      window.i18n('Switch language to {language}', {
        language: currentLanguage === 'zh-TW' ? window.i18n('English') : window.i18n('Traditional Chinese')
      })
    );
    button.setAttribute(
      'title',
      window.i18n('Current language: {language}', {
        language: currentLanguage === 'zh-TW' ? window.i18n('Traditional Chinese') : window.i18n('English')
      })
    );
  }

  window.i18n = function(key, vars) {
    return interpolate(lookup(key), vars);
  };

  window.getCurrentLanguage = function() {
    return currentLanguage;
  };

  window.translatePage = translatePage;

  window.setLanguage = async function(language) {
    var normalized = normalizeLanguage(language);
    await Promise.all([loadDictionary('zh-TW'), loadDictionary(normalized)]);

    currentLanguage = normalized;

    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch (_) {}

    document.documentElement.lang = normalized;
    translatePage();
    updateLanguageToggle();
    if (typeof window.updateThemeToggle === 'function') {
      window.updateThemeToggle(document.documentElement.getAttribute('data-theme') || 'dark');
    }
    window.dispatchEvent(new CustomEvent('app:languagechange', {
      detail: { language: normalized }
    }));
  };

  document.addEventListener('DOMContentLoaded', function() {
    var toggle = document.getElementById('language-toggle');
    if (toggle) {
      toggle.addEventListener('click', function() {
        window.setLanguage(currentLanguage === 'zh-TW' ? 'en' : 'zh-TW');
      });
    }

    var preferred = 'zh-TW';
    try {
      preferred = normalizeLanguage(localStorage.getItem(STORAGE_KEY) || navigator.language);
    } catch (_) {}

    window.setLanguage(preferred);
  });
})();
