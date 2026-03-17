import * as assert from 'assert';
import { collectIssues } from '../helpers';
import { checkFormLabel } from '../../scanner/rules/formLabel';

describe('form-label rule', () => {
  it('flags <input /> without label', () => {
    const issues = collectIssues('<input />', checkFormLabel);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].rule, 'form-label');
    assert.strictEqual(issues[0].severity, 'warning');
  });

  it('passes <input> with aria-label', () => {
    const issues = collectIssues('<input aria-label="Name" />', checkFormLabel);
    assert.strictEqual(issues.length, 0);
  });

  it('passes <input> with aria-labelledby', () => {
    const issues = collectIssues('<input aria-labelledby="name-label" />', checkFormLabel);
    assert.strictEqual(issues.length, 0);
  });

  it('emits hint for <input> with id but no explicit label', () => {
    const issues = collectIssues('<input id="name-field" />', checkFormLabel);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].severity, 'hint');
    assert.ok(issues[0].message.includes('id'));
  });

  it('skips <input type="hidden" />', () => {
    const issues = collectIssues('<input type="hidden" />', checkFormLabel);
    assert.strictEqual(issues.length, 0);
  });

  it('flags <select /> without label', () => {
    const issues = collectIssues('<select />', checkFormLabel);
    assert.strictEqual(issues.length, 1);
  });

  it('flags <textarea /> without label', () => {
    const issues = collectIssues('<textarea />', checkFormLabel);
    assert.strictEqual(issues.length, 1);
  });

  it('flags <TextField /> (MUI) without label', () => {
    const issues = collectIssues('<TextField />', checkFormLabel);
    assert.strictEqual(issues.length, 1);
  });

  it('passes <TextField label="Name" />', () => {
    const issues = collectIssues('<TextField label="Name" />', checkFormLabel);
    assert.strictEqual(issues.length, 0);
  });

  it('ignores non-form elements', () => {
    const issues = collectIssues('<div>hello</div>', checkFormLabel);
    assert.strictEqual(issues.length, 0);
  });
});
