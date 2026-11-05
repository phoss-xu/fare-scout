// Newest first. See docs/RELEASES.md before preparing a release.
export const releases = [
  {
    version: '0.1.0-preview.10', status: 'preview', date: null,
    title: {zh: '让每一次更新都有迹可循', en: 'A home for every update'},
    groups: [
      {type: 'added', items: [
        {zh: '新增更新日志，集中查看版本、发布日期和功能变化。', en: 'Browse versions, release dates and product changes in the new changelog.'},
        {zh: '新增 90 天价格采样历史：绿色偏低、橙色偏高，查看历史曲线与采样最低价；新查询开始积累。', en: 'New 90-day sampled price history: green for low fares, orange for high fares, with trends and sampled lows. History builds from new searches.'},
      ]},
      {type: 'improved', items: [
        {zh: '时间范围、航班详情及出行监控的日期入口统一使用主题日历。', en: 'Use the themed calendar for time windows, flight-detail dates and travel-watch dates.'},
        {zh: '出行日期使用统一主题的范围日历，桌面双月、手机单月，连续选择起止日期。', en: 'Choose travel dates in a themed range calendar: two months on desktop, one on mobile, with consecutive start and end selection.'},
        {zh: '压缩航班详情上下区域，航班列表独立滚动；价格历史按需查看。', en: 'Compact flight-detail controls and the total bar, giving independently scrolling flight lists more space; open price history on demand.'},
        {zh: '票价改为醒目的红色大字，与卡片日期同排；金额前使用小号全局货币符号。', en: 'Emphasize fares with large red amounts beside each flight date and a smaller symbol for the global display currency.'},
        {zh: '航班详情删除重复引导、选中标签、日期和价格小计，选中样式直接表达状态。', en: 'Remove repeated instructions, selection labels, dates and subtotals from flight details; selection styling conveys state directly.'},
        {zh: '日期栏两端直接翻页，箭头与日期同排，日历移至去程／返程标题旁。', en: 'Place paging arrows inline at both ends of the dates, with the calendar beside each leg heading.'},
        {zh: '日期导航移除重复年月，收紧切换操作布局。', en: 'Remove the repeated month heading and compact the date navigation controls.'},
        {zh: '打开票价详情自动预查所选日期附近五天，去程与返程日期组合在后台加载，切换日期复用已返回报价。', en: 'Opening fare details preloads five nearby days for outbound and return combinations, with background loading and reuse when switching dates.'},
        {zh: '登录入口融入旅行实景，支持收藏风景、跳过不喜欢的片段。', en: 'Travel films on the sign-in page, with favourites and the option to skip scenes you dislike.'},
        {zh: '查询组合可以保存后回填；新增单程查询与更多报价货币选择。', en: 'Save and reuse search presets, search one-way trips and choose from more quote currencies.'},
      ]},
    ],
  },
  {
    version: null, revision: '85ad7c1', status: 'published', date: '2026-11-03',
    title: {zh: '更顺手的设置与日期选择', en: 'Smoother settings and date selection'},
    groups: [
      {type: 'improved', items: [
        {zh: '设置分组支持折叠，邮件设置留白更舒适。', en: 'Collapsible settings sections and more space in email settings.'},
        {zh: '风景右上角支持手动换图。', en: 'Switch the header scenery using the top-right control.'},
        {zh: '支持固定往返日期与 1–10 晚多选。', en: 'Choose fixed return dates or multiple stays from 1 to 10 nights.'},
      ]},
    ],
  },
];
export const currentRelease = releases[0];
