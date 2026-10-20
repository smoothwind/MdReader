import { t } from './i18n'

/**
 * 漫游引导步骤（供 @ux/patterns 的 TourGuide 消费）
 * target 为 CSS 选择器；无 target 的步骤整屏暗化居中。
 * 文案随界面语言实时切换（调用方用 computed 包裹）。
 */
export function getTourSteps() {
  return [
    {
      title: t('tour.welcomeTitle'),
      desc: t('tour.welcomeDesc')
    },
    {
      target: '[data-tour="doc-actions"]',
      title: t('tour.docsTitle'),
      desc: t('tour.docsDesc')
    },
    {
      target: '[data-tour="insert-mindmap"]',
      title: t('tour.mindmapTitle'),
      desc: t('tour.mindmapDesc')
    },
    {
      target: '.editor-host',
      title: t('tour.editTitle'),
      desc: t('tour.editDesc')
    },
    {
      target: '[data-tour="settings"]',
      title: t('tour.settingsTitle'),
      desc: t('tour.settingsDesc')
    },
    {
      target: '[data-tour="theme"]',
      title: t('tour.themeTitle'),
      desc: t('tour.themeDesc')
    },
    {
      target: '.toc-panel, .toc-collapsed-btn',
      title: t('tour.tocTitle'),
      desc: t('tour.tocDesc')
    },
    {
      target: '.statusbar',
      title: t('tour.statusTitle'),
      desc: t('tour.statusDesc')
    },
    {
      title: t('tour.startTitle'),
      desc: t('tour.startDesc')
    }
  ]
}
