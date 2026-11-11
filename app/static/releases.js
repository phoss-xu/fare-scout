// Newest first. See docs/RELEASES.md before preparing a release.
export const releases = [
  {
    version: '0.1.3', status: 'published', date: '2026-11-11',
    title: {zh: '更紧凑的登机牌布局', en: 'A more compact boarding pass'},
    groups: [
      {type: 'improved', items: [
        {zh: '只保留目的地照片并移至登机牌左侧；窄屏以侧栏展示照片，同时收紧行程间距。', en: 'Show only the destination photo beside the boarding pass; use a slim photo rail and tighter itinerary spacing on small screens.'},
      ]},
    ],
  },
  {
    version: '0.1.2', status: 'published', date: '2026-11-10',
    title: {zh: '更清晰的报价卡片与停留日期', en: 'Clearer fare cards and stay dates'},
    groups: [
      {type: 'improved', items: [
        {zh: '搜特价默认查询目的地停留 2–5 晚；可继续自选 1–10 晚。', en: 'Fare search now defaults to stays of 2–5 nights; choose any stay from 1–10 nights.'},
        {zh: '重新整理报价卡片，保留完整目的地照片，并清晰展示城市、价格、日期和航班。', en: 'Reshape fare cards to preserve full destination photos and clarify city, fare, dates and flights.'},
        {zh: '价格状态灯会说明历史报价位置；提醒与核价操作改为有色图标。', en: 'Explain the fare indicator against sampled history; use colored icons for alert and booking actions.'},
        {zh: '每日推荐偏好摘要仅在每日推荐视图中显示。', en: 'Show the daily preference summary only in the daily recommendations view.'},
      ]},
    ],
  },
  {
    version: '0.1.1', status: 'published', date: '2026-11-06',
    title: {zh: '更清晰的机票卡片', en: 'Clearer fare cards'},
    groups: [
      {type: 'improved', items: [
        {zh: '整合目的地照片与航班行程，窄屏清晰呈现航段，次要信息可按需展开。', en: 'Bring destination photos and itineraries together, with a clearer small-screen layout and secondary details on demand.'},
        {zh: '票价使用小号货币符号与颜色状态灯，价格历史按需查看。', en: 'Use a compact currency symbol and color indicator for fares; open price history on demand.'},
      ]},
    ],
  },
  {
    version: '0.1.0', status: 'published', date: '2026-11-05',
    title: {zh: '更灵活的日期与票价比较', en: 'Flexible dates and better fare comparison'},
    groups: [
      {type: 'added', items: [
        {zh: '去返程航班联动选择，按地区浏览国家与精选城市。', en: 'Compare linked outbound and return flights, and browse countries and curated cities by region.'},
        {zh: '新增更新日志，集中查看版本、发布日期和功能变化。', en: 'Browse versions, release dates and product changes in the new changelog.'},
        {zh: '新增 90 天价格采样历史：绿色偏低、橙色偏高，查看历史曲线与采样最低价；新查询开始积累。', en: 'New 90-day sampled price history: green for low fares, orange for high fares, with trends and sampled lows. History builds from new searches.'},
      ]},
      {type: 'improved', items: [
        {zh: '目的地推荐左侧国家可直接选择或取消，覆盖整个国家的目的地范围。', en: 'Select or deselect countries directly beside recommended cities to search the whole country.'},
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
