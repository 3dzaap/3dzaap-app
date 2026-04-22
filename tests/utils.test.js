import { describe, it, expect } from 'vitest';
import { escH, fmtCurrency } from '../utils.js';

describe('utils.js', () => {
  it('escH should escape HTML characters', () => {
    expect(escH('<div>"Test" & "Check"</div>'))
      .toBe('&lt;div&gt;&quot;Test&quot; &amp; &quot;Check&quot;&lt;/div&gt;');
  });

  it('fmtCurrency should format EUR correctly for pt-PT', () => {
    window.localStorage.setItem('3dzaap_lang', 'pt-PT');
    const result = fmtCurrency(1234.56).replace(/\s/g, ' ');
    expect(result).toContain('1.234,56');
    expect(result).toContain('€');
  });

  it('fmtCurrency should format BRL correctly for pt-BR', () => {
    window.localStorage.setItem('3dzaap_lang', 'pt-BR');
    const result = fmtCurrency(1234.56).replace(/\s/g, ' ');
    expect(result).toContain('1.234,56');
    expect(result).toContain('R$');
  });
});
