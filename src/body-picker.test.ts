/**
 * Regression test for pickBestBody.
 *
 * Some senders ship a degraded text/plain alternative alongside a complete
 * text/html version — the text/plain copy drops content that lives only in
 * HTML. A naive "text || html" picker silently loses that content.
 *
 * Synthetic fixtures below mirror the shape of a real-world failure observed
 * on 2026-05-11 against a transactional account-quota email: text/plain
 * carried two bullets, text/html carried three, the third bullet held the
 * actual actionable number.
 */

import { describe, it, expect } from 'vitest';
import { pickBestBody, htmlToPlaintext } from './utl.js';

// Three-bullet HTML; first two bullets repeated verbatim in text/plain;
// third bullet (the actionable one) lives ONLY in HTML.
const DEGRADED_TEXT_PLAIN = `Hello,

Your account exceeded its plan quota. To avoid restrictions:

- Upgrade your plan to raise the quota.
- Lower your usage in the dashboard.

Best regards,
Acme`;

const COMPLETE_TEXT_HTML = `<html><body>
<p>Hello,</p>
<p>Your account exceeded its plan quota. To avoid restrictions:</p>
<ul>
  <li>Upgrade your plan to raise the quota.</li>
  <li>Lower your usage in the dashboard.</li>
  <li>Reduce your egress bandwidth below 5.5 GB.</li>
</ul>
<p>Best regards,<br>Acme</p>
</body></html>`;

describe('pickBestBody — degraded text/plain alternative', () => {
    it('text/plain is missing the third bullet', () => {
        expect(DEGRADED_TEXT_PLAIN).not.toContain('egress');
    });

    it('text/html contains the third bullet', () => {
        expect(COMPLETE_TEXT_HTML).toContain('Reduce your egress bandwidth below 5.5 GB');
    });

    it('returns the html rendering when both alternatives exist', () => {
        const { body, source } = pickBestBody(DEGRADED_TEXT_PLAIN, COMPLETE_TEXT_HTML);
        expect(source).toBe('html');
        expect(body).toContain('Reduce your egress bandwidth below 5.5 GB');
    });

    it('returned body still contains the bullets that text/plain had', () => {
        const { body } = pickBestBody(DEGRADED_TEXT_PLAIN, COMPLETE_TEXT_HTML);
        expect(body).toContain('Upgrade your plan');
        expect(body).toContain('Lower your usage');
    });
});

describe('pickBestBody — fallbacks', () => {
    it('uses text when html is empty', () => {
        const { body, source } = pickBestBody('plain only', '');
        expect(source).toBe('text');
        expect(body).toBe('plain only');
    });

    it('returns empty when both are missing', () => {
        const { body, source } = pickBestBody('', '');
        expect(source).toBe('none');
        expect(body).toBe('');
    });

    it('renders html when text is empty', () => {
        const { body, source } = pickBestBody('', '<p>hello <b>world</b></p>');
        expect(source).toBe('html');
        expect(body).toContain('hello');
        expect(body).toContain('world');
    });
});

describe('htmlToPlaintext', () => {
    it('strips tags and decodes entities', () => {
        expect(htmlToPlaintext('<p>a&nbsp;&amp;&nbsp;b</p>')).toContain('a & b');
    });

    it('drops script and style content', () => {
        const out = htmlToPlaintext('<style>.x{}</style><p>visible</p><script>x</script>');
        expect(out).not.toContain('.x{}');
        expect(out).not.toContain('script');
        expect(out).toContain('visible');
    });

    it('normalizes CRLF and trims trailing whitespace per line', () => {
        const out = htmlToPlaintext('<p>line1   \r\n</p><p>line2</p>');
        expect(out).not.toContain('\r');
        expect(out).not.toMatch(/ \n/);
    });
});
