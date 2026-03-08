import { defineConfig } from 'dumi';
import path from 'path';

export default defineConfig({
  base: '/flow-orchestrator/',
  publicPath: '/flow-orchestrator/',
  outputPath: 'docs-dist',
  alias: {
    '@lichenbuliren/flow-orchestrator': path.resolve(__dirname, 'src/index.ts'),
  },
  themeConfig: {
    name: 'flow-orchestrator',
    nav: [
      { title: '指南', link: '/guide/quick-start' },
      { title: '演示', link: '/demos/basic-flow' },
      { title: 'API', link: '/api' },
    ],
    sidebar: {
      '/guide': [
        {
          title: '基础',
          children: [
            { title: '快速开始', link: '/guide/quick-start' },
            { title: '核心概念', link: '/guide/concepts' },
          ],
        },
        {
          title: '进阶',
          children: [
            { title: '多流程管理', link: '/guide/multi-flow' },
            { title: 'React Native 集成', link: '/guide/react-native' },
            { title: '跨平台扩展', link: '/guide/cross-platform' },
          ],
        },
      ],
    },
  },
});
