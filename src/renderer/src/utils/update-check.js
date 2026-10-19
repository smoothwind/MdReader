export const REPO_OWNER = 'smoothwind'
export const REPO_NAME = 'MdReader'
export const RELEASES_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=10`
export const RELEASES_PAGE_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`

const TAG_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** 解析 "v0.3.0-beta.1" → { core: [0,3,0], pre: ['beta', 1] }；非法返回 null */
export function parseTag(tag) {
  if (typeof tag !== 'string') return null
  const m = TAG_RE.exec(tag.trim())
  if (!m) return null
  const core = [Number(m[1]), Number(m[2]), Number(m[3])]
  const pre = m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : null
  return { core, pre }
}

function cmpSemverIdents(a, b) {
  // 数字标识符小于字母标识符（semver #11.3、#11.4）
  if (typeof a === 'number' && typeof b === 'number') return a === b ? 0 : a < b ? -1 : 1
  if (typeof a === 'number') return -1
  if (typeof b === 'number') return 1
  return a === b ? 0 : a < b ? -1 : 1
}

/** 严格 semver（含预发布）比较：a > b 返回 1，相等 0，否则 -1；任一侧非法返回 null */
export function compareTags(a, b) {
  const pa = parseTag(a)
  const pb = parseTag(b)
  if (!pa || !pb) return null
  if (pa.core[0] !== pb.core[0]) return pa.core[0] < pb.core[0] ? -1 : 1
  if (pa.core[1] !== pb.core[1]) return pa.core[1] < pb.core[1] ? -1 : 1
  if (pa.core[2] !== pb.core[2]) return pa.core[2] < pb.core[2] ? -1 : 1
  if (!pa.pre && !pb.pre) return 0
  if (!pa.pre) return 1 // 无预发布 > 有预发布
  if (!pb.pre) return -1
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const ia = pa.pre[i]
    const ib = pb.pre[i]
    if (ia === undefined) return -1 // 前缀相等时短序列 < 长序列（#11.4）
    if (ib === undefined) return 1
    const c = cmpSemverIdents(ia, ib)
    if (c) return c
  }
  return 0
}

/** latest 是否比 current 更新（任一侧非法 tag 一律视为不更新） */
export function isNewerTag(current, latest) {
  return compareTags(latest, current) !== null && compareTags(latest, current) > 0
}

/** 拉取最新（非 draft）release：{ tag, url }，网络失败/限流/无数据返回 null */
export async function fetchLatestRelease({ fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    })
    if (!res.ok) return null
    const list = await res.json()
    const rel = Array.isArray(list) ? list.find((r) => r && !r.draft) : null
    if (!rel?.tag_name) return null
    return { tag: rel.tag_name, url: rel.html_url || RELEASES_PAGE_URL }
  } catch {
    return null
  }
}
