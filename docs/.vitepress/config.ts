import { defineConfig } from 'vitepress'

function normalizeBase(raw: string | undefined): string {
  if (!raw || raw === '/') return '/'
  const trimmed = raw.replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}

export default defineConfig({
  title: 'hi-ai',
  description: 'hi-ai 文档 — Harness、算子、Function Calling、Benchmark 与 AI 工程笔记',
  appearance: 'dark',
  base: normalizeBase(process.env.VITEPRESS_BASE),
  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    [
      'link',
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: '',
      },
    ],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600;900&display=swap',
      },
    ],
  ],
  themeConfig: {
    logo: '/mark.svg',
    nav: [
      { text: 'Issue', link: 'https://github.com/Huauauaa/hi-ai/issues' },
    ],
    sidebar: [
      { text: 'Harness', link: '/harness' },
      { text: '算子', link: '/operator' },
      { text: 'Function Calling', link: '/function-calling' },
      { text: '大模型的 Benchmark', link: '/benchmark' },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Huauauaa/hi-ai' },
    ],
  },
})
