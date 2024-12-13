import { parseCode, parseJson } from '../parse_utils';

describe('parseCode', () => {
  it('should extract code from markdown code block', () => {
    const input = '```js\nconst x = 42;\nconsole.log(x);\n```';
    const expected = 'const x = 42;\nconsole.log(x);';
    expect(parseCode(input)).toBe(expected);
  });

  it('should extract code from markdown code block with language specified', () => {
    const input = '```js\ntypescript\nconst x: number = 42;\nconsole.log(x);\n```';
    const expected = 'typescript\nconst x: number = 42;\nconsole.log(x);';
    expect(parseCode(input)).toBe(expected);
  });

  it('should return trimmed input when no code block is present', () => {
    const input = 'const x = 42;\nconsole.log(x);';
    expect(parseCode(input)).toBe(input);
  });

  it('should handle text before and after code block', () => {
    const input = 'Here is some code:\n```\nconst x = 42;\n```\nEnd of code.';
    const expected = 'const x = 42;';
    expect(parseCode(input)).toBe(expected);
  });

  it('should handle empty code block', () => {
    const input = '```\n```';
    expect(parseCode(input)).toBe('');
  });
}); 

describe('parseJson', () => {
  it('should extract and transform JSON from content with surrounding text', () => {
    const input = 'Some text before { "key": "value" } and after';
    const expected = { key: "value" };
    expect(parseJson(input)).toEqual(expected);
  });

  it('should handle nested JSON objects', () => {
    const input = '{"outer": {"inner": "value"}}';
    const expected = { outer: { inner: "value" } };
    expect(parseJson(input)).toEqual(expected);
  });

  it('should handle JSON with arrays', () => {
    const input = 'Result: {"items": [1, 2, 3]}';
    const expected = { items: [1, 2, 3] };
    expect(parseJson(input)).toEqual(expected);
  });

  it('should handle relaxed JSON format', () => {
    const input = `{
      key: 'value',
      numbers: [1, 2, 3,]
    }`;
    const expected = { key: "value", numbers: [1, 2, 3] };
    expect(parseJson(input)).toEqual(expected);
  });
});
