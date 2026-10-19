import { describe, expect, it } from 'vitest'
import { computeStats, replaceCodeBlockInMd, tableToMarkdown } from './markdown-utils'
import { formatCode, minifySql, parseJsonLoose } from './code-format'

describe('computeStats', () => {
  it('统计中英文字数 / 字符数 / 行数', () => {
    const s = computeStats('你好世界\nhello world\n')
    expect(s.lineCount).toBe(3)
    expect(s.wordCount).toBe(6) // 4 CJK + 2 词
    expect(s.characterCount).toBeGreaterThan(0)
  })

  it('代码块不计入字数', () => {
    const withCode = computeStats('```js\nverylongidentifier\n```')
    const empty = computeStats('')
    expect(withCode.wordCount).toBe(empty.wordCount)
  })
})

describe('tableToMarkdown', () => {
  it('转换简单表格', () => {
    const div = document.createElement('div')
    div.innerHTML = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>'
    const md = tableToMarkdown(div.querySelector('table'))
    expect(md).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |')
  })

  it('转义竖线并折叠换行', () => {
    const div = document.createElement('div')
    div.innerHTML = '<table><tr><th>a|b</th></tr><tr><td>x\ny</td></tr></table>'
    const md = tableToMarkdown(div.querySelector('table'))
    expect(md).toContain('a\\|b')
    expect(md).toContain('x y')
  })

  it('空输入返回空串', () => {
    expect(tableToMarkdown(null)).toBe('')
  })
})

describe('replaceCodeBlockInMd', () => {
  const md = 'before\n```mermaid\nA --> B\n```\nmid\n```mermaid\nC --> D\n```\nafter'

  it('按索引替换目标代码块', () => {
    const out = replaceCodeBlockInMd(md, 'mermaid', 1, 'X --> Y')
    expect(out).toContain('X --> Y')
    expect(out).toContain('A --> B')
    expect(out).not.toContain('C --> D')
  })

  it('索引越界时原文返回', () => {
    expect(replaceCodeBlockInMd(md, 'mermaid', 9, 'Z')).toBe(md)
  })

  it('替换尾部空行被规整', () => {
    const out = replaceCodeBlockInMd(md, 'mermaid', 0, 'P  \n\n')
    expect(out).toContain('```mermaid\nP\n```')
  })
})

describe('parseJsonLoose', () => {
  it('解析标准 JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 })
  })

  it('容错：注释与尾逗号', () => {
    expect(parseJsonLoose('{\n// c\n"a": 1,\n}')).toEqual({ a: 1 })
  })

  it('失败返回 undefined', () => {
    expect(parseJsonLoose('nope')).toBeUndefined()
  })
})

describe('minifySql', () => {
  it('压缩空白与注释，保留字符串字面量', () => {
    const out = minifySql("SELECT a, b -- comment\nFROM t\n/* block */ WHERE x = 'a b'")
    expect(out).toBe("SELECT a, b FROM t WHERE x = 'a b'")
  })

  it('不移除必要的括号间距', () => {
    expect(minifySql('INSERT INTO t (a, b) VALUES (1, 2)')).toBe(
      'INSERT INTO t (a, b) VALUES (1, 2)'
    )
  })
})

describe('formatCode', () => {
  it('JSON pretty / minify', async () => {
    expect(await formatCode('json', '{"a":1}', 'pretty')).toBe('{\n  "a": 1\n}')
    expect(await formatCode('json', '{ "a": 1 }', 'minify')).toBe('{"a":1}')
  })

  it('JSON 解析失败返回 null', async () => {
    expect(await formatCode('json', '{bad}', 'pretty')).toBeNull()
  })

  it('SQL minify 不依赖外部库', async () => {
    expect(await formatCode('sql', 'SELECT\n  1', 'minify')).toBe('SELECT 1')
  })
})
